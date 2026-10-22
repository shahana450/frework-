import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { seal, open as unseal } from "@/lib/portals/secretBox";
import { nicLogin, generateIrn, cancelIrn, generateEwb, type NicKind } from "@/lib/nicApi";
import { logAudit } from "@/lib/audit";
import { PortalError, GSTIN_RE } from "@/lib/portals/types";

// e-Invoice IRN and e-Way bill straight from an invoice, through the GSP.
//   GET  ?business_id&journal_id      → which logins are set up, and what this invoice already has (IRN, e-way bill)
//   POST action=login  { kind, username, password, remember }
//   POST action=irn    { journal_id, invoice }           (invoice = buildEInvoice JSON made on the invoice page)
//   POST action=cancel { journal_id, reason, remark }    (within 24 hours of the IRN)
//   POST action=ewb    { journal_id, bill }               (bill = one bill from buildEwayBill)
// Results are saved on the invoice (journal metadata) so the IRN, QR and e-way bill print on it.
export const maxDuration = 60;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const NEEDS_SQL = "e-Invoice needs a one-time setup — run 2026-11-05_einvoice.sql in Supabase.";
const KINDS: NicKind[] = ["einvoice", "ewaybill"];

async function gstinOf(bizId: string) {
  const { data } = await sb.from("fw_fin_businesses").select("gstin").eq("id", bizId).maybeSingle();
  return String(data?.gstin ?? "").trim().toUpperCase();
}

/** A live token for the e-invoice / e-way bill system, signing in again with the saved password when it has run out. */
async function tokenFor(bizId: string, kind: NicKind, gstin: string): Promise<string | null> {
  const { data: row } = await sb.from("fw_fin_nic_logins").select("username,enc_password,token,token_expiry").eq("business_id", bizId).eq("kind", kind).maybeSingle();
  if (!row) return null;
  if (row.token && row.token_expiry && Date.parse(row.token_expiry) - Date.now() > 5 * 60000) return row.token;
  if (!row.enc_password) return null;
  let pw: string;
  try { pw = unseal(row.enc_password); } catch { return null; }
  const s = await nicLogin(kind, gstin, row.username, pw);
  await sb.from("fw_fin_nic_logins").update({ token: s.token, token_expiry: new Date(s.expiry ?? Date.now() + 5.5 * 3600000).toISOString(), updated_at: new Date().toISOString() }).eq("business_id", bizId).eq("kind", kind);
  return s.token;
}

