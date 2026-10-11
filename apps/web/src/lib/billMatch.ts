// Matches bank statement lines to open sales and purchase entries.
// Money in is matched to an unpaid sale (customer), money out to an unpaid purchase (supplier).
// Pure: give it posted journals with their lines; it never touches the database.

export type MatchJournal = { id: string; entry_no: string; date: string; type: string; lines: { name: string; dr: number; cr: number }[] };
export type OpenDoc = { id: string; entryNo: string; date: string; kind: "sale" | "purchase"; ledger: string; amount: number; open: number };
export type Match = { doc: OpenDoc; sure: boolean };

const CASH_BANK = /\b(cash|bank|hdfc|icici|sbi|axis|kotak|federal|canara|pnb|idfc|indusind|yes bank|petty)\b/i;
const NOT_PARTY = /\b(sales?|purchases?|revenue|gst|cgst|sgst|igst|cess|tds|tcs|round\s?off|discount|freight|expenses?|income)\b/i;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Unpaid sales and purchases, oldest first, after subtracting everything later received or paid on the same ledger. */
export function openDocs(journals: MatchJournal[]): OpenDoc[] {
  const docs: OpenDoc[] = [];
  const docIds = new Set<string>();
  for (const j of journals) {
    const t = (j.type ?? "").toLowerCase();
    const kind = t === "sales" ? "sale" : t === "purchase" ? "purchase" : null;
    if (!kind) continue;
    // The party side: debit on a sale, credit on a purchase — and not cash, bank, tax or the sales/purchase head
    const cand = j.lines.filter(l => (kind === "sale" ? l.dr > 0 : l.cr > 0) && !CASH_BANK.test(l.name) && !NOT_PARTY.test(l.name));
    if (cand.length !== 1) continue;
    const amount = r2(kind === "sale" ? cand[0].dr : cand[0].cr);
    docs.push({ id: j.id, entryNo: j.entry_no, date: j.date.slice(0, 10), kind, ledger: cand[0].name, amount, open: amount });
    docIds.add(j.id);
  }
  // Settle oldest first with every other movement on the party ledger
  const byLedger = new Map<string, OpenDoc[]>();
  for (const d of docs.sort((a, b) => a.date.localeCompare(b.date))) byLedger.set(d.ledger.toLowerCase(), [...(byLedger.get(d.ledger.toLowerCase()) ?? []), d]);
  const settled = new Map<string, number>();
  for (const j of journals) {
    if (docIds.has(j.id)) continue;
    for (const l of j.lines) {
      const list = byLedger.get(l.name.toLowerCase());
      if (!list?.length) continue;
      const pay = list[0].kind === "sale" ? l.cr : l.dr;          // receipt credits a customer, payment debits a supplier
      if (pay > 0) settled.set(l.name.toLowerCase(), (settled.get(l.name.toLowerCase()) ?? 0) + pay);
    }
  }
  for (const [ledger, list] of byLedger) {
    let left = settled.get(ledger) ?? 0;
    for (const d of list) { const use = Math.min(left, d.open); d.open = r2(d.open - use); left = r2(left - use); }
  }
  return docs.filter(d => d.open > 0.5);
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 4 && !/^(traders?|enterprises?|limited|private|stores?|agency|agencies|services|company|india)$/.test(w));

/** Best open document for one statement line, or null. `sure` only when the amount AND the party name agree. */
export function matchLine(line: { description: string; debit: number; credit: number }, docs: OpenDoc[], used: Set<string> = new Set()): Match | null {
  const kind = line.credit > 0 ? "sale" : line.debit > 0 ? "purchase" : null;
  if (!kind) return null;
  const amt = line.credit || line.debit;
  const desc = line.description.toLowerCase();
  const pool = docs.filter(d => d.kind === kind && !used.has(d.id));
  const named = pool.filter(d => words(d.ledger).some(w => desc.includes(w)));
  const exact = (d: OpenDoc) => Math.abs(d.open - amt) <= 1;
  const namedExact = named.filter(exact);
  if (namedExact.length) return { doc: namedExact[0], sure: true };
  if (named.length) return { doc: named[0], sure: false };            // part payment or a different bill of the same party
  const exactOnly = pool.filter(exact);
  if (exactOnly.length === 1) return { doc: exactOnly[0], sure: false };
  return null;
}
