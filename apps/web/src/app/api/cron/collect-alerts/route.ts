import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waPost, waConfigured } from "@/lib/whatsapp/transport";
import { alertDue, alertText, loadOverdue, fmtINR, type AlertFreq } from "@/lib/collectAlert";
import { logUsage } from "@/lib/usage";

// Daily (Vercel Cron, 9 AM IST): WhatsApp each owner who switched on overdue alerts.
// Outside WhatsApp's 24-hour window only an approved template gets through — WHATSAPP_COLLECT_TEMPLATE
// (default "frebook_overdue_alert", Utility, body with {{1}} business, {{2}} customers, {{3}} amount, {{4}} days).
// If the template isn't approved yet, a plain message is tried (delivered only if the owner chatted in the last 24 h).
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const env = (k: string) => (process.env[k] ?? "").trim();

export async function GET(req: NextRequest) {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!waConfigured()) return NextResponse.json({ ok: false, error: "WhatsApp not configured" });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const { data: links, error } = await supabase.from("fw_fin_wa_links").select("id,phone,business_id,collect_alert,collect_alert_days,collect_alert_last").eq("verified", true).neq("collect_alert", "off");
  if (error) return NextResponse.json({ ok: false, error: error.message });

  const name = env("WHATSAPP_COLLECT_TEMPLATE") || "frebook_overdue_alert", lang = env("WHATSAPP_COLLECT_TEMPLATE_LANG") || "en";
  let sent = 0, skipped = 0, failed = 0;
  for (const l of links ?? []) {
    if (!alertDue(l.collect_alert as AlertFreq, today, l.collect_alert_last)) { skipped++; continue; }
    const r = await loadOverdue(supabase, l.business_id, l.collect_alert_days, today).catch(() => null);
    if (!r) { failed++; continue; }
    if (!r.overdue.length) { skipped++; continue; }
    const total = r.overdue.reduce((s, d) => s + d.balance, 0);
    let res = await waPost({
      messaging_product: "whatsapp", to: l.phone, type: "template",
      template: { name, language: { code: lang }, components: [{ type: "body", parameters: [r.business || "your business", String(r.overdue.length), fmtINR(total), String(l.collect_alert_days)].map(text => ({ type: "text", text })) }] },
    });
    if (!res?.ok) res = await waPost({ messaging_product: "whatsapp", to: l.phone, type: "text", text: { body: alertText(r.business, r.overdue, l.collect_alert_days) } });
    if (res?.ok) {
      sent++;
      logUsage({ kind: "wa_business", provider: "whatsapp", model: "utility" });
      await supabase.from("fw_fin_wa_links").update({ collect_alert_last: today }).eq("id", l.id);
    } else { failed++; console.error("collect-alert send", res?.status, (await res?.text().catch(() => ""))?.slice(0, 300)); }
  }
  return NextResponse.json({ ok: true, sent, skipped, failed });
}
