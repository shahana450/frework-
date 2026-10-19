"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { signedMoney, type PresentedBS, type PresentedPL, type StmtSection } from "@/lib/statements";
import { plExportRows, bsExportRows, exportFileName, type ExportMeta } from "@/lib/statementExport";
import { readActiveBusiness } from "@/lib/activeBusiness";

// Excel export of the presented statement — the same lines and signs as the screen (and as Print → PDF)
async function downloadStatementExcel(kind: "pl" | "bs", presented: PresentedPL | PresentedBS, meta: ExportMeta) {
  const XLSX = await import("xlsx");
  const rows = kind === "pl" ? plExportRows(presented as PresentedPL, meta) : bsExportRows(presented as PresentedBS, meta);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 52 }, { wch: 18 }];
  for (let r = 0; r < rows.length; r++) { const c = ws[XLSX.utils.encode_cell({ r, c: 1 })]; if (c && typeof c.v === "number") c.z = "#,##,##0.00;-#,##,##0.00"; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, kind === "pl" ? "Profit & Loss" : "Balance Sheet");
  XLSX.writeFile(wb, exportFileName(kind === "pl" ? "Profit-and-Loss" : "Balance-Sheet", meta));
}

type ReportTab = "trial_balance" | "profit_loss" | "balance_sheet" | "cash_flow";
type AccRow = { id?: string; code?: string; name: string; type: string; sub_type: string | null; dr: number; cr: number; opening?: number; period_dr?: number; period_cr?: number };

// Ledger drill-down for a line, in the report's period (built-in lines like brought-forward profit have no ledger)
let PERIOD = { from: "", to: "" };
const ledgerHref = (id?: string) => id && !id.startsWith("__") ? `/finance/ledger?account=${id}${PERIOD.from ? `&from=${PERIOD.from}&to=${PERIOD.to}` : ""}` : null;
function Drill({ id, children, style }: { id?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const href = ledgerHref(id);
  return href ? <Link href={href} className="rp-drill" title="Open ledger" style={{ color: "inherit", textDecoration: "none", ...style }}>{children}</Link> : <span style={style}>{children}</span>;
}

type PLData = {
  direct_income: AccRow[]; indirect_income: AccRow[];
  direct_expense: AccRow[]; indirect_expense: AccRow[];
  gross_profit: number; total_income: number; total_expense: number; net_profit: number;
  presented?: PresentedPL;
};

type BSData = {
  current_assets: AccRow[]; fixed_assets: AccRow[];
  current_liabilities: AccRow[]; long_term_liabilities: AccRow[];
  equity: AccRow[]; net_profit: number;
  total_assets: number; total_liabilities_equity: number;
  presented?: PresentedBS;
};

type TBData = { accounts: AccRow[]; total_dr: number; total_cr: number };

const fmt = (n: number) => Math.abs(n).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });
const sign = (n: number) => n < 0 ? "-" : "";

function SectionTable({ title, rows, drLabel = "Debit", crLabel = "Credit", netLabel, netValue, netColor }: {
  title: string; rows: AccRow[]; drLabel?: string; crLabel?: string;
  netLabel?: string; netValue?: number; netColor?: string;
}) {
  const total = rows.reduce((s, r) => s + (r.dr - r.cr), 0);
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "0.5rem 1rem", background: "#FFFFFF" }}>{title}</div>
      {rows.map(r => (
        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderTop: "1px solid rgba(20,26,58,0.08)", fontSize: "0.85rem" }}>
          <Drill id={r.id} style={{ color: "rgba(20,26,58,0.95)" }}>{r.name}</Drill>
          <Drill id={r.id} style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(/Assets|Expenses|Cost/i.test(title) ? r.dr - r.cr : r.cr - r.dr)}</Drill>
        </div>
      ))}
      {netLabel && netValue !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 1rem", borderTop: "2px solid rgba(20,26,58,0.17)", fontWeight: 700, color: netColor ?? "#232A63" }}>
          <span>{netLabel}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{cur()}{fmt(Math.abs(netValue))}</span>
        </div>
      )}
    </div>
  );
}

