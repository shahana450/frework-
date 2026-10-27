"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Contact = { id: string; name: string; gstin: string | null };
type Account = { id: string; code: string; name: string; type: string; sub_type: string | null };
type LineItem = { description: string; hsn_sac: string; qty: string; rate: string; gst_rate: string; amount: number; cgst: number; sgst: number; igst: number };

const GST_RATES = [0, 5, 12, 18, 28];

export default function NewPurchaseBillPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizState, setBizState] = useState("");
  const [fyId, setFyId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billNo, setBillNo] = useState("");
  const [vendorBillNo, setVendorBillNo] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorState, setVendorState] = useState("");
  const [narration, setNarration] = useState("");
  const [purchaseAccountId, setPurchaseAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"credit" | "bank" | "cash">("credit");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const [lines, setLines] = useState<LineItem[]>([
    { description: "", hsn_sac: "", qty: "1", rate: "", gst_rate: "18", amount: 0, cgst: 0, sgst: 0, igst: 0 },
  ]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [bizRes, fyRes, contactsRes, accountsRes] = await Promise.all([
        supabase.from("fw_fin_businesses").select("state").eq("id", saved).single(),
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
        supabase.from("fw_fin_contacts").select("id,name,gstin").eq("business_id", saved).in("type", ["vendor", "both"]).order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type,sub_type").eq("business_id", saved).eq("is_group", false).order("code"),
      ]);

      setBizState(bizRes.data?.state ?? "");
      setFyId(fyRes.data?.id ?? null);
      setContacts((contactsRes.data ?? []) as Contact[]);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);

      const purAcc = accs.find(a => a.sub_type === "direct_expense" || a.name.toLowerCase().includes("purchase"));
      const bankAcc = accs.find(a => a.sub_type === "bank" || a.name.toLowerCase().includes("bank"));
      if (purAcc) setPurchaseAccountId(purAcc.id);
      if (bankAcc) setPaymentAccountId(bankAcc.id);

      const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact" }).eq("business_id", saved).eq("type", "purchase");
      setBillNo(`BILL-${String((count ?? 0) + 1).padStart(4, "0")}`);
    });
  }, []);

  const isIGST = vendorState && bizState && vendorState !== bizState;

  function calcLine(line: LineItem): LineItem {
    const qty = parseFloat(line.qty) || 0;
    const rate = parseFloat(line.rate) || 0;
    const gstRate = parseFloat(line.gst_rate) || 0;
    const base = qty * rate;
    const gstAmt = base * gstRate / 100;
    return {
      ...line,
      amount: base,
      cgst: isIGST ? 0 : gstAmt / 2,
      sgst: isIGST ? 0 : gstAmt / 2,
      igst: isIGST ? gstAmt : 0,
    };
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines(prev => { const u = [...prev]; u[i] = calcLine({ ...u[i], [field]: value }); return u; });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const totalCGST = lines.reduce((s, l) => s + l.cgst, 0);
  const totalSGST = lines.reduce((s, l) => s + l.sgst, 0);
  const totalIGST = lines.reduce((s, l) => s + l.igst, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = subtotal + totalGST;
  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

  async function handleSubmit(mode: "draft" | "post") {
    if (!bizId) return;
    // No purchase ledger yet (new business): open "Purchases" under Purchase Accounts instead of stopping
    let purchaseId = purchaseAccountId;
    if (!purchaseId) {
      const existing = accounts.find(a => /^purchases?\b/i.test(a.name) && a.type === "expense");
      if (existing) purchaseId = existing.id;
      else if (accounts.some(a => a.type === "expense")) { setError("Choose the purchase or expense account for this bill."); return; }
      else {
        const { data: made, error: mErr } = await supabase.from("fw_fin_chart_of_accounts")
          .insert({ business_id: bizId, name: "Purchases", code: `AUTO-${Date.now().toString().slice(-7)}`, type: "expense", sub_type: "direct_expense", is_group: false, is_system: false, description: "Created with the first bill under Purchase Accounts" })
          .select("id,code,name,type,sub_type").single();
        if (mErr || !made) { setError(`Couldn't create the Purchases ledger: ${mErr?.message ?? "unknown error"}`); return; }
        setAccounts(a => [...a, made as Account]);
        purchaseId = made.id as string;
      }
      setPurchaseAccountId(purchaseId);
    }
    if (!lines.some(l => l.amount > 0)) { setError("Add at least one line item"); return; }
    setSaving(true); setError("");

    const vendor = contacts.find(c => c.id === vendorId);
    const creditorAcc = accounts.find(a => a.sub_type === "trade_payables" || a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"));
    const cgstInAcc = accounts.find(a => a.name.toLowerCase().includes("cgst input") || (a.name.toLowerCase().includes("cgst") && a.type === "asset"));
    const sgstInAcc = accounts.find(a => a.name.toLowerCase().includes("sgst input") || (a.name.toLowerCase().includes("sgst") && a.type === "asset"));
    const igstInAcc = accounts.find(a => a.name.toLowerCase().includes("igst input") || (a.name.toLowerCase().includes("igst") && a.type === "asset"));

    // Dr Purchase, Dr Input GST — Cr Creditors (credit) or the bank/cash paid from
    if (paymentMode !== "credit" && !paymentAccountId) { setError("Choose the bank or cash account paid from"); setSaving(false); return; }
    try {
      await saveEntry({
        business_id: bizId, mode: mode === "post" ? "post" : "draft", date: billDate, type: "purchase", source: "purchase_bill",
        narration: narration || `Purchase Bill ${billNo} - ${vendor?.name ?? "Vendor"}`,
        reference_no: vendorBillNo || billNo || null, party_name: vendor?.name ?? null, contact_id: vendorId || null,
        lines: [
          { account_id: purchaseId, dr: subtotal, cr: 0, narration: `Purchase - ${billNo}` },
          { account_id: cgstInAcc?.id, account_name: cgstInAcc ? null : "Input CGST", dr: totalCGST, cr: 0, narration: "CGST Input" },
          { account_id: sgstInAcc?.id, account_name: sgstInAcc ? null : "Input SGST", dr: totalSGST, cr: 0, narration: "SGST Input" },
          { account_id: igstInAcc?.id, account_name: igstInAcc ? null : "Input IGST", dr: totalIGST, cr: 0, narration: "IGST Input" },
          paymentMode === "credit"
            ? { account_id: creditorAcc?.id, account_name: creditorAcc ? null : "Creditors Control", dr: 0, cr: grandTotal, narration: `Purchase from ${vendor?.name ?? "Vendor"}` }
            : { account_id: paymentAccountId, dr: 0, cr: grandTotal, narration: `Purchase from ${vendor?.name ?? "Vendor"}` },
        ],
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); setSaving(false); return; }
    router.push("/finance/journals");
  }

  const T = { ink: "#10241F", green: "#12352D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", muted: "#6B7570" };
  const inputStyle = { background: "#FFFFFF", border: `1px solid ${T.line}`, color: T.ink, padding: "10px 12px", borderRadius: 10, fontSize: "0.92rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.82rem", color: "#4A5651", marginBottom: "0.4rem" };
  const card = { background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, padding: "20px 20px" };
  const colHead = { fontSize: "0.7rem", letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.muted };
  const pill = (dark: boolean) => ({ height: 42, padding: "0 20px", borderRadius: 999, border: `1px solid ${dark ? T.green : T.line}`, background: dark ? T.green : T.paper, color: dark ? "#FFFFFF" : T.ink, fontFamily: "inherit", fontWeight: dark ? 700 : 400, fontSize: "0.95rem", cursor: saving ? "wait" : "pointer" });

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <style>{`.pb-two{display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1fr);gap:22px;align-items:start}@media(max-width:900px){.pb-two{grid-template-columns:1fr}}
        .pb-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}@media(max-width:560px){.pb-grid{grid-template-columns:1fr}}
        .pb-line{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr) 60px minmax(0,1fr) 72px 24px;gap:8px;align-items:center}`}</style>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "32px 28px 80px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.74rem", letterSpacing: "0.3em", color: T.goldInk }}>PAYABLES · {billNo || "NEW BILL"}</div>
            <h1 style={{ margin: "4px 0 0", fontSize: "2.4rem", fontWeight: 700 }}>New Purchase Bill</h1>
          </div>
          <button onClick={() => handleSubmit("draft")} disabled={saving} style={pill(false)}>Save draft</button>
          <button onClick={() => handleSubmit("post")} disabled={saving} style={pill(true)}>{saving ? "Posting…" : "Post bill"}</button>
        </div>

        {error && <div style={{ background: "#FBECE8", border: "1px solid #EBC4BA", color: T.neg, padding: "10px 14px", borderRadius: 10 }}>{error}</div>}

        <div className="pb-two">
          {/* Scan panel: Smart Inbox reads the vendor's bill and books it item-wise */}
          <div style={{ background: T.green, color: "#FFFFFF", borderRadius: 20, padding: "22px 22px", display: "flex", flexDirection: "column", gap: 14, minHeight: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#DCE4E0" }}><span>Vendor’s bill</span><span>Read by FreBook AI</span></div>
            <div style={{ flex: 1, border: `2px dashed ${T.gold}`, borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10" /></svg>
              <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>Drop the vendor’s bill</div>
              <div style={{ color: "#C9D3CE", lineHeight: 1.6 }}>PDF, photo or scan — even handwritten.<br />Vendor, GSTIN, items and tax are read for you.</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
                <Link href="/finance/inbox" style={{ padding: "11px 22px", borderRadius: 999, background: T.gold, color: T.ink, fontWeight: 700, textDecoration: "none" }}>Choose file</Link>
                <Link href="/finance/inbox?camera=1" style={{ padding: "11px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", color: "#FFFFFF", textDecoration: "none" }}>Use camera</Link>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#9FB1AA", fontStyle: "italic" }}>Opens Smart Inbox, which books the bill item-wise for you to confirm.</div>
            </div>
            <Link href="/finance/shelf" style={{ color: T.gold, fontSize: "0.9rem" }}>or pick from Shelf · Bills &amp; Invoices</Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...card }} className="pb-grid">
              <div>
                <label style={labelStyle}>Vendor</label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={inputStyle}>
                  <option value="">Select vendor…</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Vendor state (GST)</label><input value={vendorState} onChange={e => { setVendorState(e.target.value); setLines(prev => prev.map(l => calcLine(l))); }} placeholder="e.g. Maharashtra" style={inputStyle} /></div>
              <div><label style={labelStyle}>Vendor bill no.</label><input value={vendorBillNo} onChange={e => setVendorBillNo(e.target.value)} placeholder="Vendor’s invoice number" style={inputStyle} /></div>
              <div><label style={labelStyle}>Bill date</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Purchase account</label>
                <select value={purchaseAccountId} onChange={e => setPurchaseAccountId(e.target.value)} style={inputStyle}>
                  <option value="">Select account…</option>
                  {accounts.filter(a => a.type === "expense" || (a.type === "asset" && a.sub_type === "inventory")).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Payment</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as "credit" | "bank" | "cash")} style={inputStyle}>
                  <option value="credit">Credit (Creditor — pay later)</option>
                  <option value="bank">Bank transfer (paid now)</option>
                  <option value="cash">Cash (paid now)</option>
                </select>
              </div>
              {paymentMode !== "credit" && (
                <div>
                  <label style={labelStyle}>Paid from</label>
                  <select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} style={inputStyle}>
                    <option value="">Select account…</option>
                    {accounts.filter(a => a.type === "asset" && (a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash"))).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div><label style={labelStyle}>Our bill no.</label><input value={billNo} onChange={e => setBillNo(e.target.value)} style={inputStyle} /></div>
            </div>

            <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Items / services {isIGST && <span style={{ marginLeft: 8, fontSize: "0.75rem", fontWeight: 400, color: T.goldInk, border: `1px solid ${T.gold}`, padding: "1px 8px", borderRadius: 999 }}>IGST · inter-state</span>}</div>
              <div className="pb-line">{["Description", "HSN", "Qty", `Rate ${cur()}`, "GST", ""].map(h => <span key={h} style={colHead}>{h}</span>)}</div>
              {lines.map((line, i) => (
                <div key={i} className="pb-line">
                  <input value={line.description} onChange={e => updateLine(i, "description", e.target.value)} placeholder="Item / service" style={inputStyle} />
                  <input value={line.hsn_sac} onChange={e => updateLine(i, "hsn_sac", e.target.value)} placeholder="HSN" style={inputStyle} />
                  <input type="number" value={line.qty} onChange={e => updateLine(i, "qty", e.target.value)} style={{ ...inputStyle, textAlign: "right", padding: "10px 8px" }} />
                  <input type="number" value={line.rate} onChange={e => updateLine(i, "rate", e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: "right" }} />
                  <select value={line.gst_rate} onChange={e => updateLine(i, "gst_rate", e.target.value)} style={{ ...inputStyle, padding: "10px 6px" }}>
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  {lines.length > 1 ? <button onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} aria-label="Remove line" style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>×</button> : <span />}
                </div>
              ))}
              <button onClick={() => setLines(p => [...p, { description: "", hsn_sac: "", qty: "1", rate: "", gst_rate: "18", amount: 0, cgst: 0, sgst: 0, igst: 0 }])}
                style={{ alignSelf: "flex-start", border: `1px dashed ${T.gold}`, background: "transparent", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", cursor: "pointer", color: T.ink }}>+ Add line</button>
              <div>
                <label style={{ ...labelStyle, marginTop: 6 }}>Narration</label>
                <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder={`Purchase Bill ${billNo}`} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              </div>
            </div>

            <div style={{ ...card, display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
                {[{ label: "Subtotal", value: subtotal }, ...(isIGST ? [{ label: "IGST (ITC)", value: totalIGST }] : [{ label: "CGST (ITC)", value: totalCGST }, { label: "SGST (ITC)", value: totalSGST }])].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}><span>{r.label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.value)}</span></div>
                ))}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.74rem", letterSpacing: "0.24em", color: T.goldInk }}>BILL TOTAL</div>
                <div style={{ fontSize: "2.1rem", fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(grandTotal)}</div>
                {totalGST > 0 && <div style={{ fontSize: "0.8rem", color: T.pos }}>ITC {cur()}{fmt(totalGST)}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
