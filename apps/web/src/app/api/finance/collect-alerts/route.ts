import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "Run 2026-10-30_collect_alerts.sql in Supabase to switch on WhatsApp alerts.";
const missing = (m?: string) => /collect_alert|does not exist|schema cache/i.test(m ?? "");

// The signed-in user's overdue-alert setting for this business (on their linked WhatsApp numbers)
export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const { data, error } = await supabase.from("fw_fin_wa_links").select("phone,collect_alert,collect_alert_days").eq("business_id", bizId!).eq("user_id", gate.user.id).eq("verified", true);
    if (error) return missing(error.message) ? NextResponse.json({ setup_needed: NEEDS_SQL, linked: false }) : serverError("collect-alerts", error);
    const l = data?.[0];
    return NextResponse.json({ linked: !!l, phone: l ? `…${String(l.phone).slice(-4)}` : null, freq: l?.collect_alert ?? "off", days: l?.collect_alert_days ?? 30 });
  } catch (e) { return serverError("collect-alerts", e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const gate = await requireBusiness(req, body.business_id);
    if (gate instanceof NextResponse) return gate;
    const freq = ["off", "daily", "weekly"].includes(body.freq) ? body.freq : "off";
    const days = [7, 15, 30, 45, 60].includes(Number(body.days)) ? Number(body.days) : 30;
    const { data, error } = await supabase.from("fw_fin_wa_links").update({ collect_alert: freq, collect_alert_days: days }).eq("business_id", body.business_id).eq("user_id", gate.user.id).eq("verified", true).select("id");
    if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS_SQL }, { status: 400 }) : serverError("collect-alerts", error);
    if (!data?.length) return NextResponse.json({ error: "Link your WhatsApp number first (Settings → WhatsApp)." }, { status: 400 });
    return NextResponse.json({ ok: true, freq, days });
  } catch (e) { return serverError("collect-alerts", e); }
}
