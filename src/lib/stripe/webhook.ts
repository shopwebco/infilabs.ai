import type Stripe from "stripe";
import { applySubscriptionState } from "./sync";

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Applies a verified Stripe event to our data model. Every branch is idempotent,
 * so redelivered or concurrently-delivered events are safe.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await applySubscriptionState({
        customerId: customerId(sub.customer),
        subscriptionId: sub.id,
        priceId: sub.items.data[0]?.price.id ?? null,
        status: sub.status,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await applySubscriptionState({
        customerId: customerId(sub.customer),
        subscriptionId: null,
        priceId: null,
        status: "canceled",
      });
      break;
    }
    case "checkout.session.completed":
      // The customer was linked when the session was created; the subscription.*
      // events carry the price + status we reconcile plan from. No action needed.
      break;
    case "invoice.paid":
      // Payment succeeded — subscription.updated reconciles plan state. No-op.
      break;
    default:
      break;
  }
}
