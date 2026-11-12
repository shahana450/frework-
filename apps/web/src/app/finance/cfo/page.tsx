"use client";
// Business analysis — the books read as a CFO would: margins, break-even, expenses worth questioning, cash and runway,
// working capital. Every figure is from posted entries for the chosen financial year.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { useFinancialYear } from "@/lib/selectedFy";
import PageHero, { HeroFyPicker, HT, SERIF } from "@/components/finance/PageHero";
import type { Cfo } from "@/lib/cfo";

const inr = (n: number | null | undefined) => n == null ? "—" : `${n < 0 ? "−" : ""}₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const short = (n: number) => { const a = Math.abs(n), s = n < 0 ? "−" : ""; return a >= 1e7 ? `${s}₹${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `${s}₹${(a / 1e5).toFixed(2)} L` : `${s}₹${Math.round(a).toLocaleString("en-IN")}`; };
const mon = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" });
const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18, padding: 20 };
const h2: React.CSSProperties = { margin: "0 0 4px", fontSize: 22, fontWeight: 400 };
const sub: React.CSSProperties = { margin: "0 0 14px", fontSize: 13.5, color: HT.muted };
const TONE = { good: { bg: "#E3F3EC", fg: "#0B5E42", dot: "#0B7A55" }, warn: { bg: "#FBF1DA", fg: "#7A5300", dot: "#C9A24A" }, bad: { bg: "#FBE3DE", fg: "#8A2A1A", dot: "#B4321F" } };

