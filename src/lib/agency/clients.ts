import type { ClientProject, Membership } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError, hasRole } from "@/lib/auth/rbac";

/**
 * Clients this membership may see:
 * - ADMIN: every client in the workspace.
 * - MANAGER / STAFF: only clients they're assigned to (docs/PRODUCT_SPEC.md §2).
 */
export async function listAccessibleClients(membership: Membership) {
  if (membership.role === "ADMIN") {
    return prisma.clientProject.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }
  return prisma.clientProject.findMany({
    where: {
      workspaceId: membership.workspaceId,
      assignments: { some: { membershipId: membership.id } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Loads a client the membership is allowed to access, or throws.
 * Cross-tenant access (wrong workspace) is a 404 — never confirm the row exists.
 * A same-workspace client the caller isn't assigned to is a 403 (for non-admins).
 */
export async function assertClientAccess(
  membership: Membership,
  clientProjectId: string,
): Promise<ClientProject> {
  const client = await prisma.clientProject.findUnique({
    where: { id: clientProjectId },
  });
  if (!client || client.workspaceId !== membership.workspaceId) {
    throw new NotFoundError("Client not found.");
  }
  if (membership.role !== "ADMIN") {
    const assignment = await prisma.clientAssignment.findUnique({
      where: {
        membershipId_clientProjectId: {
          membershipId: membership.id,
          clientProjectId,
        },
      },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenError("You are not assigned to this client.");
    }
  }
  return client;
}

/** Create a client project. MANAGER+; the creator is auto-assigned so they retain access. */
export async function createClientProject(membership: Membership, name: string) {
  if (!hasRole(membership.role, "MANAGER")) {
    throw new ForbiddenError("Only managers and admins can create client projects.");
  }
  return prisma.clientProject.create({
    data: {
      workspaceId: membership.workspaceId,
      name,
      assignments: { create: { membershipId: membership.id } },
    },
    select: { id: true, name: true, archived: true, createdAt: true },
  });
}

/** Archive/unarchive a client. ADMIN only (drives Agency plan quantity billing in Phase 5). */
export async function setClientArchived(
  membership: Membership,
  clientProjectId: string,
  archived: boolean,
) {
  if (membership.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can archive client projects.");
  }
  await assertClientAccess(membership, clientProjectId); // confirms same workspace
  return prisma.clientProject.update({
    where: { id: clientProjectId },
    data: { archived },
    select: { id: true, archived: true },
  });
}

/** Assign a workspace member to a client. MANAGER+, and the actor must be able to access the client. */
export async function assignMember(
  actor: Membership,
  clientProjectId: string,
  targetMembershipId: string,
) {
  if (!hasRole(actor.role, "MANAGER")) {
    throw new ForbiddenError("Only managers and admins can assign members.");
  }
  await assertClientAccess(actor, clientProjectId);

  const target = await prisma.membership.findUnique({
    where: { id: targetMembershipId },
    select: { id: true, workspaceId: true },
  });
  if (!target || target.workspaceId !== actor.workspaceId) {
    throw new NotFoundError("Member not found in this workspace.");
  }

  return prisma.clientAssignment.upsert({
    where: {
      membershipId_clientProjectId: {
        membershipId: targetMembershipId,
        clientProjectId,
      },
    },
    create: { membershipId: targetMembershipId, clientProjectId },
    update: {},
    select: { id: true },
  });
}

export async function unassignMember(
  actor: Membership,
  clientProjectId: string,
  targetMembershipId: string,
) {
  if (!hasRole(actor.role, "MANAGER")) {
    throw new ForbiddenError("Only managers and admins can change assignments.");
  }
  await assertClientAccess(actor, clientProjectId);
  await prisma.clientAssignment.deleteMany({
    where: { membershipId: targetMembershipId, clientProjectId },
  });
}

/** Members of a workspace (for the team page and assignment pickers). */
export async function listWorkspaceMembers(workspaceId: string) {
  return prisma.membership.findMany({
    where: { workspaceId },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { role: "desc" },
  });
}