async function invoiceOf(bizId: string, id: string) {
  const { data } = await sb.from("fw_fin_journals").select("id,entry_no,type,metadata").eq("id", id).eq("business_id", bizId).maybeSingle();
  return data as { id: string; entry_no: string; type: string; metadata: Record<string, unknown> | null } | null;
}
const saveMeta = (id: string, meta: Record<string, unknown>) => sb.from("fw_fin_journals").update({ metadata: meta }).eq("id", id);

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get("business_id"), jid = req.nextUrl.searchParams.get("journal_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const { data, error } = await sb.from("fw_fin_nic_logins").select("kind,username,enc_password,token_expiry").eq("business_id", bizId!);
    const logins = Object.fromEntries(KINDS.map(k => {
      const r = (data ?? []).find(x => x.kind === k);
      return [k, r ? { username: r.username, remembered: !!r.enc_password, live: !!r.token_expiry && Date.parse(r.token_expiry) > Date.now() } : null];
    }));
    const inv = jid ? await invoiceOf(bizId!, jid) : null;
    return NextResponse.json({ configured: !!process.env.SANDBOX_API_KEY, setup_needed: error ? NEEDS_SQL : null, logins, einvoice: inv?.metadata?.einvoice ?? null, ewaybill: inv?.metadata?.ewaybill ?? null });
  } catch (e) { return serverError("einvoice", e, "Couldn't check e-invoice status."); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bizId = String(body.business_id ?? "");
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    const gstin = await gstinOf(bizId);
    if (!GSTIN_RE.test(gstin)) return NextResponse.json({ error: "Add this business's GSTIN in Business Details first." }, { status: 400 });

    if (body.action === "login") {
      const kind = body.kind as NicKind;
      if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown login." }, { status: 400 });
      const username = String(body.username ?? "").trim(), password = String(body.password ?? "");
      if (!username || !password) return NextResponse.json({ error: "Enter the API username and password." }, { status: 400 });
      const s = await nicLogin(kind, gstin, username, password);
      const { error } = await sb.from("fw_fin_nic_logins").upsert({ business_id: bizId, kind, username, enc_password: body.remember ? seal(password, false) : null,
        token: s.token, token_expiry: new Date(s.expiry ?? Date.now() + 5.5 * 3600000).toISOString(), saved_by: gate.user.id, updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ error: NEEDS_SQL }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    const inv = await invoiceOf(bizId, String(body.journal_id ?? ""));
    if (!inv) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    const meta = { ...(inv.metadata ?? {}) };
    const needLogin = (kind: NicKind) => NextResponse.json({ error: `Sign in to the ${kind === "einvoice" ? "e-invoice" : "e-way bill"} system first (API username and password).`, login: kind }, { status: 401 });

    if (body.action === "irn") {
      if ((meta.einvoice as { irn?: string; cancelled?: string } | undefined)?.irn && !(meta.einvoice as { cancelled?: string }).cancelled) return NextResponse.json({ error: "This invoice already has an IRN." }, { status: 409 });
      const json = body.invoice as { SellerDtls?: { Gstin?: string } } | null;
      if (!json || String(json.SellerDtls?.Gstin ?? "").toUpperCase() !== gstin) return NextResponse.json({ error: "The invoice's seller GSTIN doesn't match this business." }, { status: 400 });
      const token = await tokenFor(bizId, "einvoice", gstin);
      if (!token) return needLogin("einvoice");
      const r = await generateIrn(token, json);
      meta.einvoice = { ...r, generated_at: new Date().toISOString() };
      if (r.ewbNo) meta.ewaybill = { ewbNo: r.ewbNo, validUpto: r.ewbValidTill, generated_at: new Date().toISOString() };
      await saveMeta(inv.id, meta);
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "irn_generated", source: "einvoice", journalId: inv.id, detail: { irn: r.irn, ack: r.ackNo } }).catch(() => null);
      return NextResponse.json({ ok: true, einvoice: meta.einvoice });
    }

    if (body.action === "cancel") {
      const e = meta.einvoice as { irn?: string } | undefined;
      if (!e?.irn) return NextResponse.json({ error: "This invoice has no IRN." }, { status: 400 });
      const reason = String(body.reason ?? "2") as "1" | "2" | "3" | "4";
      if (!["1", "2", "3", "4"].includes(reason)) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
      const token = await tokenFor(bizId, "einvoice", gstin);
      if (!token) return needLogin("einvoice");
      const at = await cancelIrn(token, e.irn, reason, String(body.remark ?? ""));
      meta.einvoice = { ...e, cancelled: at || new Date().toISOString() };
      await saveMeta(inv.id, meta);
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "irn_cancelled", source: "einvoice", journalId: inv.id, detail: { irn: e.irn, reason } }).catch(() => null);
      return NextResponse.json({ ok: true, einvoice: meta.einvoice });
    }

    if (body.action === "ewb") {
      const bill = body.bill as Record<string, unknown> | null;
      if (!bill || String(bill.fromGstin ?? "").toUpperCase() !== gstin) return NextResponse.json({ error: "The e-way bill's GSTIN doesn't match this business." }, { status: 400 });
      const token = await tokenFor(bizId, "ewaybill", gstin);
      if (!token) return needLogin("ewaybill");
      const r = await generateEwb(token, bill);
      meta.ewaybill = { ...r, vehicleNo: bill.vehicleNo ?? null, generated_at: new Date().toISOString() };
      await saveMeta(inv.id, meta);
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "ewb_generated", source: "ewaybill", journalId: inv.id, detail: { ewb: r.ewbNo } }).catch(() => null);
      return NextResponse.json({ ok: true, ewaybill: meta.ewaybill });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message }, { status: 400 });
    return serverError("einvoice", e, "The e-invoice request didn't go through.");
  }
}
