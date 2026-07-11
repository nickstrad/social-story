import { defineConfig } from "@playwright/test"

import { BASE_URL, serverEnv } from "./e2e/support/constants"

// Deterministic E2E: real Next.js + Postgres + auth, all external I/O faked via
// E2E_FAKES=1 (see src/server/container.ts). Docker Postgres is owned by
// scripts/e2e.sh; globalSetup applies migrations and truncates.
export default defineConfig({
  testDir: "./e2e/specs",
  globalSetup: "./e2e/global-setup.ts",
  // Shared Postgres → serialize for now. Specs use unique per-test emails so the
  // suite can flip fullyParallel on once that shared state is proven safe.
  fullyParallel: false,
  workers: 1,
  // Determinism over flake-hiding: no retries. A flaky spec is a bug to fix.
  retries: 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Exercise Playwright's bundled Chromium directly; no mobile/device
      // emulation is needed for these workflow tests.
      use: { viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    env: serverEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
})
