// Excel / PDF exports of the Balance Sheet and P&L (follow-up to B1). They are built ONLY from the presented
// statements (presentBalanceSheet / presentPL), so every line, sign and total matches the screen.
import type { PresentedBS, PresentedPL, StmtSection } from "./statements";

export type Cell = string | number | null;
export type ExportMeta = { business: string; period: string };

const sectionRows = (s: StmtSection): Cell[][] => [
  [s.title, null],
  ...s.lines.map(l => [l.note ? `  ${l.name} (${l.note})` : `  ${l.name}`, l.amount] as Cell[]),
  [`Total ${s.title}`, s.total],
  [null, null],
];

const header = (title: string, m: ExportMeta): Cell[][] => [[title, null], [m.business, null], [m.period, null], [null, null], ["Particulars", "Amount (₹)"]];

/** Rows for the P&L sheet: signed numbers, exactly the presented lines. */
export function plExportRows(p: PresentedPL, m: ExportMeta): Cell[][] {
  const [sales, direct, other, opex] = p.sections;
  return [
    ...header("Profit & Loss", m),
    ...sectionRows(sales), ...sectionRows(direct),
    [p.grossProfit >= 0 ? "Gross Profit" : "Gross Loss", p.grossProfit], [null, null],
    ...sectionRows(other), ...sectionRows(opex),
    [p.netProfit >= 0 ? "Net Profit" : "Net Loss", p.netProfit],
    ...(p.footed ? [] : [[null, null], [`⚠ Doesn't add up: ${p.problems.join("; ")}`, null]] as Cell[][]),
  ];
}

/** Rows for the Balance Sheet: assets, then liabilities and equity, as presented (overdrafts under liabilities). */
export function bsExportRows(p: PresentedBS, m: ExportMeta): Cell[][] {
  return [
    ...header("Balance Sheet", m),
    ["ASSETS", null], ...p.assets.flatMap(sectionRows), ["Total Assets", p.totalAssets], [null, null],
    ["LIABILITIES & EQUITY", null], ...p.liabilities.flatMap(sectionRows), ["Total Liabilities & Equity", p.totalLiabilities],
    ...(p.footed ? [] : [[null, null], [`⚠ Doesn't add up: ${p.problems.join("; ")}`, null]] as Cell[][]),
  ];
}

/** Number cells of an export, in order — used by tests to prove the export equals the screen. */
export const exportAmounts = (rows: Cell[][]) => rows.map(r => r[1]).filter((v): v is number => typeof v === "number");

export const exportFileName = (kind: "Balance-Sheet" | "Profit-and-Loss", m: ExportMeta) =>
  `${kind}-${m.business}-${m.period}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) + ".xlsx";
