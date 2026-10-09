// A printable tax invoice drafted from a posted income entry. Pure — no database access.
import { taxKind, isPartySide, type SavedInvoice } from "./gstr1Source";
import { inferRate } from "./gstr1";

export type InvItem = { desc: string; hsn: string; qty: number; unit: string; rate: number; gstRate: number; taxable: number; igst: number; cgst: number; sgst: number };
export type InvParty = { name: string; address: string; gstin: string; state: string; phone: string; email: string };
export type InvoiceDoc = {
  invoiceNo: string; date: string; dueDate: string; placeOfSupply: string;
  seller: InvParty & { logo: string | null; pan: string };
  buyer: InvParty;
  items: InvItem[];
  notes: string; terms: string; bankDetails: string;
  title: string;                       // "Tax Invoice" or "Invoice" (unregistered seller)
};
export type SourceJournal = {
  id: string; entry_no: string; date: string; type: string; narration: string; reference_no: string | null; party_name: string | null;
  metadata: Record<string, unknown> | null; lines: { dr: number; cr: number; account: string; accountType?: string | null; subType?: string | null }[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Does this entry record income (a credit to a sales/income ledger)? Capital, loans and transfers don't count. */
export function isIncomeEntry(lines: SourceJournal["lines"]): boolean {
  return lines.some(l => l.cr > 0 && !taxKind(l.account) && !isPartySide(l.account)
    && !/capital|loan|drawings|advance|deposit|suspense|transfer/i.test(l.account)
    && (/^(income|revenue)$/i.test(l.accountType ?? "") || /sales|indirect_income|revenue/i.test(l.subType ?? "") || /sales|income|revenue|fees|commission received|service charges/i.test(l.account)));
}

export function draftInvoice(j: SourceJournal, seller: InvoiceDoc["seller"], buyer: Partial<InvParty>): InvoiceDoc {
  const saved = (j.metadata?.gst_invoice ?? null) as SavedInvoice | null;
  let items: InvItem[];
  if (saved?.items?.length) {
    items = saved.items.map(i => ({ desc: i.desc || j.narration, hsn: i.hsn ?? "", qty: i.qty || 1, unit: i.uqc ?? "NOS", rate: r2(i.taxable / (i.qty || 1)), gstRate: Number(i.gst_rate) || 0, taxable: r2(i.taxable), igst: r2(i.igst), cgst: r2(i.cgst), sgst: r2(i.sgst) }));
  } else {
    const t = { igst: 0, cgst: 0, sgst: 0 };
    let taxable = 0;
    for (const l of j.lines) {
      const k = taxKind(l.account);
      if (k && k !== "cess") t[k] += l.cr - l.dr;
      else if (!k && !isPartySide(l.account) && l.cr > 0) taxable += l.cr - l.dr;
    }
    const gstRate = inferRate(taxable, t.igst + t.cgst + t.sgst) ?? 0;
    items = [{ desc: j.narration || "Services", hsn: "", qty: 1, unit: "NOS", rate: r2(taxable), gstRate, taxable: r2(taxable), igst: r2(t.igst), cgst: r2(t.cgst), sgst: r2(t.sgst) }];
  }
  const due = new Date(j.date + "T00:00:00Z"); due.setUTCDate(due.getUTCDate() + 15);
  return {
    invoiceNo: j.reference_no || j.entry_no.replace(/^JV-/, "INV-"),
    date: j.date, dueDate: due.toISOString().slice(0, 10),
    placeOfSupply: saved?.pos || buyer.state || seller.state || "",
    seller,
    buyer: { name: buyer.name ?? j.party_name ?? "", address: buyer.address ?? "", gstin: saved?.customer_gstin ?? buyer.gstin ?? "", state: buyer.state ?? saved?.customer_state ?? "", phone: buyer.phone ?? "", email: buyer.email ?? "" },
    items, notes: "Thank you for your business.", terms: "Payment due within 15 days.", bankDetails: "",
    title: seller.gstin ? "Tax Invoice" : "Invoice",
  };
}

/** Recalculate an item after its quantity, rate or GST % is edited. Intra-state splits CGST/SGST; inter-state uses IGST. */
export function recalcItem(i: InvItem, interState: boolean): InvItem {
  const taxable = r2(i.qty * i.rate);
  const tax = r2(taxable * i.gstRate / 100);
  return interState ? { ...i, taxable, igst: tax, cgst: 0, sgst: 0 } : { ...i, taxable, igst: 0, cgst: r2(tax / 2), sgst: r2(tax - r2(tax / 2)) };
}

export function invoiceTotals(items: InvItem[]) {
  const s = items.reduce((a, i) => ({ taxable: a.taxable + i.taxable, igst: a.igst + i.igst, cgst: a.cgst + i.cgst, sgst: a.sgst + i.sgst }), { taxable: 0, igst: 0, cgst: 0, sgst: 0 });
  const exact = r2(s.taxable + s.igst + s.cgst + s.sgst);
  const total = Math.round(exact);
  return { taxable: r2(s.taxable), igst: r2(s.igst), cgst: r2(s.cgst), sgst: r2(s.sgst), roundOff: r2(total - exact), total };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
const three = (n: number) => `${n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : ""}${n % 100 ? two(n % 100) : ""}`;

/** 1,18,000.50 → "Rupees One Lakh Eighteen Thousand and Fifty Paise Only" (Indian numbering). */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount)), paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000), lakh = Math.floor((rupees % 10000000) / 100000), thousand = Math.floor((rupees % 100000) / 1000), rest = rupees % 1000;
  if (crore) parts.push(`${crore >= 100 ? three(crore) : two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `Rupees ${parts.join(" ") || "Zero"}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
}
