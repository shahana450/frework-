// Phase 3 — one AR/AP source, Balance Sheet placement of abnormal balances, footing on displayed figures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { arAp, partyBalances } from "../../src/lib/partyBalances";
import { presentBalanceSheet } from "../../src/lib/statements";
import { isControlLedger } from "../../src/lib/posting";
import type { BS, TBRow } from "../../src/lib/books";

const accounts = [
  { id: "asha", name: "Asha Traders", type: "asset", sub_type: "trade_receivables" },
  { id: "kumar", name: "Kumar Stores", type: "asset", sub_type: "trade_receivables" },
  { id: "ravi", name: "Ravi Suppliers", type: "liability", sub_type: "trade_payables" },
  { id: "ctl", name: "Debtors Control", type: "asset", sub_type: "trade_receivables", is_group: true },
];
const lines = [
  { account_id: "asha", dr: 118000, cr: 0, date: "2026-09-01" }, { account_id: "asha", dr: 0, cr: 18000, date: "2026-09-20" },
  { account_id: "kumar", dr: 0, cr: 5000, date: "2026-09-05" },
  { account_id: "ravi", dr: 0, cr: 30000, date: "2026-09-02" },
  { account_id: "ctl", dr: 0, cr: 999999, date: "2026-09-02" },     // a group never counts
];

test("Dashboard, MIS, Receivables and Payables read the same numbers", () => {
  const x = arAp(accounts, lines, "2026-10-01");
  assert.equal(x.toReceive, partyBalances("receivable", accounts, lines, "2026-10-01").total);
  assert.equal(x.toPay, partyBalances("payable", accounts, lines, "2026-10-01").total);
  assert.equal(x.receivable.owed, 100000); assert.equal(x.receivable.advances, -5000); assert.equal(x.toReceive, 95000);
  assert.equal(x.toPay, 30000);
  assert.ok(!x.receivable.rows.some(r => r.id === "ctl"), "control group is not a party");
});

test("control ledgers are recognised (and only those)", () => {
  for (const n of ["Debtors Control", "Creditors Control", "Sundry Debtors", "sundry creditors", "Trade Receivables"]) assert.equal(isControlLedger(n), true, n);
  for (const n of ["Asha Traders", "Debtors Written Off", "HDFC Bank"]) assert.equal(isControlLedger(n), false, n);
});

const row = (id: string, name: string, group: TBRow["group"], balance: number): TBRow => ({ id, name, group, periodDr: 0, periodCr: 0, balance, dr: balance > 0 ? balance : 0, cr: balance < 0 ? -balance : 0 } as unknown as TBRow);

test("Balance Sheet: cash in credit, debtors in credit and a P&L b/f debit are never shown as positives; empty headings hidden; foots", () => {
  // AUDIT TEST TRADERS shape: Cash ₹28,700 CREDIT, Debtors ₹1,34,92,400 CREDIT, P&L b/f ₹1,00,500 DEBIT
  const bs = {
    currentAssets: [row("cash", "Cash", "current_asset", -28700), row("deb", "Asha Traders", "current_asset", -13492400), row("bank", "HDFC Bank", "current_asset", 13645000), row("zero", "Petty", "current_asset", 0)],
    fixedAssets: [], currentLiabilities: [row("cred", "Ravi Suppliers", "current_liability", -50000)], duties: [], loans: [],
    capital: [row("cap", "Capital", "capital", -100000), row("plbf", "Profit & Loss b/f", "capital", 100500)],
    netProfit: 145900,
  } as unknown as BS;
  const p = presentBalanceSheet(bs, [{ ...row("deb", "Asha Traders", "current_asset", 0), sub_type: "trade_receivables" }, { ...row("cash", "Cash", "current_asset", 0), sub_type: "cash" }]);
  const all = [...p.assets, ...p.liabilities].flatMap(s => s.lines.map(l => ({ ...l, s: s.key })));
  assert.equal(all.find(l => l.id === "cash")!.s, "current_liabilities");
  assert.match(all.find(l => l.id === "deb")!.name, /^Advances from customers/);
  assert.equal(all.find(l => l.id === "plbf")!.s, "reserves");
  assert.ok(all.find(l => l.id === "plbf")!.amount < 0, "P&L b/f debit shows negative");
  assert.ok(!all.some(l => l.id === "zero"), "zero balances hidden");
  assert.ok(!p.liabilities.some(s => s.key === "long_term_liabilities"), "empty heading hidden");
  for (const s of [...p.assets, ...p.liabilities]) assert.equal(Math.round(s.lines.reduce((a, l) => a + l.amount, 0) * 100) / 100, s.total, s.title);
});

test("Balance Sheet: when displayed figures don't foot, it says so instead of showing a fake balanced total", () => {
  const bs = { currentAssets: [row("bank", "HDFC Bank", "current_asset", 1000)], fixedAssets: [], currentLiabilities: [], duties: [], loans: [], capital: [row("cap", "Capital", "capital", -500)], netProfit: 0 } as unknown as BS;
  const p = presentBalanceSheet(bs, []);
  assert.equal(p.footed, false); assert.match(p.problems.join(" "), /Assets 1000 ≠ liabilities and capital 500/);
});
