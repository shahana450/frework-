// Task 3 — Portal Connect data on the GST pages, and GSTR-2B fetched through Sandbox's taxpayer APIs.
// Sample replies follow developer.sandbox.co.in (Verify OTP, Generate OTP, GSTR-2B Document, Track).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkedViaSandbox, filingFor, annualFilingFor, filingForDue, filedLine, type PortalStatus } from "../../src/lib/portals/filings";
import { checkReply, sessionFromVerify, twoBPart, ym2b, rowsFromTrack } from "../../src/lib/portals/sandbox";
import { PortalError } from "../../src/lib/portals/types";
import { dueDates } from "../../src/lib/gstReturns";
import { parse2BJson } from "../../src/lib/itcMatch";

const st = (form: string, period: string, extra: Partial<PortalStatus> = {}): PortalStatus =>
  ({ portal: "gst", form, period, status: "filed", arn: `AA32${period.replace(/\D/g, "")}${form.replace(/\W/g, "")}`, filed_on: "2026-10-18", demo: false, ...extra });

test("only a Sandbox link that is linked counts", () => {
  assert.equal(linkedViaSandbox([{ portal: "gst", provider: "sandbox", status: "linked" }]), true);
  assert.equal(linkedViaSandbox([{ portal: "gst", provider: "demo", status: "linked" }]), false);
  assert.equal(linkedViaSandbox([{ portal: "gst", provider: "sandbox", status: "expired" }]), false);
  assert.equal(linkedViaSandbox([{ portal: "it", provider: "sandbox", status: "linked" }]), false);
  assert.equal(linkedViaSandbox(null), false);
});

test("GSTR-3B for a month: Filed on … (ARN …)", () => {
  const rows = [st("GSTR-3B", "2026-09"), st("GSTR-1", "2026-09"), st("GSTR-3B", "2026-08", { status: "not_filed" })];
  const f = filingFor(rows, "GSTR-3B", "2026-09");
  assert.deepEqual(f, { on: "2026-10-18", arn: "AA32202609GSTR3B" });
  assert.equal(filedLine(f!), "Filed on 18 Oct 2026 (ARN AA32202609GSTR3B)");
  assert.equal(filingFor(rows, "GSTR-3B", "2026-08"), null, "not filed is not filed");
  assert.equal(filingFor([st("GSTR-3B", "2026-09", { demo: true })], "GSTR-3B", "2026-09"), null, "demo never marks filed");
  assert.equal(filedLine({ on: null, arn: null }), "Filed");
});

test("GSTR-9 matches any period inside its financial year", () => {
  assert.ok(annualFilingFor([st("GSTR-9", "2026-03")], "GSTR-9", 2025));            // MMYYYY of March → FY 2025-26
  assert.ok(annualFilingFor([st("GSTR-9", "FY 2025-26")], "GSTR-9", 2025));
  assert.equal(annualFilingFor([st("GSTR-9", "2025-03")], "GSTR-9", 2025), null);   // that's FY 2024-25
  assert.equal(annualFilingFor([st("GSTR-3B", "2026-03")], "GSTR-9", 2025), null);
});

test("Returns centre: due cards carry the tax period and pick up their filing", () => {
  const due = dueDates("2026-10-05", "monthly");
  const g3b = due.find(d => d.form === "GSTR-3B" && d.ret === "2026-09");
  assert.ok(g3b, "September 3B is due in October");
  assert.ok(filingForDue([st("GSTR-3B", "2026-09")], g3b!));
  assert.equal(filingForDue([st("GSTR-3B", "2026-08")], g3b!), null);
  const g9 = dueDates("2026-11-15", "monthly").find(d => d.form === "GSTR-9");
  assert.equal(g9?.ret, "FY:2025");
  assert.ok(filingForDue([st("GSTR-9", "2026-03")], g9!));
  const q = dueDates("2026-10-05", "qrmp").find(d => d.form === "GSTR-1" && d.period.startsWith("Quarter"));
  assert.equal(q?.ret, "2026-09", "quarterly returns are keyed by the quarter's last month");
});

test("Track rows feed the marks end to end", () => {
  const rows = rowsFromTrack({ data: { status_cd: "1", data: { EFiledlist: [{ arn: "AB3209260012345", dof: "20-10-2026", ret_prd: "092026", rtntype: "GSTR3B", status: "Filed", valid: "Y" }] } } });
  const statuses = rows.map(r => ({ portal: "gst", form: r.form, period: r.period, status: r.status, arn: r.arn ?? null, filed_on: r.filedOn ?? null, demo: false }));
  assert.equal(filedLine(filingFor(statuses, "GSTR-3B", "2026-09")!), "Filed on 20 Oct 2026 (ARN AB3209260012345)");
});

