// Quarterly TDS return (non-salary, residents) from the books — Form 140 under the Income-tax Act, 2025 / Rules 2026
// (26Q until FY 2025-26). Deductions are credits to a TDS Payable ledger; deposits (challans) are its debits.
// The nature of payment comes from the expense ledger debited in the same entry. Pure — no database.
export type TdsJournal = { id: string; entry_no: string; date: string; party_name: string | null; narration?: string | null; metadata?: Record<string, unknown> | null; lines: { account: string; dr: number; cr: number }[] };
export type Nature = { key: string; label: string; ref: string; old: string; code: string };
export type Deduction = { journalId: string; entryNo: string; date: string; party: string; pan: string | null; nature: Nature; paid: number; tds: number; rate: number };
export type Challan = { journalId: string; entryNo: string; date: string; amount: number };
export type TdsIssue = { level: "error" | "warn"; text: string };
export type TdsQuarter = { form: string; quarter: string; from: string; to: string; deductions: Deduction[]; challans: Challan[]; bySection: { nature: Nature; count: number; paid: number; tds: number }[]; totalTds: number; deposited: number; issues: TdsIssue[] };

// Natures of payment: new reference (2025 Act), old section, and the payment code where published (others to be filled in the return utility)
const NATURES: (Nature & { re: RegExp })[] = [
  { key: "rent_building", label: "Rent — land, building, furniture", ref: "393(1) rent", old: "194-I(b)", code: "1009", re: /\brent\b(?!.*(machin|plant|equip|vehicle))/i },
  { key: "rent_plant", label: "Rent — plant, machinery, equipment", ref: "393(1) rent", old: "194-I(a)", code: "1008", re: /\b(hire|rent)\b.*(machin|plant|equip|vehicle)|(machin|equip).*\b(hire|rent)\b/i },
  { key: "professional", label: "Professional fees", ref: "393(1) professional", old: "194J", code: "1027", re: /profession|consult|legal|audit fee|ca fee|retainer|director/i },
  { key: "technical", label: "Technical services", ref: "393(1) technical", old: "194J", code: "1026", re: /technical|call cent|software service|it service/i },
  { key: "contract", label: "Contractor / sub-contractor", ref: "393(1) contractor", old: "194C", code: "", re: /contract|labou?r|job ?work|freight|transport|carriage|advertis|catering|repair|maintenance|printing/i },
  { key: "commission", label: "Commission / brokerage", ref: "393(1) commission", old: "194H", code: "", re: /commission|brokerage/i },
  { key: "interest", label: "Interest (other than securities)", ref: "393(1) interest", old: "194A", code: "", re: /interest/i },
  { key: "purchase", label: "Purchase of goods", ref: "393(1) purchase of goods", old: "194Q", code: "", re: /purchase/i },
];
const OTHER: Nature = { key: "other", label: "Other — choose the section", ref: "393", old: "—", code: "" };
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const r2 = (n: number) => Math.round(n * 100) / 100;
const isTds = (a: string) => /\btds\b/i.test(a) && /payable/i.test(a);
const isBankOrCash = (a: string) => /bank|cash|\bhdfc|\bsbi|\bicici|\baxis|\bkotak|\bidfc|federal|upi/i.test(a);

/** "2026-Q2" → July–September 2026 (Indian quarters: Q1 Apr–Jun … Q4 Jan–Mar of the next calendar year). */
export function quarterRange(q: string): { from: string; to: string; fy: string } | null {
  const m = q.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  const fyStart = Number(m[1]), n = Number(m[2]);
  const startMonth = [4, 7, 10, 1][n - 1], year = n === 4 ? fyStart + 1 : fyStart;
  const end = new Date(Date.UTC(year, startMonth + 2, 0)).toISOString().slice(0, 10);
  return { from: `${year}-${String(startMonth).padStart(2, "0")}-01`, to: end, fy: `${fyStart}-${String(fyStart + 1).slice(2)}` };
}

export function natureOf(expenseLedgers: string[], stated?: string | null): Nature {
  const hay = `${stated ?? ""} ${expenseLedgers.join(" ")}`;
  return NATURES.find(n => n.re.test(hay)) ?? OTHER;
}

