// "Export all my data" (promised in the Privacy Policy): one ZIP of CSV files for the active business.
// Pure helpers here; the route in api/finance/data-export loads the rows.
import { buildZip } from "./zip";

type Row = Record<string, unknown>;

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Quote when needed; neutralise spreadsheet formulas (CSV injection) by prefixing an apostrophe
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV with a header row. Columns are the union of keys, in first-seen order. Nested objects are dropped unless listed. */
export function toCsv(rows: Row[], columns?: string[]): string {
  const cols = columns ?? [...rows.reduce((set, r) => { for (const k of Object.keys(r)) if (r[k] === null || typeof r[k] !== "object" || Array.isArray(r[k]) || k === "metadata") set.add(k); return set; }, new Set<string>())];
  const lines = [cols.map(cell).join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";   // BOM so Excel opens ₹ and Malayalam text correctly
}

export type ExportData = { business: Row; ledgers: Row[]; journals: Row[]; lines: Row[]; parties: Row[]; financialYears: Row[] };

export const EXPORT_FILES = ["business.csv", "ledgers.csv", "journals.csv", "journal_lines.csv", "parties.csv", "financial_years.csv", "README.txt"] as const;

export function buildDataExport(d: ExportData, exportedAt = new Date()): Uint8Array {
  const readme = [
    `FreWork data export — ${String(d.business.name ?? "")}`,
    `Exported: ${exportedAt.toISOString()}`,
    "",
    "business.csv         your business profile",
    "ledgers.csv          chart of accounts (ledgers)",
    "journals.csv         every entry (voucher) — one row per entry",
    "journal_lines.csv    the debit/credit lines of every entry (journal_id links to journals.csv)",
    "parties.csv          customers and suppliers",
    "financial_years.csv  financial years",
    "",
    "Amounts are in your base currency. Opens in Excel, Google Sheets or any accounting tool that imports CSV.",
  ].join("\r\n");
  return buildZip([
    { name: "business.csv", data: toCsv([d.business]) },
    { name: "ledgers.csv", data: toCsv(d.ledgers) },
    { name: "journals.csv", data: toCsv(d.journals) },
    { name: "journal_lines.csv", data: toCsv(d.lines) },
    { name: "parties.csv", data: toCsv(d.parties) },
    { name: "financial_years.csv", data: toCsv(d.financialYears) },
    { name: "README.txt", data: readme },
  ], exportedAt);
}

export const exportZipName = (businessName: string, d = new Date()) =>
  `FreWork-data-${businessName}-${d.toISOString().slice(0, 10)}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 100) + ".zip";

/** The owner must type the business name exactly (spaces at the ends and letter case don't matter). */
export const deleteConfirmed = (typed: string | null | undefined, businessName: string | null | undefined) =>
  !!typed && !!businessName && typed.trim().replace(/\s+/g, " ").toLowerCase() === businessName.trim().replace(/\s+/g, " ").toLowerCase();

export const PURGE_AFTER_DAYS = 30;

/** A soft-deleted business row (column added by 2026-10-20_t5_business_delete.sql; absent before it runs). */
export const isSoftDeleted = (biz: Record<string, unknown> | null | undefined) => !!biz && !!biz.deleted_at;