export default function CfoPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const { years, fy, setFy } = useFinancialYear(bizId);
  const [d, setD] = useState<(Cfo & { fy: string }) | null>(null);
  const [err, setErr] = useState("");
  const [allHeads, setAllHeads] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const id = (readActiveBusiness(user.id) ?? "").trim();
      if (!id) { router.push("/finance/setup"); return; } setBizId(id);
    });
  }, [router]);
  useEffect(() => {
    if (!bizId) return;
    setD(null); setErr("");
    fetch(`/api/finance/cfo?business_id=${bizId}${fy ? `&fy_id=${fy.id}` : ""}`).then(r => r.json().then(j => ({ ok: r.ok, j }))).then(({ ok, j }) => ok ? setD(j) : setErr(j.error ?? "Couldn't build the analysis.")).catch(() => setErr("Couldn't build the analysis."));
  }, [bizId, fy]);

  const maxBar = d ? Math.max(1, ...d.months.map(m => Math.max(m.revenue, m.cogs + m.expenses))) : 1;
  const heads = d ? (allHeads ? d.heads : d.heads.slice(0, 10)) : [];
  const flagged = d ? d.heads.filter(h => h.flag) : [];

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <style>{`.cfo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media(max-width:900px){.cfo-grid{grid-template-columns:1fr}}`}</style>
      <PageHero eyebrow={`FreBook · Business analysis${d ? ` · FY ${d.fy.replace(/^FY\s*/i, "")}` : ""}`} title="Your business," accent="through a CFO's eyes"
        sub="Margins, break-even, the expenses worth questioning, cash and runway — worked out from your posted entries."
        actions={<HeroFyPicker years={years} value={fy?.id ?? ""} onChange={setFy} />}
        tiles={d ? [
          { label: "Revenue", value: short(d.revenue), sub: `${d.period.months} month${d.period.months === 1 ? "" : "s"}` },
          { label: "Gross margin", value: d.grossMargin != null ? `${d.grossMargin}%` : "—", sub: `Gross profit ${short(d.gross)}`, tone: (d.grossMargin ?? 0) > 0 ? "good" : "bad" },
          { label: "Net margin", value: d.netMargin != null ? `${d.netMargin}%` : "—", sub: `${d.net >= 0 ? "Profit" : "Loss"} ${short(d.net)}`, tone: d.net >= 0 ? "good" : "bad" },
          { label: "Break-even / month", value: d.breakEvenMonth != null ? short(d.breakEvenMonth) : "—", sub: `You average ${short(d.avgMonthRevenue)}`, tone: d.breakEvenMonth != null && d.avgMonthRevenue >= d.breakEvenMonth ? "good" : "warn" },
          { label: "Cash today", value: short(d.cash.balance), sub: d.cash.runwayMonths != null ? `~${d.cash.runwayMonths} months runway` : d.cash.operating >= 0 ? "Operations bring cash in" : "", tone: d.cash.balance < 0 ? "bad" : "plain" },
        ] : undefined} />

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        {err && <div role="alert" style={{ ...card, background: "#FBE3DE", color: "#8A2A1A" }}>{err}</div>}
        {!d && !err && <div style={{ ...card, color: HT.muted, fontStyle: "italic" }}>Reading the year&apos;s books…</div>}
        {d && <>
          <section style={card}>
            <h2 style={h2}>What the numbers say</h2>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {d.insights.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: TONE[x.tone].bg, color: TONE[x.tone].fg, borderRadius: 12, padding: "10px 14px", fontSize: 15, lineHeight: 1.5 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: TONE[x.tone].dot, marginTop: 8, flexShrink: 0 }} />{x.text}
                </div>
              ))}
            </div>
          </section>

          <section style={card}>
            <h2 style={h2}>Month by month</h2>
            <p style={sub}>Revenue against costs (purchases + expenses); the line under each month is its profit or loss.</p>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minWidth: d.months.length * 64, height: 200, paddingTop: 8 }}>
                {d.months.map(m => (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${mon(m.month)}: revenue ${inr(m.revenue)}, costs ${inr(m.cogs + m.expenses)}, net ${inr(m.net)}`}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160 }}>
                      <span style={{ width: 14, height: `${(Math.max(0, m.revenue) / maxBar) * 160}px`, background: "#0B7A55", borderRadius: "4px 4px 0 0" }} />
                      <span style={{ width: 14, height: `${(Math.max(0, m.cogs + m.expenses) / maxBar) * 160}px`, background: "#C9A24A", borderRadius: "4px 4px 0 0" }} />
                    </div>
                    <span style={{ fontSize: 12, color: HT.muted }}>{mon(m.month)}</span>
                    <span style={{ fontSize: 11.5, color: m.net < 0 ? "#B4321F" : "#0B7A55", fontVariantNumeric: "tabular-nums" }}>{short(m.net)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: HT.muted, marginTop: 6 }}><span><span style={{ display: "inline-block", width: 10, height: 10, background: "#0B7A55", borderRadius: 2 }} /> Revenue</span><span><span style={{ display: "inline-block", width: 10, height: 10, background: "#C9A24A", borderRadius: 2 }} /> Costs</span></div>
          </section>

          <div className="cfo-grid">
            <section style={card}>
              <h2 style={h2}>Margins</h2>
              <p style={sub}>From sales down to profit.</p>
              {([["Revenue", d.revenue, null], ["− Purchases & direct costs", -d.cogs, null], ["= Gross profit", d.gross, d.grossMargin], ["+ Other income", d.otherIncome, null], ["− Operating expenses", -d.expenses, d.opexRatio], ["= Net profit", d.net, d.netMargin]] as [string, number, number | null][]).map(([k, v, p]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${HT.line}`, fontWeight: k.startsWith("=") ? 700 : 400 }}>
                  <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums", color: v < 0 ? "#B4321F" : HT.ink }}>{inr(v)}{p != null && <span style={{ color: HT.muted, fontWeight: 400, fontSize: 13 }}> · {p}%{k.includes("expenses") ? " of revenue" : ""}</span>}</span>
                </div>
              ))}
            </section>

            <section style={card}>
              <h2 style={h2}>Break-even</h2>
              <p style={sub}>Fixed costs (rent, salaries, interest, depreciation…) ÷ the share of each sale left after variable costs.</p>
              {([["Fixed costs (year)", inr(d.fixedCosts)], ["Variable costs (year)", inr(d.variableCosts)], ["Kept from each ₹100 of sales", d.contributionRatio != null ? `₹${d.contributionRatio}` : "—"], ["Break-even sales (year)", inr(d.breakEvenYear)], ["Break-even sales (month)", inr(d.breakEvenMonth)], ["Your average month", inr(d.avgMonthRevenue)], ["Margin of safety", d.safetyMargin != null ? `${d.safetyMargin}%` : "—"]] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${HT.line}` }}><span>{k}</span><b style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</b></div>
              ))}
              <p style={{ ...sub, marginTop: 10, marginBottom: 0 }}>Fixed or variable is judged from each ledger&apos;s name; purchases and direct costs count as variable.</p>
            </section>
          </div>

          <section style={card}>
            <h2 style={h2}>Expenses worth questioning</h2>
            <p style={sub}>Every expense head, largest first, with its share of revenue and how the last 3 months compare with the months before.</p>
            {flagged.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {flagged.slice(0, 8).map(h => <span key={h.name} style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 999, background: h.flag === "avoidable" ? "#FBE3DE" : h.flag === "jump" ? "#FBF1DA" : "#EEF0FB", color: h.flag === "avoidable" ? "#8A2A1A" : h.flag === "jump" ? "#7A5300" : "#3C4A85" }}>{h.flag === "avoidable" ? "Avoidable" : h.flag === "jump" ? "Jumped" : "Discretionary"} · {h.name}</span>)}
            </div>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 620 }}>
                <thead><tr style={{ color: HT.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>Expense</th><th style={{ padding: 8 }}>Year</th><th style={{ padding: 8 }}>% of revenue</th><th style={{ padding: 8 }}>Last 3 mo avg</th><th style={{ padding: 8 }}>Change</th><th style={{ textAlign: "left", padding: 8 }}>Type</th>
                </tr></thead>
                <tbody>{heads.map(h => (
                  <tr key={h.name} style={{ borderTop: `1px solid ${HT.line}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", padding: 8 }}>{h.name}{h.flag && <span style={{ marginLeft: 6, fontSize: 11, color: h.flag === "avoidable" ? "#B4321F" : "#9A6B22" }}>● {h.flag === "avoidable" ? "avoidable" : h.flag === "jump" ? "jumped" : "discretionary"}</span>}</td>
                    <td style={{ padding: 8, fontVariantNumeric: "tabular-nums" }}>{inr(h.amount)}</td>
                    <td style={{ padding: 8 }}>{h.share}%</td>
                    <td style={{ padding: 8, fontVariantNumeric: "tabular-nums" }}>{inr(h.recent)}</td>
                    <td style={{ padding: 8, color: h.change != null && h.change > 0 ? "#B4321F" : "#0B7A55" }}>{h.change != null ? `${h.change > 0 ? "+" : ""}${h.change}%` : "—"}</td>
                    <td style={{ textAlign: "left", padding: 8, color: HT.muted }}>{h.kind}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {d.heads.length > 10 && <button onClick={() => setAllHeads(v => !v)} style={{ marginTop: 8, border: "none", background: "none", color: "#9A6B22", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>{allHeads ? "Show fewer" : `Show all ${d.heads.length}`}</button>}
          </section>

          <div className="cfo-grid">
            <section style={card}>
              <h2 style={h2}>Cash flow</h2>
              <p style={sub}>Where cash came from and went, this year.</p>
              {([["Opening cash & bank", d.cash.opening], ["From operations", d.cash.operating], ["From investing (assets)", d.cash.investing], ["From financing (loans, capital)", d.cash.financing], ["Closing cash & bank", d.cash.closing]] as [string, number][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${HT.line}`, fontWeight: /Opening|Closing/.test(k) ? 700 : 400 }}><span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums", color: v < 0 ? "#B4321F" : HT.ink }}>{inr(v)}</span></div>
              ))}
              {d.cash.avgBurn != null && <p style={{ ...sub, marginTop: 10, marginBottom: 0, color: "#8A2A1A" }}>Operations use about {inr(d.cash.avgBurn)} a month{d.cash.runwayMonths != null ? ` — about ${d.cash.runwayMonths} months of cash left at this pace` : ""}.</p>}
              <Link href="/finance/reports?tab=cash_flow" style={{ display: "inline-block", marginTop: 10, color: "#9A6B22", fontSize: 14 }}>Full cash flow statement →</Link>
            </section>

            <section style={card}>
              <h2 style={h2}>Working capital</h2>
              <p style={sub}>How fast money comes in and goes out.</p>
              {([["Customers owe", inr(d.receivables)], ["Days to collect (DSO)", d.dso != null ? `${d.dso} days` : "—"], ["You owe suppliers", inr(d.payables)], ["Days to pay (DPO)", d.dpo != null ? `${d.dpo} days` : "—"]] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${HT.line}` }}><span>{k}</span><b style={{ fontWeight: 600 }}>{v}</b></div>
              ))}
              {d.topCustomers.length > 0 && <>
                <div style={{ marginTop: 14, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9A6B22" }}>Top customers by sales</div>
                {d.topCustomers.map(c => (
                  <div key={c.name} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center", padding: "6px 0" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}<span aria-hidden="true" style={{ display: "block", height: 5, borderRadius: 99, background: "#EFE6D3", marginTop: 4 }}><span style={{ display: "block", height: "100%", width: `${Math.min(100, c.share)}%`, background: "#12352D", borderRadius: 99 }} /></span></span>
                    <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{short(c.amount)} · {c.share}%</span>
                  </div>
                ))}
              </>}
            </section>
          </div>
          <p style={{ fontSize: 12.5, color: HT.muted }}>From posted entries {d.period.from} to {d.period.to}. Ledgers grouped wrongly (a sales ledger outside Sales Accounts, an expense under assets) change these figures — fix them with Edit ledger.</p>
        </>}
      </main>
    </div>
  );
}
