// validateJournal — the one set of rules every entry source goes through (FreBook chat, bank import, invoices,
// bills, Tally import, manual JV, WhatsApp, connectors, opening balances). postJournal() calls it; the database
// function fw_fin_post_journal repeats the hard rules so nothing can bypass them.
// Pure: the caller passes the ledgers, financial years and GST status it loaded.
import { PostingError, type PostingLine } from "./posting";

export type RuleAccount = { id: string; name: string; type?: string | null; sub_type?: string | null; is_group?: boolean | null };
export type RuleFy = { start_date: string; end_date: string; is_locked?: boolean | null };
export type RuleContext = {
  accounts: Map<string, RuleAccount>;
  fys: RuleFy[];                 // the business's financial years (empty = none set up yet)
  gstRegistered: boolean;        // the business has a GSTIN
  force?: boolean;               // owner/admin posting into a locked year
};
export type RuleResult = { lines: PostingLine[]; review: string[] };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
/** Cash and bank ledgers — by sub-type first, then by name for older books. Never "Bank Charges"/"Bank Interest". */
export const isCashBankAccount = (a?: RuleAccount | null) => !!a && (
  a.sub_type === "bank" || a.sub_type === "cash" || a.type === "bank" || a.type === "cash" ||
  (/\b(cash|bank)\b/i.test(a.name) && !/charges?|commission|interest|fees?|loan|overdraft charges/i.test(a.name) && (a.type ?? "asset") === "asset"));
export const isGstAccount = (a?: RuleAccount | null) => !!a && /\b(gst|igst|cgst|sgst|utgst|cess)\b/i.test(a.name);

export function validateJournal(input: { type: string; date: string; lines: PostingLine[] }, ctx: RuleContext): RuleResult {
  const { type, date } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) throw new PostingError("INVALID", `Invalid date "${date}"`);
  const lines = input.lines.map(l => ({ ...l, dr: r2(l.dr), cr: r2(l.cr) })).filter(l => l.dr !== 0 || l.cr !== 0);
  if (lines.length < 2) throw new PostingError("INVALID", "An entry needs at least two lines");
  for (const l of lines) {
    if (!l.accountId) throw new PostingError("ACCOUNT", "Every line needs an account");
    if (l.dr < 0 || l.cr < 0) throw new PostingError("INVALID", "Amounts cannot be negative");
    if (l.dr > 0 && l.cr > 0) throw new PostingError("INVALID", "A line cannot be both debit and credit");
    const a = ctx.accounts.get(l.accountId);
    if (!a) throw new PostingError("ACCOUNT", "An account does not belong to this business");
    if (a.is_group) throw new PostingError("ACCOUNT", `"${a.name}" is a group, not a ledger — choose a ledger under it`);
  }
  const dr = r2(lines.reduce((s, l) => s + l.dr, 0)), cr = r2(lines.reduce((s, l) => s + l.cr, 0));
  if (dr <= 0 || dr !== cr) throw new PostingError("UNBALANCED", `Debits ₹${dr.toFixed(2)} do not equal credits ₹${cr.toFixed(2)}`);

  // The same ledger can't be debited and credited in one entry (e.g. "Dr Bank Charges / Cr Bank Charges")
  const drIds = new Set(lines.filter(l => l.dr > 0).map(l => l.accountId));
  const both = lines.find(l => l.cr > 0 && drIds.has(l.accountId));
  if (both) throw new PostingError("INVALID", `"${ctx.accounts.get(both.accountId)!.name}" is on both the debit and the credit side`);

  // Receipts bring money into cash/bank, payments take it out, contra moves it between them
  const t = (type || "journal").toLowerCase();
  const cb = lines.filter(l => isCashBankAccount(ctx.accounts.get(l.accountId)));
  if (t === "receipt" && !cb.some(l => l.dr > 0)) throw new PostingError("INVALID", "A receipt must debit a cash or bank ledger");
  if (t === "payment" && !cb.some(l => l.cr > 0)) throw new PostingError("INVALID", "A payment must credit a cash or bank ledger");
  if (t === "contra" && (cb.length !== lines.length)) throw new PostingError("INVALID", "A contra entry moves money between cash and bank ledgers only");

  // The date must fall in one of the business's financial years, and not a locked one
  if (ctx.fys.length) {
    const fy = ctx.fys.filter(f => date >= f.start_date && date <= f.end_date).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    if (!fy) throw new PostingError("INVALID", `${date} is outside your financial years — add the year under Settings → Financial Years first`);
    if (fy.is_locked && !ctx.force) throw new PostingError("LOCKED", `The financial year containing ${date} is locked`);
  }

  // Not wrong, but worth a look before it reaches the books
  const review: string[] = [];
  if (ctx.gstRegistered && (t === "sales" || t === "purchase") && !lines.some(l => isGstAccount(ctx.accounts.get(l.accountId))))
    review.push(`A ${t === "sales" ? "sale" : "purchase"} of a GST-registered business with no GST lines — confirm it is exempt/nil-rated or add the GST`);
  return { lines, review };
}
