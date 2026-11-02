// 360° audit — step 1: checks that need only the books. Each check says what it looked at, what it found and which
// entries to open. Pure functions: the API route loads the books, this decides. Later steps add portal data
// (GSTR-1, GSTR-3B, GSTR-2B, 26AS/AIS) as further sections with a "Books" and a "Portal" figure.
import type { QJournal } from "./bookQueries";

export type AuditAccount = { id: string; name: string; type: string; sub_type: string | null };
export type AuditStatus = "ok" | "warn" | "fail" | "na";
export type AuditItem = { journal_id?: string; entry_no?: string; date?: string; amount?: number; note: string };
export type AuditCheck = {
  id: string; section: "books" | "cash_law"; title: string; law?: string;
  status: AuditStatus; summary: string; books?: number | null; items: AuditItem[];
};
export type AuditReport = { period: { from: string; to: string }; checks: AuditCheck[]; score: number; counts: Record<AuditStatus, number> };

const r2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => "₹" + Math.abs(r2(n)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const isCash = (a?: AuditAccount) => !!a && (a.sub_type === "cash" || (a.type === "asset" && /\b(cash|petty cash)\b/i.test(a.name) && !/bank/i.test(a.name)));
const isBank = (a?: AuditAccount) => !!a && (a.sub_type === "bank" || (a.type === "asset" && /\bbank\b/i.test(a.name)));
const isExpense = (a?: AuditAccount) => !!a && a.type === "expense";
const isLoan = (a?: AuditAccount) => !!a && (a.sub_type === "long_term_liability" || /\b(loan|deposit|borrowing)s?\b/i.test(a.name)) && a.type === "liability";
const isSuspense = (a?: AuditAccount) => !!a && /\b(suspense|difference|unknown|unclassified|uncategori[sz]ed|ask my accountant)\b/i.test(a.name);
const isCapitalOrLoanIn = (a?: AuditAccount) => !!a && (a.type === "equity" || isLoan(a));

const item = (j: QJournal, amount: number, note: string): AuditItem => ({ journal_id: j.id, entry_no: j.entry_no, date: j.date, amount: r2(amount), note });
const top = (items: AuditItem[], n = 50) => items.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, n);

