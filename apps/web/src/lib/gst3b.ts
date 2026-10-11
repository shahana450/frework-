// GSTR-3B tax payable per month from the books — the ONE function behind the GSTR-3B page's "payable per books",
// the dashboard / MIS due-date amounts and the "GST payable" alert. Each return's amount comes from its own tax
// period; unused input tax credit carries forward to the next month. Set-off follows lib/gstReturns.setOff.
import { setOff, sumTax, ZERO, type Tax } from "./gstReturns";

export type GstMonth = { liability: Tax; rcm: Tax; itc: Tax; itcAvailable: Tax; itcCarriedOut: Tax; cash: number };
type Acc = { id: string; name: string };
type Line = { account_id: string; dr: number; cr: number; date: string };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const kindOf = (n: string): keyof Tax | null => /igst|integrated/i.test(n) ? "igst" : /cgst|central/i.test(n) ? "cgst" : /sgst|utgst|state/i.test(n) ? "sgst" : /cess/i.test(n) ? "cess" : null;
/** Which GST ledger this is: output tax, reverse-charge tax payable, or input tax credit. */
export function gstRole(name: string): { role: "output" | "rcm" | "input"; kind: keyof Tax } | null {
  if (!/gst|cess/i.test(name)) return null;
  const kind = kindOf(name);
  if (!kind) return null;
  if (/input|itc|receivable|credit\s*ledger/i.test(name)) return { role: "input", kind };
  if (/reverse|rcm/i.test(name)) return { role: "rcm", kind };
  return { role: "output", kind };
}
const add = (a: Tax, k: keyof Tax, v: number): Tax => ({ ...a, [k]: r2(a[k] + v) });

export function gst3bByMonth(accounts: Acc[], lines: Line[]): Map<string, GstMonth> {
  const role = new Map(accounts.map(a => [a.id, gstRole(a.name)]));
  const months = new Map<string, { liability: Tax; rcm: Tax; itc: Tax }>();
  for (const l of lines) {
    const r = role.get(l.account_id);
    if (!r) continue;
    const ym = l.date.slice(0, 7);
    const m = months.get(ym) ?? { liability: { ...ZERO }, rcm: { ...ZERO }, itc: { ...ZERO } };
    if (r.role === "input") m.itc = add(m.itc, r.kind, l.dr - l.cr);
    else if (r.role === "rcm") m.rcm = add(m.rcm, r.kind, l.cr - l.dr);
    else m.liability = add(m.liability, r.kind, l.cr - l.dr);
    months.set(ym, m);
  }
  const out = new Map<string, GstMonth>();
  let carried: Tax = { ...ZERO };
  for (const ym of [...months.keys()].sort()) {
    const m = months.get(ym)!;
    const pos = (t: Tax): Tax => ({ igst: Math.max(0, t.igst), cgst: Math.max(0, t.cgst), sgst: Math.max(0, t.sgst), cess: Math.max(0, t.cess) });
    const itcAvailable: Tax = pos({ igst: carried.igst + m.itc.igst, cgst: carried.cgst + m.itc.cgst, sgst: carried.sgst + m.itc.sgst, cess: carried.cess + m.itc.cess });
    const so = setOff(pos(m.liability), itcAvailable);
    // Reverse-charge tax is always paid in cash
    const cash = r2(sumTax(so.cash) + sumTax(pos(m.rcm)));
    out.set(ym, { liability: m.liability, rcm: m.rcm, itc: m.itc, itcAvailable, itcCarriedOut: so.itcLeft, cash });
    carried = so.itcLeft;
  }
  return out;
}

/** The amount for one month's GSTR-3B (0 when nothing happened that month, never another month's figure). */
export const gst3bCash = (byMonth: Map<string, GstMonth>, ym: string) => byMonth.get(ym)?.cash ?? 0;
