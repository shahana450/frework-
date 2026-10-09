// Statutory due dates outside India. Pure. Standard dates only: tax authorities can assign other VAT periods
// ("staggers") or grant extensions, so every item carries a note to check.
import type { DueItem } from "./compliance";

export type WorldInput = {
  country: string;            // ISO code: AE, SA, QA, OM, BH, KW, GB, US, SG …
  fyStart?: string | null;    // "MM-DD" the financial year starts (default 01-01)
  taxRegistered: boolean;     // VAT / GST registered (has a tax number or uses a VAT ledger)
  payroll: boolean;           // pays salaries
  wht: boolean;               // pays withholding tax
  vatMonthly?: boolean;       // monthly VAT filer (default quarterly)
  amounts?: { vat?: number; wht?: number };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const lastOf = (y: number, m: number) => D(y, m + 1, 0);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const mlabel = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

type Due = (periodEnd: Date) => Date; // from the last day of a period to its due date
const nextMonthDay = (day: number): Due => e => D(e.getUTCFullYear(), e.getUTCMonth() + 1, day);
const nextMonthEnd: Due = e => lastOf(e.getUTCFullYear(), e.getUTCMonth() + 1);
const plusDays = (n: number): Due => e => addDays(e, n);
const plusMonthsDays = (m: number, n: number): Due => e => addDays(lastOf(e.getUTCFullYear(), e.getUTCMonth() + m), n); // e.g. 1 month + 7 days
const monthsAfterEnd = (n: number, day?: number): Due => e => day ? D(e.getUTCFullYear(), e.getUTCMonth() + n, day) : lastOf(e.getUTCFullYear(), e.getUTCMonth() + n);

const NAMES: Record<string, string> = { AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", OM: "Oman", BH: "Bahrain", KW: "Kuwait", GB: "UK", US: "US", SG: "Singapore" };
export const WORLD_COUNTRIES = Object.keys(NAMES);

export function worldDueDates(today: string, inp: WorldInput, horizon = 75): DueItem[] {
  const t = new Date(today + "T00:00:00Z");
  const out: DueItem[] = [];
  const cc = inp.country.toUpperCase();
  const note = `Standard ${NAMES[cc] ?? cc} date — your tax authority may set a different period or grant an extension.`;
  const push = (key: string, kind: DueItem["kind"], title: string, period: string, due: Date, amount: number | null = null, href = "/finance/gst") => {
    const left = daysBetween(today, iso(due));
    if (left >= -7 && left <= horizon) out.push({ key, kind, title, period, due: iso(due), daysLeft: left, amount, href, note });
  };

  // Periods: months (k = -3..2) and calendar quarters around today
  const months = Array.from({ length: 6 }, (_, i) => { const p = D(t.getUTCFullYear(), t.getUTCMonth() + i - 3, 1); return { y: p.getUTCFullYear(), m: p.getUTCMonth() }; });
  const quarters = Array.from({ length: 4 }, (_, i) => { const p = D(t.getUTCFullYear(), Math.floor(t.getUTCMonth() / 3) * 3 + (i - 2) * 3, 1); return { y: p.getUTCFullYear(), q: Math.floor(p.getUTCMonth() / 3) }; });
  const monthly = (code: string, kind: DueItem["kind"], title: string, due: Due, amount: number | null = null, href?: string) =>
    months.forEach(({ y, m }) => push(`${code}-${y}-${m}`, kind, title, mlabel(y, m), due(lastOf(y, m)), amount, href));
  const vat = (title: string, due: Due) => {
    if (!inp.taxRegistered) return;
    if (inp.vatMonthly) monthly("vat", "vat", title, due, inp.amounts?.vat ?? null);
    else quarters.forEach(({ y, q }) => push(`vat-${y}-q${q}`, "vat", title, `Q${q + 1} ${y} (${mlabel(y, q * 3)}–${mlabel(y, q * 3 + 2)})`, due(lastOf(y, q * 3 + 2)), inp.amounts?.vat ?? null));
  };

  // Financial-year ends around today
  const [fm, fd] = (inp.fyStart && /^\d{2}-\d{2}$/.test(inp.fyStart) ? inp.fyStart : "01-01").split("-").map(Number);
  const fyEnds = [-2, -1, 0, 1].map(k => addDays(D(t.getUTCFullYear() + k, fm - 1, fd), -1));
  const yearly = (code: string, kind: DueItem["kind"], title: string, due: Due, href = "/finance/reports?tab=profit_loss") =>
    fyEnds.forEach(e => push(`${code}-${iso(e)}`, kind, title, `Year ended ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`, due(e), null, href));
  const fixed = (code: string, kind: DueItem["kind"], title: string, period: (y: number) => string, m: number, d: number, href?: string) =>
    [-1, 0, 1].forEach(k => { const y = t.getUTCFullYear() + k; push(`${code}-${y}`, kind, title, period(y), D(y, m, d), null, href); });

  switch (cc) {
    case "AE":
      vat("VAT return & payment", nextMonthDay(28));
      yearly("ct", "corp_tax", "Corporate tax return & payment", monthsAfterEnd(9));
      break;
    case "SA":
      vat("VAT return & payment", nextMonthEnd);
      if (inp.wht) monthly("wht", "wht", "Withholding tax return & payment", nextMonthDay(10), inp.amounts?.wht ?? null);
      if (inp.payroll) monthly("gosi", "payroll", "GOSI contributions", nextMonthDay(15), null, "/finance/payroll");
      yearly("zakat", "corp_tax", "Zakat / income tax return", plusDays(120));
      break;
    case "QA":
      if (inp.wht) monthly("wht", "wht", "Withholding tax payment", nextMonthDay(16), inp.amounts?.wht ?? null);
      yearly("cit", "corp_tax", "Income tax return", monthsAfterEnd(4));
      break;
    case "OM":
      vat("VAT return & payment", plusDays(30));
      if (inp.wht) monthly("wht", "wht", "Withholding tax payment", nextMonthDay(14), inp.amounts?.wht ?? null);
      yearly("cit", "corp_tax", "Income tax return", monthsAfterEnd(4));
      break;
    case "BH":
      vat("VAT return & payment", nextMonthEnd);
      break;
    case "KW":
      yearly("cit", "corp_tax", "Income tax declaration", monthsAfterEnd(4, 15));
      break;
    case "GB":
      vat("VAT return & payment", plusMonthsDays(1, 7));
      if (inp.payroll) monthly("paye", "payroll", "PAYE & NIC payment", nextMonthDay(22), null, "/finance/payroll");
      yearly("ctpay", "corp_tax", "Corporation tax payment", e => addDays(monthsAfterEnd(9)(e), 1));
      yearly("ct600", "corp_tax", "Company tax return (CT600)", monthsAfterEnd(12));
      break;
    case "US":
      [[3, 15, "Q1"], [5, 15, "Q2"], [8, 15, "Q3"], [0, 15, "Q4"]].forEach(([m, d, q]) =>
        [-1, 0, 1].forEach(k => { const y = t.getUTCFullYear() + k; push(`est-${y}-${q}`, "corp_tax", "Federal estimated tax payment", `${q} ${m === 0 ? y - 1 : y}`, D(y, m as number, d as number)); }));
      if (inp.payroll) {
        quarters.forEach(({ y, q }) => push(`941-${y}-${q}`, "payroll", "Form 941 (payroll tax return)", `Q${q + 1} ${y}`, lastOf(y, q * 3 + 3), null, "/finance/payroll"));
        fixed("w2", "payroll", "W-2 / 1099-NEC to IRS & recipients", y => `Tax year ${y - 1}`, 0, 31, "/finance/payroll");
      }
      yearly("1120", "corp_tax", "Federal income tax return", monthsAfterEnd(4, 15));
      break;
    case "SG":
      vat("GST return & payment", nextMonthEnd);
      if (inp.payroll) monthly("cpf", "payroll", "CPF contributions", nextMonthDay(14), null, "/finance/payroll");
      yearly("eci", "corp_tax", "Estimated chargeable income (ECI)", monthsAfterEnd(3));
      fixed("formc", "corp_tax", "Corporate income tax return (Form C / C-S)", y => `YA ${y}`, 10, 30);
      if (inp.payroll) fixed("ir8a", "payroll", "IR8A employee income", y => `Year ${y - 1}`, 2, 1, "/finance/payroll");
      break;
  }
  const seen = new Set<string>();
  return out.filter(x => !seen.has(x.key) && seen.add(x.key)).sort((a, b) => a.due.localeCompare(b.due));
}
