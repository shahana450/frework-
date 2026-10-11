"use client";
// GSTR-3B worksheet: Tables 3.1, 3.2, 4 and 6.1 (tax payment with ITC set-off), with late fee and interest.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { usePortalFilings } from "@/lib/portals/usePortalFilings";
import { filingFor, filedLine } from "@/lib/portals/filings";
import { setOff, gstLateFee, gstInterest, sumTax, ZERO, type Tax, type Table3 } from "@/lib/gstReturns";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", pos: "#0B7A55", posSoft: "#E3F6EE", amber: "#8A5A00", amberSoft: "#FFF4DB", neg: "#C2321F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const KEYS: (keyof Tax)[] = ["igst", "cgst", "sgst", "cess"];
const LABEL: Record<keyof Tax, string> = { igst: "Integrated", cgst: "Central", sgst: "State/UT", cess: "Cess" };
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function lastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); }
type Resp = { period: string; gstin: string; state: string | null; table3: Table3; itc: Tax; rcm: Tax; derivedDocs: number };

// Defined outside the page so its inputs keep focus while typing
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}><b style={{ fontFamily: SERIF, fontSize: "1.15rem", flex: 1 }}>{title}</b>{action}</div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </section>
  );
}

export default function Gstr3bPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [month, setMonth] = useState(lastMonth());
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [itc, setItc] = useState<Tax>(ZERO);
  const [reversal, setReversal] = useState<Tax>(ZERO);
  const [aato, setAato] = useState(1e7);
  const [filedOn, setFiledOn] = useState("");
  const [copied, setCopied] = useState("");
  const portal = usePortalFilings(bizId);
  const filed = filingFor(portal.statuses, "GSTR-3B", month);

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
    fetch(`/api/finance/gst?business_id=${bizId}&month=${month}&report=gstr3b`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d as Resp; })
      .then(d => { setData(d); setItc(d.itc); setReversal(ZERO); })
      .catch(e => setErr(e instanceof Error && e.message ? e.message : "Couldn't prepare GSTR-3B.")).finally(() => setLoading(false));
  }, [bizId, month]);

  const t = data?.table3;
  const liability: Tax = useMemo(() => t ? { igst: t.a.igst + t.b.igst + t.d.igst, cgst: t.a.cgst + t.b.cgst + t.d.cgst, sgst: t.a.sgst + t.b.sgst + t.d.sgst, cess: t.a.cess + t.b.cess + t.d.cess } : ZERO, [t]);
  const netItc: Tax = useMemo(() => ({ igst: Math.max(0, itc.igst - reversal.igst), cgst: Math.max(0, itc.cgst - reversal.cgst), sgst: Math.max(0, itc.sgst - reversal.sgst), cess: Math.max(0, itc.cess - reversal.cess) }), [itc, reversal]);
  // Reverse-charge tax (3.1(d)) must be paid in cash — it can't be set off against ITC
  const forSetOff: Tax = useMemo(() => t ? { igst: liability.igst - t.d.igst, cgst: liability.cgst - t.d.cgst, sgst: liability.sgst - t.d.sgst, cess: liability.cess - t.d.cess } : ZERO, [t, liability]);
  const so = useMemo(() => setOff(forSetOff, netItc), [forSetOff, netItc]);
  const cash: Tax = { igst: so.cash.igst + (t?.d.igst ?? 0), cgst: so.cash.cgst + (t?.d.cgst ?? 0), sgst: so.cash.sgst + (t?.d.sgst ?? 0), cess: so.cash.cess + (t?.d.cess ?? 0) };
  const [y, m] = month.split("-").map(Number);
  const due = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 20)).toISOString().slice(0, 10);
  const daysLate = filedOn && filedOn > due ? Math.round((Date.parse(filedOn) - Date.parse(due)) / 86400000) : 0;
  const nil = sumTax(liability) === 0 && (t?.a.taxable ?? 0) === 0;
  const fee = gstLateFee(daysLate, nil, aato);
  const interest = gstInterest(sumTax(cash), daysLate);

  function copy(label: string, rows: [string, Tax & { taxable?: number }][]) {
    const text = [["Details", "Taxable", ...KEYS.map(k => LABEL[k])].join("\t"), ...rows.map(([l, r]) => [l, (r.taxable ?? 0).toFixed(2), ...KEYS.map(k => r[k].toFixed(2))].join("\t"))].join("\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1600); });
  }
  async function exportExcel() {
    if (!t) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const row = (l: string, r: Tax & { taxable?: number }) => [l, r.taxable ?? "", ...KEYS.map(k => r[k])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["GSTR-3B", data!.gstin, month], [], ["Table 3.1", "Taxable", ...KEYS.map(k => LABEL[k])],
      row("(a) Outward taxable supplies", t.a), row("(b) Zero rated", t.b), row("(c) Nil rated / exempted", t.c), row("(d) Inward supplies (reverse charge)", t.d), row("(e) Non-GST", t.e),
      [], ["Table 3.2 — Inter-state to unregistered", "Place of supply", "Taxable", "Integrated"], ...t.inter.map(x => ["", x.pos, x.taxable, x.igst]),
      [], ["Table 4", "", ...KEYS.map(k => LABEL[k])], row("4(A)(5) All other ITC", itc), row("4(B) ITC reversed", reversal), row("4(C) Net ITC", netItc),
      [], ["Table 6.1", "", ...KEYS.map(k => LABEL[k])], row("Tax payable", liability), row("Paid through IGST credit", so.fromIgst), row("Paid through CGST credit", so.fromCgst), row("Paid through SGST credit", so.fromSgst), row("Paid through Cess credit", so.fromCess), row("Paid in cash", cash),
      [], ["Late fee", fee.fee], ["Interest (Sec 50)", interest]]), "GSTR-3B");
    XLSX.writeFile(wb, `GSTR-3B-${month}.xlsx`);
  }

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" };
  const btn = (primary: boolean): React.CSSProperties => ({ height: 40, padding: "0 16px", borderRadius: 999, border: primary ? "none" : "1px solid #D9CDB2", background: primary ? C.forest : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" });
  const th: React.CSSProperties = { textAlign: "right", padding: "8px 10px", fontSize: 11.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.line}` };
  const td: React.CSSProperties = { padding: "7px 10px", textAlign: "right", fontFamily: MONO, fontSize: 13 };
  const editRow = (val: Tax, set: (t: Tax) => void) => KEYS.map(k => <td key={k} style={td}><input inputMode="decimal" aria-label={LABEL[k]} value={val[k] || ""} placeholder="0" onChange={e => set({ ...val, [k]: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} style={{ width: 110, height: 32, borderRadius: 8, border: `1px solid ${C.line}`, textAlign: "right", fontFamily: MONO, padding: "0 8px" }} /></td>);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Link href="/finance/gst/returns" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420", textDecoration: "none" }}>← GST RETURNS</Link>
            <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", fontWeight: 700 }}>GSTR-3B</h1>
            <div style={{ fontSize: 13, color: C.muted }}>{data?.gstin || "GSTIN not set"} · due {new Date(due).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Return month" style={{ height: 40, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 10px", fontFamily: "inherit" }} />
            <button onClick={exportExcel} disabled={!t} style={btn(false)}>⬇ Excel</button>
          </div>
        </header>
        {filed && <div role="status" style={{ background: "#E3F6EE", color: "#0B7A55", borderRadius: 12, padding: "10px 14px", fontWeight: 700, overflowWrap: "anywhere" }}>✓ {filedLine(filed)} — from the GST portal via <Link href="/finance/portals" style={{ color: "#0B7A55" }}>Portal Connect</Link>.</div>}
        {err && <div role="alert" style={{ background: "#FDECEA", color: C.neg, borderRadius: 12, padding: "10px 14px", fontWeight: 700 }}>{err}</div>}
        {loading && <div style={{ color: C.muted }}>Preparing the return from your books…</div>}

        {t && (
          <>
            <div style={{ ...card, background: C.forest, color: "#FFFFFF", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }} className="g3-sum">
              {[["Tax on sales", sumTax(liability)], ["ITC used", sumTax(liability) - sumTax(cash)], ["Pay in cash", sumTax(cash) + fee.fee + interest]].map(([l, v]) => (
                <div key={l as string}><div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, fontWeight: 800 }}>{l}</div><div style={{ fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 700 }}>{inr(v as number)}</div></div>
              ))}
            </div>
            {data!.derivedDocs > 0 && <div style={{ background: C.amberSoft, color: C.amber, borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{data!.derivedDocs} sale(s) were booked by chat without item detail — their rate was worked out from the tax amount. Check Table 3.1 before filing.</div>}

            <Section title="3.1 Outward and reverse-charge supplies" action={<button onClick={() => copy("31", [["(a)", t.a], ["(b)", t.b], ["(c)", t.c], ["(d)", t.d], ["(e)", t.e]])} style={btn(false)}>{copied === "31" ? "✓ Copied" : "Copy"}</button>}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={{ ...th, textAlign: "left" }}>Nature of supplies</th><th style={th}>Taxable value</th>{KEYS.map(k => <th key={k} style={th}>{LABEL[k]}</th>)}</tr></thead>
                <tbody>{([["(a) Outward taxable supplies", t.a], ["(b) Zero rated (exports, SEZ)", t.b], ["(c) Nil rated & exempted", t.c], ["(d) Inward supplies liable to reverse charge", t.d], ["(e) Non-GST outward supplies", t.e]] as const).map(([l, r]) => (
                  <tr key={l} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "7px 10px", fontSize: 13.5 }}>{l}</td><td style={td}>{inr(r.taxable)}</td>{KEYS.map(k => <td key={k} style={td}>{inr(r[k])}</td>)}</tr>
                ))}</tbody>
              </table>
            </Section>

            <Section title="3.2 Inter-state supplies to unregistered persons">
              {t.inter.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ ...th, textAlign: "left" }}>Place of supply</th><th style={th}>Taxable value</th><th style={th}>Integrated tax</th></tr></thead>
                  <tbody>{t.inter.map(x => <tr key={x.pos} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "7px 10px" }}>{x.pos}</td><td style={td}>{inr(x.taxable)}</td><td style={td}>{inr(x.igst)}</td></tr>)}</tbody>
                </table>
              ) : <div style={{ fontSize: 13, color: C.muted }}>None this month.</div>}
            </Section>

            <Section title="4 Eligible ITC" action={<Link href="/finance/gst/itc" style={{ ...btn(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Match with GSTR-2B →</Link>}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={{ ...th, textAlign: "left" }}>Details</th>{KEYS.map(k => <th key={k} style={th}>{LABEL[k]}</th>)}</tr></thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "7px 10px", fontSize: 13.5 }}>4(A)(5) All other ITC <span style={{ color: C.muted, fontSize: 12 }}>(from books — replace with GSTR-2B figures)</span></td>{editRow(itc, setItc)}</tr>
                  <tr style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "7px 10px", fontSize: 13.5 }}>4(B) ITC reversed <span style={{ color: C.muted, fontSize: 12 }}>(17(5) blocked, Rules 38/42/43, others)</span></td>{editRow(reversal, setReversal)}</tr>
                  <tr style={{ background: "#F3EDE1", fontWeight: 800 }}><td style={{ padding: "7px 10px" }}>4(C) Net ITC available</td>{KEYS.map(k => <td key={k} style={td}>{inr(netItc[k])}</td>)}</tr>
                </tbody>
              </table>
            </Section>

            <Section title="6.1 Payment of tax" action={<button onClick={() => copy("61", [["Tax payable", liability], ["Paid through IGST credit", so.fromIgst], ["Paid through CGST credit", so.fromCgst], ["Paid through SGST credit", so.fromSgst], ["Paid through Cess credit", so.fromCess], ["Paid in cash", cash]])} style={btn(false)}>{copied === "61" ? "✓ Copied" : "Copy"}</button>}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={{ ...th, textAlign: "left" }}>Details</th>{KEYS.map(k => <th key={k} style={th}>{LABEL[k]}</th>)}</tr></thead>
                <tbody>{([["Tax payable", liability], ["Paid through IGST credit", so.fromIgst], ["Paid through CGST credit", so.fromCgst], ["Paid through SGST credit", so.fromSgst], ["Paid through Cess credit", so.fromCess], ["Paid in cash", cash], ["ITC carried forward", so.itcLeft]] as const).map(([l, r]) => (
                  <tr key={l} style={{ borderBottom: `1px solid ${C.line}`, background: l === "Paid in cash" ? "#F3EDE1" : "transparent", fontWeight: l === "Paid in cash" ? 800 : 500 }}><td style={{ padding: "7px 10px", fontSize: 13.5 }}>{l}</td>{KEYS.map(k => <td key={k} style={td}>{inr(r[k])}</td>)}</tr>
                ))}</tbody>
              </table>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>IGST credit is used first (IGST, then CGST, then SGST). CGST credit never pays SGST, nor SGST credit CGST. Reverse-charge tax is always paid in cash.</div>
            </Section>

            <Section title="Late fee & interest">
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 13.5 }}>
                <label>Filing date <input type="date" value={filedOn} onChange={e => setFiledOn(e.target.value)} style={{ height: 36, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 8px", fontFamily: "inherit" }} /></label>
                <label>Last year&apos;s turnover (₹) <input inputMode="numeric" value={aato} onChange={e => setAato(Number(e.target.value.replace(/\D/g, "")) || 0)} style={{ height: 36, width: 140, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 8px", fontFamily: MONO }} /></label>
                <span>{daysLate ? <>{daysLate} days late · late fee <b>{inr(fee.fee)}</b> (₹{fee.perDay}/day, max ₹{fee.cap.toLocaleString("en-IN")}) · interest @18% <b>{inr(interest)}</b></> : "On time — no late fee or interest."}</span>
              </div>
            </Section>

            <section style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ flex: 1, minWidth: 220 }}>File it: GST portal → Returns → GSTR-3B → enter these tables (or paste with Copy) → pay the cash amount → file with EVC/DSC.</b>
              <Link href="/order?service=gst-registration" style={{ ...btn(true), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Get it filed by an expert</Link>
            </section>
          </>
        )}
      </div>
      <style>{`@media (max-width: 760px) { .g3-sum { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
