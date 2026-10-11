// GSTR-2B vs purchase register: reads the portal's 2B (JSON or Excel grid), builds the purchase
// register from posted journals, matches them, and works out GSTR-3B Table 4 (ITC).
// Pure — no database, no browser APIs.

export type Tax = { igst: number; cgst: number; sgst: number; cess: number };
export type TwoBDoc = Tax & { gstin: string; supplier: string; docNo: string; date: string; taxable: number; value: number; note: boolean; rcm: boolean; itcAvailable: boolean };
export type BookDoc = Tax & { id: string; entryNo: string; supplier: string; docNo: string; date: string; taxable: number };
export type ItcRow = { status: "matched" | "mismatch" | "only2b" | "onlyBooks"; b2b?: TwoBDoc; book?: BookDoc; diff: number; note?: string };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[,₹\s]/g, "")); return isNaN(n) ? 0 : n; };
export const taxOf = (t: Tax) => r2(t.igst + t.cgst + t.sgst + t.cess);
/** Invoice numbers compared without spaces, slashes, dashes, leading zeros or "INV" prefixes. */
export const normDoc = (s: string) => String(s ?? "").toUpperCase().replace(/^(INV|INVOICE|BILL|NO)[\s.:#-]*/i, "").replace(/[^A-Z0-9]/g, "").replace(/^0+/, "");
const words = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 4 && !/^(traders?|enterprises?|limited|private|pvt|ltd|stores?|agency|agencies|services|company|india|industries)$/.test(w));
const toIso = (d: string) => {
  const s = String(d ?? "").trim();
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return s.slice(0, 10);
};

/** GSTR-2B JSON as downloaded from the portal (B2B invoices and B2B credit/debit notes). */
export function parse2BJson(json: unknown): TwoBDoc[] {
  const j = json as Record<string, unknown>;
  const data = ((j?.data as Record<string, unknown>)?.docdata ?? j?.docdata ?? j) as Record<string, unknown>;
  const out: TwoBDoc[] = [];
  for (const sup of (data?.b2b as Record<string, unknown>[]) ?? []) {
    for (const inv of (sup.inv as Record<string, unknown>[]) ?? []) {
      out.push({ gstin: String(sup.ctin ?? ""), supplier: String(sup.trdnm ?? ""), docNo: String(inv.inum ?? ""), date: toIso(String(inv.dt ?? "")),
        taxable: r2(num(inv.txval)), value: r2(num(inv.val)), igst: r2(num(inv.igst)), cgst: r2(num(inv.cgst)), sgst: r2(num(inv.sgst)), cess: r2(num(inv.cess)),
        note: false, rcm: String(inv.rev ?? "N").toUpperCase() === "Y", itcAvailable: String(inv.itcavl ?? "Y").toUpperCase() !== "N" });
    }
  }
  for (const sup of (data?.cdnr as Record<string, unknown>[]) ?? []) {
    for (const nt of (sup.nt as Record<string, unknown>[]) ?? []) {
      const sign = String(nt.typ ?? "C").toUpperCase() === "C" ? -1 : 1;     // credit note reduces ITC
      out.push({ gstin: String(sup.ctin ?? ""), supplier: String(sup.trdnm ?? ""), docNo: String(nt.ntnum ?? ""), date: toIso(String(nt.dt ?? "")),
        taxable: r2(sign * num(nt.txval)), value: r2(sign * num(nt.val)), igst: r2(sign * num(nt.igst)), cgst: r2(sign * num(nt.cgst)), sgst: r2(sign * num(nt.sgst)), cess: r2(sign * num(nt.cess)),
        note: true, rcm: String(nt.rev ?? "N").toUpperCase() === "Y", itcAvailable: String(nt.itcavl ?? "Y").toUpperCase() !== "N" });
    }
  }
  return out;
}

/** The "B2B" sheet of the GSTR-2B Excel. Its headers span two rows, so both are read together. */
export function parse2BGrid(grid: unknown[][]): TwoBDoc[] {
  let h = -1;
  for (let r = 0; r < Math.min(grid.length, 15); r++) if ((grid[r] ?? []).some(c => /invoice\s*number|note\s*number/i.test(String(c)))) { h = r; break; }
  if (h < 0) return [];
  const sub = /integrated|central/i.test((grid[h + 1] ?? []).join(" "));   // tax names on the row below
  const rowsForHead = [grid[h - 1], grid[h], sub ? grid[h + 1] : undefined];
  const width = Math.max(...rowsForHead.map(r => (r ?? []).length));
  const head = Array.from({ length: width }, (_, i) => rowsForHead.map(r => String(r?.[i] ?? "")).join(" ").toLowerCase());
  const col = (re: RegExp) => head.findIndex(x => re.test(x));
  const c = { gstin: col(/gstin/), name: col(/trade|legal name/), no: col(/invoice\s*number|note\s*number/), date: col(/(invoice|note)\s*date/), val: col(/(invoice|note)\s*value/),
    txval: col(/taxable/), igst: col(/integrated/), cgst: col(/central/), sgst: col(/state/), cess: col(/cess/), rev: col(/reverse/), itc: col(/itc\s*availab/), type: col(/note\s*type/) };
  if (c.no < 0 || c.txval < 0) return [];
  const start = sub ? h + 2 : h + 1;
  const out: TwoBDoc[] = [];
  for (const r of grid.slice(start)) {
    const docNo = String(r?.[c.no] ?? "").trim();
    if (!docNo) continue;
    const isCredit = c.type >= 0 && /credit/i.test(String(r[c.type]));
    const sign = isCredit ? -1 : 1;
    out.push({ gstin: String(r[c.gstin] ?? ""), supplier: String(r[c.name] ?? ""), docNo, date: toIso(String(r[c.date] ?? "")),
      taxable: r2(sign * num(r[c.txval])), value: r2(sign * num(r[c.val])), igst: r2(sign * num(r[c.igst])), cgst: r2(sign * num(r[c.cgst])), sgst: r2(sign * num(r[c.sgst])), cess: c.cess >= 0 ? r2(sign * num(r[c.cess])) : 0,
      note: c.type >= 0, rcm: c.rev >= 0 && /^y/i.test(String(r[c.rev])), itcAvailable: c.itc < 0 || !/^n/i.test(String(r[c.itc])) });
  }
  return out;
}

const INPUT_TAX = (n: string) => /input|itc|receivable/i.test(n) ? (/igst|integrated/i.test(n) ? "igst" : /cgst|central/i.test(n) ? "cgst" : /sgst|utgst|state/i.test(n) ? "sgst" : /cess/i.test(n) ? "cess" : null) : null;
const CASH_BANK = /\b(cash|bank|hdfc|icici|sbi|axis|kotak|federal|canara|pnb|idfc|indusind|petty)\b/i;

/** Purchase register from posted journals: any entry with input-tax lines. */
export function purchaseRegister(journals: { id: string; entry_no: string; date: string; narration?: string | null; reference_no?: string | null; lines: { name: string; dr: number; cr: number }[] }[]): BookDoc[] {
  const out: BookDoc[] = [];
  for (const j of journals) {
    const t: Tax = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
    let any = false;
    for (const l of j.lines) { const k = INPUT_TAX(l.name); if (k) { t[k as keyof Tax] += (l.dr || 0) - (l.cr || 0); any = true; } }
    if (!any) continue;
    const taxable = r2(j.lines.filter(l => !INPUT_TAX(l.name) && l.dr > 0 && !CASH_BANK.test(l.name)).reduce((s, l) => s + l.dr, 0));
    const party = j.lines.find(l => l.cr > 0 && !CASH_BANK.test(l.name) && !INPUT_TAX(l.name));
    out.push({ id: j.id, entryNo: j.entry_no, date: j.date.slice(0, 10), supplier: party?.name ?? (j.narration ?? ""), docNo: String(j.reference_no ?? ""), taxable,
      igst: r2(t.igst), cgst: r2(t.cgst), sgst: r2(t.sgst), cess: r2(t.cess) });
  }
  return out;
}

/** Pairs 2B documents with book entries: same invoice number first, then same supplier with the same tax. */
export function matchItc(twoB: TwoBDoc[], books: BookDoc[], tolerance = 1): ItcRow[] {
  const rows: ItcRow[] = [];
  const left = new Set(books.map(b => b.id));
  const sameSupplier = (a: TwoBDoc, b: BookDoc) => { const w = words(a.supplier); return w.length > 0 && w.some(x => b.supplier.toLowerCase().includes(x)); };
  for (const d of twoB) {
    const pool = books.filter(b => left.has(b.id));
    let hit = pool.find(b => b.docNo && normDoc(b.docNo) === normDoc(d.docNo) && (sameSupplier(d, b) || !b.supplier));
    hit = hit ?? pool.find(b => b.docNo && normDoc(b.docNo) === normDoc(d.docNo));
    hit = hit ?? pool.find(b => sameSupplier(d, b) && Math.abs(taxOf(b) - taxOf(d)) <= tolerance && b.date.slice(0, 7) === d.date.slice(0, 7));
    if (!hit) { rows.push({ status: "only2b", b2b: d, diff: taxOf(d), note: "In GSTR-2B, not in your books — book the purchase to claim this ITC" }); continue; }
    left.delete(hit.id);
    const diff = r2(taxOf(d) - taxOf(hit));
    rows.push(Math.abs(diff) <= tolerance
      ? { status: "matched", b2b: d, book: hit, diff: 0 }
      : { status: "mismatch", b2b: d, book: hit, diff, note: `Tax differs by ₹${Math.abs(diff).toLocaleString("en-IN")} (${diff > 0 ? "2B higher" : "books higher"})` });
  }
  for (const b of books) if (left.has(b.id)) rows.push({ status: "onlyBooks", book: b, diff: -taxOf(b), note: "In your books, not in GSTR-2B — supplier hasn't filed; ITC not claimable yet (Rule 36(4))" });
  return rows;
}

export type Table4 = { a5: Tax; a3: Tax; b1: Tax; b2: Tax; c: Tax; booksItc: Tax };
const add = (a: Tax, b: Tax, k = 1): Tax => ({ igst: r2(a.igst + k * b.igst), cgst: r2(a.cgst + k * b.cgst), sgst: r2(a.sgst + k * b.sgst), cess: r2(a.cess + k * b.cess) });
const ZERO: Tax = { igst: 0, cgst: 0, sgst: 0, cess: 0 };

/**
 * GSTR-3B Table 4 from GSTR-2B: 4(A)(5) all other ITC = available B2B ITC net of credit notes;
 * 4(A)(3) = reverse-charge inward supplies (paid in cash, then claimed); 4(B)(1) = reversals the user enters
 * (e.g. Section 17(5) blocked credit, Rules 38/42/43); 4(B)(2) = others; 4(C) = net ITC available.
 */
export function table4(twoB: TwoBDoc[], books: BookDoc[], blocked: Tax = ZERO, otherReversal: Tax = ZERO): Table4 {
  let a5 = ZERO, a3 = ZERO;
  for (const d of twoB) {
    if (!d.itcAvailable) continue;
    if (d.rcm) a3 = add(a3, d); else a5 = add(a5, d);
  }
  const c = add(add(add(a5, a3), blocked, -1), otherReversal, -1);
  const booksItc = books.reduce((s, b) => add(s, b), ZERO);
  return { a5, a3, b1: blocked, b2: otherReversal, c, booksItc };
}
