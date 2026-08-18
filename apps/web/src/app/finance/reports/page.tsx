"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type ReportTab = "trial_balance" | "profit_loss" | "balance_sheet" | "cash_flow";
type AccRow = { code?: string; name: string; type: string; sub_type: string | null; dr: number; cr: number };

type PLData = {
  direct_income: AccRow[]; indirect_income: AccRow[];
  direct_expense: AccRow[]; indirect_expense: AccRow[];
  gross_profit: number; total_income: number; total_expense: number; net_profit: number;
};

type BSData = {
  current_assets: AccRow[]; fixed_assets: AccRow[];
  current_liabilities: AccRow[]; long_term_liabilities: AccRow[];
  equity: AccRow[]; net_profit: number;
  total_assets: number; total_liabilities_equity: number;
};

type TBData = { accounts: AccRow[]; total_dr: number; total_cr: number };

const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const sign = (n: number) => n < 0 ? "-" : "";

function SectionTable({ title, rows, drLabel = "Debit", crLabel = "Credit", netLabel, netValue, netColor }: {
  title: string; rows: AccRow[]; drLabel?: string; crLabel?: string;
  netLabel?: string; netValue?: number; netColor?: string;
}) {
  const total = rows.reduce((s, r) => s + (r.dr - r.cr), 0);
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "0.5rem 1rem", background: "rgba(255,255,255,0.015)" }}>{title}</div>
      {rows.map(r => (
        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderTop: "1px solid rgba(237,232,220,0.04)", fontSize: "0.85rem" }}>
          <span style={{ color: "rgba(237,232,220,0.7)" }}>{r.name}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(Math.abs(r.dr - r.cr))}</span>
        </div>
      ))}
      {netLabel && netValue !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 1rem", borderTop: "2px solid rgba(237,232,220,0.12)", fontWeight: 700, color: netColor ?? "#C9A84C" }}>
          <span>{netLabel}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(Math.abs(netValue))}</span>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ReportTab>("profit_loss");
  const [loading, setLoading] = useState(false);
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string }[]>([]);
  const [plData, setPlData] = useState<PLData | null>(null);
  const [bsData, setBsData] = useState<BSData | null>(null);
  const [tbData, setTbData] = useState<TBData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,label,is_current").eq("business_id", saved).order("start_date", { ascending: false });
      if (fys?.length) {
        setFinancialYears(fys);
        const current = fys.find(f => f.is_current) ?? fys[0];
        setFyId(current.id);
      }
    });
  }, []);

  useEffect(() => {
    if (bizId && fyId) fetchReport(tab, bizId, fyId);
  }, [tab, bizId, fyId]);

  async function fetchReport(r: ReportTab, bid: string, fy: string) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/finance/reports?business_id=${bid}&fy_id=${fy}&report=${r}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (r === "profit_loss") setPlData(json);
      if (r === "balance_sheet") setBsData(json);
      if (r === "trial_balance") setTbData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  const TABS: { key: ReportTab; label: string }[] = [
    { key: "profit_loss", label: "Profit & Loss" },
    { key: "balance_sheet", label: "Balance Sheet" },
    { key: "trial_balance", label: "Trial Balance" },
    { key: "cash_flow", label: "Cash Flow" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>\u203A</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Reports</span>
        <div style={{ flex: 1 }} />
        {financialYears.length > 0 && (
          <select value={fyId ?? ""} onChange={e => setFyId(e.target.value)}
            style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#EDE8DC", padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>
            {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
          </select>
        )}
        <button onClick={() => window.print()} style={{ background: "rgba(237,232,220,0.06)", border: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
          \u{1F5A8} Print
        </button>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        {/* Tab row */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", borderBottom: "1px solid rgba(237,232,220,0.08)", paddingBottom: "0" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: "none", border: "none", color: tab === t.key ? "#C9A84C" : "rgba(237,232,220,0.45)",
              padding: "0.6rem 1rem", cursor: "pointer", fontWeight: tab === t.key ? 700 : 400, fontSize: "0.9rem",
              borderBottom: tab === t.key ? "2px solid #C9A84C" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>

        {error && <div style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "rgba(237,232,220,0.3)" }}>Calculating\u2026</div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
            {/* Profit & Loss */}
            {tab === "profit_loss" && plData && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.08)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Profit & Loss Statement</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>For the period \u2014 Financial Year {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                <SectionTable title="Revenue / Sales" rows={plData.direct_income} />
                <SectionTable title="Direct Expenses (Cost of Goods Sold)" rows={plData.direct_expense} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(201,168,76,0.06)", fontWeight: 800, fontSize: "0.95rem" }}>
                  <span>Gross Profit</span>
                  <span style={{ color: plData.gross_profit >= 0 ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
                    {plData.gross_profit < 0 ? "-" : ""}\u20B9{fmt(plData.gross_profit)}
                  </span>
                </div>
                <SectionTable title="Other Income" rows={plData.indirect_income} />
                <SectionTable title="Operating Expenses" rows={plData.indirect_expense} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "1rem 1.5rem", background: "rgba(201,168,76,0.1)", fontWeight: 800, fontSize: "1.1rem", borderTop: "2px solid rgba(201,168,76,0.3)" }}>
                  <span>Net {plData.net_profit >= 0 ? "Profit" : "Loss"}</span>
                  <span style={{ color: plData.net_profit >= 0 ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
                    {plData.net_profit < 0 ? "-" : ""}\u20B9{fmt(plData.net_profit)}
                  </span>
                </div>
                {plData.total_income === 0 && plData.total_expense === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.88rem" }}>
                    No posted entries yet. Upload documents and accept journal entries to see your P&L.
                  </div>
                )}
              </>
            )}

            {/* Balance Sheet */}
            {tab === "balance_sheet" && bsData && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.08)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Balance Sheet</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>As at end of FY {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  <div style={{ borderRight: "1px solid rgba(237,232,220,0.08)" }}>
                    <div style={{ padding: "0.6rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(96,165,250,0.05)" }}>Assets</div>
                    <SectionTable title="Current Assets" rows={bsData.current_assets} />
                    <SectionTable title="Fixed Assets" rows={bsData.fixed_assets} />
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(96,165,250,0.08)", fontWeight: 800 }}>
                      <span>Total Assets</span>
                      <span style={{ color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(bsData.total_assets)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ padding: "0.6rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(248,113,113,0.05)" }}>Liabilities & Capital</div>
                    <SectionTable title="Current Liabilities" rows={bsData.current_liabilities} />
                    <SectionTable title="Long-term Liabilities" rows={bsData.long_term_liabilities} />
                    <SectionTable title="Capital & Equity" rows={bsData.equity} />
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderTop: "1px solid rgba(237,232,220,0.06)", fontSize: "0.85rem" }}>
                      <span style={{ color: "rgba(237,232,220,0.7)" }}>Net {bsData.net_profit >= 0 ? "Profit" : "Loss"} (current year)</span>
                      <span style={{ color: bsData.net_profit >= 0 ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(bsData.net_profit)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(248,113,113,0.08)", fontWeight: 800 }}>
                      <span>Total Liabilities & Capital</span>
                      <span style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>\u20B9{fmt(bsData.total_liabilities_equity)}</span>
                    </div>
                  </div>
                </div>
                {bsData.total_assets === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.88rem" }}>No posted entries yet.</div>
                )}
              </>
            )}

            {/* Trial Balance */}
            {tab === "trial_balance" && tbData && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.08)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Trial Balance</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>FY {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["Code", "Account Name", "Debit (\u20B9)", "Credit (\u20B9)"].map(h => (
                        <th key={h} style={{ padding: "0.6rem 1rem", textAlign: h.includes("\u20B9") ? "right" : "left", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbData.accounts.map(a => (
                      <tr key={a.name} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
                        <td style={{ padding: "0.55rem 1rem", fontSize: "0.78rem", fontFamily: "monospace", color: "rgba(237,232,220,0.4)" }}>{a.code}</td>
                        <td style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}>{a.name}</td>
                        <td style={{ padding: "0.55rem 1rem", textAlign: "right", fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: a.dr > 0 ? "#EDE8DC" : "rgba(237,232,220,0.25)" }}>
                          {a.dr > 0 ? fmt(a.dr) : "\u2014"}
                        </td>
                        <td style={{ padding: "0.55rem 1rem", textAlign: "right", fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: a.cr > 0 ? "#EDE8DC" : "rgba(237,232,220,0.25)" }}>
                          {a.cr > 0 ? fmt(a.cr) : "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.06)" }}>
                      <td colSpan={2} style={{ padding: "0.75rem 1rem", fontWeight: 800, fontSize: "0.9rem" }}>Grand Total</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#C9A84C" }}>\u20B9{fmt(tbData.total_dr)}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#C9A84C" }}>\u20B9{fmt(tbData.total_cr)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ padding: "0.5rem 1rem", textAlign: "right", fontSize: "0.78rem", color: Math.abs(tbData.total_dr - tbData.total_cr) < 0.01 ? "#4ade80" : "#f87171" }}>
                        {Math.abs(tbData.total_dr - tbData.total_cr) < 0.01 ? "\u2713 Trial Balance is balanced" : `\u26A0 Difference: \u20B9${fmt(Math.abs(tbData.total_dr - tbData.total_cr))}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {tbData.accounts.length === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.88rem" }}>No posted entries yet.</div>
                )}
              </>
            )}

            {/* Cash Flow Statement */}
            {tab === "cash_flow" && plData && fyId && (
              <CashFlowStatement bizId={bizId} fyId={fyId} plData={plData} />
            )}
            {tab === "cash_flow" && !plData && !loading && (
              <div style={{ padding: "3rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.88rem" }}>
                <div>Load Profit &amp; Loss first to compute Cash Flow.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CashFlowStatement({ bizId, fyId, plData }: { bizId: string | null; fyId: string; plData: PLData }) {
  const [journals, setJournals] = useState<{ type: string; total_debit: number; total_credit: number; narration: string }[]>([]);

  useEffect(() => {
    if (!bizId) return;
    supabase.from("fw_fin_journals")
      .select("type,total_debit,total_credit,narration")
      .eq("business_id", bizId).eq("fy_id", fyId).eq("status", "posted")
      .then(({ data }) => setJournals(data ?? []));
  }, [bizId, fyId]);

  const netProfit = plData.net_profit;

  const receipts = journals.filter(j => j.type === "receipt").reduce((s, j) => s + j.total_credit, 0);
  const payments = journals.filter(j => j.type === "payment").reduce((s, j) => s + j.total_debit, 0);
  const expenses = journals.filter(j => j.type === "expense").reduce((s, j) => s + j.total_debit, 0);

  const operatingCF = netProfit + receipts - payments - expenses;
  const financingCF = 0; // no loan/equity entries yet
  const investingCF = 0; // no capex entries yet
  const netCF = operatingCF + investingCF + financingCF;

  const cfRow = (label: string, value: number, indent = false, bold = false) => (
    <tr key={label} style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
      <td style={{ padding: `0.55rem ${indent ? "2rem" : "1rem"}`, fontSize: "0.85rem", fontWeight: bold ? 800 : 400, color: bold ? "#EDE8DC" : "rgba(237,232,220,0.75)" }}>{label}</td>
      <td style={{ padding: "0.55rem 1rem", textAlign: "right", fontWeight: bold ? 800 : 400, fontVariantNumeric: "tabular-nums", color: value < 0 ? "#f87171" : value > 0 ? "#EDE8DC" : "rgba(237,232,220,0.3)" }}>
        {value !== 0 ? `${value < 0 ? "(" : ""}\u20B9${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}${value < 0 ? ")" : ""}` : "\u2014"}
      </td>
    </tr>
  );

  return (
    <>
      <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(237,232,220,0.08)" }}>
        <div style={{ fontWeight: 800, fontSize: "1rem" }}>Cash Flow Statement</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>Indirect Method \u2014 Operating, Investing, Financing</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
            <th style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Particulars</th>
            <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Amount (\u20B9)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colSpan={2} style={{ padding: "0.75rem 1rem", fontWeight: 800, background: "rgba(201,168,76,0.06)", color: "#C9A84C", fontSize: "0.82rem" }}>A. Operating Activities</td></tr>
          {cfRow("Net Profit / (Loss)", netProfit, false, true)}
          {cfRow("Adjustments:", 0)}
          {cfRow("Add: Customer Receipts", receipts, true)}
          {cfRow("Less: Vendor Payments", -payments, true)}
          {cfRow("Less: Operating Expenses", -expenses, true)}
          <tr style={{ borderTop: "2px solid rgba(201,168,76,0.25)", background: "rgba(201,168,76,0.05)" }}>
            <td style={{ padding: "0.7rem 1rem", fontWeight: 800 }}>Net Cash from Operations</td>
            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: operatingCF >= 0 ? "#4ade80" : "#f87171" }}>
              {operatingCF < 0 ? "(" : ""}\u20B9{Math.abs(operatingCF).toLocaleString("en-IN", { minimumFractionDigits: 2 })}{operatingCF < 0 ? ")" : ""}
            </td>
          </tr>

          <tr><td colSpan={2} style={{ padding: "0.75rem 1rem", fontWeight: 800, background: "rgba(96,165,250,0.06)", color: "#60a5fa", fontSize: "0.82rem" }}>B. Investing Activities</td></tr>
          <tr style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
            <td style={{ padding: "0.55rem 1rem", fontSize: "0.85rem", color: "rgba(237,232,220,0.4)" }}>Purchase / Sale of Fixed Assets</td>
            <td style={{ padding: "0.55rem 1rem", textAlign: "right", color: "rgba(237,232,220,0.25)" }}>\u2014</td>
          </tr>
          <tr style={{ borderTop: "2px solid rgba(96,165,250,0.2)", background: "rgba(96,165,250,0.04)" }}>
            <td style={{ padding: "0.7rem 1rem", fontWeight: 800 }}>Net Cash from Investing</td>
            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "rgba(237,232,220,0.4)" }}>\u20B90.00</td>
          </tr>

          <tr><td colSpan={2} style={{ padding: "0.75rem 1rem", fontWeight: 800, background: "rgba(74,222,128,0.04)", color: "#4ade80", fontSize: "0.82rem" }}>C. Financing Activities</td></tr>
          <tr style={{ borderTop: "1px solid rgba(237,232,220,0.04)" }}>
            <td style={{ padding: "0.55rem 1rem", fontSize: "0.85rem", color: "rgba(237,232,220,0.4)" }}>Loans raised / repaid, Capital introduced</td>
            <td style={{ padding: "0.55rem 1rem", textAlign: "right", color: "rgba(237,232,220,0.25)" }}>\u2014</td>
          </tr>
          <tr style={{ borderTop: "2px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.04)" }}>
            <td style={{ padding: "0.7rem 1rem", fontWeight: 800 }}>Net Cash from Financing</td>
            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "rgba(237,232,220,0.4)" }}>\u20B90.00</td>
          </tr>

          <tr style={{ borderTop: "3px solid rgba(201,168,76,0.4)", background: "rgba(201,168,76,0.08)" }}>
            <td style={{ padding: "0.9rem 1rem", fontWeight: 900, fontSize: "0.95rem", color: "#C9A84C" }}>Net Increase / (Decrease) in Cash</td>
            <td style={{ padding: "0.9rem 1rem", textAlign: "right", fontWeight: 900, fontSize: "0.95rem", fontVariantNumeric: "tabular-nums", color: netCF >= 0 ? "#4ade80" : "#f87171" }}>
              {netCF < 0 ? "(" : ""}\u20B9{Math.abs(netCF).toLocaleString("en-IN", { minimumFractionDigits: 2 })}{netCF < 0 ? ")" : ""}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ padding: "0.75rem 1rem", fontSize: "0.72rem", color: "rgba(237,232,220,0.25)", borderTop: "1px solid rgba(237,232,220,0.05)" }}>
        Note: Cash flow uses journal type classification. Investing and financing activities will populate as you record fixed asset purchases, loans, and capital entries.
      </div>
    </>
  );
}
