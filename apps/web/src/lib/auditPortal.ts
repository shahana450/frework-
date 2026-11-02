// 360° audit — books against the portals. Reads the files people download from the GST portal (GSTR-1, GSTR-3B,
// GSTR-2B JSON) and the income-tax site (26AS), works out the same figures from the books, and compares them.
// Pure: no network. The browser parses the files; the API route compares them with the books.
import type { QJournal } from "./bookQueries";
import type { AuditAccount, AuditCheck, AuditItem, AuditStatus } from "./audit360";

// ── Portal data, normalised ─────────────────────────────────────────────────────────────────────────────────────────
export type Tax = { igst: number; cgst: number; sgst: number; cess: number };
export type PortalData = {
  gstr1?: { months: Record<string, Tax & { taxable: number }>; b2b: { ctin: string; inum: string; date: string; taxable: number; tax: number }[] };
  gstr3b?: { months: Record<string, { taxable: number; out: Tax; itc: Tax }> };
  gstr2b?: { months: Record<string, Tax>; suppliers: { ctin: string; name: string; tax: Tax; taxable: number; invoices: number }[] };
  tds26as?: { deductors: { name: string; tan: string; paid: number; tds: number }[] };
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => { const x = Number(String(v ?? "").replace(/[,₹\s]/g, "")); return Number.isFinite(x) ? x : 0; };
const zero = (): Tax => ({ igst: 0, cgst: 0, sgst: 0, cess: 0 });
const addTax = (a: Tax, b: Partial<Tax>, sign = 1) => { a.igst = r2(a.igst + sign * (b.igst ?? 0)); a.cgst = r2(a.cgst + sign * (b.cgst ?? 0)); a.sgst = r2(a.sgst + sign * (b.sgst ?? 0)); a.cess = r2(a.cess + sign * (b.cess ?? 0)); };
const total = (t: Tax) => r2(t.igst + t.cgst + t.sgst + t.cess);
/** "042025" (return period) → "2025-04" */
const ymOfPeriod = (fp: string) => /^\d{6}$/.test(fp) ? `${fp.slice(2)}-${fp.slice(0, 2)}` : "";
/** "dd-mm-yyyy" → "yyyy-mm-dd" */
const isoOf = (d: string) => { const m = String(d ?? "").match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(d ?? "").slice(0, 10); };
const unwrap = (j: unknown): Record<string, unknown> => { const o = (j ?? {}) as Record<string, unknown>; return ((o.data as Record<string, unknown>) ?? o); };
/** Invoice numbers compared without spaces, slashes, dashes or leading zeros */
export const invKey = (s: string) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+/, "");
/** Party names compared without "Pvt Ltd", "M/s", punctuation… */
export const partyKey = (s: string) => String(s ?? "").toLowerCase().replace(/\bm\/s\.?|\b(private|pvt|limited|ltd|llp|the|and|co|company|india)\b|&/g, " ").replace(/[^a-z0-9]/g, "");

type ItmDet = { txval?: unknown; iamt?: unknown; camt?: unknown; samt?: unknown; csamt?: unknown };
const det = (x: { itm_det?: ItmDet } & ItmDet) => { const d = x.itm_det ?? x; return { taxable: num(d.txval), igst: num(d.iamt), cgst: num(d.camt), sgst: num(d.samt), cess: num(d.csamt) }; };

