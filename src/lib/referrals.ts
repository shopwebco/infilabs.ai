import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PLAN_MRR_CENTS } from "@/lib/admin/metrics";

const COMMISSION_PCT = 25;

/**
 * Attribute a new signup to the referring agency (by its referral code).
 * No-op if the code doesn't match. Commission value tracks the referred user's
 * plan (0 at Starter signup; updated when they upgrade).
 */
export async function attributeReferral(
  referralCode: string,
  referredUserId: string,
  plan: Plan,
) {
  const ws = await prisma.workspace.findUnique({
    where: { referralCode },
    select: { id: true },
  });
  if (!ws) return null;

  // One attribution per referred user.
  const existing = await prisma.referralConversion.findFirst({
    where: { referredUserId },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.referralConversion.create({
    data: {
      workspaceId: ws.id,
      referredUserId,
      commissionPct: COMMISSION_PCT,
      monthlyCents: Math.round((PLAN_MRR_CENTS[plan] * COMMISSION_PCT) / 100),
    },
    select: { id: true, workspaceId: true },
  });
}
