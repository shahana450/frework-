import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { fileToShelf, fyOfDate } from "@/lib/shelf";
import { sendOtp, verifyOtp, refreshSession, fetchReturn, gstr2bCsv, monthsBetween, RETURN_LABEL, type ReturnKind } from "@/lib/gstTaxpayer";
import { PortalError, GSTIN_RE } from "@/lib/portals/types";

// GST portal downloads (GSTR-1, GSTR-3B, GSTR-2B) through the GSP, filed on the Shelf's GST rack.
//   GET                → is a portal session open, and until when
//   POST action=otp    → send an OTP to the taxpayer's registered mobile (username from the GST portal)
//   POST action=verify → open the session with the OTP the taxpayer received
//   POST action=fetch  → download the chosen returns for a range of months
// The session token stays on the server; the browser only learns whether it is open.
export const maxDuration = 300;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const NEEDS_SQL = "GST downloads need a one-time database setup — run 2026-11-02_gst_sessions.sql in Supabase.";
const KINDS: ReturnKind[] = ["gstr1", "gstr3b", "gstr2b"];
const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

async function gstinOf(bizId: string) {
  const { data } = await sb.from("fw_fin_businesses").select("gstin").eq("id", bizId).maybeSingle();
  return String(data?.gstin ?? "").trim().toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const { data, error } = await sb.from("fw_fin_gst_sessions").select("gstin,username,session_expiry,token_expiry").eq("business_id", bizId!).maybeSingle();
    if (error) return NextResponse.json({ setup_needed: NEEDS_SQL, connected: false });
    const until = data?.session_expiry ?? data?.token_expiry ?? null;
    return NextResponse.json({ connected: !!until && Date.parse(until) > Date.now(), until, username: data?.username ?? "", gstin: (await gstinOf(bizId!)) || null, configured: !!process.env.SANDBOX_API_KEY });
  } catch (e) { return serverError("gst-download", e, "Couldn't check the GST connection."); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bizId = String(body.business_id ?? "");
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    const gstin = await gstinOf(bizId);
    if (!GSTIN_RE.test(gstin)) return NextResponse.json({ error: "Add this business's GSTIN in Business Details first." }, { status: 400 });

    if (body.action === "otp") {
      const username = String(body.username ?? "").trim();
      if (!username) return NextResponse.json({ error: "Enter the GST portal username." }, { status: 400 });
      await sendOtp(gstin, username);
      const { error } = await sb.from("fw_fin_gst_sessions").upsert({ business_id: bizId, gstin, username, access_token: null, token_expiry: null, session_expiry: null, connected_by: gate.user.id, updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ error: NEEDS_SQL }, { status: 400 });
      return NextResponse.json({ ok: true, message: "OTP sent to the mobile number registered on the GST portal." });
    }

    if (body.action === "verify") {
      const otp = String(body.otp ?? "").replace(/\D/g, "");
      if (otp.length < 4) return NextResponse.json({ error: "Enter the OTP from the SMS." }, { status: 400 });
      const { data: row } = await sb.from("fw_fin_gst_sessions").select("username").eq("business_id", bizId).maybeSingle();
      if (!row?.username) return NextResponse.json({ error: "Send the OTP first." }, { status: 400 });
      const s = await verifyOtp(gstin, row.username, otp);
      await sb.from("fw_fin_gst_sessions").update({ access_token: s.token, token_expiry: iso(s.tokenExpiry), session_expiry: iso(s.sessionExpiry), updated_at: new Date().toISOString() }).eq("business_id", bizId);
      return NextResponse.json({ ok: true, until: iso(s.sessionExpiry ?? s.tokenExpiry) });
    }

    if (body.action === "fetch") {
      const { data: row } = await sb.from("fw_fin_gst_sessions").select("access_token,token_expiry,session_expiry").eq("business_id", bizId).maybeSingle();
      let token = row?.access_token as string | null;
      if (!token || (row?.session_expiry && Date.parse(row.session_expiry) < Date.now())) return NextResponse.json({ error: "The GST portal session has ended. Send a new OTP.", reconnect: true }, { status: 401 });
      // Renew the token if it's about to run out, within the session
      if (row?.token_expiry && Date.parse(row.token_expiry) - Date.now() < 10 * 60000) {
        try {
          const s = await refreshSession(token); token = s.token;
          await sb.from("fw_fin_gst_sessions").update({ access_token: s.token, token_expiry: iso(s.tokenExpiry), session_expiry: iso(s.sessionExpiry) ?? row.session_expiry, updated_at: new Date().toISOString() }).eq("business_id", bizId);
        } catch { /* try with the current token */ }
      }
      const months = monthsBetween(String(body.from ?? ""), String(body.to ?? body.from ?? ""));
      const kinds: ReturnKind[] = (Array.isArray(body.returns) ? (body.returns as string[]) : KINDS).filter((k): k is ReturnKind => KINDS.includes(k as ReturnKind));
      if (!months.length || !kinds.length) return NextResponse.json({ error: "Choose the months and returns to download." }, { status: 400 });

      const results: { period: string; return: string; ok: boolean; note: string }[] = [];
      for (const period of months) for (const kind of kinds) {
        const label = RETURN_LABEL[kind];
        try {
          const data = await fetchReturn(kind, token!, period);
          const base = `${label}-${gstin}-${period}`;
          const json = new TextEncoder().encode(JSON.stringify(data, null, 2));
          const fy = fyOfDate(`${period}-01`);
          const filed = await fileToShelf(sb, { businessId: bizId, actorId: gate.user.id, rack: "gst", title: `${label} · ${period}`, fileName: `${base}.json`, mime: "application/json", bytes: json, source: "system", fy, period, docType: label, notes: "Downloaded from the GST portal" });
          if (kind === "gstr2b") {
            const csv = gstr2bCsv(data);
            if (csv.split("\n").length > 1) await fileToShelf(sb, { businessId: bizId, actorId: gate.user.id, rack: "gst", title: `${label} invoices · ${period}`, fileName: `${base}-invoices.csv`, mime: "text/csv", bytes: new TextEncoder().encode(csv), source: "system", fy, period, docType: label, notes: "Supplier invoices from GSTR-2B (open in Excel)" });
          }
          results.push({ period, return: label, ok: !!filed, note: filed ? "Saved on the Shelf" : "Downloaded, but couldn't save to the Shelf" });
        } catch (e) {
          const msg = e instanceof PortalError ? e.message : "Download failed";
          results.push({ period, return: label, ok: false, note: msg });
          if (/session has ended/i.test(msg)) return NextResponse.json({ results, error: msg, reconnect: true }, { status: 401 });
        }
      }
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message, not_configured: e.code === "NOT_CONFIGURED" }, { status: e.code === "NOT_CONFIGURED" ? 503 : 400 });
    return serverError("gst-download", e, "The GST download didn't go through. Please try again.");
  }
}
