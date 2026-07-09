import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Membership } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/auth/rbac";
import {
  upsertWhiteLabel,
  getBrandForClientProject,
  getWorkspaceBrand,
  getEmailBrand,
  resolveWorkspaceByHost,
  DEFAULT_BRAND,
} from "@/lib/whitelabel";

const RUN = `wl_${Date.now()}`;

let adminA: Membership;
let managerA: Membership;
let clientAId = "";
let clientBId = "";
let wsBId = "";
const domainA = `${RUN}-a.example.com`;
const domainB = `${RUN}-b.example.com`;

beforeAll(async () => {
  const uAdmin = await prisma.user.create({
    data: { email: `${RUN}_admin@example.com`, plan: "AGENCY" },
  });
  const uManager = await prisma.user.create({
    data: { email: `${RUN}_manager@example.com`, plan: "AGENCY" },
  });
  const uOwnerB = await prisma.user.create({
    data: { email: `${RUN}_ownerb@example.com`, plan: "AGENCY" },
  });

  const wsA = await prisma.workspace.create({ data: { name: `${RUN}_A`, ownerId: uAdmin.id } });
  const wsB = await prisma.workspace.create({ data: { name: `${RUN}_B`, ownerId: uOwnerB.id } });
  wsBId = wsB.id;

  adminA = await prisma.membership.create({
    data: { userId: uAdmin.id, workspaceId: wsA.id, role: "ADMIN" },
  });
  managerA = await prisma.membership.create({
    data: { userId: uManager.id, workspaceId: wsA.id, role: "MANAGER" },
  });

  const cA = await prisma.clientProject.create({ data: { workspaceId: wsA.id, name: "CA" } });
  const cB = await prisma.clientProject.create({ data: { workspaceId: wsB.id, name: "CB" } });
  clientAId = cA.id;
  clientBId = cB.id;

  await prisma.clientPortalUser.create({
    data: { clientProjectId: cA.id, email: `${RUN}_pu@example.com` },
  });

  // Workspace B gets white-label directly (distinct brand + domain).
  await prisma.whiteLabelSettings.create({
    data: {
      workspaceId: wsB.id,
      brandName: "Agency B",
      accentColor: "#FF0000",
      customDomain: domainB,
      emailFrom: "B <hello@agencyb.com>",
      hideXenon: true,
    },
  });
});

afterAll(async () => {
  const wsIds = await prisma.workspace
    .findMany({ where: { name: { contains: RUN } }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));
  const cids = await prisma.clientProject
    .findMany({ where: { workspaceId: { in: wsIds } }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));
  await prisma.clientPortalUser.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientProject.deleteMany({ where: { id: { in: cids } } });
  await prisma.whiteLabelSettings.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.membership.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

describe("white-label CRUD is admin-only", () => {
  it("rejects a manager and accepts an admin", async () => {
    await expect(
      upsertWhiteLabel(managerA, {
        brandName: "X",
        accentColor: "#123456",
        hideXenon: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const saved = await upsertWhiteLabel(adminA, {
      brandName: "Agency A",
      accentColor: "#00FF00",
      customDomain: domainA,
      hideXenon: true,
    });
    expect(saved.brandName).toBe("Agency A");
    expect(saved.customDomain).toBe(domainA);
  });
});

describe("runtime brand resolution", () => {
  it("resolves distinct brands per workspace from DB values", async () => {
    const brandA = await getBrandForClientProject(clientAId);
    const brandB = await getBrandForClientProject(clientBId);
    expect(brandA.brandName).toBe("Agency A");
    expect(brandA.accentColor).toBe("#00FF00");
    expect(brandB.brandName).toBe("Agency B");
    expect(brandB.accentColor).toBe("#FF0000");
    expect(brandA.brandName).not.toBe(brandB.brandName);
  });

  it("falls back to the default (Xenon) brand when unset", async () => {
    // A fresh workspace with no white-label.
    const owner = await prisma.user.create({
      data: { email: `${RUN}_plain@example.com`, plan: "AGENCY" },
    });
    const ws = await prisma.workspace.create({
      data: { name: `${RUN}_plain`, ownerId: owner.id },
    });
    expect(await getWorkspaceBrand(ws.id)).toEqual(DEFAULT_BRAND);
  });

  it("maps a custom host to the right workspace (and null for unknown)", async () => {
    expect(await resolveWorkspaceByHost(domainB)).toBe(wsBId);
    expect(await resolveWorkspaceByHost(`${domainB}:443`)).toBe(wsBId);
    expect(await resolveWorkspaceByHost("unknown.example.com")).toBeNull();
  });

  it("carries agency branding into client emails", async () => {
    const brand = await getEmailBrand(clientAId);
    expect(brand.brandName).toBe("Agency A");
  });
});
