"use client";
// e-Invoice and e-Way bill upload files for the invoice on screen — download, then upload on the government portal.
import { useState } from "react";
import { buildEInvoice, buildEwayBill, type EIssue } from "@/lib/eDocs";
import type { InvoiceDoc } from "@/lib/invoiceDoc";

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", pos: "#0B7A55", neg: "#C2321F", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const safe = (s: string) => s.replace(/[^\w-]+/g, "_");

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function GovFiles({ doc }: { doc: InvoiceDoc }) {
  const [open, setOpen] = useState<"" | "einv" | "eway">("");
  const [vehicle, setVehicle] = useState(""), [km, setKm] = useState(""), [tName, setTName] = useState(""), [tId, setTId] = useState("");
  const [issues, setIssues] = useState<EIssue[]>([]);
  const [done, setDone] = useState("");

  const make = (kind: "einv" | "eway", force = false) => {
    const r = kind === "einv" ? buildEInvoice(doc) : buildEwayBill(doc, { vehicleNo: vehicle, distanceKm: Number(km) || 0, transporterName: tName, transporterId: tId.toUpperCase() });
    setIssues(r.issues);
    if (r.issues.some(i => i.level === "error") && !force) { setDone(""); return; }
    download(`${kind === "einv" ? "e-invoice" : "e-way-bill"}_${safe(doc.invoiceNo)}.json`, r.json);
    setDone(kind === "einv"
      ? "Downloaded. Upload it at einvoice1.gst.gov.in → e-Invoice → Bulk Upload. The IRN and QR code come back there — note the IRN on this invoice."
      : "Downloaded. Upload it at ewaybillgst.gov.in → e-Waybill → Bulk Generation. Print the e-way bill from the portal.");
  };

  const btn: React.CSSProperties = { height: 40, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#FFFFFF", color: C.ink, fontWeight: 700, cursor: "pointer", fontSize: 13.5 };
  const inp: React.CSSProperties = { height: 38, borderRadius: 9, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 14, color: C.ink, minWidth: 0 };
  return (
    <>
      <button onClick={() => { setOpen(o => o === "einv" ? "" : "einv"); setIssues([]); setDone(""); }} title="IRN upload file for the e-invoice portal" style={btn}>e-Invoice file</button>
      <button onClick={() => { setOpen(o => o === "eway" ? "" : "eway"); setIssues([]); setDone(""); }} title="Upload file for the e-way bill portal" style={btn}>e-Way bill file</button>
      {open && (
        <div className="no-print" style={{ flexBasis: "100%", background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{open === "einv" ? "e-Invoice (IRN) upload file" : "e-Way bill upload file"}</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {open === "einv"
              ? "For sales to GST-registered customers, when your turnover requires e-invoicing. FreWork makes the government's JSON file; you upload it on the e-invoice portal."
              : "For moving goods worth over ₹50,000. FreWork makes the government's JSON file; you upload it on the e-way bill portal."}
          </div>
          {open === "eway" && (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Vehicle number<input value={vehicle} onChange={e => setVehicle(e.target.value.toUpperCase())} placeholder="KL07AB1234" style={inp} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Distance (km)<input value={km} onChange={e => setKm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 75" style={inp} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Transporter name (optional)<input value={tName} onChange={e => setTName(e.target.value)} style={inp} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Transporter ID / GSTIN (optional)<input value={tId} onChange={e => setTId(e.target.value)} style={inp} /></label>
            </div>
          )}
          {issues.length > 0 && (
            <ul style={{ margin: 0, padding: "8px 12px 8px 28px", background: C.warnSoft, borderRadius: 10, fontSize: 13, color: C.warn, display: "flex", flexDirection: "column", gap: 3 }}>
              {issues.map((i, k) => <li key={k} style={{ color: i.level === "error" ? C.neg : C.warn }}>{i.text}</li>)}
            </ul>
          )}
          {done && <div style={{ fontSize: 13, fontWeight: 600, color: C.pos }}>✓ {done}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => make(open)} style={{ ...btn, background: C.navy, color: "#FFFFFF", border: "none" }}>Download file</button>
            {issues.some(i => i.level === "error") && <button onClick={() => make(open, true)} title="The portal will reject it until the red items are fixed" style={btn}>Download anyway</button>}
            <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>Tip: fix the details on the invoice above (click to edit), then download.</span>
          </div>
        </div>
      )}
    </>
  );
}
