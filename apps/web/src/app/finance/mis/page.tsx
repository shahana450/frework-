"use client";
import { cur, activeMoney } from "@/lib/money";
// Monthly MIS pack — one printable page for the owner, partners or the bank. Print → Save as PDF.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import type { Dashboard } from "@/lib/dashboard";
import { useFinancialYear } from "@/lib/selectedFy";
import PageHero, { HeroAction, HeroFyPicker, HT } from "@/components/finance/PageHero";

const C = { ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", forest: "#0F2B25", gold: "#C99A4E", pos: "#0B7A55", neg: "#B4321F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const inr = (n: number) => (n < 0 ? "−" : "") + cur() + Math.abs(Math.round(n || 0)).toLocaleString(activeMoney().locale);
const pct = (a: number, b: number) => b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / Math.abs(b)) * 100))}%` : "";

export default function MisPack() {
  const router = useRouter();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [biz, setBiz] = useState<{ name: string; gstin: string | null } | null>(null);
  const [err, setErr] = useState("");
  const [bizId, setBizId] = useState<string | null>(null);
  const { years, fy, setFy } = useFinancialYear(bizId);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!id) { router.push("/finance/setup"); return; }
      const { data: b } = await supabase.from("fw_fin_businesses").select("name,gstin").eq("id", id).single();
      setBiz(b ? { name: b.name, gstin: b.gstin } : null);
      setBizId(id);
    });
  }, [router]);

  // Figures for the chosen financial year
  useEffect(() => {
    if (!bizId || !fy) return;
    setDash(null); setErr("");
    fetch(`/api/finance/dashboard?business_id=${bizId}&fy_id=${fy.id}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't load the figures."); else setDash(d as Dashboard);
    }).catch(() => setErr("Couldn't load the figures."));
  }, [bizId, fy]);

  const month = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const kpi = (label: string, value: number, note?: string, tone?: "pos" | "neg") => (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tone === "neg" ? C.neg : tone === "pos" ? C.pos : C.ink }}>{inr(value)}</div>
      {note && <div style={{ fontSize: 12, color: C.muted }}>{note}</div>}
    </div>
  );

  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 16 };
  const h2: React.CSSProperties = { fontFamily: SERIF, fontSize: 24, fontWeight: 400, fontStyle: "italic", margin: "0 0 12px" };
  const row = (k: string, v: number, tone?: "pos" | "neg", key?: string) => (
    <div key={key ?? k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "13px 22px", borderTop: `1px solid ${HT.line}`, fontSize: 15.5 }}>
      <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums", color: tone === "pos" ? C.pos : tone === "neg" ? C.neg : C.ink }}>{inr(v)}</span>
    </div>
  );
  const recv = dash ? Math.max(0, dash.receivables) : 0;
  const adv = dash ? Math.max(0, -dash.receivables) : 0;
  const days = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 86400000);

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: C.ink, fontFamily: SERIF }}>
      <style>{`@media print { .no-print { display: none !important } aside, nav.fw-topicons, .fw-tabs { display: none !important } main.fw-main { margin-left: 0 !important } header { -webkit-print-color-adjust: exact; print-color-adjust: exact } @page { size: A4; margin: 12mm } }
        .mis-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px } .mis-two { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 22px; align-items: start }
        @media (max-width: 820px) { .mis-grid, .mis-two { grid-template-columns: minmax(0,1fr) } }`}</style>
      <PageHero eyebrow={`Management report · ${month}`} title={biz?.name ?? "Your business"}
        sub={`${biz?.gstin ? `GSTIN ${biz.gstin} · ` : ""}${dash ? `${dash.period.label} · ` : ""}prepared from posted entries`}
        actions={<span className="no-print" style={{ display: "inline-flex", gap: 10 }}><HeroFyPicker years={years} value={fy?.id ?? ""} onChange={setFy} /><HeroAction onClick={() => window.print()} primary>Print / Save as PDF</HeroAction></span>}
        tiles={dash ? [
          { label: "Sales this month", value: inr(dash.monthRevenue) },
          { label: "Profit this month", value: inr(dash.monthProfit), sub: `Last month ${inr(dash.lastMonthProfit)} ${pct(dash.monthProfit, dash.lastMonthProfit)}`, tone: dash.monthProfit < 0 ? "bad" : "good" },
          { label: "Cash & bank today", value: inr(dash.cash), tone: dash.cash < 0 ? "bad" : "good" },
        ] : [{ label: "Preparing the report", value: "…" }]} />

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: 26 }}>
        {err && <div style={{ color: C.neg }}>{err}</div>}
        {dash && <>
          <section>
            <h2 style={h2}>Year to date · {dash.period.label}</h2>
            <div className="mis-grid">
              {[
                { l: "Income", v: dash.revenue },
                { l: "Expenses", v: dash.expenses },
                { l: dash.profit < 0 ? "Net loss" : "Net profit", v: dash.profit, tone: dash.profit < 0 ? "neg" : "pos", note: dash.revenue ? `Margin ${((dash.profit / dash.revenue) * 100).toFixed(1)}%` : undefined },
              ].map(k => (
                <div key={k.l} style={{ ...card, padding: "18px 22px" }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted }}>{k.l}</div>
                  <div style={{ fontSize: 28, color: k.tone === "neg" ? C.neg : k.tone === "pos" ? C.pos : C.ink, fontVariantNumeric: "tabular-nums" }}>{inr(k.v)}</div>
                  {k.note && <div style={{ fontSize: 13.5, color: C.muted }}>{k.note}</div>}
                </div>
              ))}
            </div>
          </section>

          {dash.insight && <section style={{ ...card, padding: "14px 22px", fontSize: 15 }}><i style={{ color: HT.goldInk }}>Worth a look —</i> {dash.insight.text}</section>}

          <div className="mis-two">
            <section>
              <h2 style={h2}>Working capital</h2>
              <div style={{ ...card, overflow: "hidden" }}>
                {row("Cash & bank", dash.cash)}
                {row("Customers owe you", recv)}
                {adv > 0 && row("Less: advances received from customers", -adv, "neg")}
                {row("Less: you owe suppliers", -Math.max(0, dash.payables))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "15px 22px", background: HT.green, color: "#FFFFFF", fontSize: 16 }}>
                  <b>Working capital</b><span style={{ fontVariantNumeric: "tabular-nums" }}>{inr(dash.cash + dash.receivables - dash.payables)}</span>
                </div>
              </div>
            </section>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <section>
                <h2 style={h2}>Coming up</h2>
                <div style={{ ...card, overflow: "hidden" }}>
                  {(dash.compliance ?? []).slice(0, 4).map((d, i) => {
                    const x = d as { title?: string; form?: string; due?: string; date?: string; note?: string; period?: string };
                    const due = x.due ?? x.date ?? "";
                    const dt = due ? new Date(due + (due.length === 10 ? "T00:00:00" : "")) : null;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 22px", borderTop: i ? `1px solid ${HT.line}` : undefined }}>
                        {dt && <span style={{ width: 50, flexShrink: 0, textAlign: "center", borderRadius: 10, background: "#FBF1DA", padding: "4px 0", lineHeight: 1.1 }}><span style={{ display: "block", fontSize: 11, color: HT.goldInk }}>{dt.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</span><span style={{ fontSize: 20 }}>{dt.getDate()}</span></span>}
                        <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 16 }}>{x.title ?? x.form ?? ""}</span><span style={{ fontSize: 13.5, color: C.muted }}>{x.period ?? x.note ?? ""}</span></span>
                        {due && <span style={{ fontSize: 13.5, color: C.muted, whiteSpace: "nowrap" }}>{days(due) <= 0 ? "due now" : `in ${days(due)} days`}</span>}
                      </div>
                    );
                  })}
                  {!(dash.compliance ?? []).length && <div style={{ padding: "14px 22px", color: C.muted, fontStyle: "italic" }}>No due dates in view.</div>}
                </div>
              </section>
              <section>
                <h2 style={h2}>Latest entries</h2>
                <div style={{ ...card, overflow: "hidden" }}>
                  {dash.recent.slice(0, 6).map((r, i) => (
                    <div key={r.id} style={{ display: "flex", gap: 14, padding: "12px 22px", borderTop: i ? `1px solid ${HT.line}` : undefined, fontSize: 15 }}>
                      <span style={{ width: 54, color: C.muted, flexShrink: 0 }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(r as { narration?: string }).narration ?? ""}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{inr((r as { amount?: number; total_debit?: number }).amount ?? (r as { total_debit?: number }).total_debit ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
          <footer style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>Books health {dash.health.score}/100{dash.health.reasons.length ? ` — ${dash.health.reasons.slice(0, 2).join("; ")}` : ""}. Unaudited management figures.</footer>
        </>}
      </div>
    </div>
  );
}
