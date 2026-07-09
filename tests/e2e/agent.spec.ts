import { test, expect } from "@playwright/test";

// Environment-independent checks: the agent page renders its scoped, honest
// framing and exposes the chat input, whether or not ANTHROPIC_API_KEY is set.
// (Live streaming behavior is verified separately when a key is present; the
// fail-closed 503 path is enforced server-side in the route.)
test("agent page renders scoped, honest state", async ({ page }) => {
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
  await expect(page.getByPlaceholder("Ask the agent…")).toBeVisible();
});

test("agent page is gated — anonymous users are redirected to login", async ({ page }) => {
  await page.goto("/dashboard/agent");
  await expect(page).toHaveURL(/\/login/);
});
