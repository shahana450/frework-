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

/**
 * Rebuild withdrawal / deposit / balance from the running balance when a PDF's columns ran together (e.g. Federal Bank:
 * "Deposits Withdrawals" read as one column, the balance landing in the deposit column). For each row, of the numbers
 * found, the one that continues the running balance is the balance and the other is the amount — its side follows
 * from whether the balance went up or down. Rows that don't fit are left as they were. Needs a starting balance:
 * the statement's opening balance, or the first row's own balance.
 */
export function rebuildByBalance<T extends DirRow>(rows: T[], opening?: number | null): { rows: T[]; fixed: number } {
  // Printed balances are exact to the paisa
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.51;
  const numsOf = (r: DirRow) => [Number(r.debit) || 0, Number(r.credit) || 0, Number(r.balance) || 0].filter(n => n > 0);
  // Ways a row can continue from `prev`: which number is the amount, which the balance, and the side
  const fits = (r: DirRow, prev: number) => {
    const n = numsOf(r), out: { amt: number; bal: number; up: boolean }[] = [];
    for (let a = 0; a < n.length; a++) for (let b = 0; b < n.length; b++) if (a !== b) {
      if (eq(prev + n[a], n[b])) out.push({ amt: n[a], bal: n[b], up: true });
      else if (eq(prev - n[a], n[b])) out.push({ amt: n[a], bal: n[b], up: false });
    }
    return out;
  };
  let prev: number | null = opening ?? null, fixed = 0;
  const out = rows.map((r, i) => {
    if (prev == null) { if (Number(r.balance) > 0) prev = Number(r.balance); return r; }
    let hit = fits(r, prev)[0];
    // Balance missing on this row (only the amount was read): the side whose balance lets the next row continue
    if (!hit) {
      const n = numsOf(r);
      if (n.length === 1 && i + 1 < rows.length) {
        for (const up of [true, false]) {
          const bal = Math.round((prev + (up ? n[0] : -n[0])) * 100) / 100;
          if (bal >= 0 && fits(rows[i + 1], bal).length) { hit = { amt: n[0], bal, up }; break; }
        }
      }
    }
    if (!hit) { prev = Number(r.balance) > 0 ? Number(r.balance) : prev; return r; }
    const next = { ...r, debit: hit.up ? 0 : hit.amt, credit: hit.up ? hit.amt : 0, balance: hit.bal };
    if (next.debit !== (Number(r.debit) || 0) || next.credit !== (Number(r.credit) || 0) || next.balance !== r.balance) fixed++;
    prev = hit.bal;
    return next;
  });
  return { rows: out, fixed };
}

/** How many rows don't continue the running balance (amounts that don't add up to the bank's printed balance). */
export function balanceBreaks(rows: DirRow[], opening?: number | null): number {
  let prev: number | null = opening ?? null, breaks = 0;
  for (const r of rows) {
    const bal = Number(r.balance);
    if (!(bal > 0) && r.balance !== 0) { if (prev != null) prev = Math.round((prev - (Number(r.debit) || 0) + (Number(r.credit) || 0)) * 100) / 100; continue; }
    if (prev != null && Math.abs(prev - (Number(r.debit) || 0) + (Number(r.credit) || 0) - bal) >= 0.51) breaks++;
    prev = bal;
  }
  return breaks;
}
