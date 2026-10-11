// Sandbox (sandbox.co.in) GST connector. Filing status and ARNs come from the public GST record
// (POST /gst/compliance/public/gstrs/track), so no taxpayer OTP is needed for status.
// Keys live only in server settings: SANDBOX_API_KEY, SANDBOX_API_SECRET (optional SANDBOX_API_BASE for the test host).
import { PortalError, type PortalProvider, type PortalStatusRow } from "./types";

export const BASE = () => (process.env.SANDBOX_API_BASE ?? "https://api.sandbox.co.in").replace(/\/$/, "");
let cached: { token: string; until: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const key = process.env.SANDBOX_API_KEY, secret = process.env.SANDBOX_API_SECRET;
  if (!key || !secret) throw new PortalError("NOT_CONFIGURED", "Sandbox keys aren't set on the server (SANDBOX_API_KEY, SANDBOX_API_SECRET).");
  const r = await fetch(`${BASE()}/authenticate`, { method: "POST", headers: { "x-api-key": key, "x-api-secret": secret, "x-api-version": "1.0.0", "Content-Type": "application/json" } });
  const d = await r.json().catch(() => ({}));
  const token = d?.data?.access_token ?? d?.access_token;
  if (!r.ok || !token) throw new PortalError("PROVIDER", `Sandbox sign-in failed${d?.message ? `: ${d.message}` : ""}. Check the API key and secret.`);
  cached = { token, until: Date.now() + 23 * 3600 * 1000 };       // tokens last 24 hours
  return token;
}

