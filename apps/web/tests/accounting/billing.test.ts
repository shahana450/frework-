// Quick-bill maths for the sales invoice screen
import { test } from "node:test";
import assert from "node:assert/strict";
import { billTotals, calcLine, isInterState, stateFromGstin } from "../../src/lib/billing";

test("GSTIN gives the customer's state; same state is CGST+SGST, other state IGST", () => {
  assert.equal(stateFromGstin("32ABCDE1234F1Z5"), "Kerala");
  assert.equal(stateFromGstin("29ABCDE1234F1Z5"), "Karnataka");
  assert.equal(stateFromGstin("bad"), null);
  assert.equal(isInterState("Kerala", "kerala"), false);
  assert.equal(isInterState("Kerala", "Karnataka"), true);
  assert.equal(isInterState("Kerala", ""), false);
});

test("line maths: exclusive and GST-inclusive prices", () => {
  assert.deepEqual(calcLine({ description: "x", hsn: "", qty: "2", rate: "500", gst: "18" }, false), { taxable: 1000, cgst: 90, sgst: 90, igst: 0, total: 1180 });
  assert.deepEqual(calcLine({ description: "x", hsn: "", qty: "1", rate: "1180", gst: "18", priceIncludesGst: true }, true), { taxable: 1000, cgst: 0, sgst: 0, igst: 180, total: 1180 });
});

test("bill total rounds to the rupee and the pieces still add up", () => {
  const t = billTotals([{ description: "a", hsn: "", qty: "3", rate: "33.33", gst: "5" }, { description: "b", hsn: "", qty: "1", rate: "", gst: "18" }], false);
  assert.equal(t.subtotal, 99.99);
  assert.equal(t.cgst + t.sgst, 5);
  assert.equal(t.exact, 104.99);
  assert.equal(t.total, 105);
  assert.equal(t.roundOff, 0.01);
  assert.equal(Math.round((t.subtotal + t.gst + t.roundOff) * 100) / 100, t.total);
});
