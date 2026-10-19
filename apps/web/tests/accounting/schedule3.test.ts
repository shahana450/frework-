// Schedule III Balance Sheet: every presented line lands under one head, totals unchanged
import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleIII, headOf } from "../../src/lib/schedule3";
import type { PresentedBS } from "../../src/lib/statements";

const sec = (key: string, title: string, lines: { id: string; name: string; amount: number }[]) => ({ key, title, lines, total: lines.reduce((s, l) => s + l.amount, 0) });
const p: PresentedBS = {
  assets: [
    sec("current_assets", "Current Assets", [{ id: "c", name: "Cash", amount: 300 }, { id: "d", name: "ABC Traders", amount: 500 }, { id: "s", name: "Advances to suppliers — XYZ", amount: 100 }]),
    sec("fixed_assets", "Fixed Assets", [{ id: "f", name: "Furniture", amount: 1000 }]),
  ],
  liabilities: [
    sec("current_liabilities", "Current Liabilities", [{ id: "o", name: "Bank overdraft — HDFC Bank", amount: 200 }, { id: "g", name: "GST Payable", amount: 50 }, { id: "t", name: "PQR Suppliers", amount: 150 }]),
    sec("equity", "Capital", [{ id: "k", name: "Capital A/c", amount: 1200 }]),
    sec("reserves", "Reserves & Surplus", [{ id: "__net_profit", name: "Net profit for the year", amount: 300 }]),
  ],
  totalAssets: 1900, totalLiabilities: 1900, netProfit: 300, footed: true, problems: [],
};

test("heads: overdraft is a borrowing, GST is other current liability, party is trade payable/receivable", () => {
  assert.equal(headOf("current_liabilities", { id: "o", name: "Bank overdraft — HDFC Bank", amount: 1 }), "st_borrowings");
  assert.equal(headOf("current_liabilities", { id: "g", name: "GST Payable", amount: 1 }), "other_cl");
  assert.equal(headOf("current_liabilities", { id: "t", name: "PQR Suppliers", amount: 1 }), "trade_payables");
  assert.equal(headOf("current_assets", { id: "c", name: "Cash", amount: 1 }), "cash");
  assert.equal(headOf("current_assets", { id: "d", name: "ABC Traders", amount: 1 }), "trade_receivables");
});

test("Schedule III keeps the totals and numbers the notes in order", () => {
  const s = scheduleIII(p, new Map());
  assert.equal(s.totalEL, 1900);
  assert.equal(s.totalAssets, 1900);
  assert.deepEqual(s.equityLiabilities.map(b => b.key), ["equity", "current_liab"]);
  assert.deepEqual(s.equityLiabilities.flatMap(b => b.heads.map(h => `${h.note}:${h.key}`)), ["1:capital", "2:reserves", "3:st_borrowings", "4:trade_payables", "5:other_cl"]);
  assert.deepEqual(s.assets.flatMap(b => b.heads.map(h => h.key)), ["ppe", "trade_receivables", "cash", "loans_advances"]);
});
