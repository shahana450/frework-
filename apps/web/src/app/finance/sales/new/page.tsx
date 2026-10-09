"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";
import Link from "next/link";

type Contact = { id: string; name: string; gstin: string | null; email: string | null };
type Account = { id: string; code: string; name: string; type: string; sub_type: string | null };
type LineItem = { description: string; hsn_sac: string; qty: string; rate: string; gst_rate: string; amount: number; cgst: number; sgst: number; igst: number };

const GST_RATES = [0, 5, 12, 18, 28];

export default function NewSalesInvoicePage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizState, setBizState] = useState("");
  const [fyId, setFyId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Header fields
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [narration, setNarration] = useState("");
  const [salesAccountId, setSalesAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "credit">("credit");

  const [lines, setLines] = useState<LineItem[]>([
    { description: "", hsn_sac: "", qty: "1", rate: "", gst_rate: "18", amount: 0, cgst: 0, sgst: 0, igst: 0 },
  ]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [bizRes, fyRes, contactsRes, accountsRes] = await Promise.all([
        supabase.from("fw_fin_businesses").select("state,gstin").eq("id", saved).single(),
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
        supabase.from("fw_fin_contacts").select("id,name,gstin,email").eq("business_id", saved).eq("type", "customer").order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type,sub_type").eq("business_id", saved).eq("is_group", false).order("code"),
      ]);

      setBizState(bizRes.data?.state ?? "");
      setFyId(fyRes.data?.id ?? null);
      setContacts((contactsRes.data ?? []) as Contact[]);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);

      // Auto-select first sales and bank account
      const salesAcc = accs.find(a => a.sub_type === "direct_income" || a.name.toLowerCase().includes("sales"));
      const bankAcc = accs.find(a => a.sub_type === "bank" || a.name.toLowerCase().includes("bank"));
      const cashAcc = accs.find(a => a.sub_type === "cash" || a.name.toLowerCase().includes("cash"));
      if (salesAcc) setSalesAccountId(salesAcc.id);
      if (bankAcc) setBankAccountId(bankAcc.id);
      else if (cashAcc) setBankAccountId(cashAcc.id);

      // Generate invoice number
      const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact" }).eq("business_id", saved).eq("type", "sales");
      setInvoiceNo(`INV-${String((count ?? 0) + 1).padStart(4, "0")}`);
    });
  }, []);

  const isIGST = customerState && bizState && customerState !== bizState;

  function calcLine(line: LineItem): LineItem {
    const qty = parseFloat(line.qty) || 0;
    const rate = parseFloat(line.rate) || 0;
    const gstRate = parseFloat(line.gst_rate) || 0;
    const base = qty * rate;
    const gstAmt = base * gstRate / 100;
    const cgst = isIGST ? 0 : gstAmt / 2;
    const sgst = isIGST ? 0 : gstAmt / 2;
    const igst = isIGST ? gstAmt : 0;
    return { ...line, amount: base, cgst, sgst, igst };
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines(prev => {
      const updated = [...prev];
      updated[i] = calcLine({ ...updated[i], [field]: value });
      return updated;
    });
  }

  function addLine() {
    setLines(prev => [...prev, { description: "", hsn_sac: "", qty: "1", rate: "", gst_rate: "18", amount: 0, cgst: 0, sgst: 0, igst: 0 }]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const totalCGST = lines.reduce((s, l) => s + l.cgst, 0);
  const totalSGST = lines.reduce((s, l) => s + l.sgst, 0);
  const totalIGST = lines.reduce((s, l) => s + l.igst, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = subtotal + totalGST;
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  async function handleSubmit(mode: "draft" | "post") {
    if (!bizId || !salesAccountId) { setError("Choose the sales account"); return; }
    if (lines.every(l => !l.amount)) { setError("Add at least one line item with amount"); return; }
    setSaving(true);
    setError("");

    const customer = contacts.find(c => c.id === customerId);

    // Find GST accounts
    const cgstAcc = accounts.find(a => a.name.toLowerCase().includes("cgst output") || (a.name.toLowerCase().includes("cgst") && a.type === "liability"));
    const sgstAcc = accounts.find(a => a.name.toLowerCase().includes("sgst output") || (a.name.toLowerCase().includes("sgst") && a.type === "liability"));
    const igstAcc = accounts.find(a => a.name.toLowerCase().includes("igst output") || (a.name.toLowerCase().includes("igst") && a.type === "liability"));
    const debtorAcc = accounts.find(a => a.sub_type === "trade_receivables" || a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable"));

    // Credit sale: Dr Debtors · Cash/bank sale: Dr Bank — Cr Sales, Cr Output GST
    if (paymentMode !== "credit" && !bankAccountId) { setError("Choose the bank or cash account received into"); setSaving(false); return; }
    try {
      await saveEntry({
        business_id: bizId, mode: mode === "post" ? "post" : "draft", date: invoiceDate, type: "sales", source: "sales_invoice",
        narration: narration || `Sales Invoice ${invoiceNo} - ${customer?.name ?? "Customer"}`,
        reference_no: invoiceNo, party_name: customer?.name ?? null, contact_id: customerId || null,
        // Item detail for GSTR-1 (HSN, rate, quantity, place of supply)
        metadata: { gst_invoice: {
          customer_gstin: customer?.gstin || null, customer_state: customerState || null, pos: (isIGST ? customerState : bizState) || null,
          items: lines.filter(l => l.amount).map(l => ({ hsn: l.hsn_sac.trim() || undefined, desc: l.description.slice(0, 30), uqc: "NOS", qty: parseFloat(l.qty) || 0, gst_rate: parseFloat(l.gst_rate) || 0, taxable: l.amount, igst: l.igst, cgst: l.cgst, sgst: l.sgst })),
        } },
        lines: [
          paymentMode === "credit"
            ? { account_id: debtorAcc?.id, account_name: debtorAcc ? null : "Debtors Control", dr: grandTotal, cr: 0, narration: `Sales to ${customer?.name ?? "Customer"}` }
            : { account_id: bankAccountId, dr: grandTotal, cr: 0, narration: `Sales to ${customer?.name ?? "Customer"}` },
          { account_id: salesAccountId, dr: 0, cr: subtotal, narration: `Sales - ${invoiceNo}` },
          { account_id: cgstAcc?.id, account_name: cgstAcc ? null : "Output CGST", dr: 0, cr: totalCGST, narration: "CGST Output" },
          { account_id: sgstAcc?.id, account_name: sgstAcc ? null : "Output SGST", dr: 0, cr: totalSGST, narration: "SGST Output" },
          { account_id: igstAcc?.id, account_name: igstAcc ? null : "Output IGST", dr: 0, cr: totalIGST, narration: "IGST Output" },
        ],
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); setSaving(false); return; }

    router.push("/finance/journals");
  }

  const inputStyle = { background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <Link href="/finance/journals" style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem", textDecoration: "none" }}>Journals</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>New Sales Invoice</span>
      </nav>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.2rem", fontSize: "1.3rem", fontWeight: 800 }}>New Sales Invoice</h1>
            <p style={{ margin: 0, color: "rgba(20,26,58,0.65)", fontSize: "0.82rem" }}>Create a sales invoice — journal entry is auto-generated</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => handleSubmit("draft")} disabled={saving} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: "0.88rem" }}>Save Draft</button>
            <button onClick={() => handleSubmit("post")} disabled={saving} style={{ background: "#232A63", border: "none", color: "#F5F6FA", padding: "9px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>Post Invoice</button>
          </div>
        </div>

        {error && <div style={{ background: "rgba(194,50,31,0.1)", border: "1px solid rgba(194,50,31,0.3)", color: "#C2321F", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}

        {/* Header Section */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={labelStyle}>Invoice No</label>
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as "cash" | "bank" | "credit")} style={inputStyle}>
                <option value="credit">Credit (Debtor)</option>
                <option value="bank">Bank Transfer (Received)</option>
                <option value="cash">Cash (Received)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Customer</label>
              <select value={customerId} onChange={e => { setCustomerId(e.target.value); }} style={inputStyle}>
                <option value="">-- Select Customer --</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Customer State (for GST)</label>
              <input value={customerState} onChange={e => { setCustomerState(e.target.value); setLines(prev => prev.map(l => calcLine(l))); }}
                placeholder="e.g. Karnataka" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Sales Account</label>
              <select value={salesAccountId} onChange={e => setSalesAccountId(e.target.value)} style={inputStyle}>
                <option value="">-- Select Account --</option>
                {accounts.filter(a => a.type === "income").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          {paymentMode !== "credit" && (
            <div style={{ marginTop: "1rem" }}>
              <label style={labelStyle}>Bank/Cash Account</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }}>
                <option value="">-- Select Account --</option>
                {accounts.filter(a => a.type === "asset" && (a.sub_type === "bank" || a.sub_type === "cash" || a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash"))).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, overflow: "hidden", marginBottom: "1rem" }}>
          <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(20,26,58,0.08)", fontWeight: 700, fontSize: "0.88rem" }}>
            Line Items {isIGST && <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", background: "rgba(35,42,99,0.1)", color: "#232A63", padding: "2px 8px", borderRadius: 10 }}>IGST (inter-state)</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FFFFFF" }}>
                  {["Description", "HSN/SAC", "Qty", "Rate (₹)", `GST %`, "Base (₹)", isIGST ? "IGST (₹)" : "CGST+SGST (₹)", ""].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: h.includes("₹") || h.includes("%") ? "right" : "left", fontSize: "0.65rem", color: "rgba(20,26,58,0.60)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                    <td style={{ padding: "0.4rem 0.75rem", minWidth: 180 }}>
                      <input value={line.description} onChange={e => updateLine(i, "description", e.target.value)} placeholder="Item description" style={{ ...inputStyle, minWidth: 160 }} />
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", minWidth: 80 }}>
                      <input value={line.hsn_sac} onChange={e => updateLine(i, "hsn_sac", e.target.value)} placeholder="HSN" style={{ ...inputStyle, width: 80 }} />
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", minWidth: 60 }}>
                      <input type="number" value={line.qty} onChange={e => updateLine(i, "qty", e.target.value)} style={{ ...inputStyle, width: 60, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", minWidth: 90 }}>
                      <input type="number" value={line.rate} onChange={e => updateLine(i, "rate", e.target.value)} placeholder="0.00" style={{ ...inputStyle, width: 90, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", minWidth: 70 }}>
                      <select value={line.gst_rate} onChange={e => updateLine(i, "gst_rate", e.target.value)} style={{ ...inputStyle, width: 70 }}>
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "rgba(20,26,58,0.95)" }}>
                      {fmt(line.amount)}
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#232A63" }}>
                      {isIGST ? fmt(line.igst) : fmt(line.cgst + line.sgst)}
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem" }}>
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", color: "rgba(194,50,31,0.5)", cursor: "pointer", fontSize: "1rem", padding: "2px 4px" }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid rgba(20,26,58,0.08)" }}>
            <button onClick={addLine} style={{ background: "rgba(35,42,99,0.08)", border: "1px solid rgba(35,42,99,0.2)", color: "#232A63", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
              + Add Line
            </button>
          </div>
        </div>

        {/* Totals + Narration */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, padding: "1.25rem" }}>
            <label style={labelStyle}>Narration</label>
            <textarea value={narration} onChange={e => setNarration(e.target.value)}
              placeholder={`Sales Invoice ${invoiceNo}`} rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }} />
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, padding: "1.25rem", minWidth: 240 }}>
            {[
              { label: "Subtotal", value: subtotal, color: "rgba(20,26,58,1.00)" },
              ...(isIGST ? [{ label: "IGST", value: totalIGST, color: "rgba(20,26,58,0.85)" }]
                : [{ label: "CGST", value: totalCGST, color: "rgba(20,26,58,0.85)" }, { label: "SGST", value: totalSGST, color: "rgba(20,26,58,0.85)" }]),
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "rgba(20,26,58,0.70)" }}>{row.label}</span>
                <span style={{ fontSize: "0.8rem", color: row.color, fontVariantNumeric: "tabular-nums" }}>₹{fmt(row.value)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(35,42,99,0.2)", margin: "0.75rem 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: "1rem" }}>Grand Total</span>
              <span style={{ fontWeight: 900, fontSize: "1.2rem", color: "#232A63", fontVariantNumeric: "tabular-nums" }}>₹{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
