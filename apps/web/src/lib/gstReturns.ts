// GST returns maths: GSTR-3B tables, ITC set-off, due dates, composition and the free calculators.
// Pure functions — the API and pages feed them data. Figures are for preparing returns; the user checks before filing.
import type { Doc } from "./gstr1";

export type Tax = { igst: number; cgst: number; sgst: number; cess: number };
export const ZERO: Tax = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const sumTax = (t: Tax) => r2(t.igst + t.cgst + t.sgst + t.cess);
const addT = (a: Tax, b: Partial<Tax>, k = 1): Tax => ({ igst: r2(a.igst + k * (b.igst ?? 0)), cgst: r2(a.cgst + k * (b.cgst ?? 0)), sgst: r2(a.sgst + k * (b.sgst ?? 0)), cess: r2(a.cess + k * (b.cess ?? 0)) });

// ── GSTR-3B Table 3.1 and 3.2 from the month's sales documents ──
export type Row31 = Tax & { taxable: number };
export type Table3 = { a: Row31; b: Row31; c: Row31; d: Row31; e: Row31; inter: { pos: string; taxable: number; igst: number }[] };
export function table3(docs: Doc[], homeState: string | null, rcmInward: Row31 = { taxable: 0, ...ZERO }): Table3 {
  let a: Row31 = { taxable: 0, ...ZERO }, b: Row31 = { taxable: 0, ...ZERO }, c: Row31 = { taxable: 0, ...ZERO };
  const inter = new Map<string, { taxable: number; igst: number }>();
  for (const d of docs) {
    const sign = d.kind === "credit_note" ? -1 : 1;
    for (const i of d.items) {
      const row = { taxable: sign * i.taxable, igst: sign * i.igst, cgst: sign * i.cgst, sgst: sign * i.sgst, cess: sign * (i.cess ?? 0) };
      if (i.rate === 0 && i.igst + i.cgst + i.sgst === 0) c = { ...addT(c, row), taxable: r2(c.taxable + row.taxable) };
      else a = { ...addT(a, row), taxable: r2(a.taxable + row.taxable) };
      // 3.2: inter-state supplies to unregistered persons, by place of supply
      const pos = d.pos ?? d.partyState ?? null;
      if (!d.gstin && i.igst && pos && pos !== homeState) {
        const x = inter.get(pos) ?? { taxable: 0, igst: 0 };
        x.taxable = r2(x.taxable + row.taxable); x.igst = r2(x.igst + row.igst); inter.set(pos, x);
      }
    }
  }
  return { a, b, c, d: rcmInward, e: { taxable: 0, ...ZERO }, inter: [...inter].map(([pos, v]) => ({ pos, ...v })).sort((x, y) => x.pos.localeCompare(y.pos)) };
}

// ── ITC set-off (Sections 49, 49A, 49B and Rule 88A) ──
// IGST credit is used first: against IGST, then CGST, then SGST. CGST credit pays CGST then IGST;
// SGST credit pays SGST then IGST; CGST credit never pays SGST and vice versa. Cess only against cess.
export type SetOff = { fromIgst: Tax; fromCgst: Tax; fromSgst: Tax; fromCess: Tax; cash: Tax; itcLeft: Tax };
export function setOff(liability: Tax, itc: Tax): SetOff {
  const due = { ...liability };
  const left = { ...itc };
  const use = (credit: keyof Tax, against: keyof Tax, into: Tax) => {
    const amt = r2(Math.min(left[credit], due[against]));
    if (amt <= 0) return;
    left[credit] = r2(left[credit] - amt); due[against] = r2(due[against] - amt); into[against] = r2(into[against] + amt);
  };
  const fromIgst = { ...ZERO }, fromCgst = { ...ZERO }, fromSgst = { ...ZERO }, fromCess = { ...ZERO };
  use("igst", "igst", fromIgst); use("igst", "cgst", fromIgst); use("igst", "sgst", fromIgst);
  use("cgst", "cgst", fromCgst); use("cgst", "igst", fromCgst);
  use("sgst", "sgst", fromSgst); use("sgst", "igst", fromSgst);
  use("cess", "cess", fromCess);
  return { fromIgst, fromCgst, fromSgst, fromCess, cash: due, itcLeft: left };
}

