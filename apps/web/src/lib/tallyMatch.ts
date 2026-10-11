// Matching FreWork entries to Tally vouchers. Never by voucher number — numbers repeat (three JV-0012 entries all
// matched "Vch 3"). First by the GUID FreWork gives every pushed voucher (REMOTEID "frework-<journal id>", kept by
// Tally), then by date + amount + a shared ledger, one voucher to one entry.
export const tallyGuidFor = (journalId: string) => `frework-${journalId}`;

export type OwnEntry = { id: string; date: string; amount: number; ledgers: string[]; tallyGuid?: string | null };
export type TallyVch = { date: string; amount: number; ledgers: string[]; remoteId?: string | null; guid?: string | null; voucherNumber?: string };
export type Found = Record<string, { vno: string; how: "guid" | "match" }>;

const r0 = (n: number) => Math.round(n);
const lc = (s: string) => s.trim().toLowerCase();

export function matchToTally(own: OwnEntry[], vouchers: TallyVch[]): Found {
  const found: Found = {};
  const used = new Set<number>();
  const byGuid = new Map<string, number>();
  vouchers.forEach((v, i) => { for (const g of [v.remoteId, v.guid]) if (g) byGuid.set(lc(g), i); });
  // 1. GUID
  for (const j of own) {
    const i = byGuid.get(lc(j.tallyGuid ?? tallyGuidFor(j.id)));
    if (i != null && !used.has(i)) { used.add(i); found[j.id] = { vno: vouchers[i].voucherNumber || "—", how: "guid" }; }
  }
  // 2. Same date + same amount + at least one shared ledger; each voucher used once. Vouchers that carry another
  //    FreWork GUID belong to that entry and are never matched to this one.
  for (const j of own) {
    if (found[j.id]) continue;
    const names = new Set(j.ledgers.map(lc));
    const i = vouchers.findIndex((v, k) => !used.has(k) && !(v.remoteId && /^frework-/i.test(v.remoteId)) && v.date === j.date && r0(v.amount) === r0(j.amount) && v.ledgers.some(l => names.has(lc(l))));
    if (i >= 0) { used.add(i); found[j.id] = { vno: vouchers[i].voucherNumber || "—", how: "match" }; }
  }
  return found;
}
