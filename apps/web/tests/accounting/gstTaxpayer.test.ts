// GST portal downloads: request paths, month ranges, GSTR-2B invoice list, error wording
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodPath, monthsBetween, gstr2bCsv, gstnMessage } from "../../src/lib/gstTaxpayer";

test("paths and month ranges", () => {
  assert.equal(periodPath("gstr2b", "2026-08"), "/gst/compliance/tax-payer/gstrs/gstr-2b/2026/08");
  assert.equal(periodPath("gstr3b", "2026-12"), "/gst/compliance/tax-payer/gstrs/gstr-3b/2026/12");
  assert.deepEqual(monthsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(monthsBetween("2026-05", "2026-04"), []);
});

test("GSTR-2B invoices become CSV rows, across split files", () => {
  const part = (n: string) => ({ docdata: { b2b: [{ ctin: "32AAACA1234A1Z5", trdnm: "ABC, Traders", inv: [{ inum: n, dt: "05-08-2026", val: 1180, txval: 1000, igst: 0, cgst: 90, sgst: 90, cess: 0, itcavl: "Y", rev: "N", pos: "32" }] }] } });
  const csv = gstr2bCsv({ files: [part("A1"), part("A2")] }).split("\n");
  assert.equal(csv.length, 3);
  assert.equal(csv[1], '32AAACA1234A1Z5,"ABC, Traders",A1,05-08-2026,1180,1000,0,90,90,0,Y,N,32');
});

test("portal errors in plain words", () => {
  assert.match(gstnMessage("AUTH4033"), /session has ended/);
  assert.match(gstnMessage("RT-R3BQ1004"), /GSTR-1 for this month/);
  assert.match(gstnMessage("X", "API access is not enabled"), /Manage API Access/);
});
