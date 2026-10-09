// Voucher numbering (B12): a separate series per voucher type, per financial year, configurable per business.
// Mirrors fw_fin_series_prefix() in 2026-10-16_b12_voucher_series.sql — keep the two in step.
export const DEFAULT_SERIES: Record<string, string> = {
  receipt: "RV", payment: "PV", sales: "SV", purchase: "PU", journal: "JV", contra: "CV", credit_note: "CN", debit_note: "DN",
};

/** "2026-27" for a financial year starting 1 Apr 2026 (or any start date in 2026). */
export const fyLabel = (fyStart: string) => { const y = +fyStart.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };

/** Prefix for the next number, e.g. "RV/2026-27". `overrides` comes from fw_fin_businesses.voucher_series. */
export function seriesPrefix(type: string, fyStart: string, overrides: Record<string, string> = {}): string {
  const t = (type || "journal").toLowerCase();
  const code = (overrides[t] ?? DEFAULT_SERIES[t] ?? "JV").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "JV";
  return `${code}/${fyLabel(fyStart)}`;
}
export const formatVoucherNo = (prefix: string, n: number) => `${prefix}/${String(n).padStart(4, "0")}`;

/**
 * What kind of voucher an entry is, from its lines: money out of cash/bank is a Payment, money in a Receipt,
 * cash↔bank a Contra. A fixed asset bought from the bank is a PAYMENT, never a "Purchase" (that register is for goods).
 */
export function voucherKind(requested: string, lines: { cashBank: boolean; dr: number; cr: number; isGoodsPurchase?: boolean; isSale?: boolean }[]): string {
  const t = (requested || "").toLowerCase();
  const out = lines.some(l => l.cashBank && l.cr > 0), into = lines.some(l => l.cashBank && l.dr > 0);
  if (out && into && lines.every(l => l.cashBank)) return "contra";
  if (t === "sales" || t === "credit_note" || t === "debit_note") return t;
  // Goods bought for resale/production use the Purchase register however they're paid
  if (lines.some(l => l.isGoodsPurchase)) return "purchase";
  if (out && !into) return "payment";
  if (into && !out) return "receipt";
  // Anything else (incl. an asset bought on credit) is a journal, never "purchase"
  return t === "purchase" ? "journal" : t || "journal";
}
