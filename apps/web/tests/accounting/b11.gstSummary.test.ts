// B11 — taxable sales only count entries that charged GST (Step 0 book: ₹70,000 taxable of ₹1,30,000 sales)
import { test } from "node:test";
import assert from "node:assert/strict";
import { gstSummary, classifySale } from "../../src/lib/gstSummary";

const step0Sales = [
  { lines: [{ account: "Kumar Traders", dr: 60000, cr: 0 }, { account: "Sales", dr: 0, cr: 60000 }] },
  { lines: [{ account: "Kerala Retail Co", dr: 59000, cr: 0 }, { account: "Sales", dr: 0, cr: 50000 }, { account: "Output CGST", dr: 0, cr: 4500 }, { account: "Output SGST", dr: 0, cr: 4500 }] },
  { lines: [{ account: "Bengaluru Electricals", dr: 23600, cr: 0 }, { account: "Sales", dr: 0, cr: 20000 }, { account: "Output IGST", dr: 0, cr: 3600 }] },
];

test("B11: taxable sales ₹70,000 of ₹1,30,000 total; output GST ₹12,600", () => {
  const s = gstSummary(step0Sales);
  assert.equal(s.total_sales, 130000);
  assert.equal(s.taxable_sales, 70000);
  assert.equal(s.non_gst_sales, 60000);
  assert.equal(s.output_tax, 12600);
  assert.deepEqual([s.cgst_payable, s.sgst_payable, s.igst_payable], [4500, 4500, 3600]);
});

test("B11: a sale marked 0% / exempt is nil-exempt, not taxable or non-GST", () => {
  assert.equal(classifySale({ lines: [{ account: "Sales", dr: 0, cr: 5000 }], metadata: { gst: { applicable: true, rate: 0 } } }), "nil_exempt");
  assert.equal(classifySale({ lines: [{ account: "Sales", dr: 0, cr: 5000 }] }), "non_gst");
});

test("taxable value comes from the invoice whatever the income ledger is called; GST journals are kept apart", () => {
  const s = gstSummary([
    { lines: [{ account: "ACME INDUSTRIES", dr: 11800, cr: 0 }, { account: "ACCOUNTS FINALISATION", dr: 0, cr: 10000 }, { account: "CGST", dr: 0, cr: 900 }, { account: "SGST", dr: 0, cr: 900 }] },
    // Credit note reverses it
    { lines: [{ account: "AUDIT FEE", dr: 1000, cr: 0 }, { account: "CGST", dr: 90, cr: 0 }, { account: "SGST", dr: 90, cr: 0 }, { account: "ACME INDUSTRIES", dr: 0, cr: 1180 }] },
    // GST journal: tax moved between tax ledgers / bank — not a sale
    { lines: [{ account: "CGST", dr: 0, cr: 5000 }, { account: "GST Payable", dr: 5000, cr: 0 }] },
  ]);
  assert.equal(s.taxable_sales, 9000);
  assert.equal(s.output_tax, 1620);
  assert.equal(s.other_tax_movement, 5000);
});

test("one shared CGST/SGST ledger: purchase tax is input credit, not a negative sale", () => {
  const s = gstSummary([
    { type: "sales", lines: [{ account: "ABC Ltd", dr: 11800, cr: 0, accType: "asset" }, { account: "Sales", dr: 0, cr: 10000, accType: "income" }, { account: "CGST", dr: 0, cr: 900, accType: "liability" }, { account: "SGST", dr: 0, cr: 900, accType: "liability" }] },
    { type: "purchase", lines: [{ account: "Raw Material", dr: 5000, cr: 0, accType: "expense" }, { account: "CGST", dr: 450, cr: 0, accType: "liability" }, { account: "SGST", dr: 450, cr: 0, accType: "liability" }, { account: "XYZ Supplier", dr: 0, cr: 5900, accType: "liability" }] },
  ]);
  assert.equal(s.taxable_sales, 10000);
  assert.equal(s.output_tax, 1800);
  assert.equal(s.input_credit, 900);
  assert.equal(s.net_gst_payable, 900);
  assert.equal(s.total_purchases, 5000);
});
