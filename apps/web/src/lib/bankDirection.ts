// Statement rows read from a PDF can come back with withdrawals and deposits swapped (column order differs by bank).
// When the statement prints a running balance, it settles the direction: a fall in balance is a withdrawal.
// Pure — used on every statement read before rows become entries.
export type DirRow = { debit: number; credit: number; balance?: number | null };

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.001);

/** Rows with debit = withdrawal, credit = deposit, corrected from the running balance where it shows the direction. */
export function fixDirections<T extends DirRow>(rows: T[]): { rows: T[]; fixed: number } {
  let fixed = 0;
  const out = rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1].balance : null, bal = r.balance;
    const amt = (Number(r.debit) || 0) || (Number(r.credit) || 0);
    if (prev == null || bal == null || !amt || !isFinite(Number(prev)) || !isFinite(Number(bal))) return r;
    const delta = Number(bal) - Number(prev);
    const isOut = (Number(r.debit) || 0) > 0;
    if (isOut && near(delta, amt)) { fixed++; return { ...r, debit: 0, credit: amt }; }      // balance rose: a deposit
    if (!isOut && near(delta, -amt)) { fixed++; return { ...r, debit: amt, credit: 0 }; }    // balance fell: a withdrawal
    return r;
  });
  return { rows: out, fixed };
}
