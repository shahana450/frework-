"use client";
// Admin: running costs, measured — AI calls and tokens, WhatsApp messages, storage. Fixed plans (Vercel, Supabase) listed alongside.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Costs = {
  setup: string | null; usdInr: number;
  month: { label: string; dayOfMonth: number; daysInMonth: number };
  ai: { model: string; provider: string; calls: number; input: number; output: number; usd: number; inr: number }[];
  totals: { aiCalls: number; aiInr: number; waReplies: number; waBusiness: number; waInr: number; mtdInr: number; projectedInr: number };
  storage: { files: number; bytes: number };
  books: { journals: number; businesses: number };
  daily: { day: string; ai: number; wa: number; inr: number }[];
  capacity: { dbBytes: number; storageBytes: number; storageFiles: number; users: number; mau: number } | null;
  capacitySetup: string | null;
  whatsapp: { tier: string | null; limit: number | null; quality: string | null; name_status: string | null; peakBusinessPerDay: number } | null;
};

// Plan limits — what each Supabase plan includes
const PLANS = {
  free: { label: "Free", db: 0.5 * 1073741824, files: 1073741824, mau: 50000 },
  pro: { label: "Pro", db: 8 * 1073741824, files: 100 * 1073741824, mau: 100000 },
} as const;

function Gauge({ label, used, limit, show, hint }: { label: string; used: number; limit: number | null; show: string; hint: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const tone = !limit ? "#5A6080" : pct >= 90 ? "#C2321F" : pct >= 70 ? "#B87800" : "#0B7A55";
  const word = !limit ? "No limit" : pct >= 90 ? "Upgrade now" : pct >= 70 ? "Plan an upgrade" : "OK";
  return (
    <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #E1E4EE", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: tone, background: tone + "1A" }}>{word}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#EEF0F6", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(limit ? 2 : 0, pct)}%`, height: "100%", background: tone, borderRadius: 999, transition: "width .6s" }} />
      </div>
      <div style={{ display: "flex", fontSize: 12, color: "#5A6080" }}><span>{show}</span><span style={{ marginLeft: "auto" }}>{limit ? `${pct < 1 && pct > 0 ? "<1" : Math.round(pct)}% used` : ""}</span></div>
      <div style={{ fontSize: 11.5, color: "#5A6080", lineHeight: 1.45 }}>{hint}</div>
    </div>
  );
}

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", gold: "#C9A24A", pos: "#0B7A55", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => n.toLocaleString("en-IN");
const tok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
const size = (b: number) => b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${Math.round(b / 1048576)} MB`;

// Fixed monthly plans — edit when you change plans
const FIXED = [
  { name: "Vercel Pro", inr: 1700, note: "hosting" },
  { name: "Supabase Pro", inr: 2125, note: "database, logins, files" },
];

export default function AdminCosts() {
  const [d, setD] = useState<Costs | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const r = await fetch("/api/admin/costs", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? "Couldn't load running costs."); return; }
      setD(j);
    });
  }, []);

  const fixed = FIXED.reduce((s, f) => s + f.inr, 0);
  const [plan, setPlan] = useState<keyof typeof PLANS>("pro");
  useEffect(() => { try { const p = localStorage.getItem("fw_supabase_plan"); if (p === "free" || p === "pro") setPlan(p); } catch { /* */ } }, []);
  const P = PLANS[plan];
  const max = Math.max(1, ...(d?.daily ?? []).map(x => x.inr));
  const perBiz = d && d.books.businesses ? (d.totals.projectedInr + fixed) / d.books.businesses : 0;

  return (
    <section style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 20, padding: 20, marginBottom: 24, color: C.ink }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Running costs</h2>
        <span style={{ fontSize: 13, color: C.muted }}>{d ? `${d.month.label} · day ${d.month.dayOfMonth} of ${d.month.daysInMonth}` : "Loading…"}</span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted }}>Measured from usage · prices approximate · $1 = ₹{d?.usdInr ?? 85}</span>
      </div>
      {err && <div style={{ color: "#C2321F", fontSize: 13 }}>{err}</div>}
      {d?.setup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{d.setup}</div>}

      {d && <>
        {/* Headline */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 16 }}>
          {[
            { l: "This month so far", v: inr(d.totals.mtdInr), s: "AI + WhatsApp", dark: true },
            { l: "Projected this month", v: inr(d.totals.projectedInr + fixed), s: `incl. fixed plans ${inr(fixed)}` },
            { l: "Per business / month", v: d.books.businesses ? inr(perBiz) : "—", s: `${num(d.books.businesses)} businesses` },
            { l: "AI calls", v: num(d.totals.aiCalls), s: inr(d.totals.aiInr) },
            { l: "WhatsApp", v: num(d.totals.waReplies + d.totals.waBusiness), s: `${num(d.totals.waBusiness)} paid · ${inr(d.totals.waInr)}` },
          ].map(s => (
            <div key={s.l} style={{ borderRadius: 14, padding: "12px 14px", background: s.dark ? "linear-gradient(150deg,#2E3680,#232A63)" : "#F7F8FC", color: s.dark ? "#FFFFFF" : C.ink }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: s.dark ? C.gold : C.muted }}>{s.l}</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: s.dark ? "#C9CEEA" : C.muted }}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* When to upgrade */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 900 }}>When to upgrade</span>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>Supabase plan
            <select value={plan} onChange={e => { const v = e.target.value as keyof typeof PLANS; setPlan(v); try { localStorage.setItem("fw_supabase_plan", v); } catch { /* */ } }} style={{ height: 28, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 6px", fontSize: 12 }}>
              <option value="free">Free</option><option value="pro">Pro</option>
            </select>
          </label>
          <span style={{ fontSize: 11.5, color: C.muted }}>Amber at 70% · red at 90%</span>
        </div>
        {d.capacitySetup && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{d.capacitySetup}</div>}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 18 }}>
          {d.capacity && <>
            <Gauge label="Database" used={d.capacity.dbBytes} limit={P.db} show={`${size(d.capacity.dbBytes)} of ${size(P.db)}`} hint={plan === "free" ? "Free plan pauses when full — move to Pro (8 GB)." : "Over 8 GB is billed per GB; at 90% consider a larger compute add-on."} />
            <Gauge label="File storage" used={d.capacity.storageBytes} limit={P.files} show={`${size(d.capacity.storageBytes)} of ${size(P.files)} · ${num(d.capacity.storageFiles)} files`} hint="Bills, statements and Shelf documents." />
            <Gauge label="Monthly active users" used={d.capacity.mau} limit={P.mau} show={`${num(d.capacity.mau)} of ${num(P.mau)} · ${num(d.capacity.users)} accounts`} hint="People who signed in during the last 30 days." />
          </>}
          {d.whatsapp ? (
            <Gauge label="WhatsApp daily limit" used={d.whatsapp.peakBusinessPerDay} limit={d.whatsapp.limit} show={`Busiest day ${num(d.whatsapp.peakBusinessPerDay)} of ${d.whatsapp.limit ? num(d.whatsapp.limit) : "unlimited"} · quality ${(d.whatsapp.quality ?? "unknown").toLowerCase()}`}
              hint={d.whatsapp.quality && d.whatsapp.quality !== "GREEN" ? "Quality is not green — Meta may lower the limit. Reduce unwanted messages." : "New chats FreBook can start per day (codes, reminders). Meta raises it as quality stays green; replies are unlimited."} />
          ) : <Gauge label="WhatsApp daily limit" used={0} limit={null} show="Couldn't read from Meta" hint="Check WhatsApp Manager → Messaging limits." />}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, marginBottom: 18 }}>
          <span style={{ color: C.muted }}>AI credit can&apos;t be read by apps — check:</span>
          <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Gemini usage ↗</a>
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Claude credit ↗</a>
          <a href="https://vercel.com/fasalk06-8613s-projects/frework-api/usage" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Vercel usage ↗</a>
          <a href="https://supabase.com/dashboard/project/nmkpjliythusgleozbqi/settings/billing/usage" target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>Supabase usage ↗</a>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {/* Daily cost */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Variable cost per day · last 30 days</div>
            <div role="img" aria-label="Cost per day" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, borderBottom: `1px solid ${C.line}` }}>
              {d.daily.map(x => (
                <span key={x.day} title={`${x.day}: ${inr(x.inr)} · ${x.ai} AI calls · ${x.wa} WhatsApp`} style={{ flex: 1, height: `${(x.inr / max) * 100}%`, minHeight: x.inr ? 2 : 0, background: C.navy, borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
              ))}
            </div>
          </div>

          {/* AI by model */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>AI by model · this month</div>
            {d.ai.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>No AI calls recorded yet.</div> : (
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <thead><tr style={{ color: C.muted, textAlign: "left" }}><th style={{ padding: "4px 0" }}>Model</th><th style={{ textAlign: "right" }}>Calls</th><th style={{ textAlign: "right" }}>Tokens in / out</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
                <tbody>{d.ai.map(m => (
                  <tr key={m.provider + m.model} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "6px 0" }}>{m.model} <span style={{ color: C.muted }}>· {m.provider}</span></td>
                    <td style={{ textAlign: "right" }}>{num(m.calls)}</td>
                    <td style={{ textAlign: "right", color: C.muted }}>{tok(m.input)} / {tok(m.output)}</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{inr(m.inr)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          {/* Fixed + storage */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Plans & storage</div>
            {FIXED.map(f => (
              <div key={f.name} style={{ display: "flex", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
                <span>{f.name} <span style={{ color: C.muted }}>· {f.note}</span></span><b style={{ marginLeft: "auto" }}>{inr(f.inr)}</b>
              </div>
            ))}
            <div style={{ display: "flex", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
              <span>Shelf files <span style={{ color: C.muted }}>· {num(d.storage.files)} files</span></span><b style={{ marginLeft: "auto" }}>{size(d.storage.bytes)}</b>
            </div>
            <div style={{ display: "flex", fontSize: 13, padding: "5px 0" }}>
              <span>Journal entries</span><b style={{ marginLeft: "auto" }}>{num(d.books.journals)}</b>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Supabase Pro includes 100 GB files and 8 GB database. Razorpay fees (~2% + GST) come out of each payment, not counted here.</div>
          </div>
        </div>
      </>}
    </section>
  );
}
