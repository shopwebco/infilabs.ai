import type { Plan } from "@prisma/client";

/** Plans that unlock "Pro-level" features (unlimited agent, all marketplaces, etc.). */
export const PRO_OR_HIGHER: readonly Plan[] = ["PRO", "AGENCY", "ENTERPRISE"];

export class PlanRequiredError extends Error {
  readonly status = 403;
  constructor(readonly allowed: readonly Plan[]) {
    super(`This feature requires one of: ${allowed.join(", ")}`);
    this.name = "PlanRequiredError";
  }
}

/**
 * Server-side plan gate. UI hiding is never a substitute (Rule 5).
 * Throws PlanRequiredError (403) when the user's plan is not permitted.
 */
export function requirePlan(user: { plan: Plan }, allowed: readonly Plan[]): void {
  if (!allowed.includes(user.plan)) {
    throw new PlanRequiredError(allowed);
  }
}

export function hasPlan(user: { plan: Plan }, allowed: readonly Plan[]): boolean {
  return allowed.includes(user.plan);
}
