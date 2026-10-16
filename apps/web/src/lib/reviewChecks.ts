// Smart checks shown on a FreBook draft before it is posted: duplicates, your usual pattern, TDS, and balance impact.
import { groupOf, type Account } from "./books";
import { monthPeriod, type QJournal } from "./bookQueries";

export type DraftLine = { account: string; debit: number; credit: number };
export type Check = { tone: "ok" | "warn" | "bad" | "info"; title: string; detail: string; rule?: string; fix?: string };
export type Impact = { account: string; before: number; after: number };
export type ReviewResult = { checks: Check[]; impact: Impact[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const days = (a: string, b: string) => Math.abs(Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
const isCashBank = (a: Account) => a.sub_type === "bank" || a.sub_type === "cash" || a.type === "bank" || a.type === "cash" || (/\bbank\b|\bcash\b/i.test(a.name) && groupOf(a) === "current_asset" && !/charges|commission/i.test(a.name));

// TDS thresholds and rates. From 1 April 2026 (FY 2026-27) TDS sits in the Income-tax Act, 2025 (one consolidated TDS section with
// payment-wise tables); the limits and rates below carried over from the 1961 Act sections shown as "was". FreBook warns — it never deducts by itself.
const TDS_RULES: { re: RegExp; now: string; was: string; what: string; single?: number; yearly?: number; monthly?: number; rates: [string, number][] }[] = [
  { re: /\brent\b|lease/i, now: "393(1) Table Sl. 2", was: "194-I", what: "Rent", monthly: 50000, rates: [["land, building or furniture", 10], ["plant or machinery", 2]] },
  { re: /professional|consult|legal|audit fee|technical|retainer|architect|doctor/i, now: "393(1) Table Sl. 6(iii)", was: "194J", what: "Professional or technical fees", yearly: 50000, rates: [["professional fees", 10], ["technical services", 2]] },
  { re: /contract|job work|labour|labor|freight|transport|printing|advertis|catering|sub-?contract/i, now: "393(1) Table Sl. 6(i)", was: "194C", what: "Contract payments", single: 30000, yearly: 100000, rates: [["individual or HUF", 1], ["firm or company", 2]] },
  { re: /commission|brokerage/i, now: "393(1) Table Sl. 1(ii)", was: "194H", what: "Commission", yearly: 20000, rates: [["commission", 2]] },
];
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const isCashName = (name: string) => /^cash\b|\bcash in hand\b|\bpetty cash\b|^cash$/i.test(name.trim()) && !/cash credit|bank/i.test(name);
const isBankName = (name: string) => /\bbank\b|\bhdfc\b|\bsbi\b|\bicici\b|\baxis\b|\bkotak\b|\bupi\b/i.test(name) && !/charges|commission|interest/i.test(name);
const isLoanName = (name: string) => /loan|deposit|borrow|advance from|unsecured/i.test(name);
const isTransport = (name: string) => /freight|transport|carriage|goods carriage|lorry|truck/i.test(name);

export function reviewChecks(accounts: Account[], journals: QJournal[], today: string, draft: { date: string; lines: DraftLine[] }): ReviewResult {
  const byName = new Map(accounts.map(a => [a.name.trim().toLowerCase(), a]));
  const lines = draft.lines.map(l => ({ ...l, acc: byName.get(l.account.trim().toLowerCase()) ?? null }));
  const total = r2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const ids = new Set(lines.map(l => l.acc?.id).filter(Boolean) as string[]);
  const checks: Check[] = [];

  // 1. Duplicate: same total, same ledgers, within 3 days — reversal pairs excluded (a reversal and its original aren't duplicates)
  const reversedNos = new Set(journals.map(j => /^Reversal of (\S+)/i.exec(j.narration ?? "")?.[1]).filter(Boolean) as string[]);
  const dup = journals.find(j => !/^Reversal of /i.test(j.narration ?? "") && !reversedNos.has(j.entry_no) && days(j.date, draft.date) <= 3 && Math.abs(r2(j.lines.reduce((s, l) => s + l.dr, 0)) - total) < 0.5
    && ids.size > 0 && [...ids].every(id => j.lines.some(l => l.account_id === id)));
  if (dup) checks.push({ tone: "bad", title: "Possible duplicate", detail: `${dup.entry_no} on ${dup.date} has the same amount and ledgers. Post only if this is a separate transaction.` });
  else checks.push({ tone: "ok", title: "No duplicate found", detail: "Nothing with this amount and these ledgers in the 3 days around this date." });

  // 2. Pattern: main expense/income ledger — seen before at a similar amount?
  const main = lines.filter(l => l.acc && !isCashBank(l.acc)).sort((a, b) => Math.max(b.debit, b.credit) - Math.max(a.debit, a.credit))[0];
  if (main?.acc) {
    const amt = Math.max(main.debit, main.credit);
    const months = Array.from({ length: 6 }, (_, i) => monthPeriod(draft.date, -(i + 1)));
    const hits = months.filter(m => journals.some(j => j.date >= m.from && j.date <= m.to && j.lines.some(l => l.account_id === main.acc!.id && Math.abs(Math.max(l.dr, l.cr) - amt) <= amt * 0.05))).length;
    const used = journals.some(j => j.lines.some(l => l.account_id === main.acc!.id));
    if (hits >= 3) checks.push({ tone: "ok", title: "Same as your usual", detail: `${main.acc.name} had a similar amount in ${hits} of the last 6 months.` });
    else if (!used) checks.push({ tone: "info", title: `First entry to ${main.acc.name}`, detail: "This ledger has no earlier entries — check it is the right head." });
  } else if (lines.some(l => !l.acc)) {
    checks.push({ tone: "info", title: "New ledger", detail: `${lines.filter(l => !l.acc).map(l => l.account).join(", ")} will be created when you post.` });
  }

  // 3. TDS hint on payments
  const fyStart = draft.date.slice(5) >= "04-01" ? `${draft.date.slice(0, 4)}-04-01` : `${+draft.date.slice(0, 4) - 1}-04-01`;
  for (const l of lines.filter(l => l.debit > 0)) {
    const rule = TDS_RULES.find(r => r.re.test(l.account));
    if (!rule) continue;
    const ytd = l.acc ? journals.filter(j => j.date >= fyStart && j.date <= draft.date).reduce((s, j) => s + j.lines.filter(x => x.account_id === l.acc!.id).reduce((t, x) => t + x.dr, 0), 0) : 0;
    const why = rule.monthly && l.debit > rule.monthly ? `over ${inr(rule.monthly)} a month`
      : rule.single && l.debit > rule.single ? `a single payment over ${inr(rule.single)}`
      : rule.yearly && ytd + l.debit > rule.yearly ? `${inr(ytd + l.debit)} this year, over the ${inr(rule.yearly)} yearly limit` : null;
    const deducted = lines.some(x => x.credit > 0 && /tds/i.test(x.account));
    if (why && !deducted) {
      const how = rule.rates.map(([who, pct]) => `${pct}% for ${who} = ${inr(l.debit * pct / 100)}`).join("; ");
      checks.push({ tone: "bad", title: `TDS must be deducted · ${rule.what}`, detail: `${inr(l.debit)} is ${why}. Deduct TDS (${how}), pay the net amount and credit "TDS Payable". Section ${rule.now}, Income-tax Act 2025 (was s.${rule.was}). Missing TDS makes 30% of the expense disallowable plus interest and penalty.`, rule: "tds", fix: "Use Edit to add a \"TDS Payable\" credit line and reduce the amount paid to the net figure." });
    }
  }

  // 4. Cash limits (Income-tax Act 2025 carries these over from the 1961 Act)
  const cashCr = r2(lines.filter(l => isCashName(l.account) || (l.acc && /cash/i.test(l.acc.sub_type ?? l.acc.type ?? "") && !isBankName(l.account))).reduce((s, l) => s + (l.credit || 0), 0));
  const cashDr = r2(lines.filter(l => isCashName(l.account) || (l.acc && /cash/i.test(l.acc.sub_type ?? l.acc.type ?? "") && !isBankName(l.account))).reduce((s, l) => s + (l.debit || 0), 0));
  const others = lines.filter(l => !isCashName(l.account) && !isBankName(l.account) && !/tds|gst/i.test(l.account));
  if (cashCr > 0) {
    const loanRepaid = others.some(l => l.debit > 0 && isLoanName(l.account));
    const limit = others.some(l => l.debit > 0 && isTransport(l.account)) ? 35000 : 10000;
    if (loanRepaid && cashCr >= 20000) {
      checks.push({ tone: "bad", title: "Loan repaid in cash", detail: `Repaying a loan or deposit of ${inr(cashCr)} in cash (₹20,000 or more) is barred by section 188, Income-tax Act 2025 (was s.269T) — penalty equal to the amount. Repay by bank transfer or account-payee cheque.`, rule: "cash_loan_repaid", fix: "Use Edit to change Cash to your bank account." });
    }
    const heads = others.filter(l => l.debit > 0);
    const perPayee = heads.length > 1 ? Math.max(...heads.map(l => l.debit)) : cashCr;   // several heads = several payees
    if (loanRepaid && cashCr >= 20000) { /* reported above */ } else if (!loanRepaid && perPayee > limit && others.some(l => l.debit > 0 && !/drawings|capital|salary payable|creditor|payable/i.test(l.account))) {
      const asset = others.some(l => l.debit > 0 && l.acc && /fixed|asset/i.test(`${l.acc.type} ${l.acc.sub_type ?? ""}`));
      checks.push({ tone: "bad", title: `Cash payment over ${inr(limit)}`, detail: `Paying ${inr(perPayee)} in cash to one person in a day means ${asset ? "the asset's cost won't qualify for depreciation" : "the expense is not deductible"} (section 36(4), Income-tax Act 2025 — was s.40A(3)). Pay by bank transfer, UPI or account-payee cheque — or split only if they are genuinely separate days' payments.`, rule: "cash_payment_limit", fix: "Use Edit to change Cash to your bank account if it was paid that way." });
    }
  }
  if (cashDr > 0) {
    const loanTaken = others.some(l => l.credit > 0 && isLoanName(l.account));
    if (loanTaken && cashDr >= 20000) checks.push({ tone: "bad", title: "Loan accepted in cash", detail: `Taking a loan or deposit of ${inr(cashDr)} in cash (₹20,000 or more) is barred by section 185, Income-tax Act 2025 (was s.269SS) — penalty equal to the amount. Receive it by bank transfer.`, rule: "cash_loan_taken", fix: "Use Edit to change Cash to your bank account if it came in that way." });
    else if (cashDr >= 200000) checks.push({ tone: "bad", title: "Cash receipt of ₹2 lakh or more", detail: `Receiving ${inr(cashDr)} in cash from one person (in a day, for one transaction or event) is barred by section 186, Income-tax Act 2025 (was s.269ST) — penalty equal to the amount. Ask for a bank transfer or UPI.`, rule: "cash_receipt_limit", fix: "Use Edit to change Cash to your bank account if it came in that way." });
  }

  // 4. Impact on cash and bank balances
  const impact: Impact[] = [];
  for (const l of lines) {
    const isNewCashBank = !l.acc && (isCashName(l.account) || isBankName(l.account));
    if (!isNewCashBank && (!l.acc || !isCashBank(l.acc))) continue;
    const name = l.acc?.name ?? l.account.trim();
    const before = l.acc ? r2(journals.filter(j => j.date <= today).reduce((s, j) => s + j.lines.filter(x => x.account_id === l.acc!.id).reduce((t, x) => t + x.dr - x.cr, 0), 0)) : 0;
    const after = r2(before + (l.debit || 0) - (l.credit || 0));
    impact.push({ account: name, before, after });
    if (after < -0.5) checks.push({ tone: "warn", title: `${name} goes below zero`, detail: l.acc ? "A receipt may be missing, or the payment came from another account." : "This is the first entry to this ledger, so it starts below zero — add its opening balance or the receipt that funded it.", rule: "negative_balance" });
  }
  return { checks, impact };
}
