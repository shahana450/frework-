// Form 26AS and Form 16 as read by Sandbox OCR, turned into plain figures FreWork can show and compare.
// Pure — no network.

const n = (v: unknown) => { const x = Number(String(v ?? "").replace(/[,₹\s]/g, "")); return isNaN(x) ? 0 : x; };
const r2 = (x: number) => Math.round(x * 100) / 100;

export type DeductorRow = { section: string; date: string; status: string; amount: number; tds: number; deposited: number };
export type Deductor = { name: string; tan: string; paid: number; tds: number; deposited: number; rows: DeductorRow[] };
export type Summary26AS = { pan: string; name: string; fy: string; ay: string; deductors: Deductor[]; totals: { paid: number; tds: number; deposited: number }; bySection: { section: string; amount: number; tds: number }[] };

export function summarize26AS(body: unknown): Summary26AS {
  const d = ((body as { data?: unknown })?.data ?? body) as Record<string, unknown>;
  const part1 = (d["Part I"] ?? d["part_i"] ?? []) as Record<string, unknown>[];
  const deductors: Deductor[] = part1.map(x => {
    // deduction_wise: the first row is a header (text, not numbers) — rows without amounts drop out
    const raw = (x.deduction_wise ?? []) as Record<string, unknown>[];
    const rows = raw.filter(r => n(r.amount_paid_credited) || n(r.tax_deducted)).map(r => ({
      section: String(r.section ?? ""), date: String(r.transaction_date ?? ""), status: String(r.status_of_booking ?? ""),
      amount: r2(n(r.amount_paid_credited)), tds: r2(n(r.tax_deducted)), deposited: r2(n(r.tds_deposited)),
    }));
    return { name: String(x.name_of_deductor ?? ""), tan: String(x.tan_of_deductor ?? ""), paid: r2(n(x.total_amount_paid_credited)), tds: r2(n(x.total_tax_deducted)), deposited: r2(n(x.total_tds_deposited)), rows };
  });
  const totals = deductors.reduce((s, x) => ({ paid: r2(s.paid + x.paid), tds: r2(s.tds + x.tds), deposited: r2(s.deposited + x.deposited) }), { paid: 0, tds: 0, deposited: 0 });
  const sec = new Map<string, { amount: number; tds: number }>();
  for (const x of deductors) for (const r of x.rows) { const s = sec.get(r.section) ?? { amount: 0, tds: 0 }; s.amount = r2(s.amount + r.amount); s.tds = r2(s.tds + r.tds); sec.set(r.section, s); }
  return { pan: String(d.pan ?? ""), name: String(d.name ?? ""), fy: String(d.financial_year ?? ""), ay: String(d.assessment_year ?? ""), deductors, totals,
    bySection: [...sec].map(([section, v]) => ({ section, ...v })).sort((a, b) => b.tds - a.tds) };
}

export type SummaryForm16 = {
  ay: string; employer: { name: string; tan: string; pan: string }; employeePan: string; employeeName: string;
  gross: number; standardDeduction: number; deductions16: number; chapterVIA: number; salaryIncome: number; taxable: number;
  taxOnIncome: number; rebate87A: number; cess: number; surcharge: number; netTax: number; newRegime: boolean | null;
  quarters: { quarter: string; credit: number; deducted: number; deposited: number }[]; tdsTotal: number;
};

const pick = (o: unknown, ...keys: string[]): unknown => { let cur = o as Record<string, unknown> | undefined; for (const k of keys) cur = cur?.[k] as Record<string, unknown> | undefined; return cur; };
/** Sums nested numbers (e.g. gross_salary with 17(1), 17(2), 17(3) parts) when a field is an object. */
const total = (v: unknown): number => v == null ? 0 : typeof v === "object" ? Object.entries(v as Record<string, unknown>).reduce((s, [k, x]) => /total/i.test(k) ? s : s + total(x), 0) : n(v);
const own = (v: unknown): number => { if (v == null) return 0; if (typeof v !== "object") return n(v); const o = v as Record<string, unknown>; const t = Object.keys(o).find(k => /total/i.test(k)); return t ? n(o[t]) : total(v); };

export function summarizeForm16(body: unknown): SummaryForm16 {
  const d = ((body as { data?: unknown })?.data ?? body) as Record<string, unknown>;
  const A = (d["Part A"] ?? {}) as Record<string, unknown>, B = (d["Part B"] ?? {}) as Record<string, unknown>;
  const sal = (B.details_of_salary_paid ?? {}) as Record<string, unknown>;
  const tdsRows = ((A.tds ?? []) as Record<string, unknown>[]).filter(r => /^q\d/i.test(String(r.quarter ?? "")));
  const quarters = tdsRows.map(r => ({ quarter: String(r.quarter), credit: r2(n(r.credit_amount)), deducted: r2(n(r.tax_deducted)), deposited: r2(n(r.tax_deposited)) }));
  const emp = (A.employer ?? B.employer ?? {}) as Record<string, unknown>, ee = (A.employee ?? B.employee ?? {}) as Record<string, unknown>;
  const opt = sal.opting_out_of_taxation_us_115_bac;
  return {
    ay: String(A.assessment_year ?? B.assessment_year ?? ""),
    employer: { name: String(emp.name ?? ""), tan: String(emp.tan ?? ""), pan: String(emp.pan ?? "") },
    employeePan: String(ee.pan ?? ""), employeeName: [ee.first_name, ee.middle_name, ee.last_name].filter(Boolean).join(" "),
    gross: r2(own(sal.gross_salary)), standardDeduction: r2(n(pick(sal, "deduction_us_16", "standard_deduction_us_16_ia"))),
    deductions16: r2(n(sal.total_amount_of_deductions_us_16)), chapterVIA: r2(own(sal.deduction_under_chapter_vi_a)),
    salaryIncome: r2(n(sal.income_chargeable_under_the_head_salaries)), taxable: r2(n(sal.total_taxable_income)),
    taxOnIncome: r2(n(sal.tax_on_total_income)), rebate87A: r2(n(sal.rebate_us_87_a)), cess: r2(n(sal.health_and_eduction_cess)), surcharge: r2(n(sal.surcharge)),
    netTax: r2(n(sal.net_tax_payable ?? sal.tax_payable)),
    newRegime: opt == null ? null : /^n|no|false/i.test(String(opt)) ? true : /^y|yes|true/i.test(String(opt)) ? false : null,
    quarters, tdsTotal: r2(quarters.reduce((s, q) => s + q.deducted, 0)),
  };
}

/** Compares 26AS TDS with TDS recorded in the books for the same year. */
export function compareTds(s: Summary26AS, booksTds: number) {
  const diff = r2(s.totals.tds - booksTds);
  return { inForm: s.totals.tds, inBooks: r2(booksTds), diff,
    verdict: Math.abs(diff) <= 1 ? "match" as const : diff > 0 ? "missing_in_books" as const : "more_in_books" as const };
}
