import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/db/prisma";
import { hashPassword } from "../../src/lib/auth/password";

// Seeded multi-role workspace. Playwright then proves the RBAC boundaries
// through the real UI and API (403 server-side, not just hidden UI).
const RUN = `e2e_agency_${Date.now()}`;
const PW = "supersecret1";

const ids: {
  workspaceId: string;
  clientAId: string;
  clientBId: string;
  reviewItemId: string;
  emails: { admin: string; manager: string; staff: string };
} = {
  workspaceId: "",
  clientAId: "",
  clientBId: "",
  reviewItemId: "",
  emails: {
    admin: `${RUN}_admin@example.com`,
    manager: `${RUN}_manager@example.com`,
    staff: `${RUN}_staff@example.com`,
  },
};

test.beforeAll(async () => {
  const passwordHash = await hashPassword(PW);
  const mk = (email: string) =>
    prisma.user.create({
      data: { email, name: email.split("@")[0], plan: "AGENCY", passwordHash },
    });
  const [admin, manager, staff] = await Promise.all([
    mk(ids.emails.admin),
    mk(ids.emails.manager),
    mk(ids.emails.staff),
  ]);

  const workspace = await prisma.workspace.create({
    data: { name: `${RUN}_ws`, ownerId: admin.id },
  });
  ids.workspaceId = workspace.id;

  const adminM = await prisma.membership.create({
    data: { userId: admin.id, workspaceId: workspace.id, role: "ADMIN" },
  });
  const managerM = await prisma.membership.create({
    data: { userId: manager.id, workspaceId: workspace.id, role: "MANAGER" },
  });
  const staffM = await prisma.membership.create({
    data: { userId: staff.id, workspaceId: workspace.id, role: "STAFF" },
  });

  const clientA = await prisma.clientProject.create({
    data: { workspaceId: workspace.id, name: "Client Alpha" },
  });
  const clientB = await prisma.clientProject.create({
    data: { workspaceId: workspace.id, name: "Client Beta" },
  });
  ids.clientAId = clientA.id;
  ids.clientBId = clientB.id;

  // Manager + staff assigned to Client Alpha ONLY.
  await prisma.clientAssignment.createMany({
    data: [
      { membershipId: adminM.id, clientProjectId: clientA.id },
      { membershipId: managerM.id, clientProjectId: clientA.id },
      { membershipId: staffM.id, clientProjectId: clientA.id },
    ],
  });

  // A staff-authored item already IN_REVIEW, for the manager to approve.
  const review = await prisma.workItem.create({
    data: {
      clientProjectId: clientA.id,
      title: "Listing copy for review",
      body: { text: "draft" },
      status: "IN_REVIEW",
      createdByRole: "STAFF",
      createdById: staff.id,
    },
  });
  ids.reviewItemId = review.id;
});

test.afterAll(async () => {
  const cids = [ids.clientAId, ids.clientBId];
  await prisma.workItem.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientAssignment.deleteMany({ where: { clientProjectId: { in: cids } } });
  await prisma.clientProject.deleteMany({ where: { id: { in: cids } } });
  await prisma.membership.deleteMany({ where: { workspaceId: ids.workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: ids.workspaceId } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("staff sees only assigned clients, can draft/submit, and cannot publish (UI + API 403)", async ({
  page,
}) => {
  await login(page, ids.emails.staff);
  await page.goto(`/agency/${ids.workspaceId}`);

  await expect(page.getByText("Client Alpha")).toBeVisible();
  await expect(page.getByText("Client Beta")).toHaveCount(0);

  // Open the assigned client and create + submit a draft.
  await page.getByText("Client Alpha").click();
  await expect(page).toHaveURL(new RegExp(`/agency/${ids.workspaceId}/clients/`));
  await page.getByLabel("Draft title").fill("Keyword research");
  await page.getByLabel("Draft content").fill("Some keywords");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("Keyword research")).toBeVisible();

  await page
    .locator("li", { hasText: "Keyword research" })
    .getByRole("button", { name: "Submit for review" })
    .click();
  await expect(
    page.locator("li", { hasText: "Keyword research" }).getByText("In review"),
  ).toBeVisible();

  // Staff never sees Approve/Publish controls.
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

  // Server-side enforcement: a direct publish call is 403, not just hidden.
  const res = await page.request.post(
    `/api/agency/workitems/${ids.reviewItemId}/transition`,
    { data: { action: "publish" } },
  );
  expect(res.status()).toBe(403);

  // And staff cannot touch an unassigned client's data.
  const cross = await page.request.post("/api/agency/workitems", {
    data: { clientProjectId: ids.clientBId, title: "x", body: "y" },
  });
  expect(cross.status()).toBe(403);
});

test("manager approves a staff draft", async ({ page }) => {
  await login(page, ids.emails.manager);
  await page.goto(`/agency/${ids.workspaceId}/clients/${ids.clientAId}`);

  const row = page.locator("li", { hasText: "Listing copy for review" });
  await expect(row.getByText("In review")).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("Approved")).toBeVisible();
});

test("admin sees all clients in the workspace", async ({ page }) => {
  await login(page, ids.emails.admin);
  await page.goto(`/agency/${ids.workspaceId}`);
  await expect(page.getByText("Client Alpha")).toBeVisible();
  await expect(page.getByText("Client Beta")).toBeVisible();
});

test("a non-member cannot access the workspace (API 403)", async ({ page }) => {
  // A brand-new signed-up user is in no workspace.
  const outsider = `${RUN}_outsider_${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Outsider");
  await page.getByLabel("Email").fill(outsider);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const res = await page.request.post("/api/agency/clients", {
    data: { workspaceId: ids.workspaceId, name: "intrusion" },
  });
  expect(res.status()).toBe(403);
});
