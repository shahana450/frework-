// Deepvue (deepvue.ai) Income-tax connector: ITR filing, e-verification, processing and refund status for a PAN.
// Documented flow (docs.deepvue.ai, "ITR, 26AS & AIS"):
//   POST /v1/authorize                              form-data client_id, client_secret → access_token (24 h)
//   POST /v1/verification/itr/create-client          { username, password } → data.itr_client_id
//   POST /v1/verification/itr/itr-download           { itr_client_id } → data.filed_itrs[] with itr_status[]
// Calls carry "Authorization: Bearer <access_token>" and "x-api-key: <client secret>".
// Deepvue logs in with the taxpayer's Income-tax portal password. FreWork passes it straight through ONCE and never
// stores or logs it; only Deepvue's itr_client_id is kept, encrypted (secretBox).
// Server settings: ERI_PROVIDER=deepvue, DEEPVUE_CLIENT_ID, DEEPVUE_CLIENT_SECRET (optional DEEPVUE_API_BASE).
import { PortalError, type PortalProvider, type PortalStatusRow } from "./types";

const BASE = () => (process.env.DEEPVUE_API_BASE ?? "https://production.deepvue.tech").replace(/\/$/, "");
let cached: { token: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const id = process.env.DEEPVUE_CLIENT_ID, secret = process.env.DEEPVUE_CLIENT_SECRET;
  if (!id || !secret) throw new PortalError("NOT_CONFIGURED", "Deepvue keys aren't set on the server (DEEPVUE_CLIENT_ID, DEEPVUE_CLIENT_SECRET).");
  const form = new FormData(); form.append("client_id", id); form.append("client_secret", secret);
  const r = await fetch(`${BASE()}/v1/authorize`, { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.access_token) throw new PortalError("PROVIDER", "Deepvue sign-in failed. Check the client ID and secret.");
  const exp = Date.parse(d.expiry ?? "");
  cached = { token: d.access_token, until: Math.min(Number.isFinite(exp) ? exp : Infinity, Date.now() + 23 * 3600 * 1000) - 60_000 };
  return cached.token;
}

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, "x-api-key": process.env.DEEPVUE_CLIENT_SECRET ?? "", "Content-Type": "application/json" });

/** Deepvue reply → body, or a clear PortalError. Business errors come back as HTTP 200 with sub_code ≠ SUCCESS. Exported for tests. */
export function checkDeepvue(http: number, body: unknown, when: "link" | "fetch"): Record<string, unknown> {
  const b = (body ?? {}) as { sub_code?: string; message?: string; detail?: unknown; data?: unknown };
  const detail = typeof b.detail === "string" ? b.detail : "";
  if (http === 401 || http === 403) { cached = null; throw new PortalError("PROVIDER", "Deepvue refused the request — check the keys and that ITR APIs are on your plan."); }
  if (/INACTIVE CLIENT/i.test(detail) || (when === "fetch" && /client id/i.test(b.message ?? ""))) throw new PortalError("SESSION_EXPIRED", "The Income-tax link has expired — connect again with the portal password.");
  if (http === 422 || b.sub_code === "INVALID_INPUT") {
    if (when === "link") throw new PortalError("OTP_INVALID", "The Income-tax portal didn't accept that PAN and password.");
    throw new PortalError("INVALID", b.message ?? "Deepvue couldn't read that request.");
  }
  if (http < 200 || http >= 300) throw new PortalError("PROVIDER", b.message ?? (detail || `Deepvue error ${http}.`));
  if (b.sub_code && b.sub_code !== "SUCCESS") throw new PortalError(when === "link" ? "OTP_INVALID" : "PROVIDER", b.message ?? "The Income-tax portal returned an error.");
  return b as Record<string, unknown>;
}

type FiledItr = {
  itr_id?: number | string; filing_year?: string; acknowledgement_no?: string; itr_form?: string; filing_type?: string; filing_section?: string;
  filing_date?: string; filled_by?: string; itr_status?: { status?: string; date?: string }[];
};

