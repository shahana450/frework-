"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { signedMoney, type PresentedBS, type PresentedPL, type StmtSection } from "@/lib/statements";
import { plExportRows, bsExportRows, type ExportMeta, type Cell } from "@/lib/statementExport";
import { bsS3Rows, plS3Rows, notesRows, tbRows, cfRows, allStatementsFileName, type CFExport } from "@/lib/s3Export";
import { readActiveBusiness } from "@/lib/activeBusiness";
import type { Schedule3BS, Schedule3PL, S3Head } from "@/lib/schedule3";

// Excel: every statement in one workbook, the same lines and signs as the screen (and as Print → PDF)
async function downloadAllStatements({ tb, pl, bs, cf, meta }: { tb: TBData; pl: PLData; bs: BSData; cf: CFExport | null; meta: ExportMeta }) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Cell[][], widths: number[], moneyFrom: number, noteCol = -1) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths.map(wch => ({ wch }));
    for (let r = 0; r < rows.length; r++) for (let c = moneyFrom; c < (rows[r]?.length ?? 0); c++) {
      if (c === noteCol) continue;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number") cell.z = "#,##,##0.00;-#,##,##0.00";
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  if (bs.schedule3) add("Balance Sheet", bsS3Rows(bs.schedule3, meta), [58, 8, 20], 2);
  else if (bs.presented) add("Balance Sheet", bsExportRows(bs.presented, meta), [58, 20], 1);
  if (pl.schedule3) add("Profit & Loss", plS3Rows(pl.schedule3, meta), [58, 8, 20], 2);
  else if (pl.presented) add("Profit & Loss", plExportRows(pl.presented, meta), [58, 20], 1);
  if (bs.schedule3 || pl.schedule3) add("Notes", notesRows(bs.schedule3, pl.schedule3, meta), [64, 4, 20], 2);
  add("Trial Balance", tbRows(tb.accounts, meta), [10, 44, 16, 16, 16, 16, 16, 16], 2);
  if (cf) add("Cash Flow", cfRows(cf, meta), [60, 20], 1);
  XLSX.writeFile(wb, allStatementsFileName(meta));
}

type ReportTab = "trial_balance" | "profit_loss" | "balance_sheet" | "cash_flow";
type AccRow = { id?: string; code?: string; name: string; type: string; sub_type: string | null; dr: number; cr: number; opening?: number; period_dr?: number; period_cr?: number };

