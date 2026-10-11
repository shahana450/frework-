// Sandbox (sandbox.co.in) GST connector. Filing status and ARNs come from the public GST record
// (POST /gst/compliance/public/gstrs/track), so no taxpayer OTP is needed for status.
// Keys live only in server settings: SANDBOX_API_KEY, SANDBOX_API_SECRET (optional SANDBOX_API_BASE for the test host).
import { PortalError, type PortalProvider, type PortalStatusRow } from "./types";

const BASE = () => (process.env.SANDBOX_API_BASE ?? "https://api.sandbox.co.in").replace(/\/$/, "");
let cached: { token: string; until: number } | null = null;

async function accessToken(): Promise<string> {
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
