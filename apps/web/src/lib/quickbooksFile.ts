// QuickBooks Journal report (Online: Reports → Journal; Desktop: Reports → Accountant & Taxes → Journal), exported as
// Excel or CSV, read into balanced entries for the QuickBooks review list. Pure: a grid of cells in, entries out.
// Layout: a few title rows, a header row (Date · Transaction Type/Type · Num · Name · Memo/Description · Account ·
// Debit · Credit; Desktop adds Trans #), then each transaction's lines, usually followed by a totals row.
import { cellDate, cellNum } from "./bankExcel";

export type QbEntry = { external_id: string; date: string; description: string; party: string | null; type: string; num: string; lines: { ledger: string; dr: number; cr: number }[] };
export type QbResult = { entries: QbEntry[]; unbalanced: number; headerFound: boolean };

type Cols = { date: number; type: number; num: number; trans: number; name: number; memo: number; account: number; debit: number; credit: number; amount: number };
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function columnsOf(row: unknown[]): Cols {
  const c: Cols = { date: -1, type: -1, num: -1, trans: -1, name: -1, memo: -1, account: -1, debit: -1, credit: -1, amount: -1 };
  row.forEach((v, i) => {
    const h = norm(v);
    if (!h) return;
    if (c.date < 0 && /^(transaction )?date$/.test(h)) c.date = i;
    else if (c.trans < 0 && /^trans(action)? ?#|^trans no/.test(h)) c.trans = i;
    else if (c.type < 0 && /^(transaction )?type$/.test(h)) c.type = i;
    else if (c.num < 0 && /^(num|no\.?|number|ref( no\.?)?)$/.test(h)) c.num = i;
    else if (c.name < 0 && /^(name|payee|customer|vendor)$/.test(h)) c.name = i;
    else if (c.memo < 0 && /memo|description/.test(h)) c.memo = i;
    else if (c.account < 0 && /^(account|full name|account (name|full name))$/.test(h)) c.account = i;
    else if (c.debit < 0 && /^debit/.test(h)) c.debit = i;
    else if (c.credit < 0 && /^credit/.test(h)) c.credit = i;
    else if (c.amount < 0 && /^amount$/.test(h)) c.amount = i;
  });
  return c;
}

/** "Expenses:Office Supplies" → "Office Supplies"; "1000 · Checking" / "1000 Checking" keep the name. */
export function qbLedger(raw: string): string {
  const last = raw.split(":").pop()!.trim();
  return last.replace(/^\d{3,6}\s*[·.\-]?\s+(?=\D)/, "").trim() || raw.trim();
}

export function parseQuickBooksJournal(grid: unknown[][]): QbResult {
  let head = -1, cols: Cols | null = null;
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const c = columnsOf(grid[r] ?? []);
    if (c.account >= 0 && (c.debit >= 0 || c.amount >= 0) && (c.date >= 0 || c.trans >= 0)) { head = r; cols = c; break; }
  }
  if (!cols) return { entries: [], unbalanced: 0, headerFound: false };
  const c = cols;
  const cell = (row: unknown[], i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");

  const entries: QbEntry[] = [];
  let unbalanced = 0;
  type Cur = { date: string; type: string; num: string; trans: string; party: string; memo: string; lines: QbEntry["lines"] };
  let cur = null as Cur | null;
  const close = () => {
    if (!cur || cur.lines.length < 2) { cur = null; return; }
    const dr = cur.lines.reduce((s, l) => s + l.dr, 0), cr = cur.lines.reduce((s, l) => s + l.cr, 0);
    if (Math.abs(dr - cr) > 0.01 || !cur.date) { unbalanced++; cur = null; return; }
    const total = Math.round(dr * 100) / 100;
    entries.push({
      external_id: [cur.date, cur.type, cur.num, cur.trans, total].join("|"),
      date: cur.date, type: cur.type, num: cur.num, party: cur.party || null, lines: cur.lines,
      description: cur.memo || [cur.type, cur.num ? `#${cur.num}` : "", cur.party].filter(Boolean).join(" ") || "QuickBooks entry",
    });
    cur = null;
  };

  for (const row of grid.slice(head + 1)) {
    if (!row || row.every(v => String(v ?? "").trim() === "")) { close(); continue; }
    if (row.some(v => /^total\b/i.test(String(v ?? "").trim()))) { close(); continue; }
    const date = cellDate(c.date >= 0 ? row[c.date] : "");
    const trans = cell(row, c.trans), type = cell(row, c.type), num = cell(row, c.num);
    const account = cell(row, c.account);
    const num0 = (v: unknown) => Number(cellNum(v)) || 0;   // an empty cell is 0, not "no number"
    let dr = c.debit >= 0 ? Math.abs(num0(row[c.debit])) : 0, cr = c.credit >= 0 ? Math.abs(num0(row[c.credit])) : 0;
    if (c.debit < 0 && c.amount >= 0) { const a = num0(row[c.amount]); dr = a > 0 ? a : 0; cr = a < 0 ? -a : 0; }
    // A new transaction starts at a dated row or a new Trans # (Desktop)
    const starts = !!date || (!!trans && trans !== (cur as Cur | null)?.trans);
    if (starts) { close(); cur = { date, type, num, trans, party: cell(row, c.name), memo: cell(row, c.memo), lines: [] }; }
    if (!cur) continue;
    // A row with amounts but no account is the transaction's totals row
    if (!account) { if (dr || cr) close(); continue; }
    if (!dr && !cr) continue;
    if (!cur.party) cur.party = cell(row, c.name);
    if (!cur.memo) cur.memo = cell(row, c.memo);
    cur.lines.push({ ledger: qbLedger(account), dr: Math.round(dr * 100) / 100, cr: Math.round(cr * 100) / 100 });
  }
  close();
  return { entries, unbalanced, headerFound: true };
}