// Ledger drill-down for a line, in the report's period (built-in lines like brought-forward profit have no ledger)
let PERIOD = { from: "", to: "", tab: "" };
const ledgerHref = (id?: string) => id && !id.startsWith("__") ? `/finance/ledger?account=${id}${PERIOD.from ? `&from=${PERIOD.from}&to=${PERIOD.to}` : ""}${PERIOD.tab ? `&back=${PERIOD.tab}` : ""}` : null;
function Drill({ id, children, style }: { id?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const href = ledgerHref(id);
  return href ? <Link href={href} className="rp-drill" title="Open ledger" style={{ color: "inherit", textDecoration: "none", ...style }}>{children}</Link> : <span style={style}>{children}</span>;
}

type PLData = {
  direct_income: AccRow[]; indirect_income: AccRow[];
  direct_expense: AccRow[]; indirect_expense: AccRow[];
  gross_profit: number; total_income: number; total_expense: number; net_profit: number;
  presented?: PresentedPL;
  schedule3?: Schedule3PL;
};

type BSData = {
  current_assets: AccRow[]; fixed_assets: AccRow[];
  current_liabilities: AccRow[]; long_term_liabilities: AccRow[];
  equity: AccRow[]; net_profit: number;
  total_assets: number; total_liabilities_equity: number;
  presented?: PresentedBS;
  schedule3?: Schedule3BS;
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
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<ReportTab>(() => { const t = searchParams.get("tab"); return t === "trial_balance" || t === "balance_sheet" || t === "cash_flow" ? t : "profit_loss"; });
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
  const [tbDetail, setTbDetail] = useState(false);
  const [xlBusy, setXlBusy] = useState(false);   // TB: opening balance + this period's debits/credits + closing
  PERIOD = period ? { from: period.start_date, to: period.end_date, tab } : { from: "", to: "", tab };

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

  // TB, P&L and Balance Sheet come from one load per year; switching tabs is instant
  const [loadedFy, setLoadedFy] = useState("");
  useEffect(() => {
    if (bizId && fyId && tab !== "cash_flow" && loadedFy !== fyId) fetchAll(bizId, fyId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, bizId, fyId]);

  async function fetchAll(bid: string, fy: string) {
    setLoading(true); setError("");
    try {
      const p = financialYears.find(f => f.id === fy);
      const range = p ? `&from=${p.start_date}&to=${p.end_date}` : "";
      const res = await fetch(`/api/finance/reports?business_id=${bid}${fy.startsWith("auto-") ? "" : `&fy_id=${fy}`}${range}&report=all`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "We couldn't load this report right now.");
      setTbData(json.trial_balance); setPlData(json.profit_loss); setBsData(json.balance_sheet); setLoadedFy(fy);
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
        {tbData && plData && bsData && (
          <button disabled={xlBusy} title="One workbook: Balance Sheet, P&L, Notes, Trial Balance and Cash Flow"
            onClick={async () => {
              setXlBusy(true);
              try {
                const meta = { business: bizName || "Business", period: period ? `FY ${period.label} (${period.start_date} to ${period.end_date})` : "" };
                const cf = period && bizId ? await fetch(`/api/finance/reports?business_id=${bizId}&from=${period.start_date}&to=${period.end_date}&report=cash_flow`).then(r => r.ok ? r.json() : null).catch(() => null) : null;
                await downloadAllStatements({ tb: tbData, pl: plData, bs: bsData, cf, meta });
              } finally { setXlBusy(false); }
            }}
            style={{ background: "#0B7A55", border: "none", color: "#FFFFFF", padding: "6px 14px", borderRadius: 6, cursor: xlBusy ? "wait" : "pointer", fontSize: "0.8rem", fontWeight: 700 }}>
            {xlBusy ? "Preparing…" : "⬇ Excel — all statements"}
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
            {tab === "profit_loss" && plData?.schedule3 && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(20,26,58,0.11)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Statement of Profit and Loss</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(20,26,58,0.65)", marginTop: "0.2rem" }}>For the year — FY {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                {plData.presented && <FootingBanner problems={plData.presented.problems} />}
                <Schedule3PLView s={plData.schedule3} />
              </>
            )}
            {tab === "profit_loss" && plData && !plData.schedule3 && (
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
                {bsData.schedule3 ? <Schedule3View s={bsData.schedule3} netProfit={bsData.net_profit} /> : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
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
                </div>}
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

const S3CSS = `
        .s3-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid rgba(20,26,58,0.08);font-size:12.5px;color:rgba(20,26,58,0.62)}
        .s3-bar button{border:1px solid rgba(35,42,99,0.22);background:#FFFFFF;color:#232A63;font-weight:700;font-size:12.5px;padding:6px 12px;border-radius:8px;cursor:pointer}
        .s3 table{width:100%;border-collapse:collapse}
        .s3 th{padding:10px 20px;text-align:left;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:rgba(20,26,58,0.6);font-weight:700;border-bottom:1px solid rgba(20,26,58,0.12);background:#FAFBFD}
        .s3 th:nth-child(2){text-align:center;width:70px}.s3 th:nth-child(3){text-align:right;width:190px}
        .s3 td{padding:9px 20px;font-size:14px}
        .s3-num{text-align:right;white-space:nowrap}
        .s3-part td{padding:18px 20px 8px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#232A63}
        .s3-roman{display:inline-block;min-width:26px;color:#8A93C8}
        .s3-block td{font-weight:700;color:#141A3A;padding-left:46px;background:#F7F8FC;border-top:1px solid rgba(20,26,58,0.06)}
        .s3-sub{color:rgba(20,26,58,0.6)}
        .s3-head{cursor:pointer;border-top:1px solid rgba(20,26,58,0.06)}
        .s3-head td:first-child{padding-left:66px}
        .s3-head:hover,.s3-head.on{background:#EEF0FA}
        .s3-caret{display:inline-block;width:16px;margin-left:-18px;color:#8A93C8;font-size:11px}
        .s3-note{text-align:center;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12.5px;color:#232A63}
        .s3-line td{font-size:13px;padding-top:6px;padding-bottom:6px;background:#FCFCFE;color:rgba(20,26,58,0.85)}
        .s3-line td:first-child{padding-left:90px}
        .s3-flag{margin-left:8px;font-size:11px;color:#8A5A00;background:#FFF4DB;padding:1px 6px;border-radius:5px}
        .s3-total td{font-weight:800;border-top:2px solid #232A63;border-bottom:3px double #232A63;background:#EEF0FA;padding-top:12px;padding-bottom:12px}
        @media(max-width:640px){.s3 td{padding-left:12px;padding-right:12px}.s3-block td{padding-left:20px}.s3-head td:first-child{padding-left:34px}.s3-line td:first-child{padding-left:48px}.s3 th:nth-child(3){width:auto}}
        @media print{.s3-bar{display:none}}
`;

// One expandable note row: head with note number, then (when open) its ledgers, each opening the ledger
function S3HeadRows({ h, prefix, open, toggle, amt }: { h: S3Head; prefix: string; open: boolean; toggle: () => void; amt: (n: number, strong?: boolean) => React.ReactNode }) {
  return (
    <>
      <tr className={"s3-head" + (open ? " on" : "")} onClick={toggle} title="Show the ledgers in this note">
        <td><span className="s3-caret">{open ? "▾" : "▸"}</span>{prefix}{h.label}</td>
        <td className="s3-note">{h.note}</td>
        <td className="s3-num">{amt(h.total)}</td>
      </tr>
      {open && h.lines.map(l => (
        <tr key={l.id} className="s3-line">
          <td><Drill id={l.id}>{l.name}</Drill>{l.note && <span className="s3-flag">{l.note}</span>}</td>
          <td />
          <td className="s3-num"><Drill id={l.id}>{amt(l.amount)}</Drill></td>
        </tr>
      ))}
    </>
  );
}

// Statement of Profit and Loss in Schedule III format
function Schedule3PLView({ s }: { s: Schedule3PL }) {
  const heads = [s.revenue, s.otherIncome, ...s.expenses, s.tax].filter((x): x is S3Head => !!x);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setOpen(o => { const x = new Set(o); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const amt = (n: number, strong = false) => <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 800 : 600, color: n < 0 ? "#C2321F" : "#141A3A" }}>{signedMoney(n)}</span>;
  const head = (h: S3Head | null, prefix: string) => h ? <S3HeadRows key={h.key} h={h} prefix={prefix} open={open.has(h.note)} toggle={() => toggle(h.note)} amt={amt} /> : null;
  const sumRow = (roman: string, label: string, n: number, cls = "s3-block") => <tr className={cls}><td><span className="s3-roman">{roman}</span>{label}</td><td /><td className="s3-num">{amt(n, cls === "s3-total")}</td></tr>;
  return (
    <div className="s3">
      <style>{S3CSS}</style>
      <div className="s3-bar">
        <span>Schedule III format · click a line to see its ledgers, click a ledger to open it</span>
        <button onClick={() => setOpen(open.size ? new Set() : new Set(heads.map(h => h.note)))}>{open.size ? "Collapse notes" : "Expand all notes"}</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Particulars</th><th>Note</th><th>Amount ({cur()})</th></tr></thead>
          <tbody>
            {head(s.revenue, "I. ")}
            {head(s.otherIncome, "II. ")}
            {sumRow("III", "Total income (I + II)", s.totalIncome)}
            <tr className="s3-part"><td colSpan={3}><span className="s3-roman">IV</span>Expenses</td></tr>
            {s.expenses.map((h, i) => head(h, `(${String.fromCharCode(97 + i)}) `))}
            {sumRow("", "Total expenses (IV)", s.totalExpenses)}
            {sumRow("V", `${s.pbt >= 0 ? "Profit" : "Loss"} before tax (III − IV)`, s.pbt)}
            {s.tax && <><tr className="s3-part"><td colSpan={3}><span className="s3-roman">VI</span>Tax expense</td></tr>{head(s.tax, "")}</>}
            {sumRow(s.tax ? "VII" : "VI", `${s.profit >= 0 ? "Profit" : "Loss"} for the year`, s.profit, "s3-total")}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Balance Sheet in Schedule III vertical format: blocks → note-numbered heads → (expand) ledgers
const ROMAN = ["I", "II"];
function Schedule3View({ s, netProfit }: { s: Schedule3BS; netProfit: number }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const allNotes = [...s.equityLiabilities, ...s.assets].flatMap(b => b.heads.map(h => h.note));
  const toggle = (n: number) => setOpen(o => { const x = new Set(o); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const amt = (n: number, strong = false) => <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 800 : 600, color: n < 0 ? "#C2321F" : "#141A3A" }}>{signedMoney(n)}</span>;
  const part = (title: string, blocks: Schedule3BS["assets"], total: number, i: number) => (
    <Fragment key={title}>
      <tr className="s3-part"><td colSpan={3}><span className="s3-roman">{ROMAN[i]}</span>{title}</td></tr>
      {blocks.map((b, bi) => (
        <Fragment key={b.key}>
          <tr className="s3-block"><td>({bi + 1}) {b.label}</td><td /><td className="s3-num s3-sub">{amt(b.total)}</td></tr>
          {b.heads.map((h, hi) => (
            <Fragment key={h.key}>
              <tr className={"s3-head" + (open.has(h.note) ? " on" : "")} onClick={() => toggle(h.note)} title="Show the ledgers in this note">
                <td><span className="s3-caret">{open.has(h.note) ? "▾" : "▸"}</span>({String.fromCharCode(97 + hi)}) {h.label}</td>
                <td className="s3-note">{h.note}</td>
                <td className="s3-num">{amt(h.total)}</td>
              </tr>
              {open.has(h.note) && h.lines.map(l => (
                <tr key={l.id} className="s3-line">
                  <td><Drill id={l.id}>{l.name}</Drill>{l.note && <span className="s3-flag">{l.note}</span>}</td>
                  <td />
                  <td className="s3-num"><Drill id={l.id}>{amt(l.amount)}</Drill></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </Fragment>
      ))}
      <tr className="s3-total"><td>Total</td><td /><td className="s3-num">{amt(total, true)}</td></tr>
    </Fragment>
  );
  return (
    <div className="s3">
      <style>{S3CSS}</style>
      <div className="s3-bar">
        <span>Schedule III format · click a line to see its ledgers, click a ledger to open it</span>
        <button onClick={() => setOpen(open.size ? new Set() : new Set(allNotes))}>{open.size ? "Collapse notes" : "Expand all notes"}</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Particulars</th><th>Note</th><th>Amount ({cur()})</th></tr></thead>
          <tbody>
            {part("Equity and liabilities", s.equityLiabilities, s.totalEL, 0)}
            {part("Assets", s.assets, s.totalAssets, 1)}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 20px 0", fontSize: 12, color: "rgba(20,26,58,0.6)" }}>Reserves and surplus include the {netProfit >= 0 ? "profit" : "loss"} for the year of {signedMoney(netProfit)}.{Math.abs(s.totalEL - s.totalAssets) < 0.01 ? " ✓ Balanced." : ""}</div>
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