"use client";
// Reminders on WhatsApp: payments to make (bills, rent, EMIs), customer reminders to forward, compliance due dates
// and a daily summary — all in one message at the hour the owner picks.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";

type Settings = { remind_hour: number; daily_summary: boolean; compliance_alert: boolean; compliance_before: number; collect_alert: string; collect_alert_days: number };
type Pay = { id: string; kind: "payment" | "emi"; title: string; party: string | null; amount: number | null; due_date: string; repeat: string; remind_before: number; every_days: number; status: string; last_sent: string | null };
type Data = { linked?: boolean; phone?: string | null; whatsapp?: boolean; settings?: Settings | null; payments?: Pay[]; setup_needed?: string };

const inr = (n: number | null) => n == null ? "" : "₹" + Math.round(n).toLocaleString("en-IN");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const days = (d: string) => Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z")) / 86400000);
const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18, padding: 20 };
const field: React.CSSProperties = { height: 40, borderRadius: 10, border: `1px solid ${HT.line}`, padding: "0 10px", fontSize: 14, fontFamily: "inherit", background: "#FFFFFF", color: HT.ink, width: "100%", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700, color: HT.muted };
const btn = (primary?: boolean): React.CSSProperties => ({ height: 40, padding: "0 18px", borderRadius: 999, border: primary ? "none" : `1px solid ${HT.line}`, background: primary ? HT.green : "#FFFFFF", color: primary ? "#FFFFFF" : HT.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" });
const EMPTY = { id: "", kind: "payment" as "payment" | "emi", title: "", party: "", amount: "", due_date: "", repeat: "monthly", remind_before: 3, every_days: 1 };
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);   // 6 AM – 10 PM
const hourLabel = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

export default function Reminders() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState("");

  const load = useCallback(async (b: string) => {
    const r = await fetch(`/api/finance/reminders?business_id=${b}`);
    const j = await r.json().catch(() => ({}));
    setD(j); setS(j.settings ?? null);
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const b = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!b) { router.push("/finance/setup"); return; }
      setBizId(b); load(b);
    });
  }, [router, load]);

  const post = async (body: Record<string, unknown>, ok?: string) => {
    setMsg(null);
    const r = await fetch("/api/finance/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, t: j.error ?? "That didn't work." }); return null; }
    if (ok) setMsg({ ok: true, t: ok });
    await load(bizId); return j;
  };
  const saveSettings = async (patch: Partial<Settings>) => {
    if (!s) return;
    const next = { ...s, ...patch }; setS(next);
    await post({ action: "settings", settings: next }, "Saved.");
  };

  const pays = d?.payments ?? [];
  const active = pays.filter(p => p.status === "active");
  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <PageHero eyebrow="FreBook · WhatsApp" title="Reminders" accent="on time"
        sub="One WhatsApp message at the hour you choose: payments you have to make, customers to remind, compliance due dates and a summary of today's books."
        actions={<><HeroAction primary onClick={() => setForm({ ...EMPTY, due_date: today() })}>+ Payment reminder</HeroAction>
          <HeroAction onClick={async () => { setBusy("test"); const j = await post({ action: "test" }); setBusy(""); if (j) { setPreview(j.preview); setMsg({ ok: true, t: j.via === "template" ? "Sent as a short update (WhatsApp's 24-hour rule) — reply SUMMARY on WhatsApp to see it all." : "Sent to your WhatsApp." }); } }} disabled={busy === "test" || !d?.linked}>{busy === "test" ? "Sending…" : "Send me one now"}</HeroAction></>}
        tiles={[
          { label: "Payment reminders", value: active.length, sub: `${active.filter(p => days(p.due_date) <= p.remind_before).length} due now` },
          { label: "EMIs", value: active.filter(p => p.kind === "emi").length },
          { label: "Sends at", value: s ? hourLabel(s.remind_hour) : "—", sub: d?.phone ? `to WhatsApp ${d.phone}` : "WhatsApp not linked" },
        ]} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        {d?.setup_needed && <div role="alert" style={{ ...card, background: "#FBF1DA", borderColor: "#E8CF95" }}><b>One-time setup:</b> {d.setup_needed}</div>}
        {d && !d.setup_needed && !d.linked && <div role="alert" style={{ ...card, background: "#FBF1DA", borderColor: "#E8CF95" }}>Reminders come on WhatsApp. <Link href="/finance/whatsapp">Link your WhatsApp number</Link> first, then come back here.</div>}
        {msg && <div role="status" style={{ ...card, padding: "12px 18px", background: msg.ok ? "#E3F3EC" : "#FBE3DE", borderColor: msg.ok ? "#B9DFCC" : "#EDB7AA", color: msg.ok ? "#0B5E42" : "#8A2A1A" }}>{msg.t}</div>}

        {s && (
          <section style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontWeight: 400, fontSize: 23, flex: 1 }}>What to send, and when</h2>
              <label style={{ ...lbl, flexDirection: "row", alignItems: "center", gap: 8 }}>Every day at
                <select value={s.remind_hour} onChange={e => saveSettings({ remind_hour: +e.target.value })} style={{ ...field, width: 130 }}>{HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
              </label>
            </div>
            <Toggle on={s.daily_summary} onChange={v => saveSettings({ daily_summary: v })} title="Daily summary" note="Today's sales, cash and each bank balance, loans outstanding, EMIs due this week, receivables and payables." />
            <Toggle on={s.compliance_alert} onChange={v => saveSettings({ compliance_alert: v })} title="Compliance due dates" note="GST, TDS, PF/ESI, advance tax, ITR and notice replies that aren't filed yet.">
              {s.compliance_alert && <label style={{ ...lbl, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>Start
                <select value={s.compliance_before} onChange={e => saveSettings({ compliance_before: +e.target.value })} style={{ ...field, width: 110, height: 34 }}>{[1, 2, 3, 5, 7, 10, 15].map(n => <option key={n} value={n}>{n} day{n > 1 ? "s" : ""}</option>)}</select> before</label>}
            </Toggle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <b style={{ fontSize: 16 }}>Customers who owe you</b>
              <span style={{ fontSize: 13, color: HT.muted, lineHeight: 1.5 }}>A list of overdue customers, each with a reminder already written — tap to open it in WhatsApp and send it to them yourself.</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select aria-label="How often" value={s.collect_alert} onChange={e => saveSettings({ collect_alert: e.target.value })} style={{ ...field, width: "auto" }}>
                  {[["off", "Off"], ["daily", "Every day"], ["every3", "Every 3 days"], ["weekly", "Every week"], ["fortnightly", "Every 15 days"], ["monthly", "Every month"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                {s.collect_alert !== "off" && <select aria-label="Overdue after" value={s.collect_alert_days} onChange={e => saveSettings({ collect_alert_days: +e.target.value })} style={{ ...field, width: "auto" }}>
                  {[7, 15, 30, 45, 60, 90].map(n => <option key={n} value={n}>overdue {n}+ days</option>)}
                </select>}
              </div>
            </div>
          </section>
        )}

        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontWeight: 400, fontSize: 23, flex: 1 }}>Payments to make</h2>
            <button style={btn(true)} onClick={() => setForm({ ...EMPTY, due_date: today() })}>+ Add</button>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 13.5, color: HT.muted }}>Bills, rent, EMIs, subscriptions. FreBook starts reminding a few days before and keeps going until you mark it paid; a monthly one then moves to next month.</p>
          {!pays.length && <div style={{ padding: 24, textAlign: "center", color: HT.muted }}>No payment reminders yet.</div>}
          {pays.map(p => {
            const left = days(p.due_date);
            const tone = p.status !== "active" ? HT.muted : left < 0 ? "#B4321F" : left <= p.remind_before ? "#9A6B22" : "#0B7A55";
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "14px 0", borderTop: `1px solid ${HT.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16 }}>{p.kind === "emi" && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#E8EEF6", color: "#3C5A85", marginRight: 8 }}>EMI</span>}<b>{p.title}</b>{p.party ? ` · ${p.party}` : ""}{p.amount ? ` · ${inr(p.amount)}` : ""}</div>
                  <div style={{ fontSize: 13, color: tone, marginTop: 3 }}>
                    {p.status === "paid" ? "Paid" : `${left === 0 ? "Due today" : left > 0 ? `Due in ${left} day${left > 1 ? "s" : ""}` : `${-left} day${left < -1 ? "s" : ""} overdue`} · ${new Date(p.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                    <span style={{ color: HT.muted }}> · {p.repeat === "once" ? "one-time" : p.repeat} · reminds {p.remind_before} day{p.remind_before === 1 ? "" : "s"} before, {p.every_days === 1 ? "daily" : `every ${p.every_days} days`}{p.last_sent ? ` · last sent ${p.last_sent}` : ""}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {p.status === "active" && <button style={btn(true)} onClick={() => post({ action: "paid", id: p.id }, p.repeat === "once" ? "Marked paid." : "Marked paid — next one scheduled.")}>Mark paid</button>}
                  {p.status === "active" && <button style={btn()} onClick={() => setForm({ id: p.id, kind: p.kind, title: p.title, party: p.party ?? "", amount: p.amount ? String(p.amount) : "", due_date: p.due_date, repeat: p.repeat, remind_before: p.remind_before, every_days: p.every_days } as typeof EMPTY)}>Edit</button>}
                  <button style={{ ...btn(), color: "#B4321F" }} onClick={() => { if (window.confirm(`Stop reminding about "${p.title}"?`)) post({ action: "stop", id: p.id }, "Stopped."); }}>Stop</button>
                </div>
              </div>
            );
          })}
        </section>

        {preview && <section style={card}><b>Last message sent</b><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, background: "#F8F4EA", borderRadius: 12, padding: 14, margin: "10px 0 0" }}>{preview}</pre></section>}

        <p style={{ fontSize: 12.5, color: HT.muted, lineHeight: 1.6 }}>WhatsApp only allows a full message within 24 hours of your last message to FreBook. Outside that window you get a short update (it needs the approved <code>frebook_daily_update</code> template) — reply <b>SUMMARY</b> to see everything. FreBook never messages your customers; you forward the reminders yourself.</p>
      </main>

      {form && (
        <div role="dialog" aria-modal="true" aria-label="Payment reminder" onClick={() => setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(16,36,31,.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: "min(560px,100%)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <b style={{ gridColumn: "1 / -1", fontSize: 20, fontWeight: 400 }}>{form.id ? "Edit" : "New"} payment reminder</b>
            <div role="radiogroup" aria-label="Type" style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
              {(["payment", "emi"] as const).map(k => <button key={k} role="radio" aria-checked={form.kind === k} onClick={() => setForm({ ...form, kind: k } as typeof EMPTY)} style={{ ...btn(form.kind === k), flex: 1 }}>{k === "emi" ? "Loan EMI" : "Bill / payment"}</button>)}
            </div>
            <label style={{ ...lbl, gridColumn: "1 / -1" }}>What is it<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={form.kind === "emi" ? "e.g. YES Bank car loan EMI" : "e.g. Office rent"} style={field} /></label>
            <label style={lbl}>Paid to (optional)<input value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} style={field} /></label>
            <label style={lbl}>Amount (optional)<input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" style={field} /></label>
            <label style={lbl}>Due date<input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={field} /></label>
            <label style={lbl}>Repeats<select value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value })} style={field}>{[["once", "Only once"], ["weekly", "Every week"], ["monthly", "Every month"], ["quarterly", "Every quarter"], ["yearly", "Every year"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
            <label style={lbl}>Start reminding<select value={form.remind_before} onChange={e => setForm({ ...form, remind_before: +e.target.value })} style={field}>{[0, 1, 2, 3, 5, 7, 10, 15].map(n => <option key={n} value={n}>{n === 0 ? "On the due date" : `${n} day${n > 1 ? "s" : ""} before`}</option>)}</select></label>
            <label style={lbl}>Then remind<select value={form.every_days} onChange={e => setForm({ ...form, every_days: +e.target.value })} style={field}>{[1, 2, 3, 7].map(n => <option key={n} value={n}>{n === 1 ? "Every day" : `Every ${n} days`}</option>)}</select></label>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button style={btn()} onClick={() => setForm(null)}>Cancel</button>
              <button style={btn(true)} onClick={async () => { const j = await post({ action: "save", reminder: { ...form, id: form.id || undefined } }, "Reminder saved."); if (j) setForm(null); }}>Save reminder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, title, note, children }: { on: boolean; onChange: (v: boolean) => void; title: string; note: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <span role="switch" aria-checked={on} tabIndex={0} onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!on); } }} onClick={() => onChange(!on)}
          style={{ width: 44, height: 24, borderRadius: 999, background: on ? HT.green : "#D9D2C2", position: "relative", flexShrink: 0, transition: "background .15s" }}>
          <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", transition: "left .15s" }} />
        </span>
        <b style={{ fontSize: 16 }}>{title}</b>
      </label>
      <span style={{ fontSize: 13, color: HT.muted, lineHeight: 1.5 }}>{note}</span>
      {children}
    </div>
  );
}
