"use client";
import { cur, activeMoney } from "@/lib/money";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { amountInWords, invoiceTotals, recalcItem, type InvItem, type InvoiceDoc } from "@/lib/invoiceDoc";
import { stateCode } from "@/lib/gstr1";
import { readActiveBusiness } from "@/lib/activeBusiness";
import GovFiles from "./GovFiles";
import NicPanel from "./NicPanel";

const C = { bg: "#F5F6FA", line: "#E1E4EE", strong: "#C9CEDF", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", soft: "#E6E8F4", pos: "#0B7A55", neg: "#C2321F", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const money = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nice = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

/** Text that looks printed but can be edited in place. */
function E({ value, onChange, placeholder, style, multiline, align, readOnly }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties; multiline?: boolean; align?: "left" | "right" | "center"; readOnly?: boolean }) {
  const s: React.CSSProperties = { width: "100%", border: "1px dashed transparent", borderRadius: 4, background: "transparent", color: "inherit", font: "inherit", padding: "1px 3px", margin: "-2px -4px", textAlign: align ?? "left", resize: "none", ...style };
  return multiline
    ? <textarea className="ie" value={value} readOnly={readOnly} placeholder={placeholder} rows={Math.max(1, value.split("\n").length)} onChange={e => onChange(e.target.value)} style={s} />
    : <input className="ie" value={value} readOnly={readOnly} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={s} />;
}

type Customer = { name: string; gstin: string | null; state: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; pincode: string | null };

