import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomInt, createHash } from "node:crypto";
import { sendLinkCode, phoneCode } from "@/lib/whatsapp/linkCode";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { normPhone } from "@/lib/whatsapp/format";
import { sendContactCard } from "@/lib/whatsapp/contactCard";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "WhatsApp needs its database setup — run 2026-10-14_whatsapp.sql in Supabase.";
const missing = (m?: string) => /fw_fin_wa_|does not exist|schema cache/i.test(m ?? "");
// Server-only key for the phone code; the service key never leaves the server
const linkKey = () => (process.env.WHATSAPP_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const botNumber = () => (process.env.WHATSAPP_BOT_NUMBER ?? "").replace(/\D/g, "");

// The signed-in user's WhatsApp numbers for this business
export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const { data, error } = await supabase.from("fw_fin_wa_links").select("id,phone,verified,code,code_expires,created_at").eq("business_id", bizId!).eq("user_id", gate.user.id).order("created_at");
    if (error) return missing(error.message) ? NextResponse.json({ setup_needed: NEEDS_SQL, links: [] }) : serverError("whatsapp-link", error);
    return NextResponse.json({ links: data ?? [], bot_number: botNumber() || null, live: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_APP_SECRET) });
  } catch (e) {
    return serverError("whatsapp-link", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { business_id, action, phone, id, code: typedCode } = await req.json().catch(() => ({}));
    const gate = await requireBusiness(req, business_id);
    if (gate instanceof NextResponse) return gate;
    if (action === "remove") {
      await supabase.from("fw_fin_wa_links").delete().eq("id", id).eq("business_id", business_id).eq("user_id", gate.user.id);
      await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "whatsapp_unlink", source: "whatsapp", detail: { id } });
      return NextResponse.json({ ok: true });
    }
    // The code FreBook sent to WhatsApp, typed back on the page, proves the number is the user's
    if (action === "verify") {
      const p = normPhone(phone ?? ""), typed = String(typedCode ?? "").replace(/\D/g, "");
      const { data: row } = await supabase.from("fw_fin_wa_links").select("id,code,code_expires,verified").eq("phone", p).eq("business_id", business_id).eq("user_id", gate.user.id).maybeSingle();
      if (!row) return NextResponse.json({ error: "Ask for a code first." }, { status: 400 });
      if (row.verified) return NextResponse.json({ ok: true });
      if (!row.code || !row.code_expires || new Date(row.code_expires) < new Date()) return NextResponse.json({ error: "That code has expired. Press Send code again." }, { status: 400 });
      // Five wrong tries and the code is cancelled
      const since = new Date(Date.now() - 30 * 60000).toISOString();
      const { count: wrong } = await supabase.from("fw_fin_audit_log").select("id", { count: "exact", head: true }).eq("action", "whatsapp_link_bad_code").eq("detail->>link", row.id).gte("created_at", since);
      if ((wrong ?? 0) >= 5) {
        await supabase.from("fw_fin_wa_links").update({ code: null, code_expires: null }).eq("id", row.id);
        return NextResponse.json({ error: "Too many wrong codes. Press Send code to get a new one." }, { status: 429 });
      }
      if (typed.length !== 6 || typed !== phoneCode(row.id, row.code, linkKey())) {
        await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "whatsapp_link_bad_code", source: "whatsapp", detail: { link: row.id } });
        return NextResponse.json({ error: "That code doesn't match. Check the latest WhatsApp message from FreBook." }, { status: 400 });
      }
      await supabase.from("fw_fin_wa_links").update({ verified: true, code: null, code_expires: null }).eq("id", row.id);
      await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "whatsapp_link_verified", source: "whatsapp", detail: { method: "code_on_page" } });
      await sendContactCard(p).catch(() => null);   // so the chat shows "FreBook" once saved
      return NextResponse.json({ ok: true });
    }
    const p = normPhone(phone ?? "");
    if (!/^\d{11,15}$/.test(p)) return NextResponse.json({ error: "Enter the mobile number with country code, e.g. 98765 43210 (India) or +974 5555 1234." }, { status: 400 });
    // A number already verified by someone else for this business can't be taken over
    const { data: other } = await supabase.from("fw_fin_wa_links").select("user_id,verified").eq("phone", p).eq("business_id", business_id).maybeSingle();
    if (other?.verified && other.user_id !== gate.user.id) return NextResponse.json({ error: "This number is already linked to another team member of this business." }, { status: 409 });
    const code = String(randomInt(100000, 1000000));
    const { error } = await supabase.from("fw_fin_wa_links").upsert({ phone: p, business_id, user_id: gate.user.id, verified: false, code, code_expires: new Date(Date.now() + 30 * 60000).toISOString() }, { onConflict: "phone,business_id" });
    if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS_SQL }, { status: 503 }) : serverError("whatsapp-link", error);
    await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "whatsapp_link_start", source: "whatsapp", detail: { phone: `${p.slice(0, 4)}…${p.slice(-2)}` } });

    // Also send a code to the number itself (approved template), so the user doesn't have to find the FreBook chat.
    // At most 5 sends per number per hour.
    let sent = false, sendError: string | null = null;
    const tag = createHash("sha256").update(p).digest("hex").slice(0, 16);
    const { count: recent } = await supabase.from("fw_fin_audit_log").select("id", { count: "exact", head: true }).eq("action", "whatsapp_code_sent").eq("detail->>to", tag).gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if ((recent ?? 0) >= 5) sendError = "Too many codes sent to this number in the last hour. Use the LINK message below, or try later.";
    else {
      const { data: row } = await supabase.from("fw_fin_wa_links").select("id").eq("phone", p).eq("business_id", business_id).maybeSingle();
      const r = row ? await sendLinkCode(p, phoneCode(row.id, code, linkKey())) : { ok: false as const, error: "Couldn't prepare the code." };
      if (r.ok) { sent = true; await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "whatsapp_code_sent", source: "whatsapp", detail: { to: tag } }); }
      else sendError = r.error;
    }
    return NextResponse.json({ ok: true, code, phone: p, bot_number: botNumber() || null, sent, send_error: sendError });
  } catch (e) {
    return serverError("whatsapp-link", e);
  }
}
