// Bank reconciliation: statement lines vs the bank ledger in FreBook. Pure — no I/O.
// Bank credit (money in) ↔ ledger debit; bank debit (money out) ↔ ledger credit.
export type BankLine = { id: string; date: string; description: string; debit: number; credit: number; balance?: number };
export type BookLine = { id: string; date: string; entryNo: string; narration: string; ref: string | null; dr: number; cr: number };
export type Pair = { bank: BankLine; book: BookLine; how: "ref" | "amount" };
export type BankRecon = {
  matched: Pair[];
  bankOnly: BankLine[];   // in the statement, not in FreBook
  bookOnly: BookLine[];   // in FreBook, not yet in the statement (uncleared)
  bookBalance: number;    // closing per FreBook (debit positive)
  bankBalance: number | null; // closing per statement, when it gives balances
  brs: { label: string; amount: number }[];
  computedBank: number;
  difference: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function reconcileBank(bank: BankLine[], book: BookLine[], opts: { openingBook: number; window?: number } = { openingBook: 0 }): BankRecon {
  const win = opts.window ?? 4;
  const usedBook = new Set<string>(), usedBank = new Set<string>();
  const matched: Pair[] = [];
  const amt = (b: BankLine) => r2(b.credit || -b.debit), bamt = (l: BookLine) => r2(l.dr - l.cr);

  // 1) Same amount and the book's reference (UTR / cheque no.) appears in the statement narration
  for (const b of bank) {
    const nd = norm(b.description);
    const hit = book.find(l => !usedBook.has(l.id) && bamt(l) === amt(b) && l.ref && norm(l.ref).length >= 4 && nd.includes(norm(l.ref)));
    if (hit) { usedBook.add(hit.id); usedBank.add(b.id); matched.push({ bank: b, book: hit, how: "ref" }); }
  }
  // 2) Same amount, nearest date within the window
  for (const b of bank) {
    if (usedBank.has(b.id)) continue;
    let best: BookLine | null = null, bd = Infinity;
    for (const l of book) {
      if (usedBook.has(l.id) || bamt(l) !== amt(b)) continue;
      const d = days(l.date, b.date);
      if (d <= win && d < bd) { best = l; bd = d; }
    }
    if (best) { usedBook.add(best.id); usedBank.add(b.id); matched.push({ bank: b, book: best, how: "amount" }); }
  }

  const bankOnly = bank.filter(b => !usedBank.has(b.id));
  const bookOnly = book.filter(l => !usedBook.has(l.id));
  const bookBalance = r2(opts.openingBook + book.reduce((s, l) => s + l.dr - l.cr, 0));
  const last = [...bank].reverse().find(b => typeof b.balance === "number");
  const bankBalance = last?.balance != null ? r2(last.balance) : null;

  const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0));
  const chequesNotPresented = sum(bookOnly.map(l => l.cr));
  const depositsNotCredited = sum(bookOnly.map(l => l.dr));
  const creditsNotInBooks = sum(bankOnly.map(b => b.credit));
  const debitsNotInBooks = sum(bankOnly.map(b => b.debit));
  const brs = [
    { label: "Balance as per FreBook", amount: bookBalance },
    { label: "Add: payments in FreBook not yet in bank (cheques issued, not presented)", amount: chequesNotPresented },
    { label: "Less: receipts in FreBook not yet in bank (deposits not credited)", amount: -depositsNotCredited },
    { label: "Add: money received in bank, not entered in FreBook", amount: creditsNotInBooks },
    { label: "Less: money paid from bank, not entered in FreBook (charges, auto-debits)", amount: -debitsNotInBooks },
  ];
  const computedBank = sum(brs.map(x => x.amount));
  return { matched, bankOnly, bookOnly, bookBalance, bankBalance, brs, computedBank, difference: bankBalance == null ? null : r2(bankBalance - computedBank) };
}
