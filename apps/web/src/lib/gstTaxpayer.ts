// GST taxpayer downloads through Sandbox (a GSP): OTP → 6-hour session → GSTR-1, GSTR-3B and GSTR-2B by month.
// The taxpayer must have switched on API access on the GST portal (My Profile → Manage API Access).
// The OTP goes to the taxpayer's registered mobile and is typed by them; FreWork never handles portal passwords.
import { BASE, accessToken } from "./portals/sandbox";
import { PortalError } from "./portals/types";

export type ReturnKind = "gstr1" | "gstr3b" | "gstr2b";
export const RETURN_LABEL: Record<ReturnKind, string> = { gstr1: "GSTR-1", gstr3b: "GSTR-3B", gstr2b: "GSTR-2B" };

type Gstn = { code?: number; message?: string; data?: { status_cd?: string; error?: { error_cd?: string; message?: string } | null; data?: unknown; access_token?: string; token_expiry?: number; session_expiry?: number; fc?: number } };

const key = () => {
  const k = process.env.SANDBOX_API_KEY;
  if (!k) throw new PortalError("NOT_CONFIGURED", "GST downloads aren't switched on yet (Sandbox API key missing on the server).");
  return k;
};

/** Plain-language message for a GSTN / GSP error code. Exported for tests. */
export function gstnMessage(code?: string, msg?: string): string {
  const c = (code ?? "").toUpperCase();
  if (c === "AUTH4033" || /session/i.test(msg ?? "") && /invalid|expired/i.test(msg ?? "")) return "The GST portal session has ended. Send a new OTP to continue.";
  if (c === "AUTH403") return "Too many open GST sessions for this account. Wait a few minutes and try again.";
  if (c === "TEC4001") return "The GST portal's OTP service is down. Try again later.";
  if (/AUTH4037|OTP/i.test(c) || /otp/i.test(msg ?? "")) return msg ? `OTP not accepted: ${msg}` : "OTP not accepted. Check it and try again.";
  if (/API access/i.test(msg ?? "")) return "API access is off for this GSTIN. On the GST portal: My Profile → Manage API Access → Yes.";
  if (c === "RT-R3BQ1004") return "GSTR-3B isn't available — GSTR-1 for this month hasn't been filed yet.";
  if (/RET1|RTN|not filed|no record|no invoices/i.test(c + " " + (msg ?? ""))) return "Nothing on the portal for this month.";
  return msg || "The GST portal returned an error.";
}

async function call(path: string, init: { method: "GET" | "POST"; token: string; body?: unknown }): Promise<Gstn> {
  const r = await fetch(`${BASE()}${path}`, {
    method: init.method,
    headers: { authorization: init.token, "x-api-key": key(), "x-api-version": "1.0.0", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const d = (await r.json().catch(() => ({}))) as Gstn;
  if (r.status === 422) throw new PortalError("PROVIDER", d.message ?? "The GSTIN or username isn't in the right format.");
  if (!r.ok) throw new PortalError("PROVIDER", d.message ?? `GST service error (${r.status}).`);
  if (d.data?.status_cd === "0") throw new PortalError("PROVIDER", gstnMessage(d.data.error?.error_cd, d.data.error?.message));
  return d;
}

export async function sendOtp(gstin: string, username: string) {
  await call("/gst/compliance/tax-payer/otp", { method: "POST", token: await accessToken(), body: { username, gstin } });
}

export async function verifyOtp(gstin: string, username: string, otp: string) {
  const d = await call(`/gst/compliance/tax-payer/otp/verify?otp=${encodeURIComponent(otp)}`, { method: "POST", token: await accessToken(), body: { username, gstin } });
  if (!d.data?.access_token) throw new PortalError("PROVIDER", "The GST portal didn't open a session. Try again.");
  return { token: d.data.access_token, tokenExpiry: d.data.token_expiry ?? null, sessionExpiry: d.data.session_expiry ?? null };
}

export async function refreshSession(token: string) {
  const d = await call("/gst/compliance/tax-payer/session/refresh", { method: "POST", token });
  if (!d.data?.access_token) throw new PortalError("PROVIDER", "The GST portal session couldn't be renewed. Send a new OTP.");
  return { token: d.data.access_token, tokenExpiry: d.data.token_expiry ?? null, sessionExpiry: d.data.session_expiry ?? null };
}

/** "2026-08" → path parts year "2026", month "08". */
export function periodPath(kind: ReturnKind, period: string): string {
  const [y, m] = period.split("-");
  if (!/^\d{4}$/.test(y ?? "") || !/^\d{2}$/.test(m ?? "")) throw new PortalError("PROVIDER", `Bad period ${period}.`);
  const seg = kind === "gstr1" ? "gstr-1" : kind === "gstr3b" ? "gstr-3b" : "gstr-2b";
  return `/gst/compliance/tax-payer/gstrs/${seg}/${y}/${m}`;
}

/** Downloads one return for one month. GSTR-2B can come in several files (status_cd 3 → file_number 1..fc). */
export async function fetchReturn(kind: ReturnKind, token: string, period: string): Promise<unknown> {
  const path = periodPath(kind, period);
  if (kind === "gstr1") return (await call(`${path}?summary_type=long`, { method: "GET", token })).data?.data;
  if (kind === "gstr3b") return (await call(path, { method: "GET", token })).data?.data;
  const first = await call(path, { method: "GET", token });
  if (first.data?.status_cd !== "3") return first.data?.data;
  const fc = Number((first.data?.data as { fc?: number } | undefined)?.fc ?? first.data?.fc ?? 1);
  const parts: unknown[] = [];
  for (let n = 1; n <= Math.min(fc, 50); n++) parts.push((await call(`${path}?file_number=${n}`, { method: "GET", token })).data?.data);
  return { files: parts };
}

type B2bInv = { inum?: string; dt?: string; val?: number; txval?: number; igst?: number; cgst?: number; sgst?: number; cess?: number; itcavl?: string; rev?: string; pos?: string };
/** GSTR-2B B2B invoices as CSV rows (supplier, invoice, values, ITC available) — readable in Excel. */
export function gstr2bCsv(data: unknown): string {
  const docs = (d: unknown) => ((d as { docdata?: { b2b?: { ctin?: string; trdnm?: string; inv?: B2bInv[] }[] } })?.docdata?.b2b ?? []);
  const blocks = (data as { files?: unknown[] })?.files ?? [data];
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [["Supplier GSTIN", "Supplier name", "Invoice no", "Invoice date", "Invoice value", "Taxable value", "IGST", "CGST", "SGST", "Cess", "ITC available", "Reverse charge", "Place of supply"]];
  for (const b of blocks) for (const s of docs(b)) for (const i of s.inv ?? [])
    rows.push([s.ctin, s.trdnm, i.inum, i.dt, i.val, i.txval, i.igst, i.cgst, i.sgst, i.cess, i.itcavl, i.rev, i.pos].map(v => String(v ?? "")));
  return rows.map(r => r.map(esc).join(",")).join("\n");
}

/** Months from `from` to `to` inclusive, "YYYY-MM". */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while ((y < ty || (y === ty && m <= tm)) && out.length < 24) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