/** GSTR-1 JSON (one month): month totals (credit notes deducted) and the B2B invoices. Several files can be merged. */
export function parseGstr1(json: unknown, into?: PortalData["gstr1"]): NonNullable<PortalData["gstr1"]> {
  const d = unwrap(json);
  const out = into ?? { months: {}, b2b: [] };
  const ym = ymOfPeriod(String(d.fp ?? d.ret_period ?? ""));
  if (!ym) throw new Error("This doesn't look like a GSTR-1 JSON (no return period).");
  const m = out.months[ym] = { taxable: 0, ...zero() };
  const addLine = (x: { taxable: number } & Tax, sign = 1) => { m.taxable = r2(m.taxable + sign * x.taxable); addTax(m, x, sign); };
  for (const p of (d.b2b ?? []) as { ctin: string; inv: { inum: string; idt: string; itms: { itm_det?: ItmDet }[] }[] }[])
    for (const inv of p.inv ?? []) {
      let taxable = 0, tax = 0;
      for (const it of inv.itms ?? []) { const x = det(it); addLine(x); taxable += x.taxable; tax += total(x); }
      out.b2b.push({ ctin: p.ctin, inum: String(inv.inum), date: isoOf(inv.idt), taxable: r2(taxable), tax: r2(tax) });
    }
  for (const p of (d.b2cl ?? []) as { inv: { itms: { itm_det?: ItmDet }[] }[] }[]) for (const inv of p.inv ?? []) for (const it of inv.itms ?? []) addLine(det(it));
  for (const x of (d.b2cs ?? []) as ItmDet[]) addLine(det(x));
  for (const p of (d.exp ?? []) as { inv: { itms: ItmDet[] }[] }[]) for (const inv of p.inv ?? []) for (const it of inv.itms ?? []) addLine(det(it));
  const notes = [...((d.cdnr ?? []) as { nt: unknown[] }[]).flatMap(p => p.nt ?? []), ...((d.cdnur ?? []) as unknown[])] as { ntty?: string; typ?: string; itms?: { itm_det?: ItmDet }[] }[];
  for (const nt of notes) { const sign = String(nt.ntty ?? nt.typ ?? "C").toUpperCase() === "D" ? 1 : -1; for (const it of nt.itms ?? []) addLine(det(it), sign); }
  return out;
}

/** GSTR-3B JSON (one month): outward taxable value and tax, and net ITC. */
export function parseGstr3b(json: unknown, into?: PortalData["gstr3b"]): NonNullable<PortalData["gstr3b"]> {
  const d = unwrap(json);
  const out = into ?? { months: {} };
  const ym = ymOfPeriod(String(d.ret_period ?? d.fp ?? ""));
  if (!ym) throw new Error("This doesn't look like a GSTR-3B JSON (no return period).");
  const sup = (d.sup_details ?? {}) as Record<string, ItmDet>;
  const o = det(sup.osup_det ?? {}), z = det(sup.osup_zero ?? {});
  const elg = (d.itc_elg ?? {}) as { itc_net?: ItmDet; itc_avl?: ItmDet[]; itc_rev?: ItmDet[] };
  let itc: Tax;
  if (elg.itc_net) { const n = det(elg.itc_net); itc = { igst: n.igst, cgst: n.cgst, sgst: n.sgst, cess: n.cess }; }
  else { itc = zero(); for (const x of elg.itc_avl ?? []) addTax(itc, det(x)); for (const x of elg.itc_rev ?? []) addTax(itc, det(x), -1); }
  out.months[ym] = { taxable: r2(o.taxable + z.taxable), out: { igst: r2(o.igst + z.igst), cgst: o.cgst, sgst: o.sgst, cess: o.cess }, itc };
  return out;
}

/** GSTR-2B JSON (one month): ITC available, supplier by supplier. */
export function parseGstr2b(json: unknown, into?: PortalData["gstr2b"]): NonNullable<PortalData["gstr2b"]> {
  const d = unwrap(json);
  const out = into ?? { months: {}, suppliers: [] };
  const ym = ymOfPeriod(String(d.rtnprd ?? d.ret_period ?? ""));
  if (!ym) throw new Error("This doesn't look like a GSTR-2B JSON (no return period).");
  const m = out.months[ym] = zero();
  const doc = ((d.docdata ?? d) as Record<string, unknown>);
  const bySup = new Map(out.suppliers.map(s => [s.ctin, s]));
  type Row = { txval?: unknown; igst?: unknown; cgst?: unknown; sgst?: unknown; cess?: unknown; items?: Row[] };
  const take = (ctin: string, name: string, row: Row, sign: number) => {
    const parts = row.items?.length ? row.items : [row];
    const t = zero(); let taxable = 0;
    for (const p of parts) { addTax(t, { igst: num(p.igst), cgst: num(p.cgst), sgst: num(p.sgst), cess: num(p.cess) }); taxable += num(p.txval); }
    addTax(m, t, sign);
    const s = bySup.get(ctin) ?? { ctin, name, tax: zero(), taxable: 0, invoices: 0 };
    addTax(s.tax, t, sign); s.taxable = r2(s.taxable + sign * taxable); s.invoices++;
    if (!bySup.has(ctin)) { bySup.set(ctin, s); out.suppliers.push(s); }
  };
  for (const p of (doc.b2b ?? []) as { ctin: string; trdnm?: string; inv?: Row[] }[]) for (const inv of p.inv ?? []) take(p.ctin, p.trdnm ?? p.ctin, inv, 1);
  for (const p of (doc.cdnr ?? []) as { ctin: string; trdnm?: string; nt?: (Row & { typ?: string })[] }[]) for (const nt of p.nt ?? []) take(p.ctin, p.trdnm ?? p.ctin, nt, String(nt.typ ?? "C").toUpperCase() === "D" ? 1 : -1);
  return out;
}

