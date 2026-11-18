"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { downloadApiFile } from "@/lib/apiAuthClient";
import type { Gstr1 } from "@/lib/gstr1";
import Gstr1FilePanel from "./Gstr1FilePanel";

const C = { line: "#E6DFD0", ink: "#10241F", muted: "#6B7570", primary: "#12352D", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#B4321F", negSoft: "#FDECEA", warn: "#9A6B22", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Gstr1Panel({ bizId, month, monthLabel }: { bizId: string; month: string; monthLabel: string }) {
  const [data, setData] = useState<(Gstr1 & { gstin: string }) | null>(null);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [openSec, setOpenSec] = useState<string | null>(null);
  // HSN / SAC for sales that have none (kept per business on this device) — the portal rejects a blank code
  const hsnKey = `fw_gst_default_hsn:${bizId}`;
  const [hsn, setHsn] = useState("");
  const [hsnUsed, setHsnUsed] = useState("");
  useEffect(() => { try { const v = localStorage.getItem(hsnKey) ?? ""; setHsn(v); setHsnUsed(v); } catch { /* */ } }, [hsnKey]);
  const hsnQ = /^\d{4,8}$/.test(hsnUsed) ? `&hsn=${hsnUsed}` : "";
  const applyHsn = () => { const v = hsn.trim(); try { localStorage.setItem(hsnKey, v); } catch { /* */ } setHsnUsed(v); };

  useEffect(() => {
    if (!bizId) return;
    setData(null); setErr("");
    fetch(`/api/finance/gst?business_id=${bizId}&month=${month}&report=gstr1${hsnQ}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't prepare GSTR-1."); else setData(d);
    });
  }, [bizId, month, hsnQ]);

  if (err) return <div style={{ color: C.neg, background: C.negSoft, padding: 16, borderRadius: 10 }}>{err}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Preparing GSTR-1 for {monthLabel}…</div>;

  const errors = data.issues.filter(i => i.level === "error"), warns = data.issues.filter(i => i.level === "warn");
  const sum = data.totals.reduce((s, t) => ({ taxable: s.taxable + t.taxable, igst: s.igst + t.igst, cgst: s.cgst + t.cgst, sgst: s.sgst + t.sgst }), { taxable: 0, igst: 0, cgst: 0, sgst: 0 });
  const download = () => downloadApiFile(`/api/finance/gst?business_id=${bizId}&month=${month}&report=gstr1_json${hsnQ}`, `GSTR1_${month}.json`).catch(e => alert(e.message));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 16px", borderRadius: 12, background: errors.length ? C.negSoft : warns.length ? C.warnSoft : C.posSoft, color: errors.length ? C.neg : warns.length ? C.warn : C.pos, fontWeight: 600, fontSize: 14 }}>
        <span style={{ flex: 1 }}>
          {data.totals.length === 0 ? `No sales or credit notes posted in ${monthLabel} — this would be a nil GSTR-1.`
            : errors.length ? `${errors.length} problem${errors.length > 1 ? "s" : ""} to fix before uploading.`
            : warns.length ? `Ready to upload — ${warns.length} thing${warns.length > 1 ? "s" : ""} worth checking.`
            : "Ready to upload."}
        </span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#2E3B36", fontWeight: 600 }}>HSN / SAC for sales without one
          <input value={hsn} onChange={e => setHsn(e.target.value.replace(/\D/g, "").slice(0, 8))} onBlur={applyHsn} onKeyDown={e => e.key === "Enter" && applyHsn()} inputMode="numeric" placeholder="e.g. 998311"
            style={{ width: 110, height: 36, borderRadius: 8, border: "1px solid #D9CDB2", padding: "0 10px", fontFamily: "inherit", fontSize: 14, background: "#FFFFFF", color: "#10241F" }} />
        </label>
        <button onClick={download} disabled={!data.totals.length} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: data.totals.length ? "pointer" : "default", opacity: data.totals.length ? 1 : 0.5 }}>Download GSTR-1 JSON</button>
      </div>

      <section style={{ background: "#FFFDF8", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, fontWeight: 700, fontSize: 14 }}>GSTR-1 · {monthLabel} · GSTIN {data.gstin || "—"}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
            <thead><tr style={{ background: "#F8F3E8", color: C.muted, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {["Section", "Docs", "Taxable value", "IGST", "CGST", "SGST"].map((h, i) => <th key={h} style={{ padding: "9px 14px", textAlign: i < 2 ? "left" : "right", fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.totals.map(t => {
                const open = openSec === t.section;
                const docs = (t as { docs?: { no: string; date: string; party: string | null; gstin: string | null; rate: number | null; taxable: number; igst: number; cgst: number; sgst: number; value: number }[] }).docs ?? [];
                return [
                  <tr key={t.section} onClick={() => setOpenSec(open ? null : t.section)} aria-expanded={open} title="Show the invoices in this section" style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer", background: open ? "#FBF7EE" : undefined }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}><span aria-hidden="true" style={{ display: "inline-block", width: 14, color: C.muted }}>{open ? "▾" : "▸"}</span>{t.section}</td>
                    <td style={{ padding: "10px 14px" }}>{t.count}</td>
                    {[t.taxable, t.igst, t.cgst, t.sgst].map((v, i) => <td key={i} style={{ padding: "10px 14px", textAlign: "right", fontFamily: MONO }}>{fmt(v)}</td>)}
                  </tr>,
                  open && (
                    <tr key={t.section + "-docs"}><td colSpan={6} style={{ padding: "0 14px 14px", background: "#FBF7EE" }}>
                      <div style={{ maxHeight: 420, overflow: "auto", border: `1px solid ${C.line}`, borderRadius: 10, background: "#FFFFFF" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead><tr style={{ position: "sticky", top: 0, background: "#F8F3E8", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {["Invoice", "Date", "Party", "GSTIN", "Rate", "Taxable", "IGST", "CGST", "SGST", "Value"].map((h, i) => <th key={h} style={{ padding: "8px 10px", textAlign: i < 4 ? "left" : "right" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>{docs.map((d, i) => (
                            <tr key={d.no + i} style={{ borderTop: `1px solid ${C.line}` }}>
                              <td style={{ padding: "7px 10px", fontWeight: 600 }}><Link href={`/finance/journals?q=${encodeURIComponent(d.no)}`} style={{ color: C.primary }}>{d.no}</Link></td>
                              <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                              <td style={{ padding: "7px 10px" }}>{d.party ?? "—"}</td>
                              <td style={{ padding: "7px 10px", fontFamily: MONO, fontSize: 12 }}>{d.gstin ?? "—"}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right" }}>{d.rate != null ? `${d.rate}%` : <span style={{ color: C.neg }}>mixed</span>}</td>
                              {[d.taxable, d.igst, d.cgst, d.sgst, d.value].map((v, k) => <td key={k} style={{ padding: "7px 10px", textAlign: "right", fontFamily: MONO }}>{fmt(v)}</td>)}
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </td></tr>
                  ),
                ];
              })}
              {data.totals.length > 0 && (
                <tr style={{ borderTop: `2px solid #C9CEDF`, background: "#F8F3E8", fontWeight: 700 }}>
                  <td style={{ padding: "10px 14px" }} colSpan={2}>Total</td>
                  {[sum.taxable, sum.igst, sum.cgst, sum.sgst].map((v, i) => <td key={i} style={{ padding: "10px 14px", textAlign: "right", fontFamily: MONO }}>{fmt(v)}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.issues.length > 0 && (() => {
        // Problems grouped by invoice, in plain words, each with the place to fix it
        const plain = (t: string) => t.replace(/^[^:]+:\s*/, "")
          .replace(/place of supply unknown \(IGST charged but the customer's state isn't saved\)\./, "The customer's state is missing — needed because IGST was charged.")
          .replace(/no item detail saved, so HSN and quantity are missing — worked out from the ledger amounts\./, "No HSN / quantity on this invoice — FreBook used the ledger amounts. You can still file using the HSN box above.");
        const general = data.issues.filter(i => !i.doc);
        const byDoc = new Map<string, typeof data.issues>();
        for (const i of data.issues.filter(x => x.doc)) byDoc.set(i.doc!, [...(byDoc.get(i.doc!) ?? []), i]);
        const docs = [...byDoc.entries()].sort((x, y) => Number(y[1].some(i => i.level === "error")) - Number(x[1].some(i => i.level === "error")));
        const shownDocs = showAll ? docs : docs.slice(0, 6);
        const must = docs.filter(([, l]) => l.some(i => i.level === "error")).length;
        const linkBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", height: 30, padding: "0 12px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#FFFFFF", color: C.primary, fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };
        return (
          <section style={{ background: "#FFFDF8", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 15 }}>Check before filing</b>
              <span style={{ fontSize: 13, color: C.muted }}>{docs.length} invoice{docs.length === 1 ? "" : "s"} to look at{must ? <> · <b style={{ color: C.neg }}>{must} must be fixed</b> before uploading</> : " · nothing blocks the upload"}</span>
            </div>
            {general.map((i, k) => (
              <div key={"g" + k} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, background: i.level === "error" ? C.negSoft : C.warnSoft, fontSize: 13.5 }}>
                <span style={{ flex: 1, minWidth: 220 }}>{i.text}</span>
                <Link href="/finance/settings/business" style={linkBtn}>Open Business Details →</Link>
              </div>
            ))}
            {shownDocs.map(([no, list]) => {
              const bad = list.some(i => i.level === "error"), ref = list.find(i => i.ref)?.ref, party = list.find(i => i.party)?.party;
              const needCustomer = list.some(i => i.fix === "customer"), needInvoice = list.some(i => i.fix === "invoice");
              return (
                <div key={no} style={{ border: `1px solid ${bad ? "#EFC3B8" : C.line}`, borderLeft: `4px solid ${bad ? C.neg : C.warn}`, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Invoice {no}{party ? <span style={{ fontWeight: 400, color: C.muted }}> · {party}</span> : null}</div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>
                      {list.map((i, k) => <li key={k} style={{ color: i.level === "error" ? C.neg : C.ink }}>{plain(i.text)}</li>)}
                    </ul>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {needCustomer && <Link href={`/finance/contacts${party ? `?q=${encodeURIComponent(party)}` : ""}`} style={{ ...linkBtn, background: bad ? C.primary : "#FFFFFF", color: bad ? "#FFFFFF" : C.primary, borderColor: bad ? C.primary : C.line }}>Fix customer →</Link>}
                    {(needInvoice || !needCustomer) && ref && <Link href={`/finance/journals?id=${ref}`} style={linkBtn}>Open invoice →</Link>}
                  </div>
                </div>
              );
            })}
            {docs.length > 6 && <button onClick={() => setShowAll(s => !s)} style={{ alignSelf: "flex-start", border: "none", background: "none", color: C.primary, fontWeight: 700, cursor: "pointer", padding: 0 }}>{showAll ? "Show fewer" : `Show all ${docs.length} invoices`}</button>}
          </section>
        );
      })()}

      <Gstr1FilePanel bizId={bizId} month={month} monthLabel={monthLabel} ours={data.totals} blocked={errors.length} />

      <section style={{ background: "#F8F3E8", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, fontSize: 13.5, lineHeight: 1.6, color: C.ink }}>
        <b>Or file by upload:</b> on <a href="https://www.gst.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>gst.gov.in</a> → Returns Dashboard → choose the period → GSTR-1 → <b>Prepare Offline</b> → Upload → choose this JSON file. Check the summary the portal shows, then <b>File</b> with OTP or DSC. Keep the downloaded file with your records.
      </section>
    </div>
  );
}
