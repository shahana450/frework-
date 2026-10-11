// The free FreBook month is claimed once per account: a second claim returns 409. The database is mocked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { claimTrial, TRIAL_DAYS, ALREADY_ACTIVE, ALREADY_USED, type TrialStore, type SubscriptionRow } from "../../src/lib/claimTrial";

/** In-memory fw_fin_subscriptions with the same one-row-per-user rule as the real table (upsert onConflict user_id). */
function memoryStore(seed: (SubscriptionRow & { user_id: string })[] = []) {
  const rows = [...seed];
  let inserts = 0;
  const store: TrialStore = {
    async findAny(userId) { return rows.find(r => r.user_id === userId) ?? null; },
    async insertTrial(row) {
      inserts++;
      if (rows.some(r => r.user_id === row.user_id)) return { error: 'duplicate key value violates unique constraint "fw_fin_subscriptions_user_id_key"' };
      rows.push(row as SubscriptionRow & { user_id: string });
      return { error: null };
    },
  };
  return { store, rows, inserts: () => inserts };
}

const NOW = new Date("2026-10-11T00:00:00.000Z");

test("claim-trial: first claim starts a 30-day FreBook trial", async () => {
  const db = memoryStore();
  const r = await claimTrial(db.store, "u1", NOW);
  assert.equal(r.status, 200);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].plan, "frebook");
  assert.equal(db.rows[0].status, "trial");
  const ends = new Date(NOW.getTime() + TRIAL_DAYS * 86400000).toISOString();
  if (r.status === 200) assert.equal(r.body.ends_at, ends);
  assert.equal(db.rows[0].subscription_ends_at, ends);
});

test("claim-trial: a second claim returns 409 and writes nothing", async () => {
  const db = memoryStore();
  assert.equal((await claimTrial(db.store, "u1", NOW)).status, 200);
  const second = await claimTrial(db.store, "u1", NOW);
  assert.equal(second.status, 409);
  if (second.status === 409) assert.equal(second.body.error, ALREADY_ACTIVE);
  assert.equal(db.rows.length, 1);
  assert.equal(db.inserts(), 1);
});

test("claim-trial: after the free month ends, claiming again still returns 409", async () => {
  const db = memoryStore();
  await claimTrial(db.store, "u1", NOW);
  const later = new Date(NOW.getTime() + 40 * 86400000);
  const r = await claimTrial(db.store, "u1", later);
  assert.equal(r.status, 409);
  if (r.status === 409) assert.equal(r.body.error, ALREADY_USED);
});

test("claim-trial: a paid or old-plan account cannot claim", async () => {
  const db = memoryStore([{ user_id: "u2", plan: "professional", status: "expired", subscription_ends_at: "2025-01-01T00:00:00.000Z" }]);
  const r = await claimTrial(db.store, "u2", NOW);
  assert.equal(r.status, 409);
  assert.equal(db.inserts(), 0);
});

test("claim-trial: two claims racing — the database's unique key turns the loser into 409", async () => {
  const db = memoryStore();
  const racing: TrialStore = { findAny: async () => null, insertTrial: db.store.insertTrial };   // both requests saw no row
  assert.equal((await claimTrial(racing, "u3", NOW)).status, 200);
  assert.equal((await claimTrial(racing, "u3", NOW)).status, 409);
  assert.equal(db.rows.length, 1);
});

test("claim-trial: other users are unaffected", async () => {
  const db = memoryStore();
  await claimTrial(db.store, "u1", NOW);
  assert.equal((await claimTrial(db.store, "u4", NOW)).status, 200);
});

test("pricing pages: FreBook only, with the Claim 1 month free button calling claim-trial and going to /finance/start", () => {
  for (const f of ["src/app/pricing/page.tsx", "src/app/finance/pricing/page.tsx"]) {
    const s = readFileSync(join(process.cwd(), f), "utf8");
    assert.ok(s.includes("🎁 Claim 1 month free"), f);
    assert.ok(s.includes('"/api/finance/subscription/claim-trial"'), f);
    assert.ok(s.includes('"/finance/start"'), f);
    assert.ok(s.includes("₹0 for the first month · then {FREBOOK_PRICE_LABEL} + GST/month"), f);
    // old tiers by id or as a plan name ("Professional services" is fine — that's the services line)
    assert.ok(!/["'](starter|professional|enterprise)["']|\b(Starter|Professional|Enterprise)\s+(plan|tier)\b|name:\s*["'](Starter|Professional|Enterprise)/i.test(s), `${f} shows an old plan`);
  }
  assert.ok(readFileSync(join(process.cwd(), "src/app/finance/pricing/page.tsx"), "utf8").includes("Start with <span"), "Start with one month free");
});
