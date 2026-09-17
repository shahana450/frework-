"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Journal = {
  id: string; entry_no: string; date: string; narration: string;
  type: string; status: string; total_debit: number; total_credit: number;
  financial_year_id: string | null; reference_no: string | null;
};
type JournalLine = {
  id: string; journal_id: string; account_id: string; narration: string;
  dr_amount: number; cr_amount: number;
};
type Account = { id: string; name: string; type: string };

// ─── Audit flag categories ───────────────────────────────────────────────────
type FlagCategory =
  | "critical"     // DR/CR mismatch, data integrity
  | "compliance"   // Cash >2L, TDS threshold, GST
  | "documentation"// Missing narration, no reference on sales/purchase
  | "timing"       // Weekend, year-end, outside FY
  | "pattern"      // Round number, duplicate amount same day
  | "review";      // Large txn, negative asset balance

type Flag = {
  id: string; entry_no: string; date: string; narration: string;
  type: string; amount: number;
  reason: string; detail?: string;
  category: FlagCategory;
  severity: "high" | "medium" | "low";
  action?: string;   // label for the quick-action button
  actionHref?: string; // link if action is navigate
};

const CAT_META: Record<FlagCategory, { label: string; icon: string; color: string; bg: string; border: string }> = {
  critical:      { label: "Critical",       icon: "🔴", color: "#F87171", bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.25)" },
  compliance:    { label: "Compliance",     icon: "⚖️",  color: "#FB923C", bg: "rgba(251,146,60,0.07)",  border: "rgba(251,146,60,0.25)"  },
  documentation: { label: "Documentation", icon: "📋", color: "#FBBF24", bg: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.25)"  },
  timing:        { label: "Timing",         icon: "🕐", color: "#A78BFA", bg: "rgba(167,139,250,0.07)", border: "rgba(167,139,250,0.25)" },
  pattern:       { label: "Pattern",        icon: "🔁", color: "#60A5FA", bg: "rgba(96,165,250,0.07)",  border: "rgba(96,165,250,0.25)"  },
  review:        { label: "Review",         icon: "🔍", color: "#34D399", bg: "rgba(52,211,153,0.07)",  border: "rgba(52,211,153,0.25)"  },
};

const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDec = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function isRoundNumber(n: number) { return n >= 10000 && n % 1000 === 0; }
function isWeekend(d: string) { const day = new Date(d).getDay(); return day === 0 || day === 6; }

// Returns true if an account name looks like a cash ledger (not bank)
function isCashAccount(name: string): boolean {
  const n = name.toLowerCase();
  // Explicit cash indicators
  if (/\bcash\b/.test(n) || n.includes("petty cash") || n.includes("cash in hand") || n.includes("cash at hand")) return true;
  // Bank indicators — if any of these, it is NOT cash
  const bankKeywords = ["bank", "hdfc", "sbi", "icici", "axis", "kotak", "yes bank", "pnb", "canara", "union bank",
    "indian bank", "uco", "central bank", "idbi", "indusind", "rbl", "federal", "current a/c",
    "savings a/c", "od a/c", "cc a/c", "overdraft", "neft", "rtgs", "imps"];
  if (bankKeywords.some(k => n.includes(k))) return false;
  return false; // default: not cash — be conservative to avoid false positives
}

// Narration keyword hints for TDS applicability
function tdsHint(narration: string, accNames: string[]): string | null {
  const n = (narration + " " + accNames.join(" ")).toLowerCase();
  if (/rent|lease|premises|property|space/.test(n)) return "Rent — TDS @10% u/s 194-I (IT Act 2025, Sch. IV)";
  if (/professional|consultant|legal|audit|ca |cs |doctor|medical|architect|engineer/.test(n)) return "Professional fee — TDS @10% u/s 194-J (IT Act 2025, Sch. IV)";
  if (/contract|labour|work|transport|freight|clearing|loading/.test(n)) return "Contractor — TDS @1-2% u/s 194-C (IT Act 2025, Sch. IV)";
  if (/commission|brokerage|agent/.test(n)) return "Commission — TDS @5% u/s 194-H (IT Act 2025, Sch. IV)";
  if (/interest/.test(n)) return "Interest — TDS @10% u/s 194-A (IT Act 2025, Sch. IV)";
  if (/royalt/.test(n)) return "Royalty — TDS @10% u/s 194-J (IT Act 2025, Sch. IV)";
  if (/salary|wages|payroll/.test(n)) return "Salary — TDS u/s 192 (IT Act 2025) — check Form 16";
  return null;
}

