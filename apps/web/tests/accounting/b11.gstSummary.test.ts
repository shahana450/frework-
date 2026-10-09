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
