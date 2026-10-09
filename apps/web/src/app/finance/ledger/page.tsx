"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Suspense } from "react";

type Account = { id: string; code: string; name: string; type: string };
type LedgerEntry = {
  id: string;
  date: string;
  entry_no: string;
  narration: string;
  dr: number;
  cr: number;
  balance: number;
  balance_type: "Dr" | "Cr";
  journal_type: string;
};

function LedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bizId, setBizId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccId, setSelectedAccId] = useState(searchParams.get("account") ?? "");
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openingBal, setOpeningBal] = useState(0);
  const [openingType, setOpeningType] = useState<"Dr" | "Cr">("Dr");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code");
      setAccounts(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (selectedAccId && bizId) {
      const acc = accounts.find(a => a.id === selectedAccId);
      setSelectedAcc(acc ?? null);
      fetchLedger(selectedAccId, bizId);
    }
  }, [selectedAccId, bizId, accounts]);

  async function fetchLedger(accId: string, bid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("fw_fin_journal_lines")
      .select(`
        id, dr_amount, cr_amount, narration,
        fw_fin_journals!inner(id, entry_no, date, narration, type, status, business_id)
      `)
      .eq("account_id", accId)
      .eq("fw_fin_journals.business_id", bid)
      .eq("fw_fin_journals.status", "posted")
      .order("fw_fin_journals(date)");

    type RawLine = {
      id: string;
      dr_amount: number;
      cr_amount: number;
      narration: string | null;
      fw_fin_journals: {
        id: string; entry_no: string; date: string; narration: string;
        type: string; status: string; business_id: string;
      } | null;
    };

    const rows = (data as unknown as RawLine[]) ?? [];
    let runningBal = openingBal;
    let balType: "Dr" | "Cr" = openingType;

    const ledgerRows: LedgerEntry[] = rows.map(row => {
      const j = row.fw_fin_journals;
      const dr = row.dr_amount ?? 0;
      const cr = row.cr_amount ?? 0;

      // Running balance logic
      if (balType === "Dr") {
        const net = runningBal + dr - cr;
        runningBal = Math.abs(net);
        balType = net >= 0 ? "Dr" : "Cr";
      } else {
        const net = runningBal + cr - dr;
        runningBal = Math.abs(net);
        balType = net >= 0 ? "Cr" : "Dr";
      }

      return {
        id: row.id,
        date: j?.date ?? "",
        entry_no: j?.entry_no ?? "",
        narration: row.narration ?? j?.narration ?? "",
        dr, cr,
        balance: runningBal,
        balance_type: balType,
        journal_type: j?.type ?? "",
      };
    });

    setEntries(ledgerRows);
    setLoading(false);
  }

  const totalDr = entries.reduce((s, e) => s + e.dr, 0);
  const totalCr = entries.reduce((s, e) => s + e.cr, 0);
  const closingBalance = Math.abs(totalDr - totalCr);
  const closingType: "Dr" | "Cr" = totalDr >= totalCr ? "Dr" : "Cr";
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const filteredAccounts = search
    ? accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
    : accounts;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Ledger</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "#141A3A", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
          🖨 Print
        </button>
      </nav>

      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
        {/* Sidebar — Account List */}
        <div style={{ width: 260, borderRight: "1px solid rgba(20,26,58,0.11)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.08)" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
              style={{ width: "100%", background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "6px 10px", borderRadius: 6, fontSize: "0.8rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {["asset", "liability", "equity", "income", "expense"].map(type => {
              const typeAccounts = filteredAccounts.filter(a => a.type === type);
              if (!typeAccounts.length) return null;
              const typeLabels: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Capital", income: "Income", expense: "Expenses" };
              return (
                <div key={type}>
                  <div style={{ padding: "0.4rem 1rem", fontSize: "0.68rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, background: "#FFFFFF" }}>
                    {typeLabels[type]}
                  </div>
                  {typeAccounts.map(acc => (
                    <div key={acc.id} onClick={() => setSelectedAccId(acc.id)} style={{
                      padding: "0.55rem 1rem", cursor: "pointer", fontSize: "0.82rem",
                      background: selectedAccId === acc.id ? "rgba(35,42,99,0.12)" : "transparent",
                      color: selectedAccId === acc.id ? "#232A63" : "rgba(20,26,58,0.95)",
                      borderLeft: selectedAccId === acc.id ? "2px solid #232A63" : "2px solid transparent",
                    }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(20,26,58,0.55)", marginRight: "0.5rem" }}>{acc.code}</span>
                      {acc.name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main — Ledger */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {!selectedAcc ? (
            <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📒</div>
              <div style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.9rem" }}>Select an account from the left to view its ledger</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.2rem", fontWeight: 800 }}>{selectedAcc.name}</h2>
                <div style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>Account Code: {selectedAcc.code} · Type: {selectedAcc.type}</div>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Total Debit", value: totalDr, color: "#C2321F" },
                  { label: "Total Credit", value: totalCr, color: "#0B7A55" },
                  { label: `Closing Balance (${closingType})`, value: closingBalance, color: "#232A63" },
                ].map(k => (
                  <div key={k.label} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 10, padding: "0.85rem 1rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>{k.label}</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>₹{fmt(k.value)}</div>
                  </div>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "rgba(20,26,58,0.55)" }}>Loading ledger…</div>
              ) : entries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "rgba(20,26,58,0.55)" }}>No posted transactions for this account.</div>
              ) : (
                <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.10)", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#FFFFFF" }}>
                        {["Date", "Entry No", "Narration", "Debit (₹)", "Credit (₹)", "Balance"].map(h => (
                          <th key={h} style={{ padding: "0.55rem 0.85rem", textAlign: ["Debit (₹)", "Credit (₹)", "Balance"].includes(h) ? "right" : "left", fontSize: "0.68rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: "rgba(35,42,99,0.04)", borderBottom: "1px solid rgba(20,26,58,0.08)" }}>
                        <td colSpan={3} style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem", fontWeight: 600, color: "rgba(20,26,58,0.75)" }}>Opening Balance</td>
                        <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.8rem", color: "rgba(20,26,58,0.75)", fontVariantNumeric: "tabular-nums" }}>
                          {openingType === "Dr" && openingBal > 0 ? fmt(openingBal) : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.8rem", color: "rgba(20,26,58,0.75)", fontVariantNumeric: "tabular-nums" }}>
                          {openingType === "Cr" && openingBal > 0 ? fmt(openingBal) : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", color: "#232A63" }}>
                          {fmt(openingBal)} {openingType}
                        </td>
                      </tr>
                      {entries.map((e, i) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                          <td style={{ padding: "0.5rem 0.85rem", fontSize: "0.78rem", color: "rgba(20,26,58,0.75)", whiteSpace: "nowrap" }}>
                            {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                          <td style={{ padding: "0.5rem 0.85rem", fontSize: "0.75rem", fontFamily: "monospace", color: "rgba(20,26,58,0.7)" }}>{e.entry_no}</td>
                          <td style={{ padding: "0.5rem 0.85rem", fontSize: "0.82rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.narration}</td>
                          <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: e.dr > 0 ? "#C2321F" : "rgba(20,26,58,0.28)" }}>
                            {e.dr > 0 ? fmt(e.dr) : "—"}
                          </td>
                          <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: e.cr > 0 ? "#0B7A55" : "rgba(20,26,58,0.28)" }}>
                            {e.cr > 0 ? fmt(e.cr) : "—"}
                          </td>
                          <td style={{ padding: "0.5rem 0.85rem", textAlign: "right", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#141A3A" }}>
                            {fmt(e.balance)} <span style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.60)" }}>{e.balance_type}</span>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid rgba(35,42,99,0.3)", background: "rgba(35,42,99,0.06)" }}>
                        <td colSpan={3} style={{ padding: "0.6rem 0.85rem", fontWeight: 800, fontSize: "0.85rem" }}>Closing Balance</td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#C2321F" }}>{fmt(totalDr)}</td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#0B7A55" }}>{fmt(totalCr)}</td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 800, color: "#232A63", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(closingBalance)} {closingType}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F5F6FA" }} />}><LedgerContent /></Suspense>;
}
