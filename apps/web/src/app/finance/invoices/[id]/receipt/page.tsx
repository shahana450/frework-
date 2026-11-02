"use client";
// Thermal receipt — the same invoice, laid out for a 58 mm or 80 mm roll printer (counter billing). Opens the print
// dialog by itself; choose the thermal printer there. ?w=58 for 2-inch rolls, default 80 mm (3-inch).
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { invoiceTotals, amountInWords, type InvoiceDoc } from "@/lib/invoiceDoc";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Receipt() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const width = sp.get("w") === "58" ? 58 : 80;
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setErr("Sign in to print this receipt."); return; }
      const biz = (readActiveBusiness(user.id) ?? "").trim();
      const r = await fetch(`/api/finance/invoice-doc?business_id=${biz}&journal_id=${id}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Couldn't open the invoice."); return; }
      setDoc(d.doc);
    });
  }, [id]);
  useEffect(() => { if (doc) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [doc]);

  if (err) return <p style={{ padding: 20, fontFamily: "monospace" }}>{err}</p>;
  if (!doc) return <p style={{ padding: 20, fontFamily: "monospace" }}>Preparing receipt…</p>;
  const t = invoiceTotals(doc.items);
  const small = width === 58;
  const line = <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />;
  const row = (l: string, r: string, bold = false) => <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontWeight: bold ? 700 : 400 }}><span>{l}</span><span>{r}</span></div>;

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <style>{`@page { size: ${width}mm auto; margin: 2mm; } @media print { .no-print { display: none !important } } body { margin: 0; background: #FFFFFF }`}</style>
      <div className="no-print" style={{ padding: 10, fontFamily: "system-ui, sans-serif", fontSize: 13, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => window.print()} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#12352D", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Print</button>
        <a href={`?w=${small ? 80 : 58}`}>Switch to {small ? "80 mm (3-inch)" : "58 mm (2-inch)"}</a>
        <span style={{ color: "#5E6B66" }}>In the print dialog choose the thermal printer, paper {width} mm, margins none.</span>
      </div>
      <div style={{ width: `${width - 4}mm`, margin: "0 auto", padding: "2mm 0", fontFamily: "'Courier New', ui-monospace, monospace", fontSize: small ? 10 : 11.5, color: "#000", lineHeight: 1.35 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: small ? 12 : 14 }}>{doc.seller.name}</div>
          {doc.seller.address && <div>{doc.seller.address}</div>}
          {doc.seller.gstin && <div>GSTIN {doc.seller.gstin}</div>}
          {doc.seller.phone && <div>Ph {doc.seller.phone}</div>}
          <div style={{ fontWeight: 700, marginTop: 3 }}>{doc.title.toUpperCase()}</div>
        </div>
        {line}
        {row(`No ${doc.invoiceNo}`, doc.date.split("-").reverse().join("-"))}
        {doc.buyer.name && <div>To: {doc.buyer.name}{doc.buyer.gstin ? ` (${doc.buyer.gstin})` : ""}</div>}
        {line}
        {doc.items.map((i, k) => (
          <div key={k} style={{ marginBottom: 2 }}>
            <div>{i.desc || "Item"}{i.hsn ? ` · ${i.hsn}` : ""}</div>
            {row(`  ${i.qty} ${i.unit} × ${money(i.rate)}`, money(i.taxable))}
          </div>
        ))}
        {line}
        {row("Taxable", money(t.taxable))}
        {t.cgst ? row("CGST", money(t.cgst)) : null}
        {t.sgst ? row("SGST", money(t.sgst)) : null}
        {t.igst ? row("IGST", money(t.igst)) : null}
        {t.roundOff ? row("Round off", money(t.roundOff)) : null}
        {line}
        {row("TOTAL", `₹${money(t.total)}`, true)}
        <div style={{ fontSize: small ? 9 : 10, marginTop: 2 }}>{amountInWords(t.total)}</div>
        {line}
        {doc.notes && <div>{doc.notes}</div>}
        <div style={{ textAlign: "center", marginTop: 4 }}>Thank you!</div>
      </div>
    </div>
  );
}
