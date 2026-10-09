// Money formatting by the business's currency and locale (not hard-coded ₹).
export type MoneyFormat = { currency: string; locale: string };
export const DEFAULT_MONEY: MoneyFormat = { currency: "INR", locale: "en-IN" };

export function formatMoney(n: number, f: MoneyFormat = DEFAULT_MONEY, opts: { decimals?: boolean } = {}): string {
  const v = Number(n) || 0;
  const decimals = opts.decimals ?? Math.abs(v) % 1 !== 0;
  try {
    return new Intl.NumberFormat(f.locale, { style: "currency", currency: f.currency, minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 }).format(v).replace("-", "−");
  } catch {
    return `${v < 0 ? "−" : ""}${f.currency} ${Math.abs(v).toFixed(decimals ? 2 : 0)}`;
  }
}
