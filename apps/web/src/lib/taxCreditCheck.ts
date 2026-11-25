// Form 26AS / 168 against the books, party by party:
//  · TDS deducted by a customer (Part I): is the customer a ledger, is the income from them booked, is the TDS receivable booked?
//  · TCS collected by a seller (Part VI): is the seller a ledger, is the TCS receivable (an asset) booked?
// Every gap comes with the entry that fixes it. Nothing is posted here.
import type { QJournal } from "./bookQueries";

export type Party26 = { name: string; tan: string; amount: number; tax: number };
export type Fix = { dr: string; cr: string; amount: number; why: string };
export type PartyCheck = {
  kind: "TDS" | "TCS"; party: string; tan: string; amount: number; tax: number;
  ledger: string | null; booksAmount: number; booksTax: number; status: "ok" | "check" | "missing";
  notes: string[]; fixes: Fix[];
};
type Acc = { id: string; name: string; type: string; sub_type: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
const STOP = /\b(private|pvt|limited|ltd|llp|the|and|co|company|corporation|corp|india|inc|m\/s|ms)\b\.?/g;
export const normName = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(STOP, " ").replace(/\s+/g, " ").trim();

/** The ledger that is this party: same name once "Pvt Ltd", punctuation etc. are dropped, or the first two words match. */
export function findPartyLedger(name: string, accounts: Acc[]): Acc | null {
  const n = normName(name); if (!n) return null;
  const parties = accounts.filter(a => a.type === "asset" || a.type === "liability");
  const exact = parties.find(a => normName(a.name) === n);
  if (exact) return exact;
  const two = n.split(" ").slice(0, 2).join(" ");
  return parties.find(a => { const m = normName(a.name); return two.length >= 5 && (m.startsWith(two) || n.startsWith(m) && m.length >= 5); }) ?? null;
}

const isTdsRecv = (a: Acc) => /tds|tax deducted/i.test(a.name) && !/payable|to be deposited/i.test(a.name);
const isTcsRecv = (a: Acc) => /tcs|tax collected/i.test(a.name) && !/payable|to be deposited/i.test(a.name);

export function checkTaxCredits(tds: Party26[], tcs: Party26[], accounts: Acc[], journals: QJournal[], tolerance = 1): PartyCheck[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const tdsIds = new Set(accounts.filter(isTdsRecv).map(a => a.id)), tcsIds = new Set(accounts.filter(isTcsRecv).map(a => a.id));
  const tdsLedger = accounts.find(isTdsRecv)?.name ?? "TDS Receivable", tcsLedger = accounts.find(isTcsRecv)?.name ?? "TCS Receivable";
  const out: PartyCheck[] = [];

  const run = (kind: "TDS" | "TCS", p: Party26) => {
    const led = findPartyLedger(p.name, accounts);
    const notes: string[] = [], fixes: Fix[] = [];
    let booksAmount = 0, booksTax = 0;
    if (led) {
      for (const j of journals) {
        const mine = j.lines.filter(l => l.account_id === led.id);
        if (!mine.length) continue;
        const taxIds = kind === "TDS" ? tdsIds : tcsIds;
        booksTax += j.lines.filter(l => taxIds.has(l.account_id)).reduce((t, l) => t + l.dr - l.cr, 0);
        if (kind === "TDS") {
          // Income from this customer: the income lines of entries that debit the customer
          if (mine.some(l => l.dr > 0)) booksAmount += j.lines.filter(l => byId.get(l.account_id)?.type === "income").reduce((t, l) => t + l.cr - l.dr, 0);
        } else {
          // Purchases from this seller: the expense / asset lines of entries that credit the seller
          if (mine.some(l => l.cr > 0)) booksAmount += j.lines.filter(l => { const a = byId.get(l.account_id); return a && a.id !== led.id && (a.type === "expense" || a.sub_type === "fixed_asset") && !taxIds.has(a.id); }).reduce((t, l) => t + l.dr - l.cr, 0);
        }
      }
      booksAmount = r2(booksAmount); booksTax = r2(booksTax);
    }
    const tol = Math.max(tolerance, p.amount * 0.005);
    if (!led) {
      notes.push(`There is no ledger for ${p.name} in your books.`);
      notes.push(kind === "TDS" ? `Create it under Sundry Debtors and book the sales / income of ₹${p.amount.toLocaleString("en-IN")} to them.` : `Create it under Sundry Creditors and book the purchases of ₹${p.amount.toLocaleString("en-IN")} from them.`);
      if (p.tax) fixes.push({ dr: kind === "TDS" ? tdsLedger : tcsLedger, cr: p.name, amount: p.tax, why: `${kind} ${kind === "TDS" ? "deducted by" : "collected by"} ${p.name}, after their ledger is created` });
    } else {
      if (kind === "TDS" && booksAmount < p.amount - tol) notes.push(`Income booked from ${led.name}: ₹${booksAmount.toLocaleString("en-IN")} — the statement shows ₹${p.amount.toLocaleString("en-IN")} paid/credited. Book the missing sales (₹${r2(p.amount - booksAmount).toLocaleString("en-IN")}), or check the year (an invoice may fall in the previous year).`);
      if (kind === "TDS" && booksAmount > p.amount + tol) notes.push(`Income booked from ${led.name} (₹${booksAmount.toLocaleString("en-IN")}) is more than the statement shows (₹${p.amount.toLocaleString("en-IN")}). Normal if they didn't deduct TDS on every bill — otherwise ask them to revise their TDS return.`);
      if (kind === "TCS" && booksAmount < p.amount - tol) notes.push(`Purchases booked from ${led.name}: ₹${booksAmount.toLocaleString("en-IN")} — the statement shows ₹${p.amount.toLocaleString("en-IN")}. Book the missing purchase bills.`);
      if (booksTax < p.tax - tolerance) {
        const gap = r2(p.tax - booksTax);
        notes.push(`${kind} receivable booked with ${led.name}: ₹${booksTax.toLocaleString("en-IN")} — the statement shows ₹${p.tax.toLocaleString("en-IN")}. Book the missing ₹${gap.toLocaleString("en-IN")}.`);
        fixes.push({ dr: kind === "TDS" ? tdsLedger : tcsLedger, cr: led.name, amount: gap, why: `${kind} ${kind === "TDS" ? "deducted by" : "collected by"} ${led.name} as per Form 26AS` });
      }
      if (booksTax > p.tax + tolerance) notes.push(`More ${kind} is booked with ${led.name} (₹${booksTax.toLocaleString("en-IN")}) than the statement shows (₹${p.tax.toLocaleString("en-IN")}). They may not have filed or deposited it — follow up with them before claiming it.`);
    }
    out.push({ kind, party: p.name, tan: p.tan, amount: p.amount, tax: p.tax, ledger: led?.name ?? null, booksAmount, booksTax,
      status: !led ? "missing" : notes.length ? "check" : "ok", notes, fixes });
  };
  tds.forEach(p => run("TDS", p));
  tcs.forEach(p => run("TCS", p));
  return out;
}