/** "2023-2024" (the financial year; Deepvue's sample shows it filed on 31 Jul 2024 under 139(1)) → "AY 2024-25". */
export function ayOf(filingYear: string): string | null {
  const m = String(filingYear ?? "").match(/^(\d{4})\s*-\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const fy = +m[1];
  return `AY ${fy + 1}-${String(fy + 2).slice(2)}`;
}

/** Stage of an ITR from one status line on the portal. */
function stage(s: string): number {
  if (/processed|refund (has been )?(issued|paid|credited)|intimation/i.test(s)) return 3;
  if (/taken up for processing|in progress|e-?verified/i.test(s) && !/pending for e-?verification/i.test(s)) return 2;
  if (/filed|pending for e-?verification|submitted/i.test(s)) return 1;
  return 0;
}
const STATUS = ["unknown", "filed", "e_verified", "processed"] as const;

/** Deepvue's filed_itrs → ITR and refund rows (one per assessment year; a revised return replaces the original). Exported for tests. */
export function rowsFromDeepvue(body: unknown): PortalStatusRow[] {
  const list = (((body as { data?: { filed_itrs?: FiledItr[] } })?.data?.filed_itrs) ?? []) as FiledItr[];
  const byAy = new Map<string, FiledItr>();
  for (const x of list) {
    const ay = ayOf(x.filing_year ?? "");
    if (!ay) continue;
    const prev = byAy.get(ay);
    if (!prev || (x.filing_date ?? "") >= (prev.filing_date ?? "")) byAy.set(ay, x);
  }
  const rows: PortalStatusRow[] = [];
  for (const [ay, x] of byAy) {
    const history = (x.itr_status ?? []).filter(s => s.status).map(s => ({ status: String(s.status), date: s.date ?? null }));
    const top = history.reduce<{ status: string; date: string | null } | null>((best, s) => !best || stage(s.status) > stage(best.status) || (stage(s.status) === stage(best.status) && (s.date ?? "") > (best.date ?? "")) ? s : best, null);
    const status = top ? STATUS[stage(top.status)] : "filed";
    rows.push({
      kind: "itr", form: "ITR", period: ay, status: status === "unknown" ? "filed" : status, arn: x.acknowledgement_no ?? null, filedOn: x.filing_date ?? null,
      details: { itrForm: x.itr_form ?? null, filingType: x.filing_type ?? null, section: x.filing_section ?? null, processing: top?.status ?? null, history },
    });
    // Refund: the portal's status lines are the only refund signal Deepvue gives (no amount).
    const issued = history.find(s => /refund (has been )?(issued|paid|credited)/i.test(s.status));
    const due = history.find(s => /refund/i.test(s.status) && !/no refund/i.test(s.status));
    if (issued) rows.push({ kind: "refund", form: "Refund", period: ay, status: "issued", filedOn: issued.date, amount: null, details: { text: issued.status } });
    else if (due) rows.push({ kind: "refund", form: "Refund", period: ay, status: "pending", filedOn: due.date, amount: null, details: { text: due.status } });
  }
  return rows.sort((a, b) => b.period.localeCompare(a.period));
}

export function createDeepvueItProvider(): PortalProvider {
  return {
    id: "deepvue", label: "Deepvue (Income tax)", demo: false, credential: "password",
    async requestOtp() {
      return { otpRef: "password", message: "Enter the Income-tax portal password for this PAN. It goes to Deepvue once to link the account and is never stored by FreWork." };
    },
    async verifyOtp(pan, _ref, password) {
      if (!password || password.length < 8) throw new PortalError("OTP_INVALID", "Enter the Income-tax portal password (at least 8 characters).");
      const token = await accessToken();
      const r = await fetch(`${BASE()}/v1/verification/itr/create-client`, { method: "POST", headers: headers(token), body: JSON.stringify({ username: pan, password }) });
      const d = checkDeepvue(r.status, await r.json().catch(() => ({})), "link") as { data?: { itr_client_id?: string } };
      const id = d.data?.itr_client_id;
      if (!id) throw new PortalError("PROVIDER", "Deepvue didn't return a client ID.");
      return { token: String(id), expiresAt: new Date(Date.now() + 365 * 86400000).toISOString() };
    },
    async fetchStatuses(_pan, session) {
      const token = await accessToken();
      const r = await fetch(`${BASE()}/v1/verification/itr/itr-download`, { method: "POST", headers: headers(token), body: JSON.stringify({ itr_client_id: session.token }) });
      return rowsFromDeepvue(checkDeepvue(r.status, await r.json().catch(() => ({})), "fetch"));
    },
  };
}
