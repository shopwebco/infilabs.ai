import type { Membership } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, hasRole } from "@/lib/auth/rbac";
import { assertClientAccess } from "@/lib/agency/clients";

/** Add a client-portal user (email) to a client project. MANAGER+ with client access. */
export async function addPortalUser(
  actor: Membership,
  clientProjectId: string,
  email: string,
  name?: string,
) {
  if (!hasRole(actor.role, "MANAGER")) {
    throw new ForbiddenError("Only managers and admins can add portal users.");
  }
  await assertClientAccess(actor, clientProjectId);
  const normalized = email.toLowerCase().trim();
  return prisma.clientPortalUser.upsert({
    where: { clientProjectId_email: { clientProjectId, email: normalized } },
    create: { clientProjectId, email: normalized, name: name?.trim() || null },
    update: {},
    select: { id: true, email: true, name: true },
  });
}

export async function listPortalUsers(actor: Membership, clientProjectId: string) {
  await assertClientAccess(actor, clientProjectId);
  return prisma.clientPortalUser.findMany({
    where: { clientProjectId },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  });
}

/** Create a PENDING approval addressed to the client. MANAGER+ with client access. */
export async function createClientApproval(
  actor: Membership,
  clientProjectId: string,
  title: string,
  detail: string,
) {
  if (!hasRole(actor.role, "MANAGER")) {
    throw new ForbiddenError("Only managers and admins can request client approvals.");
  }
  await assertClientAccess(actor, clientProjectId);
  return prisma.approval.create({
    data: {
      clientProjectId,
      title,
      detail,
      payload: {},
      audience: "CLIENT",
      status: "PENDING",
    },
    select: { id: true, title: true, status: true },
  });
}

export async function listClientApprovals(actor: Membership, clientProjectId: string) {
  await assertClientAccess(actor, clientProjectId);
  return prisma.approval.findMany({
    where: { clientProjectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, decidedAt: true },
  });
}
