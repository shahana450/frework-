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

// The open business's currency in the browser. The finance layout sets it when the business loads,
// so every page can show $ / AED / € for a non-Indian business instead of a hard-coded ₹.
let active: MoneyFormat = DEFAULT_MONEY;
let activeCountryCode = "IN";
export function setActiveCurrency(currency?: string | null, country?: string | null) {
  const code = String(currency || "INR").toUpperCase();
  activeCountryCode = String(country || (code === "INR" ? "IN" : "")).toUpperCase();
  active = { currency: code, locale: code === "INR" || country === "IN" ? "en-IN" : "en-US" };
}
export const activeMoney = (): MoneyFormat => active;
/** Country of the open business ("IN" for India) — Indian tax screens show only for India. */
export const activeCountry = (): string => activeCountryCode;
/** The currency sign for the open business, e.g. "₹", "$", "AED". */
export function cur(): string {
  try { return new Intl.NumberFormat(active.locale, { style: "currency", currency: active.currency }).formatToParts(0).find(p => p.type === "currency")?.value ?? "₹"; }
  catch { return active.currency; }
}
