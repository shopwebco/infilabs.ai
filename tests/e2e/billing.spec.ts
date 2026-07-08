import { test, expect } from "@playwright/test";

// A freshly signed-up Starter user sees their real plan + usage on the billing
// page, and the Pro upgrade entry point. (The live Stripe checkout round-trip
// requires real test keys and is verified separately once configured.)
test("billing page shows the real Starter plan and usage", async ({ page }) => {
  const email = `bill_${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Billing User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: /Manage plan/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/billing/);

  await expect(page.getByText("Starter (free)")).toBeVisible();
  await expect(page.getByText("0 / 25")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upgrade to Pro" })).toBeVisible();
});

test("billing page is gated — anonymous users are redirected to login", async ({ page }) => {
  await page.goto("/dashboard/billing");
  await expect(page).toHaveURL(/\/login/);
});