export function runAudit360(accounts: AuditAccount[], journals: QJournal[], period: { from: string; to: string }, opts: { today: string; drafts?: number; openingPosted?: boolean }): AuditReport {
  const acc = new Map(accounts.map(a => [a.id, a]));
  const inYear = journals.filter(j => j.date >= period.from && j.date <= period.to);
  const checks: AuditCheck[] = [];
  const add = (c: AuditCheck) => checks.push(c);

  // ── 1. Books integrity ──────────────────────────────────────────────────────────────────────────────────────────
  // Trial balance agrees: every line up to the year end, debits = credits
  const upTo = journals.filter(j => j.date <= period.to);
  const dr = r2(upTo.reduce((s, j) => s + j.lines.reduce((t, l) => t + l.dr, 0), 0));
  const cr = r2(upTo.reduce((s, j) => s + j.lines.reduce((t, l) => t + l.cr, 0), 0));
  add({ id: "tb_agrees", section: "books", title: "Trial balance agrees", status: Math.abs(dr - cr) < 0.01 ? "ok" : "fail",
    summary: Math.abs(dr - cr) < 0.01 ? `Debits and credits both ${inr(dr)}.` : `Debits ${inr(dr)} vs credits ${inr(cr)} — out by ${inr(dr - cr)}.`, books: r2(dr - cr), items: [] });

  // Every entry balances
  const unbalanced = inYear.filter(j => j.lines.length && Math.abs(j.lines.reduce((s, l) => s + l.dr - l.cr, 0)) >= 0.01);
  add({ id: "entries_balance", section: "books", title: "Every entry balances", status: unbalanced.length ? "fail" : "ok",
    summary: unbalanced.length ? `${unbalanced.length} entr${unbalanced.length === 1 ? "y doesn't" : "ies don't"} balance.` : `All ${inYear.length} entries balance.`,
    items: top(unbalanced.map(j => item(j, Math.abs(j.lines.reduce((s, l) => s + l.dr - l.cr, 0)), "Debits and credits differ"))) });

  // Entries with no lines (e.g. left behind by a failed delete)
  const empty = inYear.filter(j => !j.lines.length);
  add({ id: "empty_entries", section: "books", title: "No empty entries", status: empty.length ? "fail" : "ok",
    summary: empty.length ? `${empty.length} entr${empty.length === 1 ? "y has" : "ies have"} no lines — the amounts are missing from every report.` : "Every entry has its lines.",
    items: empty.slice(0, 50).map(j => item(j, 0, "No lines")) });

  // Suspense / difference ledgers should be nil at year end
  const bal = new Map<string, number>();
  for (const j of upTo) for (const l of j.lines) bal.set(l.account_id, r2((bal.get(l.account_id) ?? 0) + l.dr - l.cr));
  const susp = accounts.filter(a => isSuspense(a) && Math.abs(bal.get(a.id) ?? 0) >= 1);
  add({ id: "suspense_nil", section: "books", title: "Suspense and difference ledgers are nil", status: susp.length ? "warn" : "ok",
    summary: susp.length ? `${susp.map(a => `${a.name} ${inr(bal.get(a.id)!)}`).join(", ")} — clear these before closing the year.` : "No balance in suspense or difference ledgers.",
    items: susp.map(a => ({ amount: Math.abs(bal.get(a.id)!), note: `${a.name}: ${inr(bal.get(a.id)!)} ${bal.get(a.id)! > 0 ? "Dr" : "Cr"}` })) });

  // Opening balances brought in
  if (opts.openingPosted !== undefined) add({ id: "opening_posted", section: "books", title: "Opening balances brought forward", status: opts.openingPosted ? "ok" : "warn",
    summary: opts.openingPosted ? "Opening balances are posted for this year." : "No opening balance entry for this year — the Balance Sheet starts from zero.", items: [] });

  // Entries dated in the future
  const future = inYear.filter(j => j.date > opts.today);
  add({ id: "future_dated", section: "books", title: "No entries dated in the future", status: future.length ? "warn" : "ok",
    summary: future.length ? `${future.length} entr${future.length === 1 ? "y is" : "ies are"} dated after today.` : "None.",
    items: future.slice(0, 50).map(j => item(j, j.lines.reduce((s, l) => s + l.dr, 0), `Dated ${j.date}`)) });

  // Drafts not posted
  if (opts.drafts !== undefined) add({ id: "drafts", section: "books", title: "No drafts left unposted", status: opts.drafts ? "warn" : "ok",
    summary: opts.drafts ? `${opts.drafts} draft entr${opts.drafts === 1 ? "y is" : "ies are"} waiting — they aren't in the reports.` : "None.", items: [] });

  // Possible duplicates: same date, same amount, same ledgers
  const seen = new Map<string, QJournal>();
  const dups: AuditItem[] = [];
  for (const j of inYear) {
    const amt = r2(j.lines.reduce((s, l) => s + l.dr, 0));
    if (!amt) continue;
    const k = `${j.date}|${amt}|${j.lines.map(l => l.account_id + (l.dr ? "d" : "c")).sort().join(",")}`;
    const first = seen.get(k);
    if (first) dups.push(item(j, amt, `Same date, amount and ledgers as ${first.entry_no}`)); else seen.set(k, j);
  }
  add({ id: "duplicates", section: "books", title: "No duplicate entries", status: dups.length ? "warn" : "ok",
    summary: dups.length ? `${dups.length} possible duplicate${dups.length === 1 ? "" : "s"} — check before filing.` : "None found.", items: top(dups) });

  // Cash never goes negative (a receipt is missing, or a payment is wrong)
  const cashIds = new Set(accounts.filter(isCash).map(a => a.id));
  const negDays: AuditItem[] = [];
  if (cashIds.size) {
    let run = 0;
    const days = new Map<string, number>();
    for (const j of journals.filter(j => j.date <= period.to).sort((a, b) => a.date.localeCompare(b.date))) {
      for (const l of j.lines) if (cashIds.has(l.account_id)) run = r2(run + l.dr - l.cr);
      if (j.date >= period.from) days.set(j.date, run);
    }
    for (const [d, v] of days) if (v < -0.5) negDays.push({ date: d, amount: -v, note: `Cash ${inr(v)} Cr at the end of ${d}` });
  }
  add({ id: "cash_negative", section: "books", title: "Cash in hand never negative", status: !cashIds.size ? "na" : negDays.length ? "fail" : "ok",
    summary: !cashIds.size ? "No cash ledger." : negDays.length ? `Cash went below zero on ${negDays.length} day${negDays.length === 1 ? "" : "s"} — a receipt is missing or a payment is wrong.` : "Cash stayed at or above zero all year.",
    items: negDays.slice(0, 50) });

  // ── 7. Cash and tax-law checks (Income-tax Act 2025; old sections in brackets) ─────────────────────────────────────
  const cashLines = (j: QJournal) => j.lines.filter(l => cashIds.has(l.account_id) || isCash(acc.get(l.account_id)));
  const other = (j: QJournal, pred: (a?: AuditAccount) => boolean) => j.lines.filter(l => pred(acc.get(l.account_id)));

  // Cash expense payments above ₹10,000 in one go (not deductible)
  const cashExp: AuditItem[] = [];
  for (const j of inYear) {
    const out = cashLines(j).reduce((s, l) => s + l.cr, 0);
    const exp = other(j, isExpense).reduce((s, l) => s + l.dr, 0);
    if (out > 10000 && exp > 10000) cashExp.push(item(j, Math.min(out, exp), "Expense paid in cash above ₹10,000"));
  }
  add({ id: "cash_expense_10k", section: "cash_law", title: "Cash expenses over ₹10,000", law: "Expense disallowed when paid in cash above ₹10,000 (was s.40A(3))",
    status: cashExp.length ? "warn" : "ok", summary: cashExp.length ? `${cashExp.length} payment${cashExp.length === 1 ? "" : "s"} totalling ${inr(cashExp.reduce((s, i) => s + (i.amount ?? 0), 0))} — not deductible unless an exception applies.` : "None.", items: top(cashExp) });

  // Cash received ₹2 lakh or more in one go
  const cashIn2L: AuditItem[] = [];
  for (const j of inYear) {
    const inn = cashLines(j).reduce((s, l) => s + l.dr, 0);
    const fromBank = other(j, isBank).some(l => l.cr > 0);   // a cash withdrawal from the bank is fine
    if (inn >= 200000 && !fromBank) cashIn2L.push(item(j, inn, "Cash received ₹2 lakh or more"));
  }
  add({ id: "cash_receipt_2l", section: "cash_law", title: "Cash receipts of ₹2 lakh or more", law: "No one may receive ₹2 lakh or more in cash in a day / transaction (was s.269ST) — penalty equal to the amount",
    status: cashIn2L.length ? "fail" : "ok", summary: cashIn2L.length ? `${cashIn2L.length} receipt${cashIn2L.length === 1 ? "" : "s"} — penalty risk equal to the amount received.` : "None.", items: top(cashIn2L) });

  // Loans / deposits taken or repaid in cash, ₹20,000 or more
  const cashLoan: AuditItem[] = [];
  for (const j of inYear) {
    const inn = cashLines(j).reduce((s, l) => s + l.dr, 0), out = cashLines(j).reduce((s, l) => s + l.cr, 0);
    const loanIn = other(j, isCapitalOrLoanIn).filter(l => isLoan(acc.get(l.account_id))).reduce((s, l) => s + l.cr, 0);
    const loanOut = other(j, isLoan).reduce((s, l) => s + l.dr, 0);
    if (inn >= 20000 && loanIn >= 20000) cashLoan.push(item(j, Math.min(inn, loanIn), "Loan or deposit taken in cash"));
    if (out >= 20000 && loanOut >= 20000) cashLoan.push(item(j, Math.min(out, loanOut), "Loan or deposit repaid in cash"));
  }
  add({ id: "cash_loan_20k", section: "cash_law", title: "Loans taken or repaid in cash (₹20,000+)", law: "Loans / deposits of ₹20,000 or more only by bank (was s.269SS / 269T) — penalty equal to the amount",
    status: cashLoan.length ? "fail" : "ok", summary: cashLoan.length ? `${cashLoan.length} entr${cashLoan.length === 1 ? "y" : "ies"} — penalty risk equal to the amount.` : "None.", items: top(cashLoan) });

  // Score: ok = full marks, warn = half, fail = none; n/a doesn't count
  const counts: Record<AuditStatus, number> = { ok: 0, warn: 0, fail: 0, na: 0 };
  for (const c of checks) counts[c.status]++;
  const scored = checks.length - counts.na;
  const score = scored ? Math.round(((counts.ok + counts.warn * 0.5) / scored) * 100) : 100;
  return { period, checks, score, counts };
}
