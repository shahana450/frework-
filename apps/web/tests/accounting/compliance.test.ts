import { test } from "node:test";
import assert from "node:assert/strict";
import { dueDates } from "../../src/lib/compliance";

const pick = (list: ReturnType<typeof dueDates>, title: string) => list.filter(x => x.title === title).map(x => `${x.due}|${x.period}`);

test("monthly GST, TDS and PF dates around 4 Oct 2026", () => {
  const l = dueDates("2026-10-04", { gst: true, tds: true, payroll: true, amounts: { tds: 5000, gst: 12000, pf: 3600 } });
  assert.ok(pick(l, "GSTR-1").includes("2026-10-11|September 2026"));
  assert.ok(pick(l, "GSTR-3B & GST payment").includes("2026-10-20|September 2026"));
  assert.ok(pick(l, "TDS deposit").includes("2026-10-07|September 2026"));
  assert.ok(pick(l, "PF & ESI payment").includes("2026-10-15|September 2026"));
  assert.ok(pick(l, "TDS return").includes("2026-10-31|Q2 (Jul–Sep) FY 2026-27"));
  assert.ok(pick(l, "Advance tax").includes("2026-12-15|FY 2026-27 · 75% cumulative"));
  assert.equal(l.find(x => x.title === "TDS deposit" && x.period === "September 2026")!.amount, 5000);
  assert.equal(l[0].due <= l[l.length - 1].due, true, "sorted by date");
  assert.ok(l.every(x => x.daysLeft >= -7 && x.daysLeft <= 75));
});

test("March TDS is due 30 April; ITR and audit dates; only what applies", () => {
  const apr = dueDates("2027-04-10", { gst: false, tds: true, payroll: false });
  assert.ok(pick(apr, "TDS deposit").includes("2027-04-30|March 2027"));
  assert.equal(pick(apr, "GSTR-1").length, 0, "no GST reminders without a GSTIN");
  assert.equal(pick(apr, "PF & ESI payment").length, 0);
  const jul = dueDates("2027-07-01", { gst: false, tds: false, payroll: false });
  assert.ok(pick(jul, "Income tax return").includes("2027-07-31|FY 2026-27"));
  const sep = dueDates("2027-09-01", { gst: false, tds: false, payroll: false, audit: true });
  assert.ok(pick(sep, "Tax audit report").includes("2027-09-30|FY 2026-27"));
  assert.ok(pick(sep, "Income tax return (audit case)").includes("2027-10-31|FY 2026-27"));
});

test("professional tax follows the business state", () => {
  const base = { gst: false, tds: false, payroll: false, pt: true };
  const kl = dueDates("2026-08-10", { ...base, state: "Kerala", amounts: { pt: 1250 } });
  assert.ok(pick(kl, "Professional tax").includes("2026-08-31|FY 2026-27 · Apr–Sep half-year"));
  assert.equal(kl.find(x => x.title === "Professional tax")!.amount, 1250);
  assert.ok(pick(dueDates("2027-02-01", { ...base, state: "Kerala" }), "Professional tax").includes("2027-02-28|FY 2026-27 · Oct–Mar half-year"));
  assert.ok(pick(dueDates("2026-10-04", { ...base, state: "Karnataka" }), "Professional tax").includes("2026-10-20|September 2026"));
  assert.ok(pick(dueDates("2026-09-01", { ...base, state: "Tamil Nadu" }), "Professional tax").includes("2026-09-30|FY 2026-27 · Apr–Sep half-year"));
  assert.ok(pick(dueDates("2027-03-01", { ...base, state: "Maharashtra" }), "Professional tax")[0].startsWith("2027-03-31|"));
  assert.equal(pick(dueDates("2026-10-04", { ...base, state: "Delhi" }), "Professional tax").length, 0, "no PT in states without it");
  assert.equal(pick(dueDates("2026-08-10", { ...base, pt: false, state: "Kerala" }), "Professional tax").length, 0, "only when it applies");
});
