import { defineConfig, devices } from "@playwright/test";

// The test runner process needs DATABASE_URL etc. for prisma-backed seeding
// (Next.js loads .env for the app; the runner does not). Node 22 can load it.
try {
  process.loadEnvFile(".env");
} catch {
  // In CI, real env vars are already present.
}

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

// Use the container's preinstalled Chromium when present (see env PLAYWRIGHT_BROWSERS_PATH).
const chromiumPath = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const useSystemChromium = process.env.PW_SYSTEM_CHROMIUM === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(useSystemChromium ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
