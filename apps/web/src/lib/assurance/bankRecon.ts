// Intelligent bank reconciliation: each bank movement in the books is compared with open invoices/bills (and other
// bank movements) and scored on evidence — amount, date gap, UTR/reference, invoice number, party, narration.
// The score is explained line by line; nothing is matched automatically. A person confirms, rejects or unmatches,
// and one bank line can be settled against several documents only through an explicit allocation.
import type { QJournal } from "../bookQueries";
import { isBank, type DAccount } from "./detective";

export type BankLine = { journalId: string; entryNo: string; date: string; amount: number; direction: "in" | "out"; bank: string; narration: string; ref: string | null; partyId: string | null; party: string | null };
export type OpenItem = { journalId: string; entryNo: string; date: string; kind: "sale" | "purchase"; partyId: string; party: string; invoiceNo: string | null; amount: number; open: number };
export type Evidence = { factor: string; detail: string; points: number };
export type Candidate = { items: { journalId: string; entryNo: string; allocate: number }[]; score: number; evidence: Evidence[]; charges: number };
export type MatchClass = "exact" | "probable" | "multiple" | "unmatched" | "clarify";
export type Suggestion = { line: BankLine; cls: MatchClass; candidates: Candidate[]; note: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const days = (a: string, b: string) => Math.abs(Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter(w => w.length > 2 && !/^(ltd|pvt|private|limited|the|and|traders|enterprises|india|co)$/.test(w)));
export const utrOf = (s: string) => /\b([A-Z]{4}[0-9A-Z]{8,18}|\d{12})\b/.exec(s.toUpperCase())?.[1] ?? null;

/** Bank movements and open party documents from posted books. */
export function reconInputs(accounts: DAccount[], journals: QJournal[], matchedJournalIds: Set<string>) {
  const acc = new Map(accounts.map(a => [a.id, a]));
  const party = (id: string) => { const a = acc.get(id); return !!a && (a.sub_type === "trade_receivables" || a.sub_type === "trade_payables"); };
  const lines: BankLine[] = [];
  const open = new Map<string, OpenItem>();
  const paidTo = new Map<string, number>();
  for (const j of [...journals].sort((a, b) => a.date.localeCompare(b.date))) {
    const bank = j.lines.find(l => isBank(acc.get(l.account_id)));
    const p = j.lines.find(l => party(l.account_id));
    if (bank) {
      const amt = r2((+bank.dr || 0) - (+bank.cr || 0));
      if (Math.abs(amt) > 0 && !matchedJournalIds.has(j.id)) lines.push({ journalId: j.id, entryNo: j.entry_no, date: j.date, amount: Math.abs(amt), direction: amt > 0 ? "in" : "out", bank: acc.get(bank.account_id)!.name,
        narration: j.narration ?? "", ref: j.reference_no || utrOf(j.narration ?? ""), partyId: p?.account_id ?? null, party: p ? acc.get(p.account_id)!.name : j.party_name });
      if (p) paidTo.set(p.account_id, (paidTo.get(p.account_id) ?? 0) + (+p.dr || 0) + (+p.cr || 0));
    } else if (p && /sales|purchase/.test(j.type)) {
      const amt = r2((+p.dr || 0) + (+p.cr || 0));
      open.set(j.id, { journalId: j.id, entryNo: j.entry_no, date: j.date, kind: j.type === "sales" ? "sale" : "purchase", partyId: p.account_id, party: acc.get(p.account_id)!.name, invoiceNo: j.reference_no ?? null, amount: amt, open: amt });
    }
  }
  // Settle invoices first-in-first-out with what has already been received/paid, so only the unpaid part is offered
  const byParty = new Map<string, OpenItem[]>();
  for (const o of open.values()) (byParty.get(o.partyId) ?? byParty.set(o.partyId, []).get(o.partyId)!).push(o);
  for (const [pid, items] of byParty) { let paid = paidTo.get(pid) ?? 0; for (const o of items.sort((a, b) => a.date.localeCompare(b.date))) { const t = Math.min(o.open, paid); o.open = r2(o.open - t); paid -= t; } }
  return { lines, open: [...open.values()].filter(o => o.open > 0.5) };
}

function scoreOne(line: BankLine, docs: OpenItem[], allocated: number): { score: number; evidence: Evidence[]; charges: number } {
  const ev: Evidence[] = [];
  const sum = r2(docs.reduce((s, d) => s + d.open, 0));
  const diff = r2(sum - line.amount);
  let s = 0;
  if (Math.abs(diff) < 0.5) { s += 45; ev.push({ factor: "Amount", detail: `Exactly ${line.amount.toLocaleString("en-IN")}`, points: 45 }); }
  else if (diff > 0 && diff <= Math.max(50, sum * 0.005) && line.direction === "in") { s += 30; ev.push({ factor: "Amount", detail: `Short by ${diff} — likely bank charges`, points: 30 }); }
  else if (allocated > 0) { s += 15; ev.push({ factor: "Amount", detail: `Part payment of ${line.amount} against ${sum} open`, points: 15 }); }
  const d = Math.min(...docs.map(x => days(x.date, line.date)));
  const dp = d <= 3 ? 15 : d <= 15 ? 10 : d <= 60 ? 5 : 0;
  if (dp) { s += dp; ev.push({ factor: "Date", detail: `${d} day${d === 1 ? "" : "s"} from the ${docs.length > 1 ? "nearest " : ""}invoice`, points: dp }); }
  const nar = norm(`${line.narration} ${line.ref ?? ""}`);
  const inv = docs.filter(x => x.invoiceNo && norm(x.invoiceNo).length >= 2 && nar.includes(norm(x.invoiceNo)));
  if (inv.length) { s += 25; ev.push({ factor: "Invoice number", detail: `${inv.map(x => x.invoiceNo).join(", ")} in the narration`, points: 25 }); }
  if (line.partyId && docs.every(x => x.partyId === line.partyId)) { s += 20; ev.push({ factor: "Party", detail: `Booked to ${line.party}`, points: 20 }); }
  else {
    const w = words(line.narration);
    const hit = docs[0] && [...words(docs[0].party)].filter(x => w.has(x));
    if (hit?.length) { s += 12; ev.push({ factor: "Party", detail: `Narration mentions "${hit.join(" ")}"`, points: 12 }); }
  }
  if (line.ref) ev.push({ factor: "Reference", detail: `UTR/ref ${line.ref}`, points: 0 });
  return { score: Math.min(100, s), evidence: ev, charges: diff > 0 && diff <= Math.max(50, sum * 0.005) ? diff : 0 };
}

/** Suggestions for each unmatched bank line. Classes follow the evidence, never the score alone. */
export function suggestMatches(lines: BankLine[], open: OpenItem[]): Suggestion[] {
  return lines.map(line => {
    const kind = line.direction === "in" ? "sale" : "purchase";
    const pool = open.filter(o => o.kind === kind && o.date <= line.date && days(o.date, line.date) <= 365);
    const cands: Candidate[] = [];
    for (const o of pool) {
      const alloc = Math.min(o.open, line.amount);
      const sc = scoreOne(line, [o], Math.abs(o.open - line.amount) < 0.5 ? 0 : alloc);
      cands.push({ items: [{ journalId: o.journalId, entryNo: o.entryNo, allocate: r2(Math.abs(o.open - line.amount) < 0.5 || sc.charges ? o.open : alloc) }], ...sc });
    }
    // One payment for several invoices of the same party
    const byParty = new Map<string, OpenItem[]>();
    for (const o of pool) (byParty.get(o.partyId) ?? byParty.set(o.partyId, []).get(o.partyId)!).push(o);
    for (const [, items] of byParty) {
      const sorted = items.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 0; i < sorted.length; i++) { let sum = 0; for (let k = i; k < sorted.length && k < i + 8; k++) { sum = r2(sum + sorted[k].open); if (k > i && Math.abs(sum - line.amount) < 0.5) {
        const docs = sorted.slice(i, k + 1); const sc = scoreOne(line, docs, 0);
        cands.push({ items: docs.map(d => ({ journalId: d.journalId, entryNo: d.entryNo, allocate: d.open })), ...sc, evidence: [...sc.evidence, { factor: "Several invoices", detail: `${docs.length} bills add up exactly`, points: 0 }] });
      } } }
    }
    const top = cands.filter(c => c.score >= 40).sort((a, b) => b.score - a.score).slice(0, 4);
    const exact = top.filter(c => c.score >= 80 && c.evidence.some(e => e.factor === "Amount" && e.points === 45) && c.evidence.some(e => e.factor === "Party" || e.factor === "Invoice number"));
    let cls: MatchClass; let note: string;
    if (exact.length === 1 && (top.length === 1 || top[1].score < exact[0].score - 15)) { cls = "exact"; note = "Amount and party/invoice agree."; }
    else if (top.length > 1 && top[0].score - top[1].score < 10) { cls = "multiple"; note = `${top.length} documents fit about equally — choose one.`; }
    else if (top.length) { cls = "probable"; note = "Some evidence agrees; please confirm."; }
    else if (/refund|reversal|reversed|return|chargeback/i.test(line.narration)) { cls = "clarify"; note = "Looks like a refund or reversal — match it to the original entry or book it."; }
    else if (/charges|chgs|fee|gst on|sms|amc|min bal/i.test(line.narration) && line.direction === "out") { cls = "clarify"; note = "Looks like a bank charge — book it to Bank Charges."; }
    else { cls = "unmatched"; note = line.partyId ? "No open invoice for this amount." : "No invoice or party found."; }
    return { line, cls, candidates: top, note };
  });
}

/** One bank line may settle documents only up to its own amount. */
export function validateAllocation(lineAmount: number, items: { allocate: number }[], charges = 0): string | null {
  const sum = r2(items.reduce((s, i) => s + i.allocate, 0));
  if (items.some(i => !(i.allocate > 0))) return "Each allocation must be more than zero.";
  if (sum - charges > lineAmount + 0.5) return `Allocations (${sum}) are more than the bank amount (${lineAmount}).`;
  return null;
}