test("Sandbox OTP replies: success, portal errors and HTTP errors", () => {
  assert.doesNotThrow(() => checkReply(200, { code: 200, data: { status_cd: "1" } }, "otp"));
  const code = (fn: () => unknown) => { try { fn(); return "none"; } catch (e) { return e instanceof PortalError ? e.code : "other"; } };
  assert.equal(code(() => checkReply(200, { code: 200, data: { status_cd: "0", error: { error_cd: "TEC4001", message: "OTP generation failed as OTP server is down. Contact Support" } } }, "otp")), "PROVIDER");
  assert.equal(code(() => checkReply(200, { code: 200, data: { status_cd: "0", error: { error_cd: "AUTH403", message: "Maximum session allowed for user with this GSP account exceeded." } } }, "otp")), "PROVIDER");
  assert.equal(code(() => checkReply(422, { code: 422, message: "Invalid GSTIN pattern" }, "otp")), "INVALID");
  assert.equal(code(() => checkReply(200, { code: 200, data: { status_cd: "0", error: { error_cd: "AUTH4033", message: "Invalid Session" } } }, "verify")), "OTP_INVALID");
  assert.equal(code(() => checkReply(500, {}, "2b")), "PROVIDER");
});

test("Verify OTP reply becomes a 6-hour session", () => {
  const s = sessionFromVerify({ code: 200, data: { access_token: "eyJhbGciOi.tp", session_expiry: 1712947711000, status_cd: "1", token_expiry: 1712947711000 } });
  assert.equal(s.token, "eyJhbGciOi.tp");
  assert.equal(s.expiresAt, new Date(1712947711000).toISOString());
  assert.throws(() => sessionFromVerify({ data: { status_cd: "1" } }), PortalError);
});

test("GSTR-2B reply parses into ITC Match documents", () => {
  const reply = { code: 200, data: { status_cd: "1", data: { chksum: "x", data: {
    gstin: "24AAACJ3770E1ZZ", rtnprd: "112024", gendt: "14-12-2024", version: "1.0",
    docdata: { b2b: [{ ctin: "24ACRPP7935N1ZO", trdnm: "HITESHKUMAR DWARKADAS PATEL", supfildt: "07-12-2024", supprd: "112024",
      inv: [{ cess: 0, cgst: 2362.5, dt: "01-11-2024", igst: 0, imsStatus: "N", inum: "R22", itcavl: "Y", pos: "24", rev: "N", rsn: "", sgst: 2362.5, txval: 26250, typ: "R", val: 30975 }] }] },
  } } } };
  const part = twoBPart(checkReply(200, reply, "2b"));
  assert.equal(part.files, 0);
  const docs = parse2BJson(part.payload);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].gstin, "24ACRPP7935N1ZO");
  assert.equal(docs[0].docNo, "R22");
  assert.equal(docs[0].taxable, 26250);
  assert.equal(docs[0].cgst + docs[0].sgst, 4725);
});

test("GSTR-2B: large files, not-yet-generated months and month format", () => {
  assert.deepEqual(twoBPart({ data: { status_cd: "3", data: { fc: 3 } } }), { payload: null, files: 3 });
  assert.throws(() => twoBPart({ data: { status_cd: "3", data: {} } }), PortalError);
  assert.throws(() => checkReply(200, { data: { status_cd: "0", error: { error_cd: "RET2B1023", message: "GSTR-2B not available" } } }, "2b"), /isn't available/);
  assert.throws(() => checkReply(200, { data: { status_cd: "0", error: { error_cd: "AUTH4033", message: "Invalid Session" } } }, "2b"), (e: unknown) => e instanceof PortalError && e.code === "SESSION_EXPIRED");
  assert.deepEqual(ym2b("2026-09"), ["2026", "09"]);
  assert.throws(() => ym2b("2026-9"), PortalError);
  assert.throws(() => ym2b("2026-13"), PortalError);
});

test("the taxpayer session is never stored, and the 2B button only shows with Sandbox", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/finance/gst/portal-2b/route.ts"), "utf8");
  assert.ok(!/seal\(|portal_links|session_enc/.test(route), "portal-2b must not persist the taxpayer token");
  assert.ok(/GSP_PROVIDER/.test(route));
  const page = readFileSync(join(process.cwd(), "src/app/finance/gst/itc/page.tsx"), "utf8");
  assert.ok(page.includes('portal.gstProvider === "sandbox"') && page.includes("Fetch 2B from portal"));
  for (const f of ["src/app/finance/gst/3b/page.tsx", "src/app/finance/gst/annual/page.tsx", "src/app/finance/gst/returns/page.tsx"]) {
    assert.ok(readFileSync(join(process.cwd(), f), "utf8").includes("usePortalFilings"), f);
  }
});