function buildFlags(journals: Journal[], lines: JournalLine[], accounts: Account[]): Flag[] {
  const flags: Flag[] = [];
  const accMap = new Map(accounts.map(a => [a.id, a]));

  // ── Pre-compute: cash involvement per journal ──────────────────────────────
  const cashJournalIds = new Set<string>();
  const cashAccName = new Map<string, string>();
  // Lines per journal for narration/account lookups
  const linesByJournal = new Map<string, JournalLine[]>();
  for (const l of lines) {
    const acc = accMap.get(l.account_id);
    if (acc && isCashAccount(acc.name)) {
      cashJournalIds.add(l.journal_id);
      if (!cashAccName.has(l.journal_id)) cashAccName.set(l.journal_id, acc.name);
    }
    const arr = linesByJournal.get(l.journal_id) ?? []; arr.push(l); linesByJournal.set(l.journal_id, arr);
  }

  // ── Aggregate payments per ledger per month for TDS threshold breaches ─────
  // payByAccMonth[accId][YYYY-MM] = total payment amount
  const payByAccMonth = new Map<string, Map<string, number>>();
  for (const j of journals) {
    if (j.type !== "payment") continue;
    const month = j.date.slice(0, 7);
    for (const l of linesByJournal.get(j.id) ?? []) {
      const acc = accMap.get(l.account_id);
      if (!acc || acc.type !== "liability") continue; // vendor ledgers are liabilities
      const byMonth = payByAccMonth.get(l.account_id) ?? new Map<string, number>();
      byMonth.set(month, (byMonth.get(month) ?? 0) + l.dr_amount);
      payByAccMonth.set(l.account_id, byMonth);
    }
  }

  // ── Group by date for duplicate detection ──────────────────────────────────
  const byDate = new Map<string, Journal[]>();
  for (const j of journals) {
    const g = byDate.get(j.date) ?? []; g.push(j); byDate.set(j.date, g);
  }

  for (const j of journals) {
    const amt = Math.max(j.total_debit, j.total_credit);
    const jLines = linesByJournal.get(j.id) ?? [];
    const jAccNames = jLines.map(l => accMap.get(l.account_id)?.name ?? "").filter(Boolean);

    // ── CRITICAL ────────────────────────────────────────────────────────────
    if (Math.abs(j.total_debit - j.total_credit) > 1)
      flags.push({ ...j, amount: amt, category: "critical", severity: "high",
        reason: "DR/CR mismatch — double-entry is broken",
        detail: `Debit ₹${j.total_debit.toFixed(2)} ≠ Credit ₹${j.total_credit.toFixed(2)}. Violates fundamental accounting equation (AS-1 / Ind AS 1).`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    if (j.total_debit === 0 && j.total_credit === 0)
      flags.push({ ...j, amount: 0, category: "critical", severity: "high",
        reason: "Zero-amount entry — no financial effect recorded",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // ── INCOME TAX ACT 2025 ──────────────────────────────────────────────────
    // Sec 269ST equivalent (Chapter XX-B restated in IT Act 2025):
    // No person shall receive ≥ ₹2L in cash from a single person in a day/single transaction
    if (amt >= 200000 && cashJournalIds.has(j.id) && (j.type === "receipt" || j.type === "payment" || j.type === "contra"))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Cash transaction ≥ ₹2 lakh — IT Act 2025, Sec 269ST equivalent",
        detail: `Cash ledger: ${cashAccName.get(j.id) ?? "Cash"}. Penalty = 100% of amount received. Exempt: Govt receipts, bank withdrawals, transactions through banking channel.`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // Sec 40A(3) equivalent — cash payment ≥ ₹10k for business expense → not deductible
    if (amt >= 10000 && cashJournalIds.has(j.id) && (j.type === "payment" || j.type === "expense"))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Cash payment ≥ ₹10k for expense — disallowed u/s 40A(3) [IT Act 2025]",
        detail: "Business expense paid in cash ≥ ₹10k is disallowed as deduction (100%). Exception: transport, agriculture, villages without banking facility.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // Sec 269SS — cash loan/deposit accepted ≥ ₹20k
    const narr = (j.narration ?? "").toLowerCase();
    if (amt >= 20000 && cashJournalIds.has(j.id) && /loan|deposit|advance|borrow/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Cash loan/deposit ≥ ₹20k — violates Sec 269SS [IT Act 2025]",
        detail: "Accepting/giving loans/deposits in cash ≥ ₹20k attracts penalty equal to the amount. Must be routed through banking channel.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // ── TDS CHECKS (IT Act 2025 / Old Act equivalent sections) ──────────────
    // 194-C: Contractor payment ≥ ₹30k single / ₹1L aggregate
    if (amt >= 30000 && (j.type === "payment") &&
        /contract|labour|work order|transport|freight|clearing|loading|construction/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Contractor payment ≥ ₹30k — TDS @1-2% u/s 194-C [IT Act 2025, Sch. IV]",
        detail: `Individual/HUF: 1%, Others: 2%. Aggregate threshold: ₹1L/year per contractor. Verify TDS deducted & deposited by 7th of next month.`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // 194-J: Professional fees ≥ ₹30k
    if (amt >= 30000 && (j.type === "payment") &&
        /professional|consultant|legal|audit|ca |cs |doctor|medical|architect|engineer|software|technical/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Professional fee ≥ ₹30k — TDS @10% u/s 194-J [IT Act 2025, Sch. IV]",
        detail: "TDS @10% (2% for technical services). Deposit by 7th of next month. Issue Form 16A within 15 days of due date of quarterly TDS return.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // 194-I: Rent ≥ ₹50k/month
    if (amt >= 50000 && (j.type === "payment") && /rent|lease|premises|property|space|shop|office/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Rent ≥ ₹50k/month — TDS @10% u/s 194-I [IT Act 2025, Sch. IV]",
        detail: "Plant & machinery: 2%, Land/building/furniture: 10%. Deposit by 30th Apr for Mar quarter, 7th of next month otherwise.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // 194-H: Commission/brokerage ≥ ₹15k
    if (amt >= 15000 && (j.type === "payment") && /commission|brokerage|agency|agent/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Commission/brokerage ≥ ₹15k — TDS @5% u/s 194-H [IT Act 2025, Sch. IV]",
        detail: "TDS @5% on commission/brokerage payments. Threshold ₹15k per year per payee.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // 194-A: Interest (non-bank) ≥ ₹5k / bank ≥ ₹40k
    if (amt >= 5000 && (j.type === "payment") && /interest/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Interest payment — TDS @10% u/s 194-A [IT Act 2025, Sch. IV]",
        detail: "Non-bank interest: TDS if ≥ ₹5k/year. Bank/post office: TDS if ≥ ₹40k/year (₹50k for seniors). Rate: 10%.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // Generic payment ≥ ₹30k without reference — check TDS applicability
    if (amt >= 30000 && j.type === "payment" && !j.reference_no) {
      const hint = tdsHint(j.narration ?? "", jAccNames);
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Payment ≥ ₹30k without bill reference — verify TDS applicability",
        detail: hint ?? "Cross-check against TDS sections 192/194A/194C/194I/194J (IT Act 2025, Schedule IV). Deposit TDS by 7th of next month.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });
    }

    // ── GST CHECKS ───────────────────────────────────────────────────────────
    // E-invoice mandatory for turnover >₹5Cr — sales ≥ ₹2L without reference
    if (amt >= 200000 && j.type === "sales" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Sales ≥ ₹2L with no invoice reference — e-Invoice IRN missing?",
        detail: "For turnover >₹5Cr, e-Invoice is mandatory (CGST Rule 48(4)). Without valid IRN, ITC for buyer is blocked & penalty u/s 122 CGST may apply.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}` });

    // Credit note without original reference
    if (j.type === "credit_note" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Credit note without original invoice reference — GST CGST Rule 53",
        detail: "Credit note must reference the original tax invoice (CGST Rule 53). Without reference, ITC reversal by buyer is ambiguous.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}` });

    // Debit note without reference
    if (j.type === "debit_note" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Debit note without original invoice reference — CGST Rule 53",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}` });

    // Purchase without reference — ITC claim at risk
    if (amt >= 100000 && j.type === "purchase" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Purchase ≥ ₹1L without bill reference — ITC claim at risk",
        detail: "ITC can only be claimed against a valid tax invoice (Sec 16 CGST Act). Without bill reference, ITC is not available.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}` });

    // ── ACCOUNTING STANDARDS (AS / Ind AS) ──────────────────────────────────
    // AS-9 / Ind AS 115: Revenue recognition — sales recorded without reference suggests advance
    if (j.type === "sales" && amt >= 100000 && /advance|deposit|booking|token/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Advance receipt recorded as Sales — revenue recognition issue (Ind AS 115)",
        detail: "Advance receipts should be credited to 'Advance from Customers' (liability), not revenue. Revenue recognised only when performance obligation is satisfied.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // AS-2 / Ind AS 2: Stock/inventory adjustments without purchase entry
    if (/stock adjustment|inventory|closing stock|opening stock/.test(narr) && j.type === "journal")
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Stock adjustment entry — verify valuation basis (AS-2 / Ind AS 2)",
        detail: "Inventory must be valued at lower of cost or net realisable value. FIFO/weighted average method must be consistent (AS-2, Ind AS 2)." });

    // AS-16 / Ind AS 23: Capitalisation of borrowing costs
    if (/interest/.test(narr) && j.type === "journal" && /capital|wip|asset|building|plant/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "low",
        reason: "Interest may be capitalisable — review under AS-16 / Ind AS 23",
        detail: "Borrowing costs directly attributable to acquisition/construction of a qualifying asset must be capitalised (Ind AS 23)." });

    // ── DOCUMENTATION ───────────────────────────────────────────────────────
    if (!j.narration || j.narration.trim().length < 3)
      flags.push({ ...j, amount: amt, category: "documentation", severity: "medium",
        reason: "Missing narration — entry not self-explanatory (AS-1 disclosure requirement)",
        detail: "AS-1 (Disclosure of Accounting Policies) requires all entries to have adequate narration for audit trail.",
        action: "Add Narration", actionHref: `/finance/journals?id=${j.id}` });

    if ((j.type === "sales" || j.type === "purchase") && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "documentation", severity: "medium",
        reason: `${j.type === "sales" ? "Sales" : "Purchase"} entry without invoice number — incomplete books`,
        detail: "Every sales/purchase must reference the invoice number for GST matching (GSTR-1 vs GSTR-2B) and audit trail.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}` });

    // ── TIMING ──────────────────────────────────────────────────────────────
    if (isWeekend(j.date))
      flags.push({ ...j, amount: amt, category: "timing", severity: "low",
        reason: "Transaction on weekend — confirm authorisation",
        detail: new Date(j.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }) });

    if (j.date?.endsWith("-03-31") || j.date?.endsWith("-03-30"))
      flags.push({ ...j, amount: amt, category: "timing", severity: "medium",
        reason: "Year-end entry — review cut-off compliance (AS-1 / Ind AS 1)",
        detail: "Entries on 30-31 Mar should reflect accrual-basis cut-off. Verify goods/services actually received/delivered before FY end." });

    if (j.date?.endsWith("-04-01") || j.date?.endsWith("-04-02"))
      flags.push({ ...j, amount: amt, category: "timing", severity: "low",
        reason: "FY opening entry — verify opening balance treatment" });

    // ── PATTERN ─────────────────────────────────────────────────────────────
    if (isRoundNumber(amt))
      flags.push({ ...j, amount: amt, category: "pattern", severity: "low",
        reason: "Round-number amount — possible estimate or provisional entry",
        detail: "Exact round figures (multiples of ₹1,000+) may indicate estimates rather than actuals. Verify with supporting documents." });

    // Same-day same-amount duplicate check
    const sameDay = (byDate.get(j.date) ?? []).filter(x => x.id !== j.id && Math.max(x.total_debit, x.total_credit) === amt && x.type === j.type);
    if (sameDay.length > 0)
      flags.push({ ...j, amount: amt, category: "pattern", severity: "medium",
        reason: `Possible duplicate — ${sameDay.length} other ${j.type} of same amount on same date`,
        detail: `Matching: ${sameDay.map(x => x.entry_no).join(", ")}`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });

    // ── REVIEW ──────────────────────────────────────────────────────────────
    if (amt >= 500000)
      flags.push({ ...j, amount: amt, category: "review", severity: "high",
        reason: "Large transaction above ₹5 lakh — verify approval chain",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}` });
  }

  // Dedup by id+reason
  const seen = new Set<string>();
  return flags.filter(f => { const k = f.id + f.reason; if (seen.has(k)) return false; seen.add(k); return true; });
}

type TrialRow = { name: string; type: string; dr: number; cr: number; balance: number };

function buildTrialBalance(accounts: Account[], lines: JournalLine[], journalIds: Set<string>): TrialRow[] {
  const map = new Map<string, TrialRow>();
  for (const a of accounts) map.set(a.id, { name: a.name, type: a.type, dr: 0, cr: 0, balance: 0 });
  for (const l of lines) {
    if (!journalIds.has(l.journal_id)) continue;
    const row = map.get(l.account_id);
    if (!row) continue;
    row.dr += l.dr_amount || 0;
    row.cr += l.cr_amount || 0;
  }
  return Array.from(map.values()).map(r => ({ ...r, balance: r.dr - r.cr })).filter(r => r.dr > 0 || r.cr > 0).sort((a,b) => a.name.localeCompare(b.name));
}

type PLSummary = { revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number };

function buildPL(tb: TrialRow[]): PLSummary {
  const revenue  = tb.filter(r => ["income","sales"].includes(r.type)).reduce((s,r) => s + Math.abs(r.cr - r.dr), 0);
  const cogs     = tb.filter(r => r.type === "cost_of_goods").reduce((s,r) => s + Math.abs(r.dr - r.cr), 0);
  const expenses = tb.filter(r => r.type === "expense").reduce((s,r) => s + Math.abs(r.dr - r.cr), 0);
  return { revenue, cogs, grossProfit: revenue - cogs, expenses, netProfit: revenue - cogs - expenses };
}

type BSSummary = {
  assets: TrialRow[]; fixedAssets: TrialRow[];
  liabilities: TrialRow[]; loans: TrialRow[]; taxes: TrialRow[];
  equity: TrialRow[];
  totalAssets: number; totalLiabEq: number;
};
function buildBS(tb: TrialRow[], netProfit: number): BSSummary {
  const assets      = tb.filter(r => ["asset","bank","cash"].includes(r.type)).map(r => ({ ...r, balance: r.dr - r.cr }));
  const fixedAssets = tb.filter(r => r.type === "fixed_asset").map(r => ({ ...r, balance: r.dr - r.cr }));
  const liabilities = tb.filter(r => r.type === "liability").map(r => ({ ...r, balance: r.cr - r.dr }));
  const loans       = tb.filter(r => r.type === "loan").map(r => ({ ...r, balance: r.cr - r.dr }));
  const taxes       = tb.filter(r => r.type === "tax").map(r => ({ ...r, balance: r.cr - r.dr }));
  const equity      = tb.filter(r => r.type === "equity").map(r => ({ ...r, balance: r.cr - r.dr }));
  const totalAssets = [...assets, ...fixedAssets].reduce((s,r) => s + r.balance, 0);
  const totalLiabEq = [...liabilities, ...loans, ...taxes, ...equity].reduce((s,r) => s + r.balance, 0) + netProfit;
  return { assets, fixedAssets, liabilities, loans, taxes, equity, totalAssets, totalLiabEq };
}

export default function AuditPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<"overview" | "flags" | "trial_balance" | "pl" | "balance_sheet" | "ledger">("overview");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [fys, setFys] = useState<{ id: string; label: string; start: string; end: string }[]>([]);
  // Flag filtering + reviewed state
  const [filterCat, setFilterCat] = useState<FlagCategory | "all">("all");
  const [filterSev, setFilterSev] = useState<"all" | "high" | "medium" | "low">("all");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [showReviewed, setShowReviewed] = useState(false);
  const [tbSearch, setTbSearch] = useState("");

  useEffect(() => {
    const saved2 = typeof window !== "undefined" ? (localStorage.getItem("fw_audit_reviewed") ?? "[]") : "[]";
    try { setReviewed(new Set(JSON.parse(saved2))); } catch { /* */ }
    // Auto-reload when Tally import fires in another tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fw_tally_last_import") {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          const bid = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
          const now2 = new Date();
          const yr2 = now2.getMonth() >= 3 ? now2.getFullYear() : now2.getFullYear() - 1;
          if (bid) loadDataByRange(bid, `${yr2}-04-01`, `${yr2 + 1}-03-31`);
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: fysData } = await supabase.from("fw_fin_financial_years").select("id,label,is_current,start_date,end_date").eq("business_id", saved).order("start_date", { ascending: false });
      const now = new Date();
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const curFyStart = `${yr}-04-01`;
      const curFyEnd = `${yr + 1}-03-31`;
      const curFyLabel = `${yr}-${String(yr + 1).slice(-2)}`;
      const matchingFy = fysData?.find(f => f.start_date === curFyStart);
      const fyList: { id: string; label: string; start: string; end: string }[] = (fysData ?? []).map(f => ({
        id: f.id, label: f.label, start: f.start_date, end: f.end_date ?? `${parseInt(f.start_date)+1}-03-31`,
      }));
      if (!matchingFy) fyList.unshift({ id: `fy_cur_${yr}`, label: curFyLabel, start: curFyStart, end: curFyEnd });
      setFys(fyList);
      const cur = fyList[0];
      setFyId(cur.id);
      await loadDataByRange(saved, cur.start, cur.end);
    });
  }, []);

  async function loadDataByRange(bid: string, start: string, end: string) {
    setLoading(true);
    // Safety timeout — never hang forever
    const timer = setTimeout(() => setLoading(false), 12000);
    try {
      // Phase 1: load journals + accounts → show overview immediately
      let jq = supabase.from("fw_fin_journals")
        .select("id,entry_no,date,narration,type,status,total_debit,total_credit,financial_year_id,reference_no")
        .eq("business_id", bid).in("status", ["posted", "draft"]).order("date");
      jq = jq.gte("date", start).lte("date", end);
      const [jRes, aRes] = await Promise.all([jq, supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", bid)]);
      let journalData: Journal[] = jRes.data ?? [];
      // If no data in selected range, fall back to ALL journals for this business
      if (!journalData.length) {
        const { data: allJ } = await supabase.from("fw_fin_journals")
          .select("id,entry_no,date,narration,type,status,total_debit,total_credit,financial_year_id,reference_no")
          .eq("business_id", bid).order("date");
        journalData = allJ ?? [];
      }
      setJournals(journalData);
      setAccounts(aRes.data ?? []);
      clearTimeout(timer);
      setLoading(false); // show overview now
      // Phase 2: load journal lines in background for detail tabs
      const jIds = journalData.map(j => j.id);
      if (!jIds.length) return;
      const allLines: JournalLine[] = [];
      for (let i = 0; i < jIds.length; i += 200) {
        const { data: batch } = await supabase.from("fw_fin_journal_lines")
          .select("id,journal_id,account_id,narration,dr_amount,cr_amount").in("journal_id", jIds.slice(i, i + 200));
        allLines.push(...(batch ?? []));
      }
      setLines(allLines);
    } catch {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  const switchFy = useCallback(async (fid: string) => {
    setFyId(fid);
    const fy = fys.find(f => f.id === fid);
    if (bizId && fy) await loadDataByRange(bizId, fy.start, fy.end);
  }, [bizId, fys]);

  const markReviewed = useCallback((key: string) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem("fw_audit_reviewed", JSON.stringify([...next])); } catch { /* */ }
      return next;
    });
  }, []);

  const journalIds = new Set(journals.map(j => j.id));
  const flags = buildFlags(journals, lines, accounts);
  const tb = buildTrialBalance(accounts, lines, journalIds);
  const pl = buildPL(tb);
  const bs = buildBS(tb, pl.netProfit);

  // Filter flags
  const visibleFlags = flags.filter(f => {
    const key = f.id + f.reason;
    if (!showReviewed && reviewed.has(key)) return false;
    if (filterCat !== "all" && f.category !== filterCat) return false;
    if (filterSev !== "all" && f.severity !== filterSev) return false;
    return true;
  });

  // Category breakdown for sidebar
  const catCounts = Object.keys(CAT_META).reduce<Record<string, { total: number; unreviewed: number }>>((acc, c) => {
    const all = flags.filter(f => f.category === c);
    acc[c] = { total: all.length, unreviewed: all.filter(f => !reviewed.has(f.id + f.reason)).length };
    return acc;
  }, {} as Record<string, { total: number; unreviewed: number }>);

  const unreviewedCount = flags.filter(f => !reviewed.has(f.id + f.reason)).length;
  const criticalCount   = flags.filter(f => f.category === "critical" && !reviewed.has(f.id + f.reason)).length;
  const complianceCount = flags.filter(f => f.category === "compliance" && !reviewed.has(f.id + f.reason)).length;

  const tabs = [
    { key: "overview",       label: "Overview" },
    { key: "flags",          label: `⚑ Findings${unreviewedCount > 0 ? ` (${unreviewedCount})` : ""}` },
    { key: "trial_balance",  label: "Trial Balance" },
    { key: "pl",             label: "P&L" },
    { key: "balance_sheet",  label: "Balance Sheet" },
    { key: "ledger",         label: "Ledger" },
  ];

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF5", padding: "5px 10px", borderRadius: 7, fontSize: "0.8rem", fontFamily: "inherit", outline: "none", cursor: "pointer" };
  const ledgerLines = selectedAccount ? lines.filter(l => l.account_id === selectedAccount && journalIds.has(l.journal_id)) : [];
  const ledgerJournals = new Map(journals.map(j => [j.id, j]));
  const filteredTb = tb.filter(r => !tbSearch || r.name.toLowerCase().includes(tbSearch.toLowerCase()) || r.type.includes(tbSearch.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .au-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.25rem 1.4rem; }
        .au-tab { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.82rem; font-weight: 600; padding: 8px 14px; border-radius: 8px; transition: all 0.15s; color: rgba(232,237,245,0.4); white-space: nowrap; }
        .au-tab:hover { color: rgba(232,237,245,0.7); background: rgba(255,255,255,0.04); }
        .au-tab-active { color: #E8EDF5; background: rgba(255,255,255,0.08); }
        .au-tr:hover td { background: rgba(255,255,255,0.02); }
        td, th { padding: 0.45rem 0.85rem; }
        .au-mono { font-family: 'IBM Plex Mono', monospace; }
        select option { background: #0B1221; }
        .au-flag { border-radius: 11px; padding: 0.9rem 1.05rem; transition: opacity 0.15s; }
        .au-flag-reviewed { opacity: 0.4; }
        .au-catbtn { background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.75rem; font-weight: 600; padding: 5px 11px; transition: all 0.15s; color: rgba(232,237,245,0.45); display: flex; align-items: center; gap: 5px; }
        .au-catbtn:hover { border-color: rgba(255,255,255,0.18); color: rgba(232,237,245,0.8); }
        .au-catbtn-active { color: #E8EDF5 !important; }
        .au-act { font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 6px; border: none; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: opacity 0.15s; }
        .au-act:hover { opacity: 0.8; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", height: 52, position: "sticky", top: 0, background: "rgba(5,9,20,0.95)", backdropFilter: "blur(16px)", zIndex: 30 }}>
        <Link href="/finance" style={{ color: "#60A5FA", fontWeight: 700, textDecoration: "none", fontSize: "0.88rem" }}>← Finance</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Audit & Reports</span>
        {criticalCount > 0 && (
          <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171", padding: "2px 9px", borderRadius: 20 }}>
            {criticalCount} critical
          </span>
        )}
        <div style={{ flex: 1 }} />
        <select value={fyId ?? ""} onChange={e => switchFy(e.target.value)} style={inp}>
          {fys.map(f => <option key={f.id} value={f.id}>FY {f.label}</option>)}
        </select>
        <Link href="/finance/tally" style={{ fontSize: "0.78rem", color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", padding: "5px 12px", borderRadius: 7, textDecoration: "none", fontWeight: 600 }}>
          ⬇ Sync Tally
        </Link>
      </nav>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", flexWrap: "wrap", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`au-tab${tab === t.key ? " au-tab-active" : ""}`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "rgba(232,237,245,0.3)", fontSize: "0.88rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>Loading data…
          </div>
        ) : journals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📭</div>
            <div style={{ color: "rgba(232,237,245,0.4)", marginBottom: "1.5rem" }}>No transactions found for this FY. Sync from Tally first.</div>
            <Link href="/finance/tally" style={{ background: "#2563EB", color: "#fff", padding: "10px 24px", borderRadius: 9, textDecoration: "none", fontWeight: 700 }}>Go to Tally Sync →</Link>
          </div>
        ) : (

          <>
            {/* ══ OVERVIEW ══════════════════════════════════════════════════ */}
            {tab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.25rem", alignItems: "start" }}>
                <div>
                  {/* KPI row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
                    {[
                      { label: "Revenue",      value: fmt(pl.revenue),   color: "#34D399" },
                      { label: "Net Profit",   value: (pl.netProfit < 0 ? "−" : "") + fmt(pl.netProfit), color: pl.netProfit >= 0 ? "#34D399" : "#F87171" },
                      { label: "Total Entries",value: String(journals.length), color: "#60A5FA" },
                      { label: "Open Findings",value: String(unreviewedCount), color: unreviewedCount > 0 ? (criticalCount > 0 ? "#F87171" : "#FBBF24") : "#34D399" },
                    ].map(k => (
                      <div key={k.label} className="au-card">
                        <div style={{ fontSize: "0.57rem", color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.7rem" }}>{k.label}</div>
                        <div style={{ fontSize: "1.35rem", fontWeight: 900, color: k.color, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1 }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Quick P&L */}
                  <div className="au-card" style={{ marginBottom: "1.1rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
                      <span>Profit & Loss</span>
                      <button onClick={() => setTab("pl")} style={{ ...inp, padding: "3px 10px", fontSize: "0.72rem" }}>Full P&L →</button>
                    </div>
                    {[
                      { label: "Revenue",            val: pl.revenue,     color: "#34D399" },
                      { label: "Cost of Goods Sold", val: -pl.cogs,       color: "#F87171" },
                      { label: "Gross Profit",        val: pl.grossProfit, color: "#60A5FA", bold: true },
                      { label: "Operating Expenses", val: -pl.expenses,   color: "#F87171" },
                      { label: "Net Profit / Loss",  val: pl.netProfit,   color: pl.netProfit >= 0 ? "#34D399" : "#F87171", bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.38rem 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontWeight: r.bold ? 700 : 400, fontSize: r.bold ? "0.88rem" : "0.83rem" }}>
                        <span style={{ color: "rgba(232,237,245,0.6)" }}>{r.label}</span>
                        <span className="au-mono" style={{ color: r.color }}>{r.val < 0 ? "−" : ""}{fmt(r.val)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recent entries */}
                  <div className="au-card">
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Recent Transactions</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead><tr style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          <th style={{ textAlign: "left" }}>Entry</th><th style={{ textAlign: "left" }}>Date</th><th style={{ textAlign: "left" }}>Type</th><th style={{ textAlign: "left" }}>Narration</th><th style={{ textAlign: "right" }}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {journals.slice(-10).reverse().map(j => (
                            <tr key={j.id} className="au-tr" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              <td className="au-mono" style={{ color: "rgba(232,237,245,0.4)", fontSize: "0.7rem" }}>{j.entry_no}</td>
                              <td style={{ color: "rgba(232,237,245,0.5)", whiteSpace: "nowrap" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                              <td><span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#60A5FA", background: "rgba(96,165,250,0.1)", padding: "2px 7px", borderRadius: 20 }}>{j.type}</span></td>
                              <td style={{ color: "rgba(232,237,245,0.6)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                              <td className="au-mono" style={{ textAlign: "right", color: "#34D399" }}>{fmt(Math.max(j.total_debit, j.total_credit))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right sidebar: findings summary */}
                <div>
                  <div className="au-card" style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: "1rem" }}>
                      Findings Summary
                      {unreviewedCount > 0 && <span style={{ float: "right", fontSize: "0.72rem", color: "#F87171", fontWeight: 700 }}>{unreviewedCount} open</span>}
                    </div>
                    {(Object.keys(CAT_META) as FlagCategory[]).map(cat => {
                      const c = CAT_META[cat]; const cnt = catCounts[cat];
                      if (!cnt.total) return null;
                      return (
                        <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.45rem 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: "0.85rem" }}>{c.icon}</span>
                            <span style={{ fontSize: "0.8rem", color: "rgba(232,237,245,0.7)" }}>{c.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {cnt.unreviewed > 0 && <span style={{ fontSize: "0.68rem", fontWeight: 800, color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: "1px 8px", borderRadius: 20 }}>{cnt.unreviewed}</span>}
                            {cnt.unreviewed < cnt.total && <span style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.25)" }}>+{cnt.total - cnt.unreviewed} done</span>}
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => setTab("flags")} style={{ ...inp, marginTop: "0.85rem", width: "100%", textAlign: "center", padding: "8px", fontWeight: 700, fontSize: "0.78rem" }}>
                      View All Findings →
                    </button>
                  </div>

                  {/* Compliance alerts */}
                  {complianceCount > 0 && (
                    <div style={{ background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 11, padding: "0.85rem 1rem", marginBottom: "1rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#FB923C", marginBottom: "0.4rem" }}>⚖️ {complianceCount} Compliance Issue{complianceCount !== 1 ? "s" : ""}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(251,146,60,0.7)", lineHeight: 1.6 }}>Cash transactions, TDS thresholds, and GST compliance items need immediate attention.</div>
                      <button onClick={() => { setFilterCat("compliance"); setTab("flags"); }} style={{ marginTop: "0.6rem", background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.3)", color: "#FB923C", padding: "4px 12px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Review Compliance →
                      </button>
                    </div>
                  )}

                  {/* Balance sheet balance indicator */}
                  <div className="au-card">
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.75rem" }}>Balance Sheet Check</div>
                    {Math.abs(bs.totalAssets - bs.totalLiabEq) < 1 ? (
                      <div style={{ fontSize: "0.8rem", color: "#34D399" }}>✓ Balanced — Assets = Liab + Equity</div>
                    ) : (
                      <div style={{ fontSize: "0.78rem", color: "#FBBF24", lineHeight: 1.6 }}>
                        ⚠ Difference: {fmt(Math.abs(bs.totalAssets - bs.totalLiabEq))}<br />
                        <span style={{ color: "rgba(232,237,245,0.4)", fontSize: "0.7rem" }}>Some entries may have missing or unclassified accounts.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ FINDINGS ══════════════════════════════════════════════════ */}
            {tab === "flags" && (
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1.25rem", alignItems: "start" }}>

                {/* Left: category filter sidebar */}
                <div className="au-card" style={{ position: "sticky", top: 68 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", marginBottom: "1rem", color: "rgba(232,237,245,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Categories</div>
                  {/* All */}
                  <button onClick={() => setFilterCat("all")} className={`au-catbtn${filterCat === "all" ? " au-catbtn-active" : ""}`}
                    style={{ width: "100%", marginBottom: 4, ...(filterCat === "all" ? { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.2)" } : {}) }}>
                    <span>🗂</span><span>All ({flags.filter(f => !reviewed.has(f.id+f.reason) || showReviewed).length})</span>
                  </button>
                  {(Object.keys(CAT_META) as FlagCategory[]).map(cat => {
                    const c = CAT_META[cat]; const cnt = catCounts[cat];
                    const isActive = filterCat === cat;
                    return (
                      <button key={cat} onClick={() => setFilterCat(cat)}
                        className={`au-catbtn${isActive ? " au-catbtn-active" : ""}`}
                        style={{ width: "100%", marginBottom: 4, justifyContent: "space-between",
                          ...(isActive ? { background: c.bg, borderColor: c.border, color: c.color } : {}) }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span>{c.icon}</span><span>{c.label}</span></span>
                        {cnt.unreviewed > 0 && <span style={{ fontSize: "0.65rem", fontWeight: 800, color: isActive ? c.color : "rgba(232,237,245,0.5)", background: isActive ? c.bg : "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: 20, border: isActive ? `1px solid ${c.border}` : "1px solid transparent" }}>{cnt.unreviewed}</span>}
                      </button>
                    );
                  })}

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.85rem", paddingTop: "0.85rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.72rem", color: "rgba(232,237,245,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Severity</div>
                    {(["all","high","medium","low"] as const).map(s => (
                      <button key={s} onClick={() => setFilterSev(s)} className={`au-catbtn${filterSev === s ? " au-catbtn-active" : ""}`}
                        style={{ width: "100%", marginBottom: 3, ...(filterSev === s && s !== "all" ? { color: s === "high" ? "#F87171" : s === "medium" ? "#FBBF24" : "#60A5FA", background: s === "high" ? "rgba(248,113,113,0.07)" : s === "medium" ? "rgba(251,191,36,0.07)" : "rgba(96,165,250,0.07)", borderColor: s === "high" ? "rgba(248,113,113,0.25)" : s === "medium" ? "rgba(251,191,36,0.25)" : "rgba(96,165,250,0.25)" } : filterSev === s ? { background: "rgba(255,255,255,0.07)", color: "#E8EDF5" } : {}) }}>
                        {s === "all" ? "All severities" : `${s === "high" ? "🔴" : s === "medium" ? "🟡" : "🔵"} ${s.charAt(0).toUpperCase() + s.slice(1)}`}
                      </button>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.85rem", paddingTop: "0.85rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "rgba(232,237,245,0.5)", cursor: "pointer" }}>
                      <input type="checkbox" checked={showReviewed} onChange={e => setShowReviewed(e.target.checked)} style={{ accentColor: "#34D399" }} />
                      Show reviewed
                    </label>
                    {reviewed.size > 0 && (
                      <button onClick={() => { setReviewed(new Set()); localStorage.removeItem("fw_audit_reviewed"); }}
                        style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#F87171", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                        Clear all reviews ({reviewed.size})
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: flag cards */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                    <div style={{ fontSize: "0.82rem", color: "rgba(232,237,245,0.4)" }}>
                      {visibleFlags.length} finding{visibleFlags.length !== 1 ? "s" : ""}
                      {filterCat !== "all" && <span style={{ color: CAT_META[filterCat].color }}> · {CAT_META[filterCat].label}</span>}
                    </div>
                    {visibleFlags.length > 0 && (
                      <button onClick={() => visibleFlags.forEach(f => markReviewed(f.id + f.reason))}
                        style={{ fontSize: "0.72rem", color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                        ✓ Mark all reviewed
                      </button>
                    )}
                  </div>

                  {visibleFlags.length === 0 ? (
                    <div className="au-card" style={{ textAlign: "center", padding: "3.5rem" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
                      <div style={{ color: "rgba(232,237,245,0.5)", fontSize: "0.88rem" }}>
                        {flags.length === 0 ? "No findings — all entries look clean." : "All findings reviewed for this filter."}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {visibleFlags.map((f, i) => {
                        const c = CAT_META[f.category];
                        const key = f.id + f.reason;
                        const isRev = reviewed.has(key);
                        return (
                          <div key={i} className={`au-flag${isRev ? " au-flag-reviewed" : ""}`}
                            style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.color}` }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                              <div style={{ flex: 1 }}>
                                {/* Category + severity badge */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.3rem" }}>
                                  <span style={{ fontSize: "0.65rem", fontWeight: 800, color: c.color, textTransform: "uppercase", letterSpacing: "0.08em", background: c.bg, border: `1px solid ${c.border}`, padding: "1px 8px", borderRadius: 20 }}>{c.icon} {c.label}</span>
                                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: f.severity === "high" ? "#F87171" : f.severity === "medium" ? "#FBBF24" : "#60A5FA", textTransform: "uppercase" }}>{f.severity}</span>
                                </div>
                                {/* Reason */}
                                <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#E8EDF5", marginBottom: f.detail ? "0.2rem" : 0 }}>{f.reason}</div>
                                {/* Detail */}
                                {f.detail && <div style={{ fontSize: "0.73rem", color: "rgba(232,237,245,0.45)", lineHeight: 1.55 }}>{f.detail}</div>}
                                {/* Meta row */}
                                <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.85rem", fontSize: "0.72rem", color: "rgba(232,237,245,0.35)", flexWrap: "wrap" }}>
                                  <span className="au-mono">{f.entry_no}</span>
                                  <span>{new Date(f.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                  <span style={{ background: "rgba(96,165,250,0.1)", color: "#60A5FA", padding: "0px 6px", borderRadius: 20, fontWeight: 700 }}>{f.type}</span>
                                  <span style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.narration}</span>
                                </div>
                              </div>
                              {/* Amount + actions */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                                <div className="au-mono" style={{ fontWeight: 800, color: "#E8EDF5", fontSize: "0.9rem" }}>{fmt(f.amount)}</div>
                                <div style={{ display: "flex", gap: 5 }}>
                                  {f.actionHref && (
                                    <Link href={f.actionHref} className="au-act" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
                                      {f.action ?? "View"}
                                    </Link>
                                  )}
                                  <button onClick={() => markReviewed(key)} className="au-act"
                                    style={{ background: isRev ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)", border: isRev ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.1)", color: isRev ? "#34D399" : "rgba(232,237,245,0.4)" }}>
                                    {isRev ? "✓ Reviewed" : "Mark Reviewed"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ TRIAL BALANCE ═════════════════════════════════════════════ */}
            {tab === "trial_balance" && (
              <div className="au-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Trial Balance</div>
                  <input value={tbSearch} onChange={e => setTbSearch(e.target.value)} placeholder="Search account…"
                    style={{ ...inp, minWidth: 200 }} />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,237,245,0.35)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <th style={{ textAlign: "left" }}>Account</th>
                        <th style={{ textAlign: "left" }}>Type</th>
                        <th style={{ textAlign: "right" }}>Debit (₹)</th>
                        <th style={{ textAlign: "right" }}>Credit (₹)</th>
                        <th style={{ textAlign: "right" }}>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTb.map(r => (
                        <tr key={r.name} className="au-tr" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                          onClick={() => { setSelectedAccount(accounts.find(a => a.name === r.name)?.id ?? null); setTab("ledger"); }}>
                          <td style={{ color: "#60A5FA", fontWeight: 500 }}>{r.name}</td>
                          <td><span style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.35)", background: "rgba(255,255,255,0.04)", padding: "1px 7px", borderRadius: 20 }}>{r.type}</span></td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.dr > 0 ? "#E8EDF5" : "rgba(232,237,245,0.2)" }}>{r.dr > 0 ? fmt(r.dr) : "—"}</td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.cr > 0 ? "#E8EDF5" : "rgba(232,237,245,0.2)" }}>{r.cr > 0 ? fmt(r.cr) : "—"}</td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.balance >= 0 ? "#34D399" : "#F87171", fontWeight: 600 }}>{r.balance < 0 ? "−" : ""}{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid rgba(255,255,255,0.1)", fontWeight: 800 }}>
                        <td colSpan={2} style={{ color: "rgba(232,237,245,0.5)", fontSize: "0.78rem" }}>TOTAL</td>
                        <td className="au-mono" style={{ textAlign: "right", color: "#34D399" }}>{fmt(filteredTb.reduce((s,r) => s+r.dr,0))}</td>
                        <td className="au-mono" style={{ textAlign: "right", color: "#60A5FA" }}>{fmt(filteredTb.reduce((s,r) => s+r.cr,0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "rgba(232,237,245,0.2)" }}>
                  {tb.length} accounts · Click any row to drill into ledger transactions
                </div>
              </div>
            )}

            {/* ══ P&L ═══════════════════════════════════════════════════════ */}
            {tab === "pl" && (
              <div className="au-card">
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1.25rem" }}>Profit & Loss Statement</div>
                {[
                  { title: "INCOME", rows: tb.filter(r => ["income","sales"].includes(r.type)), sign: -1 as const },
                  { title: "COST OF GOODS SOLD", rows: tb.filter(r => r.type === "cost_of_goods"), sign: 1 as const },
                  { title: "OPERATING EXPENSES", rows: tb.filter(r => r.type === "expense"), sign: 1 as const },
                ].map(sec => sec.rows.length === 0 ? null : (
                  <div key={sec.title} style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{sec.title}</div>
                    {sec.rows.map(r => (
                      <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.38rem 0", fontSize: "0.84rem" }}>
                        <span style={{ color: "rgba(232,237,245,0.65)" }}>{r.name}</span>
                        <span className="au-mono">{fmtDec(sec.sign === -1 ? r.cr - r.dr : r.dr - r.cr)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderTop: "1px solid rgba(255,255,255,0.08)", fontWeight: 700, fontSize: "0.85rem" }}>
                      <span style={{ color: "rgba(232,237,245,0.4)" }}>Total {sec.title}</span>
                      <span className="au-mono">{fmtDec(sec.rows.reduce((s,r) => s + (sec.sign === -1 ? r.cr - r.dr : r.dr - r.cr), 0))}</span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: "2px solid rgba(255,255,255,0.12)", paddingTop: "1rem" }}>
                  {[
                    { label: "Gross Profit",      val: pl.grossProfit },
                    { label: "Net Profit / Loss",  val: pl.netProfit },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", fontWeight: 800, fontSize: "0.92rem" }}>
                      <span>{r.label}</span>
                      <span className="au-mono" style={{ color: r.val >= 0 ? "#34D399" : "#F87171" }}>{r.val < 0 ? "−" : ""}{fmtDec(r.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ BALANCE SHEET ═════════════════════════════════════════════ */}
            {tab === "balance_sheet" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="au-card">
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Assets</div>
                  {[
                    { title: "Current Assets", rows: bs.assets },
                    { title: "Fixed Assets",   rows: bs.fixedAssets },
                  ].map(sec => sec.rows.length === 0 ? null : (
                    <div key={sec.title} style={{ marginBottom: "1rem" }}>
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(232,237,245,0.3)", textTransform: "uppercase", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>{sec.title}</div>
                      {sec.rows.map(r => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                          <span style={{ color: "rgba(232,237,245,0.6)" }}>{r.name}</span>
                          <span className="au-mono" style={{ color: r.balance < 0 ? "#F87171" : undefined }}>{r.balance < 0 ? "−" : ""}{fmtDec(r.balance)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ borderTop: "2px solid rgba(255,255,255,0.1)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>Total Assets</span>
                    <span className="au-mono" style={{ color: "#34D399" }}>{fmtDec(bs.totalAssets)}</span>
                  </div>
                </div>
                <div className="au-card">
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Liabilities & Equity</div>
                  {[
                    { title: "Capital & Equity",    rows: bs.equity },
                    { title: "Loans & Borrowings",  rows: bs.loans },
                    { title: "Current Liabilities", rows: bs.liabilities },
                    { title: "Tax Liabilities",     rows: bs.taxes },
                  ].map(sec => sec.rows.length === 0 ? null : (
                    <div key={sec.title} style={{ marginBottom: "1rem" }}>
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(232,237,245,0.3)", textTransform: "uppercase", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>{sec.title}</div>
                      {sec.rows.map(r => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                          <span style={{ color: "rgba(232,237,245,0.6)" }}>{r.name}</span>
                          <span className="au-mono">{fmtDec(r.balance)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {pl.netProfit !== 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                      <span style={{ color: "rgba(232,237,245,0.6)" }}>Retained Earnings (Net P/L)</span>
                      <span className="au-mono" style={{ color: pl.netProfit >= 0 ? "#34D399" : "#F87171" }}>{pl.netProfit < 0 ? "−" : ""}{fmtDec(pl.netProfit)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "2px solid rgba(255,255,255,0.1)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>Total Liab. + Equity</span>
                    <span className="au-mono" style={{ color: "#60A5FA" }}>{fmtDec(bs.totalLiabEq)}</span>
                  </div>
                  {Math.abs(bs.totalAssets - bs.totalLiabEq) > 1 && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#FBBF24", background: "rgba(251,191,36,0.08)", padding: "0.5rem 0.75rem", borderRadius: 7, lineHeight: 1.6 }}>
                      ⚠ Doesn&apos;t balance by {fmt(Math.abs(bs.totalAssets - bs.totalLiabEq))} — some accounts may be unclassified
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ LEDGER VIEW ═══════════════════════════════════════════════ */}
            {tab === "ledger" && (
              <div>
                <div style={{ marginBottom: "1rem" }}>
                  <select value={selectedAccount ?? ""} onChange={e => setSelectedAccount(e.target.value || null)} style={{ ...inp, minWidth: 280 }}>
                    <option value="">— Select Account —</option>
                    {accounts.sort((a,b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                {selectedAccount && (
                  <div className="au-card">
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{accounts.find(a => a.id === selectedAccount)?.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.3)", marginBottom: "1rem" }}>{ledgerLines.length} transaction{ledgerLines.length !== 1 ? "s" : ""}</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead><tr style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.03)" }}>
                          <th style={{ textAlign: "left" }}>Entry</th>
                          <th style={{ textAlign: "left" }}>Date</th>
                          <th style={{ textAlign: "left" }}>Narration</th>
                          <th style={{ textAlign: "right" }}>DR (₹)</th>
                          <th style={{ textAlign: "right" }}>CR (₹)</th>
                        </tr></thead>
                        <tbody>
                          {ledgerLines.map(l => {
                            const j = ledgerJournals.get(l.journal_id);
                            return (
                              <tr key={l.id} className="au-tr" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <td className="au-mono" style={{ color: "rgba(232,237,245,0.4)", fontSize: "0.7rem" }}>{j?.entry_no}</td>
                                <td style={{ color: "rgba(232,237,245,0.5)", whiteSpace: "nowrap" }}>{j ? new Date(j.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" }) : ""}</td>
                                <td style={{ color: "rgba(232,237,245,0.6)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j?.narration || l.narration}</td>
                                <td className="au-mono" style={{ textAlign: "right", color: l.dr_amount > 0 ? "#34D399" : "rgba(232,237,245,0.2)" }}>{l.dr_amount > 0 ? fmtDec(l.dr_amount) : "—"}</td>
                                <td className="au-mono" style={{ textAlign: "right", color: l.cr_amount > 0 ? "#60A5FA" : "rgba(232,237,245,0.2)" }}>{l.cr_amount > 0 ? fmtDec(l.cr_amount) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>
                            <td colSpan={3} style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.75rem" }}>CLOSING BALANCE</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#34D399" }}>{fmtDec(ledgerLines.reduce((s,l) => s+l.dr_amount,0))}</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#60A5FA" }}>{fmtDec(ledgerLines.reduce((s,l) => s+l.cr_amount,0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
