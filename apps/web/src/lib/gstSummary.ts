// GST summary with sales classified per entry (B11). A sale is "taxable" only when the same entry charged output GST;
// entries marked 0%/exempt are "nil/exempt"; everything else is "non-GST / out of scope". Pure.
//
// Taxable value and output tax are read from the invoices themselves, the way GSTR-1 reads them: in an entry that
// charges output GST, the taxable value is every non-tax line on the same side as the tax (whatever the income ledger
// is called — "Audit fee", "Accounts finalisation"…), and a credit note reverses it. GST journals that only move tax
// ledgers (set-off, payment, transfer) are not sales and are kept apart as "other_tax_movement".
export type GstLine = { account: string; dr: number; cr: number };
export type GstEntry = { lines: GstLine[]; metadata?: { gst?: { applicable?: boolean; rate?: number; supply?: string } | null } | null };
export type SalesClass = "taxable" | "nil_exempt" | "non_gst";
export type GstSummary = {
  total_sales: number; taxable_sales: number; nil_exempt_sales: number; non_gst_sales: number;
  total_purchases: number; cgst_payable: number; sgst_payable: number; igst_payable: number; output_tax: number;
  input_credit: number; net_gst_payable: number;
  other_tax_movement: number;   // output-GST ledger movement in entries that aren't sales (journals, set-off) — not in output_tax
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const outKind = (n: string) => /input|itc|reverse|rcm/i.test(n) ? null : /igst/i.test(n) ? "igst" : /cgst/i.test(n) ? "cgst" : /sgst|utgst/i.test(n) ? "sgst" : null;
export const isInputTax = (n: string) => /gst/i.test(n) && /input|itc/i.test(n);
export const isSalesLedger = (n: string) => /^sales\b|\bsales\b|sales account|revenue/i.test(n) && !/return|gst|tax/i.test(n);
const isPurchaseLedger = (n: string) => /purchase|cost of goods/i.test(n) && !/return|gst|tax/i.test(n);
const isTaxLedger = (n: string) => !!outKind(n) || isInputTax(n) || /\b(gst|tds|tcs|cess|round ?off)\b/i.test(n);

/** How this entry's sales are treated for GST. */
export function classifySale(e: GstEntry): SalesClass {
  const charged = e.lines.some(l => outKind(l.account) && (l.cr - l.dr) !== 0);
  if (charged) return "taxable";
  const g = e.metadata?.gst;
  if (g && (g.supply === "nil" || g.supply === "exempt" || (g.applicable && Number(g.rate) === 0))) return "nil_exempt";
  return "non_gst";
}

export function gstSummary(entries: GstEntry[]): GstSummary {
  let cgst = 0, sgst = 0, igst = 0, input = 0, purchases = 0, other = 0;
  const sales: Record<SalesClass, number> = { taxable: 0, nil_exempt: 0, non_gst: 0 };
  for (const e of entries) {
    const cls = classifySale(e);
    const tax = { cgst: 0, sgst: 0, igst: 0 };
    for (const l of e.lines) { const k = outKind(l.account); if (k) tax[k] += (l.cr || 0) - (l.dr || 0); }
    const outNet = tax.cgst + tax.sgst + tax.igst;
    // Value on the same side as the tax: credits for a sale, debits for a credit note
    const side = Math.sign(outNet);
    const value = side ? e.lines.filter(l => !isTaxLedger(l.account) && side * ((l.cr || 0) - (l.dr || 0)) > 0).reduce((s, l) => s + (l.cr || 0) - (l.dr || 0), 0) : 0;
    if (outNet !== 0 && value !== 0) {
      cgst += tax.cgst; sgst += tax.sgst; igst += tax.igst;
      sales.taxable += value;
    } else if (outNet !== 0) {
      other += outNet;   // tax moved without a sale behind it
    }
    let inputHere = 0;
    for (const l of e.lines) {
      const net = (l.cr || 0) - (l.dr || 0);
      if (isInputTax(l.account)) { input -= net; inputHere -= net; }
      if (cls !== "taxable" && isSalesLedger(l.account)) sales[cls] += net;
      if (isPurchaseLedger(l.account)) purchases -= net;
    }
    // A bill with input GST under a non-"purchase" head (services, expenses) still counts as a purchase
    if (inputHere > 0 && !e.lines.some(l => isPurchaseLedger(l.account)))
      purchases += e.lines.filter(l => !isTaxLedger(l.account) && (l.dr || 0) > (l.cr || 0)).reduce((s, l) => s + (l.dr || 0) - (l.cr || 0), 0);
  }
  const output = cgst + sgst + igst;
  return {
    total_sales: r2(sales.taxable + sales.nil_exempt + sales.non_gst), taxable_sales: r2(sales.taxable), nil_exempt_sales: r2(sales.nil_exempt), non_gst_sales: r2(sales.non_gst),
    total_purchases: r2(purchases), cgst_payable: r2(cgst), sgst_payable: r2(sgst), igst_payable: r2(igst), output_tax: r2(output),
    input_credit: r2(input), net_gst_payable: r2(Math.max(0, output - input)), other_tax_movement: r2(other),
  };
}