// ── Due dates ──
export type Scheme = "monthly" | "qrmp" | "composition";
/** `ret` is the tax period the portal files it under: "YYYY-MM" (the month, or the quarter's last month), or "FY:<start year>" for annual returns. */
export type Due = { form: string; label: string; period: string; due: string; href: string; ret: string };
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const mLabel = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
/** Returns due in the 60 days from `today`, for the business's scheme. `qrmpLate` = states with the 24th 3B date (category B). */
export function dueDates(today: string, scheme: Scheme, qrmpLate = false): Due[] {
  const out: Due[] = [];
  const [ty, tm] = today.split("-").map(Number);
  for (let k = -1; k <= 2; k++) {
    const d = new Date(Date.UTC(ty, tm - 1 + k, 1)); const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;       // the tax period
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;                                                     // month after it
    const qEnd = m % 3 === 0;
    if (scheme === "monthly") {
      out.push({ form: "GSTR-1", label: "Sales return", period: mLabel(y, m), due: iso(ny, nm, 11), href: "/finance/gst", ret: ym(y, m) });
      out.push({ form: "GSTR-3B", label: "Summary return & tax payment", period: mLabel(y, m), due: iso(ny, nm, 20), href: "/finance/gst/3b", ret: ym(y, m) });
    } else if (scheme === "qrmp") {
      if (qEnd) {
        out.push({ form: "GSTR-1", label: "Quarterly sales return", period: `Quarter ending ${mLabel(y, m)}`, due: iso(ny, nm, 13), href: "/finance/gst", ret: ym(y, m) });
        out.push({ form: "GSTR-3B", label: "Quarterly summary return", period: `Quarter ending ${mLabel(y, m)}`, due: iso(ny, nm, qrmpLate ? 24 : 22), href: "/finance/gst/3b", ret: ym(y, m) });
      } else {
        out.push({ form: "IFF", label: "B2B invoices (optional)", period: mLabel(y, m), due: iso(ny, nm, 13), href: "/finance/gst", ret: ym(y, m) });
        out.push({ form: "PMT-06", label: "Monthly tax payment", period: mLabel(y, m), due: iso(ny, nm, 25), href: "/finance/gst/3b", ret: ym(y, m) });
      }
    } else if (qEnd) {
      out.push({ form: "CMP-08", label: "Composition tax payment", period: `Quarter ending ${mLabel(y, m)}`, due: iso(ny, nm, 18), href: "/finance/gst/composition", ret: ym(y, m) });
    }
  }
  // Annual returns
  const fyStart = tm >= 4 ? ty : ty - 1;
  out.push({ form: "GSTR-9", label: "Annual return", period: `FY ${fyStart - 1}-${String(fyStart).slice(2)}`, due: iso(fyStart, 12, 31), href: "/finance/gst/annual", ret: `FY:${fyStart - 1}` });
  if (scheme === "composition") out.push({ form: "GSTR-4", label: "Composition annual return", period: `FY ${fyStart - 1}-${String(fyStart).slice(2)}`, due: iso(fyStart, 4, 30), href: "/finance/gst/composition", ret: `FY:${fyStart - 1}` });
  const end = new Date(Date.parse(today) + 60 * 86400000).toISOString().slice(0, 10);
  return out.filter(x => x.due >= today && x.due <= end).sort((a, b) => a.due.localeCompare(b.due));
}

// ── Composition: CMP-08 ──
export const COMPOSITION_RATES = [
  { key: "trader", label: "Traders & manufacturers", rate: 0.01 },
  { key: "restaurant", label: "Restaurants (not serving alcohol)", rate: 0.05 },
  { key: "service", label: "Service providers (Sec 10(2A))", rate: 0.06 },
] as const;
export function cmp08(turnover: number, rate: number, rcmTax: Tax = ZERO) {
  const tax = r2(turnover * rate);
  return { turnover: r2(turnover), cgst: r2(tax / 2), sgst: r2(tax / 2), total: r2(tax + sumTax(rcmTax)), rcm: rcmTax };
}

// ── Free calculators ──
/** Late fee for GSTR-1/3B (per Act, CGST + SGST together), with the 2021 caps by turnover. */
export function gstLateFee(daysLate: number, nil: boolean, aato: number): { perDay: number; fee: number; cap: number } {
  const perDay = nil ? 20 : 50;
  const cap = nil ? 500 : aato <= 1.5e7 ? 2000 : aato <= 5e7 ? 5000 : 10000;
  return { perDay, fee: Math.min(Math.max(0, Math.floor(daysLate)) * perDay, cap), cap };
}
/** GSTR-9 late fee: per day and capped as a share of turnover in the state (from FY 2022-23). */
export function gstr9LateFee(daysLate: number, turnover: number) {
  const [perDay, capPct] = turnover <= 5e7 ? [50, 0.0004] : turnover <= 2e8 ? [100, 0.0004] : [200, 0.005];
  return { perDay, fee: r2(Math.min(Math.max(0, Math.floor(daysLate)) * perDay, turnover * capPct)), cap: r2(turnover * capPct) };
}
/** Interest under Section 50 on tax paid late in cash: 18% a year, per day. */
export const gstInterest = (cashTax: number, daysLate: number, ratePct = 18) => r2(cashTax * (ratePct / 100) * Math.max(0, daysLate) / 365);

/** Advance tax instalments (Section 211) and Section 234C interest on shortfalls (1% a month). */
export function advanceTax(totalTax: number, paid: [number, number, number, number] = [0, 0, 0, 0], presumptive = false) {
  if (totalTax < 10000) return { applicable: false, rows: [] as { due: string; cumulativePct: number; required: number; paid: number; shortfall: number; interest: number }[], interest: 0 };
  const plan = presumptive ? [[ "15 Mar", 1, 1 ]] as const : ([["15 Jun", 0.15, 3], ["15 Sep", 0.45, 3], ["15 Dec", 0.75, 3], ["15 Mar", 1, 1]] as const);
  let cum = 0;
  const rows = plan.map(([due, pct, months], i) => {
    cum += presumptive ? paid.reduce((s, x) => s + x, 0) : paid[i] ?? 0;
    const required = r2(totalTax * pct);
    // Section 234C relief: no interest if at least 12% / 36% was paid by June / September
    const relief = !presumptive && ((i === 0 && cum >= totalTax * 0.12) || (i === 1 && cum >= totalTax * 0.36));
    const shortfall = relief ? 0 : r2(Math.max(0, required - cum));
    return { due, cumulativePct: pct, required, paid: r2(cum), shortfall, interest: r2(Math.floor(shortfall / 100) * 100 * 0.01 * months) };
  });
  return { applicable: true, rows, interest: r2(rows.reduce((s, r) => s + r.interest, 0)) };
}
/** E-invoicing applies once aggregate turnover crossed ₹5 crore in any financial year since 2017-18. */
export const eInvoiceApplies = (highestAato: number) => highestAato > 5e7;
