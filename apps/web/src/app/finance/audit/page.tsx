"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Journal = {
  id: string; entry_no: string; date: string; narration: string;
  type: string; status: string; total_debit: number; total_credit: number;
  financial_year_id: string | null;
};
type JournalLine = {
  id: string; journal_id: string; account_id: string; description: string;
  dr_amount: number; cr_amount: number;
  account?: { name: string; type: string };
};
type Account = { id: string; name: string; type: string };
type Flag = { id: string; entry_no: string; date: string; narration: string; type: string; amount: number; reason: string; severity: "high" | "medium" | "low" };

const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const sevColor: Record<string, string> = { high: "#F87171", medium: "#FBBF24", low: "#60A5FA" };
const sevBg: Record<string, string>    = { high: "rgba(248,113,113,0.08)", medium: "rgba(251,191,36,0.08)", low: "rgba(96,165,250,0.08)" };

function isRoundNumber(n: number) { return n >= 10000 && n % 1000 === 0; }
function isWeekend(dateStr: string) { const d = new Date(dateStr); return d.getDay() === 0 || d.getDay() === 6; }

function buildFlags(journals: Journal[]): Flag[] {
  const flags: Flag[] = [];
  for (const j of journals) {
    const amt = Math.max(j.total_debit, j.total_credit);
    // Round number (possible splitting / adjustment)
    if (isRoundNumber(amt)) flags.push({ ...j, amount: amt, reason: "Round number amount — possible estimate or cash adjustment", severity: "medium" });
    // Weekend transaction
    if (isWeekend(j.date)) flags.push({ ...j, amount: amt, reason: "Transaction on weekend — verify if authorised", severity: "low" });
    // No narration
    if (!j.narration || j.narration.trim().length < 3) flags.push({ ...j, amount: amt, reason: "Missing narration — not self-explanatory", severity: "low" });
    // Very large transaction (> 5 lakh)
    if (amt >= 500000) flags.push({ ...j, amount: amt, reason: "Large transaction above ₹5 lakh — verify approval", severity: "high" });
    // Debit-credit mismatch
    if (Math.abs(j.total_debit - j.total_credit) > 1) flags.push({ ...j, amount: amt, reason: `DR/CR mismatch: DR ₹${j.total_debit.toFixed(2)} ≠ CR ₹${j.total_credit.toFixed(2)}`, severity: "high" });
    // Year-end entries (March 31 / March 30)
    if (j.date?.endsWith("-03-31") || j.date?.endsWith("-03-30")) flags.push({ ...j, amount: amt, reason: "Year-end entry — review for cut-off compliance", severity: "medium" });
  }
  // Deduplication by id + reason to avoid double flags
  const seen = new Set<string>();
  return flags.filter(f => { const k = f.id + f.reason; if (seen.has(k)) return false; seen.add(k); return true; });
}

type TrialRow = { name: string; type: string; dr: number; cr: number; balance: number };

function buildTrialBalance(accounts: Account[], lines: JournalLine[]): TrialRow[] {
  const map = new Map<string, TrialRow>();
  for (const a of accounts) map.set(a.id, { name: a.name, type: a.type, dr: 0, cr: 0, balance: 0 });
  for (const l of lines) {
    const row = map.get(l.account_id);
    if (!row) continue;
    row.dr += l.dr_amount || 0;
    row.cr += l.cr_amount || 0;
  }
  return Array.from(map.values()).map(r => ({ ...r, balance: r.dr - r.cr })).filter(r => r.dr > 0 || r.cr > 0).sort((a,b) => a.name.localeCompare(b.name));
}

type PLSummary = { revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; rows: TrialRow[] };

function buildPL(tb: TrialRow[]): PLSummary {
  const incomeTypes = ["income", "sales"];
  const cogsTypes = ["cost_of_goods"];
  const expTypes = ["expense"];
  const revenue = tb.filter(r => incomeTypes.includes(r.type)).reduce((s,r) => s + Math.abs(r.cr - r.dr), 0);
  const cogs = tb.filter(r => cogsTypes.includes(r.type)).reduce((s,r) => s + Math.abs(r.dr - r.cr), 0);
  const expenses = tb.filter(r => expTypes.includes(r.type)).reduce((s,r) => s + Math.abs(r.dr - r.cr), 0);
  return { revenue, cogs, grossProfit: revenue - cogs, expenses, netProfit: revenue - cogs - expenses, rows: tb };
}

