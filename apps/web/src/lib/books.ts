// One accounting engine for every report: Journal → Ledger → Trial Balance → P&L / Balance Sheet
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferHead } from "./ledgerHeads";

export type Group =
  | "current_asset" | "fixed_asset"                       // assets
  | "capital" | "loan" | "current_liability" | "duties"   // liabilities & equity
  | "sales" | "indirect_income"                           // income
  | "purchase" | "indirect_expense";                      // expenses

export const GROUP_LABEL: Record<Group, string> = {
  current_asset: "Current Assets", fixed_asset: "Fixed Assets",
  capital: "Capital & Reserves", loan: "Loans & Borrowings", current_liability: "Current Liabilities", duties: "Duties & Taxes",
  sales: "Sales / Direct Income", indirect_income: "Indirect Income",
  purchase: "Purchases / Direct Expenses", indirect_expense: "Indirect Expenses",
};
const PL_GROUPS = new Set<Group>(["sales", "indirect_income", "purchase", "indirect_expense"]);
const DEBIT_NATURE = new Set<Group>(["current_asset", "fixed_asset", "purchase", "indirect_expense"]);
export const isPLGroup = (g: Group) => PL_GROUPS.has(g);

export type Account = { id: string; name: string; type: string; sub_type?: string | null };
export type BookLine = { account_id: string; dr: number; cr: number; date: string };

const FROM_HEAD: Record<string, Group> = {
  bank: "current_asset", cash: "current_asset", debtors: "current_asset", current_asset: "current_asset", advances: "current_asset",
  fixed_asset: "fixed_asset", capital: "capital", creditors: "current_liability", duties: "duties",
  current_liability: "current_liability", loan: "loan", sales: "sales", indirect_income: "indirect_income",
  purchase: "purchase", direct_expense: "purchase", indirect_expense: "indirect_expense",
};

export function groupOf(a: Account): Group {
  const st = a.sub_type ?? "";
  const bySub: Record<string, Group> = {
    bank: "current_asset", cash: "current_asset", trade_receivables: "current_asset", current_asset: "current_asset",
    fixed_asset: "fixed_asset", capital: "capital", long_term_liability: "loan", trade_payables: "current_liability",
    revenue: "sales", direct_income: "sales", indirect_income: "indirect_income",
    direct_expense: "purchase", indirect_expense: "indirect_expense",
  };
  const head = inferHead(a.name);
  // GST/TDS ledgers are liabilities whatever sub_type they were given
  if (head?.key === "duties" && (a.type === "liability" || a.type === "tax" || st === "current_liability")) return "duties";
  if (st === "current_liability") return head?.key === "duties" ? "duties" : "current_liability";
  if (bySub[st]) return bySub[st];
  // Older / Tally-imported accounts carry coarse types
  switch (a.type) {
    case "bank": case "cash": return "current_asset";
    case "fixed_asset": return "fixed_asset";
    case "loan": return "loan";
    case "tax": return "duties";
    case "equity": return "capital";
    case "purchase": case "cost_of_goods": case "direct_expense": return "purchase";
    case "income": case "sales": return head?.key === "indirect_income" ? "indirect_income" : "sales";
    case "expense": return head && (head.key === "purchase" || head.key === "direct_expense") ? "purchase" : "indirect_expense";
    case "asset": return head?.key === "fixed_asset" ? "fixed_asset" : "current_asset";
    case "liability": {
      const g = head ? FROM_HEAD[head.key] : undefined;
      return g === "loan" || g === "duties" || g === "capital" ? g : "current_liability";
    }
  }
  return head ? FROM_HEAD[head.key] ?? "indirect_expense" : "indirect_expense";
}

export type TBRow = {
  id: string; name: string; group: Group;
  periodDr: number; periodCr: number;  // movement in the period (ledger totals)
  balance: number;                     // closing balance, Dr positive
  dr: number; cr: number;              // closing balance split for the TB columns
};

