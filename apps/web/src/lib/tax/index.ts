// Country tax modules. The accounting core asks the module how to split a tax amount and which
// ledgers to use; it never contains country rules itself. Unsupported regimes are "NONE", never guessed.

export type TaxComponent = { code: string; amount: number; inputLedger: string; outputLedger: string };
export type TaxSplit = { taxable: number; gross: number; components: TaxComponent[] };
export type Supply = "intra" | "inter" | null;

export type TaxModule = {
  id: "IN_GST" | "NONE";
  name: string;            // shown in settings
  taxName: string | null;  // "GST", "VAT"… — null when the regime has no indirect tax handling
  split: (amount: number, rate: number, inclusive: boolean, supply: Supply) => TaxSplit;
  withholding: { name: string; payableLedger: string; receivableLedger: string } | null;
  aiRules: string;         // tax guidance appended to the AI instructions
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const noTaxSplit = (amount: number): TaxSplit => ({ taxable: r2(amount), gross: r2(amount), components: [] });

export const IN_GST: TaxModule = {
  id: "IN_GST", name: "India — GST & TDS", taxName: "GST",
  split(amount, rate, inclusive, supply) {
    if (!rate || rate <= 0) return noTaxSplit(amount);
    const taxable = inclusive ? r2(amount / (1 + rate / 100)) : r2(amount);
    const gross = inclusive ? r2(amount) : r2(amount * (1 + rate / 100));
    const tax = r2(gross - taxable);
    if (supply === "inter") return { taxable, gross, components: [{ code: "IGST", amount: tax, inputLedger: "Input IGST", outputLedger: "Output IGST" }] };
    const cgst = r2(tax / 2);   // halves so CGST + SGST always add back exactly
    return { taxable, gross, components: [
      { code: "CGST", amount: cgst, inputLedger: "Input CGST", outputLedger: "Output CGST" },
      { code: "SGST", amount: r2(tax - cgst), inputLedger: "Input SGST", outputLedger: "Output SGST" },
    ] };
  },
  withholding: { name: "TDS", payableLedger: "TDS Payable", receivableLedger: "TDS Receivable" },
  aiRules: `GST (India): same state as the business → intra (CGST+SGST); different state, "inter-state" or IGST → inter.
"including GST" → inclusive=true with the total as amount; "plus GST" → inclusive=false with the pre-tax amount.
TDS: only when mentioned — 194J professional 10%, 194C contractor 1%/2%, 194I rent 10%, 194A interest 10%.
Works contract / contractor / sub-contract / labour contract / civil work / job work is a SERVICE, never "Purchase": debit "Contract Charges" (expense; or the asset ledger if the user says it is capital work, e.g. building construction). TDS on contractors (Income-tax Act 2025 s.393(1) Table Sl. 6(i), was 194C) applies even if not mentioned when one payment is above ₹30,000 or the year's total above ₹1,00,000: 2% if the party is a firm/company/LLP ("Co.", "Ltd", "LLP", "& Co", "Pvt") — 1% if an individual or HUF; if unclear, use 2% and say so in "reason". Credit the party with the net amount and "TDS Payable" with the TDS.`,
};

export const NO_TAX: TaxModule = {
  id: "NONE", name: "No indirect tax handling", taxName: null,
  split: (amount) => noTaxSplit(amount),
  withholding: null,
  aiRules: `This business has no tax module configured. Record amounts as stated; set gst.applicable=false and tds.applicable=false. If the user mentions VAT/sales tax, record the gross amount and mention it in "reason".`,
};

const MODULES: Record<string, TaxModule> = { IN_GST, NONE: NO_TAX };
export const getTaxModule = (regime: string | null | undefined): TaxModule => MODULES[regime ?? "IN_GST"] ?? NO_TAX;

/** Regimes offered per country. Countries without a module get "NONE" until one is built. */
export const COUNTRY_TAX: Record<string, { regimes: TaxModule["id"][]; note?: string }> = {
  IN: { regimes: ["IN_GST", "NONE"] },
  AE: { regimes: ["NONE"], note: "UAE VAT module not available yet." },
  GB: { regimes: ["NONE"], note: "UK VAT module not available yet." },
  US: { regimes: ["NONE"], note: "US sales tax module not available yet." },
  SG: { regimes: ["NONE"], note: "Singapore GST module not available yet." },
  SA: { regimes: ["NONE"], note: "Saudi VAT module not available yet." },
  QA: { regimes: ["NONE"], note: "Qatar has no VAT; income and withholding tax reminders are shown." },
  OM: { regimes: ["NONE"], note: "Oman VAT module not available yet." },
  BH: { regimes: ["NONE"], note: "Bahrain VAT module not available yet." },
  KW: { regimes: ["NONE"], note: "Kuwait has no VAT; income tax reminders are shown." },
};

export const COUNTRIES: { code: string; name: string; currency: string; timezone: string; locale: string }[] = [
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata", locale: "en-IN" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai", locale: "en-AE" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London", locale: "en-GB" },
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York", locale: "en-US" },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore", locale: "en-SG" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", timezone: "Asia/Riyadh", locale: "en-SA" },
  { code: "QA", name: "Qatar", currency: "QAR", timezone: "Asia/Qatar", locale: "en-QA" },
  { code: "OM", name: "Oman", currency: "OMR", timezone: "Asia/Muscat", locale: "en-OM" },
  { code: "BH", name: "Bahrain", currency: "BHD", timezone: "Asia/Bahrain", locale: "en-BH" },
  { code: "KW", name: "Kuwait", currency: "KWD", timezone: "Asia/Kuwait", locale: "en-KW" },
];
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "SAR", "QAR", "OMR", "BHD", "KWD", "AUD", "CAD", "JPY"];
