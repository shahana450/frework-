import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { nextDue, FREQ_DAYS, digestText, digestOneLine, type Repeat } from "@/lib/reminders";
import { loadReminderData, buildDigest, type LinkPrefs } from "@/lib/reminderData";
import { sendOwner } from "@/lib/whatsapp/ownerMessage";
import { waConfigured } from "@/lib/whatsapp/transport";

// Reminder settings (on the signed-in user's linked WhatsApp numbers for this business) and payment reminders.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS = "Run 2026-11-10_reminders.sql in Supabase (SQL editor) to switch on reminders.";
const missing = (m?: string) => /fw_fin_payment_reminders|remind_hour|daily_summary|does not exist|schema cache/i.test(m ?? "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const REPEATS: Repeat[] = ["once", "weekly", "monthly", "quarterly", "yearly"];
const FREQS = ["off", ...Object.keys(FREQ_DAYS)];
const LINK_COLS = "id,phone,remind_hour,daily_summary,compliance_alert,compliance_before,summary_last,compliance_last,collect_alert,collect_alert_days,collect_alert_last";

export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const [links, list] = await Promise.all([
      sb.from("fw_fin_wa_links").select(LINK_COLS).eq("business_id", bizId!).eq("user_id", gate.user.id).eq("verified", true),
      sb.from("fw_fin_payment_reminders").select("*").eq("business_id", bizId!).neq("status", "stopped").order("due_date"),
    ]);
    if (missing(links.error?.message) || missing(list.error?.message)) return NextResponse.json({ setup_needed: NEEDS });
    if (links.error) return serverError("reminders", links.error);
    const l = (links.data ?? [])[0] as (LinkPrefs & { phone: string; remind_hour: number }) | undefined;
    return NextResponse.json({
      linked: !!l, phone: l ? `…${String(l.phone).slice(-4)}` : null, whatsapp: waConfigured(),
      settings: l ? { remind_hour: l.remind_hour, daily_summary: l.daily_summary, compliance_alert: l.compliance_alert, compliance_before: l.compliance_before, collect_alert: l.collect_alert, collect_alert_days: l.collect_alert_days } : null,
      payments: list.data ?? [],
    });
  } catch (e) { return serverError("reminders", e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown> & { business_id?: string; action?: string };
    const gate = await requireBusiness(req, body.business_id);
    if (gate instanceof NextResponse) return gate;
    const bizId = body.business_id!;
    const writer = can(gate.role, "post") || can(gate.role, "upload");

    if (body.action === "settings") {
      const s = body.settings as Record<string, unknown>;
      const patch = {
        remind_hour: Math.min(23, Math.max(0, Math.round(Number(s.remind_hour) || 9))),
        daily_summary: !!s.daily_summary, compliance_alert: !!s.compliance_alert,
        compliance_before: Math.min(30, Math.max(0, Math.round(Number(s.compliance_before) || 3))),
        collect_alert: FREQS.includes(String(s.collect_alert)) ? String(s.collect_alert) : "off",
        collect_alert_days: [7, 15, 30, 45, 60, 90].includes(Number(s.collect_alert_days)) ? Number(s.collect_alert_days) : 30,
      };
      const { data, error } = await sb.from("fw_fin_wa_links").update(patch).eq("business_id", bizId).eq("user_id", gate.user.id).eq("verified", true).select("id");
      if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS }, { status: 400 }) : serverError("reminders", error);
      if (!data?.length) return NextResponse.json({ error: "Link your WhatsApp number first (FreBook → WhatsApp)." }, { status: 400 });
      return NextResponse.json({ ok: true, settings: patch });
    }

    if (!writer) return NextResponse.json({ error: "Your role can view reminders but not change them." }, { status: 403 });

    if (body.action === "save") {
      const r = body.reminder as Record<string, unknown>;
      const title = String(r.title ?? "").trim().slice(0, 120);
      const due = String(r.due_date ?? "");
      if (!title) return NextResponse.json({ error: "Give the payment a name, e.g. Office rent or Car loan EMI." }, { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return NextResponse.json({ error: "Choose the due date." }, { status: 400 });
      const row = {
        business_id: bizId, title, due_date: due, kind: r.kind === "emi" ? "emi" : "payment",
        party: String(r.party ?? "").trim().slice(0, 120) || null, amount: Number(r.amount) > 0 ? Math.round(Number(r.amount) * 100) / 100 : null,
        repeat: REPEATS.includes(r.repeat as Repeat) ? r.repeat : "once",
        remind_before: Math.min(60, Math.max(0, Math.round(Number(r.remind_before ?? 3)))), every_days: Math.min(30, Math.max(1, Math.round(Number(r.every_days ?? 1)))),
      };
      const q = r.id ? sb.from("fw_fin_payment_reminders").update({ ...row, last_sent: null }).eq("id", String(r.id)).eq("business_id", bizId) : sb.from("fw_fin_payment_reminders").insert({ ...row, created_by: gate.user.id });
      const { error } = await q;
      if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS }, { status: 400 }) : serverError("reminders save", error);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "paid" || body.action === "stop") {
      const { data: r } = await sb.from("fw_fin_payment_reminders").select("*").eq("id", String(body.id)).eq("business_id", bizId).maybeSingle();
      if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (body.action === "stop") { await sb.from("fw_fin_payment_reminders").update({ status: "stopped" }).eq("id", r.id); return NextResponse.json({ ok: true }); }
      const nxt = nextDue(r.due_date, r.repeat as Repeat);
      const history = [...((r.paid_history as unknown[]) ?? []), { due: r.due_date, paid_on: today(), by: gate.user.id }].slice(-24);
      await sb.from("fw_fin_payment_reminders").update(nxt ? { due_date: nxt, last_sent: null, paid_history: history } : { status: "paid", paid_history: history }).eq("id", r.id);
      await logAudit(sb, { businessId: bizId, actor: gate.user.id, action: "payment_reminder_paid", detail: { title: r.title, due: r.due_date, next: nxt } });
      return NextResponse.json({ ok: true, next: nxt });
    }

    if (body.action === "test") {
      const { data: links, error } = await sb.from("fw_fin_wa_links").select(LINK_COLS).eq("business_id", bizId).eq("user_id", gate.user.id).eq("verified", true);
      if (error) return missing(error.message) ? NextResponse.json({ error: NEEDS }, { status: 400 }) : serverError("reminders test", error);
      if (!links?.length) return NextResponse.json({ error: "Link your WhatsApp number first (FreBook → WhatsApp)." }, { status: 400 });
      const d = await loadReminderData(sb, bizId, today());
      if (!d) return NextResponse.json({ error: "Couldn't read the books right now." }, { status: 500 });
      const p = links[0] as unknown as LinkPrefs & { phone: string };
      const out = await buildDigest(sb, bizId, today(), d, { ...p, daily_summary: true, compliance_alert: true, collect_alert: p.collect_alert === "off" ? "daily" : p.collect_alert }, true);
      const full = digestText(d.business, out.digest) || `🔔 *${d.business}* — nothing due right now.`;
      const res = await sendOwner(sb, p.phone, d.business, full, digestOneLine(out.digest, d.summary));
      if (!res.ok) return NextResponse.json({ error: `WhatsApp didn't accept the message${res.error ? `: ${res.error}` : ""}. Send any message to FreBook on WhatsApp first, then try again.` }, { status: 502 });
      return NextResponse.json({ ok: true, via: res.via, preview: full });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return serverError("reminders", e); }
}
