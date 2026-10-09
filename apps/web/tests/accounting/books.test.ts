import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrialBalance, buildPL, buildBS, groupOf } from "../../src/lib/books";
import { inferHead } from "../../src/lib/ledgerHeads";
import { makeFinder } from "../../src/lib/ledgerResolve";

const accounts = [
  { id: "cap", name: "Capital Account", type: "equity", sub_type: "capital" },
  { id: "hdfc", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "cash", name: "Cash in Hand", type: "asset", sub_type: "cash" },
  { id: "sales", name: "Sales", type: "income", sub_type: null },
  { id: "pur", name: "Purchases", type: "purchase", sub_type: null },
  { id: "rent", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
  { id: "bc", name: "Bank Charges", type: "expense", sub_type: null },
  { id: "ocgst", name: "Output CGST", type: "liability", sub_type: "current_liability" },
  { id: "osgst", name: "Output SGST", type: "liability", sub_type: "current_liability" },
  { id: "deb", name: "Debtors Control", type: "asset", sub_type: null },
  { id: "furn", name: "Furniture & Fixtures", type: "asset", sub_type: "fixed_asset" },
  { id: "int", name: "Interest Received", type: "income", sub_type: null },
  { id: "cred", name: "Creditors Control", type: "liability", sub_type: "trade_payables" },
];
const L = (account_id: string, dr: number, cr: number, date: string) => ({ account_id, dr, cr, date });
const FY = ["2026-04-01", "2027-03-31"] as const;
const lines = [
  L("hdfc", 100000, 0, "2025-05-01"), L("cap", 0, 100000, "2025-05-01"),               // prior year capital
  L("cash", 20000, 0, "2025-06-01"), L("sales", 0, 20000, "2025-06-01"),               // prior year sale
  L("deb", 118000, 0, "2026-07-01"), L("sales", 0, 100000, "2026-07-01"),              // credit sale with GST
  L("ocgst", 0, 9000, "2026-07-01"), L("osgst", 0, 9000, "2026-07-01"),
  L("pur", 40000, 0, "2026-07-05"), L("hdfc", 0, 40000, "2026-07-05"),                 // cash purchase
  L("rent", 25000, 0, "2026-08-01"), L("hdfc", 0, 25000, "2026-08-01"),                // rent
  L("bc", 236, 0, "2026-09-15"), L("hdfc", 0, 236, "2026-09-15"),                      // bank charges
  L("furn", 12400, 0, "2026-09-10"), L("hdfc", 0, 12400, "2026-09-10"),                // fixed asset
  L("hdfc", 500, 0, "2026-09-30"), L("int", 0, 500, "2026-09-30"),                     // interest income
  L("rent", 99999, 0, "2027-05-01"), L("hdfc", 0, 99999, "2027-05-01"),                // next year: ignored
];

const tb = buildTrialBalance(accounts, lines, ...FY);
const pl = buildPL(tb);
const bs = buildBS(tb, pl.netProfit);
const bal = (id: string) => tb.find(r => r.id === id)?.balance ?? 0;

test("trial balance debits equal credits", () => {
  const dr = tb.reduce((s, r) => s + r.dr, 0), cr = tb.reduce((s, r) => s + r.cr, 0);
  assert.equal(dr, cr);
  assert.equal(dr, 238500);
});

test("ledger balances carry forward for balance-sheet accounts", () => {
  assert.equal(bal("hdfc"), 22864);         // 100000 - 40000 - 25000 - 236 - 12400 + 500
  assert.equal(bal("cash"), 20000);         // last year's cash sale still in hand
});

test("profit of earlier years moves to capital, not this year's P&L", () => {
  assert.equal(tb.find(r => r.id === "__pl_bf")?.balance, -20000);
  assert.equal(pl.revenue, 100000);
});

test("P&L: purchases above gross profit, other income and expenses below", () => {
  assert.equal(pl.cogs, 40000);
  assert.equal(pl.grossProfit, 60000);
  assert.equal(pl.otherIncome, 500);
  assert.equal(pl.expenses, 25236);
  assert.equal(pl.netProfit, 35264);
});

test("balance sheet balances", () => {
  assert.equal(bs.totalAssets, 173264);
  assert.equal(bs.difference, 0);
  assert.deepEqual(bs.duties.map(r => r.name).sort(), ["Output CGST", "Output SGST"]);
  assert.deepEqual(bs.fixedAssets.map(r => r.name), ["Furniture & Fixtures"]);
});

test("entries after the year end are excluded", () => {
  assert.equal(bal("rent"), 25000);
});

test("a reversal nets the original to zero", () => {
  const withReversal = [...lines, L("rent", 0, 25000, "2026-10-01"), L("hdfc", 25000, 0, "2026-10-01")];
  const t = buildTrialBalance(accounts, withReversal, ...FY);
  assert.equal(t.find(r => r.id === "rent")?.balance ?? 0, 0);
  assert.equal(buildBS(t, buildPL(t).netProfit).difference, 0);
});

test("draft-like lines never enter (only what is passed in is counted)", () => {
  assert.equal(buildTrialBalance(accounts, [], ...FY).length, 0);
});

test("accounts are grouped by sub type, then type, then name", () => {
  assert.equal(groupOf({ id: "x", name: "Purchases", type: "purchase" }), "purchase");
  assert.equal(groupOf({ id: "x", name: "Raw Material Purchase", type: "expense" }), "purchase");
  assert.equal(groupOf({ id: "x", name: "TDS Payable", type: "liability", sub_type: "current_liability" }), "duties");
  assert.equal(groupOf({ id: "x", name: "Term Loan HDFC", type: "liability", sub_type: "long_term_liability" }), "loan");
  assert.equal(groupOf({ id: "x", name: "Laptop", type: "asset" }), "fixed_asset");
  assert.equal(groupOf({ id: "x", name: "Interest Received", type: "income" }), "indirect_income");
});

test("ledger names map to the right head", () => {
  const cases: [string, string | null][] = [
    ["HDFC Bank", "bank"], ["Bank Charges", "indirect_expense"], ["SMS Charges", "indirect_expense"],
    ["Cash in Hand", "cash"], ["Capital Account", "capital"], ["Output CGST", "duties"], ["TDS Payable", "duties"],
    ["Debtors Control", "debtors"], ["Creditors Control", "creditors"], ["Salary Payable", "current_liability"],
    ["Calicut Mercantile Finance Ltd", "loan"], ["Furniture & Fixtures", "fixed_asset"], ["Electricity Charges", "indirect_expense"],
    ["Interest Received", "indirect_income"], ["Muhammed", null],
  ];
  for (const [name, key] of cases) assert.equal(inferHead(name)?.key ?? null, key, name);
});

test("ledger finder matches exact names and close variants, never short fragments", () => {
  const find = makeFinder([{ id: "1", name: "HDFC Bank" }, { id: "2", name: "Rent" }, { id: "3", name: "Office Rent" }]);
  assert.equal(find("hdfc bank")?.id, "1");
  assert.equal(find("HDFC Bank A/c")?.id, "1");
  assert.equal(find("Rent")?.id, "2");
  assert.equal(find("Tax")?.id, undefined);
});
