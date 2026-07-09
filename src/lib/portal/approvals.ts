import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/auth/rbac";

/**
 * Client approves/declines a pending Approval. Scoped: the approval must belong
 * to the portal session's own project (cross-tenant → 404). Flips the row and
 * writes an append-only AgentAction so the decision surfaces in agency views.
 */
export async function decideApproval(
  session: { portalUserId: string; clientProjectId: string },
  approvalId: string,
  decision: "approve" | "decline",
  now = new Date(),
) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    select: { id: true, clientProjectId: true, status: true, title: true },
  });
  if (!approval || approval.clientProjectId !== session.clientProjectId) {
    throw new NotFoundError("Approval not found.");
  }
  if (approval.status !== "PENDING") {
    throw new ForbiddenError("A decision has already been recorded for this item.");
  }

  const status = decision === "approve" ? "APPROVED" : "DECLINED";

  const [updated] = await prisma.$transaction([
    prisma.approval.update({
      where: { id: approvalId },
      data: { status, decidedById: session.portalUserId, decidedAt: now },
      select: { id: true, status: true },
    }),
    prisma.agentAction.create({
      data: {
        clientProjectId: session.clientProjectId,
        actor: "SYSTEM",
        kind: "approval.decided",
        summary: `Client ${decision === "approve" ? "approved" : "declined"}: ${approval.title}`,
        payload: { approvalId, decision },
      },
    }),
  ]);

  return updated;
}
