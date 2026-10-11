import { test } from "node:test";
import assert from "node:assert/strict";
import { setOff, table3, dueDates, cmp08, gstLateFee, gstr9LateFee, gstInterest, advanceTax, eInvoiceApplies, sumTax } from "../../src/lib/gstReturns";
import type { Doc } from "../../src/lib/gstr1";

test("set-off: IGST credit first, CGST never pays SGST, balance in cash", () => {
  const s = setOff({ igst: 1000, cgst: 3000, sgst: 3000, cess: 0 }, { igst: 2500, cgst: 500, sgst: 4000, cess: 0 });
  assert.deepEqual(s.fromIgst, { igst: 1000, cgst: 1500, sgst: 0, cess: 0 });
  assert.deepEqual(s.fromCgst, { igst: 0, cgst: 500, sgst: 0, cess: 0 });
  assert.deepEqual(s.fromSgst, { igst: 0, cgst: 0, sgst: 3000, cess: 0 });
  assert.deepEqual(s.cash, { igst: 0, cgst: 1000, sgst: 0, cess: 0 });
  assert.deepEqual(s.itcLeft, { igst: 0, cgst: 0, sgst: 1000, cess: 0 });
});

test("set-off: leftover CGST credit pays IGST", () => {
  const s = setOff({ igst: 500, cgst: 0, sgst: 0, cess: 0 }, { igst: 0, cgst: 800, sgst: 0, cess: 0 });
  assert.equal(s.fromCgst.igst, 500); assert.equal(sumTax(s.cash), 0); assert.equal(s.itcLeft.cgst, 300);
});

test("table 3.1 and 3.2 from documents", () => {
  const docs: Doc[] = [
    { kind: "invoice", no: "1", date: "2026-09-02", party: "A", gstin: "32ABCDE1234F1Z5", partyState: "Kerala", value: 11800, derived: false, items: [{ rate: 18, taxable: 10000, igst: 0, cgst: 900, sgst: 900 }] },
    { kind: "invoice", no: "2", date: "2026-09-03", party: null, gstin: null, partyState: "Tamil Nadu", pos: "Tamil Nadu", value: 1180, derived: false, items: [{ rate: 18, taxable: 1000, igst: 180, cgst: 0, sgst: 0 }] },
    { kind: "invoice", no: "3", date: "2026-09-04", party: null, gstin: null, partyState: "Kerala", value: 500, derived: false, items: [{ rate: 0, taxable: 500, igst: 0, cgst: 0, sgst: 0 }] },
    { kind: "credit_note", no: "CN1", date: "2026-09-05", party: "A", gstin: "32ABCDE1234F1Z5", partyState: "Kerala", value: 1180, derived: false, items: [{ rate: 18, taxable: 1000, igst: 0, cgst: 90, sgst: 90 }] },
  ];
  const t = table3(docs, "Kerala");
  assert.deepEqual({ taxable: t.a.taxable, igst: t.a.igst, cgst: t.a.cgst }, { taxable: 10000, igst: 180, cgst: 810 });
  assert.equal(t.c.taxable, 500);
  assert.deepEqual(t.inter, [{ pos: "Tamil Nadu", taxable: 1000, igst: 180 }]);
});

test("due dates by scheme", () => {
  const m = dueDates("2026-10-05", "monthly").map(d => `${d.form} ${d.due}`);
  assert.ok(m.includes("GSTR-1 2026-10-11")); assert.ok(m.includes("GSTR-3B 2026-10-20"));
  const q = dueDates("2026-10-05", "qrmp").map(d => `${d.form} ${d.due}`);
  assert.ok(q.includes("GSTR-3B 2026-10-22")); assert.ok(q.includes("PMT-06 2026-11-25"));
  const c = dueDates("2026-10-05", "composition").map(d => `${d.form} ${d.due}`);
  assert.ok(c.includes("CMP-08 2026-10-18"));
});

test("composition tax splits half CGST, half SGST", () => {
  assert.deepEqual(cmp08(500000, 0.01), { turnover: 500000, cgst: 2500, sgst: 2500, total: 5000, rcm: { igst: 0, cgst: 0, sgst: 0, cess: 0 } });
});

test("late fees and interest", () => {
  assert.deepEqual(gstLateFee(10, false, 1e7), { perDay: 50, fee: 500, cap: 2000 });
  assert.equal(gstLateFee(100, false, 1e7).fee, 2000);
  assert.equal(gstLateFee(100, true, 1e7).fee, 500);
  assert.equal(gstr9LateFee(30, 1e7).fee, 1500);
  assert.equal(gstr9LateFee(365, 1e7).fee, 4000);          // capped at 0.04% of ₹1 crore
  assert.equal(gstInterest(100000, 30), 1479.45);
});

test("advance tax schedule and 234C", () => {
  const a = advanceTax(100000, [15000, 30000, 30000, 25000]);
  assert.equal(a.applicable, true); assert.equal(a.interest, 0);
  const b = advanceTax(100000, [0, 0, 0, 100000]);
  assert.equal(b.rows[0].interest, 450); assert.equal(b.rows[1].interest, 1350); assert.equal(b.rows[2].interest, 2250);
  assert.equal(advanceTax(9000).applicable, false);
});

test("e-invoice threshold", () => { assert.equal(eInvoiceApplies(6e7), true); assert.equal(eInvoiceApplies(4e7), false); });
