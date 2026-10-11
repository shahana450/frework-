"use client";
// GSTR-9 annual return worksheet: outward supplies, ITC and tax for the year from the books, month by month.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { gstr9LateFee, sumTax, type Tax, type Table3 } from "@/lib/gstReturns";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", amber: "#8A5A00", amberSoft: "#FFF4DB", neg: "#C2321F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const KEYS: (keyof Tax)[] = ["igst", "cgst", "sgst", "cess"];
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Total = { taxable: number; tax: number; count: number };
type Month = Tax & { month: string; taxable: number; itc: Tax };
type Resp = { period: string; gstin: string; table3: Table3; itc: Tax; rcm: Tax; months: Month[]; outward: { b2b: Total; b2c: Total; creditNotes: Total } };

export default function AnnualPage() {
  const router = useRouter();
  const now = new Date();
  const lastFy = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
  const [bizId, setBizId] = useState("");
  const [fy, setFy] = useState(lastFy);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [filedOn, setFiledOn] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; } setBizId(saved);
    });
  }, [router]);
  useEffect(() => {
    if (!bizId) return;
    setLoading(true); setErr("");
    fetch(`/api/finance/gst?business_id=${bizId}&fy=${fy}&report=annual`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d as Resp; })
      .then(setData).catch(e => setErr(e instanceof Error && e.message ? e.message : "Couldn't prepare the annual summary.")).finally(() => setLoading(false));
  }, [bizId, fy]);

  const due = `${fy + 1}-12-31`;
  const daysLate = filedOn && filedOn > due ? Math.round((Date.parse(filedOn) - Date.parse(due)) / 86400000) : 0;
  const turnover = data ? data.outward.b2b.taxable + data.outward.b2c.taxable - data.outward.creditNotes.taxable : 0;
  const fee = gstr9LateFee(daysLate, turnover);

  async function exportExcel() {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const t = data.table3;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["GSTR-9 worksheet", data.gstin, data.period], [],
      ["Pt II · Table 4 — Outward supplies on which tax is payable", "Taxable", "Tax", "Documents"],
      ["4A Supplies to unregistered persons (B2C)", data.outward.b2c.taxable, data.outward.b2c.tax, data.outward.b2c.count],
      ["4B Supplies to registered persons (B2B)", data.outward.b2b.taxable, data.outward.b2b.tax, data.outward.b2b.count],
      ["4I Credit notes", -data.outward.creditNotes.taxable, -data.outward.creditNotes.tax, data.outward.creditNotes.count],
      ["4G Inward supplies on reverse charge", t.d.taxable, sumTax(t.d), ""],
      ["5D/5E Exempted / nil rated", t.c.taxable, "", ""], [],
      ["Pt III · Table 6 — ITC availed", "Integrated", "Central", "State/UT", "Cess"], ["6B Inward supplies (books)", ...KEYS.map(k => data.itc[k])], [],
      ["Pt IV · Table 9 — Tax payable", "Integrated", "Central", "State/UT", "Cess"], ["Tax on outward supplies + reverse charge", ...KEYS.map(k => t.a[k] + t.d[k])], [],
      ["Month", "Taxable", "Integrated", "Central", "State/UT", "Cess", "ITC (books)"],
      ...data.months.map(m => [m.month, m.taxable, m.igst, m.cgst, m.sgst, m.cess, sumTax(m.itc)]),
    ]), "GSTR-9");
    XLSX.writeFile(wb, `GSTR-9-${data.period.replace(/\s/g, "")}.xlsx`);
  }

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" };
  const btn = (primary: boolean): React.CSSProperties => ({ height: 40, padding: "0 16px", borderRadius: 999, border: primary ? "none" : "1px solid #D9CDB2", background: primary ? C.forest : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" });
  const td: React.CSSProperties = { padding: "7px 10px", textAlign: "right", fontFamily: MONO, fontSize: 13 };
  const th: React.CSSProperties = { ...td, fontFamily: "inherit", fontSize: 11.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.line}` };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Link href="/finance/gst/returns" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420", textDecoration: "none" }}>← GST RETURNS</Link>
            <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", fontWeight: 700 }}>GSTR-9 annual return</h1>
            <div style={{ fontSize: 13, color: C.muted }}>{data?.gstin || ""} · due 31 Dec {fy + 1} · GSTR-9C (reconciliation) is self-certified when turnover exceeds ₹5 crore</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={fy} onChange={e => setFy(Number(e.target.value))} aria-label="Financial year" style={{ height: 40, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 10px", fontFamily: "inherit" }}>
              {[0, 1, 2, 3].map(i => <option key={i} value={lastFy + 1 - i}>FY {lastFy + 1 - i}-{String(lastFy + 2 - i).slice(2)}</option>)}
            </select>
            <button onClick={exportExcel} disabled={!data} style={btn(false)}>⬇ Excel</button>
          </div>
        </header>
        {err && <div role="alert" style={{ background: "#FDECEA", color: C.neg, borderRadius: 12, padding: "10px 14px", fontWeight: 700 }}>{err}</div>}
        {loading && <div style={{ color: C.muted }}>Adding up the year…</div>}
        {data && (
          <>
            <div style={{ ...card, background: C.forest, color: "#FFFFFF", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }} className="g9-sum">
              {[["Turnover (taxable)", turnover], ["Tax on sales", data.outward.b2b.tax + data.outward.b2c.tax - data.outward.creditNotes.tax], ["ITC availed (books)", sumTax(data.itc)]].map(([l, v]) => (
                <div key={l as string}><div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, fontWeight: 800 }}>{l}</div><div style={{ fontFamily: SERIF, fontSize: "1.7rem", fontWeight: 700 }}>{inr(v as number)}</div></div>
              ))}
            </div>
            <section style={card}>
              <b style={{ fontFamily: SERIF, fontSize: "1.15rem" }}>Table 4 — Outward supplies</b>
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, marginTop: 8 }}>
                <thead><tr><th style={{ ...th, textAlign: "left" }}>Nature</th><th style={th}>Documents</th><th style={th}>Taxable</th><th style={th}>Tax</th></tr></thead>
                <tbody>{([["4A To unregistered persons (B2C)", data.outward.b2c], ["4B To registered persons (B2B)", data.outward.b2b], ["4I Credit notes (less)", data.outward.creditNotes]] as const).map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "7px 10px" }}>{l}</td><td style={td}>{v.count}</td><td style={td}>{inr(v.taxable)}</td><td style={td}>{inr(v.tax)}</td></tr>))}
                </tbody></table></div>
            </section>
            <section style={card}>
              <b style={{ fontFamily: SERIF, fontSize: "1.15rem" }}>Month by month</b>
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, marginTop: 8 }}>
                <thead><tr><th style={{ ...th, textAlign: "left" }}>Month</th><th style={th}>Taxable</th><th style={th}>Tax on sales</th><th style={th}>ITC (books)</th><th style={th}>Net</th></tr></thead>
                <tbody>{data.months.map(m => { const tax = m.igst + m.cgst + m.sgst + m.cess; return (
                  <tr key={m.month} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "7px 10px" }}>{new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</td><td style={td}>{inr(m.taxable)}</td><td style={td}>{inr(tax)}</td><td style={td}>{inr(sumTax(m.itc))}</td><td style={td}>{inr(tax - sumTax(m.itc))}</td></tr>); })}
                </tbody></table></div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Compare each month with the GSTR-1 and GSTR-3B you filed; differences go in Tables 10–14 of GSTR-9. ITC should be confirmed against GSTR-2B (use ITC Match).</div>
            </section>
            <section style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 13.5 }}>
              <label>Filing date <input type="date" value={filedOn} onChange={e => setFiledOn(e.target.value)} style={{ height: 36, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 8px", fontFamily: "inherit" }} /></label>
              <span style={{ flex: 1 }}>{daysLate ? <>{daysLate} days late · late fee <b>{inr(fee.fee)}</b> (₹{fee.perDay}/day, capped at {inr(fee.cap)})</> : "On time — no late fee."}</span>
              <Link href="/order?service=gst-registration" style={{ ...btn(true), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Get it filed by an expert</Link>
            </section>
          </>
        )}
      </div>
      <style>{`@media (max-width: 760px) { .g9-sum { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
