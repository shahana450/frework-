import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDashboard } from "../../src/lib/dashboard";
import type { QJournal } from "../../src/lib/bookQueries";
import { FINANCE_NAV, isActive } from "../../src/lib/financeNav";

const accounts = [
  { id: "hdfc", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "sbi", name: "SBI Current A/c", type: "asset", sub_type: "bank" },
  { id: "sales", name: "Sales", type: "income", sub_type: null },
  { id: "rent", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
  { id: "deb", name: "Debtors Control", type: "asset", sub_type: "trade_receivables" },
  { id: "cred", name: "Creditors Control", type: "liability", sub_type: "trade_payables" },
  { id: "pur", name: "Purchases", type: "expense", sub_type: "direct_expense" },
  { id: "ocgst", name: "Output CGST", type: "liability", sub_type: "current_liability" },
  { id: "susp", name: "Suspense A/c", type: "asset", sub_type: null },
];
let n = 0;
const J = (date: string, party: string | null, lines: [string, number, number][]): QJournal =>
  ({ id: `j${++n}`, date, entry_no: `JV-${n}`, narration: `entry ${n}`, type: "journal", party_name: party, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });

const journals = [
  J("2026-06-01", "Rahul", [["deb", 50000, 0], ["sales", 0, 50000]]),               // old unpaid sale
  J("2026-09-02", null, [["hdfc", 30000, 0], ["sales", 0, 30000]]),
  J("2026-09-05", "ABC", [["pur", 10000, 0], ["cred", 0, 10000]]),
  J("2026-10-01", null, [["rent", 12000, 0], ["sbi", 0, 12000]]),                    // SBI goes negative
  J("2026-10-02", "Meera", [["deb", 9000, 0], ["sales", 0, 8000], ["ocgst", 0, 1000]]),
  J("2026-10-03", null, [["susp", 500, 0], ["hdfc", 0, 500]]),
  J("2027-05-01", null, [["rent", 999, 0], ["hdfc", 0, 999]]),                       // after today: ignored
];
const fy = { from: "2026-04-01", to: "2027-03-31", label: "FY 2026-27" };
const d = computeDashboard(accounts, journals, "2026-10-25", fy, { pendingReview: 3, drafts: 0, business: { gstin: "32ABCDE1234F1Z5", state: "Kerala" } });

test("headline figures match the ledger", () => {
  assert.equal(d.cash, 17500);          // HDFC 29,500 + SBI −12,000
  assert.equal(d.receivables, 59000);
  assert.equal(d.payables, 10000);
  assert.equal(d.revenue, 88000);
  assert.equal(d.expenses, 22000);
  assert.equal(d.profit, 66000);
  assert.equal(d.monthRevenue, 8000);
  assert.equal(d.monthProfit, -4000);
  assert.equal(d.lastMonthProfit, 20000);
});

test("alerts are raised only from real conditions", () => {
  const text = d.alerts.map(a => a.text).join(" | ");
  assert.match(text, /3 uploaded items are waiting/);
  assert.match(text, /SBI Current A\/c shows a credit balance of ₹12,000/);
  assert.match(text, /Rahul owes ₹50,000 with no activity for 146 days/);
  assert.match(text, /₹500 is sitting in Suspense/);
  assert.match(text, /GST payable for Oct 2026 so far: ₹1,000/);
  assert.match(text, /Profit for Oct 2026/);
  assert.ok(!/HDFC Bank shows a credit/.test(text));
  assert.ok(!/drafts?/.test(text));
});

test("recent transactions are newest first and never future-dated", () => {
  assert.equal(d.recent[0].entry_no, "JV-6");
  assert.equal(d.recent.length, 6);
  assert.ok(d.recent.every(r => r.date <= "2026-10-25"));
});

test("no alerts on clean books", () => {
  const clean = computeDashboard(accounts, [J("2026-10-02", null, [["hdfc", 1000, 0], ["sales", 0, 1000]])], "2026-10-10", fy, { pendingReview: 0, drafts: 0 });
  assert.deepEqual(clean.alerts, []);
});

test("every menu item points at a finance page and Simple view keeps the essentials", () => {
  const all = FINANCE_NAV.flatMap(g => g.items);
  assert.ok(all.every(i => i.href.startsWith("/finance")));
  assert.equal(new Set(all.map(i => i.href)).size, all.length);
  const simple = all.filter(i => !i.accountant).map(i => i.label);
  for (const must of ["Dashboard", "FreBook", "New Invoice", "Receivables", "Expenses", "Banking", "Profit & Loss", "Balance Sheet", "Review Queue"]) assert.ok(simple.includes(must), must);
});

test("menu highlights the right item, including report tabs", () => {
  const item = (label: string) => FINANCE_NAV.flatMap(g => g.items).find(i => i.label === label)!;
  assert.ok(isActive(item("Dashboard"), "/finance", ""));
  assert.ok(!isActive(item("Dashboard"), "/finance/journals", ""));
  assert.ok(isActive(item("Profit & Loss"), "/finance/reports", "?tab=profit_loss"));
  assert.ok(!isActive(item("Balance Sheet"), "/finance/reports", "?tab=profit_loss"));
  assert.ok(isActive(item("Banking"), "/finance/banking", ""));
  assert.ok(!isActive(item("Banking"), "/finance/banking/import", ""));
  assert.ok(isActive(item("Import Statement"), "/finance/banking/import", ""));
  assert.ok(isActive(item("Analysis & Audit"), "/finance/audit", ""));
  assert.ok(!isActive(item("Analysis & Audit"), "/finance/audit/gst-recon", ""));
});
