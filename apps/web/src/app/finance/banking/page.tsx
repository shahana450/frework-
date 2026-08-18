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
  matched: boolean;
  journal_id: string | null;
};

export default function BankingPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BankTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accNo, setAccNo] = useState("");
  const [openingBal, setOpeningBal] = useState("0");
  const [showSetup, setShowSetup] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [parseError, setParseError] = useState("");
  const [previewRows, setPreviewRows] = useState<BankTxn[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem() ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
    });
  }, []);

  function parseCSV(text: string): BankTxn[] {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");
    const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
    const dateIdx = header.findIndex(h => h.includes("date"));
    const narIdx = header.findIndex(h => h.includes("narr") || h.includes("desc") || h.includes("particular") || h.includes("detail"));
    const drIdx = header.findIndex(h => h.includes("debit") || h.includes("dr") || h.includes("withdraw"));
    const crIdx = header.findIndex(h => h.includes("credit") || h.includes("cr") || h.includes("deposit"));
    const balIdx = header.findIndex(h => h.includes("balance") || h.includes("bal"));

    if (dateIdx < 0) throw new Error("Cannot find 'Date' column in CSV");

    const rows: BankTxn[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
      const dr = parseFloat(cols[drIdx]?.replace(/,/g, "") || "0") || 0;
      const cr = parseFloat(cols[crIdx]?.replace(/,/g, "") || "0") || 0;
      const bal = parseFloat(cols[balIdx]?.replace(/,/g, "") || "0") || 0;
      if (!dr && !cr) continue;
      const dateStr = cols[dateIdx] ?? "";
      const parsed = new Date(dateStr.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/, "$3-$2-$1"));
      rows.push({
        id: `row_${i}`,
        date: isNaN(parsed.getTime()) ? dateStr : parsed.toISOString().split("T")[0],
        narration: cols[narIdx] ?? `Row ${i}`,
        amount: dr || cr,
        type: dr > 0 ? "debit" : "credit",
        balance: bal,
        matched: false,
        journal_id: null,
      });
    }
    return rows;
  }

  function handleParse() {
    setParseError("");
    try {
      const rows = parseCSV(csvText);
      if (rows.length === 0) throw new Error("No transactions found in CSV");
      setPreviewRows(rows);
      setStep("preview");
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Parse error");
    }
  }

  async function importTransactions() {
    if (!bizId) return;
    setUploading(true);
    // For each transaction, create a document record and AI suggestion
    for (const txn of previewRows) {
      await supabase.from("fw_fin_documents").insert({
        business_id: bizId,
        file_name: `Bank: ${txn.narration}`,
        file_url: "",
        doc_type: "bank_statement",
        status: "reviewed",
        ai_summary: {
          vendor: txn.type === "debit" ? txn.narration : null,
          customer: txn.type === "credit" ? txn.narration : null,
          amount: txn.amount,
          date: txn.date,
        },
      });
    }
    setTransactions(previewRows);
    setStep("done");
    setUploading(false);
  }

  const totalCredits = previewRows.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebits = previewRows.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Bank Reconciliation</span>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.4rem", fontWeight: 800 }}>Bank Reconciliation</h1>
        <p style={{ margin: "0 0 2rem", color: "rgba(237,232,220,0.5)", fontSize: "0.88rem" }}>Upload your bank statement CSV to auto-match transactions with journal entries.</p>

        {step === "upload" && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, padding: "1.5rem" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Bank Statement CSV</label>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={`Paste your CSV here. Expected columns: Date, Narration/Description, Debit, Credit, Balance\n\nExample:\nDate,Narration,Debit,Credit,Balance\n01-08-2025,NEFT from ABC Ltd,,50000.00,150000.00\n02-08-2025,Rent payment,30000.00,,120000.00`}
                rows={10}
                style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "12px", borderRadius: 6, fontSize: "0.82rem", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
              />
            </div>
            {parseError && <div style={{ color: "#f87171", fontSize: "0.83rem", marginBottom: "1rem" }}>{parseError}</div>}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={handleParse} disabled={!csvText.trim()} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: !csvText.trim() ? 0.5 : 1 }}>
                Parse & Preview →
              </button>
              <Link href="/finance/upload" style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: "0.9rem" }}>
                Upload PDF instead
              </Link>
            </div>
            <div style={{ marginTop: "1.25rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.35)", lineHeight: 1.6 }}>
              Supported: SBI, HDFC, ICICI, Axis, Kotak, Yes Bank CSV exports. Column names are auto-detected. Date formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD.
            </div>
          </div>
        )}

        {step === "preview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Total Credits (Deposits)", value: totalCredits, color: "#4ade80" },
                { label: "Total Debits (Withdrawals)", value: totalDebits, color: "#f87171" },
                { label: "Net Movement", value: totalCredits - totalDebits, color: totalCredits >= totalDebits ? "#4ade80" : "#f87171" },
              ].map(k => (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "1rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>{k.label}</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>₹{fmt(Math.abs(k.value))}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden", marginBottom: "1.25rem" }}>
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.08)", fontWeight: 700, fontSize: "0.88rem" }}>
                {previewRows.length} Transactions Found
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#0d1526" }}>
                    <tr>
                      {["Date", "Narration", "Debit", "Credit", "Balance"].map(h => (
                        <th key={h} style={{ padding: "0.55rem 1rem", textAlign: h === "Date" || h === "Narration" ? "left" : "right", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(txn => (
                      <tr key={txn.id} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                        <td style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", whiteSpace: "nowrap", color: "rgba(237,232,220,0.6)" }}>{txn.date}</td>
                        <td style={{ padding: "0.5rem 1rem", fontSize: "0.82rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.narration}</td>
                        <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: txn.type === "debit" ? "#f87171" : "rgba(237,232,220,0.25)" }}>
                          {txn.type === "debit" ? fmt(txn.amount) : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: txn.type === "credit" ? "#4ade80" : "rgba(237,232,220,0.25)" }}>
                          {txn.type === "credit" ? fmt(txn.amount) : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontSize: "0.78rem", fontVariantNumeric: "tabular-nums", color: "rgba(237,232,220,0.4)" }}>
                          {txn.balance > 0 ? fmt(txn.balance) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setStep("upload")} style={{ background: "rgba(237,232,220,0.06)", border: "none", color: "#EDE8DC", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: "0.9rem" }}>← Back</button>
              <button onClick={importTransactions} disabled={uploading} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: uploading ? 0.7 : 1 }}>
                {uploading ? "Importing…" : `Import ${previewRows.length} Transactions →`}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>Bank Statement Imported</div>
            <div style={{ color: "rgba(237,232,220,0.5)", marginBottom: "2rem" }}>{transactions.length} transactions imported. Review AI suggestions to post journal entries.</div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link href="/finance/ai-review" style={{ background: "#C9A84C", color: "#070C1A", padding: "10px 24px", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
                Review AI Suggestions →
              </Link>
              <button onClick={() => { setCsvText(""); setStep("upload"); setPreviewRows([]); }} style={{ background: "rgba(237,232,220,0.06)", border: "none", color: "#EDE8DC", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
