import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { refreshSession, saveGstr1, waitForStatus, proceedToFile, gstr1Summary, sendEvcOtp, fileGstr1Evc } from "@/lib/gstTaxpayer";
import { buildMonthGstr1 } from "@/lib/gstr1Export";
import { logAudit } from "@/lib/audit";
import { PortalError, GSTIN_RE } from "@/lib/portals/types";

// Files GSTR-1 on the GST portal through the GSP, using the portal session opened on the GST page (OTP).
//   POST action=prepare { month }        → our return is saved on the portal, "proceed to file" is done, and the
//                                           portal's own summary comes back to compare with FreBook's figures
//   POST action=otp     { pan }          → EVC OTP to the authorised signatory
//   POST action=file    { month, pan, otp, confirm: true } → filed; the ARN is saved and shown as Filed ✓
// Filing cannot be undone, so it needs the signatory's OTP and an explicit confirm from the person filing.
export const maxDuration = 300;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

/** The open GST portal session's token, renewed when close to running out; null when the session has ended. */
async function sessionToken(bizId: string): Promise<string | null> {
  const { data: row } = await sb.from("fw_fin_gst_sessions").select("access_token,token_expiry,session_expiry").eq("business_id", bizId).maybeSingle();
  let token = (row?.access_token as string | null) ?? null;
  if (!token || (row?.session_expiry && Date.parse(row.session_expiry) < Date.now())) return null;
  if (row?.token_expiry && Date.parse(row.token_expiry) - Date.now() < 10 * 60000) {
    try {
      const s = await refreshSession(token); token = s.token;
      await sb.from("fw_fin_gst_sessions").update({ access_token: s.token, token_expiry: iso(s.tokenExpiry), session_expiry: iso(s.sessionExpiry) ?? row.session_expiry, updated_at: new Date().toISOString() }).eq("business_id", bizId);
    } catch { /* try with the current token */ }
  }
  return token;
}

const ended = () => NextResponse.json({ error: "The GST portal session has ended. Connect again with an OTP (Shelf → GST → GST portal), then come back.", reconnect: true }, { status: 401 });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bizId = String(body.business_id ?? "");
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    const { data: biz } = await sb.from("fw_fin_businesses").select("gstin").eq("id", bizId).maybeSingle();
    if (!GSTIN_RE.test(String(biz?.gstin ?? "").toUpperCase())) return NextResponse.json({ error: "Add this business's GSTIN in Business Details first." }, { status: 400 });
    if (!process.env.SANDBOX_API_KEY) return NextResponse.json({ error: "GST filing isn't switched on yet (Sandbox key missing on the server)." }, { status: 503 });
    const month = String(body.month ?? "");
    if (body.action !== "otp" && !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Choose the month." }, { status: 400 });
    const token = await sessionToken(bizId);
    if (!token) return ended();

    if (body.action === "prepare") {
      const r = await buildMonthGstr1(sb, bizId, month);
      const errors = r.issues.filter(i => i.level === "error");
      if (errors.length) return NextResponse.json({ error: `Fix ${errors.length} problem${errors.length === 1 ? "" : "s"} before filing.`, issues: errors }, { status: 400 });
      const docs = r.totals.reduce((s, t) => s + t.count, 0);
      // Save our return as the portal draft (a nil month just proceeds as nil)
      if (docs) {
        const saved = await waitForStatus(token, month, await saveGstr1(token, month, r.json));
        if (saved.status === "ER" || saved.status === "PE") return NextResponse.json({ error: saved.status === "ER" ? "The GST portal rejected the upload." : "The GST portal saved the return but flagged some invoices.", portal_errors: saved.errorReport }, { status: 422 });
        if (saved.status !== "P") return NextResponse.json({ error: "The GST portal is still processing the upload. Try 'Prepare' again in a minute." }, { status: 202 });
      }
      const proceeded = await waitForStatus(token, month, await proceedToFile(token, month, docs === 0));
      if (proceeded.status === "ER") return NextResponse.json({ error: "The GST portal couldn't proceed to file.", portal_errors: proceeded.errorReport }, { status: 422 });
      const summary = await gstr1Summary(token, month);
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "gstr1_prepared", source: "gst", detail: { month, documents: docs } }).catch(() => null);
      return NextResponse.json({ ok: true, summary, ours: r.totals, warnings: r.issues.filter(i => i.level === "warn").length });
    }

    if (body.action === "otp") {
      const pan = String(body.pan ?? "").trim().toUpperCase();
      if (!PAN.test(pan)) return NextResponse.json({ error: "Enter the authorised signatory's PAN." }, { status: 400 });
      await sendEvcOtp(token, pan, "gstr-1");
      return NextResponse.json({ ok: true, message: "OTP sent to the authorised signatory's mobile and email." });
    }

    if (body.action === "file") {
      const pan = String(body.pan ?? "").trim().toUpperCase(), otp = String(body.otp ?? "").replace(/\D/g, "");
      if (body.confirm !== true) return NextResponse.json({ error: "Confirm that you want to file." }, { status: 400 });
      if (!PAN.test(pan) || otp.length !== 6) return NextResponse.json({ error: "Enter the signatory's PAN and the 6-digit EVC OTP." }, { status: 400 });
      const summary = await gstr1Summary(token, month);   // file exactly what the portal holds now
      const arn = await fileGstr1Evc(token, month, pan, otp, summary);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      await sb.from("fw_fin_portal_status").upsert({ business_id: bizId, portal: "gst", kind: "return", form: "GSTR-1", period: month, status: "filed", arn: arn || null, filed_on: today,
        details: { via: "FreBook", filed_by: gate.user.id }, demo: false, fetched_at: new Date().toISOString() }, { onConflict: "business_id,portal,form,period" });
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "gstr1_filed", source: "gst", detail: { month, arn } }).catch(() => null);
      return NextResponse.json({ ok: true, arn, filed_on: today });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message }, { status: 400 });
    return serverError("gst-file", e, "GST filing didn't go through.");
  }
}
