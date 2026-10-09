import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCollect, reminderText, bucketOf } from "../../src/lib/collect";
import { reviewChecks } from "../../src/lib/reviewChecks";
import { computeRecap } from "../../src/lib/recap";
import type { QJournal } from "../../src/lib/bookQueries";

const accounts = [
  { id: "hdfc", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "sales", name: "Sales", type: "income", sub_type: null },
  { id: "deb", name: "Sundry Debtors", type: "asset", sub_type: "trade_receivables" },
  { id: "malabar", name: "Malabar Traders", type: "asset", sub_type: "trade_receivables" },
  { id: "rent", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
];
let n = 0;
const J = (date: string, party: string | null, lines: [string, number, number][]): QJournal =>
  ({ id: `j${++n}`, date, entry_no: `INV-${n}`, narration: `entry ${n}`, type: "journal", party_name: party, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });

const today = "2026-10-04";
const journals = [
  J("2026-07-20", null, [["malabar", 40000, 0], ["sales", 0, 40000]]),     // 76 days
  J("2026-08-10", null, [["malabar", 24000, 0], ["sales", 0, 24000]]),     // 55 days
  J("2026-09-01", null, [["hdfc", 30000, 0], ["malabar", 0, 30000]]),      // pays oldest first
  J("2026-09-20", "Nila Design", [["deb", 36500, 0], ["sales", 0, 36500]]),
  J("2026-10-02", "Nila Design", [["hdfc", 36500, 0], ["deb", 0, 36500]]), // fully paid
  J("2026-10-01", "Harbour Foods", [["deb", 9800, 0], ["sales", 0, 9800]]),
];

test("payments clear the oldest invoice first and ageing uses what is left", () => {
  const c = computeCollect(accounts, journals, today);
  const m = c.debtors.find(d => d.name === "Malabar Traders")!;
  assert.equal(m.balance, 34000);
  assert.deepEqual(m.open.map(i => [i.amount, i.days]), [[10000, 76], [24000, 55]]);
  assert.equal(m.bucket, "60+");
  assert.equal(c.debtors[0].name, "Malabar Traders", "oldest debt first");
  assert.ok(!c.debtors.some(d => d.name === "Nila Design"), "paid customers drop off");
  assert.deepEqual(c.buckets, { "0-30": 9800, "31-60": 24000, "60+": 10000 });
  assert.equal(c.total, 43800);
  assert.equal(c.collectedThisMonth, 36500);
});

test("ageing buckets and reminder wording", () => {
  assert.equal(bucketOf(30), "0-30"); assert.equal(bucketOf(31), "31-60"); assert.equal(bucketOf(61), "60+");
  const d = computeCollect(accounts, journals, today).debtors[0];
  const fmt = (x: number) => `₹${x}`;
  assert.match(reminderText(d, "Frework", "polite", fmt), /gentle reminder.*₹34000/s);
  assert.match(reminderText(d, "Frework", "firm", fmt), /76 days/);
  assert.match(reminderText(d, "Frework", "malayalam", fmt), /നമസ്കാരം/);
  assert.match(reminderText(d, "Frework", "polite", fmt, "frework@hdfc"), /upi:\/\/pay\?pa=frework%40hdfc&.*am=34000\.00/);
});

test("review checks: duplicate, usual pattern, TDS hint and bank impact", () => {
  const books = [
    ...[5, 6, 7, 8, 9].map(m => J(`2026-0${m}-05`, null, [["rent", 60000, 0], ["hdfc", 0, 60000]])),
    J("2026-10-01", null, [["hdfc", 400000, 0], ["sales", 0, 400000]]),
  ];
  const r = reviewChecks(accounts, books, today, { date: "2026-10-04", lines: [{ account: "Office Rent", debit: 60000, credit: 0 }, { account: "HDFC Bank", debit: 0, credit: 60000 }] });
  assert.ok(r.checks.some(c => c.tone === "ok" && /usual/i.test(c.title)), "matches the monthly pattern");
  assert.ok(r.checks.some(c => c.tone === "bad" && /TDS/.test(c.title) && /10%/.test(c.detail)), "rent above the TDS limit is flagged");
  assert.ok(r.checks.some(c => c.tone === "ok" && /No duplicate/.test(c.title)));
  const bank = r.impact.find(i => i.account === "HDFC Bank")!;
  assert.equal(bank.after, bank.before - 60000);

  const dup = reviewChecks(accounts, books, today, { date: "2026-09-06", lines: [{ account: "Office Rent", debit: 60000, credit: 0 }, { account: "HDFC Bank", debit: 0, credit: 60000 }] });
  assert.ok(dup.checks.some(c => c.tone === "bad" && /duplicate/i.test(c.title)));
});

test("monthly recap compares with the month before", () => {
  const books = [
    J("2026-08-10", null, [["hdfc", 50000, 0], ["sales", 0, 50000]]),
    J("2026-09-10", null, [["hdfc", 60000, 0], ["sales", 0, 60000]]),
    J("2026-09-12", null, [["rent", 15000, 0], ["hdfc", 0, 15000]]),
  ];
  const r = computeRecap(accounts, books, "2026-10-04")!;
  assert.equal(r.month, "September 2026");
  assert.equal(r.revenue, 60000);
  assert.equal(r.revenueChangePct, 20);
  assert.equal(r.profit, 45000);
  assert.equal(r.marginPct, 75);
  assert.equal(r.entries, 2);
  assert.equal(r.topExpense?.name, "Office Rent");
});

import { isLikelyDuplicate } from "../../src/lib/posting";
test("duplicate rule: same total and ledgers within 3 days only", () => {
  const a = { date: "2026-10-04", total: 25000, accountIds: ["rent", "hdfc"] };
  assert.equal(isLikelyDuplicate(a, { date: "2026-10-02", total: 25000, accountIds: ["hdfc", "rent"] }), true);
  assert.equal(isLikelyDuplicate(a, { date: "2026-09-30", total: 25000, accountIds: ["rent", "hdfc"] }), false, "4 days apart");
  assert.equal(isLikelyDuplicate(a, { date: "2026-10-04", total: 25000.5, accountIds: ["rent", "hdfc"] }), false, "different amount");
  assert.equal(isLikelyDuplicate(a, { date: "2026-10-04", total: 25000, accountIds: ["rent", "sbi"] }), false, "different bank");
});

test("compliance: contract paid in cash needs TDS and breaks the cash limit", () => {
  const r = reviewChecks(accounts, [], today, { date: "2026-10-04", lines: [{ account: "Work Contract Expenses", debit: 150000, credit: 0 }, { account: "Cash", debit: 0, credit: 150000 }] });
  const tds = r.checks.find(c => /TDS must be deducted/.test(c.title))!;
  assert.equal(tds.tone, "bad");
  assert.match(tds.detail, /1% for individual or HUF = ₹1,500; 2% for firm or company = ₹3,000/);
  assert.match(tds.detail, /Section 393\(1\) Table Sl\. 6\(i\), Income-tax Act 2025 \(was s\.194C\)/);
  assert.match(r.checks.find(c => /Cash payment/.test(c.title))!.detail, /section 36\(4\), Income-tax Act 2025 — was s\.40A\(3\)/);
  assert.ok(r.checks.some(c => c.tone === "bad" && /Cash payment over ₹10,000/.test(c.title)));
  // TDS already deducted and paid by bank: no TDS or cash warning
  const ok = reviewChecks(accounts, [], today, { date: "2026-10-04", lines: [{ account: "Work Contract Expenses", debit: 150000, credit: 0 }, { account: "TDS Payable", debit: 0, credit: 1500 }, { account: "HDFC Bank", debit: 0, credit: 148500 }] });
  assert.ok(!ok.checks.some(c => /TDS must|Cash payment/.test(c.title)), JSON.stringify(ok.checks));
  // Freight gets the ₹35,000 cash limit; small contract payments are fine
  assert.ok(!reviewChecks(accounts, [], today, { date: "2026-10-04", lines: [{ account: "Freight Charges", debit: 20000, credit: 0 }, { account: "Cash", debit: 0, credit: 20000 }] }).checks.some(c => /Cash payment/.test(c.title)));
  // Cash receipt of ₹2 lakh, and a loan taken in cash
  assert.ok(reviewChecks(accounts, [], today, { date: "2026-10-04", lines: [{ account: "Cash", debit: 250000, credit: 0 }, { account: "Sales", debit: 0, credit: 250000 }] }).checks.some(c => /₹2 lakh/.test(c.title)));
  assert.ok(reviewChecks(accounts, [], today, { date: "2026-10-04", lines: [{ account: "Cash", debit: 50000, credit: 0 }, { account: "Loan from Rahul", debit: 0, credit: 50000 }] }).checks.some(c => /Loan accepted in cash/.test(c.title)));
});
