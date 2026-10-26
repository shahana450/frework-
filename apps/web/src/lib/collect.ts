// Who owes you, how old it is, and what to say. Payments clear the oldest invoices first (FIFO).
import { type Account } from "./books";
import { isReceivable } from "./partyBalances";
import type { QJournal } from "./bookQueries";

export type OpenInvoice = { date: string; ref: string; amount: number; days: number };
export type Debtor = {
  name: string; balance: number; oldestDays: number; open: OpenInvoice[];
  lastPayment: string | null; bucket: "0-30" | "31-60" | "60+";
  phone?: string | null;
};
export type Collect = { total: number; owed: number; advances: number; buckets: { "0-30": number; "31-60": number; "60+": number }; collectedThisMonth: number; debtors: Debtor[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const isDebtorAccount = (a: Account) => isReceivable(a) || a.type === "debtor";
const GENERIC = /^(sundry\s+)?debtors?$|^trade receivables?$|^accounts? receivable$/i;

export function bucketOf(days: number): Debtor["bucket"] { return days > 60 ? "60+" : days > 30 ? "31-60" : "0-30"; }

export function computeCollect(accounts: Account[], journals: QJournal[], today: string): Collect {
  const debtorIds = new Set(accounts.filter(isDebtorAccount).map(a => a.id));
  const nameOf = new Map(accounts.map(a => [a.id, a.name]));
  const parties = new Map<string, { inv: OpenInvoice[]; credit: number; lastPayment: string | null }>();
  const monthStart = today.slice(0, 8) + "01";
  let collectedThisMonth = 0;

  for (const j of [...journals].filter(j => j.date <= today).sort((a, b) => a.date.localeCompare(b.date) || a.entry_no.localeCompare(b.entry_no))) {
    for (const l of j.lines) {
      if (!debtorIds.has(l.account_id)) continue;
      const accName = nameOf.get(l.account_id) ?? "Customer";
      const party = (j.party_name?.trim() || (GENERIC.test(accName.trim()) ? "Unnamed customers" : accName)).trim();
      const p = parties.get(party) ?? { inv: [], credit: 0, lastPayment: null };
      if (l.dr > 0) p.inv.push({ date: j.date, ref: j.entry_no, amount: l.dr, days: 0 });
      if (l.cr > 0) {
        p.credit += l.cr; p.lastPayment = j.date;
        if (j.date >= monthStart) collectedThisMonth += l.cr;
      }
      parties.set(party, p);
    }
  }

  const debtors: Debtor[] = [];
  let advances = 0;   // customers who paid more than they were billed (shown separately; the total is net, like every other screen)
  for (const [name, p] of parties) {
    const billed = p.inv.reduce((s, i) => s + i.amount, 0);
    if (p.credit - billed >= 1) advances = r2(advances + p.credit - billed);
    let credit = p.credit;
    const open: OpenInvoice[] = [];
    for (const inv of p.inv) {
      const left = r2(inv.amount - Math.min(credit, inv.amount));
      credit = r2(Math.max(0, credit - inv.amount));
      if (left >= 1) open.push({ ...inv, amount: left, days: Math.max(0, daysBetween(inv.date, today)) });
    }
    const balance = r2(open.reduce((s, i) => s + i.amount, 0));
    if (balance < 1) continue;
    const oldestDays = open[0]?.days ?? 0;
    debtors.push({ name, balance, oldestDays, open, lastPayment: p.lastPayment, bucket: bucketOf(oldestDays) });
  }
  // Riskiest first: oldest, then biggest
  debtors.sort((a, b) => b.oldestDays - a.oldestDays || b.balance - a.balance);

  const buckets = { "0-30": 0, "31-60": 0, "60+": 0 };
  for (const d of debtors) for (const i of d.open) buckets[bucketOf(i.days)] = r2(buckets[bucketOf(i.days)] + i.amount);
  const owed = r2(debtors.reduce((s, d) => s + d.balance, 0));
  return { total: r2(owed - advances), owed, advances, buckets, collectedThisMonth: r2(collectedThisMonth), debtors };
}

export type Tone = "polite" | "firm" | "malayalam";
export function reminderText(d: Debtor, business: string, tone: Tone, fmt: (n: number) => string, upi?: string | null): string {
  const refs = d.open.map(i => i.ref).slice(0, 4).join(", ");
  const since = d.open[0] ? new Date(d.open[0].date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : "";
  const amt = fmt(d.balance);
  const pay = upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(business)}&am=${d.balance.toFixed(2)}&cu=INR` : "";
  if (tone === "malayalam") {
    return `നമസ്കാരം ${d.name},\n${since} മുതൽ ${refs} എന്നീ ബില്ലുകളിലായി ${amt} അടയ്ക്കാൻ ബാക്കിയുണ്ട്. ദയവായി എത്രയും വേഗം അടയ്ക്കുമല്ലോ.${pay ? `\nUPI വഴി അടയ്ക്കാൻ: ${pay}` : ""}\n— ${business}`;
  }
  if (tone === "firm") {
    return `Dear ${d.name},\n${amt} against ${refs} has been outstanding since ${since} (${d.oldestDays} days). Please clear it within 3 days or let us know the payment date.${pay ? `\nPay via UPI: ${pay}` : ""}\n— ${business}`;
  }
  return `Hi ${d.name}, a gentle reminder that ${refs} for ${amt} ${d.open.length > 1 ? "are" : "is"} pending since ${since}. Thank you!${pay ? `\nPay securely via UPI: ${pay}` : ""}\n— ${business}`;
}
