import { test, expect } from "@playwright/test";

// End-to-end critical flow: signup → protected dashboard → logout → gated redirect.
test("user can sign up, land on the dashboard, and log out", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;
  const password = "supersecret1";

  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Lands on the real, authenticated dashboard.
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Log out returns to the marketing home.
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Dashboard is gated server-side — hitting it directly bounces to /login.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByLabel("Password").fill("wrongpassword");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
