// e-Invoice (IRN) and e-Way bill through Sandbox (GSP) to NIC. Each needs the taxpayer's API user — created on
// einvoice1.gst.gov.in / ewaybillgst.gov.in under "API registration" for the GSP — and returns a ~6-hour token.
import { BASE, accessToken } from "./portals/sandbox";
import { PortalError } from "./portals/types";

export type NicKind = "einvoice" | "ewaybill";
type NicErr = { ErrorCode?: string; ErrorMessage?: string };
type Resp = { code?: number; message?: string; data?: Record<string, unknown> & { Status?: number | string; status?: string; status_cd?: string; ErrorDetails?: NicErr[] | null; error?: { error_cd?: string; message?: string; errorCodes?: string } } };

const key = () => {
  const k = process.env.SANDBOX_API_KEY;
  if (!k) throw new PortalError("NOT_CONFIGURED", "e-Invoice isn't switched on yet (Sandbox API key missing on the server).");
  return k;
};

/** Plain message for an NIC failure (both APIs answer HTTP 200 with Status 0). */
export function nicError(d: Resp["data"]): string | null {
  if (!d) return "No answer from the government portal.";
  const failed = d.Status === 0 || d.Status === "0" || d.status === "0" || d.status_cd === "0";
  if (!failed) return null;
  const e = d.ErrorDetails?.[0];
  if (e) return `${e.ErrorMessage ?? "Rejected"}${e.ErrorCode ? ` (code ${e.ErrorCode})` : ""}`;
  if (d.error?.errorCodes) return `The e-way bill portal rejected it (code ${d.error.errorCodes}).`;
  return d.error?.message ?? "The government portal rejected the request.";
}

async function call(path: string, auth: string, body: unknown): Promise<Resp["data"]> {
  const r = await fetch(`${BASE()}${path}`, {
    method: "POST",
    headers: { authorization: auth, "x-api-key": key(), "x-api-version": "1.0.0", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as Resp;
  if (!r.ok) throw new PortalError("PROVIDER", d.message ?? `GST service error (${r.status}).`);
  const err = nicError(d.data);
  if (err) throw new PortalError("PROVIDER", err);
  return d.data;
}

/** Signs in to the e-invoice or e-way bill system with the taxpayer's API user. */
export async function nicLogin(kind: NicKind, gstin: string, username: string, password: string): Promise<{ token: string; expiry: number | null }> {
  const path = kind === "einvoice" ? "/gst/compliance/e-invoice/tax-payer/authenticate?force=true" : "/gst/compliance/e-way-bill/tax-payer/authenticate";
  const d = await call(path, await accessToken(), { username, password, gstin });
  const token = String(d?.access_token ?? "");
  if (!token) throw new PortalError("PROVIDER", "The portal didn't return a session. Check the API username and password.");
  return { token, expiry: Number(d?.expiry) || null };
}

export type IrnResult = { irn: string; ackNo: string; ackDt: string; signedQr: string; ewbNo: string | null; ewbValidTill: string | null };
/** Generates the IRN for an invoice (the standard NIC e-invoice JSON, as built by buildEInvoice). */
export async function generateIrn(token: string, invoice: unknown): Promise<IrnResult> {
  const d = await call("/gst/compliance/e-invoice/tax-payer/invoice", token, invoice);
  const x = (d?.Data ?? d?.data ?? {}) as Record<string, unknown>;
  if (!x.Irn) throw new PortalError("PROVIDER", "The e-invoice portal didn't return an IRN.");
  return { irn: String(x.Irn), ackNo: String(x.AckNo ?? ""), ackDt: String(x.AckDt ?? ""), signedQr: String(x.SignedQRCode ?? ""), ewbNo: x.EwbNo ? String(x.EwbNo) : null, ewbValidTill: x.EwbValidTill ? String(x.EwbValidTill) : null };
}

/** Cancels an IRN (allowed within 24 hours, and not while an e-way bill on it is active). */
export async function cancelIrn(token: string, irn: string, reason: "1" | "2" | "3" | "4", remark: string): Promise<string> {
  const d = await call(`/gst/compliance/e-invoice/tax-payer/invoice/${encodeURIComponent(irn)}/cancel`, token, { Irn: irn, CnlRsn: reason, CnlRem: remark.slice(0, 100) });
  return String(((d?.Data ?? {}) as Record<string, unknown>).CancelDate ?? "");
}

export type EwbResult = { ewbNo: string; ewbDate: string; validUpto: string };
/** Generates an e-way bill. Takes one bill from buildEwayBill (the bulk-upload shape) and renames the fields the API spells differently. */
export async function generateEwb(token: string, bill: Record<string, unknown>): Promise<EwbResult> {
  const { actualFromStateCode, actualToStateCode, transType, userGstin: _u, ...rest } = bill; void _u;
  const body = { ...rest, actFromStateCode: actualFromStateCode, actToStateCode: actualToStateCode, transactionType: transType };
  const d = await call("/gst/compliance/e-way-bill/consignor/bill", token, body);
  const x = (d?.data ?? {}) as Record<string, unknown>;
  if (!x.ewayBillNo) throw new PortalError("PROVIDER", "The e-way bill portal didn't return a number.");
  return { ewbNo: String(x.ewayBillNo), ewbDate: String(x.ewayBillDate ?? ""), validUpto: String(x.validUpto ?? "") };
}
