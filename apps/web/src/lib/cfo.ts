// Business analysis, the way a CFO reads the books: margins, fixed vs variable costs and break-even, expenses worth
// questioning, cash flow and runway, and working capital. Pure — computed from posted entries; every figure traces
// back to ledgers. Classifications (fixed / variable, avoidable) are by ledger name and group, and are stated as such.
import { groupOf, type Account, type Group } from "./books";
import type { QJournal } from "./bookQueries";
import { computeCashFlow, isCashBank, type CashFlow } from "./cashFlow";

export type Month = { month: string; revenue: number; cogs: number; otherIncome: number; expenses: number; gross: number; net: number; cashIn: number; cashOut: number };
export type ExpenseHead = { name: string; amount: number; share: number; kind: "fixed" | "variable"; recent: number; earlier: number; change: number | null; flag: null | "jump" | "avoidable" | "discretionary" };
export type Cfo = {
  period: { from: string; to: string; months: number };
  revenue: number; cogs: number; gross: number; otherIncome: number; expenses: number; net: number;
  grossMargin: number | null; netMargin: number | null; opexRatio: number | null;
  fixedCosts: number; variableCosts: number; contributionRatio: number | null;
  breakEvenYear: number | null; breakEvenMonth: number | null; avgMonthRevenue: number; safetyMargin: number | null;
  months: Month[];
  heads: ExpenseHead[];
  cash: CashFlow & { balance: number; avgBurn: number | null; runwayMonths: number | null };
  receivables: number; payables: number; dso: number | null; dpo: number | null;
  topCustomers: { name: string; amount: number; share: number }[];
  insights: { tone: "good" | "warn" | "bad"; text: string }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b > 0 ? r2((a / b) * 100) : null);
// Costs that don't move with sales; everything else on the expense side is treated as variable
const FIXED = /\b(rent|lease|salar(y|ies)|wages|staff|stipend|depreciation|amorti[sz]ation|interest|insurance|emi|loan|subscription|software|licen[cs]e|audit fee|professional|retainer|amc|security|internet|telephone|maintenance)\b/i;
const AVOIDABLE = /\b(penalt(y|ies)|late fee|late payment|interest on (gst|tds|tax|late|delay)|fine|demurrage|dishonou?r|cheque return|bounce|overdue interest)\b/i;
const DISCRETIONARY = /\b(travel|tour|hotel|food|refreshment|meals?|entertainment|gift|donation|party|celebration|festival|club|staff welfare|car|vehicle running|fuel|petrol|diesel|mobile|business promotion|advertis\w*|sponsorship)\b/i;

