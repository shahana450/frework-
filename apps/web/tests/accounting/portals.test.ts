import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoProvider } from "../../src/lib/portals/demo";
import { markFiled } from "../../src/lib/portals/match";
import { dueDates } from "../../src/lib/compliance";

const at = (d: string) => () => new Date(d + "T10:00:00Z");

test("demo GST provider: filed months, pending current, OTP required", async () => {
  const p = createDemoProvider("gst", at("2026-10-15"));
  const otp = await p.requestOtp("32AAKCP2489H1Z7");
  await assert.rejects(p.verifyOtp("32AAKCP2489H1Z7", otp.otpRef, "12"), /6-digit/);
  const s = await p.verifyOtp("32AAKCP2489H1Z7", otp.otpRef, "123456");
  const rows = await p.fetchStatuses("32AAKCP2489H1Z7", s, 2026);
  const g = (form: string, period: string) => rows.find(r => r.form === form && r.period === period);
  assert.equal(g("GSTR-1", "2026-09")!.status, "filed");          // due 11 Oct, filed 10 Oct
  assert.equal(g("GSTR-3B", "2026-09")!.status, "not_filed");     // due 20 Oct, today 15 Oct
  assert.equal(g("GSTR-1", "2026-10"), undefined);                 // current month not due
  assert.ok(rows.some(r => r.kind === "ledger"));
  assert.ok(p.demo);
});

test("filed returns turn due-date reminders into Filed", async () => {
  const items = dueDates("2026-10-05", { gst: true, tds: false, payroll: false });
  const marked = markFiled(items, [
    { portal: "gst", form: "GSTR-1", period: "2026-09", status: "filed", arn: "AA320926123456", filed_on: "2026-10-04", demo: false },
    { portal: "gst", form: "GSTR-3B", period: "2026-09", status: "not_filed", arn: null, filed_on: null, demo: false },
  ]);
  const r1 = marked.find(x => x.key === "gstr1-2026-8")!;
  assert.deepEqual(r1.filed, { on: "2026-10-04", arn: "AA320926123456", demo: false });
  assert.equal(marked.find(x => x.key === "gstr3b-2026-8")!.filed, undefined, "not filed stays a reminder");
});
