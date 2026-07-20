import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/auth/rbac";
import {
  extraClientQuantity,
  computeQuantitySyncPlan,
  requireConnectOnboarded,
} from "@/lib/stripe/connect";
import { POST as connectWebhookPost } from "@/app/api/stripe/connect-webhook/route";

const RUN = `connect_${Date.now()}`;
const ACCT = `acct_${RUN}`;
const SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

let workspaceId = "";
let clientProjectId = "";

beforeAll(async () => {
  const owner = await prisma.user.create({
    data: { email: `${RUN}_owner@example.com`, plan: "AGENCY" },
    select: { id: true },
  });
  const ws = await prisma.workspace.create({
    data: { name: `${RUN}_ws`, ownerId: owner.id, stripeConnectAccountId: ACCT },
  });
  workspaceId = ws.id;
  const client = await prisma.clientProject.create({
    data: { workspaceId: ws.id, name: "Billable Client" },
  });
  clientProjectId = client.id;
});

afterAll(async () => {
  await prisma.processedStripeEvent.deleteMany({ where: { id: { contains: RUN } } });
  await prisma.clientInvoice.deleteMany({ where: { clientProjectId } });
  await prisma.clientProject.deleteMany({ where: { id: clientProjectId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

describe("extra-client quantity (5 included)", () => {
  it("bills only clients beyond the included five", () => {
    expect(extraClientQuantity(0)).toBe(0);
    expect(extraClientQuantity(5)).toBe(0);
    expect(extraClientQuantity(6)).toBe(1);
    expect(extraClientQuantity(12)).toBe(7);
  });
});

describe("quantity sync planner", () => {
  const price = "price_extra";
  it("covers create / update / delete / none", () => {
    expect(computeQuantitySyncPlan([], price, 0)).toEqual({ action: "none" });
    expect(computeQuantitySyncPlan([], price, 2)).toEqual({ action: "create", quantity: 2 });
    expect(
      computeQuantitySyncPlan([{ id: "si_1", priceId: price, quantity: 2 }], price, 2),
    ).toEqual({ action: "none" });
    expect(
      computeQuantitySyncPlan([{ id: "si_1", priceId: price, quantity: 2 }], price, 4),
    ).toEqual({ action: "update", itemId: "si_1", quantity: 4 });
    expect(
      computeQuantitySyncPlan([{ id: "si_1", priceId: price, quantity: 2 }], price, 0),
    ).toEqual({ action: "delete", itemId: "si_1" });
    // Other items (the base Agency price) are left alone.
    expect(
      computeQuantitySyncPlan([{ id: "si_base", priceId: "price_base", quantity: 1 }], price, 0),
    ).toEqual({ action: "none" });
  });
});

describe("connect onboarding gate", () => {
  it("blocks billing until onboarding is complete", () => {
    expect(() =>
      requireConnectOnboarded({ stripeConnectAccountId: null, connectOnboarded: false }),
    ).toThrow(ForbiddenError);
    expect(() =>
      requireConnectOnboarded({ stripeConnectAccountId: ACCT, connectOnboarded: false }),
    ).toThrow(ForbiddenError);
    expect(
      requireConnectOnboarded({ stripeConnectAccountId: ACCT, connectOnboarded: true }),
    ).toBe(ACCT);
  });
});

function sign(payload: string): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

async function post(payload: string, signature: string) {
  const req = new Request("http://localhost/api/stripe/connect-webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
  const res = await connectWebhookPost(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("connected-account webhook", () => {
  it("rejects an invalid signature", async () => {
    const res = await post(JSON.stringify({ id: `evt_${RUN}_bad`, type: "invoice.paid" }), "t=1,v1=bad");
    expect(res.status).toBe(400);
  });

  it("flips connectOnboarded from account.updated", async () => {
    const payload = JSON.stringify({
      id: `evt_${RUN}_acct`,
      object: "event",
      type: "account.updated",
      account: ACCT,
      data: { object: { id: ACCT, object: "account", details_submitted: true, charges_enabled: true } },
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(ws.connectOnboarded).toBe(true);
  });

  it("mirrors an attributed invoice.paid into ClientInvoice and is idempotent", async () => {
    const payload = JSON.stringify({
      id: `evt_${RUN}_inv`,
      object: "event",
      type: "invoice.paid",
      account: ACCT,
      data: {
        object: {
          id: `in_${RUN}`,
          object: "invoice",
          status: "paid",
          amount_due: 25000,
          currency: "usd",
          hosted_invoice_url: "https://invoice.stripe.com/i/test",
          metadata: { clientProjectId },
        },
      },
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);

    const row = await prisma.clientInvoice.findUniqueOrThrow({
      where: { stripeInvoiceId: `in_${RUN}` },
    });
    expect(row.status).toBe("PAID");
    expect(row.amountCents).toBe(25000);
    expect(row.clientProjectId).toBe(clientProjectId);

    // Redelivery is acknowledged without reprocessing.
    const dup = await post(payload, sign(payload));
    expect(dup.body.duplicate).toBe(true);
  });

  it("ignores invoices it cannot attribute to a client project", async () => {
    const payload = JSON.stringify({
      id: `evt_${RUN}_stray`,
      object: "event",
      type: "invoice.paid",
      account: ACCT,
      data: {
        object: {
          id: `in_${RUN}_stray`,
          object: "invoice",
          status: "paid",
          amount_due: 900,
          currency: "usd",
          metadata: {},
        },
      },
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);
    const row = await prisma.clientInvoice.findUnique({
      where: { stripeInvoiceId: `in_${RUN}_stray` },
    });
    expect(row).toBeNull();
  });
});
