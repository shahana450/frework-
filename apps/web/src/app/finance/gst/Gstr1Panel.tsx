"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { downloadApiFile } from "@/lib/apiAuthClient";
import type { Gstr1 } from "@/lib/gstr1";
import Gstr1FilePanel from "./Gstr1FilePanel";

const C = { line: "#E1E4EE", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Gstr1Panel({ bizId, month, monthLabel }: { bizId: string; month: string; monthLabel: string }) {
  const [data, setData] = useState<(Gstr1 & { gstin: string }) | null>(null);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!bizId) return;
    setData(null); setErr("");
    fetch(`/api/finance/gst?business_id=${bizId}&month=${month}&report=gstr1`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't prepare GSTR-1."); else setData(d);
    });
  }, [bizId, month]);

  if (err) return <div style={{ color: C.neg, background: C.negSoft, padding: 16, borderRadius: 10 }}>{err}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Preparing GSTR-1 for {monthLabel}…</div>;

  const errors = data.issues.filter(i => i.level === "error"), warns = data.issues.filter(i => i.level === "warn");
  const sum = data.totals.reduce((s, t) => ({ taxable: s.taxable + t.taxable, igst: s.igst + t.igst, cgst: s.cgst + t.cgst, sgst: s.sgst + t.sgst }), { taxable: 0, igst: 0, cgst: 0, sgst: 0 });
  const shown = showAll ? data.issues : data.issues.slice(0, 8);
  const download = () => downloadApiFile(`/api/finance/gst?business_id=${bizId}&month=${month}&report=gstr1_json`, `GSTR1_${month}.json`).catch(e => alert(e.message));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 16px", borderRadius: 12, background: errors.length ? C.negSoft : warns.length ? C.warnSoft : C.posSoft, color: errors.length ? C.neg : warns.length ? C.warn : C.pos, fontWeight: 600, fontSize: 14 }}>
        <span style={{ flex: 1 }}>
          {data.totals.length === 0 ? `No sales or credit notes posted in ${monthLabel} — this would be a nil GSTR-1.`
            : errors.length ? `${errors.length} problem${errors.length > 1 ? "s" : ""} to fix before uploading.`
            : warns.length ? `Ready to upload — ${warns.length} thing${warns.length > 1 ? "s" : ""} worth checking.`
            : "Ready to upload."}
        </span>
        <button onClick={download} disabled={!data.totals.length} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: data.totals.length ? "pointer" : "default", opacity: data.totals.length ? 1 : 0.5 }}>Download GSTR-1 JSON</button>
      </div>

      <section style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, fontWeight: 700, fontSize: 14 }}>GSTR-1 · {monthLabel} · GSTIN {data.gstin || "—"}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
            <thead><tr style={{ background: "#F7F8FC", color: C.muted, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {["Section", "Docs", "Taxable value", "IGST", "CGST", "SGST"].map((h, i) => <th key={h} style={{ padding: "9px 14px", textAlign: i < 2 ? "left" : "right", fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.totals.map(t => (
                <tr key={t.section} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{t.section}</td>
                  <td style={{ padding: "10px 14px" }}>{t.count}</td>
                  {[t.taxable, t.igst, t.cgst, t.sgst].map((v, i) => <td key={i} style={{ padding: "10px 14px", textAlign: "right", fontFamily: MONO }}>{fmt(v)}</td>)}
                </tr>
              ))}
              {data.totals.length > 0 && (
                <tr style={{ borderTop: `2px solid #C9CEDF`, background: "#F7F8FC", fontWeight: 700 }}>
                  <td style={{ padding: "10px 14px" }} colSpan={2}>Total</td>
                  {[sum.taxable, sum.igst, sum.cgst, sum.sgst].map((v, i) => <td key={i} style={{ padding: "10px 14px", textAlign: "right", fontFamily: MONO }}>{fmt(v)}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.issues.length > 0 && (
        <section style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>CHECK BEFORE FILING</div>
          {shown.map((i, k) => (
            <div key={k} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: i.level === "error" ? C.negSoft : C.warnSoft, color: i.level === "error" ? C.neg : C.warn, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>!</span>
              <span>{i.text}</span>
            </div>
          ))}
          {data.issues.length > 8 && <button onClick={() => setShowAll(s => !s)} style={{ alignSelf: "flex-start", border: "none", background: "none", color: C.primary, fontWeight: 700, cursor: "pointer", padding: 0 }}>{showAll ? "Show fewer" : `Show all ${data.issues.length}`}</button>}
          <div style={{ fontSize: 12.5, color: C.muted }}>Fix customer GSTIN and state in <Link href="/finance/contacts" style={{ color: C.primary }}>Customers &amp; Suppliers</Link>, and your own in <Link href="/finance/settings/business" style={{ color: C.primary }}>Business Details</Link>. New invoices from the sales form save HSN and rates automatically.</div>
        </section>
      )}

      <Gstr1FilePanel bizId={bizId} month={month} monthLabel={monthLabel} ours={data.totals} blocked={errors.length} />

      <section style={{ background: "#F7F8FC", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, fontSize: 13.5, lineHeight: 1.6, color: C.ink }}>
        <b>Or file by upload:</b> on <a href="https://www.gst.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>gst.gov.in</a> → Returns Dashboard → choose the period → GSTR-1 → <b>Prepare Offline</b> → Upload → choose this JSON file. Check the summary the portal shows, then <b>File</b> with OTP or DSC. Keep the downloaded file with your records.
      </section>
    </div>
  );
}
