import type { Membership } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/stripe/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { appUrl } from "@/lib/stripe/checkout";

// Agency plan includes 5 client projects; each extra is billed via a quantity
// item on the owner's platform subscription (docs/PRODUCT_SPEC.md §3).
export const INCLUDED_CLIENT_PROJECTS = 5;

/** Pure: how many extra-client units should be billed for `activeClients`. */
export function extraClientQuantity(activeClients: number): number {
  return Math.max(0, activeClients - INCLUDED_CLIENT_PROJECTS);
}

export type QuantitySyncPlan =
  | { action: "none" }
  | { action: "create"; quantity: number }
  | { action: "update"; itemId: string; quantity: number }
  | { action: "delete"; itemId: string };

/**
 * Pure: decide how to reconcile the subscription's extra-client item with the
 * desired quantity. `items` is the subscription's current items mapped to
 * {id, priceId, quantity}; `extraPriceId` is the +$25/client price.
 */
export function computeQuantitySyncPlan(
  items: { id: string; priceId: string; quantity: number }[],
  extraPriceId: string,
  desired: number,
): QuantitySyncPlan {
  const existing = items.find((i) => i.priceId === extraPriceId);
  if (!existing) {
    return desired > 0 ? { action: "create", quantity: desired } : { action: "none" };
  }
  if (desired === 0) return { action: "delete", itemId: existing.id };
  if (existing.quantity === desired) return { action: "none" };
  return { action: "update", itemId: existing.id, quantity: desired };
}

/** Gate: agency billing features require completed Connect onboarding. */
export function requireConnectOnboarded(workspace: {
  stripeConnectAccountId: string | null;
  connectOnboarded: boolean;
}): string {
  if (!workspace.stripeConnectAccountId || !workspace.connectOnboarded) {
    throw new ForbiddenError(
      "Connect your Stripe account (and finish onboarding) before billing clients.",
    );
  }
  return workspace.stripeConnectAccountId;
}

/**
 * Starts (or resumes) Stripe Connect Standard onboarding for a workspace.
 * ADMIN only. Creates the connected account on first use, then returns a fresh
 * Account Link URL for the hosted onboarding flow.
 */
export async function startConnectOnboarding(actor: Membership): Promise<string> {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can manage agency billing.");
  }
  const stripe = getStripe();
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: actor.workspaceId },
    select: { id: true, name: true, stripeConnectAccountId: true },
  });

  let accountId = workspace.stripeConnectAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      metadata: { workspaceId: workspace.id },
    });
    accountId = account.id;
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/agency/${workspace.id}?connect=refresh`,
    return_url: `${appUrl()}/agency/${workspace.id}?connect=return`,
  });
  return link.url;
}

/** Re-reads the connected account and persists whether onboarding is complete. */
export async function refreshConnectStatus(workspaceId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { stripeConnectAccountId: true },
  });
  if (!workspace.stripeConnectAccountId) return false;

  const account = await getStripe().accounts.retrieve(workspace.stripeConnectAccountId);
  const onboarded = Boolean(account.details_submitted && account.charges_enabled);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { connectOnboarded: onboarded },
  });
  return onboarded;
}

/**
 * Creates a real invoice (one-off) or retainer (monthly subscription) for a
 * client ON THE AGENCY'S CONNECTED ACCOUNT — funds flow to the agency, never to
 * Xenon. Mirrors a ClientInvoice row immediately; webhooks keep status fresh.
 */
export async function createClientBillingItem(input: {
  connectAccountId: string;
  clientProjectId: string;
  clientName: string;
  customerEmail: string;
  description: string;
  amountCents: number;
  recurring: boolean;
}) {
  const stripe = getStripe();
  const opts = { stripeAccount: input.connectAccountId };

  // Find-or-create the payer on the connected account.
  const existing = await stripe.customers.list(
    { email: input.customerEmail, limit: 1 },
    opts,
  );
  const customer =
    existing.data[0] ??
    (await stripe.customers.create(
      {
        email: input.customerEmail,
        name: input.clientName,
        metadata: { clientProjectId: input.clientProjectId },
      },
      opts,
    ));

  if (input.recurring) {
    // Monthly retainer — invoices arrive via the connected-account webhook.
    const product = await stripe.products.create({ name: input.description }, opts);
    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: 7,
        items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: input.amountCents,
              recurring: { interval: "month" },
              product: product.id,
            },
          },
        ],
        metadata: { clientProjectId: input.clientProjectId },
      },
      opts,
    );
    return { kind: "retainer" as const, subscriptionId: subscription.id };
  }

  // One-off invoice, finalized so the hosted payment page exists immediately.
  const invoice = await stripe.invoices.create(
    {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 7,
      metadata: { clientProjectId: input.clientProjectId },
    },
    opts,
  );
  await stripe.invoiceItems.create(
    {
      customer: customer.id,
      invoice: invoice.id,
      amount: input.amountCents,
      currency: "usd",
      description: input.description,
    },
    opts,
  );
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id!, opts);

  const mirrored = await prisma.clientInvoice.upsert({
    where: { stripeInvoiceId: finalized.id! },
    create: {
      clientProjectId: input.clientProjectId,
      stripeInvoiceId: finalized.id!,
      amountCents: finalized.amount_due,
      currency: finalized.currency ?? "usd",
      status: "OPEN",
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      recurring: false,
    },
    update: {
      status: "OPEN",
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
    },
    select: { id: true, stripeInvoiceId: true, hostedInvoiceUrl: true },
  });
  return { kind: "invoice" as const, invoice: mirrored };
}

/**
 * Reconciles the workspace owner's Agency subscription quantity with the count
 * of active (non-archived) client projects. Feature-gated and non-fatal: when
 * Stripe/the subscription/the price isn't available it reports why instead of
 * failing the client-project write it rides on.
 */
export async function syncAgencyClientQuantity(
  workspaceId: string,
): Promise<{ synced: boolean; reason?: string; desired?: number }> {
  const extraPriceId = process.env.STRIPE_PRICE_AGENCY_CLIENT;
  if (!process.env.STRIPE_SECRET_KEY || !extraPriceId) {
    return { synced: false, reason: "stripe_not_configured" };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) return { synced: false, reason: "workspace_not_found" };

  const owner = await prisma.user.findUnique({
    where: { id: workspace.ownerId },
    select: { stripeSubscriptionId: true },
  });
  if (!owner?.stripeSubscriptionId) {
    return { synced: false, reason: "no_platform_subscription" };
  }

  const activeClients = await prisma.clientProject.count({
    where: { workspaceId, archived: false },
  });
  const desired = extraClientQuantity(activeClients);

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(owner.stripeSubscriptionId);
  const plan = computeQuantitySyncPlan(
    subscription.items.data.map((i) => ({
      id: i.id,
      priceId: i.price.id,
      quantity: i.quantity ?? 1,
    })),
    extraPriceId,
    desired,
  );

  switch (plan.action) {
    case "create":
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: extraPriceId,
        quantity: plan.quantity,
      });
      break;
    case "update":
      await stripe.subscriptionItems.update(plan.itemId, { quantity: plan.quantity });
      break;
    case "delete":
      await stripe.subscriptionItems.del(plan.itemId);
      break;
    case "none":
      break;
  }
  return { synced: true, desired };
}
