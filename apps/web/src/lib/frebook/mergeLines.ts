// A bill with several items often comes back as one debit per item, all to the same ledger.
// An entry shows each ledger once per side: lines with the same account and side are added together.
// A line that has both a debit and a credit, or a different account, is left as it is.
type L = { account: string; debit: number; credit: number; [k: string]: unknown };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function mergeSameLedgerLines<T extends L>(lines: T[]): T[] {
  const out: T[] = [];
  const at = new Map<string, number>();
  for (const l of lines) {
    const dr = Number(l.debit) || 0, cr = Number(l.credit) || 0;
    const side = dr > 0 && !(cr > 0) ? "dr" : cr > 0 && !(dr > 0) ? "cr" : null;
    // Stock item lines and foreign-currency lines keep their own detail
    // (items on an expense head — food, stationery — are just the bill's detail and are added up)
    const stock = /stock|inventor|raw material|finished goods|^purchases?|goods/i.test(String(l.account ?? ""));
    const keep = (!!l.item && stock) || l.fc_debit != null || l.fc_credit != null;
    const key = side && !keep ? `${side}|${String(l.account ?? "").trim().toLowerCase()}` : null;
    const i = key ? at.get(key) : undefined;
    if (key && i !== undefined) {
      const m = out[i];
      out[i] = { ...m, debit: r2((Number(m.debit) || 0) + dr), credit: r2((Number(m.credit) || 0) + cr) };
    } else {
      if (key) at.set(key, out.length);
      out.push(l);
    }
  }
  return out;
}
