// Government upload files from an invoice — no provider needed. Pure: no database access.
//  • e-Invoice: NIC IRP schema 1.1 JSON (one document) → upload on einvoice1.gst.gov.in ("Bulk upload" / offline tool)
//  • e-Way bill: NIC e-way bill bulk-generation JSON → upload on ewaybillgst.gov.in (Generate → Bulk)
import { stateCode, GSTIN_RE } from "./gstr1";
import type { InvoiceDoc } from "./invoiceDoc";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const num = (s: string) => Number(String(s).replace(/\D/g, "")) || 0;
const isService = (hsn: string) => /^99/.test(hsn.trim());
const UNIT: Record<string, string> = { NOS: "NOS", PCS: "PCS", KGS: "KGS", KG: "KGS", LTR: "LTR", MTR: "MTR", BOX: "BOX", BAG: "BAG", BAGS: "BAG", SET: "SET", OTH: "OTH" };

/** Pincode and town from a free-text address ("12 MG Road, Kochi 682011"). */
export function splitAddress(address: string): { line1: string; place: string; pin: number } {
  const text = address.replace(/\s+/g, " ").trim();
  const pinM = text.match(/\b([1-9]\d{5})\b(?!.*\b[1-9]\d{5}\b)/);
  const pin = pinM ? Number(pinM[1]) : 0;
  const parts = text.replace(pinM?.[0] ?? "", "").split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const place = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? "";
  return { line1: (parts.slice(0, Math.max(1, parts.length - 1)).join(", ") || text).slice(0, 100), place: place.slice(0, 50), pin };
}

export type EIssue = { level: "error" | "warn"; text: string };

