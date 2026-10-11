// Task 2 — Income tax through Deepvue. Sample reply from docs.deepvue.ai "Download Income Tax Return Documents".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rowsFromDeepvue, ayOf, checkDeepvue, createDeepvueItProvider } from "../../src/lib/portals/deepvue";
import { providerFor, PortalError } from "../../src/lib/portals";
import { markFiled } from "../../src/lib/portals/match";

const SAMPLE = { code: 200, timestamp: 1760438759600, transaction_id: "x", sub_code: "SUCCESS", message: "ITR downloaded successfully.", data: {
  itr_client_id: "c1", pan_no: "ABCPS1234D", filed_itrs: [
    { itr_id: 3314, pan_no: "ABCPS1234D", filing_year: "2024-2025", acknowledgement_no: "1234567890", itr_form: "ITR-2", filing_type: "Original", filing_section: "139(1)", filing_date: "2025-09-06", filled_by: "Self",
      itr_status: [{ status: "ITR processed no demand no refund", date: "2025-09-06" }, { status: "Successfully e-verified", date: "2025-09-06" }, { status: "Pending for e-verification", date: "2025-09-06" }, { status: "ITR Filed", date: "2025-09-06" }], download_link: "https://example/1.json", itr_base64_report: "" },
    { itr_id: 9617, pan_no: "ABCPS1234D", filing_year: "2023-2024", acknowledgement_no: "1234567891", itr_form: "ITR-2", filing_type: "Original", filing_section: "139(1)", filing_date: "2024-07-31", filled_by: "Self",
      itr_status: [{ status: "ITR processed no demand no refund", date: "2024-08-07" }, { status: "No more in PFA, Return is in progress", date: "2024-08-07" }, { status: "ITR TAKEN UP FOR PROCESSING", date: "2024-08-07" }, { status: "Successfully e-verified", date: "2024-07-31" }, { status: "Pending for e-verification", date: "2024-07-31" }, { status: "ITR Filed", date: "2024-07-31" }], download_link: "https://example/2.json", itr_base64_report: "" },
  ] } };

test("filing_year is the financial year: 2023-2024 filed 31 Jul 2024 under 139(1) is AY 2024-25", () => {
  assert.equal(ayOf("2023-2024"), "AY 2024-25");
  assert.equal(ayOf("2024-2025"), "AY 2025-26");
  assert.equal(ayOf("2024-25"), "AY 2025-26");
  assert.equal(ayOf("bad"), null);
});

test("Deepvue sample becomes one processed ITR row per assessment year, with acknowledgement and no refund row", () => {
  const rows = rowsFromDeepvue(SAMPLE);
  assert.deepEqual(rows.map(r => [r.kind, r.period, r.status, r.arn, r.filedOn]), [
    ["itr", "AY 2025-26", "processed", "1234567890", "2025-09-06"],
    ["itr", "AY 2024-25", "processed", "1234567891", "2024-07-31"],
  ]);
  assert.equal(rows[0].details?.itrForm, "ITR-2");
  assert.equal(rows[0].details?.processing, "ITR processed no demand no refund");
});

test("stages: filed → e-verified → processed; refund lines become refund rows", () => {
  const one = (statuses: string[], extra = {}) => rowsFromDeepvue({ sub_code: "SUCCESS", data: { filed_itrs: [{ filing_year: "2025-2026", acknowledgement_no: "A1", filing_date: "2026-07-20", itr_status: statuses.map((s, i) => ({ status: s, date: `2026-07-2${i}` })), ...extra }] } });
  assert.equal(one(["ITR Filed", "Pending for e-verification"])[0].status, "filed");
  assert.equal(one(["ITR Filed", "Successfully e-verified"])[0].status, "e_verified");
  assert.equal(one(["ITR Filed", "Successfully e-verified", "ITR TAKEN UP FOR PROCESSING"])[0].status, "e_verified");
  const refund = one(["ITR Filed", "Successfully e-verified", "ITR processed with refund due", "Refund has been issued"]);
  assert.equal(refund[0].status, "processed");
  assert.deepEqual(refund.filter(r => r.kind === "refund").map(r => [r.status, r.period]), [["issued", "AY 2026-27"]]);
  const pending = one(["ITR Filed", "ITR processed with refund due"]);
  assert.deepEqual(pending.filter(r => r.kind === "refund").map(r => r.status), ["pending"]);
});

