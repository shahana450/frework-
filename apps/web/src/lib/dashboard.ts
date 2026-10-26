// Dashboard figures and alerts, computed from posted entries with the same engine as the reports.
import { buildTrialBalance, buildPL, groupOf, type Account } from "./books";
import { gst3bByMonth, gst3bCash, gstRole } from "./gst3b";
import { arAp, isReceivable, isPayable } from "./partyBalances";
import { monthPeriod, type QJournal, type Period } from "./bookQueries";
import { formatMoney, DEFAULT_MONEY, type MoneyFormat } from "./money";
import { dueDates, type DueItem } from "./compliance";
import { worldDueDates } from "./complianceWorld";

export type Alert = { tone: "bad" | "warn" | "info"; text: string; href: string; action: string };
export type Dashboard = {
  period: Period; month: Period;
  cash: number; receivables: number; payables: number;
  revenue: number; expenses: number; profit: number;
  monthRevenue: number; monthProfit: number; lastMonthProfit: number;
  recent: { id: string; date: string; entry_no: string; narration: string; amount: number; type: string }[];
  alerts: Alert[];
  currency: string; locale: string;
  /** Last 14 days, oldest first: did any entry get dated that day? */
  activity: boolean[]; streak: number;
  /** 100 minus visible deductions: reviews waiting, drafts, warnings */
  health: { score: number; reasons: string[] };
  insight: { text: string; account: string; spark: number[]; href: string } | null;
  gst: { form: string; period: string; due: string; daysLeft: number }[];
  /** Statutory due dates that apply to this business (GST, TDS, PF/ESI, advance tax, ITR) */
  compliance: DueItem[];
  /** Which reminder families are switched on (India) — the card suggests what to add when one is off */
  complianceSetup: { gst: boolean; tds: boolean; payroll: boolean; country: string };
};
export type DashExtra = { pendingReview: number; drafts: number; business?: { gstin?: string | null; tan?: string | null; audit?: boolean; state?: string | null; country?: string | null; fyStart?: string | null } };

const r2 = (n: number) => Math.round(n * 100) / 100;
let money: MoneyFormat = DEFAULT_MONEY;
const inr = (n: number) => formatMoney(Math.abs(n), money, { decimals: false });
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const isCashBank = (a: Account) => a.sub_type === "bank" || a.sub_type === "cash" || a.type === "bank" || a.type === "cash" || (/\bbank\b|\bcash\b/i.test(a.name) && groupOf(a) === "current_asset" && !/charges|commission/i.test(a.name));
const isDebtor = (a: Account) => isReceivable(a);
const isCreditor = (a: Account) => isPayable(a);

export function computeDashboard(accounts: Account[], journals: QJournal[], today: string, fy: Period, extra: DashExtra, fmt: MoneyFormat = DEFAULT_MONEY): Dashboard {
  money = fmt;
  try { return compute(accounts, journals, today, fy, extra, fmt); } finally { money = DEFAULT_MONEY; }
}

