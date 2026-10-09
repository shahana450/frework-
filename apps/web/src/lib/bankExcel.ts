// Reads a bank statement laid out as rows and columns (Excel / CSV) — any Indian bank's layout. Pure: give it the sheet as a grid.
// Handles: header rows anywhere in the first 40 lines, separate Debit/Credit columns or one Amount column with Dr/Cr,
// signed amounts, Excel date serials, "01-Apr-26" / "01/04/2026" / "2026-04-01" dates, and summary rows at the end.

export type StmtLine = { date: string; description: string; debit: number; credit: number; balance: number };
export type GridResult = { rows: StmtLine[]; header: string[]; headerRow: number; note?: string };

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** A cell as YYYY-MM-DD, or "" when it isn't a date. Uses local calendar parts (no time-zone shift). */
export function cellDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === "number" && v > 20000 && v < 80000) {             // Excel serial (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i, "");
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);           // Indian order: day first
  if (m) return ok(year(m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ,]*(\d{2,4})$/);      // 01-Apr-26, 1 April 2026
  if (m) { const mo = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)]; if (mo) return ok(year(m[3]), mo, +m[1]); }
  m = s.match(/^([A-Za-z]{3,9})[ -](\d{1,2}),?[ -](\d{2,4})$/);         // Apr 01, 2026
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return ok(year(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return "";
}
function ok(y: number, mo: number, d: number) {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** A cell as a number; "1,23,456.00", "(500)", "-500", "500 Dr" all work. Returns NaN when it isn't a number. */
export function cellNum(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s || s === "-") return NaN;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /\bdr\.?$/i.test(s);
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? NaN : neg ? -n : n;
}

// Header words → column role. Whole words only, so "description" never counts as "cr".
const ROLE: [keyof Cols, RegExp][] = [
  ["date", /^(txn |tran |transaction |posting |post |value )?(date|dt)$|^date\b|\btxn date\b|\btransaction date\b|\bpost(ing)? date\b/],
  ["valueDate", /\bvalue (date|dt)\b/],
  ["desc", /\b(description|narration|particulars?|details?|remarks?|transaction remarks|transaction details|narrative)\b/],
  ["debit", /\b(debit|debits|withdrawal|withdrawals|withdrawal amt|dr amount|debit amount|paid out|money out|dr)\b/],
  ["credit", /\b(credit|credits|deposit|deposits|deposit amt|cr amount|credit amount|paid in|money in|cr)\b/],
  ["amount", /^(transaction )?amount( inr| rs)?$|\bamount\b/],
  ["drcr", /^(dr ?\/ ?cr|cr ?\/ ?dr|type|txn type|debit ?\/ ?credit|d ?\/ ?c)$/],
  ["balance", /\b(balance|closing balance|running balance|available balance|bal)\b/],
];
type Cols = { date: number; valueDate: number; desc: number; debit: number; credit: number; amount: number; drcr: number; balance: number };

function columnsOf(header: unknown[]): Cols {
  const h = header.map(norm);
  const c: Cols = { date: -1, valueDate: -1, desc: -1, debit: -1, credit: -1, amount: -1, drcr: -1, balance: -1 };
  // Most specific roles first; a column is used once
  const order: (keyof Cols)[] = ["drcr", "valueDate", "balance", "debit", "credit", "date", "desc", "amount"];
  const taken = new Set<number>();
  for (const role of order) {
    const re = ROLE.find(r => r[0] === role)![1];
    const i = h.findIndex((x, k) => !taken.has(k) && x && re.test(x));
    if (i >= 0) { c[role] = i; taken.add(i); }
  }
  if (c.date < 0 && c.valueDate >= 0) { c.date = c.valueDate; }
  return c;
}
const scoreOf = (c: Cols) => (c.date >= 0 ? 2 : 0) + (c.desc >= 0 ? 1 : 0) + (c.debit >= 0 || c.amount >= 0 ? 1 : 0) + (c.credit >= 0 ? 1 : 0) + (c.balance >= 0 ? 0.5 : 0);

export function parseStatementGrid(grid: unknown[][]): GridResult {
  // The header is the row (within the first 40) that names the most statement columns
  let best = { row: -1, cols: null as Cols | null, score: 0 };
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const cols = columnsOf(grid[r] ?? []);
    const s = scoreOf(cols);
    if (s > best.score && cols.date >= 0 && (cols.debit >= 0 || cols.amount >= 0 || cols.credit >= 0)) best = { row: r, cols, score: s };
  }
  if (!best.cols) return { rows: [], header: [], headerRow: -1, note: "Couldn't find the column headings (Date, Narration, Debit, Credit…)." };
  const c = best.cols;
  const rows: StmtLine[] = [];
  let lastDated: StmtLine | null = null;
  for (const r of grid.slice(best.row + 1)) {
    const date = cellDate(r[c.date]);
    const desc = c.desc >= 0 ? String(r[c.desc] ?? "").replace(/\s+/g, " ").trim() : "";
    if (!date) {
      // Narration that wraps onto the next row (common in HDFC / SBI exports)
      if (lastDated && desc && r.every((v, k) => k === c.desc || v === "" || v == null)) lastDated.description = `${lastDated.description} ${desc}`.trim();
      continue;
    }
    let debit = 0, credit = 0;
    if (c.debit >= 0 || c.credit >= 0) {
      const d = c.debit >= 0 ? cellNum(r[c.debit]) : NaN, k = c.credit >= 0 ? cellNum(r[c.credit]) : NaN;
      debit = isNaN(d) ? 0 : Math.abs(d); credit = isNaN(k) ? 0 : Math.abs(k);
    } else if (c.amount >= 0) {
      const a = cellNum(r[c.amount]);
      if (isNaN(a)) continue;
      const flag = c.drcr >= 0 ? norm(r[c.drcr]) : "";
      if (/^(dr|d|debit|withdrawal)/.test(flag)) debit = Math.abs(a);
      else if (/^(cr|c|credit|deposit)/.test(flag)) credit = Math.abs(a);
      else if (a < 0 || /\bdr\.?$/i.test(String(r[c.amount]))) debit = Math.abs(a);
      else credit = a;
    }
    if (!debit && !credit) continue;                                   // opening-balance and summary lines
    const bal = c.balance >= 0 ? cellNum(r[c.balance]) : NaN;
    const line = { date, description: desc || "Bank transaction", debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100, balance: isNaN(bal) ? 0 : Math.abs(bal) };
    rows.push(line); lastDated = line;
  }
  return { rows, header: (grid[best.row] ?? []).map(String), headerRow: best.row };
}
