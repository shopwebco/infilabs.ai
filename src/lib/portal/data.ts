import { prisma } from "@/lib/db/prisma";

/**
 * The portal's read model for one client project. WorkItems are filtered to
 * APPROVED/PUBLISHED only — DRAFT and IN_REVIEW are NEVER returned to a
 * client-facing query (invariant 2), enforced here in the query layer.
 */
export async function getPortalView(clientProjectId: string) {
  const [client, approvals, workItems, actions] = await Promise.all([
    prisma.clientProject.findUnique({
      where: { id: clientProjectId },
      select: { id: true, name: true },
    }),
    prisma.approval.findMany({
      where: { clientProjectId, audience: "CLIENT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, detail: true, status: true, decidedAt: true },
    }),
    prisma.workItem.findMany({
      where: { clientProjectId, status: { in: ["APPROVED", "PUBLISHED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.agentAction.findMany({
      where: { clientProjectId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        summary: true,
        valueImpactCents: true,
        createdAt: true,
      },
    }),
  ]);

  return { client, approvals, workItems, actions };
}
