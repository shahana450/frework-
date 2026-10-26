// A sales invoice read line by line (Sales per item, output GST per line) and the "is this our document?" check
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntry, type Intent } from "../../src/lib/accountingRules";
import { documentNotOurs } from "../../src/lib/intentEngine";

// The electronics invoice: three items at 18% (inter-state) and a laptop with no GST, received in full in the bank
const sale: Intent = {
  action: "sale", amount: 71451.42, payment_mode: "bank", payment_account: "Axis Bank", counter_account: null, party_name: "raman",
  gst: { applicable: true, rate: 18, inclusive: false, supply: "inter" },
  items: [
    { account: "Sales", kind: "sale", taxable: 3538.82, rate: 18, description: "Mixer" },
    { account: "Sales", kind: "sale", taxable: 15338.82, rate: 18, description: "Refrigerator" },
    { account: "Sales", kind: "sale", taxable: 3538.82, rate: 18, description: "Power bank" },
    { account: "Sales", kind: "sale", taxable: 45000, rate: 0, description: "Laptop" },
  ],
};

test("sales per item, IGST only on the taxed lines, bank debited with the invoice total", () => {
  const r = buildEntry(sale);
  const out = r.lines.filter(l => l.account === "Output IGST").reduce((s, l) => s + l.credit, 0);
  assert.equal(r.lines.filter(l => l.account === "Sales").length, 4);
  assert.equal(Math.round(r.lines.filter(l => l.account === "Sales").reduce((s, l) => s + l.credit, 0) * 100) / 100, 67416.46);
  assert.equal(Math.round(out * 100) / 100, 4034.97);
  const dr = r.lines.reduce((s, l) => s + l.debit, 0), cr = r.lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(Math.round(dr * 100), Math.round(cr * 100));
  assert.equal(r.lines[0].account, "Axis Bank");
  assert.ok(Math.abs(dr - 71451.42) <= 1, `total ${dr}`);
});

test("a document between two other parties is flagged; ours is not", () => {
  const biz = { name: "REVALGI", gstin: "32ABCDE1234F1Z5" };
  assert.match(documentNotOurs({ seller_name: "Ravi kumar", buyer_name: "raman", seller_gstin: null, buyer_gstin: "GST34567" }, biz) ?? "", /Ravi kumar to raman/);
  assert.equal(documentNotOurs({ seller_name: "Revalgi Pvt Ltd", buyer_name: "raman" }, biz), null);
  assert.equal(documentNotOurs({ seller_name: "X", buyer_name: "Y", seller_gstin: "29AAAAA0000A1Z5", buyer_gstin: "32ABCDE1234F1Z5" }, biz), null);
  assert.equal(documentNotOurs({ seller_name: "Ravi kumar", buyer_name: null }, biz), null);   // one side unknown: don't guess
});