function compute(accounts: Account[], journals: QJournal[], today: string, fy: Period, extra: DashExtra, fmt: MoneyFormat): Dashboard {
  const lines = journals.flatMap(j => j.lines.map(l => ({ account_id: l.account_id, dr: l.dr, cr: l.cr, date: j.date })));
  const asOf = today < fy.to ? today : fy.to;
  const balance = (pick: (a: Account) => boolean, sign: 1 | -1) => {
    const ids = new Set(accounts.filter(pick).map(a => a.id));
    return r2(lines.filter(l => l.date <= asOf && ids.has(l.account_id)).reduce((s, l) => s + (l.dr - l.cr) * sign, 0));
  };
  const plFor = (p: Period) => buildPL(buildTrialBalance(accounts, lines.filter(l => l.date <= p.to), p.from, p.to));
  const yearPL = plFor(fy);
  const month = monthPeriod(today), last = monthPeriod(today, -1);
  const mPL = plFor(month), lPL = plFor(last);

  const alerts: Alert[] = [];
  if (extra.pendingReview) alerts.push({ tone: "info", text: `${extra.pendingReview} uploaded item${extra.pendingReview > 1 ? "s are" : " is"} waiting for your review.`, href: "/finance/ai-review", action: "Review" });
  if (extra.drafts) alerts.push({ tone: "info", text: `${extra.drafts} draft entr${extra.drafts > 1 ? "ies are" : "y is"} not posted yet.`, href: "/finance/journals?status=draft", action: "Open drafts" });

  // Cash/bank accounts can't really be overdrawn below zero unless they're overdrafts — usually a missing receipt
  const byAcc = new Map<string, number>();
  for (const l of lines) if (l.date <= asOf) byAcc.set(l.account_id, (byAcc.get(l.account_id) ?? 0) + l.dr - l.cr);
  for (const a of accounts.filter(isCashBank)) {
    const b = r2(byAcc.get(a.id) ?? 0);
    if (b < -0.5 && !/od|overdraft|cc\b|cash credit/i.test(a.name)) alerts.push({ tone: "bad", text: `${a.name} shows a credit balance of ${inr(b)} — a receipt or opening balance may be missing.`, href: `/finance/ledger?account=${a.id}`, action: "Open ledger" });
  }
  const recvIds = accounts.filter(isDebtor).map(a => a.id), payIds = accounts.filter(isCreditor).map(a => a.id);
  const sumOf = (ids: string[]) => r2(ids.reduce((s, id) => s + (byAcc.get(id) ?? 0), 0));
  const debtorsNet = sumOf(recvIds), creditorsNet = sumOf(payIds);
  if (debtorsNet < -0.5) alerts.push({ tone: "bad", text: `Debtors show a credit balance of ${inr(debtorsNet)} — receipts may have been posted without the matching sales, or to the wrong ledger.`, href: "/finance/receivables", action: "Check" });
  if (creditorsNet > 0.5) alerts.push({ tone: "bad", text: `Creditors show a debit balance of ${inr(creditorsNet)} — payments may have been posted without the matching bills, or to the wrong ledger.`, href: "/finance/payables", action: "Check" });
  for (const a of accounts.filter(x => gstRole(x.name)?.role === "input")) {
    const b = r2(byAcc.get(a.id) ?? 0);
    if (b < -0.5) alerts.push({ tone: "bad", text: `${a.name} (input tax credit) shows a credit balance of ${inr(b)} — input credit can't be negative.`, href: `/finance/ledger?account=${a.id}`, action: "Open ledger" });
  }
  const suspense = accounts.filter(a => /suspense/i.test(a.name)).map(a => r2(byAcc.get(a.id) ?? 0)).reduce((s, b) => s + b, 0);
  if (Math.abs(suspense) >= 1) alerts.push({ tone: "warn", text: `${inr(suspense)} is sitting in Suspense — reclassify it to the right ledgers.`, href: "/finance/ledger", action: "Review" });

  // Customers with an open balance and no activity for 60+ days
  const debtorIds = new Set(accounts.filter(isDebtor).map(a => a.id));
  const parties = new Map<string, { bal: number; last: string }>();
  for (const j of journals) {
    if (j.date > asOf) continue;
    const net = j.lines.filter(l => debtorIds.has(l.account_id)).reduce((s, l) => s + l.dr - l.cr, 0);
    if (!net || !j.party_name) continue;
    const p = parties.get(j.party_name) ?? { bal: 0, last: j.date };
    p.bal += net; if (j.date > p.last) p.last = j.date;
    parties.set(j.party_name, p);
  }
  const stale = [...parties.entries()].filter(([, p]) => p.bal >= 1 && days(p.last, today) >= 60).sort((a, b) => b[1].bal - a[1].bal);
  if (stale.length) alerts.push({ tone: "warn", text: `${stale[0][0]} owes ${inr(stale[0][1].bal)} with no activity for ${days(stale[0][1].last, today)} days${stale.length > 1 ? ` (+${stale.length - 1} more customer${stale.length > 2 ? "s" : ""})` : ""}.`, href: "/finance/receivables", action: "Follow up" });

  // GST: every figure comes from gst3bByMonth — the same function as the GSTR-3B page — for its own month
  const hasGstin = !!(extra.business?.gstin ?? "").trim();
  const gstMonths = gst3bByMonth(accounts, lines.filter(l => l.date <= asOf));
  const gst = gst3bCash(gstMonths, month.from.slice(0, 7));
  if (hasGstin && gst >= 1) alerts.push({ tone: "info", text: `GST payable for ${month.label} so far: ${inr(gst)}.`, href: "/finance/gst/3b", action: "GSTR-3B" });
  if (!hasGstin && accounts.some(a => /\bgst\b/i.test(a.name) && lines.some(l => l.account_id === a.id)))
    alerts.push({ tone: "info", text: "Add your GSTIN to see GST due dates and amounts.", href: "/finance/settings/business", action: "Add GSTIN" });

  if (lPL.netProfit > 0 && mPL.netProfit < lPL.netProfit * 0.8 && today.slice(8) >= "20") {
    alerts.push({ tone: "warn", text: `Profit for ${month.label} (${inr(mPL.netProfit)}) is ${Math.round((1 - mPL.netProfit / lPL.netProfit) * 100)}% below ${last.label}.`, href: "/finance/chat-book", action: "Ask why" });
  }

  const recent = journals.filter(j => j.date <= today).sort((a, b) => b.date.localeCompare(a.date) || b.entry_no.localeCompare(a.entry_no)).slice(0, 8).map(j => ({
    id: j.id, date: j.date, entry_no: j.entry_no, narration: j.narration, type: j.type, amount: r2(j.lines.reduce((s, l) => s + l.dr, 0)),
  }));

  // Recording streak: days with at least one dated entry, counted back from today (today may still be empty)
  const dated = new Set(journals.map(j => j.date));
  const dayStr = (k: number) => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); };
  const activity = Array.from({ length: 14 }, (_, i) => dated.has(dayStr(13 - i)));
  let streak = 0;
  for (let k = dated.has(today) ? 0 : 1; k < 400 && dated.has(dayStr(k)); k++) streak++;

  // Books health: start at 100, every deduction is listed
  const reasons: string[] = [];
  let score = 100;
  if (extra.pendingReview) { score -= Math.min(30, extra.pendingReview * 5); reasons.push(`${extra.pendingReview} item${extra.pendingReview > 1 ? "s" : ""} waiting for review`); }
  if (extra.drafts) { score -= Math.min(20, extra.drafts * 4); reasons.push(`${extra.drafts} unposted draft${extra.drafts > 1 ? "s" : ""}`); }
  const bad = alerts.filter(a => a.tone === "bad").length, warn = alerts.filter(a => a.tone === "warn").length;
  if (bad) { score -= bad * 10; reasons.push(`${bad} balance problem${bad > 1 ? "s" : ""}`); }
  if (warn) { score -= warn * 5; reasons.push(`${warn} warning${warn > 1 ? "s" : ""}`); }
  if (!activity.slice(-7).some(Boolean)) { score -= 10; reasons.push("nothing recorded in the last 7 days"); }

  // Smart insight: an expense ledger running well above its 6-month average
  let insight: Dashboard["insight"] = null;
  const months = Array.from({ length: 7 }, (_, i) => monthPeriod(today, i - 6));
  const expAccs = accounts.filter(a => groupOf(a) === "indirect_expense" || groupOf(a) === "purchase");
  let best = 0;
  for (const a of expAccs) {
    const spark = months.map(m => r2(lines.filter(l => l.account_id === a.id && l.date >= m.from && l.date <= m.to).reduce((s, l) => s + l.dr - l.cr, 0)));
    const prior = spark.slice(0, 6), avg = prior.reduce((s, v) => s + v, 0) / 6, now = spark[6];
    if (prior.filter(v => v > 0).length < 3 || avg <= 0 || now - avg < 1000) continue;
    const pct = (now / avg - 1) * 100;
    if (pct >= 30 && pct > best) { best = pct; insight = { text: `${a.name} is ${Math.round(pct)}% above your 6-month average`, account: a.name, spark, href: `/finance/ledger?account=${a.id}` }; }
  }

  // GST return due dates (monthly filer): GSTR-1 on the 11th, GSTR-3B on the 20th, for last month
  const gstDue: Dashboard["gst"] = [];
  for (const [form, day] of (hasGstin ? [["GSTR-1", 11], ["GSTR-3B", 20]] as const : [])) {
    const base = new Date(today + "T00:00:00Z");
    let due = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
    if (due.toISOString().slice(0, 10) < today) due = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, day));
    const per = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() - 1, 1));
    gstDue.push({ form, period: per.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }), due: due.toISOString().slice(0, 10), daysLeft: days(today, due.toISOString().slice(0, 10)) });
  }

  // Compliance calendar: which deadlines apply, and what is owed now (credit balances of the liability ledgers)
  const owed = (re: RegExp, not?: RegExp) => r2(accounts.filter(a => re.test(a.name) && !(not && not.test(a.name))).reduce((s, a) => s - (byAcc.get(a.id) ?? 0), 0));
  const tdsOwed = owed(/tds/i, /receivable|asset|advance/i);
  const ptOwed = owed(/professional tax|\bp\.?\s?tax\b|profession tax/i, /expense/i);
  const pfOwed = owed(/\b(pf|epf|esi|esic|provident)\b/i, /expense|contribution exp|employer.*exp/i);
  const used = (re: RegExp) => accounts.some(a => re.test(a.name) && lines.some(l => l.account_id === a.id));
  const country = (extra.business?.country ?? "IN").toUpperCase();
  const setup = { gst: hasGstin, tds: !!extra.business?.tan || used(/tds payable|tds on/i), payroll: used(/salar|wages|\b(pf|epf|esi|esic)\b/i), country };
  const compliance = country !== "IN" ? worldDueDates(today, {
    country, fyStart: extra.business?.fyStart ?? null,
    taxRegistered: !!extra.business?.gstin || used(/\bvat\b|\bgst\b/i),
    payroll: used(/salar|wages|payroll|gosi|cpf|paye/i),
    wht: used(/withholding|\bwht\b/i),
    amounts: { vat: gst > 0 ? r2(gst) : undefined },
  }) : dueDates(today, {
    gst: hasGstin,
    tds: !!extra.business?.tan || used(/tds payable|tds on/i),
    payroll: used(/\b(pf|epf|esi|esic|provident)\b/i),
    audit: !!extra.business?.audit,
    pt: used(/salar|wages|professional tax|profession tax/i),
    state: extra.business?.state ?? null,
    amounts: { gstByPeriod: Object.fromEntries([...gstMonths].map(([ym, m]) => [ym, m.cash])), tds: tdsOwed > 0 ? tdsOwed : undefined, pf: pfOwed > 0 ? pfOwed : undefined, pt: ptOwed > 0 ? ptOwed : undefined },
  });

  return {
    compliance, complianceSetup: setup,
    activity, streak, health: { score: Math.max(0, score), reasons }, insight, gst: gstDue,
    period: fy, month,
    cash: balance(isCashBank, 1), ...(() => { const x = arAp(accounts, lines, asOf); return { receivables: x.toReceive, payables: x.toPay }; })(),
    revenue: r2(yearPL.revenue + yearPL.otherIncome), expenses: r2(yearPL.cogs + yearPL.expenses), profit: r2(yearPL.netProfit),
    monthRevenue: r2(mPL.revenue + mPL.otherIncome), monthProfit: r2(mPL.netProfit), lastMonthProfit: r2(lPL.netProfit),
    recent, alerts, currency: fmt.currency, locale: fmt.locale,
  };
}
