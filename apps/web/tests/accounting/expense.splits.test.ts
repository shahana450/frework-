// Several expenses paid together are booked one line per head, not lumped into "Other Expenses"
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntry, type Intent } from "../../src/lib/accountingRules";

const cashDay: Intent = { action: "expense_payment", amount: 10100, payment_mode: "cash", payment_account: "Cash", counter_account: "Wages", party_name: null,
  splits: [{ account: "Wages", amount: 1000 }, { account: "Salary", amount: 2500 }, { account: "Coolie Charges", amount: 1200 }, { account: "Cleaning Charges", amount: 3200 }, { account: "Painting Charges", amount: 2200 }] };

test("one debit per expense head, one cash credit for the total", () => {
  const r = buildEntry(cashDay);
  assert.deepEqual(r.lines.map(l => [l.account, l.debit, l.credit]), [
    ["Wages", 1000, 0], ["Salary", 2500, 0], ["Coolie Charges", 1200, 0], ["Cleaning Charges", 3200, 0], ["Painting Charges", 2200, 0], ["Cash", 0, 10100],
  ]);
  assert.deepEqual(r.missing, []);
});

test("items that don't add up to the stated total: items win, with a warning", () => {
  const r = buildEntry({ ...cashDay, amount: 9999 });
  assert.equal(r.lines.at(-1)?.credit, 10100);
  assert.match(r.warnings.join(" "), /add up to 10100/);
});

test("a single item still uses the normal one-line entry", () => {
  const r = buildEntry({ ...cashDay, amount: 1000, splits: [{ account: "Wages", amount: 1000 }] });
  assert.deepEqual(r.lines.map(l => [l.account, l.debit, l.credit]), [["Wages", 1000, 0], ["Cash", 0, 1000]]);
});
