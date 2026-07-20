import type Stripe from "stripe";
import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

function mapInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus | null {
  switch (status) {
    case "draft":
      return "DRAFT";
    case "open":
      return "OPEN";
    case "paid":
      return "PAID";
    case "void":
      return "VOID";
    case "uncollectible":
      return "OVERDUE";
    default:
      return null;
  }
}

/**
 * Applies a verified CONNECTED-ACCOUNT event. Idempotent branches only.
 * - invoice.*: mirror into ClientInvoice, keyed by stripeInvoiceId. The client
 *   project is identified by metadata.clientProjectId that we set at creation
 *   (retainer invoices inherit it from subscription_details metadata). Events
 *   for invoices we can't attribute are ignored — never guess a tenant.
 * - account.updated: persist onboarding completion on the owning workspace.
 */
export async function handleConnectEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const onboarded = Boolean(account.details_submitted && account.charges_enabled);
    await prisma.workspace.updateMany({
      where: { stripeConnectAccountId: account.id },
      data: { connectOnboarded: onboarded },
    });
    return;
  }

  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    const status = mapInvoiceStatus(invoice.status);
    if (!invoice.id || !status) return;

    const clientProjectId =
      invoice.metadata?.clientProjectId ??
      invoice.subscription_details?.metadata?.clientProjectId ??
      null;
    if (!clientProjectId) return; // not one of ours — never attribute by guesswork

    // The project must exist (connected accounts can bill outside Xenon too).
    const project = await prisma.clientProject.findUnique({
      where: { id: clientProjectId },
      select: { id: true },
    });
    if (!project) return;

    const recurring = Boolean(invoice.subscription);
    await prisma.clientInvoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        clientProjectId,
        stripeInvoiceId: invoice.id,
        amountCents: invoice.amount_due,
        currency: invoice.currency ?? "usd",
        status,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        recurring,
      },
      update: {
        status,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      },
    });
  }
}
