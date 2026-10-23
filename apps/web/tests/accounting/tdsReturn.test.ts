// Quarterly TDS return (Form 140, earlier 26Q) built from the books
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTdsQuarter, quarterRange, natureOf, type TdsJournal } from "../../src/lib/tdsReturn";

test("Indian quarters", () => {
  assert.deepEqual(quarterRange("2026-Q1"), { from: "2026-04-01", to: "2026-06-30", fy: "2026-27" });
  assert.deepEqual(quarterRange("2026-Q4"), { from: "2027-01-01", to: "2027-03-31", fy: "2026-27" });
  assert.equal(quarterRange("2026-Q5"), null);
});

test("nature of payment from the expense ledger", () => {
  assert.equal(natureOf(["Office Rent"]).key, "rent_building");
  assert.equal(natureOf(["Machinery Hire Charges"]).key, "rent_plant");
  assert.equal(natureOf(["Professional Fees"]).key, "professional");
  assert.equal(natureOf(["Freight Charges"]).key, "contract");
  assert.equal(natureOf(["Sundry"]).key, "other");
});

const J: TdsJournal[] = [
  { id: "1", entry_no: "PMT/1", date: "2026-07-05", party_name: "Asha Properties", lines: [
    { account: "Office Rent", dr: 60000, cr: 0 }, { account: "TDS Payable", dr: 0, cr: 6000 }, { account: "Federal Bank", dr: 0, cr: 54000 }] },
  { id: "2", entry_no: "JRN/2", date: "2026-08-10", party_name: "Ravi & Co", lines: [
    { account: "Professional Fees", dr: 50000, cr: 0 }, { account: "Input IGST", dr: 9000, cr: 0 }, { account: "TDS Payable", dr: 0, cr: 5000 }, { account: "Ravi & Co", dr: 0, cr: 54000 }] },
  { id: "3", entry_no: "PMT/3", date: "2026-08-06", party_name: null, lines: [
    { account: "TDS Payable", dr: 6000, cr: 0 }, { account: "Federal Bank", dr: 0, cr: 6000 }] },
  { id: "4", entry_no: "PMT/4", date: "2026-10-02", party_name: "Asha Properties", lines: [
    { account: "Office Rent", dr: 60000, cr: 0 }, { account: "TDS Payable", dr: 0, cr: 6000 }, { account: "Federal Bank", dr: 0, cr: 54000 }] },
];
const pans: Record<string, string> = { "Asha Properties": "AAAPA1234C" };

test("deductions, sections, challans and issues for the quarter", () => {
  const r = buildTdsQuarter("2026-Q2", J, p => pans[p] ?? null)!;
  assert.equal(r.form, "Form 140");
  assert.deepEqual(r.deductions.map(d => [d.party, d.nature.key, d.paid, d.tds, d.rate]), [
    ["Asha Properties", "rent_building", 60000, 6000, 10],
    ["Ravi & Co", "professional", 50000, 5000, 10],
  ]);
  assert.equal(r.totalTds, 11000);
  assert.equal(r.deposited, 6000);
  assert.match(r.issues.map(i => i.text).join(" "), /PAN missing for 1 deductee \(Ravi & Co\)/);
  assert.match(r.issues.map(i => i.text).join(" "), /deposited 6,000/);
});

test("older quarters keep the old form name", () => {
  assert.equal(buildTdsQuarter("2025-Q3", J, () => null)!.form, "Form 26Q");
});
