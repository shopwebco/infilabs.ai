import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// Monthly recurring value per plan, in cents (docs/PRODUCT_SPEC.md §3).
// Plans are set by Stripe webhooks (Phase 1), so DB plan state reconciles with Stripe.
export const PLAN_MRR_CENTS: Record<Plan, number> = {
  STARTER: 0,
  PRO: 4900,
  AGENCY: 19900,
  ENTERPRISE: 0, // custom — not counted automatically
};

export async function getPlatformMetrics() {
  const grouped = await prisma.user.groupBy({
    by: ["plan"],
    _count: { _all: true },
  });

  const planDistribution = grouped
    .map((g) => ({ plan: g.plan, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const accounts = planDistribution.reduce((s, p) => s + p.count, 0);
  const mrrCents = planDistribution.reduce(
    (s, p) => s + PLAN_MRR_CENTS[p.plan] * p.count,
    0,
  );

  const referral = await prisma.referralConversion.aggregate({
    where: { active: true },
    _sum: { monthlyCents: true },
  });

  return {
    accounts,
    planDistribution,
    mrrCents,
    payoutLedgerCents: referral._sum.monthlyCents ?? 0,
  };
}