type BSSummary = {
  assets: TrialRow[]; fixedAssets: TrialRow[];
  liabilities: TrialRow[]; loans: TrialRow[]; taxes: TrialRow[];
  equity: TrialRow[]; retainedEarnings: number;
  totalAssets: number; totalLiabEq: number;
};

function buildBS(tb: TrialRow[], netProfit: number): BSSummary {
  const assets      = tb.filter(r => ["asset","bank","cash"].includes(r.type)).map(r => ({ ...r, balance: r.dr - r.cr }));
  const fixedAssets = tb.filter(r => r.type === "fixed_asset").map(r => ({ ...r, balance: r.dr - r.cr }));
  const liabilities = tb.filter(r => r.type === "liability").map(r => ({ ...r, balance: r.cr - r.dr }));
  const loans       = tb.filter(r => r.type === "loan").map(r => ({ ...r, balance: r.cr - r.dr }));
  const taxes       = tb.filter(r => r.type === "tax").map(r => ({ ...r, balance: r.cr - r.dr }));
  const equity      = tb.filter(r => r.type === "equity").map(r => ({ ...r, balance: r.cr - r.dr }));
  const totalAssets = [...assets, ...fixedAssets].reduce((s,r) => s + r.balance, 0);
  const totalLiabEq = [...liabilities, ...loans, ...taxes, ...equity].reduce((s,r) => s + r.balance, 0) + netProfit;
  return { assets, fixedAssets, liabilities, loans, taxes, equity, retainedEarnings: netProfit, totalAssets, totalLiabEq };
}

