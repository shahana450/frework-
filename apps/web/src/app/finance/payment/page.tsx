"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Contact = { id: string; name: string; type: string };
type Account = { id: string; code: string; name: string; type: string; sub_type: string | null };

export default function PaymentPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fields
  const [paymentType, setPaymentType] = useState<"receipt" | "payment">("receipt");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"bank" | "cash" | "upi" | "cheque">("bank");
  const [bankAccountId, setBankAccountId] = useState("");
  const [arApAccountId, setArApAccountId] = useState("");
  const [narration, setNarration] = useState("");
  const [refNo, setRefNo] = useState("");
  const [chequeNo, setChequeNo] = useState("");

  // Recent payments
  const [recent, setRecent] = useState<{ id: string; date: string; narration: string; total_debit: number; total_credit: number; type: string; entry_no: string }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = localStorage.getItem(`fw_fin_biz_${user.id}`);
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);

      const [fyRes, contactsRes, accountsRes, recentRes] = await Promise.all([
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
        supabase.from("fw_fin_contacts").select("id,name,type").eq("business_id", saved).order("name"),
        supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type,sub_type").eq("business_id", saved).eq("is_group", false).order("code"),
        supabase.from("fw_fin_journals").select("id,date,narration,total_debit,total_credit,type,entry_no").eq("business_id", saved).in("type", ["receipt", "payment"]).order("date", { ascending: false }).limit(8),
      ]);

      setFyId(fyRes.data?.id ?? null);
      setContacts((contactsRes.data ?? []) as Contact[]);
      const accs = (accountsRes.data ?? []) as Account[];
      setAccounts(accs);
      setRecent(recentRes.data ?? []);

      const bankAcc = accs.find(a => a.sub_type === "bank" || a.name.toLowerCase().includes("bank"));
      const debtorAcc = accs.find(a => a.sub_type === "trade_receivables" || a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable"));
      const creditorAcc = accs.find(a => a.sub_type === "trade_payables" || a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"));
      if (bankAcc) setBankAccountId(bankAcc.id);
      if (debtorAcc) setArApAccountId(debtorAcc.id);
    });
  }, []);

  // Auto-switch AR/AP account when payment type changes
  useEffect(() => {
    if (paymentType === "receipt") {
      const debtorAcc = accounts.find(a => a.sub_type === "trade_receivables" || a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable"));
      if (debtorAcc) setArApAccountId(debtorAcc.id);
    } else {
      const creditorAcc = accounts.find(a => a.sub_type === "trade_payables" || a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"));
      if (creditorAcc) setArApAccountId(creditorAcc.id);
    }
  }, [paymentType, accounts]);

  async function handleSave(mode: "draft" | "post") {
    if (!bizId || !fyId || !bankAccountId || !arApAccountId || !parseFloat(amount)) {
      setError("Fill all required fields"); return;
    }
    setSaving(true); setError(""); setSuccess("");

    const amt = parseFloat(amount);
    const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact" }).eq("business_id", bizId).eq("type", paymentType);
    const entryNo = `${paymentType === "receipt" ? "RCP" : "PMT"}-${String((count ?? 0) + 1).padStart(4, "0")}`;
    const contact = contacts.find(c => c.id === contactId);

    // Receipt: Dr Bank, Cr Debtors
    // Payment: Dr Creditors, Cr Bank
    const jLines = paymentType === "receipt"
      ? [
          { account_id: bankAccountId, dr_amount: amt, cr_amount: 0, narration: `Receipt from ${contact?.name ?? "Customer"}` },
          { account_id: arApAccountId, dr_amount: 0, cr_amount: amt, narration: narration || `Payment received` },
        ]
      : [
          { account_id: arApAccountId, dr_amount: amt, cr_amount: 0, narration: narration || `Payment made` },
          { account_id: bankAccountId, dr_amount: 0, cr_amount: amt, narration: `Payment to ${contact?.name ?? "Vendor"}` },
        ];

    const { data: journal, error: jErr } = await supabase.from("fw_fin_journals").insert({
      business_id: bizId, fy_id: fyId, date: paymentDate, entry_no: entryNo,
      type: paymentType,
      narration: narration || `${paymentType === "receipt" ? "Receipt from" : "Payment to"} ${contact?.name ?? "Party"}`,
      total_debit: amt, total_credit: amt,
      status: mode === "post" ? "posted" : "draft",
      reference_no: refNo || chequeNo || null,
      contact_id: contactId || null,
      ai_generated: false,
    }).select("id").single();

    if (jErr || !journal) { setError(jErr?.message ?? "Failed"); setSaving(false); return; }
    await supabase.from("fw_fin_journal_lines").insert(jLines.map(l => ({ ...l, journal_id: journal.id })));

    setSuccess(`${mode === "post" ? "Posted" : "Saved"}: ${entryNo} — ₹${parseFloat(amount).toLocaleString("en-IN")}`);
    setAmount(""); setNarration(""); setRefNo(""); setChequeNo(""); setContactId("");
    setSaving(false);

    const { data: rec } = await supabase.from("fw_fin_journals").select("id,date,narration,total_debit,total_credit,type,entry_no").eq("business_id", bizId).in("type", ["receipt", "payment"]).order("date", { ascending: false }).limit(8);
    setRecent(rec ?? []);
  }

  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.82rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Payment Entry</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Payment Entry</h1>
          <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Record customer receipts or vendor payments</p>

          {/* Type Toggle */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {(["receipt", "payment"] as const).map(t => (
              <button key={t} onClick={() => setPaymentType(t)} style={{
                padding: "9px 24px", borderRadius: 8, fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", border: "none",
                background: paymentType === t ? (t === "receipt" ? "#4ade80" : "#f87171") : "rgba(237,232,220,0.06)",
                color: paymentType === t ? "#070C1A" : "rgba(237,232,220,0.5)",
              }}>
                {t === "receipt" ? "💰 Customer Receipt" : "💳 Vendor Payment"}
              </button>
            ))}
          </div>

          {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
          {success && <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div><label style={labelStyle}>Date</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>{paymentType === "receipt" ? "Customer" : "Vendor"}</label>
                <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select {paymentType === "receipt" ? "Customer" : "Vendor"} --</option>
                  {contacts.filter(c => paymentType === "receipt" ? c.type === "customer" : c.type === "vendor" || c.type === "both").map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: "right", fontSize: "1rem", fontWeight: 700 }} />
              </div>
              <div>
                <label style={labelStyle}>Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as "bank" | "cash" | "upi" | "cheque")} style={inputStyle}>
                  <option value="bank">Bank Transfer / NEFT</option>
                  <option value="upi">UPI / PhonePe / GPay</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{paymentMode === "cheque" ? "Cheque No" : "Reference No"}</label>
                <input value={paymentMode === "cheque" ? chequeNo : refNo}
                  onChange={e => paymentMode === "cheque" ? setChequeNo(e.target.value) : setRefNo(e.target.value)}
                  placeholder={paymentMode === "cheque" ? "Cheque number" : "UTR / transaction ref"}
                  style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Bank / Cash Account</label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Account --</option>
                  {accounts.filter(a => a.type === "asset" && (a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("upi"))).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{paymentType === "receipt" ? "Debtors Account (AR)" : "Creditors Account (AP)"}</label>
                <select value={arApAccountId} onChange={e => setArApAccountId(e.target.value)} style={inputStyle}>
                  <option value="">-- Select Account --</option>
                  {accounts.filter(a => paymentType === "receipt"
                    ? (a.sub_type === "trade_receivables" || a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable"))
                    : (a.sub_type === "trade_payables" || a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable"))
                  ).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>Narration</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)}
                placeholder={paymentType === "receipt" ? "e.g. Payment received against Invoice INV-0001" : "e.g. Payment towards Bill BILL-0001"}
                rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }} />
            </div>

            {/* Journal preview */}
            {parseFloat(amount) > 0 && (
              <div style={{ background: "rgba(237,232,220,0.03)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "rgba(237,232,220,0.5)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Journal Preview</div>
                {paymentType === "receipt" ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>Dr Bank / Cash</span><span style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>₹{parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ paddingLeft: "1rem" }}>Cr Debtors (AR)</span><span style={{ color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>₹{parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span>Dr Creditors (AP)</span><span style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>₹{parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ paddingLeft: "1rem" }}>Cr Bank / Cash</span><span style={{ color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>₹{parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => handleSave("draft")} disabled={saving} style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: "0.88rem" }}>Save Draft</button>
              <button onClick={() => handleSave("post")} disabled={saving} style={{ background: paymentType === "receipt" ? "#4ade80" : "#f87171", border: "none", color: "#070C1A", padding: "9px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>
                {saving ? "Saving…" : `Post ${paymentType === "receipt" ? "Receipt" : "Payment"}`}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — Recent */}
        <div>
          <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", marginTop: "3.8rem" }}>Recent Payments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {recent.map(r => (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "rgba(201,168,76,0.5)" }}>{r.entry_no}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 8, background: r.type === "receipt" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)", color: r.type === "receipt" ? "#4ade80" : "#f87171", fontSize: "0.65rem" }}>{r.type}</span>
                </div>
                <div style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.narration}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.3)" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span style={{ fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: r.type === "receipt" ? "#4ade80" : "#f87171" }}>₹{fmt(r.type === "receipt" ? r.total_credit : r.total_debit)}</span>
                </div>
              </div>
            ))}
            {recent.length === 0 && <div style={{ color: "rgba(237,232,220,0.25)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No payments recorded yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
