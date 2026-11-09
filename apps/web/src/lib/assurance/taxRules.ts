// Tax-rule registry for the GST & TDS risk scanner. Rules are data, not prompt text: each carries its provision,
// effective dates, thresholds, source and version. The built-in set below is the starting point; rows in
// fw_fin_tax_rules (same rule_id, higher version, or a business-specific override) replace them.
//
// Nothing here concludes that tax is due. A rule says "this pattern needs a look" — where the answer depends on
// facts FreBook doesn't hold (the payee's PAN status, a lower-deduction certificate, the nature of goods), the
// finding is "requires_review". `verifiedOn: null` means nobody has checked the rule against the current law yet,
// and the screen says so.

export type TaxArea = "gst" | "tds" | "income_tax";
export type TaxRule = {
  ruleId: string;              // stable id, e.g. "IT.CASH_EXPENSE"
  area: TaxArea;
  title: string;
  provision: string;           // the statutory reference as stated by the source
  effectiveFrom: string;       // YYYY-MM-DD
  effectiveTo: string | null;
  fy: string | null;           // "2026-27" when the rule is year-specific
  conditions: string;          // plain words: when the rule applies
  thresholds: Record<string, number>;
  exceptions: string;          // plain words: when it doesn't
  source: string;              // where the rule comes from
  version: number;
  verifiedOn: string | null;   // last date someone checked it against the law
  keywords?: string;           // regex source for ledger names, where the rule is about a kind of expense
  rates?: Record<string, number>;
  businessId?: string | null;  // a business's own override
};

