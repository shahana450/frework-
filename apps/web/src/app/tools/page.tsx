"use client";
// Free tools — GST late fee & interest, GSTR-9 late fee, advance tax, e-invoice check. No login needed.
import { useState } from "react";
import Link from "next/link";
import { gstLateFee, gstr9LateFee, gstInterest, advanceTax, eInvoiceApplies } from "@/lib/gstReturns";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", pos: "#0B7A55", neg: "#C2321F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const days = (a: string, b: string) => a && b && b > a ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : 0;
const numIn = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;

const TOOLS = [
  { key: "late", title: "GST late fee & interest", sub: "GSTR-1 / GSTR-3B" },
  { key: "g9", title: "GSTR-9 late fee", sub: "Annual return" },
  { key: "adv", title: "Advance tax", sub: "Instalments & Section 234C" },
  { key: "einv", title: "E-invoice check", sub: "Does it apply to you?" },
] as const;

export default function FreeTools() {
  const [tool, setTool] = useState<(typeof TOOLS)[number]["key"]>("late");
  // late fee
  const [due, setDue] = useState(""); const [filed, setFiled] = useState(""); const [nil, setNil] = useState(false); const [aato, setAato] = useState("10000000"); const [cashTax, setCashTax] = useState("");
  // GSTR-9
  const [g9filed, setG9filed] = useState(""); const [g9fy, setG9fy] = useState(String(new Date().getFullYear() - 1)); const [g9to, setG9to] = useState("10000000");
  // advance tax
  const [tax, setTax] = useState("100000"); const [paid, setPaid] = useState(["", "", "", ""]); const [presumptive, setPresumptive] = useState(false);
  // e-invoice
  const [maxTo, setMaxTo] = useState("");

  const dl = days(due, filed);
  const lf = gstLateFee(dl, nil, numIn(aato));
  const g9days = days(`${Number(g9fy) + 1}-12-31`, g9filed);
  const g9 = gstr9LateFee(g9days, numIn(g9to));
  const adv = advanceTax(numIn(tax), paid.map(numIn) as [number, number, number, number], presumptive);

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "18px 20px" };
  const field: React.CSSProperties = { height: 42, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: "inherit", fontSize: 15, width: "100%", boxSizing: "border-box" };
  const lab = (t: string, el: React.ReactNode) => <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, color: C.muted, fontWeight: 600 }}>{t}{el}</label>;
  const Result = ({ big, small }: { big: string; small: React.ReactNode }) => (
    <div style={{ background: C.forest, color: "#FFFFFF", borderRadius: 16, padding: "16px 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 700 }}>{big}</div><div style={{ fontSize: 13.5, color: "#C9D3CE", lineHeight: 1.6 }}>{small}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(16px,4vw,48px) clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 20 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "1.3rem", color: C.forest, textDecoration: "none" }}>FreWork</Link>
          <Link href="/register" style={{ height: 40, padding: "0 16px", borderRadius: 999, background: C.forest, color: "#FFFFFF", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Try FreBook free</Link>
        </nav>
        <header>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>FREE TOOLS</div>
          <h1 style={{ margin: "6px 0", fontFamily: SERIF, fontSize: "clamp(2rem,4.6vw,3.2rem)", fontWeight: 700, lineHeight: 1.08 }}>Tax calculators for <span style={{ fontStyle: "italic", fontWeight: 400, color: "#8A6420" }}>Indian businesses</span></h1>
          <p style={{ margin: 0, color: C.muted, fontSize: 15.5, maxWidth: 620 }}>Quick answers before you file. Based on the rules as we understand them — confirm with the latest notifications or your tax adviser.</p>
        </header>

        <div role="tablist" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          {TOOLS.map(t => (
            <button key={t.key} role="tab" aria-selected={tool === t.key} onClick={() => setTool(t.key)} style={{ ...card, padding: "14px 16px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderColor: tool === t.key ? C.forest : C.line, background: tool === t.key ? C.forest : C.card, color: tool === t.key ? "#FFFFFF" : C.ink }}>
              <b style={{ display: "block", fontSize: 15.5 }}>{t.title}</b><span style={{ fontSize: 12.5, color: tool === t.key ? C.gold : C.muted }}>{t.sub}</span>
            </button>
          ))}
        </div>

        <section style={{ ...card, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }} className="tl-grid">
          {tool === "late" && <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {lab("Due date", <input type="date" value={due} onChange={e => setDue(e.target.value)} style={field} />)}
              {lab("Date filed (or today)", <input type="date" value={filed} onChange={e => setFiled(e.target.value)} style={field} />)}
              {lab("Last year's turnover (₹)", <input inputMode="numeric" value={aato} onChange={e => setAato(e.target.value)} style={{ ...field, fontFamily: MONO }} />)}
              {lab("Tax paid in cash late (₹, for interest)", <input inputMode="numeric" value={cashTax} onChange={e => setCashTax(e.target.value)} style={{ ...field, fontFamily: MONO }} />)}
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={nil} onChange={e => setNil(e.target.checked)} /> Nil return</label>
            </div>
            <Result big={inr(lf.fee + gstInterest(numIn(cashTax), dl))} small={<>{dl} days late · late fee {inr(lf.fee)} (₹{lf.perDay}/day CGST+SGST, capped at ₹{lf.cap.toLocaleString("en-IN")}) · interest @18% a year {inr(gstInterest(numIn(cashTax), dl))}</>} />
          </>}
          {tool === "g9" && <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {lab("Financial year (starting)", <select value={g9fy} onChange={e => setG9fy(e.target.value)} style={field}>{[0, 1, 2, 3].map(i => { const y = new Date().getFullYear() - 1 - i; return <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)}</option>; })}</select>)}
              {lab("Date filed (or today)", <input type="date" value={g9filed} onChange={e => setG9filed(e.target.value)} style={field} />)}
              {lab("Turnover in the state for the year (₹)", <input inputMode="numeric" value={g9to} onChange={e => setG9to(e.target.value)} style={{ ...field, fontFamily: MONO }} />)}
            </div>
            <Result big={inr(g9.fee)} small={<>{g9days} days after 31 Dec {Number(g9fy) + 1} · ₹{g9.perDay}/day, capped at {inr(g9.cap)}. GSTR-9 is optional when turnover is up to ₹2 crore.</>} />
          </>}
          {tool === "adv" && <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {lab("Estimated tax for the year (₹)", <input inputMode="numeric" value={tax} onChange={e => setTax(e.target.value)} style={{ ...field, fontFamily: MONO }} />)}
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={presumptive} onChange={e => setPresumptive(e.target.checked)} /> Presumptive income (44AD / 44ADA) — pay all by 15 March</label>
              {!presumptive && ["By 15 Jun", "15 Jun–15 Sep", "15 Sep–15 Dec", "15 Dec–15 Mar"].map((l, i) => lab(`Paid ${l} (₹)`, <input key={l} inputMode="numeric" value={paid[i]} onChange={e => setPaid(p => p.map((x, k) => k === i ? e.target.value : x))} style={{ ...field, fontFamily: MONO }} />))}
            </div>
            {adv.applicable ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Result big={inr(adv.interest)} small="Interest under Section 234C on short instalments (1% a month)." />
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead><tr>{["Due", "Must have paid", "Shortfall", "Interest"].map(h => <th key={h} style={{ textAlign: h === "Due" ? "left" : "right", padding: "6px 4px", fontSize: 11.5, color: C.muted, borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
                  <tbody>{adv.rows.map(r => <tr key={r.due} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "6px 4px" }}>{r.due} ({Math.round(r.cumulativePct * 100)}%)</td><td style={{ textAlign: "right", fontFamily: MONO }}>{inr(r.required)}</td><td style={{ textAlign: "right", fontFamily: MONO }}>{inr(r.shortfall)}</td><td style={{ textAlign: "right", fontFamily: MONO }}>{inr(r.interest)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <Result big="Not needed" small="Advance tax applies when the year's tax is ₹10,000 or more." />}
          </>}
          {tool === "einv" && <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {lab("Highest yearly turnover since FY 2017-18 (₹)", <input inputMode="numeric" value={maxTo} onChange={e => setMaxTo(e.target.value)} placeholder="e.g. 62000000" style={{ ...field, fontFamily: MONO }} />)}
            </div>
            <Result big={maxTo ? (eInvoiceApplies(numIn(maxTo)) ? "Yes — e-invoicing applies" : "Not required") : "Enter turnover"} small="E-invoicing applies to B2B invoices once aggregate turnover crossed ₹5 crore in any financial year from 2017-18 (some sectors are exempt)." />
          </>}
        </section>

        <section style={{ ...card, background: C.forest, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <b style={{ fontFamily: SERIF, fontSize: "1.35rem" }}>Let FreBook prepare the returns for you</b>
            <div style={{ fontSize: 14, color: "#C9D3CE" }}>Drop your statements and bills — GSTR-1, GSTR-3B and ITC matching come straight from your books.</div>
          </div>
          <Link href="/register" style={{ height: 44, padding: "0 20px", borderRadius: 999, background: C.gold, color: C.forest, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Start free →</Link>
        </section>
      </div>
      <style>{`@media (max-width: 760px) { .tl-grid { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
