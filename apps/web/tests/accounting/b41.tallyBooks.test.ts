// Matching FreWork's books to Tally's: group chain, opening / closing balances, stock-in-hand change
import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerBooksFrom, groupsFrom, groupChain, headKeyFor, drCr, stockFigures } from "../../src/lib/integrations/tallyBooks";

// Shapes as TallyPrime sends them (anonymised)
const GROUPS = `<ENVELOPE><GROUP NAME="SALARY EXPENSE"><PARENT>Indirect Expenses</PARENT></GROUP>
<GROUP NAME="Indirect Expenses"><PARENT>&#4; Primary</PARENT></GROUP>
<GROUP NAME="Bank Accounts"><PARENT>Current Assets</PARENT></GROUP>
<GROUP NAME="Current Assets"><PARENT>&#4; Primary</PARENT></GROUP>
<GROUP NAME="Stock-in-Hand"><PARENT>&#4; Primary</PARENT></GROUP>
<GROUP NAME="Duties &amp; Taxes"><PARENT>Current Liabilities</PARENT></GROUP></ENVELOPE>`;
const LEDGERS = `<ENVELOPE>
<LEDGER NAME="SALARY TO STAFF" RESERVEDNAME=""><PARENT>SALARY EXPENSE</PARENT><OPENINGBALANCE>0.00</OPENINGBALANCE><CLOSINGBALANCE>-868800.00</CLOSINGBALANCE></LEDGER>
<LEDGER NAME="HDFC BANK"><PARENT>Bank Accounts</PARENT><OPENINGBALANCE>-125000.50</OPENINGBALANCE><CLOSINGBALANCE>-98000.00</CLOSINGBALANCE></LEDGER>
<LEDGER NAME="STOCK IN HAND"><PARENT>Stock-in-Hand</PARENT><OPENINGBALANCE>-6892964.00</OPENINGBALANCE><CLOSINGBALANCE>-6154846.00</CLOSINGBALANCE></LEDGER>
<LEDGER NAME="OUTPUT CGST"><PARENT>Duties &amp; Taxes</PARENT><OPENINGBALANCE>4500.00</OPENINGBALANCE><CLOSINGBALANCE>0</CLOSINGBALANCE></LEDGER>
</ENVELOPE>`;

test("ledgers: name, group and Tally-signed balances", () => {
  const l = ledgerBooksFrom(LEDGERS);
  assert.equal(l.length, 4);
  assert.deepEqual(l[1], { name: "HDFC BANK", parent: "Bank Accounts", opening: -125000.5, closing: -98000 });
});

test("a ledger in a sub-group is traced to its primary group", () => {
  const g = groupsFrom(GROUPS);
  assert.deepEqual(groupChain("SALARY EXPENSE", g), ["SALARY EXPENSE", "Indirect Expenses"]);
  assert.equal(headKeyFor("SALARY EXPENSE", g), "indirect_expense");
});

test("the nearest known group wins (Bank Accounts before Current Assets)", () => {
  const g = groupsFrom(GROUPS);
  assert.equal(headKeyFor("Bank Accounts", g), "bank");
  assert.equal(headKeyFor("Duties & Taxes", g), "duties");
  assert.equal(headKeyFor("Stock-in-Hand", g), "stock");
});

test("Tally's negative balance is a debit", () => {
  assert.deepEqual(drCr(-125000.5), { dr: 125000.5, cr: 0 });
  assert.deepEqual(drCr(4500), { dr: 0, cr: 4500 });
});

test("stock: opening, closing and the year's change from Stock-in-Hand", () => {
  const s = stockFigures(ledgerBooksFrom(LEDGERS), groupsFrom(GROUPS));
  assert.deepEqual(s, { ledgers: ["STOCK IN HAND"], opening: 6892964, closing: 6154846, change: 738118 });
});
