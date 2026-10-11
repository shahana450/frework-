"use client";
// ITC Match — GSTR-2B against the purchase register, and GSTR-3B Table 4 worked out for the month.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { parse2BJson, parse2BGrid, purchaseRegister, matchItc, table4, taxOf, type TwoBDoc, type BookDoc, type Tax, type ItcRow } from "@/lib/itcMatch";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F", pos: "#0B7A55", posSoft: "#E3F6EE", amber: "#8A5A00", amberSoft: "#FFF4DB", neg: "#C2321F", negSoft: "#FDECEA", blue: "#1F5EFF", blueSoft: "#E8F0FF" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ZERO: Tax = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
const KEYS: (keyof Tax)[] = ["igst", "cgst", "sgst", "cess"];
const LABEL: Record<keyof Tax, string> = { igst: "Integrated tax", cgst: "Central tax", sgst: "State/UT tax", cess: "Cess" };

function lastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); }
const monthEnd = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const back = (ym: string, months: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 - months, 1)); return d.toISOString().slice(0, 10); };

export default function ItcMatchPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [month, setMonth] = useState(lastMonth());
  const [twoB, setTwoB] = useState<TwoBDoc[]>([]);
  const [fileName, setFileName] = useState("");
  const [books, setBooks] = useState<BookDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState<Tax>(ZERO);
  const [other, setOther] = useState<Tax>(ZERO);
  const [filter, setFilter] = useState<ItcRow["status"] | "all">("all");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
    });
  }, [router]);

  // Purchase register: entries with input tax, from six months before (late bills) to the month end
  useEffect(() => {
    if (!bizId) return;
    setLoading(true); setErr("");
    fetch(`/api/finance/books?business_id=${bizId}&from=${back(month, 6)}&to=${monthEnd(month)}`).then(r => r.json()).then(d => {
      const js = ((d.journals ?? []) as { id: string; entry_no: string; date: string; status: string; narration: string | null; reference_no: string | null; fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string } | null }[] }[])
        .filter(j => j.status === "posted")
        .map(j => ({ id: j.id, entry_no: j.entry_no, date: j.date, narration: j.narration, reference_no: j.reference_no, lines: (j.fw_fin_journal_lines ?? []).map(l => ({ name: l.fw_fin_chart_of_accounts?.name ?? "", dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0 })) }));
      setBooks(purchaseRegister(js));
    }).catch(() => setErr("Couldn't load your purchase entries.")).finally(() => setLoading(false));
  }, [bizId, month]);

  async function onFile(f: File) {
    setErr(""); setFileName(f.name);
    try {
      if (/\.json$/i.test(f.name)) setTwoB(parse2BJson(JSON.parse(await f.text())));
      else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const docs: TwoBDoc[] = [];
        for (const name of wb.SheetNames.filter(n => /b2b/i.test(n))) docs.push(...parse2BGrid(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }) as unknown[][]));
        if (!docs.length) throw new Error("No B2B invoices found — upload the GSTR-2B Excel or JSON from the GST portal.");
        setTwoB(docs);
      }
    } catch (e) { setTwoB([]); setErr(e instanceof Error ? e.message : "Couldn't read this file."); }
  }

  // Match; book entries outside the month only count when they match something in 2B
  const rows = useMemo(() => {
    if (!twoB.length) return [];
    return matchItc(twoB, books).filter(r => r.status !== "onlyBooks" || r.book!.date.slice(0, 7) === month);
  }, [twoB, books, month]);
  const t4 = useMemo(() => table4(twoB, books.filter(b => b.date.slice(0, 7) === month), blocked, other), [twoB, books, month, blocked, other]);
  const n = (s: ItcRow["status"]) => rows.filter(r => r.status === s).length;
  const sum = (s: ItcRow["status"]) => rows.filter(r => r.status === s).reduce((a, r) => a + Math.abs(r.diff || (r.b2b ? taxOf(r.b2b) : 0)), 0);
  const shown = filter === "all" ? rows : rows.filter(r => r.status === filter);

  function copyTable4() {
    const line = (label: string, t: Tax) => `${label}\t${KEYS.map(k => t[k].toFixed(2)).join("\t")}`;
    const text = ["Details\tIntegrated tax\tCentral tax\tState/UT tax\tCess", line("4(A)(3) Inward supplies liable to reverse charge", t4.a3), line("4(A)(5) All other ITC", t4.a5), line("4(B)(1) Reversed: Rules 38, 42, 43 & Section 17(5)", t4.b1), line("4(B)(2) Reversed: Others", t4.b2), line("4(C) Net ITC available", t4.c)].join("\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const statusLabel: Record<ItcRow["status"], string> = { matched: "Matched", mismatch: "Amount differs", only2b: "In 2B, not in books", onlyBooks: "In books, not in 2B" };
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Status", "Supplier (2B)", "GSTIN", "Invoice no (2B)", "Date (2B)", "Taxable (2B)", "Tax (2B)", "Entry no (books)", "Supplier (books)", "Invoice no (books)", "Date (books)", "Tax (books)", "Difference", "Note"],
      ...rows.map(r => [statusLabel[r.status], r.b2b?.supplier ?? "", r.b2b?.gstin ?? "", r.b2b?.docNo ?? "", r.b2b?.date ?? "", r.b2b?.taxable ?? "", r.b2b ? taxOf(r.b2b) : "", r.book?.entryNo ?? "", r.book?.supplier ?? "", r.book?.docNo ?? "", r.book?.date ?? "", r.book ? taxOf(r.book) : "", r.diff, r.note ?? ""]),
    ]), "ITC match");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["GSTR-3B Table 4", "Integrated tax", "Central tax", "State/UT tax", "Cess"],
      ["4(A)(3) Reverse charge", ...KEYS.map(k => t4.a3[k])], ["4(A)(5) All other ITC", ...KEYS.map(k => t4.a5[k])],
      ["4(B)(1) Reversed: 17(5), Rules 38/42/43", ...KEYS.map(k => t4.b1[k])], ["4(B)(2) Reversed: others", ...KEYS.map(k => t4.b2[k])],
      ["4(C) Net ITC available", ...KEYS.map(k => t4.c[k])], [], ["ITC as per books (this month)", ...KEYS.map(k => t4.booksItc[k])],
    ]), "Table 4");
    XLSX.writeFile(wb, `ITC-Match-${month}.xlsx`);
  }

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" };
  const pill = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" });
  const btn = (primary: boolean): React.CSSProperties => ({ height: 42, padding: "0 18px", borderRadius: 999, border: primary ? "none" : "1px solid #D9CDB2", background: primary ? C.forest : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" });
  const STATUS: Record<ItcRow["status"], { label: string; bg: string; fg: string }> = {
    matched: { label: "Matched", bg: C.posSoft, fg: C.pos }, mismatch: { label: "Amount differs", bg: C.amberSoft, fg: C.amber },
    only2b: { label: "Not in books", bg: C.blueSoft, fg: C.blue }, onlyBooks: { label: "Not in 2B", bg: C.negSoft, fg: C.neg },
  };
  const taxInput = (val: Tax, set: (t: Tax) => void, k: keyof Tax) => (
    <input inputMode="decimal" aria-label={LABEL[k]} value={val[k] || ""} placeholder="0" onChange={e => set({ ...val, [k]: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
      style={{ width: "100%", height: 34, borderRadius: 8, border: `1px solid ${C.line}`, padding: "0 8px", textAlign: "right", fontFamily: MONO, fontSize: 13 }} />
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <input ref={fileRef} type="file" accept=".json,.xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420" }}>GST · INPUT TAX CREDIT</div>
            <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", fontWeight: 700 }}>ITC match &amp; GSTR-3B Table 4</h1>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted }}>Return month
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ height: 40, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 10px", fontFamily: "inherit", fontSize: 14 }} />
          </label>
        </header>

        <section style={{ ...card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: C.forest, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <b style={{ fontSize: 15 }}>{fileName ? `${fileName} · ${twoB.length} documents` : "Upload GSTR-2B for the month"}</b>
            <div style={{ fontSize: 13, color: C.muted }}>GST portal → Returns → GSTR-2B → Download (JSON or Excel). Your purchase entries load automatically{loading ? " — loading…" : ` (${books.filter(b => b.date.slice(0, 7) === month).length} this month)`}.</div>
          </div>
          <button onClick={() => fileRef.current?.click()} style={btn(true)}>{fileName ? "Upload another" : "Upload GSTR-2B"}</button>
          {rows.length > 0 && <button onClick={exportExcel} style={btn(false)}>⬇ Excel</button>}
        </section>
        {err && <div role="alert" style={{ background: C.negSoft, color: C.neg, borderRadius: 12, padding: "10px 14px", fontWeight: 700 }}>{err}</div>}

        {rows.length > 0 && (
          <>
            {/* Summary tiles */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }} className="itc-tiles">
              {(["matched", "mismatch", "only2b", "onlyBooks"] as const).map(s => (
                <button key={s} onClick={() => setFilter(filter === s ? "all" : s)} style={{ ...card, textAlign: "left", cursor: "pointer", fontFamily: "inherit", outline: filter === s ? `2px solid ${STATUS[s].fg}` : "none" }}>
                  <span style={pill(STATUS[s].bg, STATUS[s].fg)}>{STATUS[s].label}</span>
                  <div style={{ fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 700, marginTop: 6 }}>{n(s)}</div>
                  <div style={{ fontSize: 12.5, color: C.muted }}>{s === "matched" ? "ITC confirmed" : s === "mismatch" ? `Difference ${inr(sum(s))}` : s === "only2b" ? `${inr(sum(s))} ITC you haven't booked` : `${inr(sum(s))} ITC at risk`}</div>
                </button>
              ))}
            </section>

            {/* Table 4 */}
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <b style={{ fontFamily: SERIF, fontSize: "1.2rem", flex: 1 }}>GSTR-3B Table 4 — Eligible ITC</b>
                <button onClick={copyTable4} style={btn(false)}>{copied ? "✓ Copied" : "Copy for portal"}</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
                  <thead><tr>{["Details", ...KEYS.map(k => LABEL[k])].map(h => <th key={h} style={{ textAlign: h === "Details" ? "left" : "right", padding: "8px 10px", fontSize: 11.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {([["4(A)(3) Inward supplies liable to reverse charge", t4.a3, null], ["4(A)(5) All other ITC (from GSTR-2B)", t4.a5, null],
                      ["4(B)(1) Reversed — Section 17(5) blocked, Rules 38/42/43", t4.b1, "b1"], ["4(B)(2) Reversed — Others", t4.b2, "b2"], ["4(C) Net ITC available", t4.c, null]] as const).map(([label, t, edit]) => (
                      <tr key={label} style={{ borderBottom: `1px solid ${C.line}`, background: label.startsWith("4(C)") ? "#F3EDE1" : "transparent", fontWeight: label.startsWith("4(C)") ? 800 : 500 }}>
                        <td style={{ padding: "8px 10px" }}>{label}</td>
                        {KEYS.map(k => <td key={k} style={{ padding: "6px 10px", textAlign: "right", fontFamily: MONO, width: 140 }}>{edit === "b1" ? taxInput(blocked, setBlocked, k) : edit === "b2" ? taxInput(other, setOther, k) : inr(t[k])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
                ITC as per your books this month: <b style={{ fontFamily: MONO }}>{inr(taxOf(t4.booksItc))}</b> · as per GSTR-2B (4A total): <b style={{ fontFamily: MONO }}>{inr(taxOf(t4.a5) + taxOf(t4.a3))}</b>.
                Enter blocked credit (e.g. food, motor vehicles, personal use) in 4(B)(1). Documents marked &ldquo;ITC not available&rdquo; in 2B are left out. Check figures before filing.
              </div>
            </section>

            {/* Rows */}
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.slice(0, 500).map((r, i) => (
                <article key={i} style={{ ...card, padding: "12px 14px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }} className="itc-row">
                  <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={pill(STATUS[r.status].bg, STATUS[r.status].fg)}>{STATUS[r.status].label}</span>
                    <b style={{ flex: 1 }}>{r.b2b?.supplier || r.book?.supplier}</b>
                    {r.note && <span style={{ fontSize: 12.5, color: STATUS[r.status].fg, fontWeight: 600 }}>{r.note}</span>}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.08em" }}>GSTR-2B</div>
                    {r.b2b ? <>{r.b2b.docNo}{r.b2b.note ? " (note)" : ""} · {r.b2b.date} · {r.b2b.gstin}<br /><span style={{ fontFamily: MONO }}>Taxable {inr(r.b2b.taxable)} · Tax {inr(taxOf(r.b2b))}</span>{r.b2b.rcm && <span style={{ ...pill(C.amberSoft, C.amber), marginLeft: 6 }}>RCM</span>}{!r.b2b.itcAvailable && <span style={{ ...pill(C.negSoft, C.neg), marginLeft: 6 }}>ITC not available</span>}</> : <span style={{ color: C.muted }}>—</span>}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.08em" }}>YOUR BOOKS</div>
                    {r.book ? <><Link href={`/finance/journals?id=${r.book.id}`} style={{ color: C.blue, fontWeight: 700 }}>{r.book.entryNo}</Link> · {r.book.docNo || "no invoice no"} · {r.book.date}<br /><span style={{ fontFamily: MONO }}>Taxable {inr(r.book.taxable)} · Tax {inr(taxOf(r.book))}</span></>
                      : <Link href="/finance/inbox" style={{ color: C.blue, fontWeight: 700 }}>Book this bill in Smart Inbox →</Link>}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
      <style>{`@media (max-width: 760px) { .itc-tiles { grid-template-columns: repeat(2,minmax(0,1fr)) !important; } .itc-row { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
