// Filed GSTR-1 / GSTR-3B (as downloaded from the GST portal, GSTN JSON) against what FreBook's books say. Pure — no I/O.
type Itm = { itm_det?: { txval?: number; iamt?: number; camt?: number; samt?: number; csamt?: number } };
type Inv = { inum?: string; idt?: string; val?: number; itms?: Itm[] };
type Note = { nt_num?: string; nt_dt?: string; ntty?: string; val?: number; itms?: Itm[] };
type Flat = { txval?: number; iamt?: number; camt?: number; samt?: number; csamt?: number };
export type Gstr1Json = { b2b?: { ctin?: string; inv?: Inv[] }[]; b2cl?: { pos?: string; inv?: Inv[] }[]; b2cs?: Flat[]; cdnr?: { ctin?: string; nt?: Note[] }[]; exp?: { exp_typ?: string; inv?: Inv[] }[] };
export type Amt = { taxable: number; igst: number; cgst: number; sgst: number; cess: number };
export type InvRow = { key: string; ctin: string; no: string; date: string; books: Amt | null; portal: Amt | null; status: "match" | "diff" | "onlyBooks" | "onlyPortal" };
export type SectionRow = { section: string; books: Amt; portal: Amt; diff: number };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const Z = (): Amt => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
const add = (a: Amt, b: Amt, k = 1): Amt => ({ taxable: r2(a.taxable + k * b.taxable), igst: r2(a.igst + k * b.igst), cgst: r2(a.cgst + k * b.cgst), sgst: r2(a.sgst + k * b.sgst), cess: r2(a.cess + k * b.cess) });
const ofItms = (itms?: Itm[]): Amt => (itms ?? []).reduce((s, i) => add(s, { taxable: +(i.itm_det?.txval ?? 0), igst: +(i.itm_det?.iamt ?? 0), cgst: +(i.itm_det?.camt ?? 0), sgst: +(i.itm_det?.samt ?? 0), cess: +(i.itm_det?.csamt ?? 0) }), Z());
const ofFlat = (f: Flat): Amt => ({ taxable: r2(+(f.txval ?? 0)), igst: r2(+(f.iamt ?? 0)), cgst: r2(+(f.camt ?? 0)), sgst: r2(+(f.samt ?? 0)), cess: r2(+(f.csamt ?? 0)) });
export const taxOf = (a: Amt) => r2(a.igst + a.cgst + a.sgst + a.cess);
const invKey = (ctin: string, no: string) => `${ctin.toUpperCase()}|${no.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+/, "")}`;

/** Section totals and B2B invoice list of a GSTR-1 JSON. Credit notes count negative. */
export function summarise1(j: Gstr1Json) {
  const sec = new Map<string, Amt>();
  const put = (k: string, a: Amt, sign = 1) => sec.set(k, add(sec.get(k) ?? Z(), a, sign));
  const invs = new Map<string, { ctin: string; no: string; date: string; amt: Amt }>();
  for (const p of j.b2b ?? []) for (const i of p.inv ?? []) {
    const a = ofItms(i.itms); put("B2B invoices (4A)", a);
    invs.set(invKey(p.ctin ?? "", i.inum ?? ""), { ctin: (p.ctin ?? "").toUpperCase(), no: i.inum ?? "", date: i.idt ?? "", amt: a });
  }
  for (const p of j.b2cl ?? []) for (const i of p.inv ?? []) put("B2C large (5)", ofItms(i.itms));
  for (const f of j.b2cs ?? []) put("B2C small (7)", ofFlat(f));
  for (const p of j.exp ?? []) for (const i of p.inv ?? []) put("Exports (6A)", ofItms(i.itms));
  for (const p of j.cdnr ?? []) for (const n of p.nt ?? []) put("Credit/debit notes — registered (9B)", ofItms(n.itms), n.ntty === "D" ? 1 : -1);
  return { sections: sec, invoices: invs };
}

