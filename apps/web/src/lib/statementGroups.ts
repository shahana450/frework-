// Groups bank-statement rows by who/what they're for, so a whole group can be posted to one ledger.
// Pure — no database access.

export type StmtRow = { id: string; date: string; description: string; debit: number; credit: number; ledger?: string; aiLedger?: string; confidence?: number };
export type StmtGroup = {
  key: string; label: string; dir: "out" | "in";
  rowIds: string[]; count: number; total: number;
  suggested: string; source: "history" | "rule" | "ai" | "none"; reason: string;
};

const STOP = new Set(["UPI", "DR", "CR", "NEFT", "IMPS", "RTGS", "P2A", "P2M", "MB", "IB", "NET", "TRF", "TRANSFER", "TO", "BY", "FROM", "THE", "AND", "OF", "INB", "MMT", "REF", "NO", "TXN", "PAYMENT", "PAY", "BANK", "LTD", "PVT", "LIMITED", "INDIA", "YES", "OK", "NA", "ACH", "ECS", "NACH", "POS", "CHQ", "CHEQUE", "CLG", "BIL", "BILLPAY", "ONL", "ONLINE", "SBIN", "HDFC", "ICIC", "UTIB", "KKBK", "PUNB", "BARB", "IDIB", "CNRB", "FDRL", "IOBA", "UBIN", "YESB", "INDB", "PYTM", "AXIS", "ICICI", "SBI", "KOTAK", "PAYTM", "OKAXIS", "OKSBI", "OKICICI", "OKHDFCBANK", "YBL", "IBL", "APL", "AXL", "PTYES", "PTSBI", "PTAXIS", "WAICICI", "IKWIK"]);

// Purpose rules: [pattern, group label, ledger when money goes out, ledger when money comes in]
const RULES: [RegExp, string, string | null, string | null][] = [
  [/\b(CHRG|CHGS?|CHARGES?|SMS ?ALERT|MIN ?BAL|AMC|DEBIT ?CARD ?FEE|GST ON|SERVICE ?CHARGE|CONSOLIDATED CHARGES)\b/, "Bank charges", "Bank Charges", "Bank Charges"],
  [/\b(INT\.?|INTEREST|INT ?PD|INT ?COLL|SB ?INT|FD ?INT)\b/, "Interest", "Interest Paid", "Interest Received"],
  [/\b(ATM|CASH ?WDL|CWDR|CASH ?WITHDRAWAL|SELF)\b/, "Cash withdrawal", "Cash in Hand", null],
  [/\b(CASH ?DEP|CASH ?DEPOSIT|BY ?CASH|CDM)\b/, "Cash deposit", null, "Cash in Hand"],
  [/\b(SALARY|SAL ?FOR|PAYROLL|WAGES)\b/, "Salary", "Salary & Wages", "Salary Received"],
  [/\b(GST ?PMT|GSTN|GST ?PAYMENT|CGST|SGST|IGST)\b/, "GST payment", "GST Payable", null],
  [/\b(CBDT|TDS|ADVANCE ?TAX|INCOME ?TAX|OLTAS|ITNS)\b/, "Income tax / TDS", "TDS Payable", "TDS Receivable"],
  [/\b(EPF|EPFO|ESIC|ESI ?CONTRIB|PROVIDENT)\b/, "PF / ESI", "PF & ESI Payable", null],
  [/\b(EMI|LOAN ?REPAY|LOAN ?EMI)\b/, "Loan EMI", "Loan Account", null],
  [/\b(ELECTRICITY|KSEB|BESCOM|MSEDCL|TNEB|TANGEDCO|POWER BILL)\b/, "Electricity", "Electricity Charges", null],
  [/\b(AIRTEL|JIO|VODAFONE|VI ?POSTPAID|BSNL|BROADBAND|ACT ?FIBERNET)\b/, "Phone & internet", "Telephone & Internet", null],
  [/\b(RENT)\b/, "Rent", "Rent", "Rent Received"],
  [/\b(SWIGGY|ZOMATO|RESTAURANT|HOTEL|CAFE)\b/, "Food & refreshments", "Staff Welfare", null],
  [/\b(UBER|OLA|RAPIDO|IRCTC|MAKEMYTRIP|INDIGO|AIR ?INDIA|FUEL|PETROL|HPCL|BPCL|IOCL)\b/, "Travel & fuel", "Travelling Expenses", null],
  [/\b(AMAZON|FLIPKART)\b/, "Online purchases", "Office Expenses", null],
  [/\b(GOOGLE|MICROSOFT|AWS|ZOHO|ADOBE|CANVA|GODADDY|HOSTINGER)\b/, "Software & subscriptions", "Software Subscriptions", null],
  [/\b(INSURANCE|LIC|PREMIUM)\b/, "Insurance", "Insurance", null],
];

