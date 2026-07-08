import type Stripe from "stripe";

/** Pure builder for the Pro upgrade Checkout Session params (unit-testable). */
export function buildCheckoutSessionParams(input: {
  customerId: string;
  priceId: string;
  appUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${input.appUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${input.appUrl}/dashboard/billing?checkout=cancelled`,
  };
}

export function appUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