export function compareGstr1(books: Gstr1Json, portal: Gstr1Json): { sections: SectionRow[]; invoices: InvRow[]; total: { books: Amt; portal: Amt } } {
  const b = summarise1(books), p = summarise1(portal);
  const names = [...new Set([...b.sections.keys(), ...p.sections.keys()])];
  const sections = names.map(s => { const bb = b.sections.get(s) ?? Z(), pp = p.sections.get(s) ?? Z(); return { section: s, books: bb, portal: pp, diff: r2(pp.taxable - bb.taxable + taxOf(pp) - taxOf(bb)) }; });
  const keys = [...new Set([...b.invoices.keys(), ...p.invoices.keys()])];
  const close = (x: Amt, y: Amt) => Math.abs(x.taxable - y.taxable) <= 1 && Math.abs(taxOf(x) - taxOf(y)) <= 1;
  const invoices: InvRow[] = keys.map(k => {
    const bi = b.invoices.get(k), pi = p.invoices.get(k), any = (pi ?? bi)!;
    const status: InvRow["status"] = !bi ? "onlyPortal" : !pi ? "onlyBooks" : close(bi.amt, pi.amt) ? "match" : "diff";
    return { key: k, ctin: any.ctin, no: any.no, date: any.date, books: bi?.amt ?? null, portal: pi?.amt ?? null, status };
  }).sort((x, y) => ["diff", "onlyBooks", "onlyPortal", "match"].indexOf(x.status) - ["diff", "onlyBooks", "onlyPortal", "match"].indexOf(y.status));
  const tot = (m: Map<string, Amt>) => [...m.values()].reduce((s, a) => add(s, a), Z());
  return { sections, invoices, total: { books: tot(b.sections), portal: tot(p.sections) } };
}

// ── GSTR-3B ──
type ThreeB = { sup_details?: Record<string, Flat | undefined>; itc_elg?: { itc_net?: Flat; itc_avl?: { ty?: string; iamt?: number; camt?: number; samt?: number; csamt?: number }[]; itc_rev?: { ty?: string; iamt?: number; camt?: number; samt?: number; csamt?: number }[] } };
export type ThreeBRow = { label: string; books: Amt; portal: Amt; diff: number };
/** Portal 3B → the rows FreBook can compare: 3.1(a)–(e) and net ITC (4C). Accepts the payload or { data: payload }. */
export function parse3B(body: unknown): Record<"a" | "b" | "c" | "d" | "e" | "itc", Amt> {
  const x = ((body as { data?: unknown })?.data && !(body as ThreeB).sup_details ? (body as { data: unknown }).data : body) as ThreeB;
  const s = x?.sup_details ?? {};
  const f = (k: string) => ofFlat(s[k] ?? {});
  let itc = ofFlat(x?.itc_elg?.itc_net ?? {});
  if (!x?.itc_elg?.itc_net && x?.itc_elg?.itc_avl) {
    itc = x.itc_elg.itc_avl.reduce((t, r) => add(t, ofFlat(r)), Z());
    for (const r of x.itc_elg.itc_rev ?? []) itc = add(itc, ofFlat(r), -1);
  }
  return { a: f("osup_det"), b: f("osup_zero"), c: f("osup_nil_exmp"), d: f("isup_rev"), e: f("osup_nongst"), itc };
}
export function compare3B(books: Record<"a" | "b" | "c" | "d" | "e" | "itc", Amt>, portal: Record<"a" | "b" | "c" | "d" | "e" | "itc", Amt>): ThreeBRow[] {
  const L: [keyof typeof books, string][] = [["a", "3.1(a) Outward taxable supplies"], ["b", "3.1(b) Zero-rated (exports, SEZ)"], ["c", "3.1(c) Nil-rated / exempt"], ["d", "3.1(d) Inward supplies under reverse charge"], ["e", "3.1(e) Non-GST supplies"], ["itc", "4(C) Net ITC claimed"]];
  return L.map(([k, label]) => ({ label, books: books[k], portal: portal[k], diff: r2(portal[k].taxable - books[k].taxable + taxOf(portal[k]) - taxOf(books[k])) }));
}
