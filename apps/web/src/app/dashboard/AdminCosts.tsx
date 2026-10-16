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
};

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