/** 26AS / AIS as a table (Excel or CSV export): one row per deductor, columns found by their headings. */
export function parse26asRows(rows: unknown[][]): NonNullable<PortalData["tds26as"]> {
  const hi = rows.findIndex(r => r.some(c => /deductor|name/i.test(String(c))) && r.some(c => /tax deducted|tds/i.test(String(c))));
  if (hi < 0) throw new Error("Couldn't find the deductor / TDS columns in this sheet.");
  const h = rows[hi].map(c => String(c ?? "").toLowerCase());
  const col = (re: RegExp) => h.findIndex(c => re.test(c));
  const cName = col(/name of (the )?deductor|deductor name|^name/), cTan = col(/tan/), cPaid = col(/amount (paid|credited)|paid|credited/), cTds = col(/tax deducted|tds deducted|^tds/);
  const map = new Map<string, { name: string; tan: string; paid: number; tds: number }>();
  for (const r of rows.slice(hi + 1)) {
    const name = String(r[cName] ?? "").trim(), tds = num(r[cTds]);
    if (!name || (!tds && !num(r[cPaid])) || /^total/i.test(name)) continue;
    const tan = cTan >= 0 ? String(r[cTan] ?? "").trim() : "";
    const k = tan || partyKey(name);
    const x = map.get(k) ?? { name, tan, paid: 0, tds: 0 };
    x.paid = r2(x.paid + num(r[cPaid])); x.tds = r2(x.tds + tds); map.set(k, x);
  }
  return { deductors: [...map.values()] };
}

// ── Books side ──────────────────────────────────────────────────────────────────────────────────────────────────────
const head = (name: string) => { const n = name.toLowerCase(); return /\bigst\b/.test(n) ? "igst" : /\b(sgst|utgst)\b/.test(n) ? "sgst" : /\bcgst\b/.test(n) ? "cgst" : /\bcess\b/.test(n) ? "cess" : null; };
const isGst = (a?: AuditAccount) => !!a && !!head(a.name) && !/\b(tds|tcs)\b/i.test(a.name) && !/\brcm\b|reverse charge/i.test(a.name);
const isOutputGst = (a?: AuditAccount) => isGst(a) && (/\boutput\b|payable/i.test(a!.name) || a!.type === "liability") && !/\binput\b/i.test(a!.name);
const isInputGst = (a?: AuditAccount) => isGst(a) && !isOutputGst(a);
const isSales = (a?: AuditAccount) => !!a && a.type === "income" && (a.sub_type === "revenue" || a.sub_type === "direct_income" || /\bsales?\b/i.test(a.name));
const isTdsRecv = (a?: AuditAccount) => !!a && /\btds\b/i.test(a.name) && (a.type === "asset" || /receivable|recoverable|advance tax/i.test(a.name));
const isTdsPay = (a?: AuditAccount) => !!a && /\btds\b/i.test(a.name) && a.type === "liability";
const isBankCash = (a?: AuditAccount) => !!a && (a.sub_type === "bank" || a.sub_type === "cash");

