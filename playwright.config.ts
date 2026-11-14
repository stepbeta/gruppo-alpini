import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E suite against the local Supabase stack.
 *
 * `test:e2e` resets the local database once, then Playwright starts a dedicated
 * dev server whose Supabase variables come from `supabase status` (see
 * `scripts/e2e-dev-server.mjs`). `reuseExistingServer` stays false so a dev
 * server configured for the cloud project cannot be picked up by mistake.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  // The specs share one local database and run in a deliberate priority order.
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "node scripts/e2e-dev-server.mjs",
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
