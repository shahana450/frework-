// Last month in a few numbers — the "Monthly recap" story. All from posted entries.
import { buildTrialBalance, buildPL, groupOf, type Account } from "./books";
import { monthPeriod, type QJournal } from "./bookQueries";
import { isDebtorAccount } from "./collect";

export type Recap = {
  month: string; from: string; to: string;
  revenue: number; prevRevenue: number; revenueChangePct: number | null;
  profit: number; marginPct: number | null;
  entries: number; collected: number;
  topExpense: { name: string; amount: number } | null;
  bestDay: { date: string; revenue: number } | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeRecap(accounts: Account[], journals: QJournal[], today: string, offset = -1): Recap | null {
  const m = monthPeriod(today, offset), p = monthPeriod(today, offset - 1);
  const inMonth = journals.filter(j => j.date >= m.from && j.date <= m.to);
  if (!inMonth.length) return null;
  const lines = journals.flatMap(j => j.lines.map(l => ({ account_id: l.account_id, dr: l.dr, cr: l.cr, date: j.date })));
  const pl = (x: { from: string; to: string }) => buildPL(buildTrialBalance(accounts, lines.filter(l => l.date <= x.to), x.from, x.to));
  const cur = pl(m), prev = pl(p);
  const revenue = r2(cur.revenue + cur.otherIncome), prevRevenue = r2(prev.revenue + prev.otherIncome);

  const debtors = new Set(accounts.filter(isDebtorAccount).map(a => a.id));
  const collected = r2(inMonth.reduce((s, j) => s + j.lines.filter(l => debtors.has(l.account_id)).reduce((t, l) => t + l.cr, 0), 0));

  const expIds = new Map(accounts.filter(a => groupOf(a) === "indirect_expense" || groupOf(a) === "purchase").map(a => [a.id, a.name]));
  const spend = new Map<string, number>();
  for (const j of inMonth) for (const l of j.lines) if (expIds.has(l.account_id)) spend.set(l.account_id, (spend.get(l.account_id) ?? 0) + l.dr - l.cr);
  const top = [...spend.entries()].sort((a, b) => b[1] - a[1])[0];

  const salesIds = new Set(accounts.filter(a => groupOf(a) === "sales").map(a => a.id));
  const byDay = new Map<string, number>();
  for (const j of inMonth) for (const l of j.lines) if (salesIds.has(l.account_id)) byDay.set(j.date, (byDay.get(j.date) ?? 0) + l.cr - l.dr);
  const best = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    month: new Date(m.from + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }), from: m.from, to: m.to,
    revenue, prevRevenue, revenueChangePct: prevRevenue > 0 ? Math.round((revenue / prevRevenue - 1) * 100) : null,
    profit: r2(cur.netProfit), marginPct: revenue > 0 ? Math.round((cur.netProfit / revenue) * 100) : null,
    entries: inMonth.length, collected,
    topExpense: top && top[1] > 0 ? { name: expIds.get(top[0])!, amount: r2(top[1]) } : null,
    bestDay: best && best[1] > 0 ? { date: best[0], revenue: r2(best[1]) } : null,
  };
}