export function computeCfo(accounts: Account[], journals: QJournal[], from: string, to: string, today: string): Cfo {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const grp = (id: string): Group | null => { const a = byId.get(id); return a ? groupOf(a) : null; };
  const end = to < today ? to : today;
  const inPeriod = journals.filter(j => j.date >= from && j.date <= end);
  const monthKeys: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 7) <= end.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) monthKeys.push(d.toISOString().slice(0, 7));
  const months = new Map(monthKeys.map(m => [m, { month: m, revenue: 0, cogs: 0, otherIncome: 0, expenses: 0, gross: 0, net: 0, cashIn: 0, cashOut: 0 } as Month]));
  const cashIds = new Set(accounts.filter(isCashBank).map(a => a.id));
  const head = new Map<string, { name: string; amount: number; byMonth: Map<string, number> }>();
  const customer = new Map<string, number>();

  for (const j of inPeriod) {
    const m = months.get(j.date.slice(0, 7)); if (!m) continue;
    let saleHere = 0;
    for (const l of j.lines) {
      const g = grp(l.account_id); const net = (l.cr || 0) - (l.dr || 0);
      if (g === "sales") { m.revenue += net; saleHere += net; }
      else if (g === "indirect_income") m.otherIncome += net;
      else if (g === "purchase") m.cogs -= net;
      else if (g === "indirect_expense") {
        m.expenses -= net;
        const a = byId.get(l.account_id)!; const h = head.get(a.id) ?? { name: a.name, amount: 0, byMonth: new Map() };
        h.amount -= net; h.byMonth.set(m.month, (h.byMonth.get(m.month) ?? 0) - net); head.set(a.id, h);
      }
      if (cashIds.has(l.account_id)) { m.cashIn += l.dr || 0; m.cashOut += l.cr || 0; }
    }
    // Revenue by customer: the debtor ledger (or party) on a sales entry
    if (saleHere > 0) {
      const party = j.lines.map(l => byId.get(l.account_id)).find(a => a && a.sub_type === "trade_receivables")?.name ?? j.party_name ?? null;
      if (party) customer.set(party, (customer.get(party) ?? 0) + saleHere);
    }
  }
  const ms = [...months.values()].map(m => ({ ...m, revenue: r2(m.revenue), cogs: r2(m.cogs), otherIncome: r2(m.otherIncome), expenses: r2(m.expenses), gross: r2(m.revenue - m.cogs), net: r2(m.revenue - m.cogs + m.otherIncome - m.expenses), cashIn: r2(m.cashIn), cashOut: r2(m.cashOut) }));
  const tot = (k: keyof Month) => r2(ms.reduce((s, m) => s + (m[k] as number), 0));
  const revenue = tot("revenue"), cogs = tot("cogs"), otherIncome = tot("otherIncome"), expenses = tot("expenses");
  const gross = r2(revenue - cogs), net = r2(gross + otherIncome - expenses);
  const nMonths = Math.max(1, ms.filter(m => m.month <= end.slice(0, 7)).length);

  // Expense heads: fixed or variable, change in the latest 3 months against the months before, and flags
  const recentKeys = monthKeys.slice(-3), earlierKeys = monthKeys.slice(0, -3);
  const heads: ExpenseHead[] = [...head.values()].filter(h => Math.abs(h.amount) >= 1).map(h => {
    const avg = (ks: string[]) => ks.length ? ks.reduce((s, k) => s + (h.byMonth.get(k) ?? 0), 0) / ks.length : 0;
    const recent = r2(avg(recentKeys)), earlier = r2(avg(earlierKeys));
    const change = earlier > 0 ? r2(((recent - earlier) / earlier) * 100) : null;
    const flag = AVOIDABLE.test(h.name) ? "avoidable" : change != null && change >= 40 && recent - earlier >= 5000 ? "jump" : DISCRETIONARY.test(h.name) ? "discretionary" : null;
    return { name: h.name, amount: r2(h.amount), share: revenue > 0 ? r2((h.amount / revenue) * 100) : 0, kind: FIXED.test(h.name) ? "fixed" : "variable", recent, earlier, change, flag } as ExpenseHead;
  }).sort((a, b) => b.amount - a.amount);

  // Break-even: fixed costs ÷ contribution margin (purchases / direct costs and non-fixed expenses are variable)
  const fixedCosts = r2(heads.filter(h => h.kind === "fixed").reduce((s, h) => s + h.amount, 0));
  const variableCosts = r2(cogs + heads.filter(h => h.kind === "variable").reduce((s, h) => s + h.amount, 0));
  const contributionRatio = revenue > 0 ? (revenue - variableCosts) / revenue : null;
  const breakEvenYear = contributionRatio && contributionRatio > 0 ? r2(fixedCosts / contributionRatio) : null;
  const breakEvenMonth = breakEvenYear != null ? r2(breakEvenYear / nMonths) : null;
  const avgMonthRevenue = r2(revenue / nMonths);
  const safetyMargin = breakEvenYear != null && revenue > 0 ? r2(((revenue - breakEvenYear) / revenue) * 100) : null;

  // Cash: flow for the period, balance today, monthly burn and runway
  const cf = computeCashFlow(accounts, journals, from, end);
  const operatingPerMonth = cf.operating / nMonths;
  const avgBurn = operatingPerMonth < 0 ? r2(-operatingPerMonth) : null;
  const runwayMonths = avgBurn && cf.closing > 0 ? r2(cf.closing / avgBurn) : null;

  // Working capital
  const bal = new Map<string, number>();
  for (const j of journals) if (j.date <= end) for (const l of j.lines) bal.set(l.account_id, (bal.get(l.account_id) ?? 0) + (l.dr || 0) - (l.cr || 0));
  const receivables = r2(accounts.filter(a => a.sub_type === "trade_receivables").reduce((s, a) => s + (bal.get(a.id) ?? 0), 0));
  const payables = r2(-accounts.filter(a => a.sub_type === "trade_payables").reduce((s, a) => s + (bal.get(a.id) ?? 0), 0));
  const days = nMonths * 30.4;
  const dso = revenue > 0 && receivables > 0 ? Math.round((receivables / revenue) * days) : null;
  const dpo = cogs + expenses > 0 && payables > 0 ? Math.round((payables / (cogs + expenses)) * days) : null;
  const topCustomers = [...customer].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount: r2(amount), share: revenue > 0 ? r2((amount / revenue) * 100) : 0 }));

  // What a CFO would say
  const ins: Cfo["insights"] = [];
  const gm = pct(gross, revenue), nm = pct(net, revenue);
  if (revenue <= 0) ins.push({ tone: "warn", text: "No sales are posted in this period, so margins and break-even can't be worked out. Check that sales ledgers sit under Sales Accounts." });
  else {
    ins.push({ tone: net >= 0 ? "good" : "bad", text: `${net >= 0 ? "Profit" : "Loss"} of ${inr(net)} on revenue of ${inr(revenue)} — a net margin of ${nm}%${gm != null ? `, gross margin ${gm}%` : ""}.` });
    if (breakEvenMonth != null) ins.push({ tone: avgMonthRevenue >= breakEvenMonth ? "good" : "bad", text: `Break-even is about ${inr(breakEvenMonth)} of sales a month; you average ${inr(avgMonthRevenue)}${safetyMargin != null ? ` (${safetyMargin >= 0 ? `${safetyMargin}% above` : `${-safetyMargin}% below`} break-even)` : ""}.` });
    else if (contributionRatio != null && contributionRatio <= 0) ins.push({ tone: "bad", text: "Variable costs are more than sales — every extra sale loses money. Check prices and direct costs." });
  }
  const avoid = heads.filter(h => h.flag === "avoidable");
  if (avoid.length) ins.push({ tone: "bad", text: `${inr(avoid.reduce((s, h) => s + h.amount, 0))} went on avoidable costs (${avoid.slice(0, 3).map(h => h.name).join(", ")}) — penalties and late charges that paying on time would save.` });
  const jumps = heads.filter(h => h.flag === "jump");
  if (jumps.length) ins.push({ tone: "warn", text: `${jumps.slice(0, 3).map(h => `${h.name} (+${h.change}%)`).join(", ")} rose sharply in the last 3 months.` });
  if (cf.operating < 0) ins.push({ tone: "bad", text: `Day-to-day operations used ${inr(-cf.operating)} of cash${runwayMonths != null ? ` — at this pace the current balance lasts about ${runwayMonths} months` : ""}.` });
  if (dso != null && dso > 60) ins.push({ tone: "warn", text: `Customers take about ${dso} days to pay. Collecting faster would free ${inr(receivables)} tied up in receivables.` });
  if (topCustomers[0] && topCustomers[0].share >= 40) ins.push({ tone: "warn", text: `${topCustomers[0].name} is ${topCustomers[0].share}% of revenue — losing them would hurt. Worth widening the customer base.` });

  return {
    period: { from, to: end, months: nMonths }, revenue, cogs, gross, otherIncome, expenses, net,
    grossMargin: gm, netMargin: nm, opexRatio: pct(expenses, revenue),
    fixedCosts, variableCosts, contributionRatio: contributionRatio != null ? r2(contributionRatio * 100) : null,
    breakEvenYear, breakEvenMonth, avgMonthRevenue, safetyMargin, months: ms, heads,
    cash: { ...cf, balance: cf.closing, avgBurn, runwayMonths }, receivables, payables, dso, dpo, topCustomers, insights: ins,
  };
}
const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
