import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Load .env (DATABASE_URL etc.) into process.env for integration tests.
    // In CI, real process.env values are already present.
    env: loadEnv(mode, process.cwd(), ""),
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
}));