export function buildTdsQuarter(quarter: string, journals: TdsJournal[], panOf: (party: string) => string | null): TdsQuarter | null {
  const range = quarterRange(quarter);
  if (!range) return null;
  const inQ = journals.filter(j => j.date >= range.from && j.date <= range.to);
  const deductions: Deduction[] = [], challans: Challan[] = [];
  for (const j of inQ) {
    const tdsCr = r2(j.lines.filter(l => isTds(l.account)).reduce((s, l) => s + l.cr, 0));
    const tdsDr = r2(j.lines.filter(l => isTds(l.account)).reduce((s, l) => s + l.dr, 0));
    if (tdsDr > 0 && j.lines.some(l => isBankOrCash(l.account) && l.cr > 0)) challans.push({ journalId: j.id, entryNo: j.entry_no, date: j.date, amount: tdsDr });
    if (tdsCr <= 0) continue;
    // The payment: expense / asset debits in the same entry (gross, before GST)
    const exp = j.lines.filter(l => l.dr > 0 && !isTds(l.account) && !/gst|igst|cgst|sgst/i.test(l.account) && !isBankOrCash(l.account));
    const paid = r2(exp.reduce((s, l) => s + l.dr, 0));
    const stated = (j.metadata?.tds as { section?: string } | undefined)?.section ?? null;
    const party = j.party_name?.trim() || j.lines.find(l => l.cr > 0 && !isTds(l.account) && !isBankOrCash(l.account))?.account || "Unknown party";
    deductions.push({ journalId: j.id, entryNo: j.entry_no, date: j.date, party, pan: panOf(party), nature: natureOf(exp.map(l => l.account), stated), paid, tds: tdsCr, rate: paid > 0 ? r2(tdsCr / paid * 100) : 0 });
  }
  const by = new Map<string, { nature: Nature; count: number; paid: number; tds: number }>();
  for (const d of deductions) { const g = by.get(d.nature.key) ?? { nature: d.nature, count: 0, paid: 0, tds: 0 }; g.count++; g.paid = r2(g.paid + d.paid); g.tds = r2(g.tds + d.tds); by.set(d.nature.key, g); }
  const totalTds = r2(deductions.reduce((s, d) => s + d.tds, 0)), deposited = r2(challans.reduce((s, c) => s + c.amount, 0));

  const issues: TdsIssue[] = [];
  const noPan = [...new Set(deductions.filter(d => !d.pan).map(d => d.party))];
  const badPan = [...new Set(deductions.filter(d => d.pan && !PAN_RE.test(d.pan)).map(d => d.party))];
  if (noPan.length) issues.push({ level: "error", text: `PAN missing for ${noPan.length} deductee${noPan.length > 1 ? "s" : ""} (${noPan.slice(0, 4).join(", ")}${noPan.length > 4 ? "…" : ""}) — add it in Customers & Suppliers. Without a PAN, TDS is due at the higher rate.` });
  if (badPan.length) issues.push({ level: "error", text: `PAN looks wrong for ${badPan.join(", ")}.` });
  const other = deductions.filter(d => d.nature.key === "other").length;
  if (other) issues.push({ level: "warn", text: `${other} deduction${other > 1 ? "s" : ""} couldn't be matched to a nature of payment — choose the section in the return utility.` });
  if (r2(totalTds - deposited) > 1) issues.push({ level: "warn", text: `TDS deducted ${totalTds.toLocaleString("en-IN")} but deposited ${deposited.toLocaleString("en-IN")} in this quarter — pay the balance by challan (interest runs from the due date). Deposits for March are due by 30 April.` });
  if (deductions.some(d => !d.nature.code)) issues.push({ level: "warn", text: "Some payment codes aren't filled in — pick them in the return utility." });
  return { form: range.from >= "2026-04-01" ? "Form 140" : "Form 26Q", quarter, from: range.from, to: range.to, deductions, challans, bySection: [...by.values()], totalTds, deposited, issues };
}
