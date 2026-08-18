"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type BankTxn = {
  id: string;
  date: string;
  narration: string;
  amount: number;
  type: "credit" | "debit";
  balance: number;
  categoryKey: string;
};

type Category = {
  key: string;
  label: string;
  type: "credit" | "debit";
  accountHint: string;
  accountId: string;
  needsReview: boolean;
  txns: BankTxn[];
};

type Account = { id: string; name: string; code: string };

// ─── Categorisation logic ────────────────────────────────────────────────────
function categorise(narration: string, type: "credit" | "debit"): { label: string; accountHint: string; needsReview: boolean } {
  const n = narration.toLowerCase();
  if (type === "credit") {
    if (/interest|int cr|interest earned/i.test(n))
      return { label: "Bank Interest", accountHint: "Interest Income", needsReview: false };
    if (/gst refund|tax refund|income tax refund/i.test(n))
      return { label: "Tax Refund", accountHint: "GST Refund Receivable", needsReview: false };
    if (/neft|rtgs|imps|upi|received|cr by|deposit|transfer in/i.test(n))
      return { label: "Customer / NEFT Receipt", accountHint: "Sundry Debtors", needsReview: false };
    if (/cash deposit|atm deposit/i.test(n))
      return { label: "Cash Deposit", accountHint: "Cash in Hand", needsReview: false };
    return { label: "Other Credit", accountHint: "", needsReview: true };
  } else {
    if (/rent|lease|office rent/i.test(n))
      return { label: "Rent", accountHint: "Rent Expense", needsReview: false };
    if (/salary|payroll|wages|staff pay|employee/i.test(n))
      return { label: "Salaries & Wages", accountHint: "Salaries & Wages", needsReview: false };
    if (/gst|igst|cgst|sgst|gst payment/i.test(n))
      return { label: "GST Payment", accountHint: "GST Payable", needsReview: false };
    if (/income tax|tds|advance tax|tax payment/i.test(n))
      return { label: "Income Tax / TDS", accountHint: "Income Tax Payable", needsReview: false };
    if (/loan|emi|repayment|term loan/i.test(n))
      return { label: "Loan Repayment", accountHint: "Loan Payable", needsReview: false };
    if (/bank charge|bank fee|commission|service charge|annual fee|processing fee/i.test(n))
      return { label: "Bank Charges", accountHint: "Bank Charges", needsReview: false };
    if (/electricity|power|msedcl|bescom|water|sewage/i.test(n))
      return { label: "Electricity & Utilities", accountHint: "Electricity & Utilities", needsReview: false };
    if (/airtel|bsnl|jio|vi |vodafone|telecom|broadband|internet/i.test(n))
      return { label: "Telephone & Internet", accountHint: "Telephone & Internet Expense", needsReview: false };
    if (/insurance|lic |medi/i.test(n))
      return { label: "Insurance", accountHint: "Insurance Expense", needsReview: false };
    if (/travel|hotel|flight|cab|ola|uber|makemy|irctc|railway/i.test(n))
      return { label: "Travel & Conveyance", accountHint: "Travelling & Conveyance", needsReview: false };
    if (/petrol|fuel|diesel/i.test(n))
      return { label: "Fuel", accountHint: "Fuel Expense", needsReview: false };
    if (/office|stationery|print|supply/i.test(n))
      return { label: "Office Expenses", accountHint: "Office Expenses", needsReview: false };
    if (/advertisement|marketing|google ads|facebook|meta/i.test(n))
      return { label: "Marketing & Advertising", accountHint: "Advertising Expense", needsReview: false };
    if (/neft|rtgs|imps|upi|payment to|paid to|transfer to/i.test(n))
      return { label: "Vendor / NEFT Payment", accountHint: "Sundry Creditors", needsReview: false };
    if (/cash withdrawal|atm/i.test(n))
      return { label: "Cash Withdrawal", accountHint: "Cash in Hand", needsReview: false };
    return { label: "Other Debit", accountHint: "", needsReview: true };
  }
}

