// Turns last year's closing trial balance into this year's opening entry. Pure — no database or AI.
// Balance-sheet ledgers carry forward as they are; income and expense ledgers don't — their net (profit or loss)
// moves to the retained-earnings ledger (Capital for a proprietor, Reserves & Surplus / P&L A/c for a company).
import { headByKey } from "./ledgerHeads";

export type TbRow = { ledger: string; head: string; debit: number; credit: number };
export type OpeningLine = { ledger: string; head: string; dr: number; cr: number };
export type OpeningPlan = { lines: OpeningLine[]; profit: number; closingStock: number; totalDr: number; totalCr: number; difference: number; skipped: string[] };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const PL_TYPES = new Set(["income", "expense"]);
export const isPL = (head: string, ledger = "") => PL_TYPES.has(headByKey(head)?.type ?? "") || OPENING_STOCK.test(ledger);
// Opening stock in last year's TB was charged to last year's trading account — it never carries forward (closing stock does)
const OPENING_STOCK = /\bopening\s+stock\b|\bstock\s*\(opening\)/i;

/**
 * @param retained   ledger that receives the year's profit/loss (e.g. "Capital Account" or "Profit & Loss A/c")
 * @param closingStock closing stock from last year's accounts — it's an asset now and part of the profit
 * @param differenceTo when Dr ≠ Cr, the gap goes to this ledger (or null to leave it for the user to fix)
 */
export function planOpening(rows: TbRow[], opts: { retained: string; retainedHead: string; closingStock?: number; stockLedger?: string; differenceTo?: string | null }): OpeningPlan {
  const lines = new Map<string, OpeningLine>();
  const add = (ledger: string, head: string, net: number) => {
    const k = ledger.trim().toLowerCase();
    const cur = lines.get(k) ?? { ledger: ledger.trim(), head, dr: 0, cr: 0 };
    const bal = r2(cur.dr - cur.cr + net);
    lines.set(k, { ...cur, dr: bal > 0 ? bal : 0, cr: bal < 0 ? -bal : 0 });
  };
  let profit = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const name = (r.ledger ?? "").trim();
    const net = r2((Number(r.debit) || 0) - (Number(r.credit) || 0));
    if (!name || net === 0) { if (name) skipped.push(name); continue; }
    if (isPL(r.head, name)) profit = r2(profit - net);          // income (Cr) raises profit, expense (Dr) lowers it
    else add(name, r.head, net);
  }
  const stock = r2(opts.closingStock ?? 0);
  if (stock > 0) { add(opts.stockLedger || "Stock-in-Trade", "current_asset", stock); profit = r2(profit + stock); }
  if (profit !== 0) add(opts.retained, opts.retainedHead, -profit);   // profit is a credit to capital/reserves

  let out = [...lines.values()].filter(l => l.dr > 0 || l.cr > 0);
  const totalDr = r2(out.reduce((s, l) => s + l.dr, 0)), totalCr = r2(out.reduce((s, l) => s + l.cr, 0));
  const difference = r2(totalDr - totalCr);
  if (difference !== 0 && opts.differenceTo) {
    const k = opts.differenceTo.trim();
    out = [...out, { ledger: k, head: "current_liability", dr: difference < 0 ? -difference : 0, cr: difference > 0 ? difference : 0 }];
  }
  return { lines: out, profit, closingStock: stock, totalDr, totalCr, difference, skipped };
}

/** The AI's guess at a ledger group, kept only if it's one we know. */
export const cleanHead = (h: string | null | undefined) => (h && headByKey(h) ? h : "");
