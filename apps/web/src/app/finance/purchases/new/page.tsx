"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
      const saved = (localStorage.getItem() ?? "").replace(/﻿/g, "").trim();
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
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  async function handleSubmit(mode: "draft" | "post") {
    if (!bizId || !fyId || !purchaseAccountId) { setError("Select purchase account"); return; }
    if (!lines.some(l => l.amount > 0)) { setError("Add at least one line item"); return; }
    setSaving(true); setError("");

    const vendor = contacts.find(c => c.id === vendorId);
    const creditorAcc = accounts.find(a => a.sub_type === "trade_payables" || a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"));
    const cgstInAcc = accounts.find(a => a.name.toLowerCase().includes("cgst input") || (a.name.toLowerCase().includes("cgst") && a.type === "asset"));
    const sgstInAcc = accounts.find(a => a.name.toLowerCase().includes("sgst input") || (a.name.toLowerCase().includes("sgst") && a.type === "asset"));
    const igstInAcc = accounts.find(a => a.name.toLowerCase().includes("igst input") || (a.name.toLowerCase().includes("igst") && a.type === "asset"));

    // Purchase: Dr Purchase, Dr GST Input, Cr Creditor/Bank/Cash
    const jLines: { account_id: string; dr_amount: number; cr_amount: number; narration: string }[] = [];
    jLines.push({ account_id: purchaseAccountId, dr_amount: subtotal, cr_amount: 0, narration: `Purchase - ${billNo}` });
    if (totalCGST > 0 && cgstInAcc) jLines.push({ account_id: cgstInAcc.id, dr_amount: totalCGST, cr_amount: 0, narration: "CGST Input" });
    if (totalSGST > 0 && sgstInAcc) jLines.push({ account_id: sgstInAcc.id, dr_amount: totalSGST, cr_amount: 0, narration: "SGST Input" });
    if (totalIGST > 0 && igstInAcc) jLines.push({ account_id: igstInAcc.id, dr_amount: totalIGST, cr_amount: 0, narration: "IGST Input" });

    const creditAccId = paymentMode === "credit" ? (creditorAcc?.id ?? purchaseAccountId) : paymentAccountId;
    jLines.push({ account_id: creditAccId, dr_amount: 0, cr_amount: grandTotal, narration: `Purchase from ${vendor?.name ?? "Vendor"}` });

    const { data: journal, error: jErr } = await supabase.from("fw_fin_journals").insert({
      business_id: bizId, fy_id: fyId, date: billDate, entry_no: billNo,
      type: "purchase",
      narration: narration || `Purchase Bill ${billNo} - ${vendor?.name ?? "Vendor"}`,
      total_debit: grandTotal, total_credit: grandTotal,
      status: mode === "post" ? "posted" : "draft",
      reference_no: vendorBillNo || null,
      contact_id: vendorId || null,
      ai_generated: false,
    }).select("id").single();

    if (jErr || !journal) { setError(jErr?.message ?? "Failed to save"); setSaving(false); return; }
    await supabase.from("fw_fin_journal_lines").insert(jLines.map(l => ({ ...l, journal_id: journal.id })));
    router.push("/finance/journals");
  }

  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>New Purchase Bill</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => handleSubmit("draft")} disabled={saving} style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem" }}>Save Draft</button>
        <button onClick={() => handleSubmit("post")} disabled={saving} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "7px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>Post Bill</button>
      </nav>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.3rem", fontWeight: 800 }}>New Purchase Bill</h1>

        {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div><label style={labelStyle}>Our Bill No</label><input value={billNo} onChange={e => setBillNo(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Vendor Bill No (optional)</label><input value={vendorBillNo} onChange={e => setVendorBillNo(e.target.value)} placeholder="Vendor's invoice number" style={inputStyle} /></div>
            <div><label style={labelStyle}>Bill Date</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={inputStyle} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={labelStyle}>Vendor</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={inputStyle}>
                <option value="">-- Select Vendor --</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Vendor State (for GST)</label><input value={vendorState} onChange={e => { setVendorState(e.target.value); setLines(prev => prev.map(l => calcLine(l))); }} placeholder="e.g. Maharashtra" style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Purchase Account</label>
              <select value={purchaseAccountId} onChange={e => setPurchaseAccountId(e.target.value)} style={inputStyle}>
                <option value="">-- Select Account --</option>
                {accounts.filter(a => a.type === "expense" || (a.type === "asset" && a.sub_type === "inventory")).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Payment</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as "credit" | "bank" | "cash")} style={inputStyle}>
                <option value="credit">Credit (Creditor — pay later)</option>
                <option value="bank">Bank Transfer (Paid now)</option>
                <option value="cash">Cash (Paid now)</option>
              </select>
            </div>
            {paymentMode !== "credit" && (
              <div>
                <label style={labelStyle}>Payment Account</label>
                <select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Account --</option>
                  {accounts.filter(a => a.type === "asset" && (a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash"))).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, overflow: "hidden", marginBottom: "1rem" }}>
          <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(237,232,220,0.06)", fontWeight: 700, fontSize: "0.88rem" }}>
            Items / Services {isIGST && <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", background: "rgba(201,168,76,0.1)", color: "#C9A84C", padding: "2px 8px", borderRadius: 10 }}>IGST (inter-state)</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.01)" }}>
                  {["Description", "HSN/SAC", "Qty", "Rate (₹)", "GST %", "Base (₹)", isIGST ? "IGST (₹)" : "CGST+SGST (₹)", ""].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: h.includes("₹") || h.includes("%") ? "right" : "left", fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                    <td style={{ padding: "0.4rem 0.75rem" }}><input value={line.description} onChange={e => updateLine(i, "description", e.target.value)} placeholder="Item / service" style={{ ...inputStyle, minWidth: 160 }} /></td>
                    <td style={{ padding: "0.4rem 0.75rem" }}><input value={line.hsn_sac} onChange={e => updateLine(i, "hsn_sac", e.target.value)} placeholder="HSN" style={{ ...inputStyle, width: 80 }} /></td>
                    <td style={{ padding: "0.4rem 0.75rem" }}><input type="number" value={line.qty} onChange={e => updateLine(i, "qty", e.target.value)} style={{ ...inputStyle, width: 60, textAlign: "right" }} /></td>
                    <td style={{ padding: "0.4rem 0.75rem" }}><input type="number" value={line.rate} onChange={e => updateLine(i, "rate", e.target.value)} placeholder="0.00" style={{ ...inputStyle, width: 90, textAlign: "right" }} /></td>
                    <td style={{ padding: "0.4rem 0.75rem" }}>
                      <select value={line.gst_rate} onChange={e => updateLine(i, "gst_rate", e.target.value)} style={{ ...inputStyle, width: 70 }}>
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>{fmt(line.amount)}</td>
                    <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#4ade80" }}>
                      {isIGST ? fmt(line.igst) : fmt(line.cgst + line.sgst)}
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem" }}>
                      {lines.length > 1 && <button onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer" }}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid rgba(237,232,220,0.06)" }}>
            <button onClick={() => setLines(p => [...p, { description: "", hsn_sac: "", qty: "1", rate: "", gst_rate: "18", amount: 0, cgst: 0, sgst: 0, igst: 0 }])}
              style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "#C9A84C", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
              + Add Line
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
            <label style={labelStyle}>Narration</label>
            <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder={`Purchase Bill ${billNo}`} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }} />
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem", minWidth: 240 }}>
            {[
              { label: "Subtotal", value: subtotal },
              ...(isIGST ? [{ label: "IGST (ITC)", value: totalIGST }] : [{ label: "CGST (ITC)", value: totalCGST }, { label: "SGST (ITC)", value: totalSGST }]),
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.45)" }}>{r.label}</span>
                <span style={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>₹{fmt(r.value)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(201,168,76,0.2)", margin: "0.75rem 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800 }}>Total Payable</span>
              <span style={{ fontWeight: 900, fontSize: "1.2rem", color: "#C9A84C", fontVariantNumeric: "tabular-nums" }}>₹{fmt(grandTotal)}</span>
            </div>
            {totalGST > 0 && <div style={{ fontSize: "0.7rem", color: "#4ade80", marginTop: "0.35rem", textAlign: "right" }}>ITC: ₹{fmt(totalGST)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
