// Loads what the reminders need for one business: the daily summary figures, compliance due dates (same engine as
// the dashboard, with filed returns and Shelf notices), payment reminders and overdue customers.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadQueryBooks, loadBusinessContext } from "./intentEngine";
import { computeDashboard } from "./dashboard";
import { markFiled, type FetchedStatus } from "./portals/match";
import { loadOverdue, listMessage, alertText } from "./collectAlert";
import { complianceDueNow, complianceLine, daysFrom, everyDue, paymentDue, paymentLine, summaryText, type Bal, type Digest, type PayReminder, type Summary } from "./reminders";
import type { DueItem } from "./compliance";

const r2 = (n: number) => Math.round(n * 100) / 100;
const isCash = (a: { name: string; type: string; sub_type: string | null }) => a.sub_type === "cash" || (a.type === "asset" && /\b(cash|petty cash)\b/i.test(a.name) && !/bank|cash credit/i.test(a.name));
const isBank = (a: { name: string; type: string; sub_type: string | null }) => a.sub_type === "bank" || (a.type === "asset" && /\bbank\b/i.test(a.name) && !/charges|commission|interest/i.test(a.name));
const isLoan = (a: { name: string; type: string; sub_type: string | null }) => a.type === "liability" && (a.sub_type === "long_term_liability" || /\b(loan|od|overdraft|cash credit|borrowing)s?\b/i.test(a.name));

export type BizReminderData = { business: string; summary: Summary; compliance: DueItem[]; payments: PayReminder[] };