const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

/** The payee or purpose behind a narration, e.g. "UPI/DR/412345678901/SWIGGY LTD/YESB/swiggy@ybl" → "Swiggy". */
export function groupKeyOf(description: string): { key: string; label: string; rule: typeof RULES[number] | null } {
  const up = ` ${description.toUpperCase()} `;
  const rule = RULES.find(([re]) => re.test(up)) ?? null;
  if (rule) return { key: `rule:${rule[1]}`, label: rule[1], rule };
  const cleaned = up
    .replace(/[/|\\,:;]+/g, " ")               // separators between fields
    .replace(/[A-Z0-9._-]+@[A-Z0-9._-]+/g, " ") // UPI handles
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, " ") // IFSC codes
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, " ")
    .replace(/[A-Z]*\d[A-Z\d]*/g, " ")         // references, UTRs, amounts, mixed codes
    .replace(/[^A-Z ]/g, " ");
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
  if (!words.length) return { key: "other", label: "Other", rule: null };
  const name = words.slice(0, 2).join(" ");
  return { key: `name:${name}`, label: title(name), rule: null };
}

/** Groups rows; suggests a ledger from (1) how you posted similar rows before, (2) purpose rules, (3) the AI's per-row picks. */
export function groupStatement(rows: StmtRow[], history: Record<string, string> = {}): StmtGroup[] {
  const map = new Map<string, StmtGroup & { aiVotes: Map<string, number> }>();
  for (const r of rows) {
    const dir: "out" | "in" = r.debit > 0 ? "out" : "in";
    const { key, label, rule } = groupKeyOf(r.description);
    const k = `${key}|${dir}`;
    let g = map.get(k);
    if (!g) {
      const fromHistory = history[k];
      const ruleLedger = rule ? (dir === "out" ? rule[2] : rule[3]) : null;
      g = { key: k, label, dir, rowIds: [], count: 0, total: 0, suggested: fromHistory ?? ruleLedger ?? "", source: fromHistory ? "history" : ruleLedger ? "rule" : "none",
        reason: fromHistory ? "You posted these here before" : ruleLedger ? `Looks like ${label.toLowerCase()}` : "", aiVotes: new Map() };
      map.set(k, g);
    }
    g.rowIds.push(r.id); g.count++; g.total = Math.round((g.total + (r.debit || r.credit)) * 100) / 100;
    if (r.aiLedger) g.aiVotes.set(r.aiLedger, (g.aiVotes.get(r.aiLedger) ?? 0) + (r.confidence || 0.5));
  }
  const out: StmtGroup[] = [];
  for (const g of map.values()) {
    if (!g.suggested && g.aiVotes.size) {
      const [best, votes] = [...g.aiVotes.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = [...g.aiVotes.values()].reduce((s, v) => s + v, 0);
      g.suggested = best; g.source = "ai";
      g.reason = g.aiVotes.size === 1 ? "AI suggestion" : `AI suggestion for most rows (${Math.round(votes / total * 100)}%)`;
    }
    const { aiVotes: _drop, ...rest } = g; void _drop;
    out.push(rest);
  }
  // Biggest groups first, single unknowns last
  return out.sort((a, b) => (b.count > 1 ? 1 : 0) - (a.count > 1 ? 1 : 0) || b.total - a.total);
}

/** Learns "group → ledger" from previously posted statement rows, so the next upload suggests the same ledger. */
export function learnHistory(posted: { description: string; ledger: string; debit: number }[]): Record<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const p of posted) {
    if (!p.ledger) continue;
    const k = `${groupKeyOf(p.description).key}|${p.debit > 0 ? "out" : "in"}`;
    const m = votes.get(k) ?? new Map<string, number>();
    m.set(p.ledger, (m.get(p.ledger) ?? 0) + 1);
    votes.set(k, m);
  }
  const res: Record<string, string> = {};
  for (const [k, m] of votes) res[k] = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return res;
}