export type BooksFigures = {
  sales: Record<string, Tax & { taxable: number }>; itc: Record<string, Tax>;
  invoices: { inv: string; entry_no: string; journal_id: string; date: string; taxable: number; party: string }[];
  itcBySupplier: Map<string, { name: string; tax: number }>;
  tdsByParty: Map<string, { name: string; tds: number }>; tdsReceived: number;
  tdsDeducted: Record<string, number>; tdsPaid: { date: string; amount: number }[];
};

export function booksFigures(accounts: AuditAccount[], journals: QJournal[], period: { from: string; to: string }): BooksFigures {
  const acc = new Map(accounts.map(a => [a.id, a]));
  const f: BooksFigures = { sales: {}, itc: {}, invoices: [], itcBySupplier: new Map(), tdsByParty: new Map(), tdsReceived: 0, tdsDeducted: {}, tdsPaid: [] };
  for (const j of journals) {
    if (j.date < period.from || j.date > period.to) continue;
    const ym = j.date.slice(0, 7);
    const ls = j.lines.map(l => ({ ...l, a: acc.get(l.account_id) }));
    const salesNet = ls.filter(l => isSales(l.a)).reduce((s, l) => s + l.cr - l.dr, 0);
    const hasOutput = ls.some(l => isOutputGst(l.a));
    // Party: the journal's party, else the debtor / creditor line's ledger
    const partyOf = (want: "debtors" | "creditors") => j.party_name || ls.find(l => l.a && (want === "debtors" ? l.a.sub_type === "trade_receivables" : l.a.sub_type === "trade_payables"))?.a?.name || "";
    if (salesNet) {
      const m = f.sales[ym] ??= { taxable: 0, ...zero() };
      m.taxable = r2(m.taxable + salesNet);
      for (const l of ls) if (isOutputGst(l.a)) { const k = head(l.a!.name)! as keyof Tax; m[k] = r2(m[k] + l.cr - l.dr); }
      if (salesNet > 0) f.invoices.push({ inv: invKey(j.reference_no || ""), entry_no: j.entry_no, journal_id: j.id, date: j.date, taxable: r2(salesNet), party: partyOf("debtors") });
    }
    // ITC: input GST debited on a bill (not a GST payment or set-off, which also touches the output ledgers)
    if (!hasOutput) {
      const inp = ls.filter(l => isInputGst(l.a) && l.dr > 0);
      if (inp.length) {
        const m = f.itc[ym] ??= zero();
        let t = 0;
        for (const l of inp) { const k = head(l.a!.name)! as keyof Tax; m[k] = r2(m[k] + l.dr - l.cr); t += l.dr - l.cr; }
        const name = partyOf("creditors") || ls.find(l => l.cr > 0 && !isBankCash(l.a))?.a?.name || "Unknown supplier";
        const k = partyKey(name), s = f.itcBySupplier.get(k) ?? { name, tax: 0 };
        s.tax = r2(s.tax + t); f.itcBySupplier.set(k, s);
      }
    }
    // TDS others deducted from what they paid us
    const recv = ls.filter(l => isTdsRecv(l.a)).reduce((s, l) => s + l.dr - l.cr, 0);
    if (recv > 0) {
      f.tdsReceived = r2(f.tdsReceived + recv);
      const name = partyOf("debtors") || ls.find(l => l.cr > 0)?.a?.name || "Unknown";
      const k = partyKey(name), s = f.tdsByParty.get(k) ?? { name, tds: 0 };
      s.tds = r2(s.tds + recv); f.tdsByParty.set(k, s);
    }
    // TDS we deducted, and what we deposited
    for (const l of ls) if (isTdsPay(l.a)) {
      if (l.cr > 0) f.tdsDeducted[ym] = r2((f.tdsDeducted[ym] ?? 0) + l.cr);
      if (l.dr > 0 && ls.some(x => isBankCash(x.a) && x.cr > 0)) f.tdsPaid.push({ date: j.date, amount: r2(l.dr) });
    }
  }
  return f;
}

