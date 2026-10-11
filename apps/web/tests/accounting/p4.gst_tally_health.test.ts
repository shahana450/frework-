// Phase 4 — GST amounts per return period, no-GSTIN handling, abnormal-balance health rules, Tally GUID matching.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gst3bByMonth, gst3bCash, gstRole } from "../../src/lib/gst3b";
import { dueDates } from "../../src/lib/compliance";
import { matchToTally, tallyGuidFor } from "../../src/lib/tallyMatch";
import { parseTallyVouchers } from "../../src/lib/tallyUtils";

const acc = [{ id: "ocg", name: "Output CGST" }, { id: "osg", name: "Output SGST" }, { id: "icg", name: "Input CGST" }, { id: "isg", name: "Input SGST" }, { id: "sales", name: "Sales" }];

test("each month's GSTR-3B comes from its own period: Sept ₹0, Oct ₹12,600", () => {
  const lines = [
    { account_id: "ocg", dr: 0, cr: 6300, date: "2026-10-05" }, { account_id: "osg", dr: 0, cr: 6300, date: "2026-10-05" },
  ];
  const m = gst3bByMonth(acc, lines);
  assert.equal(gst3bCash(m, "2026-09"), 0);
  assert.equal(gst3bCash(m, "2026-10"), 12600);
  const due = dueDates("2026-10-11", { gst: true, tds: false, payroll: false, audit: false, pt: false, state: "Kerala", amounts: { gstByPeriod: Object.fromEntries([...m].map(([k, v]) => [k, v.cash])) } });
  const sept = due.find(d => d.title.startsWith("GSTR-3B") && /Sep/.test(d.period))!;
  assert.equal(sept.amount, 0, "September's return never shows October's tax");
});

test("unused input credit carries forward to the next month", () => {
  const lines = [
    { account_id: "icg", dr: 5000, cr: 0, date: "2026-08-10" }, { account_id: "isg", dr: 5000, cr: 0, date: "2026-08-10" },
    { account_id: "ocg", dr: 0, cr: 6300, date: "2026-09-05" }, { account_id: "osg", dr: 0, cr: 6300, date: "2026-09-05" },
  ];
  const m = gst3bByMonth(acc, lines);
  assert.equal(gst3bCash(m, "2026-08"), 0);
  assert.equal(gst3bCash(m, "2026-09"), 2600);
});

test("GST ledger roles", () => {
  assert.equal(gstRole("Input IGST")?.role, "input"); assert.equal(gstRole("GST Payable - CGST")?.role, "output");
  assert.equal(gstRole("RCM CGST Payable")?.role, "rcm"); assert.equal(gstRole("Sales"), null);
});

test("no GSTIN → no GST due dates", () => {
  const due = dueDates("2026-10-11", { gst: false, tds: false, payroll: false, audit: false, pt: false, state: "Kerala" });
  assert.equal(due.filter(d => d.kind === "gst").length, 0);
});

test("Tally: three entries numbered JV-0012 are never all matched to the same voucher; GUID wins", () => {
  const own = [
    { id: "a", date: "2026-10-09", amount: 500, ledgers: ["Rent", "HDFC Bank"] },
    { id: "b", date: "2026-10-09", amount: 500, ledgers: ["Rent", "HDFC Bank"] },
    { id: "c", date: "2026-10-09", amount: 700, ledgers: ["Salary", "HDFC Bank"] },
  ];
  const vouchers = [
    { date: "2026-10-09", amount: 500, ledgers: ["Rent", "HDFC Bank"], voucherNumber: "3", remoteId: tallyGuidFor("b") },
    { date: "2026-10-01", amount: 999, ledgers: ["Rent"], voucherNumber: "4" },
  ];
  const f = matchToTally(own, vouchers);
  assert.deepEqual(f.b, { vno: "3", how: "guid" });
  assert.equal(f.a, undefined, "the voucher carrying b's GUID isn't reused for a");
  assert.equal(f.c, undefined, "no voucher → not in Tally (no '✓ In Tally' for 09 Oct)");
});

test("Tally: date + amount + shared ledger when there's no GUID, one voucher per entry", () => {
  const f = matchToTally([{ id: "x", date: "2026-10-01", amount: 1000, ledgers: ["Cash"] }, { id: "y", date: "2026-10-01", amount: 1000, ledgers: ["Cash"] }],
    [{ date: "2026-10-01", amount: 1000, ledgers: ["cash", "Sales"], voucherNumber: "9" }]);
  assert.equal(Object.keys(f).length, 1);
});

test("Tally voucher XML: REMOTEID and GUID are read", () => {
  const v = parseTallyVouchers(`<VOUCHER REMOTEID="frework-abc" VCHTYPE="Payment"><GUID>g-1</GUID><MASTERID>77</MASTERID><DATE>20261009</DATE><VOUCHERNUMBER>3</VOUCHERNUMBER><ALLLEDGERENTRIES.LIST><LEDGERNAME>Rent</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-500</AMOUNT></ALLLEDGERENTRIES.LIST></VOUCHER>`);
  assert.equal(v[0].remoteId, "frework-abc"); assert.equal(v[0].guid, "g-1"); assert.equal(v[0].masterId, "77");
});
