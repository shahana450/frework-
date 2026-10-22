"use client";
// Suppliers to chase: bills in your books that aren't in GSTR-2B mean the supplier hasn't reported them in GSTR-1,
// so that ITC can't be claimed yet. One card per supplier, with a ready WhatsApp message the owner sends.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { taxOf, type ItcRow } from "@/lib/itcMatch";

const C = { ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", neg: "#C2321F", negSoft: "#FDECEA", wa: "#0B6E4F" };
const inr = (n: number) => "₹" + Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const waNumber = (p: string | null | undefined) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d.length >= 11 ? d : ""; };
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function SupplierChase({ bizId, month, rows }: { bizId: string; month: string; rows: ItcRow[] }) {
  const [phones, setPhones] = useState<Map<string, string>>(new Map());
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (!bizId) return;
    supabase.from("fw_fin_contacts").select("name,phone").eq("business_id", bizId).then(({ data }) =>
      setPhones(new Map(((data ?? []) as { name: string; phone: string | null }[]).filter(c => c.phone).map(c => [key(c.name), c.phone!]))));
  }, [bizId]);

  const groups = useMemo(() => {
    const m = new Map<string, { supplier: string; bills: NonNullable<ItcRow["book"]>[]; itc: number }>();
    for (const r of rows) {
      if (r.status !== "onlyBooks" || !r.book) continue;
      const k = key(r.book.supplier || "unknown");
      const g = m.get(k) ?? { supplier: r.book.supplier || "Supplier", bills: [], itc: 0 };
      g.bills.push(r.book); g.itc += taxOf(r.book); m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.itc - a.itc);
  }, [rows]);
  if (!groups.length) return null;

  const total = groups.reduce((s, g) => s + g.itc, 0);
  const message = (g: (typeof groups)[number]) =>
    `Hello ${g.supplier}, your invoice${g.bills.length > 1 ? "s" : ""} to us for ${monthName(month)} ${g.bills.length > 1 ? "are" : "is"} not showing in our GSTR-2B:\n` +
    g.bills.map(b => `• ${b.docNo || b.entryNo} dated ${new Date(b.date + "T00:00:00").toLocaleDateString("en-IN")} — GST ${inr(taxOf(b))}`).join("\n") +
    `\n\nPlease include ${g.bills.length > 1 ? "them" : "it"} in your GSTR-1 (or check the GSTIN and invoice number) so we can claim the input tax credit. Thank you.`;
  const copy = async (k: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(""), 2000); } catch { /* */ } };

  return (
    <section aria-label="Suppliers to chase" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 15, color: C.ink }}>Suppliers to chase</b>
        <span style={{ fontSize: 12.5, color: C.muted }}>{groups.length} supplier{groups.length > 1 ? "s" : ""} haven&apos;t reported your bills — <b style={{ color: C.neg }}>{inr(total)}</b> ITC on hold until they do.</span>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {groups.map(g => {
          const k = key(g.supplier), num = waNumber(phones.get(k)), text = message(g);
          return (
            <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: 13.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.supplier}</b>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.neg, background: C.negSoft, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{inr(g.itc)}</span>
              </div>
              <span style={{ fontSize: 12, color: C.muted }}>{g.bills.length} bill{g.bills.length > 1 ? "s" : ""}: {g.bills.slice(0, 3).map(b => b.docNo || b.entryNo).join(", ")}{g.bills.length > 3 ? "…" : ""}</span>
              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <a href={`https://wa.me/${num}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 800, padding: "6px 12px", borderRadius: 9, background: C.wa, color: "#FFFFFF", textDecoration: "none" }}>
                  {num ? "Ask on WhatsApp" : "WhatsApp (choose chat)"}
                </a>
                <button onClick={() => copy(k, text)} style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#FFFFFF", cursor: "pointer" }}>{copied === k ? "✓ Copied" : "Copy message"}</button>
              </div>
            </div>
          );
        })}
      </div>
      <span style={{ fontSize: 11.5, color: C.muted }}>Add a supplier&apos;s mobile in Customers &amp; Suppliers to open their chat directly. Bills from the last few days of the month may simply appear in next month&apos;s 2B.</span>
    </section>
  );
}
