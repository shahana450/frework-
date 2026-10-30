"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTally, tallyCompanyNow } from "@/lib/tallyConnection";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { tallyFetch, parseTallyVouchers, tallyVoucherTypeToFP, tallyParentToType, monthsInRange, VOUCHER_FETCH_XML } from "@/lib/tallyUtils";
import { readTallyLedgerGroups, importTallyVouchers, summaryText } from "@/lib/integrations/tallyClient";
import { buildTrialBalance, buildPL, buildBS, loadBookLines, GROUP_LABEL, statementAmount, type TBRow, type BookLine, type Account as BookAccount } from "@/lib/books";
import { readActiveBusiness } from "@/lib/activeBusiness";

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
  critical:      { label: "Critical",       icon: "🔴", color: "#C2321F", bg: "rgba(194,50,31,0.07)", border: "rgba(194,50,31,0.25)" },
  compliance:    { label: "Compliance",     icon: "⚖️",  color: "#B4561E", bg: "rgba(180,86,30,0.07)",  border: "rgba(180,86,30,0.25)"  },
  documentation: { label: "Documentation", icon: "📋", color: "#8A5A00", bg: "rgba(184,120,0,0.07)",  border: "rgba(184,120,0,0.25)"  },
  timing:        { label: "Timing",         icon: "🕐", color: "#5B4BC4", bg: "rgba(91,75,196,0.07)", border: "rgba(91,75,196,0.25)" },
  pattern:       { label: "Pattern",        icon: "🔁", color: "#1F5EFF", bg: "rgba(31,94,255,0.07)",  border: "rgba(31,94,255,0.25)"  },
  review:        { label: "Review",         icon: "🔍", color: "#0B7A55", bg: "rgba(11,122,85,0.07)",  border: "rgba(11,122,85,0.25)"  },
};

