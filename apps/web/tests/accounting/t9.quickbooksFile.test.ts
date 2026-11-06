import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickBooksJournal, qbLedger } from "../../src/lib/quickbooksFile";

// QuickBooks Online "Journal" report, as exported to Excel/CSV
const online: unknown[][] = [
  ["Asha Traders"], ["Journal"], ["April 2026"], [],
  ["Date", "Transaction Type", "Num", "Name", "Memo/Description", "Account", "Debit", "Credit"],
  ["01/04/2026", "Expense", "101", "Kerala Power", "April electricity", "Utilities:Electricity", "1,180.00", ""],
  ["", "", "", "", "", "HDFC Bank", "", "1,180.00"],
  ["", "", "", "", "", "", "1,180.00", "1,180.00"],
  [],
  ["02/04/2026", "Invoice", "INV-7", "Kumar Traders", "", "Accounts Receivable (A/R)", "11,800.00", ""],
  ["", "", "", "", "", "Sales", "", "10,000.00"],
  ["", "", "", "", "", "Output GST", "", "1,800.00"],
  ["", "", "", "", "", "", "11,800.00", "11,800.00"],
  ["TOTAL", "", "", "", "", "", "12,980.00", "12,980.00"],
];

test("T9: a QuickBooks Online Journal export becomes balanced entries", () => {
  const r = parseQuickBooksJournal(online);
  assert.equal(r.headerFound, true);
  assert.equal(r.entries.length, 2);
  const [a, b] = r.entries;
  assert.equal(a.date, "2026-04-01");
  assert.deepEqual(a.lines, [{ ledger: "Electricity", dr: 1180, cr: 0 }, { ledger: "HDFC Bank", dr: 0, cr: 1180 }]);
  assert.equal(a.description, "April electricity");
  assert.equal(b.party, "Kumar Traders");
  assert.equal(b.lines.length, 3);
  assert.equal(b.lines.reduce((s, l) => s + l.dr - l.cr, 0), 0);
});

test("T9: QuickBooks Desktop (Trans #) and an unbalanced entry", () => {
  const desktop: unknown[][] = [
    ["Trans #", "Type", "Date", "Num", "Name", "Memo", "Account", "Debit", "Credit"],
    ["12", "Check", "05/04/2026", "501", "Office Rent Co", "Rent", "6100 · Rent Expense", "25000", ""],
    ["12", "", "", "", "", "", "1000 · Checking", "", "25000"],
    ["13", "General Journal", "06/04/2026", "", "", "Bad", "Sales", "", "500"],
    ["13", "", "", "", "", "", "Cash", "400", ""],
  ];
  const r = parseQuickBooksJournal(desktop);
  assert.equal(r.entries.length, 1);
  assert.equal(r.unbalanced, 1);
  assert.deepEqual(r.entries[0].lines.map(l => l.ledger), ["Rent Expense", "Checking"]);
});

test("T9: the same file gives the same ids (re-import adds nothing)", () => {
  assert.deepEqual(parseQuickBooksJournal(online).entries.map(e => e.external_id), parseQuickBooksJournal(online).entries.map(e => e.external_id));
  assert.equal(qbLedger("Expenses:Office Supplies"), "Office Supplies");
});
