import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { issueMagicLink, consumeMagicLink, InvalidTokenError } from "@/lib/portal/tokens";
import {
  createPortalSessionValue,
  verifyPortalSessionValue,
} from "@/lib/portal/session";
import { getPortalView } from "@/lib/portal/data";
import { decideApproval } from "@/lib/portal/approvals";

const RUN = `portal_${Date.now()}`;

const created: { workspaceId?: string; clientAId?: string; clientBId?: string } = {};

async function scaffold() {
  const owner = await prisma.user.create({
    data: { email: `${RUN}_owner@example.com`, plan: "AGENCY" },
    select: { id: true },
  });
  const ws = await prisma.workspace.create({
    data: { name: `${RUN}_ws`, ownerId: owner.id },
  });
  created.workspaceId = ws.id;
  const clientA = await prisma.clientProject.create({
    data: { workspaceId: ws.id, name: "A" },
  });
  const clientB = await prisma.clientProject.create({
    data: { workspaceId: ws.id, name: "B" },
  });
  created.clientAId = clientA.id;
  created.clientBId = clientB.id;
  const portalUser = await prisma.clientPortalUser.create({
    data: { clientProjectId: clientA.id, email: `${RUN}_client@example.com` },
  });
  return { clientA, clientB, portalUser };
}

afterAll(async () => {
  const cids = [created.clientAId, created.clientBId].filter(Boolean) as string[];
  await prisma.magicLinkToken.deleteMany({
    where: { portalUser: { clientProjectId: { in: cids } } },
  });
  await prisma.agentAction.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.approval.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.workItem.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientPortalUser.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientProject.deleteMany({ where: { id: { in: cids } } });
  if (created.workspaceId) {
    await prisma.workspace.deleteMany({ where: { id: created.workspaceId } });
  }
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

describe("magic-link tokens", () => {
  it("are single-use and reject expired links", async () => {
    const { portalUser } = await scaffold();

    const raw = await issueMagicLink(portalUser.id);
    const first = await consumeMagicLink(raw);
    expect(first.clientProjectId).toBe(created.clientAId);

    // Single-use: the same token cannot be consumed again.
    await expect(consumeMagicLink(raw)).rejects.toBeInstanceOf(InvalidTokenError);

    // Expired token is rejected.
    const expiredRaw = await issueMagicLink(portalUser.id);
    await prisma.magicLinkToken.updateMany({
      where: { portalUser: { id: portalUser.id }, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(consumeMagicLink(expiredRaw)).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe("portal session cookie", () => {
  it("round-trips a valid value and rejects tampering/expiry", () => {
    const value = createPortalSessionValue("pid-1", "cid-1");
    expect(verifyPortalSessionValue(value)).toEqual({
      portalUserId: "pid-1",
      clientProjectId: "cid-1",
    });

    // Tampered signature → null.
    expect(verifyPortalSessionValue(value.slice(0, -2) + "xy")).toBeNull();

    // Expired → null.
    const expired = createPortalSessionValue("pid-1", "cid-1", Date.now() - 13 * 3600 * 1000);
    expect(verifyPortalSessionValue(expired)).toBeNull();

    expect(verifyPortalSessionValue(undefined)).toBeNull();
    expect(verifyPortalSessionValue("garbage")).toBeNull();
  });
});

describe("getPortalView never leaks unpublished work", () => {
  it("returns only APPROVED/PUBLISHED work items", async () => {
    const clientId = created.clientAId!;
    await prisma.workItem.createMany({
      data: [
        { clientProjectId: clientId, title: "d", body: {}, status: "DRAFT", createdByRole: "STAFF" },
        { clientProjectId: clientId, title: "r", body: {}, status: "IN_REVIEW", createdByRole: "STAFF" },
        { clientProjectId: clientId, title: "a", body: {}, status: "APPROVED", createdByRole: "STAFF" },
        { clientProjectId: clientId, title: "p", body: {}, status: "PUBLISHED", createdByRole: "STAFF" },
      ],
    });
    const view = await getPortalView(clientId);
    const statuses = view.workItems.map((w) => w.status).sort();
    expect(statuses).toEqual(["APPROVED", "PUBLISHED"]);
  });
});

describe("approval round-trip + tenant isolation", () => {
  it("flips the approval, logs an agency-visible action, and blocks cross-tenant/repeat", async () => {
    const clientId = created.clientAId!;
    const portalUser = await prisma.clientPortalUser.findFirstOrThrow({
      where: { clientProjectId: clientId },
    });
    const approval = await prisma.approval.create({
      data: {
        clientProjectId: clientId,
        title: "Restock 200 units",
        detail: "…",
        payload: {},
        audience: "CLIENT",
        status: "PENDING",
      },
    });

    const session = { portalUserId: portalUser.id, clientProjectId: clientId };
    const result = await decideApproval(session, approval.id, "approve");
    expect(result.status).toBe("APPROVED");

    // The decision is recorded in the append-only log the agency reads.
    const logged = await prisma.agentAction.findFirst({
      where: { clientProjectId: clientId, kind: "approval.decided" },
    });
    expect(logged?.summary).toContain("approved");

    // A second decision is refused.
    await expect(decideApproval(session, approval.id, "decline")).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Cross-tenant: a session scoped to Client B cannot decide Client A's approval.
    const otherSession = { portalUserId: "x", clientProjectId: created.clientBId! };
    const bApproval = await prisma.approval.create({
      data: {
        clientProjectId: clientId,
        title: "A-only",
        detail: "…",
        payload: {},
        audience: "CLIENT",
        status: "PENDING",
      },
    });
    await expect(decideApproval(otherSession, bApproval.id, "approve")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
