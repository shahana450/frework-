// GSTR-1 builder: turns posted sales and credit/debit notes into the GST portal's JSON (offline-tool format),
// plus a list of problems to fix before uploading. Pure — no database access.

export const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01", "himachal pradesh": "02", "punjab": "03", "chandigarh": "04", "uttarakhand": "05", "haryana": "06", "delhi": "07",
  "rajasthan": "08", "uttar pradesh": "09", "bihar": "10", "sikkim": "11", "arunachal pradesh": "12", "nagaland": "13", "manipur": "14",
  "mizoram": "15", "tripura": "16", "meghalaya": "17", "assam": "18", "west bengal": "19", "jharkhand": "20", "odisha": "21", "chhattisgarh": "22",
  "madhya pradesh": "23", "gujarat": "24", "dadra and nagar haveli and daman and diu": "26", "maharashtra": "27", "karnataka": "29", "goa": "30",
  "lakshadweep": "31", "kerala": "32", "tamil nadu": "33", "puducherry": "34", "andaman and nicobar islands": "35", "telangana": "36",
  "andhra pradesh": "37", "ladakh": "38", "other territory": "97",
};
export const stateCode = (s?: string | null): string | null => {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{2}$/.test(t)) return t;
  return STATE_CODES[t.toLowerCase()] ?? null;
};
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Item = { hsn?: string | null; desc?: string | null; uqc?: string | null; qty?: number | null; rate: number; taxable: number; igst: number; cgst: number; sgst: number; cess?: number };
export type Doc = {
  kind: "invoice" | "credit_note" | "debit_note";
  no: string; date: string;                 // YYYY-MM-DD
  party: string | null; gstin: string | null; partyState: string | null; pos?: string | null;
  value: number;                            // total incl. tax
  items: Item[];
  derived: boolean;                         // items worked out from ledger amounts (no item detail saved)
  origNo?: string | null; origDate?: string | null;
};
export type Issue = { level: "error" | "warn"; doc?: string; text: string };
export type Gstr1 = {
  json: Record<string, unknown>;
  issues: Issue[];
  totals: { section: string; count: number; taxable: number; igst: number; cgst: number; sgst: number }[];
};

/** Nearest standard GST rate for a tax/taxable pair; null when it doesn't fit one rate. */
export function inferRate(taxable: number, tax: number): number | null {
  if (taxable <= 0) return null;
  const pct = (tax / taxable) * 100;
  const best = RATES.reduce((a, b) => Math.abs(b - pct) < Math.abs(a - pct) ? b : a);
  return Math.abs(best - pct) <= 0.3 ? best : null;
}

const ddmmyyyy = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

function itm(i: Item, n: number, inter: boolean) {
  const det: Record<string, number> = { txval: r2(i.taxable), rt: i.rate };
  if (inter) det.iamt = r2(i.igst); else { det.camt = r2(i.cgst); det.samt = r2(i.sgst); }
  det.csamt = r2(i.cess ?? 0);
  return { num: n, itm_det: det };
}

