// Statutory due dates (India) for the dashboard. Pure — the caller says which apply and passes amounts owed.
// Dates follow the standard calendar; extensions notified by CBDT/CBIC are not known here.

export type DueKind = "gst" | "tds" | "pf" | "pt" | "advance_tax" | "itr" | "notice" | "vat" | "corp_tax" | "wht" | "payroll";
export type DueItem = { key: string; kind: DueKind; title: string; period: string; due: string; daysLeft: number; amount: number | null; href: string; note?: string; filed?: { on: string | null; arn: string | null; demo: boolean } };
export type ComplianceInput = {
  gst: boolean;              // has a GSTIN
  tds: boolean;              // deducts TDS (TAN, or TDS Payable used)
  payroll: boolean;          // pays salary with PF/ESI
  audit?: boolean;           // tax audit applies → ITR in October
  pt?: boolean;              // professional tax applies (salaries paid, or a PT ledger used)
  state?: string | null;     // business state — professional tax dates differ by state
  amounts?: { gst?: number; tds?: number; pf?: number; pt?: number };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const monthName = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const fyOf = (y: number, m: number) => (m >= 3 ? y : y - 1); // FY starting year for a month (Apr = 3)

// Professional tax (state levy). Monthly: day of the following month (0 = last day). Half-yearly / yearly: fixed dates.
type PtRule = { monthly?: number; dates?: [number, number, string][]; note: string };
const PT_RULES: Record<string, PtRule> = {
  kerala: { dates: [[7, 31, "Apr–Sep half-year"], [1, 0, "Oct–Mar half-year"]], note: "Pay to your municipality / panchayat." },
  karnataka: { monthly: 20, note: "Employer deduction for the month." },
  maharashtra: { dates: [[2, 31, "year (monthly if last year's PT was ₹50,000 or more)"]], note: "PTRC payment." },
  "tamil nadu": { dates: [[8, 30, "Apr–Sep half-year"], [2, 31, "Oct–Mar half-year"]], note: "Pay to your local body." },
  telangana: { monthly: 10, note: "Employer deduction for the month." },
  "andhra pradesh": { monthly: 10, note: "Employer deduction for the month." },
  gujarat: { monthly: 15, note: "Employer deduction for the month." },
  "west bengal": { monthly: 21, note: "Employer deduction for the month." },
};
export const ptStates = Object.keys(PT_RULES);

/** Every due date from 7 days ago up to `horizon` days ahead, soonest first. */
export function dueDates(today: string, inp: ComplianceInput, horizon = 75): DueItem[] {
  const t = new Date(today + "T00:00:00Z");
  const out: DueItem[] = [];
  const push = (it: Omit<DueItem, "daysLeft">) => {
    const left = daysBetween(today, it.due);
    if (left >= -7 && left <= horizon) out.push({ ...it, daysLeft: left });
  };

  // Monthly items: look at the 3 previous months' periods and the current one
  for (let k = -3; k <= 2; k++) {
    const p = D(t.getUTCFullYear(), t.getUTCMonth() + k, 1);  // the period (month) the return/payment is for
    const py = p.getUTCFullYear(), pm = p.getUTCMonth();
    const label = monthName(py, pm);
    if (inp.gst) {
      push({ key: `gstr1-${py}-${pm}`, kind: "gst", title: "GSTR-1", period: label, due: iso(D(py, pm + 1, 11)), amount: null, href: "/finance/gst" });
      push({ key: `gstr3b-${py}-${pm}`, kind: "gst", title: "GSTR-3B & GST payment", period: label, due: iso(D(py, pm + 1, 20)), amount: inp.amounts?.gst ?? null, href: "/finance/gst" });
    }
    if (inp.tds) {
      // March TDS is due 30 April; other months the 7th of the next month
      const due = pm === 2 ? D(py, 3, 30) : D(py, pm + 1, 7);
      push({ key: `tdsdep-${py}-${pm}`, kind: "tds", title: "TDS deposit", period: label, due: iso(due), amount: inp.amounts?.tds ?? null, href: "/finance/tds", note: "Pay TDS deducted in the month (challan)." });
    }
    const pt = inp.pt ? PT_RULES[(inp.state ?? "").trim().toLowerCase()] : undefined;
    if (pt?.monthly) {
      const due = pt.monthly === 0 ? D(py, pm + 2, 0) : D(py, pm + 1, pt.monthly);
      push({ key: `pt-${py}-${pm}`, kind: "pt", title: "Professional tax", period: label, due: iso(due), amount: inp.amounts?.pt ?? null, href: "/finance/payroll", note: pt.note });
    }
    if (inp.payroll) push({ key: `pf-${py}-${pm}`, kind: "pf", title: "PF & ESI payment", period: label, due: iso(D(py, pm + 1, 15)), amount: inp.amounts?.pf ?? null, href: "/finance/payroll" });
  }

  // Quarterly / yearly items for this FY and the next
  const fy0 = fyOf(t.getUTCFullYear(), t.getUTCMonth());
  for (const fy of [fy0 - 1, fy0, fy0 + 1]) {
    const fyl = `FY ${fy}-${String(fy + 1).slice(2)}`;
    if (inp.tds) {
      ([["Q1 (Apr–Jun)", D(fy, 6, 31)], ["Q2 (Jul–Sep)", D(fy, 9, 31)], ["Q3 (Oct–Dec)", D(fy + 1, 0, 31)], ["Q4 (Jan–Mar)", D(fy + 1, 4, 31)]] as const)
        .forEach(([q, d], i) => push({ key: `tdsret-${fy}-${i}`, kind: "tds", title: "TDS return", period: `${q} ${fyl}`, due: iso(d), amount: null, href: "/finance/tds" }));
    }
    const ptRule = inp.pt ? PT_RULES[(inp.state ?? "").trim().toLowerCase()] : undefined;
    for (const [m, d, what] of ptRule?.dates ?? []) {
      // Months Jan–Mar belong to the second calendar year of the FY; day 0 = last day of that month
      const y = m <= 2 ? fy + 1 : fy;
      const due = d === 0 ? D(y, m + 1, 0) : D(y, m, d);
      push({ key: `pt-${fy}-${m}`, kind: "pt", title: "Professional tax", period: `FY ${fy}-${String(fy + 1).slice(2)} · ${what}`, due: iso(due), amount: inp.amounts?.pt ?? null, href: "/finance/payroll", note: ptRule!.note });
    }
    ([["15% of the year's tax", D(fy, 5, 15)], ["45% cumulative", D(fy, 8, 15)], ["75% cumulative", D(fy, 11, 15)], ["100% of the year's tax", D(fy + 1, 2, 15)]] as const)
      .forEach(([what, d], i) => push({ key: `adv-${fy}-${i}`, kind: "advance_tax", title: "Advance tax", period: `${fyl} · ${what}`, due: iso(d), amount: null, href: "/finance/reports?tab=profit_loss", note: "Payable if the year's tax is ₹10,000 or more." }));
    // Returns for the year just ended are filed in the following FY
    const done = fy - 1, donel = `FY ${done}-${String(done + 1).slice(2)}`;
    if (inp.audit) {
      push({ key: `audit-${done}`, kind: "itr", title: "Tax audit report", period: donel, due: iso(D(fy, 8, 30)), amount: null, href: "/finance/audit" });
      push({ key: `itr-${done}`, kind: "itr", title: "Income tax return (audit case)", period: donel, due: iso(D(fy, 9, 31)), amount: null, href: "/finance/reports?tab=profit_loss" });
    } else {
      push({ key: `itr-${done}`, kind: "itr", title: "Income tax return", period: donel, due: iso(D(fy, 6, 31)), amount: null, href: "/finance/reports?tab=profit_loss" });
    }
    if (inp.gst) push({ key: `gstr9-${done}`, kind: "gst", title: "GSTR-9 annual return", period: donel, due: iso(D(fy, 11, 31)), amount: null, href: "/finance/gst", note: "Optional below ₹2 crore turnover." });
  }

  const seen = new Set<string>();
  return out.filter(x => !seen.has(x.key) && seen.add(x.key)).sort((a, b) => a.due.localeCompare(b.due));
}
