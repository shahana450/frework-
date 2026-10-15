// A business without a GSTIN can't claim input GST or charge GST: GST goes into the cost; sales carry none
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntry, type Intent } from "../../src/lib/accountingRules";

const bsnl: Intent = { action: "expense_payment", amount: 1180, payment_mode: "cash", payment_account: "Cash", counter_account: "Telephone & Internet", party_name: "BSNL",
  gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } };

test("registered business: input CGST/SGST split out", () => {
  const r = buildEntry(bsnl, { taxRegistered: true });
  assert.ok(r.lines.some(l => /Input CGST/.test(l.account) && l.debit === 90));
  assert.equal(r.lines.find(l => l.account === "Telephone & Internet")?.debit, 1000);
});

test("unregistered business: whole ₹1,180 is the expense, no GST ledgers", () => {
  const r = buildEntry(bsnl, { taxRegistered: false });
  assert.deepEqual(r.lines.map(l => [l.account, l.debit, l.credit]), [["Telephone & Internet", 1180, 0], ["Cash", 0, 1180]]);
  assert.equal(r.gst.applicable, false);
  assert.match(r.warnings.join(" "), /Not GST-registered.*₹180.*no input credit/);
});

test("unregistered business: '1,000 + 18% GST' purchase costs ₹1,180", () => {
  const r = buildEntry({ ...bsnl, amount: 1000, gst: { applicable: true, rate: 18, inclusive: false, supply: "intra" } }, { taxRegistered: false });
  assert.equal(r.lines.find(l => l.account === "Telephone & Internet")?.debit, 1180);
});

test("unregistered business: a sale carries no output GST", () => {
  const r = buildEntry({ action: "sale", amount: 11800, payment_mode: "cash", payment_account: "Cash", counter_account: "Sales", party_name: "Asha",
    gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } }, { taxRegistered: false });
  assert.ok(!r.lines.some(l => /Output/.test(l.account)));
  assert.equal(r.lines.find(l => l.account === "Sales")?.credit, 11800);
});
