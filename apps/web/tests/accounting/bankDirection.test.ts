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
