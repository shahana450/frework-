// GST summary with sales classified per entry (B11). A sale is "taxable" only when the same entry charged output GST;
// entries marked 0%/exempt are "nil/exempt"; everything else is "non-GST / out of scope". Pure.
export type GstLine = { account: string; dr: number; cr: number };
export type GstEntry = { lines: GstLine[]; metadata?: { gst?: { applicable?: boolean; rate?: number; supply?: string } | null } | null };
export type SalesClass = "taxable" | "nil_exempt" | "non_gst";
export type GstSummary = {
  total_sales: number; taxable_sales: number; nil_exempt_sales: number; non_gst_sales: number;
  total_purchases: number; cgst_payable: number; sgst_payable: number; igst_payable: number; output_tax: number;
  input_credit: number; net_gst_payable: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const outKind = (n: string) => /input|itc|reverse|rcm/i.test(n) ? null : /igst/i.test(n) ? "igst" : /cgst/i.test(n) ? "cgst" : /sgst|utgst/i.test(n) ? "sgst" : null;
export const isInputTax = (n: string) => /gst/i.test(n) && /input|itc/i.test(n);
export const isSalesLedger = (n: string) => /^sales\b|\bsales\b|sales account|revenue/i.test(n) && !/return|gst|tax/i.test(n);
const isPurchaseLedger = (n: string) => /purchase|cost of goods/i.test(n) && !/return|gst|tax/i.test(n);

/** How this entry's sales are treated for GST. */
export function classifySale(e: GstEntry): SalesClass {
  const charged = e.lines.some(l => outKind(l.account) && (l.cr - l.dr) !== 0);
  if (charged) return "taxable";
  const g = e.metadata?.gst;
  if (g && (g.supply === "nil" || g.supply === "exempt" || (g.applicable && Number(g.rate) === 0))) return "nil_exempt";
  return "non_gst";
}

export function gstSummary(entries: GstEntry[]): GstSummary {
  let cgst = 0, sgst = 0, igst = 0, input = 0, purchases = 0;
  const sales: Record<SalesClass, number> = { taxable: 0, nil_exempt: 0, non_gst: 0 };
  for (const e of entries) {
    const cls = classifySale(e);
    for (const l of e.lines) {
      const net = (l.cr || 0) - (l.dr || 0);
      const k = outKind(l.account);
      if (k === "cgst") cgst += net; else if (k === "sgst") sgst += net; else if (k === "igst") igst += net;
      if (isInputTax(l.account)) input -= net;
      if (isSalesLedger(l.account)) sales[cls] += net;
      if (isPurchaseLedger(l.account)) purchases -= net;
    }
  }
  const output = cgst + sgst + igst;
  return {
    total_sales: r2(sales.taxable + sales.nil_exempt + sales.non_gst), taxable_sales: r2(sales.taxable), nil_exempt_sales: r2(sales.nil_exempt), non_gst_sales: r2(sales.non_gst),
    total_purchases: r2(purchases), cgst_payable: r2(cgst), sgst_payable: r2(sgst), igst_payable: r2(igst), output_tax: r2(output),
    input_credit: r2(input), net_gst_payable: r2(Math.max(0, output - input)),
  };
}
