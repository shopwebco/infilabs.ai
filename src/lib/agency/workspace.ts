import type { Membership, Plan, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, hasRole } from "@/lib/auth/rbac";

/** Creates a workspace and makes the creator its ADMIN. Requires the Agency plan. */
export async function createWorkspace(
  user: { id: string; plan: Plan },
  name: string,
) {
  if (user.plan !== "AGENCY") {
    throw new ForbiddenError("Creating a workspace requires the Agency plan.");
  }
  return prisma.workspace.create({
    data: {
      name,
      ownerId: user.id,
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
    select: { id: true, name: true, createdAt: true },
  });
}

export function getMembership(userId: string, workspaceId: string) {
  return prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
}

/**
 * Server-side workspace guard. Returns the caller's membership or throws
 * ForbiddenError (403) if they aren't a member / lack the minimum role.
 */
export async function requireMembership(
  userId: string,
  workspaceId: string,
  minRole?: WorkspaceRole,
): Promise<Membership> {
  const membership = await getMembership(userId, workspaceId);
  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace.");
  }
  if (minRole && !hasRole(membership.role, minRole)) {
    throw new ForbiddenError();
  }
  return membership;
}

/** All workspaces the user belongs to (with their role), for the workspace picker. */
export async function listUserWorkspaces(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      role: true,
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { workspace: { createdAt: "asc" } },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role,
  }));
}
