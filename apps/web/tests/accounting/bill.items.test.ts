// A supplier bill is booked item by item: stock to Purchases, durable items to fixed assets, the rest to expenses
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntry, type Intent } from "../../src/lib/accountingRules";

// TechSupply-style bill: laptop stands (asset), accessories (expense), setup of the stands (asset), IGST 18%, on credit
const bill: Intent = {
  action: "asset_purchase", amount: 24101.5, payment_mode: "credit", payment_account: null, counter_account: null, party_name: "TechSupply Solutions Pvt. Ltd.",
  gst: { applicable: true, rate: 18, inclusive: false, supply: "inter" },
  items: [
    { account: "Computers", kind: "asset", taxable: 12000, rate: 18 },
    { account: "Computer Accessories", kind: "expense", taxable: 4425, rate: 18 },
    { account: "Computers", kind: "asset", taxable: 4000, rate: 18 },
  ],
};

test("one debit per ledger, IGST per line, supplier credited with the bill total", () => {
  const r = buildEntry(bill);
  assert.deepEqual(r.lines.map(l => [l.account, l.debit, l.credit]), [
    ["Computers", 16000, 0], ["Computer Accessories", 4425, 0], ["Input IGST", 3676.5, 0], ["TechSupply Solutions Pvt. Ltd.", 0, 24101.5],
  ]);
  assert.equal(r.lines.find(l => l.account === "Computers")?.suggested_type, "asset");
  assert.deepEqual(r.missing, []);
  assert.equal(r.gst.igst, 3676.5);
});

test("same state: CGST + SGST per line; different rates add up", () => {
  const r = buildEntry({ ...bill, amount: 1180 + 1050, gst: { applicable: true, rate: 18, inclusive: false, supply: "intra" },
    items: [{ account: "Purchases", kind: "purchase", taxable: 1000, rate: 18 }, { account: "Printing & Stationery", kind: "expense", taxable: 1000, rate: 5 }] });
  assert.deepEqual(r.lines.map(l => [l.account, l.debit, l.credit]), [
    ["Purchases", 1000, 0], ["Printing & Stationery", 1000, 0], ["Input CGST", 115, 0], ["Input SGST", 115, 0], ["TechSupply Solutions Pvt. Ltd.", 0, 2230],
  ]);
});

test("paise rounding on the bill goes to Round Off", () => {
  const r = buildEntry({ ...bill, amount: 24102 });
  assert.deepEqual(r.lines.find(l => l.account === "Round Off") && [r.lines.find(l => l.account === "Round Off")!.debit], [0.5]);
  assert.equal(r.lines.at(-1)?.credit, 24102);
});