// Thresholds below are the ones FreBook already applies elsewhere (lib/audit360.ts, lib/reviewChecks.ts).
// From 1 April 2026 the Income-tax Act, 2025 replaced the 1961 Act; provisions are named as FreBook already names them.
const FY26 = "2026-04-01";
export const BUILTIN_TAX_RULES: TaxRule[] = [
  { ruleId: "IT.CASH_EXPENSE", area: "income_tax", title: "Cash expense above the limit", provision: "Income-tax Act, 1961 s.40A(3) (carried into the Income-tax Act, 2025)", effectiveFrom: "2017-04-01", effectiveTo: null, fy: null,
    conditions: "An expense paid in cash to one person in one day above the limit", thresholds: { single_day: 10000, transporter_single_day: 35000 },
    exceptions: "Payments covered by the prescribed exceptions (e.g. to banks, government, in villages without bank) — needs review", source: "FreBook audit360 cash checks", version: 1, verifiedOn: null },
  { ruleId: "IT.CASH_RECEIPT", area: "income_tax", title: "Cash received of ₹2 lakh or more", provision: "Income-tax Act, 1961 s.269ST (carried into the Income-tax Act, 2025)", effectiveFrom: "2017-04-01", effectiveTo: null, fy: null,
    conditions: "Cash of the limit or more received from one person in a day, for one transaction or one event", thresholds: { amount: 200000 },
    exceptions: "Receipts by government, banks and other notified cases", source: "FreBook audit360 cash checks", version: 1, verifiedOn: null },
  { ruleId: "IT.CASH_LOAN", area: "income_tax", title: "Loan or deposit taken or repaid in cash", provision: "Income-tax Act, 1961 s.269SS / s.269T (carried into the Income-tax Act, 2025)", effectiveFrom: "2015-06-01", effectiveTo: null, fy: null,
    conditions: "A loan, deposit or specified sum of the limit or more taken or repaid otherwise than through a bank", thresholds: { amount: 20000 },
    exceptions: "Loans from/to government, banks and certain notified entities", source: "FreBook audit360 cash checks", version: 1, verifiedOn: null },
  { ruleId: "TDS.RENT", area: "tds", title: "Rent — TDS may apply", provision: "Income-tax Act, 2025 s.393(1) Table Sl. 2 (was s.194-I)", effectiveFrom: FY26, effectiveTo: null, fy: null,
    conditions: "Rent for land, building, furniture, plant or machinery above the limit", thresholds: { monthly: 50000 }, rates: { building: 10, plant: 2 }, keywords: "\\brent\\b|lease",
    exceptions: "Payee with a nil/lower deduction certificate; individuals/HUF not liable to audit (covered by another table entry)", source: "FreBook reviewChecks TDS table", version: 1, verifiedOn: null },
  { ruleId: "TDS.PROFESSIONAL", area: "tds", title: "Professional or technical fees — TDS may apply", provision: "Income-tax Act, 2025 s.393(1) Table Sl. 6(iii) (was s.194J)", effectiveFrom: FY26, effectiveTo: null, fy: null,
    conditions: "Fees for professional or technical services above the yearly limit", thresholds: { yearly: 50000 }, rates: { professional: 10, technical: 2 }, keywords: "professional|consult|legal|audit fee|technical|retainer|architect|doctor",
    exceptions: "Payee with a nil/lower deduction certificate; personal payments", source: "FreBook reviewChecks TDS table", version: 1, verifiedOn: null },
  { ruleId: "TDS.CONTRACT", area: "tds", title: "Contract payments — TDS may apply", provision: "Income-tax Act, 2025 s.393(1) Table Sl. 6(i) (was s.194C)", effectiveFrom: FY26, effectiveTo: null, fy: null,
    conditions: "A single contract payment or the year's total above the limits", thresholds: { single: 30000, yearly: 100000 }, rates: { individual_huf: 1, others: 2 }, keywords: "contract|job work|labour|labor|freight|transport|printing|advertis|catering|sub-?contract",
    exceptions: "Transporters owning 10 or fewer goods carriages who give PAN and a declaration", source: "FreBook reviewChecks TDS table", version: 1, verifiedOn: null },
  { ruleId: "TDS.COMMISSION", area: "tds", title: "Commission or brokerage — TDS may apply", provision: "Income-tax Act, 2025 s.393(1) Table Sl. 1(ii) (was s.194H)", effectiveFrom: FY26, effectiveTo: null, fy: null,
    conditions: "Commission or brokerage above the yearly limit", thresholds: { yearly: 20000 }, rates: { commission: 2 }, keywords: "commission|brokerage",
    exceptions: "Insurance commission (separate entry)", source: "FreBook reviewChecks TDS table", version: 1, verifiedOn: null },
  { ruleId: "GST.MISSING_TAX", area: "gst", title: "Sale or purchase with no GST line", provision: "CGST Act, 2017 — tax on taxable supplies", effectiveFrom: "2017-07-01", effectiveTo: null, fy: null,
    conditions: "A registered business records a sale or purchase with no GST ledger", thresholds: {}, exceptions: "Exempt, nil-rated or non-GST supplies; unregistered suppliers", source: "FreBook journal rules", version: 1, verifiedOn: null },
  { ruleId: "GST.PLACE_OF_SUPPLY", area: "gst", title: "IGST vs CGST/SGST doesn't fit the party's state", provision: "IGST Act, 2017 s.10–12 (place of supply)", effectiveFrom: "2017-07-01", effectiveTo: null, fy: null,
    conditions: "Party GSTIN state equals the business state but IGST was charged, or differs but CGST/SGST was charged", thresholds: {}, exceptions: "Place of supply differs from the party's registered state (e.g. delivery elsewhere, services on immovable property)", source: "GSTIN state code", version: 1, verifiedOn: null },
  { ruleId: "GST.MISSING_GSTIN", area: "gst", title: "Input GST claimed from a party with no GSTIN", provision: "CGST Act, 2017 s.16 (conditions for ITC)", effectiveFrom: "2017-07-01", effectiveTo: null, fy: null,
    conditions: "A purchase carries input GST but the supplier has no GSTIN on record", thresholds: {}, exceptions: "GSTIN recorded on the invoice but not in FreBook", source: "FreBook contacts", version: 1, verifiedOn: null },
  { ruleId: "GST.BLOCKED_ITC", area: "gst", title: "Input GST on a head that is usually blocked", provision: "CGST Act, 2017 s.17(5)", effectiveFrom: "2017-07-01", effectiveTo: null, fy: null,
    conditions: "Input GST on food, catering, club membership, motor vehicles, personal use, gifts and similar", thresholds: {}, keywords: "food|meal|catering|canteen|club|gym|motor car|vehicle|beauty|gift|personal|staff welfare|travel benefit",
    exceptions: "Supplies used for the same line of business, or where the law requires providing them to employees", source: "CGST Act s.17(5)", version: 1, verifiedOn: null },
  { ruleId: "GST.RCM", area: "gst", title: "Expense that may attract reverse charge", provision: "CGST Act, 2017 s.9(3)/9(4); notified services", effectiveFrom: "2017-07-01", effectiveTo: null, fy: null,
    conditions: "Legal fees from an advocate, goods transport agency, sponsorship, director's fees, rent from an unregistered landlord — with no RCM entry", thresholds: {}, keywords: "advocate|legal|lawyer|goods transport|gta|lorry|sponsorship|director'?s? (fee|sitting)|security service",
    exceptions: "Supplier charges GST under forward charge where allowed; business not registered", source: "Notification 13/2017-CT(R) as amended", version: 1, verifiedOn: null },
  { ruleId: "GST.OUTPUT_RATIO", area: "gst", title: "Output GST doesn't fit sales", provision: "CGST Act, 2017 — rate schedules", effectiveFrom: "2017-07-01", effectiveTo: null, fy: null,
    conditions: "Output GST for a month is more than the highest rate on sales, or nil on large sales", thresholds: { max_rate_pct: 28 }, exceptions: "Exempt/export sales; cess", source: "FreBook GST summary", version: 1, verifiedOn: null },
  { ruleId: "GST.EINVOICE", area: "gst", title: "E-invoicing may apply", provision: "CGST Rules, 2017 r.48(4); notified turnover limit", effectiveFrom: "2023-08-01", effectiveTo: null, fy: null,
    conditions: "Aggregate turnover in any year from 2017-18 above the notified limit and B2B invoices without an IRN", thresholds: { turnover: 50000000 }, exceptions: "Exempt classes (banks, insurers, GTA, passenger transport, SEZ units, cinema)", source: "Notification 10/2023-CT", version: 1, verifiedOn: null },
  { ruleId: "GST.EWAY", area: "gst", title: "E-way bill may be needed", provision: "CGST Rules, 2017 r.138", effectiveFrom: "2018-04-01", effectiveTo: null, fy: null,
    conditions: "Movement of goods with a consignment value above the limit", thresholds: { consignment: 50000 }, exceptions: "Services; exempt goods; non-motorised conveyance; state-specific limits for intra-state movement", source: "CGST Rules r.138", version: 1, verifiedOn: null },
];

