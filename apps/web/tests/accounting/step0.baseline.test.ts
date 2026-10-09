// Step 0 — regression baseline from the 9 Oct 2026 launch audit ("AUDIT TEST TRADERS", Kerala, state code 32).
// Locks in the posting/report maths before any launch-blocker fix touches code near it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEntry } from "../../src/lib/posting";
import { buildTrialBalance, buildPL, buildBS, statementAmount, type Account, type BookLine } from "../../src/lib/books";

export const ACCOUNTS: (Account & { party?: string })[] = [
  { id: "bank", name: "Bank", type: "asset", sub_type: "bank" },
  { id: "cash", name: "Cash", type: "asset", sub_type: "cash" },
  { id: "abc", name: "ABC Traders", type: "asset", sub_type: "trade_receivables", party: "ABC Traders" },
  { id: "kumar", name: "Kumar Traders", type: "asset", sub_type: "trade_receivables", party: "Kumar Traders" },
  { id: "kerala", name: "Kerala Retail Co", type: "asset", sub_type: "trade_receivables", party: "Kerala Retail Co" },
  { id: "blr", name: "Bengaluru Electricals", type: "asset", sub_type: "trade_receivables", party: "Bengaluru Electricals" },
  { id: "malabar", name: "Malabar Suppliers", type: "liability", sub_type: "trade_payables", party: "Malabar Suppliers" },
  { id: "rent", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
  { id: "charges", name: "Bank Charges", type: "expense", sub_type: "indirect_expense" },
  { id: "purch", name: "Purchases", type: "expense", sub_type: "direct_expense" },
  { id: "sales", name: "Sales", type: "income", sub_type: "revenue" },
  { id: "comp", name: "Computers", type: "asset", sub_type: "fixed_asset" },
  { id: "cgst", name: "Output CGST", type: "liability", sub_type: "current_liability" },
  { id: "sgst", name: "Output SGST", type: "liability", sub_type: "current_liability" },
  { id: "igst", name: "Output IGST", type: "liability", sub_type: "current_liability" },
];

type V = { no: number; date: string; dr: [string, number][]; cr: [string, number][]; taxable?: number; gst?: number };
export const VOUCHERS: V[] = [
  { no: 1, date: "2026-04-02", dr: [["bank", 25000]], cr: [["abc", 25000]] },
  { no: 2, date: "2026-04-03", dr: [["rent", 15000]], cr: [["cash", 15000]] },
  { no: 3, date: "2026-04-04", dr: [["purch", 40000]], cr: [["malabar", 40000]] },
  { no: 4, date: "2026-04-05", dr: [["kumar", 60000]], cr: [["sales", 60000]] },
  { no: 5, date: "2026-04-06", dr: [["bank", 10000]], cr: [["kumar", 10000]] },
  { no: 6, date: "2026-04-07", dr: [["malabar", 20000]], cr: [["bank", 20000]] },
  { no: 7, date: "2026-04-08", dr: [["comp", 55000]], cr: [["bank", 55000]] },
  { no: 8, date: "2026-04-09", dr: [["charges", 590]], cr: [["bank", 590]] },
  { no: 9, date: "2026-04-10", dr: [["kerala", 59000]], cr: [["sales", 50000], ["cgst", 4500], ["sgst", 4500]], taxable: 50000, gst: 9000 },
  { no: 10, date: "2026-04-11", dr: [["blr", 23600]], cr: [["sales", 20000], ["igst", 3600]], taxable: 20000, gst: 3600 },
  { no: 11, date: "2026-04-12", dr: [["bank", 590]], cr: [["charges", 590]] },   // reversal of #8
];

export const LINES: BookLine[] = VOUCHERS.flatMap(v => [
  ...v.dr.map(([a, amt]) => ({ account_id: a, dr: amt, cr: 0, date: v.date })),
  ...v.cr.map(([a, amt]) => ({ account_id: a, dr: 0, cr: amt, date: v.date })),
]);

const FY = ["2026-04-01", "2027-03-31"] as const;
const tb = () => buildTrialBalance(ACCOUNTS, LINES, ...FY);
const bal = (id: string) => tb().find(r => r.id === id)?.balance ?? 0;

test("Step 0: every voucher passes the posting engine's balance check", () => {
  for (const v of VOUCHERS) {
    const lines = [...v.dr.map(([a, n]) => ({ accountId: a, dr: n, cr: 0 })), ...v.cr.map(([a, n]) => ({ accountId: a, dr: 0, cr: n }))];
    assert.doesNotThrow(() => validateEntry(lines, v.date), `voucher #${v.no}`);
  }
});

test("Step 0: journal total ₹3,08,780", () => {
  assert.equal(LINES.reduce((s, l) => s + l.dr, 0), 308780);
  assert.equal(LINES.reduce((s, l) => s + l.cr, 0), 308780);
});

test("Step 0: trial balance agrees — ₹2,42,600 by ledger; ₹2,17,600 with customers netted (audit's control-ledger view)", () => {
  const rows = tb();
  const dr = rows.reduce((s, r) => s + r.dr, 0), cr = rows.reduce((s, r) => s + r.cr, 0);
  assert.equal(dr, cr);
  assert.equal(dr, 242600, "per-ledger TB: ABC Traders' ₹25,000 advance is its own credit balance");
  const debtors = ["abc", "kumar", "kerala", "blr"];
  const net = rows.filter(r => debtors.includes(r.id)).reduce((s, r) => s + r.balance, 0);
  const others = rows.filter(r => !debtors.includes(r.id));
  const drN = others.reduce((s, r) => s + r.dr, 0) + Math.max(net, 0), crN = others.reduce((s, r) => s + r.cr, 0) + Math.max(-net, 0);
  assert.equal(drN, 217600); assert.equal(crN, 217600);
});

test("Step 0: Sales ₹1,30,000 · Gross profit ₹90,000 · Net profit ₹75,000", () => {
  const pl = buildPL(tb());
  assert.equal(pl.revenue, 130000);
  assert.equal(pl.grossProfit, 90000);
  assert.equal(pl.netProfit, 75000);
});

test("Step 0: Bank −₹40,000 and Cash −₹15,000 (signed, never absolute)", () => {
  assert.equal(bal("bank"), -40000);
  assert.equal(bal("cash"), -15000);
  const bs = buildBS(tb(), buildPL(tb()).netProfit);
  const shown = (id: string) => statementAmount(bs.currentAssets.find(r => r.id === id)!);
  assert.equal(shown("bank"), -40000);
  assert.equal(shown("cash"), -15000);
  assert.equal(bs.difference, 0, "balance sheet balances");
});

test("Step 0: receivables by party — Kumar 50,000 · Kerala 59,000 · Bengaluru 23,600 · ABC −25,000 (advance) · total 1,07,600", () => {
  const by = (id: string) => bal(id);
  assert.deepEqual([by("kumar"), by("kerala"), by("blr"), by("abc")], [50000, 59000, 23600, -25000]);
  assert.equal(by("kumar") + by("kerala") + by("blr") + by("abc"), 107600);
});

test("Step 0: output GST ₹12,600 on taxable sales ₹70,000 (not ₹1,30,000)", () => {
  const gst = -(bal("cgst") + bal("sgst") + bal("igst"));
  assert.equal(gst, 12600);
  assert.equal(VOUCHERS.reduce((s, v) => s + (v.taxable ?? 0), 0), 70000);
});
