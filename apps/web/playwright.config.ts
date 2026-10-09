import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against LOCALHOST only, with seeded test users (e2e/fixtures/test-users.json — see the
// .example file and scripts/seed-e2e.ts). They never point at frework.online or production Supabase.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE)) {
  throw new Error(`E2E tests run on localhost only — got ${BASE}`);
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: { baseURL: BASE, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_NO_SERVER ? undefined : {
    command: "npm run dev", url: BASE, reuseExistingServer: true, timeout: 180_000,
  },
});