/** Merge items by rate (the portal wants one line per rate per invoice). */
function byRate(items: Item[]): Item[] {
  const m = new Map<number, Item>();
  for (const i of items) {
    const x = m.get(i.rate) ?? { rate: i.rate, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
    x.taxable += i.taxable; x.igst += i.igst; x.cgst += i.cgst; x.sgst += i.sgst; x.cess = (x.cess ?? 0) + (i.cess ?? 0);
    m.set(i.rate, x);
  }
  return [...m.values()];
}

export function buildGstr1(gstin: string, homeState: string | null, period: string /* YYYY-MM */, docs: Doc[]): Gstr1 {
  const issues: Issue[] = [];
  const home = stateCode(homeState) ?? (GSTIN_RE.test(gstin) ? gstin.slice(0, 2) : null);
  if (!GSTIN_RE.test(gstin)) issues.push({ level: "error", text: "Your business GSTIN is missing or invalid — add it in Settings → Business Details." });
  if (!home) issues.push({ level: "error", text: "Your business state is missing — add it in Settings → Business Details." });

  const b2b = new Map<string, unknown[]>();
  const b2cl = new Map<string, unknown[]>();
  const b2cs = new Map<string, { sply_ty: string; rt: number; typ: string; pos: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }>();
  const cdnr = new Map<string, unknown[]>();
  const cdnur: unknown[] = [];
  const hsnB2b = new Map<string, { hsn_sc: string; desc: string; uqc: string; qty: number; rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number }>();
  const hsnB2c = new Map<string, typeof hsnB2b extends Map<string, infer V> ? V : never>();
  const tot = new Map<string, { section: string; count: number; taxable: number; igst: number; cgst: number; sgst: number }>();
  const add = (section: string, items: Item[], sign = 1) => {
    const t = tot.get(section) ?? { section, count: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    t.count++; for (const i of items) { t.taxable = r2(t.taxable + sign * i.taxable); t.igst = r2(t.igst + sign * i.igst); t.cgst = r2(t.cgst + sign * i.cgst); t.sgst = r2(t.sgst + sign * i.sgst); }
    tot.set(section, t);
  };

  for (const d of docs) {
    if (d.date.slice(0, 7) !== period) continue;
    const label = `${d.kind === "invoice" ? "Invoice" : d.kind === "credit_note" ? "Credit note" : "Debit note"} ${d.no}`;
    const g = d.gstin?.toUpperCase().replace(/\s/g, "") || null;
    const registered = !!g && GSTIN_RE.test(g);
    if (g && !registered) issues.push({ level: "error", doc: d.no, text: `${label}: customer GSTIN "${g}" is invalid — fix it in Customers & Suppliers.` });
    const inter = d.items.some(i => i.igst > 0.004);
    let pos = stateCode(d.pos) ?? (registered ? g!.slice(0, 2) : stateCode(d.partyState)) ?? (inter ? null : home);
    if (!pos) { issues.push({ level: "error", doc: d.no, text: `${label}: place of supply unknown (IGST charged but the customer's state isn't saved).` }); pos = "97"; }
    if (home && pos && inter === (pos === home)) issues.push({ level: "warn", doc: d.no, text: `${label}: ${inter ? "IGST charged although the place of supply is your own state" : "CGST/SGST charged although the place of supply is another state"}.` });
    for (const i of d.items) if (!RATES.includes(i.rate)) issues.push({ level: "error", doc: d.no, text: `${label}: tax doesn't match a single GST rate — open the invoice and split it by rate.` });
    if (d.derived) issues.push({ level: "warn", doc: d.no, text: `${label}: no item detail saved, so HSN and quantity are missing — worked out from the ledger amounts.` });
    else for (const i of d.items) if (!i.hsn || !/^\d{4,8}$/.test(i.hsn)) issues.push({ level: "warn", doc: d.no, text: `${label}: an item has no valid HSN/SAC code (4–8 digits).` });

    const items = byRate(d.items.filter(i => RATES.includes(i.rate)));
    const sign = d.kind === "credit_note" ? -1 : 1;

    if (d.kind === "invoice") {
      if (registered) {
        const list = b2b.get(g!) ?? [];
        list.push({ inum: d.no.slice(0, 16), idt: ddmmyyyy(d.date), val: r2(d.value), pos, rchrg: "N", inv_typ: "R", itms: items.map((i, k) => itm(i, k + 1, inter)) });
        b2b.set(g!, list); add("B2B invoices (4A)", items);
      } else if (inter && d.value > 100000) {
        const list = b2cl.get(pos!) ?? [];
        list.push({ inum: d.no.slice(0, 16), idt: ddmmyyyy(d.date), val: r2(d.value), itms: items.map((i, k) => itm(i, k + 1, true)) });
        b2cl.set(pos!, list); add("B2C large (5)", items);
      } else {
        for (const i of items) {
          const k = `${inter ? "INTER" : "INTRA"}|${pos}|${i.rate}`;
          const x = b2cs.get(k) ?? { sply_ty: inter ? "INTER" : "INTRA", rt: i.rate, typ: "OE", pos: pos!, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
          x.txval = r2(x.txval + i.taxable); x.iamt = r2(x.iamt + i.igst); x.camt = r2(x.camt + i.cgst); x.samt = r2(x.samt + i.sgst); x.csamt = r2(x.csamt + (i.cess ?? 0));
          b2cs.set(k, x);
        }
        add("B2C small (7)", items);
      }
    } else {
      const note = { ntty: d.kind === "credit_note" ? "C" : "D", nt_num: d.no.slice(0, 16), nt_dt: ddmmyyyy(d.date), val: r2(d.value), pos, rchrg: "N", inv_typ: "R", itms: items.map((i, k) => itm(i, k + 1, inter)) };
      if (registered) { const list = cdnr.get(g!) ?? []; list.push(note); cdnr.set(g!, list); add("Credit/debit notes — registered (9B)", items, sign); }
      else if (inter && d.value > 100000) { cdnur.push({ ...note, typ: "B2CL" }); add("Credit/debit notes — unregistered (9B)", items, sign); }
      else {
        // Small B2C notes adjust the B2CS figures for that rate and place of supply
        for (const i of items) {
          const k = `${inter ? "INTER" : "INTRA"}|${pos}|${i.rate}`;
          const x = b2cs.get(k) ?? { sply_ty: inter ? "INTER" : "INTRA", rt: i.rate, typ: "OE", pos: pos!, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
          x.txval = r2(x.txval + sign * i.taxable); x.iamt = r2(x.iamt + sign * i.igst); x.camt = r2(x.camt + sign * i.cgst); x.samt = r2(x.samt + sign * i.sgst);
          b2cs.set(k, x);
        }
        add("B2C small (7)", items, sign);
      }
    }

    // HSN summary (Table 12), split into B2B and B2C
    const target = registered ? hsnB2b : hsnB2c;
    for (const i of d.items.filter(x => RATES.includes(x.rate))) {
      const code = (i.hsn && /^\d{4,8}$/.test(i.hsn)) ? i.hsn : "";
      const k = `${code}|${i.rate}|${i.uqc ?? "NOS"}`;
      const x = target.get(k) ?? { hsn_sc: code, desc: (i.desc ?? "").slice(0, 30), uqc: i.uqc ?? "NOS", qty: 0, rt: i.rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
      x.qty = r2(x.qty + sign * (i.qty ?? 0)); x.txval = r2(x.txval + sign * i.taxable); x.iamt = r2(x.iamt + sign * i.igst); x.camt = r2(x.camt + sign * i.cgst); x.samt = r2(x.samt + sign * i.sgst); x.csamt = r2(x.csamt + sign * (i.cess ?? 0));
      target.set(k, x);
    }
  }

  const json: Record<string, unknown> = { gstin, fp: `${period.slice(5, 7)}${period.slice(0, 4)}` };
  if (b2b.size) json.b2b = [...b2b].map(([ctin, inv]) => ({ ctin, inv }));
  if (b2cl.size) json.b2cl = [...b2cl].map(([pos, inv]) => ({ pos, inv }));
  if (b2cs.size) json.b2cs = [...b2cs.values()].filter(x => x.txval !== 0).map(x => x.sply_ty === "INTER" ? { sply_ty: x.sply_ty, rt: x.rt, typ: x.typ, pos: x.pos, txval: x.txval, iamt: x.iamt, csamt: x.csamt } : { sply_ty: x.sply_ty, rt: x.rt, typ: x.typ, pos: x.pos, txval: x.txval, camt: x.camt, samt: x.samt, csamt: x.csamt });
  if (cdnr.size) json.cdnr = [...cdnr].map(([ctin, nt]) => ({ ctin, nt }));
  if (cdnur.length) json.cdnur = cdnur;
  const hsnList = (m: typeof hsnB2b) => [...m.values()].map((x, k) => ({ num: k + 1, ...x }));
  if (hsnB2b.size || hsnB2c.size) json.hsn = { ...(hsnB2b.size ? { hsn_b2b: hsnList(hsnB2b) } : {}), ...(hsnB2c.size ? { hsn_b2c: hsnList(hsnB2c) } : {}) };
  if ([...hsnB2b.values(), ...hsnB2c.values()].some(x => !x.hsn_sc)) issues.push({ level: "warn", text: "Some HSN summary lines have no HSN code. The portal requires 4 digits (turnover up to ₹5 crore) or 6 digits (above) — add HSN to those invoices before filing." });

  return { json, issues, totals: [...tot.values()] };
}
