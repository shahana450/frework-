// AI Accounting Correction Assistant — the correction is built here as a draft (never posted by this module).
// A wrong head is fixed with a transfer journal that moves the amount (the original stays untouched); a wholly wrong
// entry is fixed by reversing it and posting a fresh one. Posting happens only after approval, through the normal
// posting service, which enforces balance, financial-year and period locks.
import type { QJournal } from "../bookQueries";

export type CLine = { accountId: string; account: string; dr: number; cr: number };
export type CorrectionDraft = {
  kind: "reclass" | "reverse_and_repost";
  journalId: string; entryNo: string; date: string; reason: string;
  lines: CLine[];                 // the correcting entry (for reverse_and_repost: the fresh entry after the reversal)
  explanation: string; taxNote: string;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Move `amount` (default: everything the entry put there) from one ledger to another. */
export function buildReclass(j: QJournal, names: Map<string, string>, fromId: string, toId: string, reason: string, amount?: number): CorrectionDraft {
  const on = j.lines.filter(l => l.account_id === fromId);
  if (!on.length) throw new Error("That ledger isn't in the entry.");
  if (fromId === toId) throw new Error("Choose a different ledger.");
  const dr = r2(on.reduce((s, l) => s + (+l.dr || 0), 0)), cr = r2(on.reduce((s, l) => s + (+l.cr || 0), 0));
  const net = r2(dr - cr); const amt = r2(amount ?? Math.abs(net));
  if (!(amt > 0) || amt > Math.abs(net) + 0.005) throw new Error("The amount must be more than zero and not more than what the entry put on that ledger.");
  const from = names.get(fromId) ?? "?", to = names.get(toId) ?? "?";
  const lines: CLine[] = net > 0
    ? [{ accountId: toId, account: to, dr: amt, cr: 0 }, { accountId: fromId, account: from, dr: 0, cr: amt }]
    : [{ accountId: fromId, account: from, dr: amt, cr: 0 }, { accountId: toId, account: to, dr: 0, cr: amt }];
  return { kind: "reclass", journalId: j.id, entryNo: j.entry_no, date: j.date, reason, lines,
    explanation: `${j.entry_no} put ${amt.toLocaleString("en-IN")} on ${from}. This journal moves it to ${to}; ${j.entry_no} itself is not changed.`,
    taxNote: taxNoteFor(from, to) };
}

export function taxNoteFor(from: string, to: string): string {
  const asset = (s: string) => /machin|plant|equipment|furniture|computer|vehicle|building|asset/i.test(s);
  if (asset(from) && !asset(to)) return "Moving from an asset to an expense: depreciation already claimed on it should be reversed, and the expense is deducted this year. Input GST stays available unless the expense head is blocked (s.17(5)).";
  if (!asset(from) && asset(to)) return "Moving from an expense to an asset: the cost is capitalised and depreciated instead of deducted. Check whether an asset register entry is needed.";
  if (/gst/i.test(from + to)) return "This changes a GST ledger: re-check GSTR-3B for the month, and pay or reverse the difference with interest where due.";
  if (/tds/i.test(from + to)) return "This changes a TDS ledger: check the TDS return and challan for the quarter.";
  return "Profit is unchanged if both ledgers are of the same kind; only the head changes.";
}

export function validateCorrection(lines: CLine[]): string | null {
  if (lines.length < 2) return "A correction needs at least two lines.";
  if (lines.some(l => (l.dr > 0 && l.cr > 0) || l.dr < 0 || l.cr < 0)) return "Each line is either a debit or a credit, never negative.";
  const dr = r2(lines.reduce((s, l) => s + l.dr, 0)), cr = r2(lines.reduce((s, l) => s + l.cr, 0));
  if (Math.abs(dr - cr) >= 0.01) return `Debits (${dr}) and credits (${cr}) don't agree.`;
  if (!(dr > 0)) return "The correction has no amount.";
  return null;
}
