// Withdrawal / deposit settled by the running balance
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixDirections } from "../../src/lib/bankDirection";
import { isCashBankAccount } from "../../src/lib/journalRules";

test("swapped rows are corrected from the balance; consistent rows are left alone", () => {
  const rows = [
    { debit: 0, credit: 0, balance: 10000 },
    { debit: 500, credit: 0, balance: 10500 },     // read as a withdrawal, balance rose → deposit
    { debit: 0, credit: 2000, balance: 8500 },     // read as a deposit, balance fell → withdrawal
    { debit: 300, credit: 0, balance: 8200 },      // right already
  ];
  const r = fixDirections(rows);
  assert.equal(r.fixed, 2);
  assert.deepEqual(r.rows.map(x => [x.debit, x.credit]), [[0, 0], [0, 500], [2000, 0], [300, 0]]);
});

test("no balance column: rows are kept as read", () => {
  const rows = [{ debit: 500, credit: 0 }, { debit: 0, credit: 200 }];
  assert.deepEqual(fixDirections(rows).rows, rows);
});

test("Bank Charges is never a bank account", () => {
  assert.equal(isCashBankAccount({ name: "Bank Charges", type: "expense", sub_type: "indirect_expense" } as never), false);
  assert.equal(isCashBankAccount({ name: "Bank Charges", type: "asset", sub_type: null } as never), false);
  assert.equal(isCashBankAccount({ name: "HDFC Bank", type: "asset", sub_type: "bank" } as never), true);
});

import { rebuildByBalance, balanceBreaks } from "../../src/lib/bankDirection";
test("Federal Bank PDF: amounts in one column and balances in the wrong cell are rebuilt from the running balance", () => {
  // As read: every amount under Withdrawals; some balances landed in the Deposits cell; one balance missing
  const read = [
    { debit: 400000, credit: 0, balance: 410265 },        // deposit
    { debit: 400000, credit: 0, balance: 810265 },        // deposit
    { debit: 340000, credit: 0, balance: 470265 },        // withdrawal
    { debit: 237331, credit: 10055, balance: 0 },         // withdrawal; balance in the deposit cell
    { debit: 87300, credit: 97355, balance: 0 },          // deposit; balance in the deposit cell
    { debit: 1683, credit: 0, balance: 95672 },           // charge
  ];
  // the 4th row's previous balance: 470265 − 222879 is skipped here, so use a statement where it chains
  read.splice(3, 0, { debit: 222879, credit: 0, balance: 247386 });
  const r = rebuildByBalance(read, 10265).rows;
  assert.deepEqual(r.map(x => [x.debit, x.credit, x.balance]), [[0, 400000, 410265], [0, 400000, 810265], [340000, 0, 470265], [222879, 0, 247386], [237331, 0, 10055], [0, 87300, 97355], [1683, 0, 95672]]);
  assert.equal(balanceBreaks(r, 10265), 0);
  assert.equal(balanceBreaks(read, 10265) > 0, true);
});
