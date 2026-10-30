"use client";
import { readSelectedFy, writeSelectedFy } from "@/lib/selectedFy";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { signedMoney, type PresentedBS, type PresentedPL, type StmtSection } from "@/lib/statements";
import { plExportRows, bsExportRows, type ExportMeta, type Cell } from "@/lib/statementExport";
import { bsS3Rows, plS3Rows, notesRows, tbRows, cfRows, allStatementsFileName, type CFExport } from "@/lib/s3Export";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { writeStyledWorkbook, type SheetSpec } from "@/lib/styledWorkbook";
import type { Schedule3BS, Schedule3PL, S3Head } from "@/lib/schedule3";

// Excel: every statement in one workbook, the same lines and signs as the screen (and as Print → PDF)
async function downloadAllStatements({ tb, pl, bs, cf, meta }: { tb: TBData; pl: PLData; bs: BSData; cf: CFExport | null; meta: ExportMeta }) {
  const sheets: SheetSpec[] = [];
  const add = (name: string, rows: Cell[][], widths: number[], moneyFrom: number, noteCol?: number) => sheets.push({ name, rows, widths, moneyFrom, noteCol });
  if (bs.schedule3) add("Balance Sheet", bsS3Rows(bs.schedule3, meta), [62, 9, 22], 2, 1);
  else if (bs.presented) add("Balance Sheet", bsExportRows(bs.presented, meta), [62, 22], 1);
  if (pl.schedule3) add("Profit & Loss", plS3Rows(pl.schedule3, meta), [62, 9, 22], 2, 1);
  else if (pl.presented) add("Profit & Loss", plExportRows(pl.presented, meta), [62, 22], 1);
  if (bs.schedule3 || pl.schedule3) add("Notes", notesRows(bs.schedule3, pl.schedule3, meta), [66, 4, 22], 2);
  add("Trial Balance", tbRows(tb.accounts, meta), [10, 42, 16, 16, 16, 16, 16, 16], 2);
  if (cf) add("Cash Flow", cfRows(cf, meta), [62, 22], 1);
  await writeStyledWorkbook(sheets, allStatementsFileName(meta), `Prepared with FreBook · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`);
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
      <div style={{ fontSize: "0.72rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "0.5rem 1rem", background: "#FFFDF8" }}>{title}</div>
      {rows.map(r => (
        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", borderTop: "1px solid rgba(16,36,31,0.08)", fontSize: "0.85rem" }}>
          <Drill id={r.id} style={{ color: "rgba(16,36,31,0.95)" }}>{r.name}</Drill>
          <Drill id={r.id} style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(/Assets|Expenses|Cost/i.test(title) ? r.dr - r.cr : r.cr - r.dr)}</Drill>
        </div>
      ))}
      {netLabel && netValue !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 1rem", borderTop: "2px solid rgba(16,36,31,0.17)", fontWeight: 700, color: netColor ?? "#12352D" }}>
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
      <div style={{ fontSize: "0.72rem", color: "rgba(16,36,31,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "0.5rem 1rem", background: "#FFFDF8" }}>{s.title}</div>
      {s.lines.map(l => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "0.5rem 1rem", borderTop: "1px solid rgba(16,36,31,0.08)", fontSize: "0.85rem" }}>
          <Drill id={l.id} style={{ color: "rgba(16,36,31,0.95)" }}>{l.name}{l.note && <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#9A6B22" }}>({l.note})</span>}</Drill>
          <Drill id={l.id} style={{ fontVariantNumeric: "tabular-nums", color: l.amount < 0 ? "#B4321F" : undefined }}>{signedMoney(l.amount)}</Drill>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 1rem", borderTop: "1px solid rgba(16,36,31,0.15)", fontSize: "0.82rem", fontWeight: 700 }}>
        <span>Total {s.title}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(s.total)}</span>
      </div>
    </div>
  );
}
function FootingBanner({ problems }: { problems: string[] }) {
  if (!problems.length) return null;
  return <div role="alert" style={{ margin: "0.75rem 1rem", padding: "0.75rem 1rem", borderRadius: 10, background: "#FDECEA", color: "#B4321F", fontSize: "0.85rem", fontWeight: 600 }}>⚠ This statement doesn't add up — {problems.join("; ")}. Please report this; don't rely on these figures.</div>;
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
      const shared = readSelectedFy(saved);   // the year chosen on any tab
      setFyId((list.find(f => f.id === shared) ?? containing ?? list[0]).id);
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

  const TITLE: Record<ReportTab, string> = { profit_loss: "Statement of Profit and Loss", balance_sheet: "Balance Sheet", trial_balance: "Trial Balance", cash_flow: "Cash Flow Statement" };
  const btn = (dark: boolean): React.CSSProperties => ({ height: 40, padding: "0 18px", borderRadius: 999, border: `1px solid ${dark ? "#12352D" : "#E6DFD0"}`, background: dark ? "#12352D" : "#FFFDF8", color: dark ? "#FFFFFF" : "#10241F", fontFamily: "inherit", fontSize: "0.9rem", cursor: "pointer" });
  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <style>{`.rp-drill{cursor:pointer}.rp-drill:hover{color:#9A6B22 !important;text-decoration:underline !important}@media print{.rp-top{display:none}}`}</style>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 28px" }}>
        <div className="rp-top" style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: "0.74rem", letterSpacing: "0.3em", color: "#9A6B22" }}>REPORTS{period ? ` · FY ${period.label}` : ""}{tab === "profit_loss" || tab === "balance_sheet" ? " · SCHEDULE III" : ""}</div>
            <h1 style={{ margin: "4px 0 0", fontSize: "2.6rem", fontWeight: 400, fontStyle: "italic" }}>{TITLE[tab]}</h1>
          </div>
          <div role="tablist" style={{ display: "inline-flex", gap: 2, padding: 4, borderRadius: 999, background: "#EFE6D3" }}>
            {TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={{ border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: "inherit", fontSize: "0.9rem", cursor: "pointer", background: tab === t.key ? "#12352D" : "transparent", color: tab === t.key ? "#FFFFFF" : "#10241F" }}>{t.key === "profit_loss" ? "P&L" : t.label}</button>
            ))}
          </div>
          {financialYears.length > 0 && (
            <select value={fyId ?? ""} onChange={e => { setFyId(e.target.value); if (bizId) writeSelectedFy(bizId, e.target.value); }} style={{ ...btn(false), paddingRight: 10 }}>
              {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
            </select>
          )}
          {tbData && plData && bsData && (
            <button disabled={xlBusy} title="One workbook: Balance Sheet, P&L, Notes, Trial Balance and Cash Flow" style={{ ...btn(true), cursor: xlBusy ? "wait" : "pointer" }}
              onClick={async () => {
                setXlBusy(true);
                try {
                  const meta = { business: bizName || "Business", period: period ? `FY ${period.label} (${period.start_date} to ${period.end_date})` : "" };
                  const cf = period && bizId ? await fetch(`/api/finance/reports?business_id=${bizId}&from=${period.start_date}&to=${period.end_date}&report=cash_flow`).then(r => r.ok ? r.json() : null).catch(() => null) : null;
                  await downloadAllStatements({ tb: tbData, pl: plData, bs: bsData, cf, meta });
                } finally { setXlBusy(false); }
              }}>{xlBusy ? "Preparing…" : "↓ Excel — all statements"}</button>
          )}
          <button onClick={() => window.print()} title="Print, or choose 'Save as PDF'" style={btn(false)}>Print / PDF</button>
        </div>

        {error && <div style={{ color: "#B4321F", background: "#FBECE8", padding: "1rem", borderRadius: 10, marginBottom: "1rem" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "#6B7570", fontStyle: "italic" }}>Calculating…</div>
        ) : (
          <div style={tab === "balance_sheet" || tab === "cash_flow" || (tab === "profit_loss" && !plData?.schedule3) ? { background: "#FFFDF8", borderTop: "6px solid #12352D", boxShadow: "0 24px 50px -30px rgba(16,36,31,0.45)", maxWidth: tab === "balance_sheet" ? undefined : 900, margin: "0 auto" } : undefined}>
            {/* Profit & Loss */}
            {tab === "profit_loss" && plData?.schedule3 && (
              <>
                {plData.presented && <FootingBanner problems={plData.presented.problems} />}
                <Schedule3PLView s={plData.schedule3} />
              </>
            )}
            {tab === "profit_loss" && plData && !plData.schedule3 && (
              <>
                <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(16,36,31,0.11)" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Profit & Loss Statement</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(16,36,31,0.65)", marginTop: "0.2rem" }}>For the period — Financial Year {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                {plData.presented && <FootingBanner problems={plData.presented.problems} />}
                {plData.presented ? <><Section s={plData.presented.sections[0]} /><Section s={plData.presented.sections[1]} /></> : <><SectionTable title="Revenue / Sales" rows={plData.direct_income} /><SectionTable title="Direct Expenses (Cost of Goods Sold)" rows={plData.direct_expense} /></>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(18,53,45,0.06)", fontWeight: 800, fontSize: "0.95rem" }}>
                  <span>Gross Profit</span>
                  <span style={{ color: plData.gross_profit >= 0 ? "#0B7A55" : "#B4321F", fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(plData.gross_profit)}
                  </span>
                </div>
                {plData.presented ? <><Section s={plData.presented.sections[2]} /><Section s={plData.presented.sections[3]} /></> : <><SectionTable title="Other Income" rows={plData.indirect_income} /><SectionTable title="Operating Expenses" rows={plData.indirect_expense} /></>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "1rem 1.5rem", background: "rgba(18,53,45,0.1)", fontWeight: 800, fontSize: "1.1rem", borderTop: "2px solid rgba(18,53,45,0.3)" }}>
                  <span>Net {plData.net_profit >= 0 ? "Profit" : "Loss"}</span>
                  <span style={{ color: plData.net_profit >= 0 ? "#0B7A55" : "#B4321F", fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(plData.net_profit)}
                  </span>
                </div>
                {plData.total_income === 0 && plData.total_expense === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(16,36,31,0.55)", fontSize: "0.88rem" }}>
                    No posted entries yet. Upload documents and accept journal entries to see your P&L.
                  </div>
                )}
              </>
            )}

            {/* Balance Sheet */}
            {tab === "balance_sheet" && bsData && (
              <>
                <div style={{ padding: "36px 24px 22px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.74rem", letterSpacing: "0.3em", color: "#9A6B22" }}>BALANCE SHEET</div>
                  <div style={{ fontSize: "2rem", fontStyle: "italic", marginTop: 4 }}>As at end of FY {financialYears.find(f => f.id === fyId)?.label}</div>
                </div>
                {bsData.presented && <FootingBanner problems={bsData.presented.problems} />}
                {bsData.schedule3 ? <Schedule3View s={bsData.schedule3} netProfit={bsData.net_profit} /> : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  <div style={{ borderRight: "1px solid rgba(16,36,31,0.11)" }}>
                    <div style={{ padding: "0.6rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#12352D", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(18,53,45,0.05)" }}>Assets</div>
                    {bsData.presented ? bsData.presented.assets.map(s => <Section key={s.key} s={s} />) : <><SectionTable title="Current Assets" rows={bsData.current_assets} /><SectionTable title="Fixed Assets" rows={bsData.fixed_assets} /></>}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(18,53,45,0.08)", fontWeight: 800 }}>
                      <span>Total Assets</span>
                      <span style={{ color: "#12352D", fontVariantNumeric: "tabular-nums" }}>{signedMoney(bsData.presented?.totalAssets ?? bsData.total_assets)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ padding: "0.6rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "#B4321F", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(194,50,31,0.05)" }}>Liabilities & Capital</div>
                    {bsData.presented ? bsData.presented.liabilities.map(s => <Section key={s.key} s={s} />) : <><SectionTable title="Current Liabilities" rows={bsData.current_liabilities} /><SectionTable title="Long-term Liabilities" rows={bsData.long_term_liabilities} /><SectionTable title="Capital & Equity" rows={bsData.equity} /></>}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(194,50,31,0.08)", fontWeight: 800 }}>
                      <span>Total Liabilities & Capital</span>
                      <span style={{ color: "#B4321F", fontVariantNumeric: "tabular-nums" }}>{signedMoney(bsData.presented?.totalLiabilities ?? bsData.total_liabilities_equity)}</span>
                    </div>
                  </div>
                </div>}
                {bsData.total_assets === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(16,36,31,0.55)", fontSize: "0.88rem" }}>No posted entries yet.</div>
                )}
              </>
            )}

            {/* Trial Balance */}
            {tab === "trial_balance" && tbData && (
              <>
                <div role="radiogroup" aria-label="Trial balance view" style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 14, fontSize: "0.92rem" }}>
                  {([[false, "Closing balances"], [true, "Opening & transactions"]] as const).map(([v, l]) => (
                    <label key={l} style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}><input type="radio" checked={tbDetail === v} onChange={() => setTbDetail(v)} style={{ accentColor: "#12352D" }} />{l}</label>
                  ))}
                </div>
                {tbDetail ? <TBDetail data={tbData} /> : <TBGrouped data={tbData} />}
                {tbData.accounts.length === 0 && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "rgba(16,36,31,0.55)", fontSize: "0.88rem" }}>No posted entries yet.</div>
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
        .s3-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;font-size:13px;font-style:italic;color:#6B7570}
        .s3-bar button{border:1px solid #E6DFD0;background:#FFFDF8;color:#10241F;font-family:inherit;font-size:13px;padding:7px 16px;border-radius:999px;cursor:pointer}
        .s3 table{width:100%;border-collapse:collapse}
        .s3 th{padding:12px 20px;text-align:left;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6B7570;font-weight:400;border-bottom:1px solid #9AA3A0;background:#FFFDF8}
        .s3 th:nth-child(2){text-align:center;width:80px}.s3 th:nth-child(3){text-align:right;width:190px}
        .s3 td{padding:11px 20px;font-size:14.5px;border-top:1px solid #EFE8DA}
        .s3-num{text-align:right;white-space:nowrap}
        .s3-part td{padding:12px 20px;font-weight:700;color:#10241F;background:#F3ECDD}
        .s3-roman{display:inline-block;min-width:50px;color:#9A6B22;font-style:italic;font-weight:400}
        .s3-block td{font-weight:700;color:#10241F;background:#F3ECDD}
        .s3-sub{color:#10241F}
        .s3-head{cursor:pointer;background:#FFFDF8}
        .s3-head td:first-child{padding-left:70px}
        .s3-head:hover,.s3-head.on{background:#F6EFDF}
        .s3-caret{display:none}
        .s3-note{text-align:center}
        .s3-note span{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:999px;border:1px solid #C9A24A;color:#9A6B22;font-size:12px}
        .s3-line td{font-size:13.5px;padding-top:7px;padding-bottom:7px;background:#FCF8EF;color:#3C4A45}
        .s3-line td:first-child{padding-left:94px}
        .s3-flag{margin-left:8px;font-size:11px;color:#9A6B22;background:#FFF4DB;padding:1px 6px;border-radius:5px}
        .s3-total td{font-weight:400;font-size:16px;background:#12352D;color:#FFFFFF;padding-top:14px;padding-bottom:14px}
        .s3-total .s3-roman{color:#C9A24A}
        .s3-total span{color:inherit !important}
        .s3-pl{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:20px;align-items:start}
        .s3-card{background:#FFFDF8;border:1px solid #E6DFD0;border-radius:14px;overflow:hidden}
        .s3-nh{display:flex;justify-content:space-between;gap:10px;padding:12px 18px;background:#F3ECDD}
        .s3-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 18px;font-size:13px;color:#6B7570}
        .s3-chip{padding:5px 12px;border-radius:999px;border:1px solid #E6DFD0;background:#FFFFFF;color:#10241F;text-decoration:none;font-size:13px}
        .s3-chip:hover{border-color:#C9A24A}
        .bs-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #6B7570}
        .bs-col+.bs-col{border-left:1px solid #6B7570}
        .bs-h{display:flex;justify-content:space-between;padding:12px 20px;background:#12352D;color:#FFFFFF}
        .bs-h span:last-child{color:#C9A24A}
        .bs-r{display:flex;justify-content:space-between;gap:12px;padding:11px 20px;border-top:1px solid #EFE8DA;font-size:14.5px}
        .bs-r.blk{background:#F3ECDD;font-weight:700}
        .bs-r.hd{padding-left:36px;cursor:pointer}.bs-r.hd:hover{background:#F6EFDF}
        .bs-r.ln{padding-left:54px;font-size:13.5px;background:#FCF8EF}
        .bs-n{color:#9A6B22;font-size:12px;margin-left:6px}
        .bs-t{display:flex;justify-content:space-between;padding:14px 20px;border-top:1px solid #6B7570;font-weight:700;font-size:16px}
        .bs-t span:last-child{border-bottom:3px double #6B7570}
        @media(max-width:860px){.s3-pl,.bs-grid{grid-template-columns:1fr}.bs-col+.bs-col{border-left:none;border-top:1px solid #6B7570}}
        @media(max-width:640px){.s3 td{padding-left:12px;padding-right:12px}.s3-head td:first-child{padding-left:34px}.s3-line td:first-child{padding-left:48px}.s3 th:nth-child(3){width:auto}}
        @media print{.s3-bar{display:none}}
`;

// One expandable note row: head with note number, then (when open) its ledgers, each opening the ledger
function S3HeadRows({ h, prefix, open, toggle, amt }: { h: S3Head; prefix: string; open: boolean; toggle: () => void; amt: (n: number, strong?: boolean) => React.ReactNode }) {
  return (
    <>
      <tr className={"s3-head" + (open ? " on" : "")} onClick={toggle} title="Show the ledgers in this note">
        <td>{prefix}{h.label}</td>
        <td className="s3-note"><span>{h.note}</span></td>
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

// Statement of Profit and Loss in Schedule III format, with the notes and their ledgers alongside
function Schedule3PLView({ s }: { s: Schedule3PL }) {
  const heads = [s.revenue, s.otherIncome, ...s.expenses, s.tax].filter((x): x is S3Head => !!x);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState(true);
  const toggle = (n: number) => setOpen(o => { const x = new Set(o); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const amt = (n: number, strong = false) => <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 700 : 400, color: n < 0 ? "#B4321F" : "#10241F" }}>{signedMoney(n)}</span>;
  const head = (h: S3Head | null, prefix: string) => h ? <S3HeadRows key={h.key} h={h} prefix={prefix} open={open.has(h.note)} toggle={() => toggle(h.note)} amt={amt} /> : null;
  const sumRow = (roman: string, label: string, n: number, cls = "s3-block") => <tr className={cls}><td><span className="s3-roman">{roman}</span>{label}</td><td /><td className="s3-num">{amt(n, cls !== "s3-total")}</td></tr>;
  return (
    <div className="s3">
      <style>{S3CSS}</style>
      <div className="s3-bar">
        <span>Schedule III · click a line to see its ledgers</span>
        <button onClick={() => setNotes(v => !v)}>{notes ? "Collapse notes" : "Show notes"}</button>
      </div>
      <div className={notes ? "s3-pl" : undefined}>
        <div className="s3-card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th style={{ paddingLeft: 70 }}>Particulars</th><th>Note</th><th>{cur()}</th></tr></thead>
            <tbody>
              {s.revenue && <S3HeadRows h={s.revenue} prefix="" open={open.has(s.revenue.note)} toggle={() => toggle(s.revenue!.note)} amt={amt} />}
              {s.otherIncome && <S3HeadRows h={s.otherIncome} prefix="" open={open.has(s.otherIncome.note)} toggle={() => toggle(s.otherIncome!.note)} amt={amt} />}
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
        {notes && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {heads.map(h => (
              <div key={h.key} className="s3-card">
                <div className="s3-nh"><span><span style={{ color: "#9A6B22" }}>Note {h.note}</span> · {h.label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(h.total)}</span></div>
                <div className="s3-chips">Ledgers:{h.lines.map(l => { const href = ledgerHref(l.id); return href ? <Link key={l.id} href={href} className="s3-chip">{l.name} →</Link> : <span key={l.id} className="s3-chip">{l.name}</span>; })}</div>
              </div>
            ))}
            <div style={{ fontSize: 13, fontStyle: "italic", color: "#6B7570" }}>Click a ledger to open it.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Balance Sheet in Schedule III, side by side: equity & liabilities | assets
function Schedule3View({ s, netProfit }: { s: Schedule3BS; netProfit: number }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setOpen(o => { const x = new Set(o); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const amt = (n: number) => <span style={{ fontVariantNumeric: "tabular-nums", color: n < 0 ? "#B4321F" : undefined }}>{signedMoney(n)}</span>;
  const col = (title: string, blocks: Schedule3BS["assets"], total: number) => (
    <div className="bs-col">
      <div className="bs-h"><span>{title}</span><span>{cur()}</span></div>
      {blocks.map(b => (
        <Fragment key={b.key}>
          <div className="bs-r blk"><span>{b.label}</span>{amt(b.total)}</div>
          {b.heads.map(h => (
            <Fragment key={h.key}>
              <div className="bs-r hd" onClick={() => toggle(h.note)} title="Show the ledgers in this note"><span>{h.label}<span className="bs-n">Note {h.note}</span></span>{amt(h.total)}</div>
              {open.has(h.note) && h.lines.map(l => <div key={l.id} className="bs-r ln"><Drill id={l.id}>{l.name}</Drill><Drill id={l.id}>{amt(l.amount)}</Drill></div>)}
            </Fragment>
          ))}
        </Fragment>
      ))}
      <div style={{ flex: 1 }} />
      <div className="bs-t"><span>Total</span>{amt(total)}</div>
    </div>
  );
  return (
    <div className="s3" style={{ padding: "0 24px 24px" }}>
      <style>{S3CSS}</style>
      <div className="bs-grid">
        <div style={{ display: "flex", flexDirection: "column" }}>{col("Equity & liabilities", s.equityLiabilities, s.totalEL)}</div>
        <div className="bs-col" style={{ display: "flex", flexDirection: "column" }}>{col("Assets", s.assets, s.totalAssets)}</div>
      </div>
      <div style={{ paddingTop: 18, textAlign: "center", fontSize: 13, fontStyle: "italic", color: "#6B7570" }}>Schedule III · click a line to see its ledgers · reserves include the {netProfit >= 0 ? "profit" : "loss"} for the year of {signedMoney(netProfit)}{Math.abs(s.totalEL - s.totalAssets) < 0.01 ? " · ✓ balanced" : ""}</div>
    </div>
  );
}

// Trial balance by group (Assets, Liabilities, Income, Expenses, Equity), each group collapsible
function TBGrouped({ data }: { data: TBData }) {
  const GROUPS: [string, string][] = [["asset", "Assets"], ["liability", "Liabilities"], ["income", "Income"], ["expense", "Expenses"], ["equity", "Equity"]];
  const [shut, setShut] = useState<Set<string>>(new Set());
  const flip = (k: string) => setShut(s => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const known = new Set(GROUPS.map(g => g[0]));
  const groups = [...GROUPS, ["__other", "Other"] as [string, string]].map(([k, l]) => ({ k, l, rows: data.accounts.filter(a => k === "__other" ? !known.has(a.type) : a.type === k) })).filter(g => g.rows.length);
  const cell: React.CSSProperties = { padding: "11px 24px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const v = (n: number) => n > 0.005 ? fmt(n) : "—";
  const diff = Math.abs(data.total_dr - data.total_cr);
  return (
    <div style={{ background: "#FFFDF8", border: "1px solid #E6DFD0", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px 0" }}>
        <button onClick={() => setShut(shut.size ? new Set() : new Set(groups.map(g => g.k)))} style={{ border: "1px solid #E6DFD0", background: "#FFFDF8", borderRadius: 999, padding: "7px 16px", fontFamily: "inherit", cursor: "pointer" }}>{shut.size ? "Expand all groups" : "Collapse all groups"}</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
          <thead><tr style={{ borderBottom: "1px solid #9AA3A0" }}>{["Group / account", `Debit ${cur()}`, `Credit ${cur()}`].map((h, i) => <th key={h} style={{ padding: "14px 24px", textAlign: i ? "right" : "left", fontWeight: 400, fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#4A5651" }}>{h}</th>)}</tr></thead>
          <tbody>
            {groups.map(g => {
              const dr = g.rows.reduce((s, a) => s + a.dr, 0), cr = g.rows.reduce((s, a) => s + a.cr, 0), open = !shut.has(g.k);
              return (
                <Fragment key={g.k}>
                  <tr onClick={() => flip(g.k)} style={{ background: "#F3ECDD", cursor: "pointer", borderTop: "1px solid #E6DFD0" }}>
                    <td style={{ padding: "11px 24px", fontWeight: 700 }}><span style={{ display: "inline-block", width: 16, fontSize: "0.7rem" }}>{open ? "▼" : "▶"}</span>{g.l}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{v(dr)}</td><td style={{ ...cell, fontWeight: 700 }}>{v(cr)}</td>
                  </tr>
                  {open && g.rows.map(a => (
                    <tr key={a.id ?? a.name} style={{ borderTop: "1px solid #EFE8DA" }}>
                      <td style={{ padding: "11px 24px 11px 48px" }}><Drill id={a.id}>{a.name}</Drill>{a.code && <span style={{ marginLeft: 6, fontSize: "0.72rem", color: "#6B7570" }}>{a.code}</span>}</td>
                      <td style={cell}>{a.dr > 0 ? <Drill id={a.id}>{fmt(a.dr)}</Drill> : "—"}</td>
                      <td style={cell}>{a.cr > 0 ? <Drill id={a.id}>{fmt(a.cr)}</Drill> : "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#12352D", color: "#FFFFFF" }}>
              <td style={{ padding: "16px 24px", fontSize: "0.78rem", letterSpacing: "0.22em", color: "#C9A24A" }}>TOTAL</td>
              <td style={{ ...cell, fontSize: "1.05rem" }}>{fmt(data.total_dr)}</td><td style={{ ...cell, fontSize: "1.05rem" }}>{fmt(data.total_cr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {diff >= 0.01 && <div style={{ padding: "10px 24px", color: "#B4321F", background: "#FBECE8" }}>⚠ Difference: {cur()}{fmt(diff)}</div>}
    </div>
  );
}

// Trial balance with opening balance, this period's debits and credits, and closing balance (Dr / Cr)
function TBDetail({ data }: { data: TBData }) {
  const drcr = (n: number) => Math.abs(n) < 0.005 ? "—" : <>{fmt(n)} <span style={{ fontSize: "0.68rem", color: "rgba(16,36,31,0.55)" }}>{n > 0 ? "Dr" : "Cr"}</span></>;
  const tot = data.accounts.reduce((t, a) => ({ op: t.op + (a.opening ?? 0), dr: t.dr + (a.period_dr ?? 0), cr: t.cr + (a.period_cr ?? 0), cl: t.cl + (a.dr - a.cr) }), { op: 0, dr: 0, cr: 0, cl: 0 });
  const td: React.CSSProperties = { padding: "0.55rem 0.8rem", textAlign: "right", fontSize: "0.83rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr>{["Account", "Opening", "Debit", "Credit", "Closing"].map(h => <th key={h} style={{ padding: "0.6rem 0.8rem", textAlign: h === "Account" ? "left" : "right", fontSize: "0.7rem", color: "rgba(16,36,31,0.65)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.accounts.map(a => (
            <tr key={a.id ?? a.name} style={{ borderTop: "1px solid rgba(16,36,31,0.08)" }}>
              <td style={{ padding: "0.55rem 0.8rem", fontSize: "0.85rem" }}><Drill id={a.id}>{a.name}</Drill></td>
              <td style={td}><Drill id={a.id}>{drcr(a.opening ?? 0)}</Drill></td>
              <td style={td}><Drill id={a.id}>{a.period_dr ? fmt(a.period_dr) : "—"}</Drill></td>
              <td style={td}><Drill id={a.id}>{a.period_cr ? fmt(a.period_cr) : "—"}</Drill></td>
              <td style={{ ...td, fontWeight: 700 }}><Drill id={a.id}>{drcr(a.dr - a.cr)}</Drill></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid rgba(18,53,45,0.3)", background: "rgba(18,53,45,0.06)", fontWeight: 800 }}>
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

  if (err) return <div style={{ padding: "2rem", color: "#B4321F" }}>{err}</div>;
  if (!cf) return <div style={{ padding: "3rem", textAlign: "center", color: "rgba(16,36,31,0.55)" }}>Calculating…</div>;

  const money = (n: number) => `${n < 0 ? "−" : ""}${cur()}${fmt(Math.abs(n))}`;
  const row = (label: string, value: number, opts: { indent?: boolean; bold?: boolean; key?: string } = {}) => (
    <tr key={opts.key ?? label} style={{ borderTop: "1px solid rgba(16,36,31,0.08)" }}>
      <td style={{ padding: `0.5rem ${opts.indent ? "2rem" : "1rem"}`, fontSize: "0.85rem", fontWeight: opts.bold ? 800 : 400, color: opts.bold ? "#10241F" : "rgba(16,36,31,0.97)" }}>{label}</td>
      <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: opts.bold ? 800 : 400, color: value < 0 ? "#B4321F" : value > 0 ? "#10241F" : "rgba(16,36,31,0.55)" }}>{money(value)}</td>
    </tr>
  );
  const sections: { key: CF["items"][number]["section"]; title: string; total: number }[] = [
    { key: "operating", title: "Operating activities", total: cf.operating },
    { key: "investing", title: "Investing activities", total: cf.investing },
    { key: "financing", title: "Financing activities", total: cf.financing },
  ];
  return (
    <>
      <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(16,36,31,0.11)" }}>
        <div style={{ fontWeight: 800, fontSize: "1rem" }}>Cash Flow Statement</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(16,36,31,0.65)", marginTop: "0.2rem" }}>{from} to {to} · direct method, from your cash &amp; bank ledgers</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {row("Opening cash & bank balance", cf.opening, { bold: true })}
          {sections.map(s => (
            <Fragment key={s.key}>
              <tr><td colSpan={2} style={{ padding: "0.7rem 1rem 0.3rem", fontSize: "0.68rem", fontWeight: 700, color: "#12352D", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.title}</td></tr>
              {cf.items.filter(i => i.section === s.key).map(i => row(i.amount >= 0 ? `Received — ${i.name}` : `Paid — ${i.name}`, i.amount, { indent: true, key: `${s.key}-${i.name}` }))}
              {row(`Net cash from ${s.title.toLowerCase()}`, s.total, { bold: true, key: `${s.key}-total` })}
            </Fragment>
          ))}
          {row("Net change in cash", cf.net, { bold: true })}
          {row("Closing cash & bank balance", cf.closing, { bold: true })}
        </tbody>
      </table>
      {cf.items.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "rgba(16,36,31,0.55)", fontSize: "0.88rem" }}>No cash or bank movements in this period.</div>}
    </>
  );
}