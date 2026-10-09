// Cloud connectors fetch business events and propose a balanced entry for each. A person posts them from the review list.
export type ConnectorId = "razorpay" | "shopify" | "zoho_books" | "quickbooks" | "bank_feed";

/** One side of a proposed entry. `head` is the ledger group used if the ledger has to be created. */
export type ProposedLine = { ledger: string; head: string; dr: number; cr: number };

export type FeedItem = {
  external_id: string;
  kind: "payment" | "receipt" | "settlement" | "refund" | "order" | "journal";
  date: string;                // YYYY-MM-DD
  description: string;
  party: string | null;
  amount: number;
  currency: string | null;
  lines: ProposedLine[];
};

export class ConnectorError extends Error {
  constructor(public code: "AUTH" | "PROVIDER" | "INVALID" | "NOT_CONFIGURED", message: string) { super(message); }
}

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const isoDay = (d: Date | number | string) => new Date(d).toISOString().slice(0, 10);

/** Drops zero lines and makes sure debits equal credits (rounding goes to the largest line). */
export function balanced(lines: ProposedLine[]): ProposedLine[] {
  const ls = lines.map(l => ({ ...l, dr: r2(l.dr), cr: r2(l.cr) })).filter(l => l.dr > 0 || l.cr > 0);
  const diff = r2(ls.reduce((s, l) => s + l.dr - l.cr, 0));
  if (diff !== 0 && ls.length) {
    const big = ls.reduce((a, b) => (a.cr > b.cr ? a : b));
    if (Math.abs(diff) < 1 && big.cr > 0) big.cr = r2(big.cr + diff);
  }
  return ls;
}

export async function getJson(url: string, init: RequestInit, who: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(25000) });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new ConnectorError("AUTH", `${who} rejected the credentials — check the key or reconnect.`);
  if (!res.ok) throw new ConnectorError("PROVIDER", `${who} returned ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { throw new ConnectorError("PROVIDER", `${who} sent an unreadable reply.`); }
}
