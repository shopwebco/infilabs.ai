import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/db/prisma";

// Two agencies with distinct white-label. Proves per-workspace branding on the
// portal, and that a custom host resolves to the right tenant via the middleware.
const RUN = `e2e_wl_${Date.now()}`;
const domainA = `${RUN}-a.example.com`;
const domainB = `${RUN}-b.example.com`;

const ids: { clientAId: string; clientBId: string } = { clientAId: "", clientBId: "" };

test.beforeAll(async () => {
  async function agency(tag: string, brandName: string, accent: string, domain: string) {
    const owner = await prisma.user.create({
      data: { email: `${RUN}_${tag}@example.com`, plan: "AGENCY" },
    });
    const ws = await prisma.workspace.create({
      data: { name: `${RUN}_${tag}`, ownerId: owner.id },
    });
    const client = await prisma.clientProject.create({
      data: { workspaceId: ws.id, name: `${brandName} Client` },
    });
    await prisma.clientPortalUser.create({
      data: { clientProjectId: client.id, email: `${RUN}_${tag}_client@example.com` },
    });
    await prisma.whiteLabelSettings.create({
      data: {
        workspaceId: ws.id,
        brandName,
        accentColor: accent,
        customDomain: domain,
        hideXenon: true,
      },
    });
    return client.id;
  }
  ids.clientAId = await agency("a", "Agency Aardvark", "#00FF00", domainA);
  ids.clientBId = await agency("b", "Agency Beluga", "#FF0000", domainB);
});

test.afterAll(async () => {
  const wsIds = (
    await prisma.workspace.findMany({ where: { name: { contains: RUN } }, select: { id: true } })
  ).map((w) => w.id);
  const cids = [ids.clientAId, ids.clientBId];
  await prisma.clientPortalUser.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientProject.deleteMany({ where: { id: { in: cids } } });
  await prisma.whiteLabelSettings.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

test("two agencies render distinct brands on their portals", async ({ page }) => {
  await page.goto(`/portal/${ids.clientAId}/login`);
  await expect(page.getByTestId("brand-name")).toHaveText("Agency Aardvark");

  await page.goto(`/portal/${ids.clientBId}/login`);
  await expect(page.getByTestId("brand-name")).toHaveText("Agency Beluga");
});

test("a mapped custom host resolves to the right tenant (Host header override)", async ({
  page,
}) => {
  // The middleware rewrites a non-app Host to /d/<host>, which resolves the
  // workspace by customDomain and renders its brand.
  const resA = await page.request.get("/", { headers: { host: domainA } });
  expect(resA.ok()).toBeTruthy();
  expect(await resA.text()).toContain("Agency Aardvark");

  const resB = await page.request.get("/", { headers: { host: domainB } });
  expect(resB.ok()).toBeTruthy();
  expect(await resB.text()).toContain("Agency Beluga");

  // An unmapped host does not resolve to a tenant.
  const resUnknown = await page.request.get("/", {
    headers: { host: "not-a-tenant.example.com" },
  });
  expect(resUnknown.status()).toBe(404);
});
