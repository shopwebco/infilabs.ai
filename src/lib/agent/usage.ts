import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// Starter plan: 25 agent queries per calendar month (docs/PRODUCT_SPEC.md §3).
export const STARTER_MONTHLY_QUERY_LIMIT = 25;

export class QuotaExceededError extends Error {
  readonly status = 402; // Payment Required — upgrade to continue.
  constructor(readonly limit: number) {
    super(
      `You've reached the Starter limit of ${limit} agent queries this month. Upgrade to Pro for unlimited queries.`,
    );
    this.name = "QuotaExceededError";
  }
}

/** Current billing month key, e.g. "2026-07". Injectable for tests. */
export function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Atomically records one agent query for a user, enforcing the Starter monthly
 * cap server-side. The 26th query in a month for a Starter user is rejected.
 * Paid plans are unlimited (usage still tracked for analytics/briefings).
 *
 * Throws QuotaExceededError (402) when a Starter user is over the limit — the
 * check and increment run in one transaction so concurrent calls can't overrun.
 */
export async function consumeAgentQuery(
  userId: string,
  plan: Plan,
  now = new Date(),
): Promise<{ count: number; limited: boolean }> {
  const month = monthKey(now);
  const enforce = plan === "STARTER";

  return prisma.$transaction(async (tx) => {
    const current = await tx.agentUsage.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, count: 0 },
      update: {},
      select: { count: true },
    });

    if (enforce && current.count >= STARTER_MONTHLY_QUERY_LIMIT) {
      throw new QuotaExceededError(STARTER_MONTHLY_QUERY_LIMIT);
    }

    const next = await tx.agentUsage.update({
      where: { userId_month: { userId, month } },
      data: { count: { increment: 1 } },
      select: { count: true },
    });

    return { count: next.count, limited: enforce };
  });
}

/** Read current usage for a month without consuming (for dashboards). */
export async function getAgentUsage(userId: string, now = new Date()): Promise<number> {
  const row = await prisma.agentUsage.findUnique({
    where: { userId_month: { userId, month: monthKey(now) } },
    select: { count: true },
  });
  return row?.count ?? 0;
}
