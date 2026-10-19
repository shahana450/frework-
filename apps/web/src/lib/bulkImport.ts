// Bulk import of customers and items from an Excel / CSV template. Pure: reading the sheet and checking each row;
// the page saves what passes. Column headings are matched loosely ("GSTIN", "GST No", "gst number" all work).
import { GSTIN_RE } from "./gstr1";
import { stateFromGstin } from "./billing";

export type ImportKind = "customers" | "items";
export type CustomerRow = { name: string; type: "customer" | "vendor" | "both"; gstin: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; pan: string | null; credit_days: number | null };
export type ItemRow = { name: string; hsn: string | null; unit: string; rate: number; gst_rate: number; is_service: boolean };
export type RowIssue = { row: number; text: string };
export type Parsed<T> = { rows: T[]; errors: RowIssue[]; warnings: RowIssue[] };

/** Template columns: heading, example, help (shown on the Instructions sheet). */
export const TEMPLATES: Record<ImportKind, { title: string; cols: { h: string; ex: string | number; help: string; required?: boolean }[] }> = {
  customers: {
    title: "Customers",
    cols: [
      { h: "Name", ex: "ABC Traders", help: "Customer or supplier name (required)", required: true },
      { h: "Type", ex: "Customer", help: "Customer, Supplier or Both (blank = Customer)" },
      { h: "GSTIN", ex: "32AAACA1234A1Z5", help: "15-character GSTIN, if registered — the state is taken from it" },
      { h: "Phone", ex: "9876543210", help: "Mobile number (used for WhatsApp reminders)" },
      { h: "Email", ex: "accounts@abctraders.in", help: "Email address" },
      { h: "Address", ex: "5 Market Road, Thrissur 680001", help: "Billing address with pincode" },
      { h: "City", ex: "Thrissur", help: "City" },
      { h: "State", ex: "Kerala", help: "State — needed only when there is no GSTIN" },
      { h: "PAN", ex: "AAACA1234A", help: "PAN" },
      { h: "Credit days", ex: 30, help: "Days allowed to pay" },
    ],
  },
  items: {
    title: "Items",
    cols: [
      { h: "Item name", ex: "Cement 50kg", help: "Product or service name (required)", required: true },
      { h: "HSN/SAC", ex: "2523", help: "HSN for goods, SAC for services (4–8 digits)" },
      { h: "Unit", ex: "BAG", help: "NOS, PCS, KGS, BAG, BOX, LTR, MTR, HRS… (blank = NOS)" },
      { h: "Price", ex: 380, help: "Selling price before GST" },
      { h: "GST %", ex: 28, help: "0, 0.25, 3, 5, 12, 18 or 28 (blank = 18)" },
      { h: "Service?", ex: "No", help: "Yes for services (blank = No; SAC codes starting 99 are treated as services)" },
    ],
  },
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9%]/g, "");
const ALIASES: Record<string, string[]> = {
  name: ["name", "customername", "partyname", "suppliername", "customer", "party", "itemname", "item", "product", "productname", "description", "particulars"],
  type: ["type", "partytype", "category"],
  gstin: ["gstin", "gstno", "gstnumber", "gst", "gstinuin"],
  phone: ["phone", "mobile", "mobileno", "phoneno", "contact", "contactno", "whatsapp"],
  email: ["email", "emailid", "mail"],
  address: ["address", "billingaddress", "addr"],
  city: ["city", "town", "place"],
  state: ["state", "stateut", "placeofsupply"],
  pan: ["pan", "panno", "pannumber"],
  credit_days: ["creditdays", "creditperiod", "days"],
  hsn: ["hsnsac", "hsn", "sac", "hsncode", "saccode"],
  unit: ["unit", "uqc", "uom"],
  rate: ["price", "rate", "sellingprice", "salesprice", "mrp", "unitprice"],
  gst_rate: ["gst%", "gstrate", "gst", "taxrate", "tax%", "rate%"],
  is_service: ["service", "isservice", "service?", "goodsorservice"],
};
const RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[₹,\s%]/g, "")); return Number.isFinite(n) ? n : NaN; };
const text = (v: unknown) => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Finds the heading row (within the first 10) and maps each field to a column. */
function locate(grid: unknown[][], fields: string[]): { headRow: number; col: Record<string, number> } | null {
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const heads = (grid[r] ?? []).map(norm);
    const col: Record<string, number> = {};
    for (const f of fields) {
      const i = heads.findIndex(h => h && ALIASES[f].includes(h));
      if (i >= 0 && !Object.values(col).includes(i)) col[f] = i;
    }
    if (col.name !== undefined) return { headRow: r, col };
  }
  return null;
}

