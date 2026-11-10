// Scheduled WhatsApp reminders to the owner: payments they must make (bills, rent, EMIs), customer reminders to forward,
// compliance due dates, and a daily summary of the books. Pure: the cron loads the data, this decides what is due and
// writes the words. FreBook never messages customers — the owner forwards the ready-made reminders themselves.
import type { DueItem } from "./compliance";

export type Repeat = "once" | "weekly" | "monthly" | "quarterly" | "yearly";
export type PayReminder = {
  id: string; title: string; party: string | null; amount: number | null; due_date: string; repeat: Repeat;
  remind_before: number;   // start this many days before the due date
  every_days: number;      // then remind every N days (1 = daily) until it is marked paid
  kind: "payment" | "emi"; status: "active" | "paid" | "stopped"; last_sent: string | null;
};

const DAY = 86400000;
export const daysFrom = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY);
const inr = (n: number) => "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
const short = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Is a payment reminder due today? From `remind_before` days ahead, every `every_days`, and every day once overdue. */
export function paymentDue(r: PayReminder, today: string): boolean {
  if (r.status !== "active") return false;
  const left = daysFrom(today, r.due_date);
  if (left > r.remind_before) return false;
  if (!r.last_sent) return true;
  if (r.last_sent >= today) return false;
  return left < 0 || daysFrom(r.last_sent, today) >= Math.max(1, r.every_days);
}

/** The next due date of a recurring payment (the day of month is kept where the month allows). */
export function nextDue(date: string, repeat: Repeat): string | null {
  if (repeat === "once") return null;
  const [y, m, d] = date.split("-").map(Number);
  if (repeat === "weekly") return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  const add = repeat === "monthly" ? 1 : repeat === "quarterly" ? 3 : 12;
  const last = new Date(Date.UTC(y, m - 1 + add + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + add, Math.min(d, last))).toISOString().slice(0, 10);
}

export function whenText(due: string, today: string): string {
  const left = daysFrom(today, due);
  return left === 0 ? "due *today*" : left === 1 ? "due tomorrow" : left > 1 ? `due in ${left} days (${short(due)})` : `*${-left} day${left === -1 ? "" : "s"} overdue* (${short(due)})`;
}
export const paymentLine = (r: PayReminder, today: string) =>
  `• ${r.kind === "emi" ? "EMI — " : ""}${r.title}${r.party ? ` to ${r.party}` : ""}${r.amount ? ` · ${inr(r.amount)}` : ""} · ${whenText(r.due_date, today)}`;

/** Receivable reminder frequency → days between messages. */
export const FREQ_DAYS: Record<string, number> = { daily: 1, every3: 3, weekly: 7, fortnightly: 14, monthly: 30 };
export function everyDue(freq: string, today: string, last: string | null): boolean {
  const n = FREQ_DAYS[freq];
  if (!n) return false;
  return !last || (last < today && daysFrom(last, today) >= n);
}

/** Compliance items to remind about: not filed, due within `before` days, or overdue (up to a month back). */
export const complianceDueNow = (items: DueItem[], before: number) => items.filter(i => !i.filed && i.daysLeft <= before && i.daysLeft >= -30);
export const complianceLine = (i: DueItem, today: string) => `• ${i.title} — ${i.period}${i.amount ? ` · ${inr(i.amount)}` : ""} · ${whenText(i.due, today)}`;

export type Bal = { name: string; balance: number };
export type Summary = {
  business: string; today: string;
  salesToday: number; salesMonth: number; receiptsToday: number; paymentsToday: number;
  cash: Bal[]; bank: Bal[]; loans: Bal[];
  receivables: number; payables: number;
  emiSoon: PayReminder[];
};

export function summaryText(s: Summary): string {
  const sum = (b: Bal[]) => b.reduce((t, x) => t + x.balance, 0);
  const list = (b: Bal[]) => b.filter(x => Math.abs(x.balance) >= 1).slice(0, 6).map(x => `   ${x.name}: ${x.balance < 0 ? "−" : ""}${inr(x.balance)}`).join("\n");
  const lines = [
    `📊 *${s.business}* — ${new Date(s.today + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`,
    "",
    `🧾 Sales today: *${inr(s.salesToday)}* · this month ${inr(s.salesMonth)}`,
    `⬇ Received today ${inr(s.receiptsToday)} · ⬆ Paid today ${inr(s.paymentsToday)}`,
    `💵 Cash: *${inr(sum(s.cash))}*${s.cash.length > 1 ? `\n${list(s.cash)}` : ""}`,
    `🏦 Bank: *${sum(s.bank) < 0 ? "−" : ""}${inr(sum(s.bank))}*${s.bank.length ? `\n${list(s.bank)}` : ""}`,
  ];
  if (s.loans.some(l => Math.abs(l.balance) >= 1)) lines.push(`🏛 Loans outstanding: *${inr(sum(s.loans))}*\n${list(s.loans)}`);
  if (s.emiSoon.length) lines.push(`📅 EMIs due this week:\n${s.emiSoon.map(r => paymentLine(r, s.today)).join("\n")}`);
  lines.push(`📥 Customers owe you: ${inr(Math.max(0, s.receivables))} · 📤 You owe suppliers: ${inr(Math.max(0, s.payables))}`);
  return lines.join("\n");
}
/** One line for the WhatsApp template (variables can't hold line breaks). */
export function summaryOneLine(s: Summary): string {
  const sum = (b: Bal[]) => b.reduce((t, x) => t + x.balance, 0);
  return `Sales today ${inr(s.salesToday)}, cash ${inr(sum(s.cash))}, bank ${inr(sum(s.bank))}${s.loans.length ? `, loans ${inr(sum(s.loans))}` : ""}, receivables ${inr(Math.max(0, s.receivables))}`;
}

export type Digest = { summary?: string; payments: string[]; compliance: string[]; receivables?: string };
/** The one message the owner gets at their chosen hour. */
export function digestText(business: string, d: Digest): string {
  const parts: string[] = [];
  if (d.summary) parts.push(d.summary);
  if (d.payments.length) parts.push(`⏰ *Payments to make*\n${d.payments.join("\n")}`);
  if (d.compliance.length) parts.push(`🗓 *Compliance due*\n${d.compliance.join("\n")}`);
  if (d.receivables) parts.push(d.receivables);
  if (!parts.length) return "";
  return `${parts.join("\n\n")}\n\n_Mark a payment done in FreBook → Reminders · reply SUMMARY for this update any time · LIST for customer reminders to forward._`.replace(/^/, d.summary ? "" : `🔔 *${business}*\n\n`);
}
export function digestOneLine(d: Digest, s?: Summary): string {
  const bits: string[] = [];
  if (s) bits.push(summaryOneLine(s));
  if (d.payments.length) bits.push(`${d.payments.length} payment${d.payments.length > 1 ? "s" : ""} due`);
  if (d.compliance.length) bits.push(`${d.compliance.length} compliance due date${d.compliance.length > 1 ? "s" : ""}`);
  if (d.receivables) bits.push("customer reminders ready");
  return bits.join(" · ").slice(0, 900);
}
