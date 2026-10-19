// One Excel workbook with every statement, as shown on screen: Balance Sheet and P&L in Schedule III format,
// their notes (ledger by ledger), the Trial Balance with opening and movement, and the Cash Flow.
import type { Schedule3BS, Schedule3PL, S3Head } from "./schedule3";
import type { Cell, ExportMeta } from "./statementExport";

export type TBExportRow = { code?: string; name: string; opening?: number; period_dr?: number; period_cr?: number; dr: number; cr: number };
export type CFExport = { opening: number; closing: number; operating: number; investing: number; financing: number; net: number; items: { section: "operating" | "investing" | "financing"; name: string; amount: number }[] };

const top = (title: string, m: ExportMeta, cols: string[]): Cell[][] => [[title], [m.business], [m.period], [], cols];
const letter = (i: number) => `(${String.fromCharCode(97 + i)})`;

export function bsS3Rows(s: Schedule3BS, m: ExportMeta): Cell[][] {
  const out: Cell[][] = top("Balance Sheet (Schedule III)", m, ["Particulars", "Note", "Amount (₹)"]);
  const part = (roman: string, title: string, blocks: Schedule3BS["assets"], total: number) => {
    out.push([`${roman}. ${title.toUpperCase()}`, null, null]);
    blocks.forEach((b, bi) => {
      out.push([`  (${bi + 1}) ${b.label}`, null, null]);
      b.heads.forEach((h, hi) => out.push([`      ${letter(hi)} ${h.label}`, h.note, h.total]));
    });
    out.push(["TOTAL", null, total], []);
  };
  part("I", "Equity and liabilities", s.equityLiabilities, s.totalEL);
  part("II", "Assets", s.assets, s.totalAssets);
  return out;
}

export function plS3Rows(s: Schedule3PL, m: ExportMeta): Cell[][] {
  const out: Cell[][] = top("Statement of Profit and Loss (Schedule III)", m, ["Particulars", "Note", "Amount (₹)"]);
  if (s.revenue) out.push([`I. ${s.revenue.label}`, s.revenue.note, s.revenue.total]);
  if (s.otherIncome) out.push([`II. ${s.otherIncome.label}`, s.otherIncome.note, s.otherIncome.total]);
  out.push(["III. Total income (I + II)", null, s.totalIncome], [], ["IV. Expenses", null, null]);
  s.expenses.forEach((h, i) => out.push([`      ${letter(i)} ${h.label}`, h.note, h.total]));
  out.push(["Total expenses (IV)", null, s.totalExpenses], [], [`V. ${s.pbt >= 0 ? "Profit" : "Loss"} before tax (III − IV)`, null, s.pbt]);
  if (s.tax) out.push([`VI. ${s.tax.label}`, s.tax.note, s.tax.total]);
  out.push([`${s.tax ? "VII" : "VI"}. ${s.profit >= 0 ? "Profit" : "Loss"} for the year`, null, s.profit]);
  return out;
}

/** Every note with its ledgers — Balance Sheet notes, then P&L notes. */
export function notesRows(bs: Schedule3BS | undefined, pl: Schedule3PL | undefined, m: ExportMeta): Cell[][] {
  const out: Cell[][] = top("Notes to accounts", m, ["Particulars", "", "Amount (₹)"]);
  const note = (prefix: string, h: S3Head) => {
    out.push([`${prefix} Note ${h.note}: ${h.label}`, null, null]);
    for (const l of h.lines) out.push([`    ${l.name}${l.note ? ` (${l.note})` : ""}`, null, l.amount]);
    out.push(["    Total", null, h.total], []);
  };
  if (bs) { out.push(["BALANCE SHEET"]); for (const b of [...bs.equityLiabilities, ...bs.assets]) b.heads.forEach(h => note("BS", h)); }
  if (pl) { out.push(["PROFIT AND LOSS"]); [pl.revenue, pl.otherIncome, ...pl.expenses, pl.tax].forEach(h => h && note("P&L", h)); }
  return out;
}

export function tbRows(rows: TBExportRow[], m: ExportMeta): Cell[][] {
  const out: Cell[][] = top("Trial Balance", m, ["Code", "Account", "Opening Dr", "Opening Cr", "Debit", "Credit", "Closing Dr", "Closing Cr"]);
  const t = [0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const op = r.opening ?? 0;
    const v = [Math.max(op, 0), Math.max(-op, 0), r.period_dr ?? 0, r.period_cr ?? 0, r.dr, r.cr];
    v.forEach((x, i) => { t[i] += x; });
    out.push([r.code ?? "", r.name, ...v.map(x => (Math.abs(x) < 0.005 ? null : Math.round(x * 100) / 100))]);
  }
  out.push([], [null, "Grand Total", ...t.map(x => Math.round(x * 100) / 100)]);
  return out;
}

export function cfRows(cf: CFExport, m: ExportMeta): Cell[][] {
  const out: Cell[][] = top("Cash Flow Statement (direct method)", m, ["Particulars", "Amount (₹)"]);
  out.push(["Opening cash & bank balance", cf.opening], []);
  for (const [k, title, total] of [["operating", "Operating activities", cf.operating], ["investing", "Investing activities", cf.investing], ["financing", "Financing activities", cf.financing]] as const) {
    out.push([title.toUpperCase(), null]);
    for (const i of cf.items.filter(x => x.section === k)) out.push([`    ${i.amount >= 0 ? "Received" : "Paid"} — ${i.name}`, i.amount]);
    out.push([`Net cash from ${title.toLowerCase()}`, total], []);
  }
  out.push(["Net change in cash", cf.net], ["Closing cash & bank balance", cf.closing]);
  return out;
}

export const allStatementsFileName = (m: ExportMeta) =>
  `Financial-Statements-${m.business}-${m.period}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) + ".xlsx";
