import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Membership } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { createWorkspace, getMembership } from "@/lib/agency/workspace";
import {
  assertClientAccess,
  createClientProject,
  listAccessibleClients,
} from "@/lib/agency/clients";
import { createWorkItem, transitionWorkItem } from "@/lib/agency/workitems";
import { createInvite, acceptInvite } from "@/lib/agency/invites";

const RUN = `rbac_${Date.now()}`;

let adminM: Membership;
let managerM: Membership;
let staffM: Membership;
let outsiderM: Membership; // admin of a DIFFERENT workspace
let clientAId: string;
let clientBId: string;
let inviteeId: string;

async function user(tag: string, plan: "STARTER" | "AGENCY") {
  return prisma.user.create({
    data: { email: `${RUN}_${tag}@example.com`, name: tag, plan },
    select: { id: true, plan: true, email: true },
  });
}

beforeAll(async () => {
  const admin = await user("admin", "AGENCY");
  const manager = await user("manager", "AGENCY");
  const staff = await user("staff", "AGENCY");
  const outsider = await user("outsider", "AGENCY");
  const invitee = await user("invitee", "STARTER");
  inviteeId = invitee.id;

  const wsA = await createWorkspace(admin, `${RUN}_A`);
  const wsB = await createWorkspace(outsider, `${RUN}_B`);

  adminM = (await getMembership(admin.id, wsA.id))!;
  outsiderM = (await getMembership(outsider.id, wsB.id))!;
  managerM = await prisma.membership.create({
    data: { userId: manager.id, workspaceId: wsA.id, role: "MANAGER" },
  });
  staffM = await prisma.membership.create({
    data: { userId: staff.id, workspaceId: wsA.id, role: "STAFF" },
  });

  const clientA = await createClientProject(adminM, "Client A");
  const clientB = await createClientProject(adminM, "Client B");
  clientAId = clientA.id;
  clientBId = clientB.id;

  // Manager + staff are assigned to Client A only.
  await prisma.clientAssignment.createMany({
    data: [
      { membershipId: managerM.id, clientProjectId: clientAId },
      { membershipId: staffM.id, clientProjectId: clientAId },
    ],
  });
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: RUN } },
    select: { id: true },
  });
  const uids = users.map((u) => u.id);
  const memberships = await prisma.membership.findMany({
    where: { userId: { in: uids } },
    select: { id: true, workspaceId: true },
  });
  const wsIds = [...new Set(memberships.map((m) => m.workspaceId))];
  const clients = await prisma.clientProject.findMany({
    where: { workspaceId: { in: wsIds } },
    select: { id: true },
  });
  const cids = clients.map((c) => c.id);

  await prisma.workItem.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientAssignment.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientProject.deleteMany({ where: { id: { in: cids } } });
  await prisma.workspaceInvite.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.membership.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
  await prisma.$disconnect();
});

describe("workspace creation is gated to the Agency plan", () => {
  it("rejects a non-Agency user (403)", async () => {
    const starter = await user("starter", "STARTER");
    await expect(createWorkspace(starter, "Nope")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("client visibility scoping", () => {
  it("admin sees all clients; manager and staff see only assigned", async () => {
    const adminClients = await listAccessibleClients(adminM);
    const managerClients = await listAccessibleClients(managerM);
    const staffClients = await listAccessibleClients(staffM);

    expect(adminClients.map((c) => c.id).sort()).toEqual([clientAId, clientBId].sort());
    expect(managerClients.map((c) => c.id)).toEqual([clientAId]);
    expect(staffClients.map((c) => c.id)).toEqual([clientAId]);
  });

  it("a non-admin cannot access an unassigned same-workspace client (403)", async () => {
    await expect(assertClientAccess(staffM, clientBId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertClientAccess(managerM, clientBId)).rejects.toBeInstanceOf(ForbiddenError);
    // Admin can access any client in the workspace.
    await expect(assertClientAccess(adminM, clientBId)).resolves.toBeTruthy();
  });

  it("staff cannot create client projects (403)", async () => {
    await expect(createClientProject(staffM, "Sneaky")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("tenant isolation", () => {
  it("a member of workspace B cannot access workspace A's client (404, no existence leak)", async () => {
    await expect(assertClientAccess(outsiderM, clientAId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("review queue authorization", () => {
  it("staff drafts and submits; only a manager can approve and publish", async () => {
    const item = await createWorkItem(staffM, clientAId, {
      title: "Keyword research",
      body: { text: "draft body" },
    });

    // Staff can submit their own draft.
    const submitted = await transitionWorkItem(staffM, item.id, "submit");
    expect(submitted.status).toBe("IN_REVIEW");

    // Staff CANNOT approve or publish.
    await expect(transitionWorkItem(staffM, item.id, "approve")).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Manager approves the staff draft.
    const approved = await transitionWorkItem(managerM, item.id, "approve");
    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedById).toBeTruthy();

    // Staff still cannot publish; manager can.
    await expect(transitionWorkItem(staffM, item.id, "publish")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const published = await transitionWorkItem(managerM, item.id, "publish");
    expect(published.status).toBe("PUBLISHED");
  });

  it("staff cannot act on an unassigned client's work items", async () => {
    // A work item on Client B (admin-created), which staff is not assigned to.
    const item = await createWorkItem(adminM, clientBId, {
      title: "B draft",
      body: { text: "x" },
    });
    await expect(transitionWorkItem(staffM, item.id, "submit")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("team invites", () => {
  it("only an admin can invite; accept requires the matching email; membership is created", async () => {
    // Manager cannot invite.
    await expect(createInvite(managerM, "x@example.com", "STAFF")).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const { token } = await createInvite(adminM, `${RUN}_invitee@example.com`, "STAFF");

    // Wrong email cannot accept.
    await expect(
      acceptInvite({ id: "someone", email: "other@example.com" }, token),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Correct invitee accepts → membership created.
    const invitee = await prisma.user.findUniqueOrThrow({ where: { id: inviteeId } });
    const result = await acceptInvite({ id: invitee.id, email: invitee.email }, token);
    expect(result.role).toBe("STAFF");
    const membership = await getMembership(invitee.id, result.workspaceId);
    expect(membership).toBeTruthy();

    // Single-use: the same token cannot be reused.
    await expect(
      acceptInvite({ id: invitee.id, email: invitee.email }, token),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
