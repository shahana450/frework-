// Quick bill maths for the sales invoice screen. Pure — no database access.
import { STATE_CODES } from "./gstr1";

export type BillLine = { description: string; hsn: string; qty: string; rate: string; gst: string; priceIncludesGst?: boolean };
export type BillLineCalc = { taxable: number; cgst: number; sgst: number; igst: number; total: number };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (s: string) => { const n = parseFloat(String(s).replace(/,/g, "")); return isFinite(n) ? n : 0; };

const CODE_TO_STATE = Object.fromEntries(Object.entries(STATE_CODES).map(([name, code]) => [code, name.replace(/\b\w/g, c => c.toUpperCase())]));

/** "32ABCDE1234F1Z5" → "Kerala"; anything else → null. */
export function stateFromGstin(gstin?: string | null): string | null {
  const m = /^(\d{2})[A-Z]{5}\d{4}[A-Z]/.exec((gstin ?? "").trim().toUpperCase());
  return m ? CODE_TO_STATE[m[1]] ?? null : null;
}

/** Different state from the business → IGST; same state, or unknown → CGST + SGST. */
export function isInterState(bizState?: string | null, customerState?: string | null): boolean {
  const a = (bizState ?? "").trim().toLowerCase(), b = (customerState ?? "").trim().toLowerCase();
  return !!a && !!b && a !== b;
}

export function calcLine(l: BillLine, interState: boolean): BillLineCalc {
  const rate = num(l.gst);
  const gross = num(l.qty) * num(l.rate);
  // A price typed "including GST" is split back into taxable value + tax
  const taxable = r2(l.priceIncludesGst ? gross / (1 + rate / 100) : gross);
  const tax = r2(l.priceIncludesGst ? gross - taxable : taxable * rate / 100);
  const igst = interState ? tax : 0;
  const cgst = interState ? 0 : r2(tax / 2);
  const sgst = interState ? 0 : r2(tax - cgst);
  return { taxable, cgst, sgst, igst, total: r2(taxable + tax) };
}

export function billTotals(lines: BillLine[], interState: boolean) {
  const calc = lines.map(l => calcLine(l, interState));
  const sum = (k: keyof BillLineCalc) => r2(calc.reduce((s, c) => s + c[k], 0));
  const subtotal = sum("taxable"), cgst = sum("cgst"), sgst = sum("sgst"), igst = sum("igst");
  const exact = r2(subtotal + cgst + sgst + igst);
  const rounded = Math.round(exact);
  return { calc, subtotal, cgst, sgst, igst, gst: r2(cgst + sgst + igst), exact, roundOff: r2(rounded - exact), total: rounded };
}
