import { test } from "node:test";
import assert from "node:assert/strict";
import { planOpening } from "../../src/lib/openingTb";

const TB = [
  { ledger: "Capital Account", head: "capital", debit: 0, credit: 500000 },
  { ledger: "HDFC Bank", head: "bank", debit: 220000, credit: 0 },
  { ledger: "Furniture", head: "fixed_asset", debit: 150000, credit: 0 },
  { ledger: "Sundry Debtors", head: "debtors", debit: 180000, credit: 0 },
  { ledger: "Sundry Creditors", head: "creditors", debit: 0, credit: 90000 },
  { ledger: "Sales", head: "sales", debit: 0, credit: 900000 },
  { ledger: "Purchases", head: "purchase", debit: 600000, credit: 0 },
  { ledger: "Rent", head: "indirect_expense", debit: 240000, credit: 0 },
  { ledger: "Opening Stock", head: "current_asset", debit: 100000, credit: 0 },
];

test("opening entry: P&L ledgers close into capital; closing stock carried; balanced", () => {
  // Profit = 900000 - 600000 - 240000 - opening stock 100000 + closing stock 120000 = 80000 (opening stock never carries, even if tagged as an asset)
  const p = planOpening(TB, { retained: "Capital Account", retainedHead: "capital", closingStock: 120000 });
  assert.equal(p.profit, 80000);
  const cap = p.lines.find(l => l.ledger === "Capital Account")!;
  assert.equal(cap.cr, 580000);
  assert.ok(!p.lines.some(l => ["Sales", "Purchases", "Rent", "Opening Stock"].includes(l.ledger)), "income/expense don't carry forward");
  assert.equal(p.lines.find(l => l.ledger === "Stock-in-Trade")!.dr, 120000);
  assert.equal(p.difference, 0);
  assert.equal(p.totalDr, p.totalCr);
});

test("an unbalanced TB is reported, or parked in a chosen ledger", () => {
  const rows = [{ ledger: "Cash", head: "cash", debit: 1000, credit: 0 }, { ledger: "Capital", head: "capital", debit: 0, credit: 900 }];
  assert.equal(planOpening(rows, { retained: "Capital", retainedHead: "capital" }).difference, 100);
  const parked = planOpening(rows, { retained: "Capital", retainedHead: "capital", differenceTo: "Opening Difference" });
  assert.equal(parked.lines.find(l => l.ledger === "Opening Difference")!.cr, 100);
});
