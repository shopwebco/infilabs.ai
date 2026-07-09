import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/db/prisma";

// Seeded client project + portal user. Exercises the real magic-link login
// (via the dev link, since email isn't configured here), scoped view, and the
// approval round-trip. Tenant isolation is enforced server-side.
const RUN = `e2e_portal_${Date.now()}`;
const PORTAL_EMAIL = `${RUN}_client@example.com`;

const ids: { clientAId: string; clientBId: string } = { clientAId: "", clientBId: "" };

test.beforeAll(async () => {
  const owner = await prisma.user.create({
    data: { email: `${RUN}_owner@example.com`, plan: "AGENCY" },
  });
  const ws = await prisma.workspace.create({
    data: { name: `${RUN}_ws`, ownerId: owner.id },
  });
  const clientA = await prisma.clientProject.create({
    data: { workspaceId: ws.id, name: "Portal Client A" },
  });
  const clientB = await prisma.clientProject.create({
    data: { workspaceId: ws.id, name: "Portal Client B" },
  });
  ids.clientAId = clientA.id;
  ids.clientBId = clientB.id;

  await prisma.clientPortalUser.create({
    data: { clientProjectId: clientA.id, email: PORTAL_EMAIL },
  });
  await prisma.approval.create({
    data: {
      clientProjectId: clientA.id,
      title: "Restock 200 units",
      detail: "Approve the restock plan for next month.",
      payload: {},
      audience: "CLIENT",
      status: "PENDING",
    },
  });
  await prisma.workItem.createMany({
    data: [
      {
        clientProjectId: clientA.id,
        title: "Published listing copy",
        body: {},
        status: "PUBLISHED",
        createdByRole: "MANAGER",
      },
      {
        clientProjectId: clientA.id,
        title: "Secret internal draft",
        body: {},
        status: "DRAFT",
        createdByRole: "STAFF",
      },
    ],
  });
  await prisma.agentAction.create({
    data: {
      clientProjectId: clientA.id,
      actor: "AGENT",
      kind: "fees.claim_filed",
      summary: "Filed an FBA reimbursement claim",
      valueImpactCents: 4100,
      payload: {},
    },
  });
});

test.afterAll(async () => {
  const cids = [ids.clientAId, ids.clientBId];
  await prisma.magicLinkToken.deleteMany({
    where: { portalUser: { clientProjectId: { in: cids } } },
  });
  await prisma.agentAction.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.approval.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.workItem.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientPortalUser.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientProject.deleteMany({ where: { id: { in: cids } } });
  await prisma.workspace.deleteMany({ where: { name: { contains: RUN } } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

test("magic-link login, scoped view, approval round-trip, and cross-tenant block", async ({
  page,
}) => {
  // Request a link; email isn't configured here, so the API returns a dev link.
  const res = await page.request.post("/api/portal/request-link", {
    data: { clientProjectId: ids.clientAId, email: PORTAL_EMAIL },
  });
  expect(res.ok()).toBeTruthy();
  const { devLink } = (await res.json()) as { devLink?: string };
  expect(devLink).toBeTruthy();

  // Visiting the link verifies the token (single-use) and sets the portal cookie.
  // Navigate by path so it hits the test server (devLink uses APP_URL's host).
  const linkUrl = new URL(devLink!);
  await page.goto(linkUrl.pathname + linkUrl.search);
  await expect(page).toHaveURL(new RegExp(`/portal/${ids.clientAId}(\\?.*)?$`));
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();

  // Sees the pending approval and published work — but NOT the internal draft.
  await expect(page.getByText("Restock 200 units")).toBeVisible();
  await expect(page.getByText("Published listing copy")).toBeVisible();
  await expect(page.getByText("Secret internal draft")).toHaveCount(0);
  await expect(page.getByText("Filed an FBA reimbursement claim")).toBeVisible();

  // Approve the pending item; it flips to a decided state.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

  // Cross-tenant: the Client A session cannot open Client B's portal.
  await page.goto(`/portal/${ids.clientBId}`);
  await expect(page).toHaveURL(new RegExp(`/portal/${ids.clientBId}/login`));

  // And an unregistered email does not reveal itself.
  const noLeak = await page.request.post("/api/portal/request-link", {
    data: { clientProjectId: ids.clientAId, email: "nobody@example.com" },
  });
  expect(noLeak.ok()).toBeTruthy();
  expect((await noLeak.json()).devLink).toBeFalsy();
});
