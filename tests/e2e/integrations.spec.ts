import { test, expect } from "@playwright/test";

// Phase 8 acceptance without LWA credentials: the app builds and shows gated
// "Connect" states with zero fabricated data — connecting fails closed with an
// honest message, never a simulated connection.
test("integrations page shows the honest gated Amazon state", async ({ page }) => {
  const email = `integ_${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Integrations User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: /Manage integrations/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/integrations/);

  // Honest state: not connected, explicitly not configured, no invented data.
  await expect(page.getByText("NOT CONNECTED")).toBeVisible();
  await expect(page.getByText(/Not configured on this deployment/i)).toBeVisible();
  await expect(page.getByText(/nothing here is fabricated/i)).toBeVisible();

  // Attempting to connect surfaces the 503 message rather than pretending.
  await page.getByRole("button", { name: "Connect Amazon" }).click();
  await expect(page.getByText(/LWA credentials missing/i)).toBeVisible();
});

test("integrations page is gated — anonymous users are redirected to login", async ({
  page,
}) => {
  await page.goto("/dashboard/integrations");
  await expect(page).toHaveURL(/\/login/);
});
