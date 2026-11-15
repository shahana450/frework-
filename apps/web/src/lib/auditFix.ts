// What to do about each 360° audit finding. Corrections are rectification entries (a new journal or a reversal) —
// the original is never edited, so the audit trail and Tally stay consistent: the new entry is pushed to Tally like any other.
import type { AuditCheck, AuditItem } from "./audit360";

export type Fix = { text: string; href?: string; cta?: string };
export type ItemFix = "reclass" | "reverse" | "open" | null;

export function fixFor(c: Pick<AuditCheck, "id" | "section" | "status" | "diff">): Fix | null {
  if (c.status === "ok" || c.status === "na") return null;
  const gstLink = { href: "/finance/gst/reconcile", cta: "Open GSTR-1 / 3B vs Books" };
  switch (c.id) {
    case "suspense_nil": return { text: "Find what each suspense amount really is and move it to the right ledger — use Move below. A journal (Dr/Cr the right ledger, the opposite to Suspense) is posted and sent to Tally." };
    case "duplicates": return { text: "Open each pair and confirm. If it is a real duplicate, Reverse it below — a reversal entry cancels it (and is sent to Tally); the original stays for the audit trail." };
    case "drafts": return { text: "Drafts are not in the books. Open each one and post it, or delete it if it isn't needed.", href: "/finance/journals?status=draft", cta: "Open drafts" };
    case "future_dated": return { text: "These entries are dated after today. Open each and correct the date (posting a corrected entry), or reverse it." };
    case "empty_entries": case "entries_balance": return { text: "Open each entry and correct its lines, or reverse it and post it again correctly." };
    case "tb_agrees": return { text: "Debits and credits don't agree — usually an entry with a missing line. Check the entries listed under 'Every entry balances'." };
    case "opening_posted": return { text: "Bring in last year's closing balances so the Balance Sheet starts right.", href: "/finance/opening-balances", cta: "Enter opening balances" };
    case "cash_negative": return { text: "Cash can't go below zero. Usually a cash withdrawal from the bank, or cash sales, wasn't recorded — record them on the date shown (or correct a payment that was made by bank).", href: "/finance/chat-book", cta: "Record the missing receipt" };
    case "cash_expense_10k": return { text: "Expenses paid in cash above ₹10,000 to one person in a day are disallowed. No entry to change: add them back in the tax computation, and pay by bank / UPI in future." };
    case "cash_receipt_2l": return { text: "Receiving ₹2 lakh or more in cash attracts a penalty equal to the amount. Nothing to post — note it for the tax audit and take such receipts by bank in future." };
    case "cash_loan_20k": return { text: "Loans / deposits of ₹20,000 or more must be by bank. Nothing to post — report it in the tax audit and repay / accept by bank in future." };
  }
  if (c.section === "gstr1" || c.section === "gstr3b") return { text: (c.diff ?? 0) > 0 ? "The return shows more than the books: a sale or its tax isn't in the books — record it (or check if the return was overstated)." : "The books show more than the return: a sale wasn't reported — include it in the next GSTR-1 / 3B (amendment), with interest if tax is short.", ...gstLink };
  if (c.section === "gstr2b") return { text: "ITC in the books that isn't in GSTR-2B can't be claimed yet: reverse it or follow up with the supplier. ITC in 2B missing from the books: record the purchase bill.", href: "/finance/gst/itc", cta: "Open ITC vs 2B" };
  if (c.section === "tds_received") return { text: "Match TDS receivable in the books to 26AS: book what 26AS shows (Dr TDS Receivable, Cr the customer), and ask deductors to correct anything missing.", href: "/finance/tax-docs", cta: "Open Form 26AS" };
  if (c.section === "tds_deducted") return { text: "Deposit any TDS deducted but not paid, with 1.5% a month interest, and file the TDS return.", href: "/finance/tds", cta: "Open TDS" };
  return null;
}

export function itemFix(checkId: string, it: AuditItem): ItemFix {
  if (checkId === "suspense_nil" && it.account_id) return "reclass";
  if (checkId === "duplicates" && it.journal_id) return "reverse";
  if (it.journal_id && ["future_dated", "empty_entries", "entries_balance", "drafts"].includes(checkId)) return checkId === "future_dated" ? "reverse" : "open";
  return null;
}