export function parseCustomers(grid: unknown[][]): Parsed<CustomerRow> {
  const out: Parsed<CustomerRow> = { rows: [], errors: [], warnings: [] };
  const at = locate(grid, ["name", "type", "gstin", "phone", "email", "address", "city", "state", "pan", "credit_days"]);
  if (!at) { out.errors.push({ row: 0, text: "Couldn't find a 'Name' column. Use the template's headings." }); return out; }
  const seen = new Set<string>();
  for (let r = at.headRow + 1; r < grid.length; r++) {
    const g = grid[r] ?? [], get = (f: string) => (at.col[f] === undefined ? "" : g[at.col[f]]);
    const name = text(get("name"));
    if (!name) { if (g.some(v => String(v ?? "").trim())) out.errors.push({ row: r + 1, text: "Name is empty" }); continue; }
    if (/^abc traders$/i.test(name) && r === at.headRow + 1 && String(get("gstin")).trim() === "32AAACA1234A1Z5") continue;   // the template's example row
    const key = name.toLowerCase();
    if (seen.has(key)) { out.warnings.push({ row: r + 1, text: `"${name}" appears twice — the first row is used` }); continue; }
    seen.add(key);
    const t = norm(get("type"));
    const type = /both/.test(t) ? "both" : /supplier|vendor|creditor/.test(t) ? "vendor" : "customer";
    let gstin = text(get("gstin"))?.toUpperCase().replace(/\s/g, "") ?? null;
    if (gstin && !GSTIN_RE.test(gstin)) { out.warnings.push({ row: r + 1, text: `GSTIN "${gstin}" for ${name} isn't valid — saved without it` }); gstin = null; }
    const phoneDigits = String(get("phone") ?? "").replace(/\D/g, "");
    const phone = phoneDigits ? (phoneDigits.length === 12 && phoneDigits.startsWith("91") ? phoneDigits.slice(2) : phoneDigits) : null;
    if (phone && phone.length !== 10) out.warnings.push({ row: r + 1, text: `Phone "${get("phone")}" for ${name} doesn't look like a 10-digit mobile` });
    const days = num(get("credit_days"));
    out.rows.push({
      name, type, gstin, phone,
      email: text(get("email")), address: text(get("address")), city: text(get("city")),
      state: stateFromGstin(gstin) || text(get("state")),
      pan: text(get("pan"))?.toUpperCase() ?? (gstin ? gstin.slice(2, 12) : null),
      credit_days: Number.isFinite(days) ? Math.max(0, Math.round(days)) : null,
    });
  }
  return out;
}

export function parseItems(grid: unknown[][]): Parsed<ItemRow> {
  const out: Parsed<ItemRow> = { rows: [], errors: [], warnings: [] };
  const at = locate(grid, ["name", "hsn", "unit", "rate", "gst_rate", "is_service"]);
  if (!at) { out.errors.push({ row: 0, text: "Couldn't find an 'Item name' column. Use the template's headings." }); return out; }
  const seen = new Set<string>();
  for (let r = at.headRow + 1; r < grid.length; r++) {
    const g = grid[r] ?? [], get = (f: string) => (at.col[f] === undefined ? "" : g[at.col[f]]);
    const name = text(get("name"));
    if (!name) { if (g.some(v => String(v ?? "").trim())) out.errors.push({ row: r + 1, text: "Item name is empty" }); continue; }
    if (/^cement 50kg$/i.test(name) && r === at.headRow + 1 && String(get("hsn")).trim() === "2523") continue;   // the template's example row
    const key = name.toLowerCase();
    if (seen.has(key)) { out.warnings.push({ row: r + 1, text: `"${name}" appears twice — the first row is used` }); continue; }
    seen.add(key);
    const hsn = text(get("hsn"))?.replace(/\D/g, "") || null;
    if (hsn && !/^\d{4,8}$/.test(hsn)) out.warnings.push({ row: r + 1, text: `HSN/SAC "${get("hsn")}" for ${name} should be 4–8 digits` });
    const rate = num(get("rate"));
    if (String(get("rate") ?? "").trim() && !Number.isFinite(rate)) out.warnings.push({ row: r + 1, text: `Price "${get("rate")}" for ${name} isn't a number — saved as 0` });
    let gst = num(get("gst_rate"));
    if (!Number.isFinite(gst)) gst = 18;
    else if (gst > 0 && gst < 1) gst = Math.round(gst * 10000) / 100;        // 0.18 typed as a fraction
    if (!RATES.includes(gst)) out.warnings.push({ row: r + 1, text: `GST ${gst}% for ${name} isn't a usual rate — check it` });
    const svc = norm(get("is_service"));
    out.rows.push({
      name, hsn, unit: (text(get("unit")) ?? "NOS").toUpperCase().slice(0, 8),
      rate: Number.isFinite(rate) ? Math.max(0, Math.round(rate * 100) / 100) : 0, gst_rate: gst,
      is_service: /^(y|yes|true|1|service)$/.test(svc) || (!svc && !!hsn && hsn.startsWith("99")),
    });
  }
  return out;
}
