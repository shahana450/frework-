// B13 reversal ≠ duplicate · B15 each warning comes from its own rule with its own fix · B16 new cash ledger can go negative
import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewChecks } from "../../src/lib/reviewChecks";

const accounts = [
  { id: "cash", name: "Cash", type: "asset", sub_type: "cash" },
  { id: "bank", name: "Bank", type: "asset", sub_type: "bank" },
  { id: "chg", name: "Bank Charges", type: "expense", sub_type: "indirect_expense" },
  { id: "wc", name: "Work Contract Charges", type: "expense", sub_type: "indirect_expense" },
];

test("B16: the first cash payment, creating the Cash ledger, warns that it goes below zero", () => {
  const r = reviewChecks([], [], "2026-04-03", { date: "2026-04-03", lines: [{ account: "Office Rent", debit: 15000, credit: 0 }, { account: "Cash", debit: 0, credit: 15000 }] });
  assert.deepEqual(r.impact, [{ account: "Cash", before: 0, after: -15000 }]);
  assert.ok(r.checks.some(c => c.rule === "negative_balance" && /first entry/i.test(c.detail)));
});

test("B15: a cash-limit breach shows only the cash fix — no TDS boilerplate", () => {
  const r = reviewChecks(accounts, [], "2026-04-05", { date: "2026-04-05", lines: [{ account: "Office Supplies", debit: 15000, credit: 0 }, { account: "Cash", debit: 0, credit: 15000 }] });
  const bad = r.checks.filter(c => c.tone === "bad");
  assert.deepEqual(bad.map(c => c.rule), ["cash_payment_limit"]);
  assert.ok(bad.every(c => !/TDS/.test(c.fix ?? "")));
});

test("B15: a TDS breach carries the TDS fix", () => {
  const r = reviewChecks(accounts, [], "2026-04-05", { date: "2026-04-05", lines: [{ account: "Work Contract Charges", debit: 150000, credit: 0 }, { account: "Bank", debit: 0, credit: 150000 }] });
  const tds = r.checks.find(c => c.rule === "tds")!;
  assert.match(tds.fix!, /TDS Payable/);
});

test("B13: a reversal and its original are not flagged as possible duplicates", () => {
  const journals = [
    { id: "j8", date: "2026-04-09", entry_no: "JV-2026-0008", narration: "Bank charges", type: "payment", party_name: null, lines: [{ account_id: "chg", dr: 590, cr: 0 }, { account_id: "bank", dr: 0, cr: 590 }] },
    { id: "j11", date: "2026-04-12", entry_no: "JV-2026-0011", narration: "Reversal of JV-2026-0008 — wrong entry", type: "payment", party_name: null, lines: [{ account_id: "bank", dr: 590, cr: 0 }, { account_id: "chg", dr: 0, cr: 590 }] },
  ];
  const again = reviewChecks(accounts, journals, "2026-04-12", { date: "2026-04-11", lines: [{ account: "Bank Charges", debit: 590, credit: 0 }, { account: "Bank", debit: 0, credit: 590 }] });
  assert.ok(!again.checks.some(c => c.title === "Possible duplicate"), "re-posting a reversed entry is not a duplicate");
  // A genuine exact duplicate is still caught
  const dup = reviewChecks(accounts, [journals[0]], "2026-04-10", { date: "2026-04-10", lines: [{ account: "Bank Charges", debit: 590, credit: 0 }, { account: "Bank", debit: 0, credit: 590 }] });
  assert.ok(dup.checks.some(c => c.title === "Possible duplicate"));
});
