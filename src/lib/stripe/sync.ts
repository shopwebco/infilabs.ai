import type Stripe from "stripe";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { planForPriceId } from "@/lib/stripe/plans";

// Subscription statuses that grant paid access. Anything else → downgrade.
const ACTIVE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "active",
  "trialing",
  "past_due",
]);

/**
 * Reconciles a user's plan from a Stripe subscription's current state.
 * Idempotent: safe to call repeatedly from any subscription webhook.
 * Identifies the user by stripeCustomerId (set when the checkout session is created).
 */
export async function applySubscriptionState(params: {
  customerId: string;
  subscriptionId: string | null;
  priceId: string | null;
  status: Stripe.Subscription.Status | null;
}): Promise<{ updated: boolean; plan: Plan | null }> {
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: params.customerId },
    select: { id: true, plan: true },
  });
  // Unknown customer → nothing to reconcile (not our record).
  if (!user) return { updated: false, plan: null };

  const isActive = params.status ? ACTIVE_STATUSES.has(params.status) : false;

  let plan: Plan = "STARTER";
  let subscriptionId: string | null = null;
  if (isActive && params.priceId) {
    // Only move to a plan we recognize; otherwise keep the user where they are.
    plan = planForPriceId(params.priceId) ?? user.plan;
    subscriptionId = params.subscriptionId;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { plan, stripeSubscriptionId: subscriptionId },
  });

  return { updated: true, plan };
}
