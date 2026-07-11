import crypto from "node:crypto";
import type { Membership, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/auth/rbac";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Create a team invite. ADMIN only. Returns the raw token ONCE — only its hash
 * is stored (same discipline as magic links). Email delivery is wired in Phase 4;
 * until then the caller surfaces the accept link honestly.
 */
export async function createInvite(
  actor: Membership,
  email: string,
  role: WorkspaceRole,
  now = new Date(),
) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can invite team members.");
  }
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: actor.workspaceId,
      email: email.toLowerCase().trim(),
      role,
      tokenHash: hashToken(rawToken),
      invitedById: actor.userId,
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    },
    select: { id: true, email: true, role: true, expiresAt: true },
  });
  return { invite, token: rawToken };
}

/** Accept an invite: single-use, unexpired, email must match the signed-in user. */
export async function acceptInvite(
  user: { id: string; email: string },
  rawToken: string,
  now = new Date(),
) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!invite) throw new NotFoundError("Invalid invite.");
  if (invite.acceptedAt) throw new ForbiddenError("This invite has already been used.");
  if (invite.expiresAt < now) throw new ForbiddenError("This invite has expired.");
  if (invite.email !== user.email.toLowerCase()) {
    throw new ForbiddenError("This invite was sent to a different email address.");
  }

  const membership = await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } },
    });
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: now },
    });
    if (existing) return existing;
    return tx.membership.create({
      data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
    });
  });

  return { workspaceId: invite.workspaceId, role: membership.role };
}

export async function listPendingInvites(actor: Membership) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can view invites.");
  }
  return prisma.workspaceInvite.findMany({
    where: { workspaceId: actor.workspaceId, acceptedAt: null },
    select: { id: true, email: true, role: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
}
