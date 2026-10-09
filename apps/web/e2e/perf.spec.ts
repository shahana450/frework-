// Speed test (Task 7): time the busiest finance pages for a business with ~10,000 vouchers (scripts/seed-10k.ts).
// Localhost only. Run: E2E_PERF=1 FW_SEED_EMAIL=… FW_SEED_PASSWORD=… npx playwright test perf
// Each page must be usable in under 2 seconds; results are written to e2e-report/perf.json.
import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { signIn } from "./fixtures/users";

test.skip(!process.env.E2E_PERF || !process.env.FW_SEED_PASSWORD, "set E2E_PERF=1 and the perf user (FW_SEED_EMAIL / FW_SEED_PASSWORD) after running scripts/seed-10k.ts");

const PAGES = [
  { name: "journals", path: "/finance/journals" },
  { name: "books", path: "/finance/books" },
  { name: "reports (P&L)", path: "/finance/reports?tab=profit_loss" },
  { name: "reports (Balance Sheet)", path: "/finance/reports?tab=balance_sheet" },
  { name: "receivables", path: "/finance/receivables" },
];
const LIMIT_MS = 2000;

test("finance pages load in under 2 seconds with 10,000 vouchers", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, { email: process.env.FW_SEED_EMAIL ?? "perf@example.test", password: process.env.FW_SEED_PASSWORD!, business: "Perf 10k Traders" });
  const results: { page: string; ms: number }[] = [];
  for (const p of PAGES) {
    await page.goto("/finance");                       // warm the app shell, then time the page itself
    const t0 = Date.now();
    await page.goto(p.path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Loading…|Loading\.\.\./)).toHaveCount(0);
    results.push({ page: p.name, ms: Date.now() - t0 });
  }
  mkdirSync("e2e-report", { recursive: true });
  writeFileSync("e2e-report/perf.json", JSON.stringify({ at: new Date().toISOString(), limit_ms: LIMIT_MS, results }, null, 2));
  console.table(results);
  const slow = results.filter(r => r.ms > LIMIT_MS);
  expect(slow, `slower than ${LIMIT_MS} ms`).toEqual([]);
});
