"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";
import Link from "next/link";

type Account = { id: string; code: string; name: string; type: string; sub_type: string | null };
type Contact = { id: string; name: string };

const EXPENSE_PRESETS = [
  { label: "Rent", narration: "Office/Shop Rent", keywords: ["rent"] },
  { label: "Salary", narration: "Staff Salary", keywords: ["salary", "wages"] },
  { label: "Electricity", narration: "Electricity Bill", keywords: ["electricity", "electric", "power"] },
  { label: "Internet", narration: "Internet & Phone Bill", keywords: ["internet", "telephone", "broadband"] },
  { label: "Travel", narration: "Travel & Conveyance", keywords: ["travel", "conveyance"] },
  { label: "Office Supplies", narration: "Office Supplies & Stationery", keywords: ["stationery", "office supply"] },
];

export default function ExpensesPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [gstAmount, setGstAmount] = useState("");
  const [gstType, setGstType] = useState<"none" | "cgst_sgst" | "igst">("none");
  const [tds, setTds] = useState("");
  const [narration, setNarration] = useState("");
  const [refNo, setRefNo] = useState("");

  // Recent expenses
  const [recentExpenses, setRecentExpenses] = useState<{ id: string; date: string; narration: string; total_debit: number; entry_no: string }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [fyRes, accountsRes, contactsRes, recentRes] = await Promise.all([
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type,sub_type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_contacts").select("id,name").eq("business_id", saved).in("type", ["vendor", "both"]).order("name"),
        supabase.from("fw_fin_journals").select("id,date,narration,total_debit,entry_no").eq("business_id", saved).eq("type", "expense").order("date", { ascending: false }).limit(8),
      ]);

      setFyId(fyRes.data?.id ?? null);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);
      setContacts((contactsRes.data ?? []) as Contact[]);
      setRecentExpenses(recentRes.data ?? []);

      const bankAcc = accs.find(a => a.sub_type === "bank" || a.name.toLowerCase().includes("bank"));
      const cashAcc = accs.find(a => a.sub_type === "cash" || a.name.toLowerCase().includes("cash"));
      if (bankAcc) setPaymentAccountId(bankAcc.id);
      else if (cashAcc) setPaymentAccountId(cashAcc.id);
    });
  }, []);

  function applyPreset(preset: typeof EXPENSE_PRESETS[0]) {
    setNarration(preset.narration);
    const acc = accounts.find(a => preset.keywords.some(k => a.name.toLowerCase().includes(k)));
    if (acc) setExpenseAccountId(acc.id);
  }

  const baseAmount = parseFloat(amount) || 0;
  const gstAmt = parseFloat(gstAmount) || 0;
  const tdsAmt = parseFloat(tds) || 0;
  const netPayable = baseAmount + gstAmt - tdsAmt;

  async function handleSave(mode: "draft" | "post") {
    if (!bizId || !expenseAccountId || !paymentAccountId || !baseAmount) {
      setError("Fill expense account, payment account, and amount"); return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    // Dr Expense, Dr Input GST — Cr TDS Payable, Cr bank/cash (net)
    const cgstInAcc = accounts.find(a => a.name.toLowerCase().includes("cgst input") || (a.name.toLowerCase().includes("cgst") && a.type === "asset"));
    const sgstInAcc = accounts.find(a => a.name.toLowerCase().includes("sgst input") || (a.name.toLowerCase().includes("sgst") && a.type === "asset"));
    const igstInAcc = accounts.find(a => a.name.toLowerCase().includes("igst input") || (a.name.toLowerCase().includes("igst") && a.type === "asset"));
    const tdsAcc = accounts.find(a => a.name.toLowerCase().includes("tds payable") || a.name.toLowerCase().includes("tds"));
    const split = gstAmt > 0 && gstType === "cgst_sgst";
    const inter = gstAmt > 0 && gstType !== "none" && gstType !== "cgst_sgst";
    let entryNo = "";
    try {
      const r = await saveEntry({
        business_id: bizId, mode: mode === "post" ? "post" : "draft", date: expDate, type: "payment", source: "expense",
        narration: narration || "Expense", reference_no: refNo || null, contact_id: vendorId || null,
        lines: [
          { account_id: expenseAccountId, dr: baseAmount, cr: 0, narration: narration || "Expense" },
          { account_id: cgstInAcc?.id, account_name: cgstInAcc ? null : "Input CGST", dr: split ? gstAmt / 2 : 0, cr: 0, narration: "CGST Input" },
          { account_id: sgstInAcc?.id, account_name: sgstInAcc ? null : "Input SGST", dr: split ? gstAmt / 2 : 0, cr: 0, narration: "SGST Input" },
          { account_id: igstInAcc?.id, account_name: igstInAcc ? null : "Input IGST", dr: inter ? gstAmt : 0, cr: 0, narration: "IGST Input" },
          { account_id: tdsAcc?.id, account_name: tdsAcc ? null : "TDS Payable", dr: 0, cr: tdsAmt, narration: "TDS Deducted" },
          { account_id: paymentAccountId, dr: 0, cr: netPayable, narration: narration || "Expense Payment" },
        ],
      });
      entryNo = r.entry_no;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); setSaving(false); return; }
    setSuccess(`${mode === "post" ? "Posted" : "Saved as draft"}: ${entryNo}`);
    // Reset form
    setAmount(""); setGstAmount(""); setTds(""); setNarration(""); setRefNo(""); setVendorId(""); setGstType("none");
    setSaving(false);

    // Refresh recent
    const { data: rec } = await supabase.from("fw_fin_journals").select("id,date,narration,total_debit,entry_no").eq("business_id", bizId).eq("type", "expense").order("date", { ascending: false }).limit(8);
    setRecentExpenses(rec ?? []);
  }

  const inputStyle = { background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Record Expense</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        {/* Main Form */}
        <div>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Record Expense</h1>
          <p style={{ margin: "0 0 1.5rem", color: "rgba(20,26,58,0.65)", fontSize: "0.82rem" }}>Quick expense entry — journal is auto-created</p>

          {/* Presets */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.60)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Quick Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {EXPENSE_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "rgba(20,26,58,0.85)", padding: "4px 12px", borderRadius: 14, cursor: "pointer", fontSize: "0.78rem" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ background: "rgba(194,50,31,0.1)", border: "1px solid rgba(194,50,31,0.3)", color: "#C2321F", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
          {success && <div style={{ background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.25)", color: "#0B7A55", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Reference / Bill No</label>
                <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Bill / receipt number" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Expense Account</label>
                <select value={expenseAccountId} onChange={e => setExpenseAccountId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Expense Account --</option>
                  {accounts.filter(a => a.type === "expense").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Vendor (optional)</label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Vendor --</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Base Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: "right" }} />
              </div>
              <div>
                <label style={labelStyle}>GST Type</label>
                <select value={gstType} onChange={e => setGstType(e.target.value as "none" | "cgst_sgst" | "igst")} style={inputStyle}>
                  <option value="none">No GST / Exempt</option>
                  <option value="cgst_sgst">CGST + SGST (intra-state)</option>
                  <option value="igst">IGST (inter-state)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>GST Amount (₹)</label>
                <input type="number" value={gstAmount} onChange={e => setGstAmount(e.target.value)} placeholder="0.00" disabled={gstType === "none"} style={{ ...inputStyle, textAlign: "right", opacity: gstType === "none" ? 0.4 : 1 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>TDS Deducted (₹)</label>
                <input type="number" value={tds} onChange={e => setTds(e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: "right" }} />
              </div>
              <div>
                <label style={labelStyle}>Payment Account</label>
                <select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Account --</option>
                  {accounts.filter(a => a.type === "asset" && (a.sub_type === "bank" || a.sub_type === "cash" || a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash"))).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Narration</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description of expense…" rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }} />
            </div>

            {/* Summary */}
            {baseAmount > 0 && (
              <div style={{ background: "rgba(35,42,99,0.05)", border: "1px solid rgba(35,42,99,0.15)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "2rem", fontSize: "0.82rem" }}>
                  <div><span style={{ color: "rgba(20,26,58,0.65)" }}>Base: </span><span style={{ fontVariantNumeric: "tabular-nums" }}>₹{fmt(baseAmount)}</span></div>
                  {gstAmt > 0 && <div><span style={{ color: "rgba(20,26,58,0.65)" }}>GST ITC: </span><span style={{ color: "#0B7A55", fontVariantNumeric: "tabular-nums" }}>₹{fmt(gstAmt)}</span></div>}
                  {tdsAmt > 0 && <div><span style={{ color: "rgba(20,26,58,0.65)" }}>TDS: </span><span style={{ color: "#C2321F", fontVariantNumeric: "tabular-nums" }}>₹{fmt(tdsAmt)}</span></div>}
                  <div style={{ marginLeft: "auto", fontWeight: 800 }}><span style={{ color: "rgba(20,26,58,0.65)" }}>Net Payable: </span><span style={{ color: "#232A63", fontSize: "1rem", fontVariantNumeric: "tabular-nums" }}>₹{fmt(netPayable)}</span></div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => handleSave("draft")} disabled={saving} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: "0.88rem" }}>Save Draft</button>
              <button onClick={() => handleSave("post")} disabled={saving} style={{ background: "#232A63", border: "none", color: "#F5F6FA", padding: "9px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>
                {saving ? "Saving…" : "Post Expense"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — Recent Expenses */}
        <div>
          <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.60)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", marginTop: "3.8rem" }}>Recent Expenses</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {recentExpenses.map(e => (
              <div key={e.id} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.08)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "rgba(20,26,58,0.5)" }}>{e.entry_no}</span>
                  <span style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.55)" }}>{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
                <div style={{ fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.narration}</div>
                <div style={{ fontSize: "0.82rem", color: "#C2321F", fontVariantNumeric: "tabular-nums", marginTop: "0.2rem" }}>₹{fmt(e.total_debit)}</div>
              </div>
            ))}
            {recentExpenses.length === 0 && (
              <div style={{ color: "rgba(20,26,58,0.35)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No expenses recorded yet</div>
            )}
            <Link href="/finance/journals?type=expense" style={{ color: "#232A63", fontSize: "0.78rem", textAlign: "center", padding: "0.5rem", textDecoration: "none" }}>View all expenses →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
