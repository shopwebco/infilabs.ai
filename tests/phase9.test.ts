import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/auth/rbac";
import { requirePlatformAdmin, isPlatformAdmin } from "@/lib/admin/guard";
import { getPlatformMetrics, PLAN_MRR_CENTS } from "@/lib/admin/metrics";
import { attributeReferral } from "@/lib/referrals";
import { assertCanCreateProposal, storeProposal, getProposalBySlug } from "@/lib/proposals";

const RUN = `p9_${Date.now()}`;

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: RUN } },
    select: { id: true },
  });
  const uids = users.map((u) => u.id);
  const wsIds = (
    await prisma.workspace.findMany({ where: { name: { contains: RUN } }, select: { id: true } })
  ).map((w) => w.id);
  await prisma.referralConversion.deleteMany({ where: { referredUserId: { in: uids } } });
  await prisma.proposal.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.membership.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
  await prisma.$disconnect();
});

describe("platform-admin guard", () => {
  it("blocks non-admins and allows PLATFORM_ADMIN", async () => {
    const normal = await prisma.user.create({
      data: { email: `${RUN}_n@example.com`, plan: "PRO" },
      select: { id: true },
    });
    const admin = await prisma.user.create({
      data: { email: `${RUN}_admin@example.com`, plan: "PRO", platformRole: "PLATFORM_ADMIN" },
      select: { id: true },
    });
    await expect(requirePlatformAdmin(normal.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requirePlatformAdmin(admin.id)).resolves.toBeUndefined();
    expect(await isPlatformAdmin(admin.id)).toBe(true);
    expect(await isPlatformAdmin(normal.id)).toBe(false);
  });
});

describe("platform metrics", () => {
  it("computes MRR consistently from the plan distribution (reconciles with plan state)", async () => {
    const m = await getPlatformMetrics();
    const expectedMrr = m.planDistribution.reduce(
      (s, p) => s + PLAN_MRR_CENTS[p.plan] * p.count,
      0,
    );
    expect(m.mrrCents).toBe(expectedMrr);
    expect(m.accounts).toBe(m.planDistribution.reduce((s, p) => s + p.count, 0));
  });
});

describe("referral attribution", () => {
  it("attributes a signup to the referring agency by its code (and only once)", async () => {
    const owner = await prisma.user.create({
      data: { email: `${RUN}_owner@example.com`, plan: "AGENCY" },
      select: { id: true },
    });
    const ws = await prisma.workspace.create({
      data: { name: `${RUN}_ws`, ownerId: owner.id },
      select: { id: true, referralCode: true },
    });
    const referred = await prisma.user.create({
      data: { email: `${RUN}_ref@example.com`, plan: "PRO" },
      select: { id: true },
    });

    const bad = await attributeReferral("no-such-code", referred.id, "PRO");
    expect(bad).toBeNull();

    const conv = await attributeReferral(ws.referralCode, referred.id, "PRO");
    expect(conv).toBeTruthy();
    const row = await prisma.referralConversion.findFirstOrThrow({
      where: { referredUserId: referred.id },
    });
    expect(row.workspaceId).toBe(ws.id);
    expect(row.monthlyCents).toBe(Math.round((PLAN_MRR_CENTS.PRO * 25) / 100)); // 1225

    // A second attempt does not create a duplicate.
    await attributeReferral(ws.referralCode, referred.id, "PRO");
    expect(
      await prisma.referralConversion.count({ where: { referredUserId: referred.id } }),
    ).toBe(1);
  });
});

describe("directory approval requires platform admin", () => {
  it("a workspace is unlisted until approved", async () => {
    const owner = await prisma.user.create({
      data: { email: `${RUN}_downer@example.com`, plan: "AGENCY" },
      select: { id: true },
    });
    const ws = await prisma.workspace.create({
      data: { name: `${RUN}_dir`, ownerId: owner.id },
      select: { id: true, directoryListed: true },
    });
    expect(ws.directoryListed).toBe(false);

    // Only after (admin-gated) approval does it appear in the public directory query.
    await prisma.workspace.update({ where: { id: ws.id }, data: { directoryListed: true } });
    const listed = await prisma.workspace.findMany({
      where: { directoryListed: true, id: ws.id },
    });
    expect(listed).toHaveLength(1);
  });
});

describe("proposals", () => {
  it("gate creation to MANAGER+ and store/serve by public slug", async () => {
    const owner = await prisma.user.create({
      data: { email: `${RUN}_powner@example.com`, plan: "AGENCY" },
      select: { id: true },
    });
    const ws = await prisma.workspace.create({
      data: { name: `${RUN}_pws`, ownerId: owner.id },
      select: { id: true },
    });
    const staff = await prisma.membership.create({
      data: { userId: owner.id, workspaceId: ws.id, role: "STAFF" },
    });
    const manager = { ...staff, role: "MANAGER" as const };

    expect(() => assertCanCreateProposal(staff)).toThrow(ForbiddenError);
    expect(() => assertCanCreateProposal(manager)).not.toThrow();

    const stored = await storeProposal(ws.id, {
      title: "Acme audit",
      prospectUrl: "https://acme.example",
      body: { generatedText: "Opportunities: improve listings." },
    });
    const fetched = await getProposalBySlug(stored.publicSlug);
    expect(fetched?.title).toBe("Acme audit");
    expect((fetched?.body as { generatedText: string }).generatedText).toContain(
      "Opportunities",
    );
  });
});
