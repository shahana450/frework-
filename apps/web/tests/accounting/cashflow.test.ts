import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCashFlow } from "../../src/lib/cashFlow";
import type { QJournal } from "../../src/lib/bookQueries";

const accounts = [
  { id: "hdfc", name: "HDFC", type: "asset", sub_type: "bank" },
  { id: "cash", name: "Cash in Hand", type: "asset", sub_type: "cash" },
  { id: "cap", name: "Capital Account", type: "equity", sub_type: "capital" },
  { id: "comp", name: "Computers", type: "asset", sub_type: "fixed_asset" },
  { id: "inc", name: "Indirect Income", type: "income", sub_type: "indirect_income" },
  { id: "sal", name: "Salary Expenses", type: "expense", sub_type: "indirect_expense" },
  { id: "deb", name: "Debtors Control", type: "asset", sub_type: "trade_receivables" },
  { id: "sales", name: "Sales", type: "income", sub_type: null },
];
let n = 0;
const J = (date: string, lines: [string, number, number][]): QJournal => ({ id: `j${++n}`, date, entry_no: `JV-${n}`, narration: "", type: "journal", party_name: null, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });

// The four entries from the Books screen, plus an earlier-year balance and a non-cash sale
const journals = [
  J("2026-03-20", [["hdfc", 5000, 0], ["cap", 0, 5000]]),                 // before the year: opening balance
  J("2026-10-03", [["cash", 100000, 0], ["cap", 0, 100000]]),             // capital in cash
  J("2026-10-03", [["comp", 25000, 0], ["cash", 0, 25000]]),              // laptop for cash
  J("2026-10-03", [["hdfc", 26500, 0], ["inc", 0, 26500]]),               // income into HDFC
  J("2026-10-03", [["sal", 15000, 0], ["hdfc", 0, 15000]]),               // salary from HDFC
  J("2026-10-04", [["deb", 9000, 0], ["sales", 0, 9000]]),                // credit sale: no cash
  J("2026-10-05", [["hdfc", 10000, 0], ["cash", 0, 10000]]),              // cash deposited: transfer, not a flow
];
const cf = computeCashFlow(accounts, journals, "2026-04-01", "2027-03-31");

test("opening + movements = closing, matching the cash & bank ledgers", () => {
  assert.equal(cf.opening, 5000);
  assert.equal(cf.closing, 91500);   // HDFC 5,000 + 26,500 − 15,000 + 10,000 = 26,500; Cash 100,000 − 25,000 − 10,000 = 65,000
  assert.equal(cf.closing, cf.opening + cf.net);
});

test("movements are classified by what was on the other side", () => {
  assert.equal(cf.operating, 11500);   // +26,500 income −15,000 salary
  assert.equal(cf.investing, -25000);  // laptop
  assert.equal(cf.financing, 100000);  // capital
});

test("credit sales and transfers between own accounts are not cash flows", () => {
  assert.ok(!cf.items.some(i => i.name === "Sales" || i.name === "Debtors Control"));
  assert.ok(!cf.items.some(i => i.name === "HDFC" || i.name === "Cash in Hand"));
});