/** The rule in force on a date: a business override wins, then the highest version whose dates cover the day. */
export function ruleOn(rules: TaxRule[], ruleId: string, date: string, businessId?: string | null): TaxRule | null {
  const live = rules.filter(r => r.ruleId === ruleId && r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date));
  const pick = (xs: TaxRule[]) => xs.sort((a, b) => b.version - a.version)[0] ?? null;
  return pick(live.filter(r => businessId && r.businessId === businessId)) ?? pick(live.filter(r => !r.businessId));
}

/** Built-in rules merged with database rows (rows are added; ruleOn picks the right one per date). */
export function mergeRules(rows: TaxRule[]): TaxRule[] {
  const seen = new Set(rows.map(r => `${r.ruleId}|${r.version}|${r.businessId ?? ""}`));
  return [...rows, ...BUILTIN_TAX_RULES.filter(r => !seen.has(`${r.ruleId}|${r.version}|`))];
}

export type TaxRuleRow = {
  rule_id: string; area: TaxArea; title: string; provision: string; effective_from: string; effective_to: string | null; fy: string | null;
  conditions: string; thresholds: Record<string, number> | null; exceptions: string | null; source: string; version: number; verified_on: string | null;
  keywords: string | null; rates: Record<string, number> | null; business_id: string | null;
};
export const ruleFromRow = (r: TaxRuleRow): TaxRule => ({
  ruleId: r.rule_id, area: r.area, title: r.title, provision: r.provision, effectiveFrom: r.effective_from, effectiveTo: r.effective_to, fy: r.fy,
  conditions: r.conditions, thresholds: r.thresholds ?? {}, exceptions: r.exceptions ?? "", source: r.source, version: r.version, verifiedOn: r.verified_on,
  keywords: r.keywords ?? undefined, rates: r.rates ?? undefined, businessId: r.business_id,
});
