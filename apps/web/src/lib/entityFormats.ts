// Financial statements in the ICAI format for the kind of entity: Company (Schedule III), LLP, Non-Corporate Entity
// (proprietorship, partnership, HUF…) and Not-for-Profit Organisation. The figures are the Schedule III ones — only the
// headings, the grouping of a few lines and the wording change, so every format foots to the same totals.
import type { Schedule3BS, Schedule3PL, S3Head, S3Block } from "./schedule3";
import type { Cell, ExportMeta } from "./statementExport";

export type EntityFormat = "company" | "llp" | "nce" | "npo";
export const FORMATS: { key: EntityFormat; label: string; hint: string }[] = [
  { key: "company", label: "Company — Schedule III", hint: "Private / public limited, OPC" },
  { key: "llp", label: "LLP", hint: "ICAI format for Limited Liability Partnerships" },
  { key: "nce", label: "Non-corporate entity", hint: "ICAI format for proprietorships, partnerships, HUFs, AOPs" },
  { key: "npo", label: "Not-for-profit (NPO)", hint: "ICAI format: Income & Expenditure, sources and application of funds" },
];
export function formatForBusinessType(t: string | null | undefined): EntityFormat {
  const s = String(t ?? "").toLowerCase();
  if (s === "llp") return "llp";
  if (/proprietor|partnership|huf|aop|bo[il]/.test(s)) return "nce";
  if (/trust|society|npo|section.?8|charit/.test(s)) return "npo";
  return "company";
}
export const formatTitles = (f: EntityFormat) => ({
  entity: f === "llp" ? "Limited Liability Partnership" : f === "nce" ? "Non-Corporate Entity" : f === "npo" ? "NPO" : "Company",
  bs: "Balance Sheet",
  pl: f === "npo" ? "Income and Expenditure Account" : "Statement of Profit and Loss",
  short: f === "company" ? "Schedule III" : f === "llp" ? "ICAI format for LLPs" : f === "nce" ? "ICAI format for non-corporate entities" : "ICAI format for NPOs",
  result: (n: number) => f === "npo" ? (n >= 0 ? "Surplus" : "Deficit") : (n >= 0 ? "Profit" : "Loss"),
});

const r2 = (n: number) => Math.round(n * 100) / 100;
const relabelHead = (h: S3Head, f: EntityFormat): S3Head => {
  const L: Record<string, Partial<Record<EntityFormat, string>>> = {
    capital: { company: "Share capital", llp: "Partners' Capital Account", nce: "Owners' Capital Account", npo: "NPO Funds" },
    trade_payables: { npo: "Payables" },
    trade_receivables: { npo: "Receivables" },
    cash: { llp: "Cash and bank balances", nce: "Cash and bank balances", npo: "Cash and bank balances" },
    ppe: { company: "Property, plant and equipment", llp: "Property, Plant and Equipment", nce: "Property, Plant and Equipment", npo: "Property, Plant and Equipment" },
  };
  return { ...h, label: L[h.key]?.[f] ?? h.label };
};
const blockLabel = (b: S3Block, f: EntityFormat) => b.key === "equity" ? (f === "company" ? "Shareholders' funds" : f === "llp" ? "Partners' Funds" : f === "nce" ? "Owners' Funds" : "NPO Funds") : b.label;

/** Balance Sheet in the chosen format. LLP capital is split into partners' contribution and current accounts. */
export function formatBS(s: Schedule3BS, f: EntityFormat): Schedule3BS & { sides: [string, string] } {
  const blocks = (bs: S3Block[]) => bs.map(b => ({ ...b, label: blockLabel(b, f), heads: b.heads.map(h => relabelHead(h, f)) }));
  return { ...s, equityLiabilities: blocks(s.equityLiabilities), assets: blocks(s.assets), sides: f === "npo" ? ["Sources of funds", "Application of funds"] : ["Equity and liabilities", "Assets"] };
}
/** LLP capital lines: contribution vs current account (by ledger name). */
export function llpCapitalSplit(h: S3Head) {
  const current = h.lines.filter(l => /current\s*a\/?c|current account|drawings?/i.test(l.name));
  const contribution = h.lines.filter(l => !current.includes(l));
  return { contribution: r2(contribution.reduce((a, l) => a + l.amount, 0)), current: r2(current.reduce((a, l) => a + l.amount, 0)) };
}

