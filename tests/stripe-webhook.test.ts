import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { POST } from "@/app/api/stripe/webhook/route";

const RUN = `whtest_${Date.now()}`;
const CUSTOMER = `cus_${RUN}`;
const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const PRO_PRICE = process.env.STRIPE_PRICE_PRO!;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${RUN}@example.com`,
      name: "Webhook User",
      plan: "STARTER",
      stripeCustomerId: CUSTOMER,
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.processedStripeEvent.deleteMany({ where: { id: { contains: RUN } } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

function subscriptionEvent(input: {
  eventId: string;
  type: "customer.subscription.updated" | "customer.subscription.deleted";
  status: Stripe.Subscription.Status;
  priceId: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: "event",
    type: input.type,
    data: {
      object: {
        id: `sub_${RUN}`,
        object: "subscription",
        customer: CUSTOMER,
        status: input.status,
        items: { data: [{ price: { id: input.priceId } }] },
      },
    },
  });
}

async function post(payload: string, signature: string) {
  const req = new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
  const res = await POST(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function sign(payload: string): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

describe("Stripe webhook", () => {
  it("rejects an invalid signature with 400", async () => {
    const payload = subscriptionEvent({
      eventId: `evt_${RUN}_bad`,
      type: "customer.subscription.updated",
      status: "active",
      priceId: PRO_PRICE,
    });
    const res = await post(payload, "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
    // A rejected event must not touch the user.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.plan).toBe("STARTER");
  });

  it("upgrades the user to Pro on an active subscription event", async () => {
    const payload = subscriptionEvent({
      eventId: `evt_${RUN}_up`,
      type: "customer.subscription.updated",
      status: "active",
      priceId: PRO_PRICE,
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.plan).toBe("PRO");
    expect(user.stripeSubscriptionId).toBe(`sub_${RUN}`);
  });

  it("is idempotent — a redelivered event is acked without reprocessing", async () => {
    const payload = subscriptionEvent({
      eventId: `evt_${RUN}_up`, // same id as the upgrade event
      type: "customer.subscription.updated",
      status: "active",
      priceId: PRO_PRICE,
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  it("downgrades to Starter when the subscription is cancelled", async () => {
    const payload = subscriptionEvent({
      eventId: `evt_${RUN}_del`,
      type: "customer.subscription.deleted",
      status: "canceled",
      priceId: PRO_PRICE,
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.plan).toBe("STARTER");
    expect(user.stripeSubscriptionId).toBeNull();
  });
});
