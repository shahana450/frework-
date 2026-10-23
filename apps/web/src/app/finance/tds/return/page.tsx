"use client";
// Quarterly TDS return (non-salary): Form 140 from FY 2026-27 (26Q before). Prepared from the books — deductees,
// sections, challans, what to fix — exported to Excel for the return utility, plus a TDS statement per deductee.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { writeStyledWorkbook } from "@/lib/styledWorkbook";
import type { TdsQuarter, Deduction } from "@/lib/tdsReturn";

const C = { bg: "#F5F6FA", card: "#FFFFFF", ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN");
type Data = TdsQuarter & { fy: string; deductor: { name: string; tan: string | null; pan: string | null } };

/** The quarter just ended (returns are filed after the quarter) and the three before it. */
function quarters(): { key: string; label: string }[] {
  const d = new Date(), m = d.getMonth() + 1, y = d.getFullYear();
  let fy = m >= 4 ? y : y - 1, q = m >= 4 ? Math.ceil((m - 3) / 3) : 4;
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    q--; if (q === 0) { q = 4; fy--; }
    out.push({ key: `${fy}-Q${q}`, label: `Q${q} ${["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"][q - 1]} · FY ${fy}-${String(fy + 1).slice(2)}` });
  }
  return out;
}

export default function TdsReturnPage() {
  const router = useRouter();
  const qs = useMemo(quarters, []);
  const [bizId, setBizId] = useState("");
  const [quarter, setQuarter] = useState(qs[0].key);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [cert, setCert] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const b = (readActiveBusiness(user.id) ?? "").trim();
      if (!b) { router.push("/finance/setup"); return; }
      setBizId(b);
    });
  }, [router]);
  useEffect(() => {
    if (!bizId) return;
    setData(null); setErr("");
    fetch(`/api/finance/tds-return?business_id=${bizId}&quarter=${quarter}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't prepare the return."); else setData(d);
    });
  }, [bizId, quarter]);

  async function excel() {
    if (!data) return;
    const head = (t: string) => [[t], [data.deductor.name], [`${data.form} · ${qs.find(q => q.key === quarter)?.label ?? quarter} · TAN ${data.deductor.tan ?? "—"}`], []];
    await writeStyledWorkbook([
      { name: "Deductees", widths: [6, 30, 14, 26, 12, 10, 12, 16, 14, 8, 14], moneyFrom: 7, rows: [...head("Deductee details"),
        ["Sl", "Deductee", "PAN", "Nature of payment", "Section (2025 Act)", "Old section", "Payment code", "Amount paid / credited", "TDS deducted", "Rate %", "Date"],
        ...data.deductions.map((d, i) => [i + 1, d.party, d.pan ?? "PAN MISSING", d.nature.label, d.nature.ref, d.nature.old, d.nature.code || "choose", d.paid, d.tds, d.rate, dmy(d.date)])] },
      { name: "Challans", widths: [6, 16, 14, 16, 16, 16], moneyFrom: 3, rows: [...head("Challans (TDS deposited)"),
        ["Sl", "Entry", "Date", "Amount", "BSR code", "Challan no."],
        ...data.challans.map((c, i) => [i + 1, c.entryNo, dmy(c.date), c.amount, "", ""])] },
      { name: "Summary", widths: [36, 12, 12, 18, 16], moneyFrom: 3, rows: [...head("Section-wise summary"),
        ["Nature of payment", "Section", "Deductees", "Amount paid", "TDS"],
        ...data.bySection.map(s => [s.nature.label, s.nature.ref, s.count, s.paid, s.tds]),
        ["Total", "", data.deductions.length, data.deductions.reduce((t, d) => t + d.paid, 0), data.totalTds]] },
    ], `${data.form.replace(" ", "")}_${quarter}.xlsx`, `Prepared with FreBook · ${new Date().toLocaleDateString("en-IN")}`);
  }

  const certFor = (party: string) => data?.deductions.filter(d => d.party === party) ?? [];
  const parties = data ? [...new Set(data.deductions.map(d => d.party))] : [];
  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 };
  const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 11.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" };
  const td: React.CSSProperties = { padding: "8px 10px", borderTop: `1px solid ${C.line}` };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } .cert { box-shadow: none !important; border: none !important } }`}</style>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <header className="no-print" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <Link href="/finance/tds" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>← TDS</Link>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>Quarterly TDS return</h1>
            <div style={{ fontSize: 13, color: C.muted }}>{data?.form ?? "Form 140"} — TDS on payments to residents other than salary (was 26Q before FY 2026-27). Prepared from your books.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select id="tds-quarter" aria-label="Quarter" value={quarter} onChange={e => setQuarter(e.target.value)} style={{ height: 40, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 13.5, background: "#FFFFFF" }}>
              {qs.map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
            </select>
            {data && data.deductions.length > 0 && <button onClick={excel} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>⬇ Excel for the return utility</button>}
          </div>
        </header>

        {err && <div className="no-print" style={{ ...card, color: C.neg, background: C.negSoft, borderColor: "transparent" }}>{err}</div>}
        {!data && !err && <div className="no-print" style={{ ...card, color: C.muted }}>Preparing…</div>}

        {data && !cert && <>
          <div className="no-print" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {[{ l: "Deductees", v: String(parties.length) }, { l: "TDS deducted", v: inr(data.totalTds) }, { l: "Deposited (challans)", v: inr(data.deposited) },
              { l: "Balance to deposit", v: inr(Math.max(0, data.totalTds - data.deposited)), bad: data.totalTds - data.deposited > 1 }].map(k => (
              <div key={k.l} style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, color: k.bad ? C.neg : C.ink }}>{k.v}</div>
              </div>
            ))}
          </div>

          {data.issues.length > 0 && (
            <section className="no-print" style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
              <b style={{ fontSize: 13 }}>Check before filing</b>
              {data.issues.map((i, k) => <div key={k} style={{ fontSize: 13.5, color: i.level === "error" ? C.neg : C.warn }}>{i.level === "error" ? "⚠ " : "• "}{i.text}</div>)}
            </section>
          )}

          {data.deductions.length === 0 ? <div className="no-print" style={{ ...card, color: C.muted }}>No TDS deducted in this quarter — a nil return isn&apos;t required if nothing was deducted.</div> : <>
            <section className="no-print" style={{ ...card, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums", minWidth: 760 }}>
                <thead><tr style={{ background: "#F7F8FC" }}>{["Deductee", "PAN", "Nature", "Section", "Date", "Paid", "TDS", "Rate"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{data.deductions.map((d: Deduction) => (
                  <tr key={d.journalId}>
                    <td style={{ ...td, fontWeight: 700 }}><Link href={`/finance/journals?id=${d.journalId}`} style={{ color: C.ink }}>{d.party}</Link></td>
                    <td style={{ ...td, fontFamily: MONO, color: d.pan ? C.ink : C.neg }}>{d.pan ?? "missing"}</td>
                    <td style={td}>{d.nature.label}</td>
                    <td style={td}>{d.nature.ref} <span style={{ color: C.muted }}>({d.nature.old})</span></td>
                    <td style={td}>{dmy(d.date)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: MONO }}>{inr(d.paid)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: MONO, fontWeight: 700 }}>{inr(d.tds)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{d.rate}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </section>

            <section className="no-print" style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              <b style={{ fontSize: 13 }}>TDS statement for a deductee</b>
              <span style={{ fontSize: 12.5, color: C.muted }}>A printable statement of TDS deducted for the quarter. The official certificate is downloaded from TRACES after the return is processed.</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {parties.map(p => <button key={p} onClick={() => setCert(p)} style={{ height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#FFFFFF", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>{p}</button>)}
              </div>
            </section>

            <section className="no-print" style={{ ...card, fontSize: 13, lineHeight: 1.6, color: C.muted }}>
              <b style={{ color: C.ink }}>How to file:</b> open the Income Tax Department&apos;s return preparation utility, choose {data.form}, copy in the Deductees and Challans sheets (add the BSR code and challan number from your challan counterfoils), validate with the file validation utility and upload the file on the e-filing portal or through a TIN facilitation centre. Due 31 July, 31 October, 31 January and 31 May for Q1–Q4.
            </section>
          </>}
        </>}

        {data && cert && (() => {
          const rows = certFor(cert), pan = rows[0]?.pan;
          return (
            <section className="cert" style={{ ...card, padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="no-print" style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setCert(null)} style={{ height: 36, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#FFFFFF", cursor: "pointer", fontWeight: 700 }}>← Back</button>
                <button onClick={() => window.print()} style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "none", background: C.navy, color: "#FFFFFF", cursor: "pointer", fontWeight: 800 }}>Print / PDF</button>
              </div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Statement of tax deducted at source</h2>
              <div style={{ fontSize: 13, color: C.muted }}>{qs.find(q => q.key === quarter)?.label} · reported in {data.form}</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", fontSize: 13.5 }}>
                <div><b>Deductor</b><br />{data.deductor.name}<br />TAN: {data.deductor.tan ?? "—"}{data.deductor.pan ? <><br />PAN: {data.deductor.pan}</> : null}</div>
                <div><b>Deductee</b><br />{cert}<br />PAN: {pan ?? "not available"}</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                <thead><tr>{["Date", "Nature of payment", "Section", "Amount paid", "TDS"].map(h => <th key={h} style={{ ...th, borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map(d => <tr key={d.journalId}><td style={td}>{dmy(d.date)}</td><td style={td}>{d.nature.label}</td><td style={td}>{d.nature.ref}</td><td style={{ ...td, textAlign: "right" }}>{inr(d.paid)}</td><td style={{ ...td, textAlign: "right" }}>{inr(d.tds)}</td></tr>)}
                  <tr><td colSpan={3} style={{ ...td, fontWeight: 800 }}>Total</td><td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{inr(rows.reduce((s, d) => s + d.paid, 0))}</td><td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{inr(rows.reduce((s, d) => s + d.tds, 0))}</td></tr>
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: C.muted }}>This statement is prepared from the deductor&apos;s books. The TDS certificate is issued from TRACES after the quarterly return is processed; the credit appears in the deductee&apos;s Form 26AS / AIS.</div>
            </section>
          );
        })()}
      </div>
    </div>
  );
}