const FORM: Record<string, string> = { GSTR1: "GSTR-1", GSTR3B: "GSTR-3B", GSTR9: "GSTR-9", GSTR9C: "GSTR-9C", GSTR4: "GSTR-4", CMP08: "CMP-08", GSTR1A: "GSTR-1A", IFF: "IFF" };
/** "082020" → "2020-08"; "01-02-2023" → "2023-02-01" */
export const periodOf = (p: string) => /^\d{6}$/.test(p) ? `${p.slice(2)}-${p.slice(0, 2)}` : p;
export const isoDate = (d: string) => { const m = String(d ?? "").match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

/** Turns Sandbox's EFiledlist into status rows. Exported for tests. */
export function rowsFromTrack(body: unknown): PortalStatusRow[] {
  const b = body as { data?: { data?: { EFiledlist?: { arn?: string; dof?: string; ret_prd?: string; rtntype?: string; status?: string; valid?: string; mof?: string }[] }; status_cd?: string; error?: { error_code?: string; message?: string } | null } };
  const inner = b?.data;
  if (inner?.status_cd === "0") {
    if (inner.error?.error_code === "RET13510") return [];                    // nothing filed for that year
    throw new PortalError("PROVIDER", inner.error?.message ?? "The GST portal returned an error.");
  }
  return (inner?.data?.EFiledlist ?? []).filter(x => x.valid !== "N").map(x => ({
    kind: "return" as const, form: FORM[(x.rtntype ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")] ?? (x.rtntype ?? "Return"),
    period: periodOf(x.ret_prd ?? ""), status: /filed/i.test(x.status ?? "") ? "filed" : (x.status ?? "").toLowerCase() || "unknown",
    arn: x.arn ?? null, filedOn: isoDate(x.dof ?? ""), details: { mode: x.mof ?? null },
  }));
}

export function createSandboxGstProvider(): PortalProvider {
  return {
    id: "sandbox", label: "Sandbox (GSP)", demo: false, noOtp: true,
    async requestOtp() {
      return { otpRef: "public", message: "Connected — filing status and ARNs are read from the public GST record. No OTP needed." };
    },
    async verifyOtp() {
      return { token: "public", expiresAt: new Date(Date.now() + 365 * 86400000).toISOString() };
    },
    async fetchStatuses(gstin, _session, fyStartYear) {
      const token = await accessToken();
      const rows: PortalStatusRow[] = [];
      // This year and the one before, so last year's annual return shows too
      for (const y of [fyStartYear, fyStartYear - 1]) {
        const fy = `FY ${y}-${String(y + 1).slice(2)}`;
        const r = await fetch(`${BASE()}/gst/compliance/public/gstrs/track?financial_year=${encodeURIComponent(fy)}`, {
          method: "POST", headers: { authorization: token, "x-api-key": process.env.SANDBOX_API_KEY!, "x-api-version": "1.0.0", "Content-Type": "application/json" },
          body: JSON.stringify({ gstin }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 401 || r.status === 403) { cached = null; throw new PortalError("PROVIDER", "Sandbox refused the request — check that GST APIs are enabled on your Sandbox plan."); }
        if (r.status === 422) throw new PortalError("INVALID", d?.message ?? "Invalid GSTIN.");
        if (!r.ok) throw new PortalError("PROVIDER", d?.message ?? `Sandbox error ${r.status}.`);
        rows.push(...rowsFromTrack(d));
      }
      return rows;
    },
  };
}

// ── Taxpayer session (OTP) and GSTR-2B ──────────────────────────────────────────────────────────
// Documented flow (developer.sandbox.co.in, "Generate Taxpayer Session"): the taxpayer first sets
// "Enable API Request = Yes" on the GST portal (View Profile → Manage API Access). Then:
//   POST /gst/compliance/tax-payer/otp          { username, gstin }            (authorization: Sandbox JWT)
//   POST /gst/compliance/tax-payer/otp/verify?otp=…  { username, gstin }       → data.access_token, token_expiry (6 hours)
//   GET  /gst/compliance/tax-payer/gstrs/gstr-2b/{year}/{month}[?file_number=n] (authorization: taxpayer token)
// The taxpayer token can also FILE returns, so FreWork never stores it: one OTP, one fetch.

type SbErr = { error_cd?: string; error_code?: string; message?: string } | null | undefined;
type SbBody = { code?: number; message?: string; data?: { status_cd?: string; error?: SbErr; access_token?: string; token_expiry?: number; session_expiry?: number; fc?: number | string; data?: unknown } };

const headers = (authorization: string) => ({ authorization, "x-api-key": process.env.SANDBOX_API_KEY ?? "", "x-api-version": "1.0.0", "Content-Type": "application/json" });

/** Throws a clear PortalError for HTTP failures and GST-portal errors (HTTP 200 with status_cd "0"). Exported for tests. */
export function checkReply(http: number, body: unknown, when: "otp" | "verify" | "2b"): SbBody {
  const b = (body ?? {}) as SbBody;
  if (http === 401 || http === 403) { cached = null; throw new PortalError("PROVIDER", "Sandbox refused the request — check that GST taxpayer APIs are enabled on your Sandbox plan."); }
  if (http === 422 || b.code === 422) throw new PortalError("INVALID", b.message ?? "Invalid GSTIN.");
  if (http < 200 || http >= 300) throw new PortalError("PROVIDER", b.message ?? `Sandbox error ${http}.`);
  const inner = b.data;
  if (inner?.status_cd === "0") {
    const code = inner.error?.error_cd ?? inner.error?.error_code ?? "";
    const msg = inner.error?.message ?? "The GST portal returned an error.";
    if (when === "verify") throw new PortalError("OTP_INVALID", `The GST portal didn't accept the OTP: ${msg}`);
    if (when === "2b" && /^RET2B10(23|16)$/.test(code)) throw new PortalError("INVALID", `GSTR-2B isn't available for that month on the portal yet (${msg}). It's generated on the 14th of the next month.`);
    if (when === "2b" && /^AUTH/.test(code)) throw new PortalError("SESSION_EXPIRED", "The GST portal session ended — send a new OTP.");
    if (when === "otp" && code === "AUTH403") throw new PortalError("PROVIDER", "The GST portal says too many sessions are open for this account. Try again later.");
    throw new PortalError("PROVIDER", `${msg}${code ? ` (${code})` : ""}`);
  }
  return b;
}

/** Taxpayer token and expiry from the Verify OTP reply. Exported for tests. */
export function sessionFromVerify(body: unknown): { token: string; expiresAt: string } {
  const d = (body as SbBody)?.data;
  if (!d?.access_token) throw new PortalError("PROVIDER", "The GST portal didn't return a session.");
  const exp = Number(d.token_expiry ?? d.session_expiry);
  return { token: d.access_token, expiresAt: new Date(Number.isFinite(exp) && exp > 0 ? exp : Date.now() + 6 * 3600 * 1000).toISOString() };
}

/** "2026-09" → ["2026", "09"]. Sandbox examples use /2023/12; the month is sent with two digits like the portal's MMYYYY periods. */
export function ym2b(ym: string): [string, string] {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m || +m[2] < 1 || +m[2] > 12) throw new PortalError("INVALID", "Pick a month for GSTR-2B.");
  return [m[1], m[2]];
}

/** One GSTR-2B reply → its payload for parse2BJson, plus the file count when the portal splits a large 2B (status_cd "3"). */
export function twoBPart(body: unknown): { payload: unknown; files: number } {
  const inner = (body as SbBody)?.data;
  const nested = inner?.data as { fc?: number | string; data?: unknown } | undefined;
  if (inner?.status_cd === "3") {
    const fc = Number(nested?.fc ?? inner.fc);
    if (!Number.isInteger(fc) || fc < 1) throw new PortalError("PROVIDER", "This GSTR-2B is too large to fetch in one go — download it from the GST portal and upload it here.");
    return { payload: null, files: fc };
  }
  return { payload: nested ?? null, files: 0 };
}

export async function sandboxTaxpayerOtp(gstin: string, username: string): Promise<void> {
  const token = await accessToken();
  const r = await fetch(`${BASE()}/gst/compliance/tax-payer/otp`, { method: "POST", headers: headers(token), body: JSON.stringify({ username, gstin }) });
  checkReply(r.status, await r.json().catch(() => ({})), "otp");
}

export async function sandboxTaxpayerVerify(gstin: string, username: string, otp: string): Promise<{ token: string; expiresAt: string }> {
  if (!/^\d{4,8}$/.test(otp)) throw new PortalError("OTP_INVALID", "Enter the OTP the GST portal sent you.");
  const token = await accessToken();
  const r = await fetch(`${BASE()}/gst/compliance/tax-payer/otp/verify?otp=${encodeURIComponent(otp)}`, { method: "POST", headers: headers(token), body: JSON.stringify({ username, gstin }) });
  return sessionFromVerify(checkReply(r.status, await r.json().catch(() => ({})), "verify"));
}

/** Every GSTR-2B payload for the month (several when the portal splits it). Feed each to parse2BJson. */
export async function sandboxGstr2b(taxpayerToken: string, ym: string): Promise<unknown[]> {
  const [y, m] = ym2b(ym);
  const get = async (file?: number) => {
    const r = await fetch(`${BASE()}/gst/compliance/tax-payer/gstrs/gstr-2b/${y}/${m}${file ? `?file_number=${file}` : ""}`, { headers: headers(taxpayerToken) });
    return twoBPart(checkReply(r.status, await r.json().catch(() => ({})), "2b"));
  };
  const first = await get();
  if (!first.files) return first.payload ? [first.payload] : [];
  const parts: unknown[] = [];
  for (let n = 1; n <= first.files; n++) { const p = await get(n); if (p.payload) parts.push(p.payload); }
  return parts;
}
