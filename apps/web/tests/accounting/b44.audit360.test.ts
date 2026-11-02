// 360° audit, step 1: books integrity and cash / tax-law checks
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAudit360, type AuditAccount } from "../../src/lib/audit360";
import type { QJournal } from "../../src/lib/bookQueries";

const A: AuditAccount[] = [
  { id: "cash", name: "Cash", type: "asset", sub_type: "cash" },
  { id: "bank", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "rent", name: "Rent", type: "expense", sub_type: "indirect_expense" },
  { id: "sales", name: "Sales", type: "income", sub_type: "revenue" },
  { id: "loan", name: "Loan from Ravi", type: "liability", sub_type: "long_term_liability" },
  { id: "susp", name: "Suspense A/c", type: "liability", sub_type: null },
];
const J = (id: string, date: string, lines: [string, number, number][]): QJournal =>
  ({ id, date, entry_no: id, narration: "", type: "journal", party_name: null, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });
const period = { from: "2025-04-01", to: "2026-03-31" };
const run = (js: QJournal[]) => runAudit360(A, js, period, { today: "2026-11-02", drafts: 0, openingPosted: true });
const check = (r: ReturnType<typeof run>, id: string) => r.checks.find(c => c.id === id)!;

test("clean books score 100", () => {
  const r = run([J("S1", "2025-05-01", [["cash", 5000, 0], ["sales", 0, 5000]]), J("P1", "2025-05-02", [["rent", 4000, 0], ["cash", 0, 4000]])]);
  assert.equal(r.counts.fail + r.counts.warn, 0);
  assert.equal(r.score, 100);
});

test("an empty entry and a suspense balance are flagged", () => {
  const r = run([J("E1", "2025-06-01", []), J("X1", "2025-06-02", [["bank", 900, 0], ["susp", 0, 900]])]);
  assert.equal(check(r, "empty_entries").status, "fail");
  assert.equal(check(r, "suspense_nil").status, "warn");
});

test("cash going negative is a problem", () => {
  const r = run([J("P1", "2025-07-01", [["rent", 3000, 0], ["cash", 0, 3000]])]);
  assert.equal(check(r, "cash_negative").status, "fail");
});

test("cash limits: expense over ₹10,000, receipt of ₹2 lakh, cash loan of ₹20,000", () => {
  const r = run([
    J("C1", "2025-08-01", [["cash", 250000, 0], ["sales", 0, 250000]]),
    J("C2", "2025-08-02", [["rent", 12000, 0], ["cash", 0, 12000]]),
    J("C3", "2025-08-03", [["cash", 25000, 0], ["loan", 0, 25000]]),
    J("W1", "2025-08-04", [["cash", 300000, 0], ["bank", 0, 300000]]),   // a withdrawal from the bank is fine
  ]);
  assert.equal(check(r, "cash_expense_10k").items.length, 1);
  assert.deepEqual(check(r, "cash_receipt_2l").items.map(i => i.entry_no), ["C1"]);
  assert.equal(check(r, "cash_loan_20k").items[0].entry_no, "C3");
});

test("possible duplicates: same date, amount and ledgers", () => {
  const r = run([J("D1", "2025-09-01", [["rent", 500, 0], ["bank", 0, 500]]), J("D2", "2025-09-01", [["rent", 500, 0], ["bank", 0, 500]])]);
  assert.equal(check(r, "duplicates").items[0].entry_no, "D2");
});
