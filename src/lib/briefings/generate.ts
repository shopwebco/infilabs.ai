import type { BriefingCadence, Plan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Pro/Agency/Enterprise get daily briefings; Starter gets weekly (PRODUCT_SPEC §4.2). */
export function cadenceForPlan(plan: Plan): BriefingCadence {
  return plan === "STARTER" ? "WEEKLY" : "DAILY";
}

export function periodFor(cadence: BriefingCadence, end: Date): { start: Date; end: Date } {
  const ms = cadence === "WEEKLY" ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
  return { start: new Date(end.getTime() - ms), end };
}

export interface BriefingBody {
  quiet: boolean;
  headline: string;
  actionCount: number;
  pendingDecisions: number;
  actions: { kind: string; summary: string; valueImpactCents: number | null; createdAt: string }[];
  approvals: { title: string; status: string }[];
}

/**
 * Builds a briefing from ONLY real AgentAction + Approval rows in the window.
 * An empty window yields an honest "quiet period" briefing — never filler
 * numbers (Rule 1; Phase 7 acceptance).
 */
export async function generateBriefingData(
  scope: { type: "USER" | "CLIENT"; id: string },
  start: Date,
  end: Date,
): Promise<{ body: BriefingBody; valueRecoveredCents: number }> {
  const where =
    scope.type === "USER" ? { userId: scope.id } : { clientProjectId: scope.id };

  const [actions, approvals] = await Promise.all([
    prisma.agentAction.findMany({
      where: { ...where, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      select: { kind: true, summary: true, valueImpactCents: true, createdAt: true },
    }),
    prisma.approval.findMany({
      where: { ...where, createdAt: { gte: start, lt: end } },
      select: { title: true, status: true },
    }),
  ]);

  const valueRecoveredCents = actions.reduce((s, a) => s + (a.valueImpactCents ?? 0), 0);
  const pendingDecisions = approvals.filter((a) => a.status === "PENDING").length;
  const quiet = actions.length === 0 && approvals.length === 0;

  const parts: string[] = [];
  if (!quiet) {
    parts.push(`${actions.length} agent action${actions.length === 1 ? "" : "s"}`);
    if (pendingDecisions > 0) parts.push(`${pendingDecisions} awaiting your decision`);
    if (valueRecoveredCents > 0) parts.push(`$${(valueRecoveredCents / 100).toFixed(2)} recovered`);
  }
  const headline = quiet
    ? "Quiet period — no agent activity or decisions to report."
    : `${parts.join(", ")}.`;

  return {
    body: {
      quiet,
      headline,
      actionCount: actions.length,
      pendingDecisions,
      actions: actions.map((a) => ({
        kind: a.kind,
        summary: a.summary,
        valueImpactCents: a.valueImpactCents,
        createdAt: a.createdAt.toISOString(),
      })),
      approvals: approvals.map((a) => ({ title: a.title, status: a.status })),
    },
    valueRecoveredCents,
  };
}

export async function createAndStoreBriefing(
  scope: { type: "USER" | "CLIENT"; id: string },
  cadence: BriefingCadence,
  start: Date,
  end: Date,
) {
  const { body, valueRecoveredCents } = await generateBriefingData(scope, start, end);
  return prisma.briefing.create({
    data: {
      scopeType: scope.type,
      scopeId: scope.id,
      cadence,
      periodStart: start,
      periodEnd: end,
      body: body as unknown as Prisma.InputJsonValue,
      valueRecoveredCents,
    },
    select: { id: true, valueRecoveredCents: true },
  });
}

export async function listUserBriefings(userId: string) {
  return prisma.briefing.findMany({
    where: { scopeType: "USER", scopeId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