// Signed lines exactly as presented by the server; the total is the sum of what is shown
function Section({ s }: { s: StmtSection }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "0.5rem 1rem", background: "#FFFFFF" }}>{s.title}</div>
      {s.lines.map(l => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "0.5rem 1rem", borderTop: "1px solid rgba(20,26,58,0.08)", fontSize: "0.85rem" }}>
          <Drill id={l.id} style={{ color: "rgba(20,26,58,0.95)" }}>{l.name}{l.note && <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#8A5A00" }}>({l.note})</span>}</Drill>
          <Drill id={l.id} style={{ fontVariantNumeric: "tabular-nums", color: l.amount < 0 ? "#C2321F" : undefined }}>{signedMoney(l.amount)}</Drill>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 1rem", borderTop: "1px solid rgba(20,26,58,0.15)", fontSize: "0.82rem", fontWeight: 700 }}>
        <span>Total {s.title}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(s.total)}</span>
      </div>
    </div>
  );
}
function FootingBanner({ problems }: { problems: string[] }) {
  if (!problems.length) return null;
  return <div role="alert" style={{ margin: "0.75rem 1rem", padding: "0.75rem 1rem", borderRadius: 10, background: "#FDECEA", color: "#C2321F", fontSize: "0.85rem", fontWeight: 600 }}>⚠ This statement doesn't add up — {problems.join("; ")}. Please report this; don't rely on these figures.</div>;
}

