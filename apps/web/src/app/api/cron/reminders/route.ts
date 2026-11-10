import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waConfigured } from "@/lib/whatsapp/transport";
import { sendOwner } from "@/lib/whatsapp/ownerMessage";
import { loadReminderData, buildDigest, type BizReminderData, type LinkPrefs } from "@/lib/reminderData";
import { digestText, digestOneLine } from "@/lib/reminders";
import { logUsage } from "@/lib/usage";

// Hourly (Vercel Cron). For each linked WhatsApp number whose chosen hour (India time) is now: one message with the
// daily summary, payments to make, compliance due dates and customer reminders to forward — whatever is switched on
// and due. Replaces the old 9 AM overdue-only alert (same settings, more frequencies).
export const maxDuration = 300;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!waConfigured()) return NextResponse.json({ ok: false, error: "WhatsApp not configured" });

  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const hour = +now.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).slice(0, 2);
  const forceHour = req.nextUrl.searchParams.get("hour");
  const { data: links, error } = await supabase.from("fw_fin_wa_links")
    .select("id,phone,business_id,remind_hour,daily_summary,compliance_alert,compliance_before,summary_last,compliance_last,collect_alert,collect_alert_days,collect_alert_last")
    .eq("verified", true).eq("remind_hour", forceHour ? +forceHour : hour);
  if (error) return NextResponse.json({ ok: false, error: /remind_hour|does not exist/i.test(error.message) ? "Run 2026-11-10_reminders.sql" : error.message });

  const cache = new Map<string, BizReminderData | null>();
  const sentPayments = new Set<string>();
  let sent = 0, skipped = 0, failed = 0;
  for (const l of links ?? []) {
    const p = l as LinkPrefs & { id: string; phone: string; business_id: string };
    const anyOn = p.daily_summary || p.compliance_alert || p.collect_alert !== "off";
    if (!cache.has(p.business_id)) cache.set(p.business_id, await loadReminderData(supabase, p.business_id, today).catch(() => null));
    const d = cache.get(p.business_id);
    if (!d) { failed++; continue; }
    if (!anyOn && !d.payments.length) { skipped++; continue; }
    const out = await buildDigest(supabase, p.business_id, today, d, p);
    const full = digestText(d.business, out.digest);
    if (!full) { skipped++; continue; }
    const res = await sendOwner(supabase, p.phone, d.business, full, digestOneLine(out.digest, out.sentSummary ? d.summary : undefined));
    if (!res.ok) { failed++; console.error("reminders send", res.error); continue; }
    sent++;
    logUsage({ kind: "wa_business", provider: "whatsapp", model: "utility" });
    await supabase.from("fw_fin_wa_links").update({
      ...(out.sentSummary ? { summary_last: today } : {}), ...(out.sentCompliance ? { compliance_last: today } : {}), ...(out.sentReceivables ? { collect_alert_last: today } : {}),
    }).eq("id", p.id);
    out.dueIds.forEach(id => sentPayments.add(id));
  }
  if (sentPayments.size) await supabase.from("fw_fin_payment_reminders").update({ last_sent: today }).in("id", [...sentPayments]);
  return NextResponse.json({ ok: true, hour, sent, skipped, failed });
}
