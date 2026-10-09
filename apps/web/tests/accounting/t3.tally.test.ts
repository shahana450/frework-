// Task 3 — Tally reliability: push status per company, duplicate-number migration, bridge files, port in every error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pushView, isPushedHere, fromSyncRows } from "../../src/lib/integrations/pushStatus";
import { tallyProblem, explainTallyError } from "../../src/lib/integrations/tally";

const AT = "2026-10-09T10:00:00Z";

test("T3: 'Pushed' only for the company open now; another company is a hint, not pushed", () => {
  assert.equal(isPushedHere({ at: AT, target: "ABC Traders" }, "ABC Traders"), true);
  assert.equal(isPushedHere({ at: AT, target: "ABC Traders" }, "abc traders "), true, "case and spaces don't matter");
  assert.equal(isPushedHere({ at: AT, target: "ABC Traders" }, "ABC Traders 2025"), false);
  assert.deepEqual(pushView({ at: AT, target: "ABC Traders" }, "ABC Traders 2025"), { kind: "elsewhere", at: AT, company: "ABC Traders" });
});

test("T3: older marks without a company still count as pushed (no duplicate push); failures never do", () => {
  assert.deepEqual(pushView({ at: AT }, "ABC Traders"), { kind: "pushed", at: AT, companyKnown: false });
  assert.deepEqual(pushView({ at: AT, target: null }, "X"), { kind: "pushed", at: AT, companyKnown: false });
  assert.equal(isPushedHere({ error: "Tally rejected", target: "ABC Traders" }, "ABC Traders"), false);
  assert.equal(isPushedHere(undefined, "ABC Traders"), false);
  assert.equal(isPushedHere({ at: AT, target: "ABC Traders" }, ""), true, "no company open: can't compare, keep the mark");
});

test("T3: server rows keep the company", () => {
  const m = fromSyncRows([
    { journal_id: "a", status: "pushed", error: null, synced_at: AT, target: "ABC" },
    { journal_id: "b", status: "failed", error: "bad ledger", synced_at: AT, target: "ABC" },
    { journal_id: "c", status: "found", error: null, synced_at: AT },
  ]);
  assert.deepEqual(m, { a: { at: AT, target: "ABC" }, b: { error: "bad ledger", target: "ABC" }, c: { at: AT, target: null } });
});

test("T3: every Tally connection error names the port and says what to check", () => {
  for (const kind of ["unreachable", "bridge502", "http"] as const) {
    const msg = tallyProblem("9000", kind, 500);
    assert.match(msg, /port 9000/, kind);
    assert.match(msg, /company|Connectivity/, kind);
  }
  assert.match(tallyProblem("", "unreachable"), /port 7001/, "default port");
  assert.match(explainTallyError("Failed to fetch", false, "9001"), /port 9001/);
  assert.match(explainTallyError("TypeError: network error", false, 7001), /port 7001.*Bridge/);
});

test("T3: the duplicate-number migration renumbers only entries not pushed to Tally", () => {
  const sql = readFileSync(join(process.cwd(), "src/app/finance/migrations/2026-10-19_t3_renumber_duplicates.sql"), "utf8");
  assert.match(sql, /status in \('pushed', 'found'\)/);
  assert.match(sql, /where d\.action = 'will be renumbered'/);
  assert.match(sql, /PUSHED DUPLICATE — owner decides/);
  assert.match(sql, /fw_fin_series_prefix\(r\.business_id/);
});

test("T3: only the current bridge is served; old copies are gone", () => {
  const pub = join(process.cwd(), "public");
  assert.ok(existsSync(join(pub, "tally-bridge-node.zip")));
  assert.ok(!existsSync(join(pub, "tally-bridge.js")));
  assert.ok(!existsSync(join(pub, "run-tally-bridge.bat")));
});
