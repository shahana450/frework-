"use client";
// Monthly MIS pack — one printable page for the owner, partners or the bank. Print → Save as PDF.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import type { Dashboard } from "@/lib/dashboard";

const C = { ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", forest: "#0F2B25", gold: "#C99A4E", pos: "#0B7A55", neg: "#C2321F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(Math.round(n || 0)).toLocaleString("en-IN");
const pct = (a: number, b: number) => b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / Math.abs(b)) * 100))}%` : "";

export default function MisPack() {
  const router = useRouter();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [biz, setBiz] = useState<{ name: string; gstin: string | null } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!id) { router.push("/finance/setup"); return; }
      const { data: b } = await supabase.from("fw_fin_businesses").select("name,gstin").eq("id", id).single();
      setBiz(b ? { name: b.name, gstin: b.gstin } : null);
      const r = await fetch(`/api/finance/dashboard?business_id=${id}`).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (!r || !r.ok) setErr(d.error ?? "Couldn't load the figures."); else setDash(d as Dashboard);
    });
  }, [router]);

  const month = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const kpi = (label: string, value: number, note?: string, tone?: "pos" | "neg") => (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: tone === "neg" ? C.neg : tone === "pos" ? C.pos : C.ink }}>{inr(value)}</div>
      {note && <div style={{ fontSize: 12, color: C.muted }}>{note}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`@media print { .no-print { display: none !important } aside, nav.fw-topicons, .fw-tabs { display: none !important } main.fw-main { margin-left: 0 !important } @page { size: A4; margin: 14mm } } .mis-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px } @media (max-width: 700px) { .mis-grid { grid-template-columns: minmax(0,1fr) } }`}</style>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => window.print()} style={{ height: 42, padding: "0 18px", borderRadius: 999, border: "none", background: C.forest, color: "#FFFFFF", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Print / Save as PDF</button>
        </div>
        <header style={{ borderBottom: `3px solid ${C.forest}`, paddingBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: C.gold }}>MANAGEMENT REPORT · {month.toUpperCase()}</div>
          <h1 style={{ margin: "4px 0 0", fontFamily: SERIF, fontSize: "2rem" }}>{biz?.name ?? "Your business"}</h1>
          <div style={{ fontSize: 12.5, color: C.muted }}>{biz?.gstin ? `GSTIN ${biz.gstin} · ` : ""}{dash ? `${dash.period.label} · ` : ""}prepared from posted entries in FreWork</div>
        </header>
        {err && <div style={{ color: C.neg, fontWeight: 700 }}>{err}</div>}
        {!dash && !err && <div style={{ color: C.muted }}>Preparing the report…</div>}
        {dash && <>
          <section>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.2rem", margin: "0 0 8px" }}>This month</h2>
            <div className="mis-grid">
              {kpi("Sales this month", dash.monthRevenue)}
              {kpi("Profit this month", dash.monthProfit, `Last month ${inr(dash.lastMonthProfit)} ${pct(dash.monthProfit, dash.lastMonthProfit)}`, dash.monthProfit < 0 ? "neg" : "pos")}
              {kpi("Cash & bank today", dash.cash, undefined, dash.cash < 0 ? "neg" : undefined)}
            </div>
          </section>
          <section>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.2rem", margin: "0 0 8px" }}>Year to date · {dash.period.label}</h2>
            <div className="mis-grid">
              {kpi("Income", dash.revenue)}
              {kpi("Expenses", dash.expenses)}
              {kpi(dash.profit < 0 ? "Net loss" : "Net profit", dash.profit, dash.revenue ? `Margin ${Math.round((dash.profit / dash.revenue) * 100)}%` : undefined, dash.profit < 0 ? "neg" : "pos")}
              {kpi("Customers owe you", dash.receivables)}
              {kpi("You owe suppliers", dash.payables)}
              {kpi("Working capital", dash.cash + dash.receivables - dash.payables, "Cash + receivables − payables")}
            </div>
          </section>
          {dash.insight && <section style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 14 }}><b>Worth a look:</b> {dash.insight.text}</section>}
          <section>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.2rem", margin: "0 0 8px" }}>Coming up</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <tbody>{(dash.compliance ?? []).slice(0, 6).map((d, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "6px 4px" }}>{(d as { title?: string; form?: string }).title ?? (d as { form?: string }).form ?? ""}</td><td style={{ padding: "6px 4px", color: C.muted }}>{(d as { period?: string }).period ?? ""}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{(d as { due?: string }).due ? new Date((d as { due: string }).due).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</td></tr>))}
                {!(dash.compliance ?? []).length && <tr><td style={{ padding: "6px 4px", color: C.muted }}>No due dates in view.</td></tr>}</tbody>
            </table>
          </section>
          <section>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.2rem", margin: "0 0 8px" }}>Latest entries</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>{dash.recent.slice(0, 10).map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "5px 4px", whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td><td style={{ padding: "5px 4px", fontFamily: MONO, fontSize: 12 }}>{r.entry_no}</td><td style={{ padding: "5px 4px" }}>{r.narration}</td><td style={{ padding: "5px 4px", textAlign: "right", fontFamily: MONO }}>{inr(r.amount)}</td></tr>))}</tbody>
            </table>
          </section>
          <footer style={{ fontSize: 11.5, color: C.muted, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>Books health {dash.health.score}/100{dash.health.reasons.length ? ` — ${dash.health.reasons.slice(0, 2).join("; ")}` : ""}. Unaudited management figures.</footer>
        </>}
      </div>
    </div>
  );
}
