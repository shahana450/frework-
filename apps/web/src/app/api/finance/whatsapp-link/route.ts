import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { normPhone } from "@/lib/whatsapp/format";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "WhatsApp needs its database setup — run 2026-10-14_whatsapp.sql in Supabase.";
const missing = (m?: string) => /fw_fin_wa_|does not exist|schema cache/i.test(m ?? "");
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
    const { business_id, action, phone, id } = await req.json().catch(() => ({}));
    const gate = await requireBusiness(req, business_id);
    if (gate instanceof NextResponse) return gate;
    if (action === "remove") {
      await supabase.from("fw_fin_wa_links").delete().eq("id", id).eq("business_id", business_id).eq("user_id", gate.user.id);
      await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "whatsapp_unlink", source: "whatsapp", detail: { id } });
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
    return NextResponse.json({ ok: true, code, phone: p, bot_number: botNumber() || null });
  } catch (e) {
    return serverError("whatsapp-link", e);
  }
}