export default function AuditPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<"overview" | "flags" | "trial_balance" | "pl" | "balance_sheet" | "ledger">("overview");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [fys, setFys] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: fysData } = await supabase.from("fw_fin_financial_years").select("id,label,is_current").eq("business_id", saved).order("start_date", { ascending: false });
      const cur = fysData?.find(f => f.is_current) ?? fysData?.[0];
      setFys(fysData?.map(f => ({ id: f.id, label: f.label })) ?? []);
      if (cur) { setFyId(cur.id); await loadData(saved, cur.id); }
      else { setLoading(false); }
    });
  }, []);

  async function loadData(bid: string, fid: string) {
    setLoading(true);
    const [jRes, lRes, aRes] = await Promise.all([
      supabase.from("fw_fin_journals").select("id,entry_no,date,narration,type,status,total_debit,total_credit,financial_year_id").eq("business_id", bid).eq("financial_year_id", fid).eq("status", "posted").order("date"),
      supabase.from("fw_fin_journal_lines").select("id,journal_id,account_id,description,dr_amount,cr_amount").eq("business_id", bid),
      supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", bid),
    ]);
    setJournals(jRes.data ?? []);
    setLines(lRes.data ?? []);
    setAccounts(aRes.data ?? []);
    setLoading(false);
  }

  async function switchFy(fid: string) {
    setFyId(fid);
    if (bizId) await loadData(bizId, fid);
  }

  const flags = buildFlags(journals);
  const tb = buildTrialBalance(accounts, lines.filter(l => journals.some(j => j.id === l.journal_id)));
  const pl = buildPL(tb);
  const bs = buildBS(tb, pl.netProfit);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "flags", label: `⚑ Flags (${flags.length})` },
    { key: "trial_balance", label: "Trial Balance" },
    { key: "pl", label: "P&L" },
    { key: "balance_sheet", label: "Balance Sheet" },
    { key: "ledger", label: "Ledger View" },
  ];

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF5", padding: "5px 10px", borderRadius: 7, fontSize: "0.8rem", fontFamily: "inherit", outline: "none", cursor: "pointer" };

  const ledgerLines = selectedAccount ? lines.filter(l => l.account_id === selectedAccount && journals.some(j => j.id === l.journal_id)) : [];
  const ledgerJournals = new Map(journals.map(j => [j.id, j]));

  return (
    <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .au-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.25rem 1.4rem; }
        .au-tab { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.82rem; font-weight: 600; padding: 8px 16px; border-radius: 8px; transition: all 0.15s; color: rgba(232,237,245,0.4); }
        .au-tab:hover { color: rgba(232,237,245,0.7); background: rgba(255,255,255,0.04); }
        .au-tab-active { color: #E8EDF5; background: rgba(255,255,255,0.08); }
        .au-tr:hover td { background: rgba(255,255,255,0.02); }
        td, th { padding: 0.45rem 0.85rem; }
        select option { background: #0B1221; }
        .au-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", height: 52, position: "sticky", top: 0, background: "rgba(5,9,20,0.95)", backdropFilter: "blur(16px)", zIndex: 30 }}>
        <Link href="/finance" style={{ color: "#60A5FA", fontWeight: 700, textDecoration: "none", fontSize: "0.88rem" }}>← Finance</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Audit & Reports</span>
        <div style={{ flex: 1 }} />
        <select value={fyId ?? ""} onChange={e => switchFy(e.target.value)} style={inp}>
          {fys.map(f => <option key={f.id} value={f.id}>FY {f.label}</option>)}
        </select>
        <Link href="/finance/tally" style={{ fontSize: "0.78rem", color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", padding: "5px 12px", borderRadius: 7, textDecoration: "none", fontWeight: 600 }}>
          ⬇ Sync from Tally
        </Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`au-tab${tab === t.key ? " au-tab-active" : ""}`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "rgba(232,237,245,0.3)", fontSize: "0.88rem" }}>Loading data…</div>
        ) : journals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📭</div>
            <div style={{ color: "rgba(232,237,245,0.4)", marginBottom: "1.5rem" }}>No transactions found. Sync from Tally first.</div>
            <Link href="/finance/tally" style={{ background: "#2563EB", color: "#fff", padding: "10px 24px", borderRadius: 9, textDecoration: "none", fontWeight: 700 }}>Go to Tally Bridge →</Link>
          </div>
        ) : (

          <>
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.85rem", marginBottom: "1.5rem" }}>
                  {[
                    { label: "Revenue", value: fmt(pl.revenue), color: "#34D399" },
                    { label: "Net Profit", value: (pl.netProfit < 0 ? "−" : "") + fmt(pl.netProfit), color: pl.netProfit >= 0 ? "#34D399" : "#F87171" },
                    { label: "Total Entries", value: String(journals.length), color: "#60A5FA" },
                    { label: "Audit Flags", value: String(flags.length), color: flags.filter(f => f.severity === "high").length > 0 ? "#F87171" : "#FBBF24" },
                  ].map(k => (
                    <div key={k.label} className="au-card">
                      <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.7rem" }}>{k.label}</div>
                      <div style={{ fontSize: "1.4rem", fontWeight: 900, color: k.color, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1, marginBottom: "0.3rem" }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Flag summary */}
                {flags.length > 0 && (
                  <div className="au-card" style={{ marginBottom: "1.25rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem" }}>⚑ Audit Flags Summary</div>
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      {(["high","medium","low"] as const).map(sev => {
                        const count = flags.filter(f => f.severity === sev).length;
                        return count > 0 ? (
                          <span key={sev} style={{ fontSize: "0.72rem", fontWeight: 700, color: sevColor[sev], background: sevBg[sev], padding: "3px 10px", borderRadius: 20, border: `1px solid ${sevColor[sev]}30` }}>
                            {count} {sev}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <button onClick={() => setTab("flags")} style={{ fontSize: "0.78rem", color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>View all flags →</button>
                  </div>
                )}

                {/* Quick P&L */}
                <div className="au-card" style={{ marginBottom: "1.25rem" }}>
                  <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem", display: "flex", justifyContent: "space-between" }}>
                    <span>Profit & Loss Summary</span>
                    <button onClick={() => setTab("pl")} style={{ fontSize: "0.75rem", color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Full P&L →</button>
                  </div>
                  {[
                    { label: "Revenue", val: pl.revenue, color: "#34D399" },
                    { label: "Cost of Goods Sold", val: -pl.cogs, color: "#F87171" },
                    { label: "Gross Profit", val: pl.grossProfit, color: "#60A5FA", bold: true },
                    { label: "Operating Expenses", val: -pl.expenses, color: "#F87171" },
                    { label: "Net Profit / Loss", val: pl.netProfit, color: pl.netProfit >= 0 ? "#34D399" : "#F87171", bold: true },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontWeight: r.bold ? 700 : 400, fontSize: r.bold ? "0.88rem" : "0.84rem" }}>
                      <span style={{ color: "rgba(232,237,245,0.6)" }}>{r.label}</span>
                      <span className="au-mono" style={{ color: r.color }}>{r.val < 0 ? "−" : ""}{fmt(r.val)}</span>
                    </div>
                  ))}
                </div>

                {/* Recent entries */}
                <div className="au-card">
                  <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem" }}>Recent Transactions</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead><tr style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <th style={{ textAlign: "left" }}>Entry</th><th style={{ textAlign: "left" }}>Date</th><th style={{ textAlign: "left" }}>Type</th><th style={{ textAlign: "left" }}>Narration</th><th style={{ textAlign: "right" }}>Amount</th>
                      </tr></thead>
                      <tbody>
                        {journals.slice(-10).reverse().map(j => (
                          <tr key={j.id} className="au-tr" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                            <td className="au-mono" style={{ color: "rgba(232,237,245,0.4)", fontSize: "0.72rem" }}>{j.entry_no}</td>
                            <td style={{ color: "rgba(232,237,245,0.5)", whiteSpace: "nowrap" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                            <td><span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#60A5FA", background: "rgba(96,165,250,0.1)", padding: "2px 8px", borderRadius: 20 }}>{j.type}</span></td>
                            <td style={{ color: "rgba(232,237,245,0.6)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#34D399" }}>{fmt(Math.max(j.total_debit, j.total_credit))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── FLAGS ── */}
            {tab === "flags" && (
              <div>
                <div style={{ marginBottom: "1rem", fontSize: "0.84rem", color: "rgba(232,237,245,0.4)" }}>{flags.length} audit observation{flags.length !== 1 ? "s" : ""} found</div>
                {flags.length === 0 ? (
                  <div className="au-card" style={{ textAlign: "center", padding: "3rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✅</div>
                    <div style={{ color: "rgba(232,237,245,0.5)" }}>No audit flags — all entries look clean.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {flags.map((f, i) => (
                      <div key={i} style={{ background: sevBg[f.severity], border: `1px solid ${sevColor[f.severity]}25`, borderLeft: `3px solid ${sevColor[f.severity]}`, borderRadius: 10, padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                          <div>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: sevColor[f.severity], textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 8 }}>{f.severity}</span>
                            <span style={{ fontSize: "0.82rem", color: "#E8EDF5", fontWeight: 600 }}>{f.reason}</span>
                          </div>
                          <span className="au-mono" style={{ fontSize: "0.84rem", fontWeight: 700, color: "#E8EDF5", flexShrink: 0 }}>{fmt(f.amount)}</span>
                        </div>
                        <div style={{ marginTop: "0.4rem", display: "flex", gap: "1rem", fontSize: "0.75rem", color: "rgba(232,237,245,0.35)" }}>
                          <span className="au-mono">{f.entry_no}</span>
                          <span>{new Date(f.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          <span>{f.type}</span>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.narration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TRIAL BALANCE ── */}
            {tab === "trial_balance" && (
              <div className="au-card">
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Trial Balance</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,237,245,0.35)", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <th style={{ textAlign: "left" }}>Account</th>
                        <th style={{ textAlign: "left" }}>Type</th>
                        <th style={{ textAlign: "right" }}>Debit (₹)</th>
                        <th style={{ textAlign: "right" }}>Credit (₹)</th>
                        <th style={{ textAlign: "right" }}>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tb.map(r => (
                        <tr key={r.name} className="au-tr" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }} onClick={() => { setSelectedAccount(accounts.find(a => a.name === r.name)?.id ?? null); setTab("ledger"); }}>
                          <td style={{ color: "#60A5FA", fontWeight: 500 }}>{r.name}</td>
                          <td><span style={{ fontSize: "0.65rem", color: "rgba(232,237,245,0.35)", background: "rgba(255,255,255,0.04)", padding: "1px 7px", borderRadius: 20 }}>{r.type}</span></td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.dr > 0 ? "#E8EDF5" : "rgba(232,237,245,0.2)" }}>{r.dr > 0 ? fmt(r.dr) : "—"}</td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.cr > 0 ? "#E8EDF5" : "rgba(232,237,245,0.2)" }}>{r.cr > 0 ? fmt(r.cr) : "—"}</td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.balance >= 0 ? "#34D399" : "#F87171", fontWeight: 600 }}>{r.balance < 0 ? "−" : ""}{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid rgba(255,255,255,0.1)", fontWeight: 800 }}>
                        <td colSpan={2} style={{ color: "rgba(232,237,245,0.5)", fontSize: "0.78rem" }}>TOTAL</td>
                        <td className="au-mono" style={{ textAlign: "right", color: "#34D399" }}>{fmt(tb.reduce((s,r) => s+r.dr,0))}</td>
                        <td className="au-mono" style={{ textAlign: "right", color: "#60A5FA" }}>{fmt(tb.reduce((s,r) => s+r.cr,0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "rgba(232,237,245,0.25)" }}>Click any account to view ledger transactions.</div>
              </div>
            )}

            {/* ── P&L ── */}
            {tab === "pl" && (
              <div className="au-card">
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1.25rem" }}>Profit & Loss Statement</div>
                {[
                  { title: "INCOME", rows: tb.filter(r => ["income","sales"].includes(r.type)), sign: -1 },
                  { title: "COST OF GOODS SOLD", rows: tb.filter(r => r.type === "cost_of_goods"), sign: 1 },
                  { title: "OPERATING EXPENSES", rows: tb.filter(r => r.type === "expense"), sign: 1 },
                ].map(sec => sec.rows.length === 0 ? null : (
                  <div key={sec.title} style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{sec.title}</div>
                    {sec.rows.map(r => (
                      <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", fontSize: "0.84rem" }}>
                        <span style={{ color: "rgba(232,237,245,0.65)" }}>{r.name}</span>
                        <span className="au-mono">{fmt(sec.sign === -1 ? r.cr - r.dr : r.dr - r.cr)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderTop: "1px solid rgba(255,255,255,0.08)", fontWeight: 700, fontSize: "0.85rem" }}>
                      <span style={{ color: "rgba(232,237,245,0.4)" }}>Total {sec.title}</span>
                      <span className="au-mono">{fmt(sec.rows.reduce((s,r) => s + (sec.sign === -1 ? r.cr - r.dr : r.dr - r.cr), 0))}</span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: "2px solid rgba(255,255,255,0.12)", paddingTop: "1rem" }}>
                  {[
                    { label: "Gross Profit", val: pl.grossProfit },
                    { label: "Net Profit / Loss", val: pl.netProfit },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", fontWeight: 800, fontSize: "0.92rem" }}>
                      <span>{r.label}</span>
                      <span className="au-mono" style={{ color: r.val >= 0 ? "#34D399" : "#F87171" }}>{r.val < 0 ? "−" : ""}{fmt(r.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── BALANCE SHEET ── */}
            {tab === "balance_sheet" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {/* Assets side */}
                <div className="au-card">
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Assets</div>
                  {[
                    { title: "Current Assets", rows: bs.assets },
                    { title: "Fixed Assets", rows: bs.fixedAssets },
                  ].map(sec => sec.rows.length === 0 ? null : (
                    <div key={sec.title} style={{ marginBottom: "1rem" }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(232,237,245,0.3)", textTransform: "uppercase", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>{sec.title}</div>
                      {sec.rows.map(r => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                          <span style={{ color: "rgba(232,237,245,0.6)" }}>{r.name}</span>
                          <span className="au-mono">{fmt(r.balance)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ borderTop: "2px solid rgba(255,255,255,0.1)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>Total Assets</span>
                    <span className="au-mono" style={{ color: "#34D399" }}>{fmt(bs.totalAssets)}</span>
                  </div>
                </div>
                {/* Liabilities + Equity side */}
                <div className="au-card">
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Liabilities & Equity</div>
                  {[
                    { title: "Capital & Equity", rows: bs.equity },
                    { title: "Loans & Borrowings", rows: bs.loans },
                    { title: "Current Liabilities", rows: bs.liabilities },
                    { title: "Tax Liabilities", rows: bs.taxes },
                  ].map(sec => sec.rows.length === 0 ? null : (
                    <div key={sec.title} style={{ marginBottom: "1rem" }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(232,237,245,0.3)", textTransform: "uppercase", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>{sec.title}</div>
                      {sec.rows.map(r => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                          <span style={{ color: "rgba(232,237,245,0.6)" }}>{r.name}</span>
                          <span className="au-mono">{fmt(r.balance)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {pl.netProfit !== 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                      <span style={{ color: "rgba(232,237,245,0.6)" }}>Retained Earnings (Net P/L)</span>
                      <span className="au-mono" style={{ color: pl.netProfit >= 0 ? "#34D399" : "#F87171" }}>{pl.netProfit < 0 ? "−" : ""}{fmt(pl.netProfit)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "2px solid rgba(255,255,255,0.1)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>Total Liab. + Equity</span>
                    <span className="au-mono" style={{ color: "#60A5FA" }}>{fmt(bs.totalLiabEq)}</span>
                  </div>
                  {Math.abs(bs.totalAssets - bs.totalLiabEq) > 1 && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#FBBF24", background: "rgba(251,191,36,0.08)", padding: "0.5rem 0.75rem", borderRadius: 7 }}>
                      ⚠ Balance sheet doesn't balance by ₹{fmt(Math.abs(bs.totalAssets - bs.totalLiabEq))} — some entries may be missing accounts
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── LEDGER VIEW ── */}
            {tab === "ledger" && (
              <div>
                <div style={{ marginBottom: "1rem" }}>
                  <select value={selectedAccount ?? ""} onChange={e => setSelectedAccount(e.target.value || null)} style={{ ...inp, minWidth: 240 }}>
                    <option value="">— Select Account —</option>
                    {accounts.sort((a,b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                {selectedAccount && (
                  <div className="au-card">
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{accounts.find(a => a.id === selectedAccount)?.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.3)", marginBottom: "1rem" }}>{ledgerLines.length} transaction{ledgerLines.length !== 1 ? "s" : ""}</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead><tr style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.03)" }}>
                          <th style={{ textAlign: "left" }}>Entry</th>
                          <th style={{ textAlign: "left" }}>Date</th>
                          <th style={{ textAlign: "left" }}>Narration</th>
                          <th style={{ textAlign: "right" }}>DR (₹)</th>
                          <th style={{ textAlign: "right" }}>CR (₹)</th>
                        </tr></thead>
                        <tbody>
                          {ledgerLines.map(l => {
                            const j = ledgerJournals.get(l.journal_id);
                            return (
                              <tr key={l.id} className="au-tr" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <td className="au-mono" style={{ color: "rgba(232,237,245,0.4)", fontSize: "0.7rem" }}>{j?.entry_no}</td>
                                <td style={{ color: "rgba(232,237,245,0.5)", whiteSpace: "nowrap" }}>{j ? new Date(j.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" }) : ""}</td>
                                <td style={{ color: "rgba(232,237,245,0.6)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j?.narration || l.description}</td>
                                <td className="au-mono" style={{ textAlign: "right", color: l.dr_amount > 0 ? "#34D399" : "rgba(232,237,245,0.2)" }}>{l.dr_amount > 0 ? fmt(l.dr_amount) : "—"}</td>
                                <td className="au-mono" style={{ textAlign: "right", color: l.cr_amount > 0 ? "#60A5FA" : "rgba(232,237,245,0.2)" }}>{l.cr_amount > 0 ? fmt(l.cr_amount) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>
                            <td colSpan={3} style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.75rem" }}>CLOSING BALANCE</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#34D399" }}>{fmt(ledgerLines.reduce((s,l) => s+l.dr_amount,0))}</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#60A5FA" }}>{fmt(ledgerLines.reduce((s,l) => s+l.cr_amount,0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
