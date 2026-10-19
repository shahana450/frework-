// Styled Excel output (ExcelJS) for the statement sheets built in s3Export.ts / statementExport.ts.
// Each sheet's rows follow one shape: [title], [business], [period], [], [column headings], …body.
// Body rows are styled by what they are: part headings, sub-headings, ledgers, totals.
import type { Cell } from "./statementExport";

const NAVY = "FF232A63", INK = "FF141A3A", MUTED = "FF5A6080", SOFT = "FFE6E8F4", TINT = "FFF4F5FB", TOTAL = "FFEEF0FA", LINE = "FFC9CEDF";
const MONEY = '#,##,##0.00;[Red]-#,##,##0.00;"–"';

export type SheetSpec = { name: string; rows: Cell[][]; widths: number[]; moneyFrom: number; noteCol?: number };

type Kind = "part" | "block" | "total" | "grand" | "noteHead" | "line" | "blank";
function kindOf(r: Cell[]): Kind {
  const t = String(r.find(c => typeof c === "string" && c.trim()) ?? "").trim();
  if (!r.length || r.every(c => c === null || c === "")) return "blank";
  if (/^Closing Balance$/.test(t)) return "grand";
  if (/^Opening Balance$/.test(t)) return "total";
  if (/^(TOTAL|Grand Total)$/i.test(t) || /for the year$/i.test(t) || /^Closing cash/i.test(t)) return "grand";
  if (/^(Total\b|III\.|V\.|Net cash|Net change|Opening cash)/i.test(t) || /before tax/i.test(t)) return "total";
  if (/^(BS|P&L) Note \d+:/.test(t)) return "noteHead";
  // Section headings carry no amount; ledger names in capitals are not headings
  const hasNum = r.some(c => typeof c === "number");
  if (!hasNum && (/^(I|II|IV)\.\s/.test(t) || /^(BALANCE SHEET|PROFIT AND LOSS|[A-Z]+ ACTIVITIES)$/.test(t))) return "part";
  if (hasNum && /^(I|II)\.\s/.test(t)) return "total";
  if (/^\(\d+\)\s/.test(t)) return "block";
  return "line";
}

/** The workbook bytes (used by the download below, and by tests). */
export async function buildStyledWorkbook(sheets: SheetSpec[], generatedFor: string): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "FreBook by FreWork"; wb.created = new Date();

  for (const s of sheets) {
    const cols = Math.max(...s.rows.map(r => r.length), s.widths.length);
    const ws = wb.addWorksheet(s.name, {
      views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: cols > 4 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
      headerFooter: { oddFooter: `&L&8${generatedFor}&R&8Page &P of &N` },
    });
    ws.columns = s.widths.map(w => ({ width: w }));
    const [title, business, period, , heads, ...body] = s.rows;

    // Title band, business name, period
    const tRow = ws.addRow([String(title?.[0] ?? "")]);
    ws.mergeCells(tRow.number, 1, tRow.number, cols);
    tRow.height = 30;
    tRow.getCell(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    tRow.getCell(1).alignment = { vertical: "middle", indent: 1 };
    for (let c = 1; c <= cols; c++) tRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    const bRow = ws.addRow([String(business?.[0] ?? "")]);
    ws.mergeCells(bRow.number, 1, bRow.number, cols);
    bRow.getCell(1).font = { size: 12, bold: true, color: { argb: INK } }; bRow.getCell(1).alignment = { indent: 1 }; bRow.height = 20;
    const pRow = ws.addRow([String(period?.[0] ?? "")]);
    ws.mergeCells(pRow.number, 1, pRow.number, cols);
    pRow.getCell(1).font = { size: 10, italic: true, color: { argb: MUTED } }; pRow.getCell(1).alignment = { indent: 1 };

    // Column headings
    const hRow = ws.addRow((heads ?? []).map(h => h ?? ""));
    hRow.height = 22;
    for (let c = 1; c <= cols; c++) {
      const cell = hRow.getCell(c);
      cell.font = { bold: true, size: 10, color: { argb: NAVY } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
      cell.border = { top: { style: "thin", color: { argb: NAVY } }, bottom: { style: "thin", color: { argb: NAVY } } };
      cell.alignment = { vertical: "middle", horizontal: c - 1 >= s.moneyFrom || c - 1 === s.noteCol ? (c - 1 === s.noteCol ? "center" : "right") : "left", indent: c === 1 ? 1 : 0 };
    }

    for (const r of body) {
      const k = kindOf(r);
      const row = ws.addRow(r.map(v => (typeof v === "string" ? v.replace(/^\s+/, "") : v ?? null)));
      if (k === "blank") { row.height = 8; continue; }
      const lead = typeof r[0] === "string" ? (r[0].match(/^\s*/)?.[0].length ?? 0) : 0;
      for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c), i = c - 1;
        const isNum = typeof cell.value === "number";
        if (isNum && i === s.noteCol) { cell.alignment = { horizontal: "center" }; cell.font = { color: { argb: NAVY }, size: 10 }; }
        else if (isNum) { cell.numFmt = MONEY; cell.alignment = { horizontal: "right" }; }
        else if (i === 0 || (s.moneyFrom > 1 && i < s.moneyFrom)) cell.alignment = { indent: Math.min(6, 1 + Math.round(lead / 2)), vertical: "middle", wrapText: false };
        const fill = (argb: string) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; };
        if (k === "part") { cell.font = { bold: true, size: 11, color: { argb: NAVY } }; fill(TINT); }
        else if (k === "block" || k === "noteHead") { cell.font = { ...(cell.font ?? {}), bold: true, color: { argb: INK } }; if (k === "noteHead") { fill(TINT); cell.border = { top: { style: "thin", color: { argb: LINE } } }; } }
        else if (k === "total") { cell.font = { bold: true, color: { argb: INK } }; cell.border = { top: { style: "thin", color: { argb: LINE } } }; }
        else if (k === "grand") { cell.font = { bold: true, size: 11, color: { argb: NAVY } }; fill(TOTAL); cell.border = { top: { style: "thin", color: { argb: NAVY } }, bottom: { style: "double", color: { argb: NAVY } } }; }
        else if (i === 0) cell.font = { color: { argb: INK }, size: 10.5 };
        else if (isNum && i !== s.noteCol) cell.font = { size: 10.5 };
      }
      row.height = k === "grand" ? 22 : k === "part" ? 20 : 17;
    }
    ws.addRow([]);
    const f = ws.addRow([generatedFor]);
    f.getCell(1).font = { italic: true, size: 9, color: { argb: MUTED } };
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function writeStyledWorkbook(sheets: SheetSpec[], fileName: string, generatedFor: string) {
  const buf = await buildStyledWorkbook(sheets, generatedFor);
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