// P&L accounts: movement within [start, end]. Balance-sheet accounts: everything up to end.
// Earlier years' profit is carried into capital as a brought-forward line so the TB and BS balance.
export function buildTrialBalance(accounts: Account[], lines: BookLine[], start: string, end: string): TBRow[] {
  const rows = new Map<string, TBRow>();
  let priorProfit = 0;
  const accById = new Map(accounts.map(a => [a.id, a]));
  for (const l of lines) {
    if (l.date > end) continue;
    const a = accById.get(l.account_id);
    if (!a) continue;
    const g = groupOf(a);
    if (isPLGroup(g) && l.date < start) { priorProfit += (l.cr || 0) - (l.dr || 0); continue; }
    let r = rows.get(a.id);
    if (!r) { r = { id: a.id, name: a.name, group: g, periodDr: 0, periodCr: 0, balance: 0, dr: 0, cr: 0 }; rows.set(a.id, r); }
    if (l.date >= start) { r.periodDr += l.dr || 0; r.periodCr += l.cr || 0; }
    r.balance += (l.dr || 0) - (l.cr || 0);
  }
  const out = [...rows.values()];
  if (Math.abs(priorProfit) >= 0.005) {
    out.push({ id: "__pl_bf", name: "Profit & Loss A/c (brought forward)", group: "capital", periodDr: 0, periodCr: 0, balance: -priorProfit, dr: 0, cr: 0 });
  }
  for (const r of out) { r.balance = Math.round(r.balance * 100) / 100; r.dr = Math.max(r.balance, 0); r.cr = Math.max(-r.balance, 0); }
  const order: Group[] = ["capital", "loan", "current_liability", "duties", "fixed_asset", "current_asset", "sales", "indirect_income", "purchase", "indirect_expense"];
  return out.filter(r => r.balance !== 0 || r.periodDr || r.periodCr)
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));
}

export type PL = {
  sales: TBRow[]; indirectIncome: TBRow[]; purchases: TBRow[]; indirectExpenses: TBRow[];
  revenue: number; cogs: number; grossProfit: number; otherIncome: number; expenses: number; netProfit: number;
};
const natural = (r: TBRow) => DEBIT_NATURE.has(r.group) ? r.balance : -r.balance;
const sum = (rows: TBRow[]) => rows.reduce((s, r) => s + natural(r), 0);

export function buildPL(tb: TBRow[]): PL {
  const by = (g: Group) => tb.filter(r => r.group === g);
  const sales = by("sales"), indirectIncome = by("indirect_income"), purchases = by("purchase"), indirectExpenses = by("indirect_expense");
  const revenue = sum(sales), cogs = sum(purchases), otherIncome = sum(indirectIncome), expenses = sum(indirectExpenses);
  const grossProfit = revenue - cogs;
  return { sales, indirectIncome, purchases, indirectExpenses, revenue, cogs, grossProfit, otherIncome, expenses, netProfit: grossProfit + otherIncome - expenses };
}

export type BS = {
  currentAssets: TBRow[]; fixedAssets: TBRow[];
  capital: TBRow[]; loans: TBRow[]; currentLiabilities: TBRow[]; duties: TBRow[];
  totalAssets: number; totalLiabEq: number; netProfit: number; difference: number;
};

export function buildBS(tb: TBRow[], netProfit: number): BS {
  const by = (g: Group) => tb.filter(r => r.group === g);
  const currentAssets = by("current_asset"), fixedAssets = by("fixed_asset");
  const capital = by("capital"), loans = by("loan"), currentLiabilities = by("current_liability"), duties = by("duties");
  const totalAssets = sum(currentAssets) + sum(fixedAssets);
  const totalLiabEq = sum(capital) + sum(loans) + sum(currentLiabilities) + sum(duties) + netProfit;
  return { currentAssets, fixedAssets, capital, loans, currentLiabilities, duties, totalAssets, totalLiabEq, netProfit, difference: Math.round((totalAssets - totalLiabEq) * 100) / 100 };
}

// Signed amount shown on a statement (positive = normal side for its group)
export const statementAmount = natural;

// Every posted line up to `end`, with its journal date. Paged so nothing is silently cut off.
export async function loadBookLines(sb: SupabaseClient, businessId: string, end: string): Promise<{ lines: BookLine[]; accounts: Account[]; error?: string }> {
  const journals: { id: string; date: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("fw_fin_journals").select("id,date").eq("business_id", businessId).eq("status", "posted").lte("date", end).order("date").range(from, from + 999);
    if (error) return { lines: [], accounts: [], error: error.message };
    journals.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const dateOf = new Map(journals.map(j => [j.id, String(j.date).slice(0, 10)]));
  const ids = journals.map(j => j.id);
  const lines: BookLine[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150));
  // A few chunks in parallel keeps large books quick without flooding the API
  for (let c = 0; c < chunks.length; c += 4) {
    const results = await Promise.all(chunks.slice(c, c + 4).map(async chunk => {
      const got: BookLine[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from("fw_fin_journal_lines").select("journal_id,account_id,dr_amount,cr_amount").in("journal_id", chunk).range(from, from + 999);
        if (error) throw new Error(error.message);
        for (const l of data ?? []) got.push({ account_id: l.account_id, dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, date: dateOf.get(l.journal_id) ?? "" });
        if (!data || data.length < 1000) break;
      }
      return got;
    }));
    results.forEach(r => lines.push(...r));
  }
  const accounts: Account[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type").eq("business_id", businessId).range(from, from + 999);
    if (error) return { lines, accounts, error: error.message };
    accounts.push(...((data ?? []) as Account[]));
    if (!data || data.length < 1000) break;
  }
  return { lines, accounts };
}
