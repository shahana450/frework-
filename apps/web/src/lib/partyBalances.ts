// Receivables / payables by party (B2): one ledger per customer or supplier (Sundry Debtors / Creditors).
// Balance = the ledger's balance; ageing = the oldest debit (receivables) or credit (payables) not yet settled,
// settling oldest first (FIFO). Credit balances on customers are advances and are shown, not hidden. Pure.
import { inferHead } from "./ledgerHeads";

export type PartyAccount = { id: string; name: string; type?: string; sub_type?: string | null; is_group?: boolean | null };
export type PartyLine = { account_id: string; dr: number; cr: number; date: string };
export type PartyRow = { id: string; name: string; balance: number; status: "owes" | "advance"; oldest: string | null; days: number; bucket: "0-30" | "31-60" | "61-90" | "90+" | "advance" };
export type PartyReport = { rows: PartyRow[]; total: number; owed: number; advances: number; buckets: Record<PartyRow["bucket"], number> };

const r2 = (n: number) => Math.round(n * 100) / 100;
// A tax, loan or advance ledger is never a customer / supplier, whatever its name ("TDS Receivable", "GST Payable")
const NOT_PARTY = /\b(tds|tcs|gst|igst|cgst|sgst|cess|tax|interest|loan|advance|salary|salaries|wages|rent|expenses?|provision)\b/i;
/** THE rule for a customer ledger (Sundry Debtors) — every receivable figure uses it. */
export const isReceivable = (a: PartyAccount) => !a.is_group && (a.sub_type === "trade_receivables" ||
  ((!a.sub_type || a.sub_type === "current_asset") && !NOT_PARTY.test(a.name) && (inferHead(a.name)?.key === "debtors" || /\b(debtors?|receivables?)\b/i.test(a.name))));
/** THE rule for a supplier ledger (Sundry Creditors). */
export const isPayable = (a: PartyAccount) => !a.is_group && (a.sub_type === "trade_payables" ||
  ((!a.sub_type || a.sub_type === "current_liability") && !NOT_PARTY.test(a.name) && (inferHead(a.name)?.key === "creditors" || /\b(creditors?|payables?)\b/i.test(a.name))));

export function partyBalances(kind: "receivable" | "payable", accounts: PartyAccount[], lines: PartyLine[], today: string): PartyReport {
  const pick = kind === "receivable" ? isReceivable : isPayable;
  const parties = accounts.filter(pick);
  const rows: PartyRow[] = [];
  for (const a of parties) {
    const own = lines.filter(l => l.account_id === a.id && l.date <= today).sort((x, y) => x.date.localeCompare(y.date));
    // Receivable: debits are bills raised, credits are receipts. Payable: the other way round.
    const raised = own.map(l => ({ date: l.date, amt: kind === "receivable" ? l.dr : l.cr })).filter(x => x.amt > 0);
    const settled = own.reduce((s, l) => s + (kind === "receivable" ? l.cr : l.dr), 0);
    const balance = r2(raised.reduce((s, x) => s + x.amt, 0) - settled);
    if (balance === 0) continue;
    let left = settled, oldest: string | null = null;
    for (const x of raised) { if (left >= x.amt - 0.005) { left -= x.amt; continue; } oldest = x.date; break; }
    const days = oldest ? Math.max(0, Math.round((Date.parse(today) - Date.parse(oldest)) / 86400000)) : 0;
    const bucket: PartyRow["bucket"] = balance < 0 ? "advance" : days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    rows.push({ id: a.id, name: a.name, balance, status: balance < 0 ? "advance" : "owes", oldest: balance < 0 ? null : oldest, days: balance < 0 ? 0 : days, bucket });
  }
  rows.sort((x, y) => y.balance - x.balance);
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0, advance: 0 } as PartyReport["buckets"];
  for (const r of rows) buckets[r.bucket] = r2(buckets[r.bucket] + r.balance);
  const owed = r2(rows.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0));
  const advances = r2(rows.filter(r => r.balance < 0).reduce((s, r) => s + r.balance, 0));
  return { rows, total: r2(owed + advances), owed, advances, buckets };
}

/**
 * THE receivables / payables figures. Dashboard "To receive / To pay", the MIS report and the Receivables and
 * Payables pages all read these, so they can never disagree. toReceive = what customers owe less their advances;
 * toPay = what we owe suppliers less our advances to them.
 */
export function arAp(accounts: PartyAccount[], lines: PartyLine[], today: string) {
  const receivable = partyBalances("receivable", accounts, lines, today);
  const payable = partyBalances("payable", accounts, lines, today);
  return { receivable, payable, toReceive: receivable.total, toPay: payable.total };
}
