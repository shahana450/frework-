// Matching FreWork's books to Tally's: each ledger's group (walked up to Tally's primary group), opening balance and
// closing balance, and the stock-in-hand figures Tally uses for the P&L. Pure functions; the browser asks Tally, the
// server writes.
import { headForTallyGroup, xmlDec, xmlEsc } from "./tally";

const tallyDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const companyVar = (company?: string | null) => company ? `<SVCURRENTCOMPANY>${xmlEsc(company)}</SVCURRENTCOMPANY>` : "";

/** Every ledger with its group and its opening / closing balance for the period. */
export const ledgerBooksXml = (fromIso: string, toIso: string, company?: string | null) =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_LedBal</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${tallyDate(fromIso)}</SVFROMDATE><SVTODATE>${tallyDate(toIso)}</SVTODATE>${companyVar(company)}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_LedBal" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent,OpeningBalance,ClosingBalance</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

/** Every group with its parent, so a ledger in a sub-group can be traced to its primary group. */
export const groupsXml = (company?: string | null) =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Grp</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyVar(company)}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Grp" ISMODIFY="No"><TYPE>Group</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

export type TallyLedgerBook = { name: string; parent: string; opening: number; closing: number };

const num = (s: string | undefined) => { const n = parseFloat(String(s ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

export function ledgerBooksFrom(reply: string): TallyLedgerBook[] {
  return [...reply.matchAll(/<LEDGER NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi)].map(m => ({
    name: xmlDec(m[1]),
    parent: xmlDec((m[2].match(/<PARENT[^>]*>([^<]*)</i) ?? [])[1] ?? ""),
    opening: num((m[2].match(/<OPENINGBALANCE[^>]*>([^<]*)</i) ?? [])[1]),
    closing: num((m[2].match(/<CLOSINGBALANCE[^>]*>([^<]*)</i) ?? [])[1]),
  }));
}

export function groupsFrom(reply: string): Record<string, string> {
  return Object.fromEntries([...reply.matchAll(/<GROUP NAME="([^"]+)"[^>]*>([\s\S]*?)<\/GROUP>/gi)]
    .map(m => [xmlDec(m[1]), xmlDec((m[2].match(/<PARENT[^>]*>([^<]*)</i) ?? [])[1] ?? "").replace(/^(?:&#\d+;|\W)*\s*Primary$/i, "")]));   // "&#4; Primary" = top-level group
}

/** The chain of groups from the ledger's own group up to the primary group: ["SALARY EXPENSE", "Indirect Expenses"]. */
export function groupChain(parent: string, groups: Record<string, string>): string[] {
  const chain: string[] = [];
  for (let g = parent; g && !chain.includes(g) && chain.length < 12; g = groups[g] ?? "") chain.push(g);
  return chain;
}

/** FreWork head for a Tally ledger: the nearest group in its chain that FreWork knows (Bank Accounts before Current Assets). */
export function headKeyFor(parent: string, groups: Record<string, string>): string | null {
  for (const g of groupChain(parent, groups)) { const h = headForTallyGroup(g); if (h) return h.key; }
  return null;
}

/** Tally sign: a negative balance is a debit. → { dr, cr } */
export const drCr = (n: number) => ({ dr: n < 0 ? Math.round(-n * 100) / 100 : 0, cr: n > 0 ? Math.round(n * 100) / 100 : 0 });

/** Stock-in-hand ledgers (accounts-only stock): opening and closing for the P&L's change in inventories. */
export function stockFigures(ledgers: TallyLedgerBook[], groups: Record<string, string>) {
  const stock = ledgers.filter(l => headKeyFor(l.parent, groups) === "stock");
  const opening = Math.round(stock.reduce((s, l) => s - l.opening, 0) * 100) / 100;   // debit balances are negative in Tally
  const closing = Math.round(stock.reduce((s, l) => s - l.closing, 0) * 100) / 100;
  return { ledgers: stock.map(l => l.name), opening, closing, change: Math.round((opening - closing) * 100) / 100 };
}