export default function ReportsPage() {
  const router = useRouter();
  const [tab, setTabState] = useState<ReportTab>("profit_loss");
  const searchParams = useSearchParams();
  // The URL is the source of truth: links (?tab=) switch the view, and clicking a tab updates the URL
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "trial_balance" || t === "profit_loss" || t === "balance_sheet" || t === "cash_flow") setTabState(t);
  }, [searchParams]);
  const setTab = (t: ReportTab) => { setTabState(t); router.replace(`/finance/reports?tab=${t}`, { scroll: false }); };
  const [loading, setLoading] = useState(false);
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string; start_date: string; end_date: string }[]>([]);
  const period = financialYears.find(f => f.id === fyId);
  const [plData, setPlData] = useState<PLData | null>(null);
  const [bsData, setBsData] = useState<BSData | null>(null);
  const [tbData, setTbData] = useState<TBData | null>(null);
  const [error, setError] = useState("");
  const [bizName, setBizName] = useState("");
  const [tbDetail, setTbDetail] = useState(false);   // TB: opening balance + this period's debits/credits + closing
  PERIOD = period ? { from: period.start_date, to: period.end_date } : { from: "", to: "" };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      supabase.from("fw_fin_businesses").select("name").eq("id", saved).maybeSingle().then(({ data }) => { if (data?.name) setBizName(data.name); });
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,label,is_current,start_date,end_date").eq("business_id", saved).order("start_date", { ascending: false });
      const list = (fys ?? []).map(f => ({ id: f.id, label: f.label, start_date: f.start_date, end_date: f.end_date }));
      // Make sure the year that contains today is always available, even if it isn't set up yet
      const today = new Date().toISOString().slice(0, 10);
      if (!list.some(f => f.start_date <= today && f.end_date >= today)) {
        const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
        list.unshift({ id: `auto-${y}`, label: `${y}-${String(y + 1).slice(2)}`, start_date: `${y}-04-01`, end_date: `${y + 1}-03-31` });
      }
      setFinancialYears(list);
      const containing = list.find(f => f.start_date <= today && f.end_date >= today);
      setFyId((containing ?? list[0]).id);
    });
  }, []);

  useEffect(() => {
    if (bizId && fyId) fetchReport(tab, bizId, fyId);
  }, [tab, bizId, fyId]);

  async function fetchReport(r: ReportTab, bid: string, fy: string) {
    setLoading(true); setError("");
    try {
      // Cash flow is derived from the P&L plus cash movements, so it loads the P&L first
      if (r === "cash_flow") { setLoading(false); return; }   // the cash flow card loads itself
      const report = r;
      const p = financialYears.find(f => f.id === fy);
      const range = p ? `&from=${p.start_date}&to=${p.end_date}` : "";
      const res = await fetch(`/api/finance/reports?business_id=${bid}${fy.startsWith("auto-") ? "" : `&fy_id=${fy}`}${range}&report=${report}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "We couldn't load this report right now.");
      if (report === "profit_loss") setPlData(json);
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
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`.rp-drill{cursor:pointer}.rp-drill:hover{color:#232A63 !important;text-decoration:underline !important}`}</style>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Reports</span>
        <div style={{ flex: 1 }} />
        {financialYears.length > 0 && (
          <select value={fyId ?? ""} onChange={e => setFyId(e.target.value)}
            style={{ background: "rgba(35,42,99,0.1)", border: "1px solid rgba(35,42,99,0.3)", color: "#141A3A", padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>
            {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
          </select>
        )}
        {((tab === "profit_loss" && plData?.presented) || (tab === "balance_sheet" && bsData?.presented)) && (
          <button onClick={() => downloadStatementExcel(tab === "profit_loss" ? "pl" : "bs", (tab === "profit_loss" ? plData!.presented : bsData!.presented)!, { business: bizName || "Business", period: period ? `FY ${period.label} (${period.start_date} to ${period.end_date})` : "" })}
            style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "#141A3A", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
            ⬇ Excel
          </button>
        )}
        <button onClick={() => window.print()} title="Print, or choose 'Save as PDF' — the printout is the presented statement shown on screen" style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "#141A3A", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
          🖨 Print / PDF
        </button>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        {/* Tab row */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", borderBottom: "1px solid rgba(20,26,58,0.11)", paddingBottom: "0" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: "none", border: "none", color: tab === t.key ? "#232A63" : "rgba(20,26,58,0.70)",
              padding: "0.6rem 1rem", cursor: "pointer", fontWeight: tab === t.key ? 700 : 400, fontSize: "0.9rem",
              borderBottom: tab === t.key ? "2px solid #232A63" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>

        {error && <div style={{ color: "#C2321F", background: "rgba(194,50,31,0.08)", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "rgba(20,26,58,0.55)" }}>Calculating…</div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.11)", borderRadius: 12, overflow: "hidden" }}>
            {/* Profit & Loss */}
            {tab === "profit_loss" && plData && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.11)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Profit & Loss Statement</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.65)", marginTop: "0.2rem" }}>For the period — Financial Year {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                {plData.presented && <FootingBanner problems={plData.presented.problems} />}
                {plData.presented ? <><Section s={plData.presented.sections[0]} /><Section s={plData.presented.sections[1]} /></> : <><SectionTable title="Revenue / Sales" rows={plData.direct_income} /><SectionTable title="Direct Expenses (Cost of Goods Sold)" rows={plData.direct_expense} /></>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(35,42,99,0.06)", fontWeight: 800, fontSize: "0.95rem" }}>
                  <span>Gross Profit</span>
                  <span style={{ color: plData.gross_profit >= 0 ? "#0B7A55" : "#C2321F", fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(plData.gross_profit)}
                  </span>
                </div>
                {plData.presented ? <><Section s={plData.presented.sections[2]} /><Section s={plData.presented.sections[3]} /></> : <><SectionTable title="Other Income" rows={plData.indirect_income} /><SectionTable title="Operating Expenses" rows={plData.indirect_expense} /></>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "1rem 1.5rem", background: "rgba(35,42,99,0.1)", fontWeight: 800, fontSize: "1.1rem", borderTop: "2px solid rgba(35,42,99,0.3)" }}>
                  <span>Net {plData.net_profit >= 0 ? "Profit" : "Loss"}</span>
                  <span style={{ color: plData.net_profit >= 0 ? "#0B7A55" : "#C2321F", fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(plData.net_profit)}
                  </span>
                </div>
                {plData.total_income === 0 && plData.total_expense === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(20,26,58,0.55)", fontSize: "0.88rem" }}>
                    No posted entries yet. Upload documents and accept journal entries to see your P&L.
                  </div>
                )}
              </>
            )}

            {/* Balance Sheet */}
            {tab === "balance_sheet" && bsData && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.11)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Balance Sheet</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.65)", marginTop: "0.2rem" }}>As at end of FY {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                {bsData.presented && <FootingBanner problems={bsData.presented.problems} />}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  <div style={{ borderRight: "1px solid rgba(20,26,58,0.11)" }}>
                    <div style={{ padding: "0.6rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#1F5EFF", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(31,94,255,0.05)" }}>Assets</div>
                    {bsData.presented ? bsData.presented.assets.map(s => <Section key={s.key} s={s} />) : <><SectionTable title="Current Assets" rows={bsData.current_assets} /><SectionTable title="Fixed Assets" rows={bsData.fixed_assets} /></>}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(31,94,255,0.08)", fontWeight: 800 }}>
                      <span>Total Assets</span>
                      <span style={{ color: "#1F5EFF", fontVariantNumeric: "tabular-nums" }}>{signedMoney(bsData.presented?.totalAssets ?? bsData.total_assets)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ padding: "0.6rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#C2321F", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(194,50,31,0.05)" }}>Liabilities & Capital</div>
                    {bsData.presented ? bsData.presented.liabilities.map(s => <Section key={s.key} s={s} />) : <><SectionTable title="Current Liabilities" rows={bsData.current_liabilities} /><SectionTable title="Long-term Liabilities" rows={bsData.long_term_liabilities} /><SectionTable title="Capital & Equity" rows={bsData.equity} /></>}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(194,50,31,0.08)", fontWeight: 800 }}>
                      <span>Total Liabilities & Capital</span>
                      <span style={{ color: "#C2321F", fontVariantNumeric: "tabular-nums" }}>{signedMoney(bsData.presented?.totalLiabilities ?? bsData.total_liabilities_equity)}</span>
                    </div>
                  </div>
                </div>
                {bsData.total_assets === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(20,26,58,0.55)", fontSize: "0.88rem" }}>No posted entries yet.</div>
                )}
              </>
            )}

            {/* Trial Balance */}
            {tab === "trial_balance" && tbData && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.11)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1rem" }}>Trial Balance</div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.65)", marginTop: "0.2rem" }}>FY {financialYears.find(f => f.id === fyId)?.label} · click an account to open its ledger</div>
                    </div>
                    <div role="radiogroup" aria-label="Trial balance view" style={{ display: "flex", border: "1px solid rgba(20,26,58,0.15)", borderRadius: 8, overflow: "hidden" }}>
                      {([[false, "Closing balances"], [true, "Opening & transactions"]] as const).map(([v, l]) => (
                        <button key={l} role="radio" aria-checked={tbDetail === v} onClick={() => setTbDetail(v)} style={{ border: "none", padding: "6px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", background: tbDetail === v ? "#232A63" : "#FFFFFF", color: tbDetail === v ? "#FFFFFF" : "rgba(20,26,58,0.75)" }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {tbDetail ? <TBDetail data={tbData} /> : <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#FFFFFF" }}>
                      {["Code", "Account Name", "Debit (" + cur() + ")", "Credit (" + cur() + ")"].map(h => (
                        <th key={h} style={{ padding: "0.6rem 1rem", textAlign: h.includes(cur()) ? "right" : "left", fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbData.accounts.map(a => (
                      <tr key={a.id ?? a.name} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                        <td style={{ padding: "0.55rem 1rem", fontSize: "0.78rem", fontFamily: "monospace", color: "rgba(20,26,58,0.65)" }}>{a.code}</td>
                        <td style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}><Drill id={a.id}>{a.name}</Drill></td>
                        <td style={{ padding: "0.55rem 1rem", textAlign: "right", fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: a.dr > 0 ? "#141A3A" : "rgba(20,26,58,0.35)" }}>
                          {a.dr > 0 ? <Drill id={a.id}>{fmt(a.dr)}</Drill> : "—"}
                        </td>
                        <td style={{ padding: "0.55rem 1rem", textAlign: "right", fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", color: a.cr > 0 ? "#141A3A" : "rgba(20,26,58,0.35)" }}>
                          {a.cr > 0 ? <Drill id={a.id}>{fmt(a.cr)}</Drill> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid rgba(35,42,99,0.3)", background: "rgba(35,42,99,0.06)" }}>
                      <td colSpan={2} style={{ padding: "0.75rem 1rem", fontWeight: 800, fontSize: "0.9rem" }}>Grand Total</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#232A63" }}>{cur()}{fmt(tbData.total_dr)}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#232A63" }}>{cur()}{fmt(tbData.total_cr)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ padding: "0.5rem 1rem", textAlign: "right", fontSize: "0.78rem", color: Math.abs(tbData.total_dr - tbData.total_cr) < 0.01 ? "#0B7A55" : "#C2321F" }}>
                        {Math.abs(tbData.total_dr - tbData.total_cr) < 0.01 ? "✓ Trial Balance is balanced" : `⚠ Difference: ${cur()}${fmt(Math.abs(tbData.total_dr - tbData.total_cr))}`}
                      </td>
                    </tr>
                  </tfoot>
                </table></>}
                {tbData.accounts.length === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(20,26,58,0.55)", fontSize: "0.88rem" }}>No posted entries yet.</div>
                )}
              </>
            )}

            {/* Cash Flow Statement */}
            {tab === "cash_flow" && period && (
              <CashFlowStatement bizId={bizId} from={period.start_date} to={period.end_date} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Trial balance with opening balance, this period's debits and credits, and closing balance (Dr / Cr)
function TBDetail({ data }: { data: TBData }) {
  const drcr = (n: number) => Math.abs(n) < 0.005 ? "—" : <>{fmt(n)} <span style={{ fontSize: "0.68rem", color: "rgba(20,26,58,0.55)" }}>{n > 0 ? "Dr" : "Cr"}</span></>;
  const tot = data.accounts.reduce((t, a) => ({ op: t.op + (a.opening ?? 0), dr: t.dr + (a.period_dr ?? 0), cr: t.cr + (a.period_cr ?? 0), cl: t.cl + (a.dr - a.cr) }), { op: 0, dr: 0, cr: 0, cl: 0 });
  const td: React.CSSProperties = { padding: "0.55rem 0.8rem", textAlign: "right", fontSize: "0.83rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr>{["Account", "Opening", "Debit", "Credit", "Closing"].map(h => <th key={h} style={{ padding: "0.6rem 0.8rem", textAlign: h === "Account" ? "left" : "right", fontSize: "0.7rem", color: "rgba(20,26,58,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.accounts.map(a => (
            <tr key={a.id ?? a.name} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
              <td style={{ padding: "0.55rem 0.8rem", fontSize: "0.85rem" }}><Drill id={a.id}>{a.name}</Drill></td>
              <td style={td}><Drill id={a.id}>{drcr(a.opening ?? 0)}</Drill></td>
              <td style={td}><Drill id={a.id}>{a.period_dr ? fmt(a.period_dr) : "—"}</Drill></td>
              <td style={td}><Drill id={a.id}>{a.period_cr ? fmt(a.period_cr) : "—"}</Drill></td>
              <td style={{ ...td, fontWeight: 700 }}><Drill id={a.id}>{drcr(a.dr - a.cr)}</Drill></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid rgba(35,42,99,0.3)", background: "rgba(35,42,99,0.06)", fontWeight: 800 }}>
            <td style={{ padding: "0.75rem 0.8rem" }}>Total</td>
            <td style={td}>{drcr(tot.op)}</td><td style={td}>{fmt(tot.dr)}</td><td style={td}>{fmt(tot.cr)}</td><td style={td}>{drcr(tot.cl)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

type CF = { opening: number; closing: number; operating: number; investing: number; financing: number; net: number; items: { section: "operating" | "investing" | "financing"; name: string; amount: number }[] };

// Direct-method cash flow from the cash & bank ledgers (computed on the server)
function CashFlowStatement({ bizId, from, to }: { bizId: string | null; from: string; to: string; plData?: PLData }) {
  const [cf, setCf] = useState<CF | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!bizId) return;
    setCf(null); setErr("");
    fetch(`/api/finance/reports?business_id=${bizId}&from=${from}&to=${to}&report=cash_flow`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "We couldn't load your cash flow."); return d; })
      .then(setCf).catch(e => setErr(e instanceof Error ? e.message : "We couldn't load your cash flow."));
  }, [bizId, from, to]);

  if (err) return <div style={{ padding: "2rem", color: "#C2321F" }}>{err}</div>;
  if (!cf) return <div style={{ padding: "3rem", textAlign: "center", color: "rgba(20,26,58,0.55)" }}>Calculating…</div>;

  const money = (n: number) => `${n < 0 ? "−" : ""}${cur()}${fmt(Math.abs(n))}`;
  const row = (label: string, value: number, opts: { indent?: boolean; bold?: boolean; key?: string } = {}) => (
    <tr key={opts.key ?? label} style={{ borderTop: "1px solid rgba(20,26,58,0.08)" }}>
      <td style={{ padding: `0.5rem ${opts.indent ? "2rem" : "1rem"}`, fontSize: "0.85rem", fontWeight: opts.bold ? 800 : 400, color: opts.bold ? "#141A3A" : "rgba(20,26,58,0.97)" }}>{label}</td>
      <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: opts.bold ? 800 : 400, color: value < 0 ? "#C2321F" : value > 0 ? "#141A3A" : "rgba(20,26,58,0.55)" }}>{money(value)}</td>
    </tr>
  );
  const sections: { key: CF["items"][number]["section"]; title: string; total: number }[] = [
    { key: "operating", title: "Operating activities", total: cf.operating },
    { key: "investing", title: "Investing activities", total: cf.investing },
    { key: "financing", title: "Financing activities", total: cf.financing },
  ];
  return (
    <>
      <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.11)" }}>
        <div style={{ fontWeight: 800, fontSize: "1rem" }}>Cash Flow Statement</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.65)", marginTop: "0.2rem" }}>{from} to {to} · direct method, from your cash &amp; bank ledgers</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {row("Opening cash & bank balance", cf.opening, { bold: true })}
          {sections.map(s => (
            <Fragment key={s.key}>
              <tr><td colSpan={2} style={{ padding: "0.7rem 1rem 0.3rem", fontSize: "0.68rem", fontWeight: 700, color: "#232A63", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.title}</td></tr>
              {cf.items.filter(i => i.section === s.key).map(i => row(i.amount >= 0 ? `Received — ${i.name}` : `Paid — ${i.name}`, i.amount, { indent: true, key: `${s.key}-${i.name}` }))}
              {row(`Net cash from ${s.title.toLowerCase()}`, s.total, { bold: true, key: `${s.key}-total` })}
            </Fragment>
          ))}
          {row("Net change in cash", cf.net, { bold: true })}
          {row("Closing cash & bank balance", cf.closing, { bold: true })}
        </tbody>
      </table>
      {cf.items.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "rgba(20,26,58,0.55)", fontSize: "0.88rem" }}>No cash or bank movements in this period.</div>}
    </>
  );
}