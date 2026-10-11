// Phase 1 — one set of journal rules for every source, and bank-import duplicate detection.
// Cases come from the AUDIT TEST TRADERS evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJournal, isCashBankAccount, type RuleAccount } from "../../src/lib/journalRules";
import { extractBankRef, findDuplicates } from "../../src/lib/bankImport";
import { PostingError } from "../../src/lib/posting";

const A: RuleAccount[] = [
  { id: "bank", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "cash", name: "Cash in Hand", type: "asset", sub_type: "cash" },
  { id: "chg", name: "Bank Charges", type: "expense", sub_type: "indirect_expense" },
  { id: "sales", name: "Sales", type: "income", sub_type: "revenue" },
  { id: "ogst", name: "Output CGST", type: "liability", sub_type: "current_liability" },
  { id: "debtors", name: "Debtors Control", type: "asset", sub_type: "trade_receivables", is_group: true },
  { id: "asha", name: "Asha Traders", type: "asset", sub_type: "trade_receivables" },
];
const ctx = (over: Partial<Parameters<typeof validateJournal>[1]> = {}) => ({
  accounts: new Map(A.map(a => [a.id, a])), fys: [{ start_date: "2025-04-01", end_date: "2026-03-31", is_locked: true }, { start_date: "2026-04-01", end_date: "2027-03-31" }],
  gstRegistered: true, ...over,
});
const code = (f: () => unknown) => { try { f(); return "ok"; } catch (e) { return e instanceof PostingError ? `${e.code}:${e.message}` : String(e); } };

test("rejects unbalanced entries", () => {
  assert.match(code(() => validateJournal({ type: "journal", date: "2026-05-01", lines: [{ accountId: "chg", dr: 100, cr: 0 }, { accountId: "bank", dr: 0, cr: 90 }] }, ctx())), /^UNBALANCED/);
});

test("rejects the same ledger on both sides (Dr Bank Charges / Cr Bank Charges ₹9)", () => {
  assert.match(code(() => validateJournal({ type: "journal", date: "2026-05-01", lines: [{ accountId: "chg", dr: 9, cr: 0 }, { accountId: "chg", dr: 0, cr: 9 }] }, ctx())), /^INVALID:"Bank Charges" is on both/);
});

test("a receipt must debit cash/bank and a payment must credit it — Bank Charges is not a bank", () => {
  assert.match(code(() => validateJournal({ type: "payment", date: "2026-05-01", lines: [{ accountId: "asha", dr: 2000000, cr: 0 }, { accountId: "chg", dr: 0, cr: 2000000 }] }, ctx())), /^INVALID:A payment must credit/);
  assert.match(code(() => validateJournal({ type: "receipt", date: "2026-05-01", lines: [{ accountId: "chg", dr: 500000, cr: 0 }, { accountId: "asha", dr: 0, cr: 500000 }] }, ctx())), /^INVALID:A receipt must debit/);
  assert.equal(code(() => validateJournal({ type: "payment", date: "2026-05-01", lines: [{ accountId: "chg", dr: 236, cr: 0 }, { accountId: "bank", dr: 0, cr: 236 }] }, ctx())), "ok");
  assert.equal(isCashBankAccount(A[2]), false); assert.equal(isCashBankAccount(A[0]), true);
});

test("dates outside the financial years, or in a locked year, are refused", () => {
  assert.match(code(() => validateJournal({ type: "journal", date: "2024-03-31", lines: [{ accountId: "chg", dr: 1, cr: 0 }, { accountId: "bank", dr: 0, cr: 1 }] }, ctx())), /^INVALID:2024-03-31 is outside/);
  assert.match(code(() => validateJournal({ type: "journal", date: "2026-03-25", lines: [{ accountId: "chg", dr: 1, cr: 0 }, { accountId: "bank", dr: 0, cr: 1 }] }, ctx())), /^LOCKED/);
  assert.equal(code(() => validateJournal({ type: "journal", date: "2026-03-25", lines: [{ accountId: "chg", dr: 1, cr: 0 }, { accountId: "bank", dr: 0, cr: 1 }] }, ctx({ force: true }))), "ok");
  assert.equal(code(() => validateJournal({ type: "journal", date: "2020-01-01", lines: [{ accountId: "chg", dr: 1, cr: 0 }, { accountId: "bank", dr: 0, cr: 1 }] }, ctx({ fys: [] }))), "ok", "no FYs set up yet");
});

test("groups can't be posted to (Debtors Control is a group)", () => {
  assert.match(code(() => validateJournal({ type: "journal", date: "2026-05-01", lines: [{ accountId: "debtors", dr: 1, cr: 0 }, { accountId: "sales", dr: 0, cr: 1 }] }, ctx())), /^ACCOUNT:"Debtors Control" is a group/);
});

test("a GST-registered cash sale of ₹11,800 with no output GST is flagged for review, not rejected", () => {
  const r = validateJournal({ type: "sales", date: "2026-05-01", lines: [{ accountId: "cash", dr: 11800, cr: 0 }, { accountId: "sales", dr: 0, cr: 11800 }] }, ctx());
  assert.equal(r.review.length, 1); assert.match(r.review[0], /no GST lines/);
  const ok = validateJournal({ type: "sales", date: "2026-05-01", lines: [{ accountId: "cash", dr: 11800, cr: 0 }, { accountId: "sales", dr: 0, cr: 10000 }, { accountId: "ogst", dr: 0, cr: 1800 }] }, ctx());
  assert.equal(ok.review.length, 0);
  assert.equal(validateJournal({ type: "sales", date: "2026-05-01", lines: [{ accountId: "cash", dr: 100, cr: 0 }, { accountId: "sales", dr: 0, cr: 100 }] }, ctx({ gstRegistered: false })).review.length, 0);
});

test("bank refs: cheque numbers and UTRs", () => {
  assert.equal(extractBankRef("CTS CLEARING CL011206 KUMAR"), "CL011206");
  assert.equal(extractBankRef("RTGS UTR: HDFCR52026032600123 RAVI"), "HDFCR52026032600123");
  assert.equal(extractBankRef("NEFT-N123456789012-ACME"), "N123456789012");
  assert.equal(extractBankRef("SERVICE CHARGES"), null);
});

test("duplicates: same cheque twice (26 Mar ₹20L, 27 Mar ₹1L), same date+amount, and repeats inside one file", () => {
  const existing = [{ id: "j1", entryNo: "RCT/2025-26/0004", date: "2026-03-26", amount: 2000000, ref: "CL011206" }];
  const d = findDuplicates([
    { key: "a", date: "2026-03-27", amount: 100000, ref: "CL011206" },
    { key: "b", date: "2026-03-26", amount: 2000000, ref: null },
    { key: "c", date: "2026-03-28", amount: 500, ref: "X99887766" },
    { key: "d", date: "2026-03-28", amount: 500, ref: "X99887766" },
    { key: "e", date: "2026-03-29", amount: 750, ref: null },
  ], existing);
  assert.match(d.get("a")!, /Reference CL011206 was already imported/);
  assert.match(d.get("b")!, /Already imported as RCT\/2025-26\/0004/);
  assert.equal(d.has("c"), false); assert.match(d.get("d")!, /twice in this file/);
  assert.equal(d.has("e"), false);
});