test("a revised return replaces the original for the same year", () => {
  const rows = rowsFromDeepvue({ data: { filed_itrs: [
    { filing_year: "2024-2025", acknowledgement_no: "ORIG", filing_date: "2025-07-10", itr_status: [{ status: "ITR Filed", date: "2025-07-10" }] },
    { filing_year: "2024-2025", acknowledgement_no: "REV", filing_type: "Revised", filing_date: "2025-11-02", itr_status: [{ status: "Successfully e-verified", date: "2025-11-02" }] },
  ] } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].arn, "REV");
});

test("Deepvue errors map to clear messages", () => {
  const code = (fn: () => unknown) => { try { fn(); return "none"; } catch (e) { return e instanceof PortalError ? e.code : "other"; } };
  assert.equal(code(() => checkDeepvue(200, SAMPLE, "fetch")), "none");
  assert.equal(code(() => checkDeepvue(422, { error: "Unprocessable Entity", details: [{ field: "password" }] }, "link")), "OTP_INVALID");
  assert.equal(code(() => checkDeepvue(200, { sub_code: "INVALID_INPUT", message: "Invalid itr client id" }, "fetch")), "SESSION_EXPIRED");
  assert.equal(code(() => checkDeepvue(400, { detail: "INACTIVE CLIENT" }, "fetch")), "SESSION_EXPIRED");
  assert.equal(code(() => checkDeepvue(401, { detail: "Not Authenticated" }, "fetch")), "PROVIDER");
  assert.equal(code(() => checkDeepvue(500, { error: "Internal Server Error" }, "fetch")), "PROVIDER");
});

test("ITR due-date reminders turn Filed from Deepvue rows", () => {
  const rows = rowsFromDeepvue(SAMPLE);
  const statuses = rows.map(r => ({ portal: "it", form: r.form, period: r.period, status: r.status, arn: r.arn ?? null, filed_on: r.filedOn ?? null, demo: false }));
  const [it] = markFiled([{ key: "itr-2024", title: "ITR", due: "2025-07-31" } as never], statuses);
  assert.equal(it.filed?.arn, "1234567890");      // FY 2024-25 → AY 2025-26
});

test("provider wiring: ERI_PROVIDER=deepvue for income tax; password asked, never OTP; Sandbox refused for income tax", async () => {
  const prev = { eri: process.env.ERI_PROVIDER, gsp: process.env.GSP_PROVIDER };
  process.env.ERI_PROVIDER = "deepvue";
  const p = providerFor("it");
  assert.equal(p.id, "deepvue"); assert.equal(p.credential, "password"); assert.equal(p.demo, false);
  await assert.rejects(() => p.verifyOtp("ABCPS1234D", "password", "short"), (e: unknown) => e instanceof PortalError && e.code === "OTP_INVALID");
  process.env.ERI_PROVIDER = "sandbox";
  await assert.rejects(() => providerFor("it").requestOtp("ABCPS1234D"), (e: unknown) => e instanceof PortalError && e.code === "NOT_CONFIGURED");
  process.env.GSP_PROVIDER = "deepvue";
  await assert.rejects(() => providerFor("gst").requestOtp("32ABCDE1234F1Z5"), (e: unknown) => e instanceof PortalError && e.code === "NOT_CONFIGURED");
  process.env.ERI_PROVIDER = prev.eri; process.env.GSP_PROVIDER = prev.gsp;
  if (prev.eri === undefined) delete process.env.ERI_PROVIDER;
  if (prev.gsp === undefined) delete process.env.GSP_PROVIDER;
  assert.equal(createDeepvueItProvider().id, "deepvue");
});

test("the password is never stored or logged", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/finance/portals/route.ts"), "utf8");
  // the only use of b.password is handing it to verifyOtp
  assert.equal((route.match(/b\.password/g) ?? []).length, 1);
  assert.ok(!/logAudit\([^)]*password/.test(route));
  const dv = readFileSync(join(process.cwd(), "src/lib/portals/deepvue.ts"), "utf8");
  assert.ok(!/console\.|logAudit/.test(dv), "deepvue.ts must not log");
  assert.match(dv, /return \{ token: String\(id\)/, "only Deepvue's client id becomes the stored session");
});
