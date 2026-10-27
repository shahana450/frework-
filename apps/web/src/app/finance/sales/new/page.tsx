"use client";
import { cur, activeMoney } from "@/lib/money";
// Sales invoice — a quick billing screen: pick or add a customer, type items, see the total, post.
// The journal entry (Dr customer/bank, Cr sales, Cr output GST, round-off) and GSTR-1 item detail are built underneath.
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { billTotals, isInterState, stateFromGstin, type BillLine } from "@/lib/billing";
import BulkImport from "@/components/finance/BulkImport";

type Contact = { id: string; name: string; gstin: string | null; phone: string | null; state: string | null };
type Account = { id: string; code: string; name: string; type: string; sub_type: string | null };
type PastItem = { desc: string; hsn: string; rate: number; gst: number };
type Paid = "credit" | "cash" | "bank";

const GST_RATES = ["0", "5", "12", "18", "28"];
const C = { ink: "#10241F", muted: "#6B7570", line: "#E6DFD0", navy: "#12352D", navySoft: "#EFE6D3", ground: "#F4EFE4", card: "#FFFDF8", good: "#0B7A55", goodSoft: "#E3F6EE", bad: "#B4321F", badSoft: "#FBECE8", gold: "#C9A24A", goldInk: "#9A6B22" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
// Amount in words, Indian system (for the invoice preview)
function inWords(n: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? "-" + a[x % 10] : "");
  const three = (x: number) => (x >= 100 ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " : "") : "") + (x % 100 ? two(x % 100) : "");
  let v = Math.round(n); if (!v) return "Zero";
  const parts: string[] = [];
  for (const [d, w] of [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]] as const) { if (v >= d) { parts.push(three(Math.floor(v / d)) + " " + w); v %= d; } }
  if (v) parts.push(three(v));
  return parts.join(" ");
}
const blankLine = (gst = "18"): BillLine => ({ description: "", hsn: "", qty: "1", rate: "", gst, priceIncludesGst: false });
const money = (n: number) => cur() + n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NewSalesInvoicePage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizState, setBizState] = useState("");
  const [biz, setBiz] = useState<{ name?: string; gstin?: string; address?: string }>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pastItems, setPastItems] = useState<PastItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ entry: string; total: number; customer: string } | null>(null);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerState, setCustomerState] = useState("");
  const [adding, setAdding] = useState<{ name: string; phone: string; gstin: string } | null>(null);
  const [paid, setPaid] = useState<Paid>("credit");
  const [bankAccountId, setBankAccountId] = useState("");
  const [salesAccountId, setSalesAccountId] = useState("");
  const [narration, setNarration] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [more, setMore] = useState(false);
  const [lines, setLines] = useState<BillLine[]>([blankLine()]);
  const [importing, setImporting] = useState<"customers" | "items" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);   // bumped after a bulk import, to load the new customers / items
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const [bizRes, contactsRes, accountsRes, pastRes, countRes, itemsRes] = await Promise.all([
        supabase.from("fw_fin_businesses").select("*").eq("id", saved).single(),
        supabase.from("fw_fin_contacts").select("id,name,gstin,phone,state").eq("business_id", saved).eq("type", "customer").order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type,sub_type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_journals").select("metadata").eq("business_id", saved).eq("type", "sales").order("date", { ascending: false }).limit(200),
        supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", saved).eq("type", "sales"),
        supabase.from("fw_fin_items").select("name,hsn,rate,gst_rate").eq("business_id", saved).eq("is_active", true).order("name"),
      ]);
      setBizState(bizRes.data?.state ?? "");
      { const b = (bizRes.data ?? {}) as Record<string, unknown>; setBiz({ name: b.name as string, gstin: (b.gstin ?? b.gst_number) as string, address: [b.address, b.city, b.state].filter(Boolean).join(", ") }); }
      setContacts((contactsRes.data ?? []) as Contact[]);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);
      const salesAcc = accs.find(a => a.type === "income" && /^sales\b/i.test(a.name)) ?? accs.find(a => a.type === "income" && (a.sub_type === "revenue" || a.sub_type === "direct_income"));
      if (salesAcc) setSalesAccountId(salesAcc.id);
      const bank = accs.find(a => a.sub_type === "bank"); if (bank) setBankAccountId(bank.id);
      // Items sold before, newest first: typing a name fills HSN, price and GST rate
      const seen = new Map<string, PastItem>();
      // The saved item list comes first; items only seen on past invoices fill in after
      for (const it of (itemsRes.data ?? []) as { name: string; hsn: string | null; rate: number | null; gst_rate: number | null }[])
        seen.set(it.name.trim().toLowerCase(), { desc: it.name.trim(), hsn: it.hsn ?? "", rate: Number(it.rate) || 0, gst: it.gst_rate === null ? 18 : Number(it.gst_rate) });
      for (const j of (pastRes.data ?? []) as { metadata: { gst_invoice?: { items?: { desc?: string; hsn?: string; qty?: number; taxable?: number; gst_rate?: number }[] } } | null }[])
        for (const it of j.metadata?.gst_invoice?.items ?? []) {
          const d = (it.desc ?? "").trim(); if (!d || seen.has(d.toLowerCase())) continue;
          seen.set(d.toLowerCase(), { desc: d, hsn: it.hsn ?? "", rate: it.qty ? Math.round(((it.taxable ?? 0) / it.qty) * 100) / 100 : it.taxable ?? 0, gst: it.gst_rate ?? 18 });
        }
      setPastItems([...seen.values()]);
      setInvoiceNo(`INV-${String((countRes.count ?? 0) + 1).padStart(4, "0")}`);
    });
  }, [router, reloadKey]);

  const customer = contacts.find(c => c.id === customerId);
  const interState = isInterState(bizState, customerState);
  const t = useMemo(() => billTotals(lines, interState), [lines, interState]);
  const total = roundOff ? t.total : t.exact;
  const matches = contacts.filter(c => !customerQuery || c.name.toLowerCase().includes(customerQuery.toLowerCase()) || (c.phone ?? "").includes(customerQuery)).slice(0, 8);

  function pickCustomer(c: Contact) {
    setCustomerId(c.id); setCustomerQuery(c.name); setCustomerOpen(false);
    setCustomerState(c.state || stateFromGstin(c.gstin) || bizState);
  }

  async function addCustomer() {
    if (!bizId || !adding?.name.trim()) return;
    const gstin = adding.gstin.trim().toUpperCase() || null;
    const state = stateFromGstin(gstin) || bizState || null;
    const { data, error: e } = await supabase.from("fw_fin_contacts").insert({ business_id: bizId, name: adding.name.trim(), type: "customer", phone: adding.phone.trim() || null, gstin, state, is_active: true }).select("id,name,gstin,phone,state").single();
    if (e || !data) { setError(e?.message ?? "Couldn't add the customer."); return; }
    setContacts(prev => [...prev, data as Contact].sort((a, b) => a.name.localeCompare(b.name)));
    pickCustomer(data as Contact); setAdding(null);
  }

  function setLine(i: number, patch: Partial<BillLine>) {
    setLines(prev => prev.map((l, k) => k === i ? { ...l, ...patch } : l));
  }
  function onDescription(i: number, v: string) {
    const hit = pastItems.find(p => p.desc.toLowerCase() === v.trim().toLowerCase());
    setLine(i, hit ? { description: v, hsn: hit.hsn, rate: String(hit.rate), gst: String(hit.gst) } : { description: v });
  }
  function addLine(focus = true) {
    setLines(prev => [...prev, blankLine(prev[prev.length - 1]?.gst ?? "18")]);
    if (focus) setTimeout(() => rowRefs.current[lines.length]?.focus(), 0);
  }

  async function save(mode: "draft" | "post") {
    if (!bizId) return;
    // No sales ledger yet (new business): open "Sales" under Sales Accounts instead of stopping
    let salesId = salesAccountId;
    if (!salesId) {
      const existing = accounts.find(a => a.type === "income" && /^sales\b/i.test(a.name));
      if (existing) salesId = existing.id;
      else {
        const { data: made, error: mErr } = await supabase.from("fw_fin_chart_of_accounts")
          .insert({ business_id: bizId, name: "Sales", code: `AUTO-${Date.now().toString().slice(-7)}`, type: "income", sub_type: "revenue", is_group: false, is_system: false, description: "Created with the first invoice under Sales Accounts" })
          .select("id,code,name,type,sub_type").single();
        if (mErr || !made) { setError(`Couldn't create the Sales ledger: ${mErr?.message ?? "unknown error"}`); setMore(true); return; }
        setAccounts(a => [...a, made as Account]);
        salesId = made.id as string;
      }
      setSalesAccountId(salesId);
    }
    if (!t.subtotal) { setError("Add at least one item with a price."); return; }
    if (paid === "bank" && !bankAccountId) { setError("Choose the bank account the money went into."); return; }
    setSaving(true); setError("");
    const find = (re: RegExp) => accounts.find(a => re.test(a.name) && a.type === "liability");
    const cgstAcc = find(/cgst/i), sgstAcc = find(/sgst|utgst/i), igstAcc = find(/igst/i);
    const debtorAcc = accounts.find(a => a.sub_type === "trade_receivables" || /debtor|receivable/i.test(a.name));
    const cashAcc = accounts.find(a => a.sub_type === "cash");
    const ro = roundOff ? t.roundOff : 0;
    const who = customer?.name ?? (customerQuery.trim() || "Cash customer");
    try {
      const r = await saveEntry({
        business_id: bizId, mode, date: invoiceDate, type: "sales", source: "sales_invoice",
        narration: narration.trim() || `Sales Invoice ${invoiceNo} - ${who}`,
        reference_no: invoiceNo, party_name: who, contact_id: customerId || null,
        account_heads: { "Round Off": "indirect_expense", "Cash": "cash" },
        metadata: { gst_invoice: {
          customer_gstin: customer?.gstin || null, customer_state: customerState || null, pos: (interState ? customerState : bizState) || null,
          items: lines.map((l, i) => ({ l, c: t.calc[i] })).filter(x => x.c.taxable).map(({ l, c }) => ({ hsn: l.hsn.trim() || undefined, desc: l.description.trim().slice(0, 60), uqc: "NOS", qty: parseFloat(l.qty) || 0, gst_rate: parseFloat(l.gst) || 0, taxable: c.taxable, igst: c.igst, cgst: c.cgst, sgst: c.sgst })),
        } },
        lines: [
          paid === "credit" ? { account_id: debtorAcc?.id, account_name: debtorAcc ? null : "Debtors Control", dr: total, cr: 0, narration: `Sales to ${who}` }
            : paid === "cash" ? { account_id: cashAcc?.id, account_name: cashAcc ? null : "Cash", dr: total, cr: 0, narration: `Cash sale to ${who}` }
            : { account_id: bankAccountId, dr: total, cr: 0, narration: `Sale to ${who}, paid to bank` },
          { account_id: salesId, dr: 0, cr: t.subtotal, narration: `Sales - ${invoiceNo}` },
          { account_id: cgstAcc?.id, account_name: cgstAcc ? null : "Output CGST", dr: 0, cr: t.cgst, narration: "CGST Output" },
          { account_id: sgstAcc?.id, account_name: sgstAcc ? null : "Output SGST", dr: 0, cr: t.sgst, narration: "SGST Output" },
          { account_id: igstAcc?.id, account_name: igstAcc ? null : "Output IGST", dr: 0, cr: t.igst, narration: "IGST Output" },
          ro > 0 ? { account_name: "Round Off", dr: 0, cr: ro, narration: "Round off" } : { account_name: "Round Off", dr: -ro, cr: 0, narration: "Round off" },
        ],
      });
      setDone({ entry: r.entry_no ?? invoiceNo, total, customer: who });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the invoice."); }
    setSaving(false);
  }

  function startNew() {
    setDone(null); setLines([blankLine()]); setCustomerId(""); setCustomerQuery(""); setCustomerState(""); setNarration(""); setPaid("credit");
    setInvoiceNo(n => { const m = /^(.*?)(\d+)$/.exec(n); return m ? m[1] + String(+m[2] + 1).padStart(m[2].length, "0") : n; });
  }

  const field: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, color: C.ink, padding: "0 12px", height: 42, borderRadius: 10, fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" };
  const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 6 };
  const chip = (on: boolean): React.CSSProperties => ({ flex: 1, height: 42, borderRadius: 10, border: on ? `2px solid ${C.navy}` : `1px solid ${C.line}`, background: on ? C.navySoft : C.card, color: on ? C.navy : C.ink, fontWeight: on ? 800 : 600, fontSize: 14, cursor: "pointer" });

  if (done) return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink, fontFamily: SERIF, display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "32px 28px", maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: C.goodSoft, color: C.good, display: "grid", placeItems: "center", fontSize: 28, margin: "0 auto 14px" }}>✓</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Invoice saved</h1>
        <p style={{ margin: "0 0 20px", color: C.muted }}>{done.entry} · {done.customer} · <b style={{ color: C.ink }}>{money(done.total)}</b></p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={startNew} style={{ height: 44, padding: "0 20px", borderRadius: 11, border: "none", background: C.navy, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: SERIF }}>+ New invoice</button>
          <Link href="/finance/invoices" style={{ height: 44, padding: "0 20px", borderRadius: 11, border: `1px solid ${C.line}`, color: C.ink, fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>All invoices</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink, fontFamily: SERIF, paddingBottom: 40 }}>
      <style>{`
        .bill-top{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}.bill-top>:first-child{grid-column:1/-1}
        .inv-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:24px;align-items:start}
        @media (max-width:1000px){.inv-two{grid-template-columns:minmax(0,1fr)}}
        .inv-pv th{font-weight:400;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#4A5651;padding:6px 0;border-bottom:1px solid #6B7570}
        .inv-pv td{padding:8px 0;border-bottom:1px solid #EFE8DA;font-size:13px}
        .bill-row{display:grid;grid-template-columns:minmax(0,2.4fr) 64px 110px 86px 28px;gap:8px;align-items:center}
        .bill-head{font-size:12px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.05em}
        .bill-amt{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
        .bill-input:focus{border-color:${C.navy}!important;box-shadow:0 0 0 3px ${C.navySoft}}
        @media (max-width:760px){
          .bill-top{grid-template-columns:1fr 1fr}.bill-top>:first-child{grid-column:1/-1}
          .bill-head{display:none}
          .bill-row{grid-template-columns:1fr 1fr 1fr;padding:12px 0;border-bottom:1px solid ${C.line}}
          .bill-row>.desc{grid-column:1/-1}.bill-row>.amt{grid-column:1/3;text-align:left}
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700 }}>New invoice</h1>
          <span style={{ flex: 1, color: C.muted, fontSize: 14.5, fontStyle: "italic" }}>{invoiceNo} · {new Date(invoiceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          <button onClick={() => save("draft")} disabled={saving} style={{ height: 44, padding: "0 20px", borderRadius: 999, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontFamily: SERIF, fontSize: 15, cursor: "pointer" }}>Save draft</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Invoice ${invoiceNo} from ${biz.name ?? "us"} — ${money(total)}${customer || customerQuery ? ` for ${customer?.name ?? customerQuery}` : ""}`)}`} target="_blank" rel="noopener noreferrer" style={{ height: 44, padding: "0 20px", borderRadius: 999, border: `1px solid ${C.navy}`, color: C.ink, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Share on WhatsApp</a>
          <button onClick={() => save("post")} disabled={saving} style={{ height: 44, padding: "0 24px", borderRadius: 999, border: "none", background: C.navy, color: "#fff", fontFamily: SERIF, fontWeight: 700, fontSize: 15, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save invoice"}</button>
        </div>

        {error && <div role="alert" style={{ background: C.badSoft, color: C.bad, padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontWeight: 600 }}>{error}</div>}

        <div className="inv-two"><div>
        {/* Who and when */}
        <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div className="bill-top">
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label style={label} htmlFor="cust">Bill to</label>
                <button type="button" onClick={() => setImporting("customers")} style={{ border: "none", background: "none", color: C.navy, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>⇪ Import customers</button>
              </div>
              <input id="cust" className="bill-input" style={field} placeholder="Search customer name or phone…" autoComplete="off"
                value={customerQuery} onFocus={() => setCustomerOpen(true)} onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
                onChange={e => { setCustomerQuery(e.target.value); setCustomerId(""); setCustomerOpen(true); }} />
              {customerOpen && (
                <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(20,26,58,.12)", overflow: "hidden" }}>
                  {matches.map(c => (
                    <button key={c.id} onMouseDown={() => pickCustomer(c)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "10px 14px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: 14.5, color: C.ink }}>
                      <span>{c.name}</span><span style={{ color: C.muted, fontSize: 12.5 }}>{c.gstin ?? c.phone ?? ""}</span>
                    </button>
                  ))}
                  <button onMouseDown={() => setAdding({ name: customerQuery.trim(), phone: "", gstin: "" })} style={{ width: "100%", padding: "11px 14px", border: "none", borderTop: `1px solid ${C.line}`, background: C.navySoft, color: C.navy, fontWeight: 800, textAlign: "left", cursor: "pointer", fontSize: 14.5 }}>
                    + Add {customerQuery.trim() ? `"${customerQuery.trim()}"` : "new customer"}
                  </button>
                </div>
              )}
              {customer && <div style={{ marginTop: 6, fontSize: 12.5, color: C.muted }}>{customer.gstin ? `GSTIN ${customer.gstin} · ` : "No GSTIN (B2C) · "}{customerState || "state not set"} · {interState ? "IGST" : "CGST + SGST"}</div>}
              {!customer && customerQuery.trim() && !customerOpen && <div style={{ marginTop: 6, fontSize: 12.5, color: C.muted }}>Walk-in customer — not saved to your list</div>}
            </div>
            <div>
              <label style={label} htmlFor="dt">Date</label>
              <input id="dt" type="date" className="bill-input" style={field} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label style={label} htmlFor="no">Invoice no.</label>
              <input id="no" className="bill-input" style={field} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
            </div>
          </div>

          {adding && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: C.navySoft, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end" }}>
              <div><label style={label}>Customer name</label><input className="bill-input" style={field} value={adding.name} autoFocus onChange={e => setAdding({ ...adding, name: e.target.value })} /></div>
              <div><label style={label}>Phone (optional)</label><input className="bill-input" style={field} inputMode="tel" value={adding.phone} onChange={e => setAdding({ ...adding, phone: e.target.value })} /></div>
              <div><label style={label}>GSTIN (optional)</label><input className="bill-input" style={{ ...field, textTransform: "uppercase" }} value={adding.gstin} onChange={e => setAdding({ ...adding, gstin: e.target.value })} placeholder="State is read from it" /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addCustomer} style={{ height: 42, flex: 1, borderRadius: 10, border: "none", background: C.navy, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Save customer</button>
                <button onClick={() => setAdding(null)} style={{ height: 42, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
        </section>

        {/* Items */}
        <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <datalist id="past-items">{pastItems.map(p => <option key={p.desc} value={p.desc} />)}</datalist>
          <div className="bill-row bill-head" style={{ marginBottom: 8 }}>
            <span>Item</span><span>Qty</span><span>Price {cur()}</span><span>GST</span><span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="bill-row" style={{ marginBottom: 8 }}>
              <input ref={el => { rowRefs.current[i] = el; }} className="bill-input desc" style={field} list="past-items" placeholder="What did you sell?" value={l.description}
                onChange={e => onDescription(i, e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }} />
              <input className="bill-input" style={{ ...field, textAlign: "right" }} inputMode="decimal" aria-label="Quantity" value={l.qty} onChange={e => setLine(i, { qty: e.target.value })} />
              <input className="bill-input" style={{ ...field, textAlign: "right" }} inputMode="decimal" aria-label="Price" placeholder="0" value={l.rate} onChange={e => setLine(i, { rate: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }} />
              <select className="bill-input" style={field} aria-label="GST rate" value={l.gst} onChange={e => setLine(i, { gst: e.target.value })}>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
              <button aria-label="Remove item" onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, k) => k !== i) : [blankLine()])}
                style={{ height: 32, width: 32, border: "none", borderRadius: 8, background: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <button onClick={() => addLine()} style={{ height: 38, padding: "0 14px", borderRadius: 10, border: `1px dashed ${C.navy}`, background: "none", color: C.navy, fontWeight: 800, cursor: "pointer" }}>+ Add item</button>
            <button type="button" onClick={() => setImporting("items")} style={{ border: "none", background: "none", color: C.navy, fontWeight: 700, fontSize: 13, cursor: "pointer", marginLeft: 12 }}>⇪ Import items</button>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, color: C.muted, cursor: "pointer" }}>
              <input type="checkbox" checked={lines.every(l => l.priceIncludesGst)} onChange={e => setLines(prev => prev.map(l => ({ ...l, priceIncludesGst: e.target.checked })))} />
              Prices include GST
            </label>
          </div>
        </section>

        {/* Payment */}
        <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <span style={label}>Payment</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={chip(paid === "credit")} onClick={() => setPaid("credit")}>Not paid yet</button>
            <button style={chip(paid === "cash")} onClick={() => setPaid("cash")}>Paid in cash</button>
            <button style={chip(paid === "bank")} onClick={() => setPaid("bank")}>Paid to bank / UPI</button>
          </div>
          {paid === "bank" && (
            <select className="bill-input" style={{ ...field, marginTop: 10, maxWidth: 320 }} value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} aria-label="Bank account">
              <option value="">Choose bank account…</option>
              {accounts.filter(a => a.sub_type === "bank").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          <button onClick={() => setMore(m => !m)} style={{ marginTop: 14, border: "none", background: "none", color: C.navy, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 14 }}>{more ? "▾" : "▸"} More options</button>
          {more && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <div><label style={label}>Customer state (for GST)</label><input className="bill-input" style={field} value={customerState} onChange={e => setCustomerState(e.target.value)} placeholder={bizState || "e.g. Kerala"} /></div>
              <div><label style={label}>Sales ledger</label>
                <select className="bill-input" style={field} value={salesAccountId} onChange={e => setSalesAccountId(e.target.value)}>
                  <option value="">{accounts.some(a => a.type === "income") ? "Choose…" : "Sales (created when you save)"}</option>
                  {accounts.filter(a => a.type === "income").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></div>
              <div><label style={label}>HSN / SAC codes</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {lines.map((l, i) => <input key={i} className="bill-input" style={field} placeholder={`HSN for ${l.description || `item ${i + 1}`}`} value={l.hsn} onChange={e => setLine(i, { hsn: e.target.value })} />)}
                </div></div>
              <div><label style={label}>Note on the entry</label><input className="bill-input" style={field} value={narration} onChange={e => setNarration(e.target.value)} placeholder={`Sales Invoice ${invoiceNo}`} /></div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} /> Round total to nearest rupee
              </label>
            </div>
          )}
        </section>

        </div>

        {/* Live preview */}
        <div style={{ background: C.navy, borderRadius: 20, padding: "18px 20px 20px", position: "sticky", top: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#DCE4E0", fontSize: 14, marginBottom: 12 }}><span>Live preview · A4</span><span>Updates as you type</span></div>
          <div className="inv-pv" style={{ background: "#FFFFFF", padding: "30px 34px", color: C.ink, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 18, borderBottom: `2px solid ${C.navy}` }}>
              <div><div style={{ fontSize: 20, fontWeight: 700 }}>{biz.name || "[Your business name]"}</div><div style={{ fontSize: 12, color: C.muted }}>{biz.address || "[Address]"} · GSTIN {biz.gstin || "[your GSTIN]"}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, letterSpacing: ".3em", color: C.goldInk }}>TAX INVOICE</div><div style={{ fontSize: 17, fontWeight: 700 }}>{invoiceNo}</div><div style={{ fontSize: 12, color: C.muted }}>{new Date(invoiceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div></div>
            </div>
            <div style={{ padding: "18px 0 14px" }}><div style={{ fontSize: 11, letterSpacing: ".2em", color: C.muted }}>BILL TO</div><div style={{ fontWeight: 700 }}>{customer?.name || customerQuery || "—"}</div>{customer?.gstin && <div style={{ fontSize: 12, color: C.muted }}>GSTIN {customer.gstin}</div>}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ textAlign: "left" }}>Item</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Rate</th><th style={{ textAlign: "right" }}>GST</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                {lines.map((l, i) => (l.description || t.calc[i]?.taxable) ? (
                  <tr key={i}><td>{l.description || "—"}</td><td style={{ textAlign: "right" }}>{l.qty}</td><td style={{ textAlign: "right" }}>{(parseFloat(l.rate) || 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}</td><td style={{ textAlign: "right" }}>{l.gst}%</td><td style={{ textAlign: "right" }}>{(t.calc[i]?.taxable ?? 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}</td></tr>
                ) : null)}
              </tbody>
            </table>
            <div style={{ display: "grid", gap: 4, maxWidth: 270, marginLeft: "auto", marginTop: 18, fontSize: 13 }}>
              <Row k="Taxable value" v={money(t.subtotal).replace(cur(), "")} />
              {interState ? <Row k="IGST" v={money(t.igst).replace(cur(), "")} /> : <><Row k="CGST" v={money(t.cgst).replace(cur(), "")} /><Row k="SGST" v={money(t.sgst).replace(cur(), "")} /></>}
              {roundOff && t.roundOff !== 0 && <Row k="Round off" v={(t.roundOff > 0 ? "+" : "−") + money(Math.abs(t.roundOff)).replace(cur(), "")} />}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.muted}`, paddingTop: 6, marginTop: 2 }}><b>Total</b><b style={{ fontSize: 16, borderBottom: `3px solid ${C.gold}` }}>{money(total)}</b></div>
            </div>
            <div style={{ marginTop: 18, fontSize: 12, fontStyle: "italic", color: C.muted }}>Rupees {inWords(total)} Only</div>
          </div>
        </div>
        </div>
      </div>
      {importing && bizId && <BulkImport kind={importing} bizId={bizId} onClose={() => setImporting(null)} onDone={() => setReloadKey(k => k + 1)} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: "inherit" }}><span>{k}</span><span>{v}</span></div>;
}