/** Customer name: type freely, or pick a saved customer to fill GSTIN, state, phone and address. */
function CustomerPick({ value, customers, onType, onPick }: { value: string; customers: Customer[]; onType: (v: string) => void; onPick: (c: Customer) => void }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const q = value.trim().toLowerCase();
  const list = customers.filter(c => !q || c.name.toLowerCase().includes(q)).slice(0, 8);
  const exact = customers.some(c => c.name.trim().toLowerCase() === q);
  return (
    <div style={{ position: "relative" }}>
      <input className="ie" value={value} placeholder="Customer name — type or pick a saved customer" aria-autocomplete="list" aria-expanded={open}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => { onType(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={e => {
          if (!open || !list.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); onPick(list[hi]); setOpen(false); }
          else if (e.key === "Escape") setOpen(false);
        }}
        style={{ width: "100%", border: "1px dashed transparent", borderRadius: 4, background: "transparent", color: "inherit", font: "inherit", padding: "1px 3px", margin: "-2px -4px", fontSize: 16, fontWeight: 700 }} />
      {open && (list.length > 0 || (q && !exact)) && (
        <div className="no-print" role="listbox" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 6px)", left: -4, width: "min(420px, 100%)", background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 12, boxShadow: "0 16px 36px -18px rgba(20,26,58,.45)", overflow: "hidden" }}>
          {list.length > 0 && <div style={{ padding: "8px 12px 4px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A90AE" }}>Saved customers</div>}
          {list.map((cu, i) => (
            <button key={cu.name + i} type="button" role="option" aria-selected={i === hi} onMouseDown={e => { e.preventDefault(); onPick(cu); setOpen(false); }} onMouseEnter={() => setHi(i)}
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", padding: "8px 12px", border: "none", background: i === hi ? "#F1F3FB" : "transparent", cursor: "pointer", textAlign: "left", font: "inherit" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#141A3A" }}>{cu.name}</span>
              <span style={{ fontSize: 11.5, color: "#5A6080" }}>{[cu.gstin || "No GSTIN", cu.state, cu.phone].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          {q && !exact && <div style={{ padding: "8px 12px", fontSize: 12, color: "#5A6080", borderTop: list.length ? "1px solid #EEF0F6" : "none" }}>Keep typing to use “{value.trim()}” as a new customer.</div>}
        </div>
      )}
    </div>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [orig, setOrig] = useState("");
  const [bookTotal, setBookTotal] = useState<number | null>(null);
  const [entryNo, setEntryNo] = useState("");
  const [canSave, setCanSave] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz);
      // Saved customers (contacts) plus customer ledgers, for the Bill-to picker
      Promise.all([
        supabase.from("fw_fin_contacts").select("name,gstin,state,phone,email,address,city,pincode").eq("business_id", biz).eq("type", "customer").order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("name").eq("business_id", biz).eq("sub_type", "trade_receivables").eq("is_group", false),
      ]).then(([ct, led]) => {
        const list = (ct.data ?? []) as Customer[];
        const known = new Set(list.map(x => x.name.trim().toLowerCase()));
        for (const l of (led.data ?? []) as { name: string }[]) if (!known.has(l.name.trim().toLowerCase())) list.push({ name: l.name, gstin: null, state: null, phone: null, email: null, address: null, city: null, pincode: null });
        setCustomers(list.sort((a, b) => a.name.localeCompare(b.name)));
      });
      const r = await fetch(`/api/finance/invoice-doc?business_id=${biz}&journal_id=${id}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't open the invoice." }); return; }
      setDoc(d.doc); setOrig(JSON.stringify(d.doc)); setCanSave(d.can_save !== false); setEntryNo(d.entry_no ?? "");
      setBookTotal(d.saved_at ? null : invoiceTotals(d.doc.items).total);
      if (!d.income) setMsg({ ok: false, text: "This entry doesn't credit a sales or income ledger — check it's really a sale before sending this invoice." });
    });
  }, [id, router]);

  const inter = useMemo(() => {
    if (!doc) return false;
    const a = stateCode(doc.seller.state), b = stateCode(doc.placeOfSupply);
    return !!a && !!b && a !== b;
  }, [doc]);
  const tot = doc ? invoiceTotals(doc.items) : null;
  const dirty = doc ? JSON.stringify(doc) !== orig : false;

  const set = (patch: Partial<InvoiceDoc>) => setDoc(d => d ? { ...d, ...patch } : d);
  const setSeller = (k: keyof InvoiceDoc["seller"], v: string) => setDoc(d => d ? { ...d, seller: { ...d.seller, [k]: v } } : d);
  const setBuyer = (k: keyof InvoiceDoc["buyer"], v: string) => setDoc(d => d ? { ...d, buyer: { ...d.buyer, [k]: v } } : d);
  const setItem = (i: number, patch: Partial<InvItem>, recalc = false) => setDoc(d => {
    if (!d) return d;
    const items = d.items.map((x, k) => k === i ? (recalc ? recalcItem({ ...x, ...patch }, inter) : { ...x, ...patch }) : x);
    return { ...d, items };
  });
  const addItem = () => setDoc(d => d ? { ...d, items: [...d.items, recalcItem({ desc: "", hsn: "", qty: 1, unit: "NOS", rate: 0, gstRate: d.items[0]?.gstRate ?? 18, taxable: 0, igst: 0, cgst: 0, sgst: 0 }, inter)] } : d);
  const removeItem = (i: number) => setDoc(d => d && d.items.length > 1 ? { ...d, items: d.items.filter((_, k) => k !== i) } : d);

  // Moving the place of supply between states switches IGST ↔ CGST+SGST on every line
  const prevInter = useRef<boolean | null>(null);
  useEffect(() => {
    if (!doc) return;
    if (prevInter.current !== null && prevInter.current !== inter) setDoc(d => d ? { ...d, items: d.items.map(x => recalcItem(x, inter)) } : d);
    prevInter.current = inter;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inter, !!doc]);

  const onLogo = (file: File) => {
    if (!/^image\//.test(file.type)) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 360 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      setSeller("logo", cv.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  async function save() {
    if (!doc) return;
    setSaving(true); setMsg(null);
    const r = await fetch("/api/finance/invoice-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, journal_id: id, doc }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save." }); return; }
    setOrig(JSON.stringify(doc)); setMsg({ ok: true, text: "Invoice saved." });
  }

  if (!doc) return <div style={{ padding: 40, color: msg ? C.neg : C.muted }}>{msg?.text ?? "Preparing the invoice…"}</div>;
  const mismatch = bookTotal != null && tot && Math.abs(tot.total - bookTotal) >= 1;
  const th: React.CSSProperties = { padding: "8px 8px", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, textAlign: "left", borderBottom: `1.5px solid ${C.ink}` };
  const td: React.CSSProperties = { padding: "8px 8px", fontSize: 13, verticalAlign: "top", borderBottom: `1px solid ${C.line}` };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, padding: "20px 16px 60px" }}>
      <style>{`
        .ie:hover:not([readonly]), .ie:focus { border-color: ${C.strong} !important; background: #FBFBFE !important; outline: none; }
        .ie::placeholder { color: #A9AEC8; }
        .inv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 680px) { .inv-grid { grid-template-columns: 1fr; } .inv-sheet { padding: 22px !important; } }
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #FFFFFF !important; }
          .fw-side, .fw-tabs, .no-print { display: none !important; }
          .fw-main { margin: 0 !important; padding: 0 !important; }
          .inv-wrap { padding: 0 !important; background: #FFFFFF !important; }
          .inv-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; }
          .ie { border-color: transparent !important; }
          .ie::placeholder { color: transparent; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ maxWidth: 860, margin: "0 auto 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href="/finance/journals" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>← Journal entries</Link>
        <span style={{ fontSize: 13, color: C.muted }}>· from {entryNo}</span>
        <span style={{ flex: 1 }} />
        {!canSave && !msg && <span style={{ fontSize: 12.5, color: C.warn }}>Saving edits may need a one-time database update — press Save to check.</span>}
        {msg && <span role="status" style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? C.pos : C.warn }}>{msg.text}</span>}
        <button onClick={save} disabled={!dirty || saving} title={dirty ? "" : "Edit the invoice to enable Save"} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.strong}`, background: "#FFFFFF", color: C.ink, fontWeight: 700, cursor: dirty ? "pointer" : "default", opacity: dirty ? 1 : 0.5 }}>{saving ? "Saving…" : "Save"}</button>
        {doc && <GovFiles doc={doc} />}
        <button onClick={() => window.print()} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>Print / PDF</button>
      </div>
      {mismatch && <div className="no-print" style={{ maxWidth: 860, margin: "0 auto 14px", background: C.warnSoft, color: C.warn, borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>The invoice total ({cur()}{money(tot!.total)}) differs from the posted entry ({cur()}{money(bookTotal!)}). Your books aren&apos;t changed by edits here — post an adjustment if the sale amount was wrong.</div>}
      {doc && bizId && <div style={{ maxWidth: 860, margin: "0 auto 12px" }}><NicPanel bizId={bizId} journalId={id} doc={doc} /></div>}
      <div className="no-print" style={{ maxWidth: 860, margin: "0 auto 10px", fontSize: 12.5, color: C.muted }}>Click any text on the invoice to edit it. Hover to see editable fields.</div>

      <div className="inv-wrap" style={{ display: "flex", justifyContent: "center" }}>
        <article className="inv-sheet" style={{ width: "100%", maxWidth: 860, background: "#FFFFFF", border: `1px solid ${C.line}`, boxShadow: "0 24px 60px -30px rgba(20,26,58,0.3)", padding: "40px 44px", display: "flex", flexDirection: "column", gap: 26, fontFamily: "'Manrope',system-ui,sans-serif" }}>

          {/* Header: logo + seller | title + numbers */}
          <header className="inv-grid" style={{ alignItems: "start" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <label style={{ cursor: "pointer", flexShrink: 0 }} title="Change logo">
                {doc.seller.logo
                  ? <img src={doc.seller.logo} alt={`${doc.seller.name} logo`} style={{ maxWidth: 96, maxHeight: 72, objectFit: "contain", display: "block" }} />
                  : <span className="no-print" style={{ width: 72, height: 72, borderRadius: 12, border: `1.5px dashed ${C.strong}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.muted, textAlign: "center" }}>＋ Logo</span>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ""; }} />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                <E value={doc.seller.name} onChange={v => setSeller("name", v)} placeholder="Your business name" style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700 }} />
                <E value={doc.seller.address} onChange={v => setSeller("address", v)} placeholder="Address" multiline style={{ fontSize: 12.5, color: C.muted }} />
                <E value={doc.seller.gstin ? `GSTIN ${doc.seller.gstin}` : ""} onChange={v => setSeller("gstin", v.replace(/^GSTIN\s*/i, "").toUpperCase())} placeholder="GSTIN" style={{ fontSize: 12.5, fontFamily: MONO }} />
                <E value={[doc.seller.phone, doc.seller.email].filter(Boolean).join(" · ")} onChange={v => { const [p, ...e] = v.split("·"); setSeller("phone", p.trim()); setSeller("email", e.join("·").trim()); }} placeholder="Phone · email" style={{ fontSize: 12.5, color: C.muted }} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <E value={doc.title} onChange={v => set({ title: v })} align="right" style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: C.primary, letterSpacing: "0.01em" }} />
              <div style={{ display: "grid", gridTemplateColumns: "auto 160px", gap: "4px 12px", fontSize: 13, alignItems: "center" }}>
                <span style={{ color: C.muted, textAlign: "right" }}>Invoice no.</span><E value={doc.invoiceNo} onChange={v => set({ invoiceNo: v.slice(0, 16) })} align="right" style={{ fontFamily: MONO, fontWeight: 600 }} />
                <span style={{ color: C.muted, textAlign: "right" }}>Date</span><input className="ie" type="date" value={doc.date} onChange={e => set({ date: e.target.value })} style={{ border: "1px dashed transparent", background: "transparent", font: "inherit", textAlign: "right", color: "inherit" }} />
                <span style={{ color: C.muted, textAlign: "right" }}>Due</span><input className="ie" type="date" value={doc.dueDate} onChange={e => set({ dueDate: e.target.value })} style={{ border: "1px dashed transparent", background: "transparent", font: "inherit", textAlign: "right", color: "inherit" }} />
                <span style={{ color: C.muted, textAlign: "right" }}>Place of supply</span><E value={doc.placeOfSupply} onChange={v => set({ placeOfSupply: v })} align="right" placeholder="State" />
              </div>
            </div>
          </header>

          {/* Bill to */}
          <section style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "14px 0", display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>BILL TO</span>
            <CustomerPick value={doc.buyer.name} customers={customers} onType={v => setBuyer("name", v)}
              onPick={cu => setDoc(d => {
                if (!d) return d;
                const address = cu.address ? [cu.address, [cu.city, cu.pincode].filter(Boolean).join(" ")].filter(Boolean).join("\n") : d.buyer.address;
                const state = cu.state || d.buyer.state;
                return { ...d, buyer: { ...d.buyer, name: cu.name, gstin: (cu.gstin ?? "").toUpperCase(), state, phone: cu.phone ?? d.buyer.phone, email: cu.email ?? d.buyer.email, address },
                  placeOfSupply: !d.placeOfSupply || d.placeOfSupply === d.buyer.state ? state : d.placeOfSupply };
              })} />
            <E value={doc.buyer.address} onChange={v => setBuyer("address", v)} placeholder="Customer address" multiline style={{ fontSize: 13, color: C.muted }} />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 220 }}><span style={{ color: C.muted }}>GSTIN</span><E value={doc.buyer.gstin} onChange={v => setBuyer("gstin", v.toUpperCase())} placeholder="Unregistered" style={{ fontFamily: MONO }} /></span>
              <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 160 }}><span style={{ color: C.muted }}>State</span><E value={doc.buyer.state} onChange={v => { setBuyer("state", v); if (!doc.placeOfSupply || doc.placeOfSupply === doc.buyer.state) set({ placeOfSupply: v }); }} placeholder="State" /></span>
              <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 160 }}><span style={{ color: C.muted }}>Phone</span><E value={doc.buyer.phone} onChange={v => setBuyer("phone", v)} placeholder="—" /></span>
            </div>
          </section>

          {/* Items */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", minWidth: 620 }}>
              <thead><tr>
                <th style={{ ...th, width: 28 }}>#</th><th style={th}>Description</th><th style={{ ...th, width: 84 }}>HSN/SAC</th>
                <th style={{ ...th, width: 56, textAlign: "right" }}>Qty</th><th style={{ ...th, width: 96, textAlign: "right" }}>Rate</th>
                <th style={{ ...th, width: 54, textAlign: "right" }}>GST %</th><th style={{ ...th, width: 110, textAlign: "right" }}>Amount</th><th className="no-print" style={{ ...th, width: 24 }} />
              </tr></thead>
              <tbody>
                {doc.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ ...td, color: C.muted }}>{i + 1}</td>
                    <td style={td}><E value={it.desc} onChange={v => setItem(i, { desc: v })} placeholder="Item or service" multiline /></td>
                    <td style={td}><E value={it.hsn} onChange={v => setItem(i, { hsn: v.replace(/\D/g, "").slice(0, 8) })} placeholder="—" style={{ fontFamily: MONO }} /></td>
                    <td style={td}><E value={String(it.qty)} onChange={v => setItem(i, { qty: Number(v.replace(/[^\d.]/g, "")) || 0 }, true)} align="right" /></td>
                    <td style={td}><E value={String(it.rate)} onChange={v => setItem(i, { rate: Number(v.replace(/[^\d.]/g, "")) || 0 }, true)} align="right" style={{ fontFamily: MONO }} /></td>
                    <td style={td}>
                      <select className="ie" value={it.gstRate} onChange={e => setItem(i, { gstRate: Number(e.target.value) }, true)} style={{ border: "1px dashed transparent", background: "transparent", font: "inherit", color: "inherit", textAlign: "right", width: "100%", appearance: "none" }}>
                        {[0, 0.25, 3, 5, 12, 18, 28, 40].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: MONO }}>{money(it.taxable)}</td>
                    <td className="no-print" style={td}>{doc.items.length > 1 && <button onClick={() => removeItem(i)} aria-label={`Remove line ${i + 1}`} style={{ border: "none", background: "none", color: C.neg, cursor: "pointer", fontSize: 16 }}>×</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="no-print" onClick={addItem} style={{ marginTop: 8, border: `1px dashed ${C.strong}`, background: "transparent", color: C.primary, borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Add line</button>
          </div>

          {/* Totals */}
          <section className="inv-grid" style={{ alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>AMOUNT IN WORDS</span><div style={{ fontWeight: 600, marginTop: 3 }}>{amountInWords(tot!.total)}</div></div>
              <div><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>BANK / UPI DETAILS</span><E value={doc.bankDetails} onChange={v => set({ bankDetails: v })} placeholder="Bank name, A/c no., IFSC · or UPI ID" multiline /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 16px", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: C.muted }}>Taxable value</span><span style={{ fontFamily: MONO, textAlign: "right" }}>{money(tot!.taxable)}</span>
              {inter
                ? <><span style={{ color: C.muted }}>IGST</span><span style={{ fontFamily: MONO, textAlign: "right" }}>{money(tot!.igst)}</span></>
                : <><span style={{ color: C.muted }}>CGST</span><span style={{ fontFamily: MONO, textAlign: "right" }}>{money(tot!.cgst)}</span><span style={{ color: C.muted }}>SGST</span><span style={{ fontFamily: MONO, textAlign: "right" }}>{money(tot!.sgst)}</span></>}
              {tot!.roundOff !== 0 && <><span style={{ color: C.muted }}>Round off</span><span style={{ fontFamily: MONO, textAlign: "right" }}>{tot!.roundOff > 0 ? "+" : ""}{money(tot!.roundOff)}</span></>}
              <span style={{ borderTop: `1.5px solid ${C.ink}`, paddingTop: 8, fontWeight: 800, fontSize: 15 }}>Total</span>
              <span style={{ borderTop: `1.5px solid ${C.ink}`, paddingTop: 8, fontWeight: 800, fontSize: 18, fontFamily: MONO, textAlign: "right" }}>{cur()}{money(tot!.total)}</span>
            </div>
          </section>

          {/* Footer */}
          <footer className="inv-grid" style={{ alignItems: "end", borderTop: `1px solid ${C.line}`, paddingTop: 16, fontSize: 12.5 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, color: C.muted }}>
              <E value={doc.terms} onChange={v => set({ terms: v })} placeholder="Terms" multiline />
              <E value={doc.notes} onChange={v => set({ notes: v })} placeholder="Note to customer" multiline />
            </div>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 34 }}>
              <span>For <b>{doc.seller.name || "your business"}</b></span>
              <span style={{ color: C.muted }}>Authorised signatory</span>
            </div>
          </footer>
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>Invoice dated {nice(doc.date)} · {doc.title === "Tax Invoice" ? "This is a computer-generated tax invoice." : "This is a computer-generated invoice."}</div>
        </article>
      </div>
    </div>
  );
}
