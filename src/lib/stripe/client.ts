import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazily construct the Stripe client. Throws a clear error if the key is absent
 * (feature-gate, never a silent fake fallback — ARCHITECTURE §8).
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — billing is unavailable until Stripe is configured.",
    );
  }
  cached = new Stripe(key, { typescript: true });
  return cached;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
