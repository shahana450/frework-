// How statements are PRESENTED (B1). The engine in books.ts computes signed balances; this decides where each
// line appears and with what sign. Rules: never show an absolute value; a balance against the section's normal
// side shows with a minus, except cash/bank credit balances, which move to Current Liabilities as overdrafts.
// Every section total is the sum of its displayed lines, and the statement says so (footing check).
import { statementAmount, type TBRow, type BS, type PL } from "./books";

export type StmtLine = { id: string; name: string; amount: number; note?: string };
export type StmtSection = { key: string; title: string; lines: StmtLine[]; total: number };
export type PresentedBS = {
  assets: StmtSection[]; liabilities: StmtSection[];
  totalAssets: number; totalLiabilities: number; netProfit: number;
  footed: boolean; problems: string[];
};
export type PresentedPL = { sections: StmtSection[]; grossProfit: number; netProfit: number; footed: boolean; problems: string[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const CASH_OR_BANK = /(^|\b)(cash|bank|petty cash|od|overdraft|cash credit|cc a\/c)(\b|$)/i;
/** Cash and bank ledgers, by sub-type when we have it, else by name. */
export const isCashOrBank = (r: TBRow & { sub_type?: string | null }) =>
  r.sub_type === "bank" || r.sub_type === "cash" || (r.group === "current_asset" && CASH_OR_BANK.test(r.name));

const section = (key: string, title: string, lines: StmtLine[]): StmtSection =>
  ({ key, title, lines, total: r2(lines.reduce((s, l) => s + l.amount, 0)) });
const line = (r: TBRow, note?: string): StmtLine => ({ id: r.id, name: r.name, amount: r2(statementAmount(r)), ...(note ? { note } : {}) });

export function presentBalanceSheet(bs: BS, rows: (TBRow & { sub_type?: string | null })[] = []): PresentedBS {
  const sub = new Map(rows.map(r => [r.id, r.sub_type]));
  const withSub = (r: TBRow) => ({ ...r, sub_type: sub.get(r.id) ?? null });
  // Cash/bank with a credit balance is a liability (overdraft), not a negative asset
  const overdrafts = bs.currentAssets.filter(r => isCashOrBank(withSub(r)) && r.balance < 0);
  const odIds = new Set(overdrafts.map(r => r.id));
  const assets = [
    section("current_assets", "Current Assets", bs.currentAssets.filter(r => !odIds.has(r.id)).map(r => line(r, statementAmount(r) < 0 ? "Credit balance" : undefined))),
    section("fixed_assets", "Fixed Assets", bs.fixedAssets.map(r => line(r, statementAmount(r) < 0 ? "Credit balance" : undefined))),
  ];
  const odLines: StmtLine[] = overdrafts.map(r => ({ id: r.id, name: `${/cash/i.test(r.name) && !/bank/i.test(r.name) ? "Cash credit balance" : "Bank overdraft"} — ${r.name}`, amount: r2(-r.balance), note: "Credit balance on a cash/bank account" }));
  const liabilities = [
    section("current_liabilities", "Current Liabilities", [...odLines, ...[...bs.currentLiabilities, ...bs.duties].map(r => line(r, statementAmount(r) < 0 ? "Debit balance" : undefined))]),
    section("long_term_liabilities", "Long-term Liabilities", bs.loans.map(r => line(r, statementAmount(r) < 0 ? "Debit balance" : undefined))),
    section("equity", "Capital & Equity", [
      ...bs.capital.map(r => line(r, statementAmount(r) < 0 ? "Debit balance" : undefined)),
      { id: "__net_profit", name: `Net ${bs.netProfit >= 0 ? "profit" : "loss"} for the year`, amount: r2(bs.netProfit) },
    ]),
  ];
  const totalAssets = r2(assets.reduce((s, x) => s + x.total, 0));
  const totalLiabilities = r2(liabilities.reduce((s, x) => s + x.total, 0));
  const problems: string[] = [];
  for (const s of [...assets, ...liabilities]) {
    const sum = r2(s.lines.reduce((a, l) => a + l.amount, 0));
    if (sum !== s.total) problems.push(`${s.title}: lines add to ${sum}, total shows ${s.total}`);
  }
  if (totalAssets !== totalLiabilities) problems.push(`Assets ${totalAssets} ≠ liabilities and equity ${totalLiabilities}`);
  return { assets, liabilities, totalAssets, totalLiabilities, netProfit: r2(bs.netProfit), footed: problems.length === 0, problems };
}

export function presentPL(pl: PL): PresentedPL {
  const mk = (key: string, title: string, rows: TBRow[]) => section(key, title, rows.map(r => line(r, statementAmount(r) < 0 ? "Against normal balance" : undefined)));
  const sections = [
    mk("sales", "Revenue / Sales", pl.sales), mk("direct_expense", "Direct Expenses (Cost of Goods Sold)", pl.purchases),
    mk("indirect_income", "Other Income", pl.indirectIncome), mk("indirect_expense", "Operating Expenses", pl.indirectExpenses),
  ];
  const t = (k: string) => sections.find(s => s.key === k)!.total;
  const grossProfit = r2(t("sales") - t("direct_expense"));
  const netProfit = r2(grossProfit + t("indirect_income") - t("indirect_expense"));
  const problems: string[] = [];
  if (netProfit !== r2(pl.netProfit)) problems.push(`Net profit from lines ${netProfit} ≠ engine ${r2(pl.netProfit)}`);
  return { sections, grossProfit, netProfit, footed: problems.length === 0, problems };
}

/** Indian-format money with a real minus sign — the only formatter statements should use. */
export function signedMoney(n: number, symbol = "₹"): string {
  const v = r2(n);
  return `${v < 0 ? "−" : ""}${symbol}${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
