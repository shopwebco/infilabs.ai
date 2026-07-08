import type { ActionActor, Membership, Prisma, WorkStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError, hasRole } from "@/lib/auth/rbac";
import { assertClientAccess } from "@/lib/agency/clients";

function roleToActor(role: Membership["role"]): ActionActor {
  return role; // ADMIN | MANAGER | STAFF map 1:1 to ActionActor members
}

/** Create a draft work item. Any member assigned to the client may draft (incl. staff). */
export async function createWorkItem(
  membership: Membership,
  clientProjectId: string,
  input: { title: string; body: Prisma.InputJsonValue },
) {
  await assertClientAccess(membership, clientProjectId);
  return prisma.workItem.create({
    data: {
      clientProjectId,
      title: input.title,
      body: input.body,
      status: "DRAFT",
      createdByRole: roleToActor(membership.role),
      createdById: membership.userId,
    },
    select: { id: true, title: true, status: true, createdAt: true },
  });
}

export async function listWorkItems(membership: Membership, clientProjectId: string) {
  await assertClientAccess(membership, clientProjectId);
  return prisma.workItem.findMany({
    where: { clientProjectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdByRole: true,
      createdById: true,
      reviewedById: true,
      createdAt: true,
    },
  });
}

export type WorkItemAction = "submit" | "approve" | "publish";

const TRANSITIONS: Record<WorkItemAction, { from: WorkStatus; to: WorkStatus }> = {
  submit: { from: "DRAFT", to: "IN_REVIEW" },
  approve: { from: "IN_REVIEW", to: "APPROVED" },
  publish: { from: "APPROVED", to: "PUBLISHED" },
};

/**
 * Move a work item through the review queue with server-side authorization:
 * - submit:  creator or MANAGER+ (staff can submit their own drafts)
 * - approve: MANAGER+ only  (staff → 403)
 * - publish: MANAGER+ only  (staff → 403 — "staff cannot publish")
 */
export async function transitionWorkItem(
  membership: Membership,
  workItemId: string,
  action: WorkItemAction,
) {
  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { id: true, clientProjectId: true, status: true, createdById: true },
  });
  if (!item) throw new NotFoundError("Work item not found.");

  // Enforces same-workspace + assignment scope (cross-tenant → 404 / 403).
  await assertClientAccess(membership, item.clientProjectId);

  if (action === "approve" || action === "publish") {
    if (!hasRole(membership.role, "MANAGER")) {
      throw new ForbiddenError(
        `Only managers and admins can ${action} work. Staff output must be reviewed.`,
      );
    }
  } else if (action === "submit") {
    const isOwner = item.createdById === membership.userId;
    if (!isOwner && !hasRole(membership.role, "MANAGER")) {
      throw new ForbiddenError("You can only submit your own drafts for review.");
    }
  }

  const { from, to } = TRANSITIONS[action];
  if (item.status !== from) {
    throw new ForbiddenError(
      `Cannot ${action} a work item that is ${item.status} (expected ${from}).`,
    );
  }

  return prisma.workItem.update({
    where: { id: workItemId },
    data: {
      status: to,
      ...(action === "approve" || action === "publish"
        ? { reviewedById: membership.userId }
        : {}),
    },
    select: { id: true, status: true, reviewedById: true },
  });
}
