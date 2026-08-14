"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
      const saved = localStorage.getItem(`fw_fin_biz_${user.id}`);
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
    if (!bizId || !fyId || !expenseAccountId || !paymentAccountId || !baseAmount) {
      setError("Fill expense account, payment account, and amount"); return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact" }).eq("business_id", bizId).eq("type", "expense");
    const entryNo = `EXP-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const jLines: { account_id: string; dr_amount: number; cr_amount: number; narration: string }[] = [];
    jLines.push({ account_id: expenseAccountId, dr_amount: baseAmount, cr_amount: 0, narration: narration || "Expense" });

    // GST Input credit (ITC)
    if (gstAmt > 0 && gstType !== "none") {
      const cgstInAcc = accounts.find(a => a.name.toLowerCase().includes("cgst input") || (a.name.toLowerCase().includes("cgst") && a.type === "asset"));
      const sgstInAcc = accounts.find(a => a.name.toLowerCase().includes("sgst input") || (a.name.toLowerCase().includes("sgst") && a.type === "asset"));
      const igstInAcc = accounts.find(a => a.name.toLowerCase().includes("igst input") || (a.name.toLowerCase().includes("igst") && a.type === "asset"));

      if (gstType === "cgst_sgst") {
        if (cgstInAcc) jLines.push({ account_id: cgstInAcc.id, dr_amount: gstAmt / 2, cr_amount: 0, narration: "CGST Input" });
        if (sgstInAcc) jLines.push({ account_id: sgstInAcc.id, dr_amount: gstAmt / 2, cr_amount: 0, narration: "SGST Input" });
      } else {
        if (igstInAcc) jLines.push({ account_id: igstInAcc.id, dr_amount: gstAmt, cr_amount: 0, narration: "IGST Input" });
      }
    }

    // TDS payable
    if (tdsAmt > 0) {
      const tdsAcc = accounts.find(a => a.name.toLowerCase().includes("tds payable") || a.name.toLowerCase().includes("tds"));
      if (tdsAcc) jLines.push({ account_id: tdsAcc.id, dr_amount: 0, cr_amount: tdsAmt, narration: "TDS Deducted" });
    }

    // Payment account (Cr)
    jLines.push({ account_id: paymentAccountId, dr_amount: 0, cr_amount: netPayable, narration: narration || "Expense Payment" });

    const totalDr = jLines.reduce((s, l) => s + l.dr_amount, 0);
    const totalCr = jLines.reduce((s, l) => s + l.cr_amount, 0);

    const { data: journal, error: jErr } = await supabase.from("fw_fin_journals").insert({
      business_id: bizId,
      fy_id: fyId,
      date: expDate,
      entry_no: entryNo,
      type: "expense",
      narration: narration || "Expense",
      total_debit: totalDr,
      total_credit: totalCr,
      status: mode === "post" ? "posted" : "draft",
      reference_no: refNo || null,
      contact_id: vendorId || null,
      ai_generated: false,
    }).select("id").single();

    if (jErr || !journal) { setError(jErr?.message ?? "Failed to save"); setSaving(false); return; }
    await supabase.from("fw_fin_journal_lines").insert(jLines.map(l => ({ ...l, journal_id: journal.id })));

    setSuccess(`${mode === "post" ? "Posted" : "Saved as draft"}: ${entryNo}`);
    // Reset form
    setAmount(""); setGstAmount(""); setTds(""); setNarration(""); setRefNo(""); setVendorId(""); setGstType("none");
    setSaving(false);

    // Refresh recent
    const { data: rec } = await supabase.from("fw_fin_journals").select("id,date,narration,total_debit,entry_no").eq("business_id", bizId).eq("type", "expense").order("date", { ascending: false }).limit(8);
    setRecentExpenses(rec ?? []);
  }

  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Record Expense</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        {/* Main Form */}
        <div>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Record Expense</h1>
          <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Quick expense entry — journal is auto-created</p>

          {/* Presets */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Quick Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {EXPENSE_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{ background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.1)", color: "rgba(237,232,220,0.6)", padding: "4px 12px", borderRadius: 14, cursor: "pointer", fontSize: "0.78rem" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
          {success && <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
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
              <div style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "2rem", fontSize: "0.82rem" }}>
                  <div><span style={{ color: "rgba(237,232,220,0.4)" }}>Base: </span><span style={{ fontVariantNumeric: "tabular-nums" }}>₹{fmt(baseAmount)}</span></div>
                  {gstAmt > 0 && <div><span style={{ color: "rgba(237,232,220,0.4)" }}>GST ITC: </span><span style={{ color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>₹{fmt(gstAmt)}</span></div>}
                  {tdsAmt > 0 && <div><span style={{ color: "rgba(237,232,220,0.4)" }}>TDS: </span><span style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>₹{fmt(tdsAmt)}</span></div>}
                  <div style={{ marginLeft: "auto", fontWeight: 800 }}><span style={{ color: "rgba(237,232,220,0.4)" }}>Net Payable: </span><span style={{ color: "#C9A84C", fontSize: "1rem", fontVariantNumeric: "tabular-nums" }}>₹{fmt(netPayable)}</span></div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => handleSave("draft")} disabled={saving} style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: "0.88rem" }}>Save Draft</button>
              <button onClick={() => handleSave("post")} disabled={saving} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "9px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>
                {saving ? "Saving…" : "Post Expense"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — Recent Expenses */}
        <div>
          <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", marginTop: "3.8rem" }}>Recent Expenses</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {recentExpenses.map(e => (
              <div key={e.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "rgba(201,168,76,0.5)" }}>{e.entry_no}</span>
                  <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.3)" }}>{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
                <div style={{ fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.narration}</div>
                <div style={{ fontSize: "0.82rem", color: "#f87171", fontVariantNumeric: "tabular-nums", marginTop: "0.2rem" }}>₹{fmt(e.total_debit)}</div>
              </div>
            ))}
            {recentExpenses.length === 0 && (
              <div style={{ color: "rgba(237,232,220,0.25)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No expenses recorded yet</div>
            )}
            <Link href="/finance/journals?type=expense" style={{ color: "#C9A84C", fontSize: "0.78rem", textAlign: "center", padding: "0.5rem", textDecoration: "none" }}>View all expenses →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
