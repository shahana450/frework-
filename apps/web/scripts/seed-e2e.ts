// Creates the two Playwright test users (e2e/fixtures/test-users.json) on LOCAL or STAGING Supabase.
//   node --experimental-strip-types scripts/seed-e2e.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seedClient, ensureUserWithBusiness } from "./lib/seedGuard.ts";

const users = JSON.parse(readFileSync(join(process.cwd(), "e2e/fixtures/test-users.json"), "utf8")) as Record<string, { email: string; password: string; business: string }>;
const { sb, target } = seedClient();
console.log(`Seeding E2E users on ${target}…`);
for (const [key, u] of Object.entries(users)) {
  if (key.startsWith("_")) continue;
  const r = await ensureUserWithBusiness(sb, u.email, u.password, u.business);
  console.log(`  ${key}: ${u.email} → business ${r.businessId}`);
}
