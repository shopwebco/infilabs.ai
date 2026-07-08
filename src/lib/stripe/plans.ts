import type { Plan } from "@prisma/client";

/**
 * Maps a paid Plan to the env var holding its Stripe Price ID.
 * Price IDs live in the Stripe dashboard (test mode) and are injected via env
 * so the same code works across test/live without hardcoded IDs.
 */
const PLAN_PRICE_ENV: Partial<Record<Plan, string>> = {
  PRO: "STRIPE_PRICE_PRO",
  AGENCY: "STRIPE_PRICE_AGENCY",
};

export function priceIdForPlan(plan: Plan): string {
  const envKey = PLAN_PRICE_ENV[plan];
  const priceId = envKey ? process.env[envKey] : undefined;
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for plan ${plan} (expected env ${envKey ?? "n/a"}).`,
    );
  }
  return priceId;
}

/** Reverse lookup: which Plan does a given Stripe Price ID correspond to (if any). */
export function planForPriceId(priceId: string): Plan | null {
  for (const [plan, envKey] of Object.entries(PLAN_PRICE_ENV) as [Plan, string][]) {
    if (process.env[envKey] && process.env[envKey] === priceId) {
      return plan;
    }
  }
  return null;
}
