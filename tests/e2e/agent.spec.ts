import { test, expect } from "@playwright/test";

// The agent page renders scoped, honest state. With no ANTHROPIC_API_KEY set in
// this environment, sending must fail closed with a clear "not configured"
// message — never a fabricated reply (CLAUDE.md Rule 1).
test("agent page renders and fails closed when unconfigured", async ({ page }) => {
  const email = `agent_${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Agent User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: /Ask the agent/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/agent/);
  await expect(page.getByRole("heading", { name: "AI Agent" })).toBeVisible();
  await expect(page.getByText(/no fabricated marketplace metrics/i)).toBeVisible();

  await page.getByPlaceholder("Ask the agent…").fill("How are my Amazon sales?");
  await page.getByRole("button", { name: "Send" }).click();

  // Honest failure, not an invented answer.
  await expect(page.getByText(/not configured on this deployment/i)).toBeVisible();
});

test("agent page is gated — anonymous users are redirected to login", async ({ page }) => {
  await page.goto("/dashboard/agent");
  await expect(page).toHaveURL(/\/login/);
});