export async function loadReminderData(sb: SupabaseClient, bizId: string, today: string): Promise<BizReminderData | null> {
  const [{ data: fy }, books, ctx, { data: bizRow }, pays] = await Promise.all([
    sb.from("fw_fin_financial_years").select("label,start_date,end_date").eq("business_id", bizId).lte("start_date", today).gte("end_date", today).maybeSingle(),
    loadQueryBooks(sb, bizId, today),
    loadBusinessContext(sb, bizId),
    sb.from("fw_fin_businesses").select("*").eq("id", bizId).maybeSingle(),
    sb.from("fw_fin_payment_reminders").select("*").eq("business_id", bizId).eq("status", "active"),
  ]);
  if (books.error) return null;
  const b = (bizRow ?? {}) as Record<string, unknown>;
  const y = today.slice(5) >= "04-01" ? +today.slice(0, 4) : +today.slice(0, 4) - 1;
  const period = fy ? { from: fy.start_date, to: fy.end_date, label: `FY ${String(fy.label).replace(/^FY\s*/i, "")}` } : { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}-${String(y + 1).slice(2)}` };
  const dash = computeDashboard(books.accounts, books.journals, today, period, { pendingReview: 0, drafts: 0, business: { gstin: (b.gstin as string) ?? null, tan: (b.tan as string) ?? null, audit: !!b.tax_audit, state: (b.state as string) ?? null, country: (b.country as string) ?? "IN", fyStart: (b.fiscal_year_start as string) ?? null } }, { currency: ctx.baseCurrency, locale: "en-IN" });

  // Compliance: add open Shelf notices, mark returns already filed on the portals
  const { data: notices } = await sb.from("fw_fin_shelf_items").select("id,title,period,reply_due,amount").eq("business_id", bizId).is("deleted_at", null).eq("status", "open").not("reply_due", "is", null);
  let compliance = [...dash.compliance];
  for (const n of (notices ?? []) as { id: string; title: string; period: string | null; reply_due: string; amount: number | null }[])
    compliance.push({ key: `notice-${n.id}`, kind: "notice", title: `Reply to ${n.title}`, period: n.period ?? "Notice", due: n.reply_due, daysLeft: daysFrom(today, n.reply_due), amount: n.amount ? Number(n.amount) : null, href: "/finance/shelf?rack=notices" });
  const { data: filed } = await sb.from("fw_fin_portal_status").select("portal,form,period,status,arn,filed_on,demo").eq("business_id", bizId).in("kind", ["return", "itr"]);
  if (filed?.length) compliance = markFiled(compliance, filed as FetchedStatus[]);
  compliance.sort((a, c) => a.due.localeCompare(c.due));

  // Balances as on today, and today's movements
  const acc = new Map(books.accounts.map(a => [a.id, a]));
  const bal = new Map<string, number>();
  let salesToday = 0, salesMonth = 0, receiptsToday = 0, paymentsToday = 0;
  const month = today.slice(0, 7);
  for (const j of books.journals) {
    if (j.date > today) continue;
    for (const l of j.lines) bal.set(l.account_id, r2((bal.get(l.account_id) ?? 0) + (+l.dr || 0) - (+l.cr || 0)));
    const sales = j.lines.filter(l => { const a = acc.get(l.account_id); return !!a && a.type === "income" && (j.type === "sales" || /\bsales?\b|revenue|turnover/i.test(a.name)); }).reduce((s, l) => s + (+l.cr || 0) - (+l.dr || 0), 0);
    if (j.date === today) salesToday += sales;
    if (j.date.startsWith(month)) salesMonth += sales;
    if (j.date === today) {
      const money = j.lines.filter(l => { const a = acc.get(l.account_id); return !!a && (isCash(a) || isBank(a)); });
      if (money.length < j.lines.length) { receiptsToday += money.reduce((s, l) => s + (+l.dr || 0), 0); paymentsToday += money.reduce((s, l) => s + (+l.cr || 0), 0); }
    }
  }
  const pick = (f: (a: { name: string; type: string; sub_type: string | null }) => boolean, sign = 1): Bal[] =>
    books.accounts.filter(a => !(a as { is_group?: boolean }).is_group && f(a)).map(a => ({ name: a.name, balance: r2(sign * (bal.get(a.id) ?? 0)) })).filter(x => Math.abs(x.balance) >= 1).sort((p, q) => Math.abs(q.balance) - Math.abs(p.balance));
  const payments = ((pays.error ? [] : pays.data ?? []) as PayReminder[]).map(p => ({ ...p, amount: p.amount != null ? Number(p.amount) : null }));
  const summary: Summary = {
    business: ctx.name || String(b.name ?? ""), today, salesToday: r2(salesToday), salesMonth: r2(salesMonth), receiptsToday: r2(receiptsToday), paymentsToday: r2(paymentsToday),
    cash: pick(isCash), bank: pick(a => isBank(a) && !isLoan(a)), loans: pick(isLoan, -1),
    receivables: dash.receivables, payables: dash.payables,
    emiSoon: payments.filter(p => p.kind === "emi" && daysFrom(today, p.due_date) <= 7 && daysFrom(today, p.due_date) >= -30),
  };
  return { business: summary.business, summary, compliance, payments };
}

export type LinkPrefs = {
  daily_summary: boolean; compliance_alert: boolean; compliance_before: number;
  collect_alert: string; collect_alert_days: number; collect_alert_last: string | null;
  summary_last: string | null; compliance_last: string | null;
};

/** What goes in today's message for one linked number. `force` (a test, or SUMMARY) includes everything current. */
export async function buildDigest(sb: SupabaseClient, bizId: string, today: string, d: BizReminderData, p: LinkPrefs, force = false): Promise<{ digest: Digest; dueIds: string[]; sentReceivables: boolean; sentSummary: boolean; sentCompliance: boolean }> {
  const sentSummary = p.daily_summary && (force || p.summary_last !== today);
  const dueComp = complianceDueNow(d.compliance, p.compliance_before);
  const sentCompliance = p.compliance_alert && dueComp.length > 0 && (force || p.compliance_last !== today);
  const due = d.payments.filter(r => force ? daysFrom(today, r.due_date) <= r.remind_before : paymentDue(r, today));
  let receivables: string | undefined;
  let sentReceivables = false;
  if (p.collect_alert !== "off" && (force || everyDue(p.collect_alert, today, p.collect_alert_last))) {
    const r = await loadOverdue(sb, bizId, p.collect_alert_days, today).catch(() => null);
    if (r?.overdue.length) { receivables = `${alertText(r.business || d.business, r.overdue, p.collect_alert_days).split("\n\n")[0]}\n\n${listMessage(r.business || d.business, r.overdue, p.collect_alert_days, 5)}`; sentReceivables = true; }
  }
  return {
    digest: { summary: sentSummary ? summaryText(d.summary) : undefined, payments: due.map(r => paymentLine(r, today)), compliance: sentCompliance ? dueComp.map(i => complianceLine(i, today)) : [], receivables },
    dueIds: due.map(r => r.id), sentReceivables, sentSummary, sentCompliance,
  };
}
