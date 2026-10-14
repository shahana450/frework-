// "Ask your books": deterministic answers computed from posted journals.
// The AI only chooses which question this is; every number here comes from the ledger.
import { buildTrialBalance, buildPL, groupOf, statementAmount, type Account, type BookLine, type TBRow } from "./books";
import { formatMoney, DEFAULT_MONEY, type MoneyFormat } from "./money";

export type QJournal = {
  id: string; date: string; entry_no: string; narration: string; type: string; party_name: string | null;
  lines: { account_id: string; dr: number; cr: number }[];
};
export type Period = { from: string; to: string; label: string };
export type Metric = { label: string; value: number; tone?: "good" | "bad" | "neutral" };
export type TxRow = { id: string; date: string; entry_no: string; narration: string; amount: number; accounts: string };
export type Answer = {
  title: string; summary: string; metrics: Metric[];
  table?: { columns: string[]; rows: (string | number)[][] };
  transactions?: TxRow[]; links: { label: string; href: string }[]; period?: Period; note?: string;
};

export const TOOLS = ["profit_loss", "compare", "receivables", "payables", "search", "top_expenses", "gst_summary", "balances"] as const;
export type Tool = typeof TOOLS[number];

const r2 = (n: number) => Math.round(n * 100) / 100;
// Answers are formatted in the business currency; runTool sets this for the (synchronous) duration of one answer
let money: MoneyFormat = DEFAULT_MONEY;
export const inr = (n: number) => formatMoney(n, money);

function toLines(journals: QJournal[]): BookLine[] {
  return journals.flatMap(j => j.lines.map(l => ({ account_id: l.account_id, dr: l.dr, cr: l.cr, date: j.date })));
}
function accountNames(accounts: Account[]) { return new Map(accounts.map(a => [a.id, a.name])); }
function txRow(j: QJournal, names: Map<string, string>): TxRow {
  const amount = r2(j.lines.reduce((s, l) => s + l.dr, 0));
  const dr = j.lines.filter(l => l.dr > 0).map(l => names.get(l.account_id) ?? "?");
  const cr = j.lines.filter(l => l.cr > 0).map(l => names.get(l.account_id) ?? "?");
  return { id: j.id, date: j.date, entry_no: j.entry_no, narration: j.narration, amount, accounts: `Dr ${dr.join(", ")} / Cr ${cr.join(", ")}` };
}
const inPeriod = (p: Period) => (j: QJournal) => j.date >= p.from && j.date <= p.to;
const isDebtor = (a: Account) => a.sub_type === "trade_receivables" || /debtor|receivable/i.test(a.name) && groupOf(a) === "current_asset";
const isCreditor = (a: Account) => a.sub_type === "trade_payables" || /creditor|payable/i.test(a.name) && groupOf(a) === "current_liability";
const isCashBank = (a: Account) => a.sub_type === "bank" || a.sub_type === "cash" || a.type === "bank" || a.type === "cash" || (/\bbank\b|\bcash\b/i.test(a.name) && groupOf(a) === "current_asset" && !/charges|commission/i.test(a.name));

function plFor(accounts: Account[], journals: QJournal[], p: Period) {
  const tb = buildTrialBalance(accounts, toLines(journals.filter(j => j.date <= p.to)), p.from, p.to);
  return { tb, pl: buildPL(tb) };
}

export function profitLoss(accounts: Account[], journals: QJournal[], p: Period): Answer {
  const { pl } = plFor(accounts, journals, p);
  const top = [...pl.indirectExpenses, ...pl.purchases].map(r => [r.name, r2(statementAmount(r))] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    title: `Profit & Loss · ${p.label}`,
    summary: `${pl.netProfit >= 0 ? "Net profit" : "Net loss"} of ${inr(Math.abs(pl.netProfit))} for ${p.label}: sales ${inr(pl.revenue)}${pl.otherIncome ? ` plus other income ${inr(pl.otherIncome)}` : ""}, less purchases ${inr(pl.cogs)} and expenses ${inr(pl.expenses)}.`,
    metrics: [
      { label: "Sales", value: r2(pl.revenue) }, { label: "Purchases / direct", value: r2(pl.cogs) },
      { label: "Gross profit", value: r2(pl.grossProfit), tone: pl.grossProfit >= 0 ? "good" : "bad" },
      { label: "Expenses", value: r2(pl.expenses) }, { label: pl.netProfit >= 0 ? "Net profit" : "Net loss", value: r2(pl.netProfit), tone: pl.netProfit >= 0 ? "good" : "bad" },
    ],
    table: top.length ? { columns: ["Biggest costs", "Amount"], rows: top.map(([n, v]) => [n, v]) } : undefined,
    links: [{ label: "Open P&L", href: "/finance/reports?tab=profit_loss" }], period: p,
  };
}

