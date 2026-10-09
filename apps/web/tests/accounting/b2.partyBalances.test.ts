// B2 — receivables group by party (Step 0: Kumar 50,000 · Kerala 59,000 · Bengaluru 23,600 · ABC −25,000 advance · total 1,07,600)
import { test } from "node:test";
import assert from "node:assert/strict";
import { partyBalances } from "../../src/lib/partyBalances";
import { findLedger, partyKey } from "../../src/lib/frebook/validateDraft";
import { buildEntry, type Intent } from "../../src/lib/accountingRules";
import { ACCOUNTS, LINES } from "./step0.baseline.test";

test("B2: receivables by party for the Step 0 book, advance shown not hidden", () => {
  const r = partyBalances("receivable", ACCOUNTS, LINES, "2026-05-15");
  assert.deepEqual(r.rows.map(x => [x.name, x.balance, x.status]), [
    ["Kerala Retail Co", 59000, "owes"], ["Kumar Traders", 50000, "owes"], ["Bengaluru Electricals", 23600, "owes"], ["ABC Traders", -25000, "advance"],
  ]);
  assert.equal(r.total, 107600);
  assert.equal(r.advances, -25000);
  assert.ok(!r.rows.some(x => /walk-in|untagged/i.test(x.name)));
});

test("B2: ageing is FIFO — Kumar's 10,000 receipt settles part of the 5 Apr invoice, which stays the oldest", () => {
  const r = partyBalances("receivable", ACCOUNTS, LINES, "2026-05-15");
  const kumar = r.rows.find(x => x.name === "Kumar Traders")!;
  assert.equal(kumar.oldest, "2026-04-05");
  assert.equal(kumar.bucket, "31-60");
});

test("B2: payables by party — Malabar owes us nothing, we owe Malabar 20,000", () => {
  const r = partyBalances("payable", ACCOUNTS, LINES, "2026-05-15");
  assert.deepEqual(r.rows.map(x => [x.name, x.balance]), [["Malabar Suppliers", 20000]]);
});

test("B2: party names match fuzzily — case, punctuation and legal suffixes ignored, never a guess between two", () => {
  const ledgers = [{ name: "ABC Traders" }, { name: "Kumar & Sons" }];
  assert.equal(findLedger("abc traders pvt. ltd.", ledgers)?.name, "ABC Traders");
  assert.equal(findLedger("M/s ABC Traders", ledgers)?.name, "ABC Traders");
  assert.equal(findLedger("XYZ Traders", ledgers), undefined);
  assert.equal(partyKey("ABC Traders Pvt Ltd"), partyKey("abc"));
});

test("B2: a credit sale without a customer is never posted to a control ledger", () => {
  const intent = { action: "sale", amount: 1000, payment_mode: "credit", payment_account: null, counter_account: "Debtors Control", party_name: null } as unknown as Intent;
  const r = buildEntry(intent);
  assert.ok(r.missing.includes("customer"));
  assert.ok(!r.lines.some(l => /control/i.test(l.account)));
});