const fmt = (n: number) => cur() + Math.abs(n).toLocaleString(activeMoney().locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDec = (n: number) => cur() + Math.abs(n).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

function isRoundNumber(n: number) { return n >= 10000 && n % 1000 === 0; }
function isWeekend(d: string) { const day = new Date(d).getDay(); return day === 0 || day === 6; }

// Returns true if an account name looks like a cash ledger (not bank)
const BANK_KEYWORDS = ["bank", "hdfc", "sbi", "icici", "axis", "kotak", "yes bank", "pnb", "canara", "union bank",
  "indian bank", "uco", "central bank", "idbi", "indusind", "rbl", "federal", "current a/c",
  "savings a/c", "od a/c", "cc a/c", "overdraft", "neft", "rtgs", "imps"];

function isBankAccount(name: string): boolean {
  const n = name.toLowerCase();
  return BANK_KEYWORDS.some(k => n.includes(k));
}

function isCashAccount(name: string): boolean {
  const n = name.toLowerCase();
  if (/\bcash\b/.test(n) || n.includes("petty cash") || n.includes("cash in hand") || n.includes("cash at hand")) return true;
  if (BANK_KEYWORDS.some(k => n.includes(k))) return false;
  return false;
}

// Narration keyword hints for TDS applicability
function tdsHint(narration: string, accNames: string[]): string | null {
  const n = (narration + " " + accNames.join(" ")).toLowerCase();
  if (/rent|lease|premises|property|space/.test(n)) return "Rent — TDS @10% u/s 194-I (IT Act 2025, Sch. IV)";
  if (/professional|consultant|legal|audit|ca |cs |doctor|medical|architect|engineer/.test(n)) return "Professional fee — TDS @10% u/s 194-J (IT Act 2025, Sch. IV)";
  if (/contract|labour|work|transport|freight|clearing|loading/.test(n)) return "Contractor — TDS @1-2% u/s 194-C (IT Act 2025, Sch. IV)";
  if (/commission|brokerage|agent/.test(n)) return "Commission — TDS @5% u/s 194-H (IT Act 2025, Sch. IV)";
  if (/interest/.test(n) && !BANK_KEYWORDS.some(k => n.includes(k))) return "Interest — TDS @10% u/s 194-A (IT Act 2025, Sch. IV)";
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
        detail: `Debit ${cur()}${j.total_debit.toFixed(2)} ≠ Credit ${cur()}${j.total_credit.toFixed(2)}. Violates fundamental accounting equation (AS-1 / Ind AS 1).`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    if (j.total_debit === 0 && j.total_credit === 0)
      flags.push({ ...j, amount: 0, category: "critical", severity: "high",
        reason: "Zero-amount entry — no financial effect recorded",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // ── INCOME TAX ACT 2025 ──────────────────────────────────────────────────
    // Sec 269ST equivalent (Chapter XX-B restated in IT Act 2025):
    // No person shall receive ≥ ₹2L in cash from a single person in a day/single transaction
    if (amt >= 200000 && cashJournalIds.has(j.id) && (j.type === "receipt" || j.type === "payment" || j.type === "contra"))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Cash transaction ≥ ₹2 lakh — IT Act 2025, Sec 269ST equivalent",
        detail: `Cash ledger: ${cashAccName.get(j.id) ?? "Cash"}. Penalty = 100% of amount received. Exempt: Govt receipts, bank withdrawals, transactions through banking channel.`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // Sec 40A(3) equivalent — cash payment ≥ ₹10k for business expense → not deductible
    if (amt >= 10000 && cashJournalIds.has(j.id) && (j.type === "payment" || j.type === "expense"))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Cash payment ≥ ₹10k for expense — disallowed u/s 40A(3) [IT Act 2025]",
        detail: "Business expense paid in cash ≥ ₹10k is disallowed as deduction (100%). Exception: transport, agriculture, villages without banking facility.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // Sec 269SS — cash loan/deposit accepted ≥ ₹20k
    const narr = (j.narration ?? "").toLowerCase();
    if (amt >= 20000 && cashJournalIds.has(j.id) && /loan|deposit|advance|borrow/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Cash loan/deposit ≥ ₹20k — violates Sec 269SS [IT Act 2025]",
        detail: "Accepting/giving loans/deposits in cash ≥ ₹20k attracts penalty equal to the amount. Must be routed through banking channel.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // ── TDS CHECKS (IT Act 2025 / Old Act equivalent sections) ──────────────
    // 194-C: Contractor payment ≥ ₹30k single / ₹1L aggregate
    if (amt >= 30000 && (j.type === "payment") &&
        /contract|labour|work order|transport|freight|clearing|loading|construction/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Contractor payment ≥ ₹30k — TDS @1-2% u/s 194-C [IT Act 2025, Sch. IV]",
        detail: `Individual/HUF: 1%, Others: 2%. Aggregate threshold: ₹1L/year per contractor. Verify TDS deducted & deposited by 7th of next month.`,
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // 194-J: Professional fees ≥ ₹30k
    if (amt >= 30000 && (j.type === "payment") &&
        /professional|consultant|legal|audit|ca |cs |doctor|medical|architect|engineer|software|technical/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Professional fee ≥ ₹30k — TDS @10% u/s 194-J [IT Act 2025, Sch. IV]",
        detail: "TDS @10% (2% for technical services). Deposit by 7th of next month. Issue Form 16A within 15 days of due date of quarterly TDS return.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // 194-I: Rent ≥ ₹50k/month
    if (amt >= 50000 && (j.type === "payment") && /rent|lease|premises|property|space|shop|office/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Rent ≥ ₹50k/month — TDS @10% u/s 194-I [IT Act 2025, Sch. IV]",
        detail: "Plant & machinery: 2%, Land/building/furniture: 10%. Deposit by 30th Apr for Mar quarter, 7th of next month otherwise.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // 194-H: Commission/brokerage ≥ ₹15k
    if (amt >= 15000 && (j.type === "payment") && /commission|brokerage|agency|agent/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Commission/brokerage ≥ ₹15k — TDS @5% u/s 194-H [IT Act 2025, Sch. IV]",
        detail: "TDS @5% on commission/brokerage payments. Threshold ₹15k per year per payee.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // 194-A: Interest to NON-BANK party ≥ ₹5k
    // Exempt: interest paid TO a bank/financial institution (Sec 194-A(3)(iii))
    // Check credit-side accounts — if any is a bank ledger, no TDS applies
    const creditAccNames = jLines.filter(l => l.cr_amount > 0).map(l => accMap.get(l.account_id)?.name ?? "");
    const interestPaidToBank = creditAccNames.some(n => isBankAccount(n)) ||
      /\bbank\b|od interest|overdraft interest|bank interest|loan interest.*bank|hdfc|sbi|icici|axis|kotak/.test(narr);
    if (amt >= 5000 && j.type === "payment" && /interest/.test(narr) && !interestPaidToBank)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Interest to non-bank party — TDS @10% u/s 194-A [IT Act 2025, Sch. IV]",
        detail: "TDS @10% on interest paid to non-banking entities if ≥ ₹5k/year. Exempt: interest paid to banks, financial institutions, or government (Sec 194-A(3)(iii)).",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // Generic payment ≥ ₹30k without reference — check TDS applicability
    if (amt >= 30000 && j.type === "payment" && !j.reference_no) {
      const hint = tdsHint(j.narration ?? "", jAccNames);
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Payment ≥ ₹30k without bill reference — verify TDS applicability",
        detail: hint ?? "Cross-check against TDS sections 192/194A/194C/194I/194J (IT Act 2025, Schedule IV). Deposit TDS by 7th of next month.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });
    }

    // ── GST CHECKS ───────────────────────────────────────────────────────────
    // E-invoice mandatory for turnover >₹5Cr — sales ≥ ₹2L without reference
    if (amt >= 200000 && j.type === "sales" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "high",
        reason: "Sales ≥ ₹2L with no invoice reference — e-Invoice IRN missing?",
        detail: "For turnover >₹5Cr, e-Invoice is mandatory (CGST Rule 48(4)). Without valid IRN, ITC for buyer is blocked & penalty u/s 122 CGST may apply.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // Credit note without original reference
    if (j.type === "credit_note" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Credit note without original invoice reference — GST CGST Rule 53",
        detail: "Credit note must reference the original tax invoice (CGST Rule 53). Without reference, ITC reversal by buyer is ambiguous.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // Debit note without reference
    if (j.type === "debit_note" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Debit note without original invoice reference — CGST Rule 53",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // Purchase without reference — ITC claim at risk
    if (amt >= 100000 && j.type === "purchase" && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Purchase ≥ ₹1L without bill reference — ITC claim at risk",
        detail: "ITC can only be claimed against a valid tax invoice (Sec 16 CGST Act). Without bill reference, ITC is not available.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // ── ACCOUNTING STANDARDS (AS / Ind AS) ──────────────────────────────────
    // AS-9 / Ind AS 115: Revenue recognition — sales recorded without reference suggests advance
    if (j.type === "sales" && amt >= 100000 && /advance|deposit|booking|token/.test(narr))
      flags.push({ ...j, amount: amt, category: "compliance", severity: "medium",
        reason: "Advance receipt recorded as Sales — revenue recognition issue (Ind AS 115)",
        detail: "Advance receipts should be credited to 'Advance from Customers' (liability), not revenue. Revenue recognised only when performance obligation is satisfied.",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

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
        action: "Add Narration", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    if ((j.type === "sales" || j.type === "purchase") && !j.reference_no)
      flags.push({ ...j, amount: amt, category: "documentation", severity: "medium",
        reason: `${j.type === "sales" ? "Sales" : "Purchase"} entry without invoice number — incomplete books`,
        detail: "Every sales/purchase must reference the invoice number for GST matching (GSTR-1 vs GSTR-2B) and audit trail.",
        action: "Add Reference", actionHref: `/finance/journals?id=${j.id}&from=audit` });

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
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });

    // ── REVIEW ──────────────────────────────────────────────────────────────
    if (amt >= 500000)
      flags.push({ ...j, amount: amt, category: "review", severity: "high",
        reason: "Large transaction above ₹5 lakh — verify approval chain",
        action: "View Entry", actionHref: `/finance/journals?id=${j.id}&from=audit` });
  }

  // Dedup by id+reason
  const seen = new Set<string>();
  return flags.filter(f => { const k = f.id + f.reason; if (seen.has(k)) return false; seen.add(k); return true; });
}

type TrialRow = { name: string; type: string; dr: number; cr: number; balance: number };
type StmtRow = { name: string; balance: number };
const stmtRows = (rows: TBRow[]): StmtRow[] => rows.map(r => ({ name: r.name, balance: statementAmount(r) }));

type ModalJournal = Journal & { modalLines?: { account: string; accountType: string; dr: number; cr: number; narration: string }[] };

export default function AuditPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const bizIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importDone, setImportDone] = useState(false);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bookLines, setBookLines] = useState<BookLine[]>([]);
  const [bookAccounts, setBookAccounts] = useState<BookAccount[]>([]);
  const [tab, setTab] = useState<"overview" | "flags" | "trial_balance" | "pl" | "balance_sheet" | "ledger">("overview");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [fys, setFys] = useState<{ id: string; label: string; start: string; end: string }[]>([]);
  // Entry detail modal
  const [modalJournal, setModalJournal] = useState<ModalJournal | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  // Flag filtering + reviewed state
  const [filterCat, setFilterCat] = useState<FlagCategory | "all">("all");
  const [filterSev, setFilterSev] = useState<"all" | "high" | "medium" | "low">("all");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [showReviewed, setShowReviewed] = useState(false);
  const [tbSearch, setTbSearch] = useState("");
  // The app-wide Tally connection
  const tally = useTally();
  const tallyCompany = tally.company;
  const tallyConnected: boolean | null = tally.status === "connected" ? true : tally.status === "error" || (tally.status === "idle" && !tally.company) ? false : null;
  const [lastSync, setLastSync] = useState<string>("");
  useEffect(() => {
    const lastImport = localStorage.getItem("fw_tally_last_import");
    if (lastImport) setLastSync(new Date(parseInt(lastImport)).toLocaleString(activeMoney().locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }));
  }, []);

  useEffect(() => {
    // Hard stop — never show spinner forever
    const mountTimer = setTimeout(() => setLoading(false), 15000);
    const saved2 = typeof window !== "undefined" ? (localStorage.getItem("fw_audit_reviewed") ?? "[]") : "[]";
    try { setReviewed(new Set(JSON.parse(saved2))); } catch { /* */ }
    // Auto-reload when Tally import fires in another tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fw_tally_last_import") {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          const bid = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
          const now2 = new Date();
          const yr2 = now2.getMonth() >= 3 ? now2.getFullYear() : now2.getFullYear() - 1;
          if (bid) loadDataByRange(bid, `${yr2}-04-01`, `${yr2 + 1}-03-31`);
        });
      }
    };
    window.addEventListener("storage", onStorage);

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved); bizIdRef.current = saved;
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
      // Open the year the business marked as current (same default as Reports and Books)
      // Open the year containing today; fall back to the one marked current
      const todayIso = now.toISOString().slice(0, 10);
      const markedCurrent = fysData?.find(f => f.is_current);
      const cur = fyList.find(f => f.start <= todayIso && f.end >= todayIso)
        ?? (markedCurrent && fyList.find(f => f.id === markedCurrent.id)) ?? fyList[0];
      setFyId(cur.id);
      await loadDataByRange(saved, cur.start, cur.end);
    });

    return () => { window.removeEventListener("storage", onStorage); clearTimeout(mountTimer); };
  }, []);

  async function loadDataByRange(bid: string, start: string, end: string) {
    setLoading(true);
    // Safety timeout — never hang forever
    const timer = setTimeout(() => setLoading(false), 12000);
    try {
      // Phase 1: load journals + accounts → show overview immediately
      const loadJournals = async () => {
        const out: Journal[] = [];
        for (let from = 0; ; from += 1000) {
          const { data } = await supabase.from("fw_fin_journals")
            .select("id,entry_no,date,narration,type,status,total_debit,total_credit,financial_year_id,reference_no")
            .eq("business_id", bid).in("status", ["posted", "draft"]).gte("date", start).lte("date", end).order("date").range(from, from + 999);
          out.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return out;
      };
      const [journalData, aRes] = await Promise.all([loadJournals(), supabase.from("fw_fin_chart_of_accounts").select("id,name,type").eq("business_id", bid)]);
      setBookLines([]);
      setJournals(journalData);
      // Ledger balances for TB / P&L / BS: every posted line up to the year end (brought-forward included)
      loadBookLines(supabase, bid, end).then(r => { setBookLines(r.lines); setBookAccounts(r.accounts); });
      setAccounts(aRes.data ?? []);
      clearTimeout(timer);
      setLoading(false); // show overview now
      // Phase 2: load journal lines in background for detail tabs
      const jIds = journalData.map(j => j.id);
      const allLines: JournalLine[] = [];
      for (let i = 0; i < jIds.length; i += 150) {
        for (let from = 0; ; from += 1000) {
          const { data: batch } = await supabase.from("fw_fin_journal_lines")
            .select("id,journal_id,account_id,narration,dr_amount,cr_amount").in("journal_id", jIds.slice(i, i + 150)).range(from, from + 999);
          allLines.push(...(batch ?? []));
          if (!batch || batch.length < 1000) break;
        }
      }
      setLines(allLines);
    } catch {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function quickImport() {
    const bid = bizIdRef.current;
    if (importing || importDone || !bid) return;
    setImporting(true); setImportMsg("Connecting to Tally…");
    try {
      const port = localStorage.getItem("fw_tally_port") ?? "7001";
      const tallyUrl = `http://localhost:${port}`;
      const now = new Date();
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyFrom = `${fyStartYear}-04-01`, fyTo = `${fyStartYear + 1}-03-31`;
      const months = monthsInRange(fyFrom, fyTo);
      const allVouchers: ReturnType<typeof parseTallyVouchers> = [];
      for (let i = 0; i < months.length; i++) {
        const { from: mf, to: mt, label } = months[i];
        setImportMsg(`Fetching ${label} (${i + 1}/${months.length})…`);
        try {
          const res = await tallyFetch(tallyUrl, VOUCHER_FETCH_XML(mf.replace(/-/g,""), mt.replace(/-/g,"")), 30000);
          allVouchers.push(...parseTallyVouchers(await res.text()));
        } catch { /* skip month on error */ }
        if (i < months.length - 1) await new Promise(r => setTimeout(r, 1000));
      }
      if (!allVouchers.length) { setImportMsg("No vouchers found in Tally for this FY. Check that the correct company is open."); setImporting(false); return; }
      // Through FreWork's posting engine: validated, year-lock aware, audit-logged, never imported twice
      const groups = await readTallyLedgerGroups(tallyUrl, tallyCompanyNow());
      const sum = await importTallyVouchers(bid, allVouchers, { ledgerGroups: groups, company: tallyCompanyNow(), onProgress: setImportMsg });
      try { localStorage.setItem("fw_tally_last_import", Date.now().toString()); } catch { /* */ }
      setImportMsg(summaryText(sum));
      if (sum.imported > 0) setImportDone(true);
      // Reload audit data
      await loadDataByRange(bid, fyFrom, fyTo);
      const d = new Date(); setLastSync(d.toLocaleString(activeMoney().locale, { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }));
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
    setImporting(false);
  }

  // Auto-detect bridge on load — if bridge running and no data, auto-start import
  useEffect(() => {
    if (journals.length > 0 || importDone) return;
    const lastImport = localStorage.getItem("fw_tally_last_import");
    if (lastImport && Date.now() - parseInt(lastImport) < 5 * 60 * 1000) return;
    const delay = setTimeout(() => {
      if (journals.length > 0 || importDone) return;
      fetch("http://localhost:7002", { method:"POST", headers:{"Content-Type":"text/xml"}, body:"<ping/>", signal: AbortSignal.timeout(2500) })
        .then(() => { if (bizIdRef.current) quickImport(); })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journals.length, bizId, importDone]);

  async function openEntryModal(journalId: string) {
    const j = journals.find(x => x.id === journalId);
    if (!j) return;
    setModalJournal(j);
    setModalLoading(true);
    const { data: jLines } = await supabase.from("fw_fin_journal_lines")
      .select("id,account_id,narration,dr_amount,cr_amount").eq("journal_id", journalId);
    const accMap = new Map(accounts.map(a => [a.id, a]));
    const modalLines = (jLines ?? []).map(l => ({
      account: accMap.get(l.account_id)?.name ?? l.account_id.slice(0,8),
      accountType: accMap.get(l.account_id)?.type ?? "",
      dr: l.dr_amount || 0, cr: l.cr_amount || 0, narration: l.narration || "",
    }));
    setModalJournal({ ...j, modalLines });
    setModalLoading(false);
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
  // TB, P&L and BS come from the shared engine so they match the ledger and the Reports page
  const fyRange = fys.find(f => f.id === fyId);
  const engineTb = fyRange ? buildTrialBalance(bookAccounts, bookLines, fyRange.start, fyRange.end) : [];
  const pl = buildPL(engineTb);
  const engineBs = buildBS(engineTb, pl.netProfit);
  const tb: TrialRow[] = engineTb.map(r => ({ name: r.name, type: GROUP_LABEL[r.group], dr: r.dr, cr: r.cr, balance: r.balance }));
  const bs = {
    assets: stmtRows(engineBs.currentAssets), fixedAssets: stmtRows(engineBs.fixedAssets),
    equity: stmtRows(engineBs.capital), loans: stmtRows(engineBs.loans),
    liabilities: stmtRows(engineBs.currentLiabilities), taxes: stmtRows(engineBs.duties),
    totalAssets: engineBs.totalAssets, totalLiabEq: engineBs.totalLiabEq,
  };

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

  const inp: React.CSSProperties = { background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.15)", color: "#141A3A", padding: "5px 10px", borderRadius: 7, fontSize: "0.8rem", fontFamily: "inherit", outline: "none", cursor: "pointer" };
  const ledgerLines = selectedAccount ? lines.filter(l => l.account_id === selectedAccount && journalIds.has(l.journal_id)) : [];
  const ledgerJournals = new Map(journals.map(j => [j.id, j]));
  const filteredTb = tb.filter(r => !tbSearch || r.name.toLowerCase().includes(tbSearch.toLowerCase()) || r.type.toLowerCase().includes(tbSearch.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .au-card { background: #FFFFFF; border: 1px solid rgba(20,26,58,0.11); border-radius: 14px; padding: 1.25rem 1.4rem; }
        .au-tab { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.82rem; font-weight: 600; padding: 8px 14px; border-radius: 8px; transition: all 0.15s; color: rgba(20,26,58,0.65); white-space: nowrap; }
        .au-tab:hover { color: rgba(20,26,58,0.95); background: #FFFFFF; }
        .au-tab-active { color: #141A3A; background: #FFFFFF; }
        .au-tr:hover td { background: #FFFFFF; }
        td, th { padding: 0.45rem 0.85rem; }
        .au-mono { font-family: 'IBM Plex Mono', monospace; }
        select option { background: #FFFFFF; }
        .au-flag { border-radius: 11px; padding: 0.9rem 1.05rem; transition: opacity 0.15s; }
        .au-flag-reviewed { opacity: 0.4; }
        .au-catbtn { background: none; border: 1px solid rgba(20,26,58,0.12); border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.75rem; font-weight: 600; padding: 5px 11px; transition: all 0.15s; color: rgba(20,26,58,0.70); display: flex; align-items: center; gap: 5px; }
        .au-catbtn:hover { border-color: rgba(20,26,58,0.20); color: rgba(20,26,58,1.00); }
        .au-catbtn-active { color: #141A3A !important; }
        .au-act { font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 6px; border: none; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: opacity 0.15s; }
        .au-act:hover { opacity: 0.8; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C9CEDF; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(20,26,58,0.10)", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", height: 52, position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", zIndex: 30 }}>
        <Link href="/finance" style={{ color: "#1F5EFF", fontWeight: 700, textDecoration: "none", fontSize: "0.88rem" }}>← Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.35)" }}>›</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Audit & Reports</span>
        {criticalCount > 0 && (
          <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "rgba(194,50,31,0.15)", border: "1px solid rgba(194,50,31,0.3)", color: "#C2321F", padding: "2px 9px", borderRadius: 20 }}>
            {criticalCount} critical
          </span>
        )}
        <div style={{ flex: 1 }} />
        <select value={fyId ?? ""} onChange={e => switchFy(e.target.value)} style={inp}>
          {fys.map(f => <option key={f.id} value={f.id}>FY {f.label.replace(/^FY\s*/i, "")}</option>)}
        </select>
        <Link href="/finance/audit/gst-recon" style={{ fontSize: "0.78rem", color: "#5B4BC4", background: "rgba(91,75,196,0.08)", border: "1px solid rgba(91,75,196,0.2)", padding: "5px 12px", borderRadius: 7, textDecoration: "none", fontWeight: 600 }}>
          🏷 GST Recon
        </Link>
        <Link href="/finance/tally" style={{ fontSize: "0.78rem", color: "#0B7A55", background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.2)", padding: "5px 12px", borderRadius: 7, textDecoration: "none", fontWeight: 600 }}>
          ⬇ Sync Tally
        </Link>
      </nav>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", flexWrap: "wrap", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`au-tab${tab === t.key ? " au-tab-active" : ""}`}>{t.label}</button>
          ))}
        </div>

        {/* Tally sync status bar */}
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
          {/* Connection */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: tallyConnected ? "rgba(11,122,85,0.07)" : tallyConnected === false ? "rgba(107,114,128,0.07)" : "rgba(107,114,128,0.05)", border: `1px solid ${tallyConnected ? "rgba(11,122,85,0.2)" : "rgba(107,114,128,0.15)"}`, borderRadius: 8, padding: "5px 10px" }}>
            <span style={{ fontSize: "0.5rem", color: tallyConnected ? "#0B7A55" : tallyConnected === false ? "#6B7280" : "#6B7280" }}>●</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: tallyConnected ? "#0B7A55" : "#6B7280" }}>
              {tallyConnected === null ? "Checking Tally…" : tallyConnected ? "Tally Connected" : "Tally Not Connected"}
            </span>
            {tallyCompany && <span style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.85)", borderLeft: "1px solid rgba(20,26,58,0.15)", paddingLeft: 8 }}>{tallyCompany}</span>}
          </div>
          {/* Vouchers */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(31,94,255,0.06)", border: "1px solid rgba(31,94,255,0.15)", borderRadius: 8, padding: "5px 10px" }}>
            <span style={{ fontSize: "0.72rem" }}>🧾</span>
            <span style={{ fontSize: "0.75rem", color: journals.length > 0 ? "#1F5EFF" : "#6B7280", fontWeight: 600 }}>
              {journals.length > 0 ? `${journals.length} Vouchers` : "No Vouchers"}
            </span>
            <span style={{ fontSize: "0.68rem", color: journals.length > 0 ? "rgba(31,94,255,0.7)" : "#4B5563" }}>
              {journals.length > 0 ? "imported" : "not imported"}
            </span>
          </div>
          {/* Ledgers / Accounts */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(91,75,196,0.06)", border: "1px solid rgba(91,75,196,0.15)", borderRadius: 8, padding: "5px 10px" }}>
            <span style={{ fontSize: "0.72rem" }}>📒</span>
            <span style={{ fontSize: "0.75rem", color: accounts.length > 0 ? "#5B4BC4" : "#6B7280", fontWeight: 600 }}>
              {accounts.length > 0 ? `${accounts.length} Ledgers` : "No Ledgers"}
            </span>
            <span style={{ fontSize: "0.68rem", color: accounts.length > 0 ? "rgba(91,75,196,0.7)" : "#4B5563" }}>
              {accounts.length > 0 ? "synced" : "not synced"}
            </span>
          </div>
          {/* Last sync */}
          {lastSync && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(184,120,0,0.05)", border: "1px solid rgba(184,120,0,0.12)", borderRadius: 8, padding: "5px 10px" }}>
              <span style={{ fontSize: "0.72rem" }}>🕐</span>
              <span style={{ fontSize: "0.72rem", color: "rgba(184,120,0,0.7)" }}>Last sync: {lastSync}</span>
            </div>
          )}
          {/* Action / progress */}
          {importing ? (
            <div style={{ marginLeft: "auto", fontSize: "0.73rem", color: "#1F5EFF", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #1F5EFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              {importMsg}
            </div>
          ) : importDone ? (
            <div style={{ marginLeft: "auto", fontSize: "0.73rem", color: "#0B7A55", fontWeight: 600 }}>{importMsg}</div>
          ) : importMsg.startsWith("Error:") ? (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.72rem", color: "#C2321F" }}>{importMsg}</span>
              <button onClick={() => { setImportMsg(""); quickImport(); }} style={{ fontSize: "0.72rem", fontWeight: 700, color: "#C2321F", background: "rgba(194,50,31,0.08)", border: "1px solid rgba(194,50,31,0.2)", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                Retry
              </button>
            </div>
          ) : journals.length === 0 ? (
            <button onClick={quickImport} disabled={importing} style={{ marginLeft: "auto", fontSize: "0.75rem", fontWeight: 700, color: "#0B7A55", background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.2)", padding: "5px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>
              ⬇ Sync Now
            </button>
          ) : null}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "rgba(20,26,58,0.55)", fontSize: "0.88rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>Loading data…
          </div>
        ) : journals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{importing ? "⏳" : "📥"}</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#141A3A", marginBottom: "0.4rem" }}>
              {importing ? "Importing from Tally…" : "No vouchers imported yet"}
            </div>
            <div style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.84rem", marginBottom: importing ? "0.5rem" : "1.75rem" }}>
              {importing ? importMsg : "Import your Tally data once — all reports fill in automatically."}
            </div>
            {importing && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
                <div style={{ width: 180, height: 4, background: "#FFFFFF", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#1F5EFF", width: "60%", borderRadius: 4, animation: "slide 1.2s ease-in-out infinite" }} />
                </div>
              </div>
            )}
            {!importing && (
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={quickImport} style={{ background: "#232A63", color: "#fff", border: "none", padding: "12px 28px", borderRadius: 9, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit" }}>
                  ⬇ Import from Tally
                </button>
                <Link href="/finance/tally" style={{ background: "transparent", color: "#6B7280", border: "1px solid #5A6080", padding: "12px 20px", borderRadius: 9, textDecoration: "none", fontWeight: 600, fontSize: "0.88rem", display: "inline-flex", alignItems: "center" }}>
                  Tally Sync page →
                </Link>
              </div>
            )}
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
                      { label: "Revenue",      value: fmt(pl.revenue),   color: "#0B7A55" },
                      { label: "Net Profit",   value: (pl.netProfit < 0 ? "−" : "") + fmt(pl.netProfit), color: pl.netProfit >= 0 ? "#0B7A55" : "#C2321F" },
                      { label: "Total Entries",value: String(journals.length), color: "#1F5EFF" },
                      { label: "Open Findings",value: String(unreviewedCount), color: unreviewedCount > 0 ? (criticalCount > 0 ? "#C2321F" : "#8A5A00") : "#0B7A55" },
                    ].map(k => (
                      <div key={k.label} className="au-card">
                        <div style={{ fontSize: "0.57rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.7rem" }}>{k.label}</div>
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
                      { label: "Sales / Revenue",      val: pl.revenue,     color: "#0B7A55" },
                      { label: "Purchase / Direct Exp",val: -pl.cogs,       color: "#C2321F" },
                      { label: "Gross Profit",          val: pl.grossProfit, color: "#1F5EFF", bold: true },
                      ...(pl.otherIncome ? [{ label: "Indirect Income", val: pl.otherIncome, color: "#0B7A55" }] : []),
                      { label: "Indirect Expenses",    val: -pl.expenses,   color: "#C2321F" },
                      { label: pl.netProfit >= 0 ? "Net Profit" : "Net Loss", val: pl.netProfit, color: pl.netProfit >= 0 ? "#0B7A55" : "#C2321F", bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.38rem 0", borderTop: "1px solid rgba(20,26,58,0.10)", fontWeight: r.bold ? 700 : 400, fontSize: r.bold ? "0.88rem" : "0.83rem" }}>
                        <span style={{ color: "rgba(20,26,58,0.85)" }}>{r.label}</span>
                        <span className="au-mono" style={{ color: r.color }}>{r.val < 0 ? "−" : ""}{fmt(r.val)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recent entries */}
                  <div className="au-card">
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Recent Transactions</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead><tr style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          <th style={{ textAlign: "left" }}>Entry</th><th style={{ textAlign: "left" }}>Date</th><th style={{ textAlign: "left" }}>Type</th><th style={{ textAlign: "left" }}>Narration</th><th style={{ textAlign: "right" }}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {journals.slice(-10).reverse().map(j => (
                            <tr key={j.id} className="au-tr" style={{ borderTop: "1px solid rgba(20,26,58,0.10)" }}>
                              <td className="au-mono" style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.7rem" }}>{j.entry_no}</td>
                              <td style={{ color: "rgba(20,26,58,0.75)", whiteSpace: "nowrap" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                              <td><span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#1F5EFF", background: "rgba(31,94,255,0.1)", padding: "2px 7px", borderRadius: 20 }}>{j.type}</span></td>
                              <td style={{ color: "rgba(20,26,58,0.85)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                              <td className="au-mono" style={{ textAlign: "right", color: "#0B7A55" }}>{fmt(Math.max(j.total_debit, j.total_credit))}</td>
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
                      {unreviewedCount > 0 && <span style={{ float: "right", fontSize: "0.72rem", color: "#C2321F", fontWeight: 700 }}>{unreviewedCount} open</span>}
                    </div>
                    {(Object.keys(CAT_META) as FlagCategory[]).map(cat => {
                      const c = CAT_META[cat]; const cnt = catCounts[cat];
                      if (!cnt.total) return null;
                      return (
                        <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.45rem 0", borderTop: "1px solid rgba(20,26,58,0.10)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: "0.85rem" }}>{c.icon}</span>
                            <span style={{ fontSize: "0.8rem", color: "rgba(20,26,58,0.95)" }}>{c.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {cnt.unreviewed > 0 && <span style={{ fontSize: "0.68rem", fontWeight: 800, color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: "1px 8px", borderRadius: 20 }}>{cnt.unreviewed}</span>}
                            {cnt.unreviewed < cnt.total && <span style={{ fontSize: "0.62rem", color: "rgba(20,26,58,0.35)" }}>+{cnt.total - cnt.unreviewed} done</span>}
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
                    <div style={{ background: "rgba(180,86,30,0.07)", border: "1px solid rgba(180,86,30,0.25)", borderRadius: 11, padding: "0.85rem 1rem", marginBottom: "1rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#B4561E", marginBottom: "0.4rem" }}>⚖️ {complianceCount} Compliance Issue{complianceCount !== 1 ? "s" : ""}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(180,86,30,0.7)", lineHeight: 1.6 }}>Cash transactions, TDS thresholds, and GST compliance items need immediate attention.</div>
                      <button onClick={() => { setFilterCat("compliance"); setTab("flags"); }} style={{ marginTop: "0.6rem", background: "rgba(180,86,30,0.15)", border: "1px solid rgba(180,86,30,0.3)", color: "#B4561E", padding: "4px 12px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Review Compliance →
                      </button>
                    </div>
                  )}

                  {/* Balance sheet balance indicator */}
                  <div className="au-card">
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.75rem" }}>Balance Sheet Check</div>
                    {Math.abs(bs.totalAssets - bs.totalLiabEq) < 1 ? (
                      <div style={{ fontSize: "0.8rem", color: "#0B7A55" }}>✓ Balanced — Assets = Liab + Equity</div>
                    ) : (
                      <div style={{ fontSize: "0.78rem", color: "#8A5A00", lineHeight: 1.6 }}>
                        ⚠ Difference: {fmt(Math.abs(bs.totalAssets - bs.totalLiabEq))}<br />
                        <span style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.7rem" }}>Some entries may have missing or unclassified accounts.</span>
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
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", marginBottom: "1rem", color: "rgba(20,26,58,0.85)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Categories</div>
                  {/* All */}
                  <button onClick={() => setFilterCat("all")} className={`au-catbtn${filterCat === "all" ? " au-catbtn-active" : ""}`}
                    style={{ width: "100%", marginBottom: 4, ...(filterCat === "all" ? { background: "#FFFFFF", borderColor: "rgba(20,26,58,0.20)" } : {}) }}>
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
                        {cnt.unreviewed > 0 && <span style={{ fontSize: "0.65rem", fontWeight: 800, color: isActive ? c.color : "rgba(20,26,58,0.75)", background: isActive ? c.bg : "#FFFFFF", padding: "1px 7px", borderRadius: 20, border: isActive ? `1px solid ${c.border}` : "1px solid transparent" }}>{cnt.unreviewed}</span>}
                      </button>
                    );
                  })}

                  <div style={{ borderTop: "1px solid rgba(20,26,58,0.10)", marginTop: "0.85rem", paddingTop: "0.85rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Severity</div>
                    {(["all","high","medium","low"] as const).map(s => (
                      <button key={s} onClick={() => setFilterSev(s)} className={`au-catbtn${filterSev === s ? " au-catbtn-active" : ""}`}
                        style={{ width: "100%", marginBottom: 3, ...(filterSev === s && s !== "all" ? { color: s === "high" ? "#C2321F" : s === "medium" ? "#8A5A00" : "#1F5EFF", background: s === "high" ? "rgba(194,50,31,0.07)" : s === "medium" ? "rgba(184,120,0,0.07)" : "rgba(31,94,255,0.07)", borderColor: s === "high" ? "rgba(194,50,31,0.25)" : s === "medium" ? "rgba(184,120,0,0.25)" : "rgba(31,94,255,0.25)" } : filterSev === s ? { background: "#FFFFFF", color: "#141A3A" } : {}) }}>
                        {s === "all" ? "All severities" : `${s === "high" ? "🔴" : s === "medium" ? "🟡" : "🔵"} ${s.charAt(0).toUpperCase() + s.slice(1)}`}
                      </button>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid rgba(20,26,58,0.10)", marginTop: "0.85rem", paddingTop: "0.85rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "rgba(20,26,58,0.75)", cursor: "pointer" }}>
                      <input type="checkbox" checked={showReviewed} onChange={e => setShowReviewed(e.target.checked)} style={{ accentColor: "#0B7A55" }} />
                      Show reviewed
                    </label>
                    {reviewed.size > 0 && (
                      <button onClick={() => { setReviewed(new Set()); localStorage.removeItem("fw_audit_reviewed"); }}
                        style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#C2321F", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                        Clear all reviews ({reviewed.size})
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: flag cards */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                    <div style={{ fontSize: "0.82rem", color: "rgba(20,26,58,0.65)" }}>
                      {visibleFlags.length} finding{visibleFlags.length !== 1 ? "s" : ""}
                      {filterCat !== "all" && <span style={{ color: CAT_META[filterCat].color }}> · {CAT_META[filterCat].label}</span>}
                    </div>
                    {visibleFlags.length > 0 && (
                      <button onClick={() => visibleFlags.forEach(f => markReviewed(f.id + f.reason))}
                        style={{ fontSize: "0.72rem", color: "#0B7A55", background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.2)", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                        ✓ Mark all reviewed
                      </button>
                    )}
                  </div>

                  {visibleFlags.length === 0 ? (
                    <div className="au-card" style={{ textAlign: "center", padding: "3.5rem" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
                      <div style={{ color: "rgba(20,26,58,0.75)", fontSize: "0.88rem" }}>
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
                                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: f.severity === "high" ? "#C2321F" : f.severity === "medium" ? "#8A5A00" : "#1F5EFF", textTransform: "uppercase" }}>{f.severity}</span>
                                </div>
                                {/* Reason */}
                                <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#141A3A", marginBottom: f.detail ? "0.2rem" : 0 }}>{f.reason}</div>
                                {/* Detail */}
                                {f.detail && <div style={{ fontSize: "0.73rem", color: "rgba(20,26,58,0.70)", lineHeight: 1.55 }}>{f.detail}</div>}
                                {/* Meta row */}
                                <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.85rem", fontSize: "0.72rem", color: "rgba(20,26,58,0.60)", flexWrap: "wrap" }}>
                                  <span className="au-mono">{f.entry_no}</span>
                                  <span>{new Date(f.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                  <span style={{ background: "rgba(31,94,255,0.1)", color: "#1F5EFF", padding: "0px 6px", borderRadius: 20, fontWeight: 700 }}>{f.type}</span>
                                  <span style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.narration}</span>
                                </div>
                              </div>
                              {/* Amount + actions */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                                <div className="au-mono" style={{ fontWeight: 800, color: "#141A3A", fontSize: "0.9rem" }}>{fmt(f.amount)}</div>
                                <div style={{ display: "flex", gap: 5 }}>
                                  {f.actionHref && (
                                    <button onClick={() => openEntryModal(f.id)} className="au-act" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
                                      {f.action ?? "View"}
                                    </button>
                                  )}
                                  <button onClick={() => markReviewed(key)} className="au-act"
                                    style={{ background: isRev ? "rgba(11,122,85,0.12)" : "#FFFFFF", border: isRev ? "1px solid rgba(11,122,85,0.3)" : "1px solid #FFFFFF", color: isRev ? "#0B7A55" : "rgba(20,26,58,0.65)" }}>
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
                      <tr style={{ background: "#FFFFFF", color: "rgba(20,26,58,0.60)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <th style={{ textAlign: "left" }}>Account</th>
                        <th style={{ textAlign: "left" }}>Type</th>
                        <th style={{ textAlign: "right" }}>Debit (₹)</th>
                        <th style={{ textAlign: "right" }}>Credit (₹)</th>
                        <th style={{ textAlign: "right" }}>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTb.map(r => (
                        <tr key={r.name} className="au-tr" style={{ borderTop: "1px solid rgba(20,26,58,0.10)", cursor: "pointer" }}
                          onClick={() => { setSelectedAccount(accounts.find(a => a.name === r.name)?.id ?? null); setTab("ledger"); }}>
                          <td style={{ color: "#1F5EFF", fontWeight: 500 }}>{r.name}</td>
                          <td><span style={{ fontSize: "0.62rem", color: "rgba(20,26,58,0.60)", background: "#FFFFFF", padding: "1px 7px", borderRadius: 20 }}>{r.type}</span></td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.dr > 0 ? "#141A3A" : "rgba(20,26,58,0.28)" }}>{r.dr > 0 ? fmt(r.dr) : "—"}</td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.cr > 0 ? "#141A3A" : "rgba(20,26,58,0.28)" }}>{r.cr > 0 ? fmt(r.cr) : "—"}</td>
                          <td className="au-mono" style={{ textAlign: "right", color: r.balance >= 0 ? "#0B7A55" : "#C2321F", fontWeight: 600 }}>{r.balance < 0 ? "−" : ""}{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid rgba(20,26,58,0.15)", fontWeight: 800 }}>
                        <td colSpan={2} style={{ color: "rgba(20,26,58,0.75)", fontSize: "0.78rem" }}>TOTAL</td>
                        <td className="au-mono" style={{ textAlign: "right", color: "#0B7A55" }}>{fmt(filteredTb.reduce((s,r) => s+r.dr,0))}</td>
                        <td className="au-mono" style={{ textAlign: "right", color: "#1F5EFF" }}>{fmt(filteredTb.reduce((s,r) => s+r.cr,0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "rgba(20,26,58,0.28)" }}>
                  {tb.length} accounts · Click any row to drill into ledger transactions
                </div>
              </div>
            )}

            {/* ══ P&L ═══════════════════════════════════════════════════════ */}
            {tab === "pl" && (
              <div className="au-card">
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1.25rem" }}>Profit & Loss Statement</div>
                {[
                  { title: "SALES / DIRECT INCOME", rows: stmtRows(pl.sales), color: "#0B7A55" },
                  { title: "PURCHASES / DIRECT EXPENSES (COGS)", rows: stmtRows(pl.purchases), color: "#C2321F" },
                  { title: "INDIRECT INCOME", rows: stmtRows(pl.indirectIncome), color: "#0B7A55" },
                  { title: "INDIRECT EXPENSES", rows: stmtRows(pl.indirectExpenses), color: "#B4561E" },
                ].map(sec => sec.rows.length === 0 ? null : (
                  <div key={sec.title} style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "0.6rem", fontWeight: 700, color: sec.color, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.5rem", padding: "0.35rem 0", borderBottom: `1px solid ${sec.color}22` }}>{sec.title}</div>
                    {sec.rows.map(r => (
                      <div key={r.name} onClick={() => { const id = accounts.find(a => a.name === r.name)?.id; if (id) { setSelectedAccount(id); setTab("ledger"); } }} style={{ display: "flex", justifyContent: "space-between", padding: "0.38rem 0", fontSize: "0.84rem", cursor: "pointer" }}>
                        <span style={{ color: "rgba(20,26,58,0.90)" }}>{r.name}</span>
                        <span className="au-mono" style={{ color: r.balance < 0 ? "#C2321F" : undefined }}>{r.balance < 0 ? "−" : ""}{fmtDec(r.balance)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderTop: "1px solid rgba(20,26,58,0.12)", fontWeight: 700, fontSize: "0.85rem" }}>
                      <span style={{ color: "rgba(20,26,58,0.65)" }}>Total</span>
                      <span className="au-mono" style={{ color: sec.color }}>{fmtDec(sec.rows.reduce((s, r) => s + r.balance, 0))}</span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: "2px solid rgba(20,26,58,0.18)", paddingTop: "1rem" }}>
                  {[
                    { label: "Gross Profit",                               val: pl.grossProfit },
                    { label: pl.netProfit >= 0 ? "Net Profit" : "Net Loss", val: pl.netProfit },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", fontWeight: 800, fontSize: "0.92rem" }}>
                      <span>{r.label}</span>
                      <span className="au-mono" style={{ color: r.val >= 0 ? "#0B7A55" : "#C2321F" }}>{r.val < 0 ? "−" : ""}{fmtDec(r.val)}</span>
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
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(20,26,58,0.55)", textTransform: "uppercase", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>{sec.title}</div>
                      {sec.rows.map(r => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                          <span style={{ color: "rgba(20,26,58,0.85)" }}>{r.name}</span>
                          <span className="au-mono" style={{ color: r.balance < 0 ? "#C2321F" : undefined }}>{r.balance < 0 ? "−" : ""}{fmtDec(r.balance)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ borderTop: "2px solid rgba(20,26,58,0.15)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>Total Assets</span>
                    <span className="au-mono" style={{ color: "#0B7A55" }}>{bs.totalAssets < 0 ? "−" : ""}{fmtDec(bs.totalAssets)}</span>
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
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(20,26,58,0.55)", textTransform: "uppercase", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>{sec.title}</div>
                      {sec.rows.map(r => (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                          <span style={{ color: "rgba(20,26,58,0.85)" }}>{r.name}</span>
                          <span className="au-mono" style={{ color: r.balance < 0 ? "#C2321F" : undefined }}>{r.balance < 0 ? "−" : ""}{fmtDec(r.balance)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {pl.netProfit !== 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", fontSize: "0.83rem" }}>
                      <span style={{ color: "rgba(20,26,58,0.85)" }}>{pl.netProfit >= 0 ? "Profit" : "Loss"} for the year (from P&amp;L)</span>
                      <span className="au-mono" style={{ color: pl.netProfit >= 0 ? "#0B7A55" : "#C2321F" }}>{pl.netProfit < 0 ? "−" : ""}{fmtDec(pl.netProfit)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "2px solid rgba(20,26,58,0.15)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>Total Liab. + Equity</span>
                    <span className="au-mono" style={{ color: "#1F5EFF" }}>{bs.totalLiabEq < 0 ? "−" : ""}{fmtDec(bs.totalLiabEq)}</span>
                  </div>
                  {Math.abs(bs.totalAssets - bs.totalLiabEq) > 1 && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#8A5A00", background: "rgba(184,120,0,0.08)", padding: "0.5rem 0.75rem", borderRadius: 7, lineHeight: 1.6 }}>
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
                    <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.55)", marginBottom: "1rem" }}>{ledgerLines.length} transaction{ledgerLines.length !== 1 ? "s" : ""}</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead><tr style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", background: "#FFFFFF" }}>
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
                              <tr key={l.id} className="au-tr" style={{ borderTop: "1px solid rgba(20,26,58,0.10)" }}>
                                <td className="au-mono" style={{ color: "rgba(20,26,58,0.65)", fontSize: "0.7rem" }}>{j?.entry_no}</td>
                                <td style={{ color: "rgba(20,26,58,0.75)", whiteSpace: "nowrap" }}>{j ? new Date(j.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" }) : ""}</td>
                                <td style={{ color: "rgba(20,26,58,0.85)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j?.narration || l.narration}</td>
                                <td className="au-mono" style={{ textAlign: "right", color: l.dr_amount > 0 ? "#0B7A55" : "rgba(20,26,58,0.28)" }}>{l.dr_amount > 0 ? fmtDec(l.dr_amount) : "—"}</td>
                                <td className="au-mono" style={{ textAlign: "right", color: l.cr_amount > 0 ? "#1F5EFF" : "rgba(20,26,58,0.28)" }}>{l.cr_amount > 0 ? fmtDec(l.cr_amount) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid rgba(20,26,58,0.12)", fontWeight: 700 }}>
                            <td colSpan={3} style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.75rem" }}>CLOSING BALANCE</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#0B7A55" }}>{fmtDec(ledgerLines.reduce((s,l) => s+l.dr_amount,0))}</td>
                            <td className="au-mono" style={{ textAlign: "right", color: "#1F5EFF" }}>{fmtDec(ledgerLines.reduce((s,l) => s+l.cr_amount,0))}</td>
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

      {/* ── Entry Detail Modal ───────────────────────────────────────────── */}
      {modalJournal && (
        <div onClick={() => setModalJournal(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,26,58,0.33)", backdropFilter: "blur(4px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.15)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 80px rgba(20,26,58,0.30)" }}>

            {/* Header */}
            <div style={{ padding: "1.1rem 1.25rem 0.9rem", borderBottom: "1px solid rgba(20,26,58,0.11)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#232A63", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>{modalJournal.entry_no}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#141A3A", lineHeight: 1.4 }}>{modalJournal.narration || "—"}</div>
              </div>
              <button onClick={() => setModalJournal(null)} style={{ background: "#FFFFFF", border: "none", color: "rgba(20,26,58,0.75)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Meta */}
            <div style={{ padding: "0.7rem 1.25rem", borderBottom: "1px solid rgba(20,26,58,0.10)", display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.75)" }}>{new Date(modalJournal.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              {(() => { const c = { sales:"#0B7A55",receipt:"#0B7A55",income:"#0B7A55",payment:"#C2321F",purchase:"#C2321F",expense:"#C2321F",journal:"#1F5EFF",contra:"#5B4BC4",debit_note:"#8A5A00",credit_note:"#8A5A00" } as Record<string,string>; const col = c[modalJournal.type] ?? "#141A3A"; return <span style={{ fontSize: "0.72rem", fontWeight: 700, color: col, background: col+"15", padding: "2px 10px", borderRadius: 20 }}>{modalJournal.type}</span>; })()}
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: modalJournal.status==="posted"?"#0B7A55":"#8A5A00", background: modalJournal.status==="posted"?"rgba(11,122,85,0.1)":"rgba(184,120,0,0.1)", padding: "2px 10px", borderRadius: 20 }}>{modalJournal.status}</span>
              {modalJournal.reference_no && <span style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)" }}>Ref: {modalJournal.reference_no}</span>}
            </div>

            {/* Totals */}
            <div style={{ padding: "0.8rem 1.25rem", borderBottom: "1px solid rgba(20,26,58,0.10)", display: "flex", gap: "2rem" }}>
              {[
                { label: "Total Debit", val: modalJournal.total_debit, color: "#C2321F" },
                { label: "Total Credit", val: modalJournal.total_credit, color: "#0B7A55" },
                { label: "Difference", val: Math.abs(modalJournal.total_debit - modalJournal.total_credit), color: Math.abs(modalJournal.total_debit - modalJournal.total_credit) < 1 ? "#0B7A55" : "#C2321F" },
              ].map(t => (
                <div key={t.label}>
                  <div style={{ fontSize: "0.58rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.05rem", fontWeight: 700, color: t.color }}>{fmt(t.val)}</div>
                </div>
              ))}
            </div>

            {/* Lines */}
            <div style={{ padding: "0.8rem 1.25rem 1.1rem" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>Double-Entry Lines</div>
              {modalLoading ? (
                <div style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.82rem", padding: "1rem 0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #1F5EFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Loading lines…
                </div>
              ) : !modalJournal.modalLines?.length ? (
                <div style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.82rem" }}>No line items found.</div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid rgba(20,26,58,0.11)", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.62rem", color: "rgba(20,26,58,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Account</span>
                    <span style={{ fontSize: "0.62rem", color: "#C2321F", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Debit</span>
                    <span style={{ fontSize: "0.62rem", color: "#0B7A55", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Credit</span>
                  </div>
                  {modalJournal.modalLines.map((l, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", gap: "0.5rem", padding: "0.42rem 0", borderBottom: "1px solid rgba(20,26,58,0.10)" }}>
                      <div>
                        <div style={{ fontSize: "0.84rem", color: "#141A3A", fontWeight: 500 }}>{l.account}</div>
                        {l.accountType && <div style={{ fontSize: "0.65rem", color: "rgba(20,26,58,0.55)", marginTop: 1 }}>{l.accountType}</div>}
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", color: l.dr > 0 ? "#C2321F" : "rgba(20,26,58,0.28)", fontWeight: l.dr > 0 ? 600 : 400 }}>
                        {l.dr > 0 ? l.dr.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : "—"}
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.8rem", color: l.cr > 0 ? "#0B7A55" : "rgba(20,26,58,0.28)", fontWeight: l.cr > 0 ? 600 : 400 }}>
                        {l.cr > 0 ? l.cr.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : "—"}
                      </div>
                    </div>
                  ))}
                  {/* Totals footer */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", gap: "0.5rem", padding: "0.55rem 0 0", borderTop: "1px solid rgba(20,26,58,0.15)", marginTop: "0.2rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(20,26,58,0.70)" }}>Total</span>
                    <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", fontWeight: 700, color: "#C2321F" }}>{modalJournal.modalLines.reduce((s,l) => s+l.dr, 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}</span>
                    <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.82rem", fontWeight: 700, color: "#0B7A55" }}>{modalJournal.modalLines.reduce((s,l) => s+l.cr, 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "0.75rem 1.25rem 1rem", borderTop: "1px solid rgba(20,26,58,0.10)" }}>
              <button onClick={() => setModalJournal(null)} style={{ width: "100%", background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.15)", color: "rgba(20,26,58,0.75)", padding: "9px", borderRadius: 8, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

