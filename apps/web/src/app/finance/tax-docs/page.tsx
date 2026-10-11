"use client";
// Tax documents — drop Form 26AS or Form 16 (PDF); FreWork reads every figure and checks 26AS TDS against the books.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Summary26AS, SummaryForm16 } from "@/lib/taxDocs";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", pos: "#0B7A55", posSoft: "#E3F6EE", amber: "#8A5A00", amberSoft: "#FFF4DB", neg: "#C2321F", negSoft: "#FDECEA" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (x: number) => "₹" + (x || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
type Result = { kind: "26as"; form26as: Summary26AS; compare: { inForm: number; inBooks: number; diff: number; verdict: "match" | "missing_in_books" | "more_in_books" } | null } | { kind: "form16"; form16: SummaryForm16 };

export default function TaxDocs() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [kind, setKind] = useState<"26as" | "form16">("26as");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; } setBizId(saved);
    });
  }, [router]);

  function pick(f: File) {
    if (!/\.pdf$/i.test(f.name)) { setErr("Choose the PDF downloaded from the portal."); return; }
    setFile(f); setErr(""); setRes(null); setNeedsPassword(false);
    if (/26\s?as|168/i.test(f.name)) setKind("26as"); else if (/form[\s_-]?(16|130)|\b(16a?|130)\b/i.test(f.name)) setKind("form16");
  }
  async function read() {
    if (!file || !bizId) return;
    setBusy(true); setErr(""); setRes(null);
    const fd = new FormData(); fd.append("file", file); fd.append("business_id", bizId); fd.append("kind", kind); if (password) fd.append("password", password);
    const r = await fetch("/api/finance/tax-docs", { method: "POST", body: fd }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) { setErr(d.error ?? "Couldn't read this document."); if (d.needsPassword) setNeedsPassword(true); return; }
    setRes(d as Result);
  }
  async function exportExcel() {
    if (!res) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    if (res.kind === "26as") {
      const s = res.form26as;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Form 168 / 26AS", s.name, s.pan, `FY ${s.fy}`, `AY ${s.ay}`], [], ["Deductor", "TAN", "Section", "Date", "Status", "Amount paid/credited", "TDS", "Deposited"],
        ...s.deductors.flatMap(x => x.rows.map(r => [x.name, x.tan, r.section, r.date, r.status, r.amount, r.tds, r.deposited])), [], ["Total", "", "", "", "", s.totals.paid, s.totals.tds, s.totals.deposited]]), "26AS");
    } else {
      const f = res.form16;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Form 130 / Form 16", f.employeeName, f.employeePan, `AY ${f.ay}`], ["Employer", f.employer.name, f.employer.tan], [],
        ["Gross salary", f.gross], ["Standard deduction", f.standardDeduction], ["Deductions u/s 16", f.deductions16], ["Chapter VI-A", f.chapterVIA], ["Income from salary", f.salaryIncome], ["Total taxable income", f.taxable], ["Tax on income", f.taxOnIncome], ["Rebate 87A", f.rebate87A], ["Cess", f.cess], ["Net tax payable", f.netTax], [],
        ["Quarter", "Credited", "TDS deducted", "Deposited"], ...f.quarters.map(q => [q.quarter, q.credit, q.deducted, q.deposited]), ["Total", "", f.tdsTotal]]), "Form 16");
    }
    XLSX.writeFile(wb, `${res.kind === "26as" ? "Form168-26AS" : "Form130-Form16"}-read.xlsx`);
  }

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" };
  const btn = (primary: boolean, disabled = false): React.CSSProperties => ({ height: 44, padding: "0 20px", borderRadius: 999, border: primary ? "none" : "1px solid #D9CDB2", background: primary ? C.forest : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" });
  const tile = (l: string, v: string, tone?: string) => <div style={{ ...card, padding: "12px 14px" }}><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{l}</div><div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: tone ?? C.ink }}>{v}</div></div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <input ref={input} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 16 }}>
        <header>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>INCOME TAX · TAX CREDIT &amp; TDS CERTIFICATES</div>
          <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", fontWeight: 700 }}>Form 168 &amp; Form 130, <span style={{ fontStyle: "italic", fontWeight: 400, color: "#8A6420" }}>read for you</span></h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: C.muted, maxWidth: 680 }}>Under the Income-tax Act, 2025 the annual tax credit statement is <b>Form 168</b> (earlier Form 26AS) and the salary TDS certificate is <b>Form 130</b> (earlier Form 16). Old forms still apply for FY 2025-26 and earlier — both are read here. Download the statement from the Income-tax portal or the certificate from your employer, and drop it here. FreWork reads every deductor, section and amount, and checks TDS against your books.</p>
        </header>

        <section onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}
          style={{ ...card, border: `2px dashed ${drag ? C.gold : "#CDBF9F"}`, background: drag ? "#FFF8E8" : C.card, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", padding: "26px 18px" }}>
          <div role="radiogroup" aria-label="Document type" style={{ display: "flex", gap: 4, background: "#EFE8D9", borderRadius: 999, padding: 4 }}>
            {([["26as", "Form 168 (26AS)"], ["form16", "Form 130 (Form 16)"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} style={{ height: 36, padding: "0 16px", borderRadius: 999, border: "none", background: kind === k ? C.forest : "transparent", color: kind === k ? "#FFFFFF" : C.ink, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
          </div>
          <b style={{ fontSize: 16 }}>{file ? file.name : "Drag the PDF here"}</b>
          {(needsPassword || kind === "form16") && <input value={password} onChange={e => setPassword(e.target.value)} placeholder="PDF password (if any)" aria-label="PDF password" style={{ height: 40, width: 260, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: "inherit" }} />}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => input.current?.click()} style={btn(false)}>Choose PDF</button>
            <button onClick={read} disabled={!file || busy} style={btn(true, !file || busy)}>{busy ? "Reading…" : "Read document"}</button>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>The PDF is sent only to our licensed data partner to read it. Nothing is posted to your books.</div>
        </section>
        {err && <div role="alert" style={{ background: C.negSoft, color: C.neg, borderRadius: 12, padding: "10px 14px", fontWeight: 700 }}>{err}</div>}

        {res?.kind === "26as" && (() => { const s = res.form26as; const cmp = res.compare; return (
          <>
            <section style={{ ...card, background: C.forest, color: "#FFFFFF", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 12, letterSpacing: "0.12em", color: C.gold, fontWeight: 800 }}>{Number((s.fy.match(/\d{4}/) ?? ["0"])[0]) >= 2026 ? "FORM 168" : "FORM 26AS"} · FY {s.fy} · AY {s.ay}</div><div style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 13, color: "#C9D3CE" }}>PAN {s.pan} · {s.deductors.length} deductors</div></div>
              <button onClick={exportExcel} style={{ ...btn(false), background: C.gold, border: "none" }}>⬇ Excel</button>
            </section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              {tile("Amount paid / credited", inr(s.totals.paid))}{tile("TDS deducted", inr(s.totals.tds))}{tile("TDS deposited", inr(s.totals.deposited), s.totals.deposited < s.totals.tds ? C.neg : undefined)}
            </div>
            {cmp && <div style={{ ...card, background: cmp.verdict === "match" ? C.posSoft : C.amberSoft, color: cmp.verdict === "match" ? C.pos : C.amber, fontWeight: 700, fontSize: 14 }}>
              {cmp.verdict === "match" ? `✓ TDS in your books matches the statement (${inr(cmp.inBooks)}).`
                : cmp.verdict === "missing_in_books" ? <>The statement shows {inr(cmp.diff)} more TDS than your books ({inr(cmp.inBooks)}). Book the missing TDS receivable — <Link href="/finance/chat-book" style={{ color: C.amber }}>tell FreBook</Link>, e.g. &ldquo;TDS {inr(cmp.diff)} deducted by customers this year&rdquo;.</>
                : <>Your books show {inr(-cmp.diff)} more TDS than the statement — a deductor may not have filed, or an entry is wrong. Check the deductor list below.</>}
            </div>}
            <section style={card}>
              <b style={{ fontFamily: SERIF, fontSize: "1.15rem" }}>By section</b>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{s.bySection.map(x => <span key={x.section} style={{ fontSize: 13, background: "#EFE8D9", borderRadius: 999, padding: "5px 12px" }}><b>{x.section || "—"}</b> · {inr(x.amount)} · TDS {inr(x.tds)}</span>)}</div>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.deductors.map(x => (
                <details key={x.tan + x.name} style={{ ...card, padding: "12px 14px" }}>
                  <summary style={{ cursor: "pointer", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", listStyle: "none" }}>
                    <b style={{ flex: 1, minWidth: 180 }}>{x.name}</b><span style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }}>{x.tan}</span>
                    <span style={{ fontFamily: MONO }}>{inr(x.paid)}</span><b style={{ fontFamily: MONO }}>TDS {inr(x.tds)}</b>
                    {x.deposited < x.tds && <span style={{ fontSize: 11.5, fontWeight: 800, color: C.neg, background: C.negSoft, padding: "2px 8px", borderRadius: 999 }}>Not fully deposited</span>}
                  </summary>
                  <div style={{ overflowX: "auto", marginTop: 8 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr>{["Section", "Date", "Status", "Amount", "TDS", "Deposited"].map(h => <th key={h} style={{ textAlign: ["Amount", "TDS", "Deposited"].includes(h) ? "right" : "left", fontSize: 11, color: C.muted, padding: "4px 6px", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
                    <tbody>{x.rows.map((r, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "4px 6px" }}>{r.section}</td><td style={{ padding: "4px 6px" }}>{r.date}</td><td style={{ padding: "4px 6px" }}>{r.status}</td><td style={{ padding: "4px 6px", textAlign: "right", fontFamily: MONO }}>{inr(r.amount)}</td><td style={{ padding: "4px 6px", textAlign: "right", fontFamily: MONO }}>{inr(r.tds)}</td><td style={{ padding: "4px 6px", textAlign: "right", fontFamily: MONO }}>{inr(r.deposited)}</td></tr>)}</tbody>
                  </table></div>
                </details>
              ))}
            </section>
          </>
        ); })()}

        {res?.kind === "form16" && (() => { const f = res.form16; return (
          <>
            <section style={{ ...card, background: C.forest, color: "#FFFFFF", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 12, letterSpacing: "0.12em", color: C.gold, fontWeight: 800 }}>{Number((f.ay.match(/\d{4}/) ?? ["0"])[0]) >= 2027 ? "FORM 130" : "FORM 16"} · AY {f.ay}{f.newRegime == null ? "" : f.newRegime ? " · NEW REGIME" : " · OLD REGIME"}</div><div style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 700 }}>{f.employeeName || f.employeePan}</div><div style={{ fontSize: 13, color: "#C9D3CE" }}>{f.employer.name} · TAN {f.employer.tan}</div></div>
              <button onClick={exportExcel} style={{ ...btn(false), background: C.gold, border: "none" }}>⬇ Excel</button>
            </section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              {tile("Gross salary", inr(f.gross))}{tile("Deductions (16 + VI-A)", inr(f.deductions16 + f.chapterVIA))}{tile("Taxable income", inr(f.taxable))}{tile("Net tax payable", inr(f.netTax))}{tile("TDS deducted", inr(f.tdsTotal), Math.abs(f.tdsTotal - f.netTax) > 1 ? C.amber : C.pos)}
            </div>
            {Math.abs(f.tdsTotal - f.netTax) > 1 && <div style={{ ...card, background: C.amberSoft, color: C.amber, fontWeight: 700, fontSize: 14 }}>TDS ({inr(f.tdsTotal)}) differs from tax payable ({inr(f.netTax)}) by {inr(Math.abs(f.tdsTotal - f.netTax))} — {f.tdsTotal > f.netTax ? "a refund is likely" : "self-assessment tax may be due"} before filing the ITR.</div>}
            <section style={card}>
              <b style={{ fontFamily: SERIF, fontSize: "1.15rem" }}>TDS by quarter</b>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginTop: 8 }}><tbody>{f.quarters.map(q => <tr key={q.quarter} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "6px" }}>{q.quarter}</td><td style={{ padding: "6px", textAlign: "right", fontFamily: MONO }}>{inr(q.credit)}</td><td style={{ padding: "6px", textAlign: "right", fontFamily: MONO }}>TDS {inr(q.deducted)}</td></tr>)}</tbody></table>
            </section>
            <section style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ flex: 1, minWidth: 220 }}>Ready to file the ITR with these figures?</b>
              <Link href="/order?service=income-tax" style={{ ...btn(true), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>File ITR with an expert</Link>
            </section>
          </>
        ); })()}
      </div>
    </div>
  );
}