export function compare(accounts: Account[], journals: QJournal[], a: Period, b: Period): Answer {
  const A = plFor(accounts, journals, a), B = plFor(accounts, journals, b);
  const byName = (tb: TBRow[]) => new Map(tb.filter(r => ["sales", "indirect_income", "purchase", "indirect_expense"].includes(r.group)).map(r => [r.name, { v: statementAmount(r), g: r.group }]));
  const ma = byName(A.tb), mb = byName(B.tb);
  const names = new Set([...ma.keys(), ...mb.keys()]);
  // Effect on profit: income up = good, cost up = bad
  const moves = [...names].map(n => {
    const va = ma.get(n)?.v ?? 0, vb = mb.get(n)?.v ?? 0, g = (ma.get(n) ?? mb.get(n))!.g;
    const income = g === "sales" || g === "indirect_income";
    return { n, va, vb, delta: r2(va - vb), profitEffect: r2(income ? va - vb : vb - va) };
  }).filter(m => Math.abs(m.delta) >= 0.01).sort((x, y) => Math.abs(y.profitEffect) - Math.abs(x.profitEffect)).slice(0, 6);
  const diff = r2(A.pl.netProfit - B.pl.netProfit);
  const drivers = moves.slice(0, 3).map(m => `${m.n} ${m.delta > 0 ? "up" : "down"} ${inr(Math.abs(m.delta))}`).join(", ");
  return {
    title: `${a.label} vs ${b.label}`,
    summary: `Net profit ${diff >= 0 ? "rose" : "fell"} by ${inr(Math.abs(diff))} (${inr(A.pl.netProfit)} vs ${inr(B.pl.netProfit)}).${drivers ? ` Biggest drivers: ${drivers}.` : " No account changed."}`,
    metrics: [
      { label: `Profit ${a.label}`, value: r2(A.pl.netProfit), tone: A.pl.netProfit >= 0 ? "good" : "bad" },
      { label: `Profit ${b.label}`, value: r2(B.pl.netProfit), tone: B.pl.netProfit >= 0 ? "good" : "bad" },
      { label: "Change", value: diff, tone: diff >= 0 ? "good" : "bad" },
    ],
    table: moves.length ? { columns: ["Account", a.label, b.label, "Effect on profit"], rows: moves.map(m => [m.n, r2(m.va), r2(m.vb), m.profitEffect]) } : undefined,
    links: [{ label: "Open P&L", href: "/finance/reports?tab=profit_loss" }], period: a,
  };
}

function partyBalances(accounts: Account[], journals: QJournal[], pick: (a: Account) => boolean, sign: 1 | -1, asOf: string) {
  const ids = new Set(accounts.filter(pick).map(a => a.id));
  const byParty = new Map<string, { bal: number; last: string }>();
  let total = 0;
  for (const j of journals) {
    if (j.date > asOf) continue;
    const net = j.lines.filter(l => ids.has(l.account_id)).reduce((s, l) => s + (l.dr - l.cr) * sign, 0);
    if (!net) continue;
    total += net;
    const key = j.party_name?.trim() || "Not named";
    const cur = byParty.get(key) ?? { bal: 0, last: j.date };
    cur.bal += net; if (j.date > cur.last) cur.last = j.date;
    byParty.set(key, cur);
  }
  const rows = [...byParty.entries()].map(([p, v]) => ({ party: p, bal: r2(v.bal), last: v.last })).filter(r => Math.abs(r.bal) >= 0.01).sort((a, b) => b.bal - a.bal);
  return { total: r2(total), rows, ids };
}

