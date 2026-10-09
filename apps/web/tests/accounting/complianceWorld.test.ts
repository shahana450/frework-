import { test } from "node:test";
import assert from "node:assert/strict";
import { worldDueDates } from "../../src/lib/complianceWorld";

const at = (l: ReturnType<typeof worldDueDates>, title: string) => l.filter(x => x.title === title).map(x => x.due);
const base = { taxRegistered: true, payroll: true, wht: true };

test("GCC calendars", () => {
  const ae = worldDueDates("2026-10-04", { ...base, country: "AE" });
  assert.ok(at(ae, "VAT return & payment").includes("2026-10-28"), "Q3 VAT due 28 Oct");
  assert.ok(at(worldDueDates("2026-09-01", { ...base, country: "AE" }), "Corporate tax return & payment").includes("2026-09-30"), "Dec-2025 year → 30 Sep 2026");
  const sa = worldDueDates("2026-10-04", { ...base, country: "SA", vatMonthly: true });
  assert.ok(at(sa, "VAT return & payment").includes("2026-10-31"));
  assert.ok(at(sa, "Withholding tax return & payment").includes("2026-10-10"));
  assert.ok(at(sa, "GOSI contributions").includes("2026-10-15"));
  assert.ok(at(worldDueDates("2026-04-01", { ...base, country: "SA" }), "Zakat / income tax return").includes("2026-04-30"), "120 days after 31 Dec");
  assert.ok(at(worldDueDates("2026-04-01", { ...base, country: "QA" }), "Income tax return").includes("2026-04-30"));
  assert.ok(at(worldDueDates("2026-10-04", { ...base, country: "QA" }), "Withholding tax payment").includes("2026-10-16"));
  assert.equal(at(worldDueDates("2026-10-04", { ...base, country: "QA" }), "VAT return & payment").length, 0, "Qatar has no VAT");
  assert.ok(at(worldDueDates("2026-10-04", { ...base, country: "OM" }), "VAT return & payment").includes("2026-10-30"), "30 days after 30 Sep");
  assert.ok(at(worldDueDates("2026-04-01", { ...base, country: "KW" }), "Income tax declaration").includes("2026-04-15"));
});

test("UK, US, Singapore calendars and financial-year start", () => {
  assert.ok(at(worldDueDates("2026-08-01", { ...base, country: "GB" }), "VAT return & payment").includes("2026-08-07"), "Q2 VAT: 1 month + 7 days");
  assert.ok(at(worldDueDates("2026-10-04", { ...base, country: "GB" }), "PAYE & NIC payment").includes("2026-10-22"));
  const gbApr = worldDueDates("2027-01-01", { ...base, country: "GB", fyStart: "04-01" });
  assert.ok(at(gbApr, "Corporation tax payment").includes("2027-01-01"), "year to 31 Mar 2026 → 1 Jan 2027");
  const us = worldDueDates("2026-10-04", { ...base, country: "US" });
  assert.ok(at(us, "Form 941 (payroll tax return)").includes("2026-10-31"));
  assert.ok(at(worldDueDates("2026-12-20", { ...base, country: "US" }), "Federal estimated tax payment").includes("2027-01-15"));
  assert.ok(at(worldDueDates("2026-10-04", { ...base, country: "SG" }), "GST return & payment").includes("2026-10-31"));
  assert.ok(at(worldDueDates("2026-10-04", { ...base, country: "SG" }), "CPF contributions").includes("2026-10-14"));
  assert.ok(at(worldDueDates("2026-10-04", { ...base, country: "SG" }), "Corporate income tax return (Form C / C-S)").includes("2026-11-30"));
  assert.equal(worldDueDates("2026-10-04", { ...base, country: "AE", taxRegistered: false }).some(x => x.kind === "vat"), false, "no VAT when not registered");
});