function buildCategories(txns: BankTxn[], accounts: Account[]): Category[] {
  const map: Record<string, Category> = {};
  for (const txn of txns) {
    const key = txn.categoryKey;
    if (!map[key]) {
      const cat = categorise(txn.narration, txn.type);
      // Try to find matching account in chart of accounts by hint
      const hint = cat.accountHint.toLowerCase();
      const matched = accounts.find(a =>
        hint && (a.name.toLowerCase().includes(hint) || hint.includes(a.name.toLowerCase().split(" ")[0]))
      );
      map[key] = {
        key,
        label: cat.label,
        type: txn.type,
        accountHint: cat.accountHint,
        accountId: matched?.id ?? "",
        needsReview: cat.needsReview,
        txns: [],
      };
    }
    map[key].txns.push(txn);
  }
  return Object.values(map).sort((a, b) => {
    if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
    return a.type === "credit" ? -1 : 1;
  });
}

export default function BankingPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [csvText, setCsvText] = useState("");
  const [parseError, setParseError] = useState("");
  const [step, setStep] = useState<"upload" | "review" | "posting" | "done">("upload");
  const [categories, setCategories] = useState<Category[]>([]);
  const [rawTxns, setRawTxns] = useState<BankTxn[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<{ posted: number; failed: number } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const [acRes, fyRes] = await Promise.all([
        supabase.from("fw_fin_accounts").select("id,name,code").eq("business_id", saved).order("code"),
        supabase.from("fw_fin_financial_years").select("id").eq("business_id", saved).eq("is_current", true).single(),
      ]);
      const accs: Account[] = acRes.data ?? [];
      setAccounts(accs);
      if (fyRes.data) setFyId(fyRes.data.id);
      // Auto-pick bank account
      const bankAc = accs.find(a => /bank|hdfc|sbi|icici|axis|kotak|current account|savings/i.test(a.name));
      if (bankAc) setBankAccountId(bankAc.id);
    });
  }, []);

  function parseCSV(text: string): BankTxn[] {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");
    const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
    const dateIdx = header.findIndex(h => h.includes("date"));
    const narIdx = header.findIndex(h => h.includes("narr") || h.includes("desc") || h.includes("particular") || h.includes("detail") || h.includes("remarks") || h.includes("ref"));
    const drIdx = header.findIndex(h => h.includes("debit") || h.includes("dr") || h.includes("withdraw"));
    const crIdx = header.findIndex(h => h.includes("credit") || h.includes("cr") || h.includes("deposit"));
    const balIdx = header.findIndex(h => h.includes("balance") || h.includes("bal"));

    if (dateIdx < 0) throw new Error("Cannot find 'Date' column in CSV. Columns found: " + header.join(", "));
    if (narIdx < 0) throw new Error("Cannot find narration/description column. Columns found: " + header.join(", "));

    const rows: BankTxn[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
      const dr = parseFloat(cols[drIdx]?.replace(/,/g, "") || "0") || 0;
      const cr = parseFloat(cols[crIdx]?.replace(/,/g, "") || "0") || 0;
      const bal = parseFloat(cols[balIdx]?.replace(/,/g, "") || "0") || 0;
      if (!dr && !cr) continue;
      const dateStr = cols[dateIdx] ?? "";
      const parsed = new Date(dateStr.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/, "$3-$2-$1"));
      const narration = cols[narIdx] ?? `Row ${i}`;
      const type = dr > 0 ? "debit" : "credit";
      const cat = categorise(narration, type);
      rows.push({
        id: `row_${i}`,
        date: isNaN(parsed.getTime()) ? dateStr : parsed.toISOString().split("T")[0],
        narration,
        amount: dr || cr,
        type,
        balance: bal,
        categoryKey: `${type}_${cat.label}`,
      });
    }
    return rows;
  }

  function handleParse() {
    setParseError("");
    try {
      const rows = parseCSV(csvText);
      if (rows.length === 0) throw new Error("No transactions found. Check that Debit/Credit columns have values.");
      setRawTxns(rows);
      setCategories(buildCategories(rows, accounts));
      setStep("review");
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Parse error");
    }
  }

  function updateCatAccount(key: string, accountId: string) {
    setCategories(prev => prev.map(c => c.key === key ? { ...c, accountId } : c));
  }

  async function postAll() {
    if (!bizId || !bankAccountId) return;
    const unresolved = categories.filter(c => !c.accountId);
    if (unresolved.length > 0) {
      alert(`Please assign a ledger account to all groups before posting. Missing: ${unresolved.map(c => c.label).join(", ")}`);
      return;
    }
    setStep("posting");
    let posted = 0; let failed = 0;
    const catMap: Record<string, string> = {};
    for (const cat of categories) catMap[cat.key] = cat.accountId;

    for (const txn of rawTxns) {
      const contraId = catMap[txn.categoryKey];
      if (!contraId) { failed++; continue; }
      try {
        const { data: j, error: jErr } = await supabase.from("fw_fin_journals").insert({
          business_id: bizId,
          financial_year_id: fyId,
          entry_no: `BANK/${txn.date}/${Date.now()}`,
          date: txn.date,
          narration: txn.narration,
          type: "journal",
          status: "posted",
          total_debit: txn.amount,
          total_credit: txn.amount,
          ai_generated: false,
        }).select("id").single();
        if (jErr) throw jErr;
        // Credit (deposit): Dr Bank Account, Cr Contra (income/debtor)
        // Debit (withdrawal): Dr Contra (expense/creditor), Cr Bank Account
        await supabase.from("fw_fin_journal_lines").insert([
          { journal_id: j.id, account_id: txn.type === "credit" ? bankAccountId : contraId, dr_amount: txn.amount, cr_amount: 0, narration: txn.narration, sort_order: 0 },
          { journal_id: j.id, account_id: txn.type === "credit" ? contraId : bankAccountId, dr_amount: 0, cr_amount: txn.amount, narration: txn.narration, sort_order: 1 },
        ]);
        posted++;
      } catch { failed++; }
    }
    setPostResult({ posted, failed });
    setStep("done");
  }

  const totalCredits = rawTxns.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebits = rawTxns.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unresolvedCount = categories.filter(c => !c.accountId).length;

  const inp: React.CSSProperties = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "6px 10px", borderRadius: 6, fontSize: "0.8rem", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Bank Reconciliation</span>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800 }}>Bank Statement Import</h1>
        <p style={{ margin: "0 0 2rem", color: "rgba(237,232,220,0.5)", fontSize: "0.85rem" }}>
          Paste your CSV. Transactions are auto-grouped by category. Assign ledger accounts and post directly to your books.
        </p>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <>
            {/* Bank account selector */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Your Bank / Cash Account (Dr for deposits, Cr for payments)</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={{ ...inp, maxWidth: 360 }}>
                <option value="">— select bank account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Bank Statement CSV</label>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={`Paste CSV here. Expected columns: Date, Narration/Description, Debit, Credit, Balance\n\nExample:\nDate,Narration,Debit,Credit,Balance\n01-08-2025,NEFT from ABC Ltd,,50000.00,150000.00\n02-08-2025,Rent payment,30000.00,,120000.00\n03-08-2025,Bank charges,500.00,,119500.00`}
                rows={10}
                style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "12px", borderRadius: 6, fontSize: "0.82rem", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
              />
              {parseError && <div style={{ color: "#f87171", fontSize: "0.83rem", marginTop: "0.75rem" }}>{parseError}</div>}
              <button onClick={handleParse} disabled={!csvText.trim() || !bankAccountId} style={{ marginTop: "1rem", background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: (!csvText.trim() || !bankAccountId) ? 0.5 : 1 }}>
                Parse & Categorise →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Review categories ── */}
        {step === "review" && (
          <>
            {/* Summary bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
              {[
                { label: "Transactions", value: rawTxns.length.toString(), color: "#EDE8DC" },
                { label: "Total Deposits", value: fmt(totalCredits), color: "#4ade80" },
                { label: "Total Withdrawals", value: fmt(totalDebits), color: "#f87171" },
                { label: "Groups to Review", value: unresolvedCount.toString(), color: unresolvedCount > 0 ? "#fb923c" : "#4ade80" },
              ].map(k => (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "0.85rem 1rem" }}>
                  <div style={{ fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>{k.label}</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                </div>
              ))}
            </div>

            {unresolvedCount > 0 && (
              <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.3)", borderRadius: 10, padding: "0.75rem 1.25rem", marginBottom: "1.25rem", fontSize: "0.83rem", color: "#fb923c" }}>
                {unresolvedCount} group{unresolvedCount > 1 ? "s" : ""} need a ledger account assigned before you can post.
              </div>
            )}

            {/* Category groups */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {categories.map(cat => {
                const catTotal = cat.txns.reduce((s, t) => s + t.amount, 0);
                const expanded = expandedCat === cat.key;
                const selectedAc = accounts.find(a => a.id === cat.accountId);
                const missing = !cat.accountId;
                return (
                  <div key={cat.key} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${missing ? "rgba(251,146,60,0.4)" : cat.type === "credit" ? "rgba(74,222,128,0.15)" : "rgba(237,232,220,0.08)"}`, borderRadius: 12, overflow: "hidden" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.85rem 1.25rem" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: cat.type === "credit" ? "#4ade80" : "#f87171" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{cat.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", marginTop: 2 }}>
                          {cat.txns.length} transaction{cat.txns.length !== 1 ? "s" : ""} · {cat.type === "credit" ? "Dr Bank" : "Cr Bank"}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: "1rem", color: cat.type === "credit" ? "#4ade80" : "#f87171", flexShrink: 0 }}>
                        {fmt(catTotal)}
                      </div>
                      {/* Account selector */}
                      <div style={{ minWidth: 220, flexShrink: 0 }}>
                        <select
                          value={cat.accountId}
                          onChange={e => updateCatAccount(cat.key, e.target.value)}
                          style={{ ...inp, border: `1px solid ${missing ? "rgba(251,146,60,0.6)" : "rgba(237,232,220,0.15)"}`, color: missing ? "#fb923c" : "#EDE8DC" }}
                        >
                          <option value="">{cat.accountHint ? `Suggested: ${cat.accountHint}` : "— assign account —"}</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                        </select>
                      </div>
                      <button onClick={() => setExpandedCat(expanded ? null : cat.key)} style={{ background: "none", border: "none", color: "rgba(237,232,220,0.35)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0, padding: "4px 8px" }}>
                        {expanded ? "▲ Hide" : "▼ Show"} txns
                      </button>
                    </div>

                    {/* Expanded transactions */}
                    {expanded && (
                      <div style={{ borderTop: "1px solid rgba(237,232,220,0.06)", maxHeight: 260, overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                              {["Date", "Narration", "Amount"].map(h => (
                                <th key={h} style={{ padding: "0.45rem 1rem", textAlign: h === "Amount" ? "right" : "left", fontSize: "0.62rem", color: "rgba(237,232,220,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {cat.txns.map(txn => (
                              <tr key={txn.id} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                                <td style={{ padding: "0.45rem 1rem", fontSize: "0.78rem", whiteSpace: "nowrap", color: "rgba(237,232,220,0.5)" }}>{txn.date}</td>
                                <td style={{ padding: "0.45rem 1rem", fontSize: "0.8rem", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.narration}</td>
                                <td style={{ padding: "0.45rem 1rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: txn.type === "credit" ? "#4ade80" : "#f87171" }}>
                                  {fmt(txn.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <button onClick={() => { setStep("upload"); setCategories([]); setRawTxns([]); }} style={{ background: "rgba(237,232,220,0.06)", border: "none", color: "#EDE8DC", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: "0.9rem" }}>← Back</button>
              <button
                onClick={postAll}
                disabled={unresolvedCount > 0 || !bankAccountId}
                style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: (unresolvedCount > 0 || !bankAccountId) ? 0.45 : 1 }}
              >
                Post {rawTxns.length} Transactions to Ledger →
              </button>
              {unresolvedCount > 0 && <span style={{ fontSize: "0.78rem", color: "#fb923c" }}>Assign accounts to all {unresolvedCount} highlighted groups first</span>}
            </div>
          </>
        )}

        {/* ── Step 3: Posting ── */}
        {step === "posting" && (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.4rem" }}>Posting journal entries…</div>
            <div style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.85rem" }}>Please wait, do not close this tab.</div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && postResult && (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{postResult.failed === 0 ? "✅" : "⚠️"}</div>
            <div style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: "0.5rem" }}>
              {postResult.posted} Journal Entr{postResult.posted !== 1 ? "ies" : "y"} Posted
            </div>
            <div style={{ color: "rgba(237,232,220,0.5)", marginBottom: "2rem" }}>
              {postResult.failed > 0 ? `${postResult.failed} failed — check chart of accounts.` : "All transactions are now in your ledger and dashboard."}
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link href="/finance" style={{ background: "#C9A84C", color: "#070C1A", padding: "10px 24px", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>View Dashboard →</Link>
              <Link href="/finance/journals" style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", padding: "10px 20px", borderRadius: 8, textDecoration: "none" }}>Journal Entries →</Link>
              <button onClick={() => { setCsvText(""); setStep("upload"); setCategories([]); setRawTxns([]); setPostResult(null); }} style={{ background: "rgba(237,232,220,0.06)", border: "none", color: "#EDE8DC", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