export function receivables(accounts: Account[], journals: QJournal[], asOf: string): Answer {
  const { total, rows, ids } = partyBalances(accounts, journals, isDebtor, 1, asOf);
  const names = accountNames(accounts);
  const recent = journals.filter(j => j.date <= asOf && j.lines.some(l => ids.has(l.account_id))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(j => txRow(j, names));
  return {
    title: "Money owed to you",
    summary: total > 0 ? `Customers owe you ${inr(total)}${rows.length ? `, across ${rows.length} part${rows.length > 1 ? "ies" : "y"}` : ""}.${rows[0] ? ` Largest: ${rows[0].party} (${inr(rows[0].bal)}).` : ""}` : "Nothing is owed to you right now.",
    metrics: [{ label: "Total receivable", value: total, tone: "neutral" }],
    table: rows.length ? { columns: ["Customer", "Owes you", "Last activity"], rows: rows.slice(0, 15).map(r => [r.party, r.bal, r.last]) } : undefined,
    transactions: recent, links: [{ label: "Open Receivables", href: "/finance/receivables" }],
    note: rows.some(r => r.party === "Not named") ? "Some entries have no customer name, so they're grouped as \"Not named\"." : undefined,
  };
}

export function payables(accounts: Account[], journals: QJournal[], asOf: string): Answer {
  const { total, rows, ids } = partyBalances(accounts, journals, isCreditor, -1, asOf);
  const names = accountNames(accounts);
  const recent = journals.filter(j => j.date <= asOf && j.lines.some(l => ids.has(l.account_id))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(j => txRow(j, names));
  return {
    title: "Money you owe",
    summary: total > 0 ? `You owe suppliers ${inr(total)}.${rows[0] ? ` Largest: ${rows[0].party} (${inr(rows[0].bal)}).` : ""}` : "You don't owe any suppliers right now.",
    metrics: [{ label: "Total payable", value: total, tone: total > 0 ? "bad" : "good" }],
    table: rows.length ? { columns: ["Supplier", "You owe", "Last activity"], rows: rows.slice(0, 15).map(r => [r.party, r.bal, r.last]) } : undefined,
    transactions: recent, links: [{ label: "Open Payables", href: "/finance/payables" }],
  };
}

export type SearchParams = { text?: string | null; party?: string | null; account?: string | null; min_amount?: number | null; max_amount?: number | null; kind?: "expense" | "income" | "payment" | "receipt" | "sales" | "purchase" | null };

export function search(accounts: Account[], journals: QJournal[], p: Period, q: SearchParams): Answer {
  const names = accountNames(accounts);
  const accById = new Map(accounts.map(a => [a.id, a]));
  const text = q.text?.toLowerCase().trim(), party = q.party?.toLowerCase().trim(), acct = q.account?.toLowerCase().trim();
  const hits = journals.filter(inPeriod(p)).filter(j => {
    const amount = j.lines.reduce((s, l) => s + l.dr, 0);
    if (q.min_amount != null && amount < q.min_amount) return false;
    if (q.max_amount != null && amount > q.max_amount) return false;
    const lineAccs = j.lines.map(l => accById.get(l.account_id)).filter(Boolean) as Account[];
    if (party && !(`${j.party_name ?? ""} ${j.narration}`.toLowerCase().includes(party))) return false;
    if (acct && !lineAccs.some(a => a.name.toLowerCase().includes(acct))) return false;
    if (text && !(`${j.narration} ${j.party_name ?? ""} ${j.entry_no} ${lineAccs.map(a => a.name).join(" ")}`.toLowerCase().includes(text))) return false;
    if (q.kind === "expense" && !j.lines.some(l => l.dr > 0 && ["indirect_expense", "purchase"].includes(groupOf(accById.get(l.account_id) ?? { id: "", name: "", type: "" })))) return false;
    if (q.kind === "income" && !j.lines.some(l => l.cr > 0 && ["sales", "indirect_income"].includes(groupOf(accById.get(l.account_id) ?? { id: "", name: "", type: "" })))) return false;
    if (q.kind && !["expense", "income"].includes(q.kind) && j.type !== q.kind) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
  // The words name a ledger ("TDS payable for Oct") → answer with that ledger's own figures, not the totals of the entries that touch it
  const ledgerWord = acct || text;
  const ledgers = ledgerWord && !party && !q.kind ? accounts.filter(a => !(a as { is_group?: boolean }).is_group && a.name.toLowerCase().includes(ledgerWord)) : [];
  if (ledgers.length) {
    const ids = new Set(ledgers.map(a => a.id));
    const credit = (a: Account) => ["current_liability", "loan", "capital", "duties", "sales", "indirect_income"].includes(groupOf(a));
    const rows = ledgers.map(a => {
      let moved = 0, closing = 0;
      for (const j of journals) for (const l of j.lines) if (l.account_id === a.id) {
        if (j.date <= p.to) closing += l.dr - l.cr;
        if (j.date >= p.from && j.date <= p.to) moved += l.dr - l.cr;
      }
      return { a, moved: r2(moved), closing: r2(closing) };
    }).filter(r => r.moved || r.closing);
    const side = (v: number) => (v ? ` ${v > 0 ? "Dr" : "Cr"}` : "");
    const touched = hits.filter(j => j.lines.some(l => ids.has(l.account_id)));
    return {
      title: `${ledgers.length === 1 ? ledgers[0].name : "Ledgers"} · ${p.label}`,
      summary: rows.length
        ? rows.map(r => `${r.a.name}: ${credit(r.a) ? (r.moved <= 0 ? "added" : "reduced by") : (r.moved >= 0 ? "added" : "reduced by")} ${inr(Math.abs(r.moved))} in ${p.label}; balance ${inr(Math.abs(r.closing))}${side(r.closing)} on ${p.to}`).join(". ") + "."
        : `No movement on ${ledgers.map(a => a.name).join(", ")} in ${p.label}.`,
      metrics: rows.length === 1 ? [{ label: `Movement in ${p.label}`, value: Math.abs(rows[0].moved) }, { label: "Balance", value: Math.abs(rows[0].closing) }] : [],
      table: rows.length > 1 ? { columns: ["Ledger", "Movement", "Balance"], rows: rows.map(r => [r.a.name, Math.abs(r.moved), `${inr(Math.abs(r.closing))}${side(r.closing)}`]) } : undefined,
      transactions: touched.slice(0, 50).map(j => txRow(j, names)),
      links: [{ label: "Open Ledger", href: "/finance/ledger" }], period: p,
    };
  }
  const total = r2(hits.reduce((s, j) => s + j.lines.reduce((x, l) => x + l.dr, 0), 0));
  const what = [q.kind && `${q.kind} entries`, party && `with ${q.party}`, acct && `in ${q.account}`, text && `matching "${q.text}"`, q.min_amount != null && `above ${inr(q.min_amount)}`, q.max_amount != null && `below ${inr(q.max_amount)}`].filter(Boolean).join(" ") || "entries";
  return {
    title: `Search · ${p.label}`,
    summary: hits.length ? `${hits.length} ${what} in ${p.label}, totalling ${inr(total)}.` : `No ${what} in ${p.label}.`,
    metrics: [{ label: "Entries", value: hits.length }, { label: "Total", value: total }],
    transactions: hits.slice(0, 50).map(j => txRow(j, names)),
    links: [{ label: "Open Journal", href: "/finance/journals" }], period: p,
    note: hits.length > 50 ? `Showing the 50 most recent of ${hits.length}.` : undefined,
  };
}

export function topExpenses(accounts: Account[], journals: QJournal[], p: Period, limit = 10): Answer {
  const { pl } = plFor(accounts, journals, p);
  const rows = [...pl.indirectExpenses, ...pl.purchases].map(r => ({ n: r.name, v: r2(statementAmount(r)) })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);
  const total = r2(rows.reduce((s, r) => s + r.v, 0));
  return {
    title: `Biggest expenses · ${p.label}`,
    summary: rows.length ? `Your largest cost in ${p.label} was ${rows[0].n} at ${inr(rows[0].v)} (${Math.round(rows[0].v / total * 100)}% of ${inr(total)} total costs).` : `No expenses recorded in ${p.label}.`,
    metrics: [{ label: "Total costs", value: total }],
    table: rows.length ? { columns: ["Account", "Amount", "Share"], rows: rows.slice(0, limit).map(r => [r.n, r.v, `${Math.round(r.v / total * 100)}%`]) } : undefined,
    links: [{ label: "Open P&L", href: "/finance/reports?tab=profit_loss" }], period: p,
  };
}

export function gstSummary(accounts: Account[], journals: QJournal[], p: Period): Answer {
  const out = new Set(accounts.filter(a => /gst/i.test(a.name) && /output|payable|collected/i.test(a.name)).map(a => a.id));
  const inp = new Set(accounts.filter(a => /gst/i.test(a.name) && /input|itc|credit|receivable/i.test(a.name)).map(a => a.id));
  let collected = 0, paidOnPurchases = 0;
  const touched: QJournal[] = [];
  for (const j of journals.filter(inPeriod(p))) {
    let hit = false;
    for (const l of j.lines) {
      if (out.has(l.account_id)) { collected += l.cr - l.dr; hit = true; }
      if (inp.has(l.account_id)) { paidOnPurchases += l.dr - l.cr; hit = true; }
    }
    if (hit) touched.push(j);
  }
  collected = r2(collected); paidOnPurchases = r2(paidOnPurchases);
  const net = r2(collected - paidOnPurchases);
  const names = accountNames(accounts);
  return {
    title: `GST · ${p.label}`,
    summary: `You collected ${inr(collected)} GST on sales and paid ${inr(paidOnPurchases)} on purchases (input credit) in ${p.label}. ${net >= 0 ? `Net payable: ${inr(net)}` : `Excess input credit: ${inr(-net)}`}.`,
    metrics: [{ label: "Output GST", value: collected }, { label: "Input credit", value: paidOnPurchases }, { label: net >= 0 ? "Net payable" : "Excess credit", value: Math.abs(net), tone: net > 0 ? "bad" : "good" }],
    transactions: touched.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(j => txRow(j, names)),
    links: [{ label: "GST Reconciliation", href: "/finance/audit/gst-recon" }], period: p,
    note: !out.size && !inp.size ? "No GST ledgers found (names containing \"GST\" with Input/Output)." : undefined,
  };
}

export function balances(accounts: Account[], journals: QJournal[], asOf: string, accountName?: string | null): Answer {
  const pick = accountName ? accounts.filter(a => a.name.toLowerCase().includes(accountName.toLowerCase())) : accounts.filter(isCashBank);
  const ids = new Set(pick.map(a => a.id));
  const bal = new Map<string, number>();
  for (const j of journals) if (j.date <= asOf) for (const l of j.lines) if (ids.has(l.account_id)) bal.set(l.account_id, (bal.get(l.account_id) ?? 0) + l.dr - l.cr);
  const rows = pick.map(a => ({ n: a.name, v: r2(bal.get(a.id) ?? 0), credit: ["current_liability", "loan", "capital", "duties", "sales", "indirect_income"].includes(groupOf(a)) }))
    .filter(r => r.v !== 0 || accountName).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const total = r2(rows.reduce((s, r) => s + r.v, 0));
  return {
    title: accountName ? `Balance · ${accountName}` : "Cash & bank balances",
    summary: rows.length ? (accountName ? rows.map(r => `${r.n}: ${inr(r.credit ? -r.v : r.v)}${r.v ? (r.v > 0 ? " Dr" : " Cr") : ""}`).join("; ") + "." : `You have ${inr(total)} across ${rows.length} cash/bank account${rows.length > 1 ? "s" : ""}.`) : `No ${accountName ? `account matching "${accountName}"` : "cash or bank accounts"} with a balance.`,
    metrics: accountName ? [] : [{ label: "Cash + bank", value: total, tone: total >= 0 ? "good" : "bad" }],
    table: rows.length ? { columns: ["Account", "Balance"], rows: rows.map(r => [r.n, r.v]) } : undefined,
    links: [{ label: "Open Ledger", href: "/finance/ledger" }],
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function monthPeriod(today: string, offset = 0): Period {
  const t = new Date(today + "T00:00:00Z");
  const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: iso(start), to: iso(end), label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}` };
}

/** Accepts the AI's date range only if it is a real range; otherwise falls back. */
export function resolvePeriod(raw: unknown, fallback: Period): Period {
  const r = raw as { from?: string; to?: string; label?: string } | null;
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
  if (!r || !ok(r.from) || !ok(r.to) || r.from! > r.to!) return fallback;
  return { from: r.from!, to: r.to!, label: (r.label?.trim() || `${r.from} to ${r.to}`).slice(0, 40) };
}

export function runTool(tool: Tool, accounts: Account[], journals: QJournal[], params: Record<string, unknown>, periods: { p: Period; p2: Period; today: string }, fmt: MoneyFormat = DEFAULT_MONEY): Answer & { currency: string; locale: string } {
  money = fmt;
  try { return { ...answerFor(tool, accounts, journals, params, periods), currency: fmt.currency, locale: fmt.locale }; }
  finally { money = DEFAULT_MONEY; }
}

function answerFor(tool: Tool, accounts: Account[], journals: QJournal[], params: Record<string, unknown>, periods: { p: Period; p2: Period; today: string }): Answer {
  switch (tool) {
    case "profit_loss": return profitLoss(accounts, journals, periods.p);
    case "compare": return compare(accounts, journals, periods.p, periods.p2);
    case "receivables": return receivables(accounts, journals, periods.today);
    case "payables": return payables(accounts, journals, periods.today);
    case "top_expenses": return topExpenses(accounts, journals, periods.p, Number(params.limit) || 10);
    case "gst_summary": return gstSummary(accounts, journals, periods.p);
    case "balances": return balances(accounts, journals, periods.today, (params.account as string) ?? null);
    case "search": default: return search(accounts, journals, periods.p, params as SearchParams);
  }
}