// ── Comparisons ─────────────────────────────────────────────────────────────────────────────────────────────────────
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(r2(n)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const monthName = (ym: string) => new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
/** Within ₹1 → matched; within 1% → check; more → problem */
const verdict = (books: number, portal: number): AuditStatus => { const d = Math.abs(books - portal); return d <= 1 ? "ok" : d <= Math.max(1, Math.abs(portal) * 0.01) ? "warn" : "fail"; };
const worst = (s: AuditStatus[]) => s.includes("fail") ? "fail" : s.includes("warn") ? "warn" : "ok";

export type PortalCheck = AuditCheck & { portal?: number | null; diff?: number | null };

function monthly(id: string, section: AuditCheck["section"], title: string, law: string, books: Record<string, number>, portal: Record<string, number>, what: string): PortalCheck {
  const months = [...new Set([...Object.keys(portal)])].sort();   // only the months whose return was uploaded
  const items: AuditItem[] = [];
  const st: AuditStatus[] = [];
  let b = 0, p = 0;
  for (const ym of months) {
    const bv = r2(books[ym] ?? 0), pv = r2(portal[ym] ?? 0); b += bv; p += pv;
    const v = verdict(bv, pv); st.push(v);
    if (v !== "ok") items.push({ date: ym + "-01", amount: Math.abs(r2(bv - pv)), note: `${monthName(ym)}: books ${inr(bv)} · portal ${inr(pv)} · difference ${inr(bv - pv)}` });
  }
  b = r2(b); p = r2(p);
  const status = months.length ? worst(st) : "na";
  return { id, section, title, law, status, books: b, portal: p, diff: r2(b - p), items,
    summary: !months.length ? `Upload the ${what} to compare.` : status === "ok" ? `${months.length} month${months.length === 1 ? "" : "s"} match: ${inr(b)}.` : `Books ${inr(b)} vs portal ${inr(p)} — difference ${inr(b - p)} across ${items.length} month${items.length === 1 ? "" : "s"}.` };
}

export function portalChecks(accounts: AuditAccount[], journals: QJournal[], period: { from: string; to: string }, portal: PortalData): PortalCheck[] {
  const f = booksFigures(accounts, journals, period);
  const out: PortalCheck[] = [];
  const pick = <T,>(rec: Record<string, T>, fn: (x: T) => number) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, r2(fn(v))]));
  const inFy = <T,>(rec: Record<string, T> | undefined) => Object.fromEntries(Object.entries(rec ?? {}).filter(([k]) => k >= period.from.slice(0, 7) && k <= period.to.slice(0, 7))) as Record<string, T>;

  // GSTR-1: sales
  const g1 = inFy(portal.gstr1?.months);
  out.push(monthly("g1_taxable", "gstr1", "GSTR-1 sales value vs books", "Taxable value of outward supplies reported in GSTR-1", pick(f.sales, x => x.taxable), pick(g1, x => x.taxable), "GSTR-1 JSON files"));
  out.push(monthly("g1_tax", "gstr1", "GSTR-1 output GST vs books", "IGST + CGST + SGST + cess on sales", pick(f.sales, x => total(x)), pick(g1, x => total(x)), "GSTR-1 JSON files"));
  if (portal.gstr1?.b2b.length) {
    const books = new Map(f.invoices.filter(i => i.inv).map(i => [i.inv, i]));
    const items: AuditItem[] = [];
    for (const p of portal.gstr1.b2b.filter(x => x.date >= period.from && x.date <= period.to)) {
      const b = books.get(invKey(p.inum));
      if (!b) items.push({ date: p.date, amount: p.taxable, note: `Invoice ${p.inum} (${p.ctin}) is in GSTR-1 but not in the books` });
      else if (Math.abs(b.taxable - p.taxable) > 1) items.push({ journal_id: b.journal_id, entry_no: b.entry_no, date: p.date, amount: Math.abs(b.taxable - p.taxable), note: `Invoice ${p.inum}: books ${inr(b.taxable)} vs GSTR-1 ${inr(p.taxable)}` });
    }
    out.push({ id: "g1_invoices", section: "gstr1", title: "B2B invoices: GSTR-1 vs books", law: "Each B2B invoice in GSTR-1 should be in the books at the same value",
      status: items.length ? "fail" : "ok", items: items.slice(0, 100),
      summary: items.length ? `${items.length} B2B invoice${items.length === 1 ? "" : "s"} missing from the books or at a different value.` : `All ${portal.gstr1.b2b.length} B2B invoices are in the books.` });
  }

  // GSTR-3B: tax paid and ITC claimed
  const g3 = inFy(portal.gstr3b?.months);
  out.push(monthly("g3b_output", "gstr3b", "GSTR-3B output tax vs books", "Tax on outward supplies declared in 3.1(a)", pick(f.sales, x => total(x)), pick(g3, x => total(x.out)), "GSTR-3B JSON files"));
  out.push(monthly("g3b_itc", "gstr3b", "GSTR-3B ITC claimed vs books", "Net ITC in table 4(C)", pick(f.itc, x => total(x)), pick(g3, x => total(x.itc)), "GSTR-3B JSON files"));
  if (Object.keys(g1).length && Object.keys(g3).length) {
    const items: AuditItem[] = [];
    for (const ym of Object.keys(g3).filter(k => g1[k])) {
      const a = total(g1[ym]), b = total(g3[ym].out);
      if (a - b > 1) items.push({ date: ym + "-01", amount: r2(a - b), note: `${monthName(ym)}: GSTR-1 ${inr(a)} but GSTR-3B ${inr(b)} — ${inr(a - b)} less tax declared` });
    }
    out.push({ id: "g3b_vs_g1", section: "gstr3b", title: "GSTR-3B declares at least the GSTR-1 tax", law: "Tax in GSTR-3B lower than GSTR-1 draws a notice (DRC-01B)",
      status: items.length ? "fail" : "ok", items, summary: items.length ? `${items.length} month${items.length === 1 ? "" : "s"} where 3B shows less tax than GSTR-1.` : "3B covers the GSTR-1 tax every month." });
  }

  // GSTR-2B: ITC suppliers filed
  const g2 = inFy(portal.gstr2b?.months);
  out.push(monthly("g2b_itc", "gstr2b", "ITC in books vs GSTR-2B", "ITC can be claimed only when the supplier has filed it (shows in GSTR-2B)", pick(f.itc, x => total(x)), pick(g2, x => total(x)), "GSTR-2B JSON files"));
  if (portal.gstr2b?.suppliers.length) {
    const items: AuditItem[] = [];
    const seen = new Set<string>();
    for (const s of portal.gstr2b.suppliers) {
      const k = partyKey(s.name); seen.add(k);
      const b = f.itcBySupplier.get(k)?.tax ?? 0, p = total(s.tax);
      if (Math.abs(b - p) > 1) items.push({ amount: Math.abs(r2(b - p)), note: `${s.name} (${s.ctin}): books ${inr(b)} · 2B ${inr(p)}${b ? "" : " — bills not booked"}` });
    }
    for (const [k, b] of f.itcBySupplier) if (!seen.has(k) && b.tax > 1) items.push({ amount: b.tax, note: `${b.name}: ITC ${inr(b.tax)} in books but nothing in GSTR-2B — at risk` });
    out.push({ id: "g2b_suppliers", section: "gstr2b", title: "ITC supplier by supplier", law: "Unmatched ITC must be reversed or followed up with the supplier",
      status: items.length ? "warn" : "ok", items: items.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 100),
      summary: items.length ? `${items.length} supplier${items.length === 1 ? "" : "s"} differ between books and GSTR-2B.` : "Every supplier's ITC matches GSTR-2B." });
  }

  // 26AS / AIS: TDS others deducted
  const ded = portal.tds26as?.deductors ?? [];
  const p26 = r2(ded.reduce((s, d) => s + d.tds, 0));
  out.push({ id: "tds_26as_total", section: "tds_received", title: "TDS in 26AS vs TDS receivable in books", law: "Claim only the TDS that shows in Form 26AS / AIS",
    status: !ded.length ? "na" : verdict(f.tdsReceived, p26), books: f.tdsReceived, portal: ded.length ? p26 : null, diff: ded.length ? r2(f.tdsReceived - p26) : null, items: [],
    summary: !ded.length ? "Upload Form 26AS (PDF) or AIS / 26AS as Excel to compare." : Math.abs(f.tdsReceived - p26) <= 1 ? `Both ${inr(p26)}.` : `Books ${inr(f.tdsReceived)} vs 26AS ${inr(p26)} — difference ${inr(f.tdsReceived - p26)}.` });
  if (ded.length) {
    const items: AuditItem[] = [];
    const seen = new Set<string>();
    for (const d of ded) {
      const k = partyKey(d.name); seen.add(k);
      const b = f.tdsByParty.get(k)?.tds ?? 0;
      if (Math.abs(b - d.tds) > 1) items.push({ amount: Math.abs(r2(b - d.tds)), note: `${d.name}${d.tan ? ` (${d.tan})` : ""}: books ${inr(b)} · 26AS ${inr(d.tds)}` });
    }
    for (const [k, b] of f.tdsByParty) if (!seen.has(k) && b.tds > 1) items.push({ amount: b.tds, note: `${b.name}: TDS ${inr(b.tds)} in books but not in 26AS — ask them to file / correct their TDS return` });
    out.push({ id: "tds_26as_parties", section: "tds_received", title: "TDS deductor by deductor", law: "Each deductor's TDS in 26AS should match the books",
      status: items.length ? "warn" : "ok", items: items.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 100),
      summary: items.length ? `${items.length} deductor${items.length === 1 ? "" : "s"} differ.` : "Every deductor matches." });
    const paid = r2(ded.reduce((s, d) => s + d.paid, 0)), sales = r2(Object.values(f.sales).reduce((s, x) => s + x.taxable, 0));
    out.push({ id: "turnover_26as", section: "tds_received", title: "Amounts in 26AS covered by sales", law: "Receipts reported by others (26AS / AIS) should be within the income in the books",
      status: paid > sales + 1 ? "warn" : "ok", books: sales, portal: paid, diff: r2(sales - paid), items: [],
      summary: paid > sales + 1 ? `26AS shows ${inr(paid)} paid to you, more than sales of ${inr(sales)} — check for income not booked.` : `26AS ${inr(paid)} is within sales of ${inr(sales)}.` });
  }

  // TDS we deducted: deposited by the 7th of the next month (30 April for March)
  const months = Object.keys(f.tdsDeducted).sort();
  const paid = [...f.tdsPaid].sort((a, b) => a.date.localeCompare(b.date));
  const items: AuditItem[] = [];
  let pool = paid.map(p => ({ ...p })), outstanding = 0;
  for (const ym of months) {
    const [y, m] = ym.split("-").map(Number);
    const due = m === 3 ? `${y}-04-30` : new Date(Date.UTC(y, m, 7)).toISOString().slice(0, 10);
    let need = f.tdsDeducted[ym], late = 0, lastDate = "";
    for (const p of pool) { if (need <= 0.005) break; if (p.amount <= 0.005) continue; const take = Math.min(need, p.amount); p.amount = r2(p.amount - take); need = r2(need - take); if (p.date > due) late = r2(late + take); lastDate = p.date; }
    pool = pool.filter(p => p.amount > 0.005);
    if (need > 1) { outstanding = r2(outstanding + need); items.push({ date: due, amount: need, note: `${monthName(ym)}: ${inr(need)} of ${inr(f.tdsDeducted[ym])} deducted not deposited (due ${due})` }); }
    else if (late > 1) items.push({ date: lastDate, amount: late, note: `${monthName(ym)}: ${inr(late)} deposited after the due date ${due} — interest at 1.5% a month` });
  }
  out.push({ id: "tds_deposit", section: "tds_deducted", title: "TDS deducted is deposited on time", law: "TDS is due by the 7th of the next month (30 April for March); late deposit costs 1.5% a month",
    status: !months.length ? "na" : outstanding > 1 ? "fail" : items.length ? "warn" : "ok", books: r2(Object.values(f.tdsDeducted).reduce((s, x) => s + x, 0)), items,
    summary: !months.length ? "No TDS deducted in the books this year." : outstanding > 1 ? `${inr(outstanding)} deducted but not deposited.` : items.length ? `All deposited, ${items.length} month${items.length === 1 ? "" : "s"} late.` : "All deposited on time." });

  return out;
}