function common(doc: InvoiceDoc) {
  const s = splitAddress(doc.seller.address), b = splitAddress(doc.buyer.address);
  const sSt = doc.seller.gstin.slice(0, 2) || stateCode(doc.seller.state) || "";
  const bSt = doc.buyer.gstin.slice(0, 2) || stateCode(doc.buyer.state) || "";
  const pos = stateCode(doc.placeOfSupply) || bSt;
  const tot = doc.items.reduce((t, i) => ({ taxable: t.taxable + i.taxable, cgst: t.cgst + i.cgst, sgst: t.sgst + i.sgst, igst: t.igst + i.igst }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
  const total = r2(tot.taxable + tot.cgst + tot.sgst + tot.igst);
  return { s, b, sSt, bSt, pos, tot: { taxable: r2(tot.taxable), cgst: r2(tot.cgst), sgst: r2(tot.sgst), igst: r2(tot.igst) }, total };
}

/** e-Invoice (IRN) JSON, schema 1.1. Only for B2B: the buyer must have a GSTIN. */
export function buildEInvoice(doc: InvoiceDoc): { json: unknown; issues: EIssue[] } {
  const c = common(doc), issues: EIssue[] = [];
  if (!GSTIN_RE.test(doc.seller.gstin)) issues.push({ level: "error", text: "Your GSTIN is missing or invalid — add it in Business Details." });
  if (!GSTIN_RE.test(doc.buyer.gstin)) issues.push({ level: "error", text: "e-Invoice is only for registered buyers — add the customer's GSTIN." });
  if (!c.s.pin) issues.push({ level: "error", text: "Add your 6-digit pincode to your address (Business Details)." });
  if (!c.b.pin) issues.push({ level: "error", text: "Add the customer's 6-digit pincode to their address." });
  doc.items.forEach((i, k) => { if (!/^\d{4,8}$/.test(i.hsn.trim())) issues.push({ level: "error", text: `Item ${k + 1}: add a 4–8 digit HSN/SAC code.` }); });
  const json = {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: "N", IgstOnIntra: "N" },
    DocDtls: { Typ: "INV", No: doc.invoiceNo.slice(0, 16), Dt: dmy(doc.date) },
    SellerDtls: { Gstin: doc.seller.gstin, LglNm: doc.seller.name, Addr1: c.s.line1 || doc.seller.name, Loc: c.s.place || doc.seller.state, Pin: c.s.pin, Stcd: c.sSt, ...(doc.seller.phone ? { Ph: doc.seller.phone.replace(/\D/g, "").slice(-12) } : {}), ...(doc.seller.email ? { Em: doc.seller.email } : {}) },
    BuyerDtls: { Gstin: doc.buyer.gstin, LglNm: doc.buyer.name, Pos: c.pos, Addr1: c.b.line1 || doc.buyer.name, Loc: c.b.place || doc.buyer.state, Pin: c.b.pin, Stcd: c.bSt },
    ItemList: doc.items.map((i, k) => {
      const tot = r2(i.qty * i.rate);
      return { SlNo: String(k + 1), PrdDesc: i.desc.slice(0, 300), IsServc: isService(i.hsn) ? "Y" : "N", HsnCd: i.hsn.trim(), Qty: i.qty, Unit: UNIT[(i.unit || "NOS").toUpperCase()] ?? "OTH", UnitPrice: r2(i.rate), TotAmt: tot, AssAmt: r2(i.taxable), GstRt: i.gstRate, IgstAmt: r2(i.igst), CgstAmt: r2(i.cgst), SgstAmt: r2(i.sgst), TotItemVal: r2(i.taxable + i.igst + i.cgst + i.sgst) };
    }),
    ValDtls: { AssVal: c.tot.taxable, CgstVal: c.tot.cgst, SgstVal: c.tot.sgst, IgstVal: c.tot.igst, TotInvVal: c.total },
  };
  return { json, issues };
}

export type Transport = { vehicleNo: string; distanceKm: number; transporterName?: string; transporterId?: string; mode?: 1 | 2 | 3 | 4 };

/** e-Way bill bulk-upload JSON (outward supply by the seller). */
export function buildEwayBill(doc: InvoiceDoc, t: Transport): { json: unknown; issues: EIssue[] } {
  const c = common(doc), issues: EIssue[] = [];
  const vehicle = t.vehicleNo.replace(/[\s-]/g, "").toUpperCase();
  if (!GSTIN_RE.test(doc.seller.gstin)) issues.push({ level: "error", text: "Your GSTIN is missing or invalid — add it in Business Details." });
  if (!c.s.pin) issues.push({ level: "error", text: "Add your 6-digit pincode to your address (Business Details)." });
  if (!c.b.pin) issues.push({ level: "error", text: "Add the customer's 6-digit pincode to their address." });
  if (!vehicle && !t.transporterId) issues.push({ level: "error", text: "Enter the vehicle number (or the transporter's ID for Part A only)." });
  if (!(t.distanceKm > 0)) issues.push({ level: "warn", text: "Distance is 0 — the portal will calculate it from the pincodes (only if both pincodes are right)." });
  if (c.total < 50000) issues.push({ level: "warn", text: "This invoice is under ₹50,000 — an e-way bill is usually not required (check your state's rule)." });
  doc.items.forEach((i, k) => { if (!/^\d{4,8}$/.test(i.hsn.trim())) issues.push({ level: "error", text: `Item ${k + 1}: add a 4–8 digit HSN code.` }); });
  const inter = !!c.sSt && !!c.pos && c.sSt !== c.pos;
  const bill = {
    userGstin: doc.seller.gstin, supplyType: "O", subSupplyType: 1, docType: doc.seller.gstin ? "INV" : "BIL", docNo: doc.invoiceNo.slice(0, 16), docDate: dmy(doc.date),
    transType: 1,
    fromGstin: doc.seller.gstin, fromTrdName: doc.seller.name, fromAddr1: c.s.line1, fromAddr2: "", fromPlace: c.s.place, fromPincode: c.s.pin, fromStateCode: num(c.sSt), actualFromStateCode: num(c.sSt),
    toGstin: GSTIN_RE.test(doc.buyer.gstin) ? doc.buyer.gstin : "URP", toTrdName: doc.buyer.name, toAddr1: c.b.line1, toAddr2: "", toPlace: c.b.place, toPincode: c.b.pin, toStateCode: num(c.pos || c.bSt), actualToStateCode: num(c.bSt || c.pos),
    totalValue: c.tot.taxable, cgstValue: c.tot.cgst, sgstValue: c.tot.sgst, igstValue: c.tot.igst, cessValue: 0, cessNonAdvolValue: 0, otherValue: 0, totInvValue: c.total,
    transMode: t.mode ?? 1, transDistance: String(Math.max(0, Math.round(t.distanceKm || 0))), transporterName: t.transporterName ?? "", transporterId: t.transporterId ?? "",
    transDocNo: "", transDocDate: "", vehicleNo: vehicle, vehicleType: "R",
    itemList: doc.items.map((i, k) => ({
      itemNo: k + 1, productName: i.desc.slice(0, 100), productDesc: i.desc.slice(0, 100), hsnCode: num(i.hsn), quantity: i.qty, qtyUnit: UNIT[(i.unit || "NOS").toUpperCase()] ?? "OTH",
      taxableAmount: r2(i.taxable), sgstRate: inter ? 0 : i.gstRate / 2, cgstRate: inter ? 0 : i.gstRate / 2, igstRate: inter ? i.gstRate : 0, cessRate: 0, cessNonAdvol: 0,
    })),
  };
  return { json: { version: "1.0.0621", billLists: [bill] }, issues };
}