export type FormattedPL = Schedule3PL & { partners: S3Head | null; beforePartners: number };
const PARTNER = /\b(partners?'?s?|partner)\b.*\b(remuneration|salary|salaries|interest|commission)\b|\b(remuneration|salary|interest)\b.*\bpartners?\b/i;
const DONATION_PAID = /\b(donations?|contributions?|grants?)\s*(paid|given|disbursed)|\bcharit(y|able)\b|\breligious\b|\bscholarships?\b/i;

/** Statement of Profit and Loss / Income and Expenditure in the chosen format. */
export function formatPL(s: Schedule3PL, f: EntityFormat): FormattedPL {
  const take = (re: RegExp, from: S3Head[]) => {
    const out: S3Head["lines"] = []; const rest: S3Head[] = [];
    for (const h of from) {
      const hit = h.lines.filter(l => re.test(l.name));
      const keep = h.lines.filter(l => !re.test(l.name));
      out.push(...hit);
      if (keep.length) rest.push({ ...h, lines: keep, total: r2(keep.reduce((a, l) => a + l.amount, 0)) });
    }
    return { out, rest };
  };
  let expenses = s.expenses;
  // LLP / non-corporate: partners' remuneration and interest come below the profit before them
  let partners: S3Head | null = null;
  if (f === "llp" || f === "nce") {
    const { out, rest } = take(PARTNER, expenses);
    if (out.length) { partners = { key: "partners", label: "Partners' remuneration and interest", note: 0, lines: out, total: r2(out.reduce((a, l) => a + l.amount, 0)) }; expenses = rest; }
    // Purchases and the change in stock read as one cost of goods sold
    const cogs = expenses.filter(h => h.key === "purchases" || h.key === "inventory_change");
    if (cogs.length) {
      const lines = cogs.flatMap(h => h.lines);
      expenses = [{ key: "cogs", label: "Cost of goods sold", note: cogs[0].note, lines, total: r2(lines.reduce((a, l) => a + l.amount, 0)) }, ...expenses.filter(h => !cogs.includes(h))];
    }
  }
  if (f === "npo") {
    const { out, rest } = take(DONATION_PAID, expenses);
    expenses = rest.map(h => h.key === "purchases" ? { ...h, label: "Material consumed / distributed" } : h);
    if (out.length) expenses.splice(1, 0, { key: "donations_paid", label: "Donations / contributions paid", note: 0, lines: out, total: r2(out.reduce((a, l) => a + l.amount, 0)) });
  }
  // Notes renumbered in the order they now appear
  let n = 0;
  const num = (h: S3Head | null) => h ? { ...h, note: ++n } : null;
  const revenue = num(s.revenue ? { ...s.revenue, label: f === "npo" ? "Income — donations, grants, fees and sales" : s.revenue.label } : null);
  const otherIncome = num(s.otherIncome);
  expenses = expenses.map(h => num(h)!);
  partners = num(partners);
  const tax = num(s.tax);
  const totalExpenses = r2(expenses.reduce((a, h) => a + h.total, 0));
  const beforePartners = r2(s.totalIncome - totalExpenses);
  const pbt = r2(beforePartners - (partners?.total ?? 0));
  return { ...s, revenue, otherIncome, expenses, totalExpenses, partners, beforePartners, pbt, tax, profit: r2(pbt - (tax?.total ?? 0)) };
}

// ── Excel rows in the ICAI layout ──
const letter = (i: number) => `(${String.fromCharCode(97 + i)})`;
const head = (f: EntityFormat, title: string, m: ExportMeta): Cell[][] => [[`Name of the ${formatTitles(f).entity}: ${m.business}`], [`${title} — ${m.period}`], ["(Amount in ₹)"], [], ["Particulars", "Note", "Amount (₹)"]];

export function bsRowsFor(s: Schedule3BS, f: EntityFormat, m: ExportMeta): Cell[][] {
  const b = formatBS(s, f), t = formatTitles(f);
  const out = head(f, `${t.bs} as at the end of the period`, m);
  const part = (roman: string, title: string, blocks: S3Block[], total: number) => {
    out.push([`${roman}  ${title.toUpperCase()}`, null, null]);
    blocks.forEach((bl, bi) => {
      out.push([`  ${bi + 1}  ${bl.label}`, null, null]);
      bl.heads.forEach((h, hi) => {
        out.push([`      ${letter(hi)} ${h.label}`, h.note, h.total]);
        if (f === "llp" && h.key === "capital") { const sp = llpCapitalSplit(h); out.push(["          (i) Partners' Contribution", h.note + "a", sp.contribution], ["          (ii) Partners' Current Account", h.note + "b", sp.current]); }
      });
    });
    out.push(["Total", null, total], []);
  };
  part("I", b.sides[0], b.equityLiabilities, b.totalEL);
  part("II", b.sides[1], b.assets, b.totalAssets);
  out.push(["Brief about the entity", 1, null], ["Summary of significant accounting policies", 2, null], ["The accompanying notes are an integral part of the financial statements"]);
  return out;
}

export function plRowsFor(s: Schedule3PL, f: EntityFormat, m: ExportMeta): Cell[][] {
  const p = formatPL(s, f), t = formatTitles(f);
  const out = head(f, `${t.pl} for the period`, m);
  if (p.revenue) out.push([`I   ${p.revenue.label}`, p.revenue.note, p.revenue.total]);
  if (p.otherIncome) out.push([`II  ${p.otherIncome.label}`, p.otherIncome.note, p.otherIncome.total]);
  out.push(["III Total income (I + II)", null, p.totalIncome], [], ["IV  Expenses", null, null]);
  p.expenses.forEach((h, i) => out.push([`      ${letter(i)} ${h.label}`, h.note, h.total]));
  out.push(["      Total expenses", null, p.totalExpenses], []);
  if (f === "llp" || f === "nce") {
    out.push([`V   ${t.result(p.beforePartners)} before partners' remuneration and tax (III − IV)`, null, p.beforePartners]);
    out.push(["VI  Partners' remuneration and interest", p.partners?.note ?? null, p.partners?.total ?? 0]);
    out.push([`VII ${t.result(p.pbt)} before tax (V − VI)`, null, p.pbt]);
    out.push(["VIII Tax expense", p.tax?.note ?? null, p.tax?.total ?? 0]);
    out.push([`IX  ${t.result(p.profit)} for the year (VII − VIII)`, null, p.profit]);
  } else {
    out.push([`V   ${t.result(p.pbt)} before tax (III − IV)`, null, p.pbt]);
    if (f !== "npo" || p.tax) out.push(["VI  Tax expense", p.tax?.note ?? null, p.tax?.total ?? 0]);
    out.push([`${f !== "npo" || p.tax ? "VII" : "VI"}  ${f === "npo" ? `Excess of income over expenditure — ${t.result(p.profit).toLowerCase()} for the year` : `${t.result(p.profit)} for the year`}`, null, p.profit]);
  }
  out.push([], ["The accompanying notes are an integral part of the financial statements"]);
  return out;
}

/** Notes in the format's numbering and labels. */
export function notesRowsFor(bs: Schedule3BS | undefined, pl: Schedule3PL | undefined, f: EntityFormat, m: ExportMeta): Cell[][] {
  const out: Cell[][] = [[`Name of the ${formatTitles(f).entity}: ${m.business}`], [`Notes to the financial statements — ${m.period}`], [], ["Particulars", "", "Amount (₹)"]];
  const note = (prefix: string, h: S3Head) => {
    out.push([`${prefix} Note ${h.note}: ${h.label}`, null, null]);
    for (const l of h.lines) out.push([`    ${l.name}${l.note ? ` (${l.note})` : ""}`, null, l.amount]);
    out.push(["    Total", null, h.total], []);
  };
  if (bs) { const b = formatBS(bs, f); out.push([formatTitles(f).bs.toUpperCase()]); for (const bl of [...b.equityLiabilities, ...b.assets]) bl.heads.forEach(h => note("", h)); }
  if (pl) { const p = formatPL(pl, f); out.push([formatTitles(f).pl.toUpperCase()]); [p.revenue, p.otherIncome, ...p.expenses, p.partners, p.tax].forEach(h => h && note("", h)); }
  return out;
}
