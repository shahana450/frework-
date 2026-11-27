"use client";
import { isLoanAccount, looksLikeLoanStatement, normaliseLoanRows, suggestLoanLedger } from "@/lib/bankImport";
import { readBankStatement } from "@/lib/readStatement";
import { PdfPasswordError } from "@/lib/pdfUnlock";
import { loadDraft, saveDraft, clearDraft as clearIdb } from "@/lib/importDraft";
import { cur, activeMoney } from "@/lib/money";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import PageHero, { HT } from "@/components/finance/PageHero";
import { supabase } from "@/lib/supabase";
import { parseStatementGrid } from "@/lib/bankExcel";
import { readActiveBusiness } from "@/lib/activeBusiness";
import GroupChips, { guessGroup } from "@/components/GroupChips";
import { headByKey, inferHead } from "@/lib/ledgerHeads";
import { groupKeyOf } from "@/lib/statementGroups";

/* ─── Types ─────────────────────────────────────────────── */
// A loan here: a loan-named liability, or any liability ledger chosen as the statement account
const loanLike = (a?: { name: string; type: string } | null) => !!a && (isLoanAccount(a as never) || a.type === "liability");

type TxRow = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  ledger_id: string | null;
  ledger_name: string | null;
  pushed: boolean;
  suggested?: boolean;   // filled by "Suggest ledgers" — check before pushing
  error?: string;
};

type CoaAccount = { id: string; name: string; type: string; code: string | null };

/* ─── Helpers ────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(n: number) { return n ? n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : ""; }
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const ACC_TYPE_COLOR: Record<string, string> = {
  bank: "#12352D", cash: "#0B7A55", income: "#0B7A55", expense: "#9A6B22",
  asset: "#12352D", liability: "#5B4BC4", equity: "#B4561E", receivable: "#0B7A55",
  payable: "#B4321F",
};

/* ─── Main Component ─────────────────────────────────────── */
export default function BankingPage() {
  const [bizId, setBizId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CoaAccount[]>([]);

  // Upload / parse state
  const [parsing, setParsing] = useState(false);
  const [parseStep, setParseStep] = useState("");
  const [parseProgress, setParseProgress] = useState(0);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Transactions
  const [rows, setRows] = useState<TxRow[]>([]);

  // Selected bank account for this statement
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [loanMode, setLoanMode] = useState(false);
  // After a statement is read: which bank / loan ledger is it for? (or create one)
  const acctChosen = useRef(false);   // picked in "Which account…" — suggestions never switch it
  const [askPos, setAskPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [acctAsk, setAcctAsk] = useState<{ kind: "bank" | "loan"; pick: string; newName: string; creating: boolean; hint: string } | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "debit" | "credit">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "assigned" | "unassigned" | "pushed">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Bulk assign
  const [bulkLedgerId, setBulkLedgerId] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");

  // Push state
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ created: number } | null>(null);
  // Rows the server didn't post: possible duplicates wait for a confirmation, the rest show why
  const [failed, setFailed] = useState<{ id: string; code?: string; error: string }[]>([]);

  // Add new ledger inline
  const [addLedgerRow, setAddLedgerRow] = useState<string | null>(null); // row id
  const [newLedgerName, setNewLedgerName] = useState("");
  const [newLedgerType, setNewLedgerType] = useState("indirect_expense");   // a ledger group key (Sales Accounts, Purchase Accounts, …)
  const [groupTouched, setGroupTouched] = useState(false);
  const [addingLedger, setAddingLedger] = useState(false);

  /* ── Init ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const saved = (readActiveBusiness(user.id) ?? "").trim();
      if (!saved) return;
      setBizId(saved);

      const { data: accounts } = await supabase
        .from("fw_fin_chart_of_accounts")
        .select("id,name,type,sub_type,code")
        .eq("business_id", saved)
        .eq("is_group", false)
        .order("name");

      const all = (accounts ?? []) as CoaAccount[];
      setCoa(all);
      // Bank and cash ledgers are stored as assets with a bank/cash sub-type (older ones may carry the type itself)
      const banks = all.filter(a => !/interest|charges?|commission|fees?|gst/i.test(a.name) || isLoanAccount(a as never)).filter(a => ["bank", "cash"].includes(a.type) || ["bank", "cash"].includes((a as { sub_type?: string | null }).sub_type ?? "") || isLoanAccount(a as never) || (a as { sub_type?: string | null }).sub_type === "long_term_liability");
      setBankAccounts(banks);
      const wantLoan = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("loan") === "1";
      setLoanMode(wantLoan);
      const loans = banks.filter(a => loanLike(a as never));
      if (wantLoan && loans.length) setBankAccountId(loans[0].id);
      else if (banks.length) setBankAccountId((banks.find(b => !loanLike(b as never) && !/cash/i.test(b.name) && (b.type === "bank" || (b as { sub_type?: string | null }).sub_type === "bank")) ?? banks[0]).id);   // a bank before cash
    });
  }, []);

  /* ── Parse Excel (client-side) ── */
  async function parseExcel(file: File) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const lower = file.name.toLowerCase();
    // CSV is read as text so day-first dates aren't guessed as US dates
    const wb = lower.endsWith(".csv") ? XLSX.read(await file.text(), { type: "string", raw: true }) : XLSX.read(buf, { type: "array", cellDates: true });
    // Any sheet may hold the statement (some banks put a cover sheet first)
    let best: ReturnType<typeof parseStatementGrid> | null = null;
    for (const name of wb.SheetNames.slice(0, 5)) {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }) as unknown[][];
      const r = parseStatementGrid(grid);
      if (!best || r.rows.length > best.rows.length) best = r;
    }
    if (!best?.rows.length) {
      throw new Error(`${best?.note ?? "No transactions found."} Make sure the sheet has columns like Date, Narration/Description, Debit/Withdrawal and Credit/Deposit (or Amount with Dr/Cr). If it's a scanned or unusual layout, upload the PDF instead — the AI reads those.`);
    }
    return best.rows.map(r => ({ id: uid(), ...r, ledger_id: null, ledger_name: null, pushed: false }));
  }

  function parseDate(v: unknown): string {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    // DD-MM-YYYY or DD/MM/YYYY
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m1) {
      const y = m1[3].length === 2 ? `20${m1[3]}` : m1[3];
      return `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    }
    try { return new Date(s).toISOString().slice(0, 10); } catch { return s; }
  }

  function toNum(v: unknown): number {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return Math.abs(v);
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : Math.abs(n);
  }

  /* ── Parse PDF (server-side via Claude) ── */
  async function parsePDF(file: File, stopAnim: () => void) {
    // Long PDFs are read in page batches with real progress
    // The page files the full statement on the Shelf itself, so the reader doesn't
    const json = await readBankStatement(file, { bizId: bizId ?? undefined, shelf: false, password: pdfPassword || undefined, onProgress: p => { if (p.total > 1) { stopAnim(); setParseProgress(Math.round(5 + (p.done / p.total) * 90)); setParseStep(p.label); } } });
    if (json.stoppedReason) setParseError(`Read part of the statement, then stopped: ${json.stoppedReason}`);
    else if (json.missingPages.length) setParseError(`Some pages couldn't be read (pages ${json.missingPages.join(", ")}). Everything else is below — upload those pages again, or the Excel statement, to fill the gap.`);
    return (json.transactions as Omit<TxRow, "id" | "ledger_id" | "ledger_name" | "pushed">[]).map(t => ({
      ...t, id: uid(), ledger_id: null, ledger_name: null, pushed: false,
    }));
  }

  // Password-protected statement waiting for its password (used in this browser only, never sent or saved)
  const [locked, setLocked] = useState<{ file: File; wrong: boolean } | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");

  // A statement kept on the Shelf (sent on WhatsApp, or uploaded there): load it and read it straight away
  const fromShelf = useRef(false);
  async function loadFromShelf(id: string, fileName?: string | null) {
    if (!bizId) return;
    fromShelf.current = true;
    try {
      const { url } = await fetch(`/api/finance/shelf?business_id=${bizId}&download=${encodeURIComponent(id)}&inline=1`).then(r => r.json());
      if (!url) throw new Error("not found");
      const blob = await fetch(url).then(r => r.blob());
      const name = fileName || decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "statement.pdf").replace(/^\d+[-_]/, "");
      await handleFile(new File([blob], /\.(pdf|xlsx?|csv)$/i.test(name) ? name : "statement.pdf", { type: blob.type || "application/pdf" }));
    } catch { setParseError("Couldn't load that statement from the Shelf. Upload it below instead."); }
  }
  // Opened from WhatsApp (?shelf=<id>)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("shelf");
    if (!bizId || !id || fromShelf.current) return;
    void loadFromShelf(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId]);
  // Statements waiting on the Shelf (most recent first) — shown while nothing is loaded, each one a click to book
  const [showShelf, setShowShelf] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [shelfStatements, setShelfStatements] = useState<{ id: string; title: string; file_name: string | null; source: string | null; created_at: string; doc_type: string | null }[]>([]);
  useEffect(() => {
    if (!bizId) return;
    fetch(`/api/finance/shelf?business_id=${bizId}`).then(r => r.ok ? r.json() : null).then(d => {
      const list = ((d?.items ?? []) as { id: string; rack: string; title: string; file_name: string | null; source: string | null; created_at: string; doc_type: string | null }[])
        .filter(i => /\.(pdf|xlsx?|csv)$/i.test(i.file_name ?? "") && (i.rack === "bank" || /statement|passbook|stmt/i.test(`${i.doc_type ?? ""} ${i.title}`)));
      setShelfStatements(list.slice(0, 6));
    }).catch(() => null);
  }, [bizId]);

  /* ── File drop / select ── */
  async function handleFile(file: File) {
    setLocked(null);
    setParsing(true); setParseError(""); setRows([]); setSelected(new Set()); setPushResult(null); acctChosen.current = false; setAskPos({ x: 0, y: 0 });
    setParseProgress(0); setParseStep("Reading file…");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    // Animated progress for PDF (AI takes 15-40s)
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (ext === "pdf") {
      const steps = [
        [5, "Reading file…"],
        [15, "Sending to AI…"],
        [30, "AI analysing statement…"],
        [55, "Extracting transactions…"],
        [75, "Parsing amounts & dates…"],
        [88, "Almost done…"],
      ] as [number, string][];
      let si = 0;
      progressInterval = setInterval(() => {
        if (si < steps.length) { setParseProgress(steps[si][0]); setParseStep(steps[si][1]); si++; }
      }, 2800);
    } else {
      setParseProgress(30); setParseStep("Parsing spreadsheet…");
    }
    try {
      let txs: TxRow[];
      if (["xlsx", "xls", "csv"].includes(ext)) {
        txs = await parseExcel(file);
      } else if (ext === "pdf") {
        txs = await parsePDF(file, () => { if (progressInterval) { clearInterval(progressInterval); progressInterval = null; } });
      } else {
        throw new Error("Unsupported file type. Upload PDF, Excel (.xlsx/.xls), or CSV.");
      }
      if (!txs.length) throw new Error("No transactions found in file.");
      if (progressInterval) clearInterval(progressInterval);
      setParseProgress(100); setParseStep(`Found ${txs.length} transactions!`);
      await new Promise(r => setTimeout(r, 400));
      setRows(txs);
      {
        // Bank or loan statement, and the ledger it most likely belongs to
        const loan = looksLikeLoanStatement(file.name, txs);
        const BANKS = ["state bank", "sbi", "hdfc", "icici", "axis", "kotak", "federal", "canara", "union", "baroda", "bob", "pnb", "punjab", "indian bank", "idbi", "yes bank", "indusind", "south indian", "csb", "catholic", "dhanlaxmi", "idfc", "rbl", "bandhan", "esaf", "cnb", "kerala gramin", "iob", "overseas", "au small"];
        const text = `${file.name} ${txs.slice(0, 5).map(t => t.description).join(" ")}`.toLowerCase();
        const named = BANKS.find(b => text.includes(b));
        const pool = bankAccounts.filter(a => loan ? loanLike(a as never) : !loanLike(a as never));
        const guess = pool.find(a => named && a.name.toLowerCase().includes(named.split(" ")[0])) ?? (pool.length === 1 ? pool[0] : undefined);
        const title = named ? named.replace(/\b\w/g, ch => ch.toUpperCase()).replace(/^(Sbi|Hdfc|Icici|Idbi|Pnb|Bob|Rbl|Csb|Cnb|Iob|Idfc)\b/, w => w.toUpperCase()) : "";
        setAcctAsk({ kind: loan ? "loan" : "bank", pick: guess?.id ?? (pool.length ? "" : "__new"), newName: title ? (loan ? `${title} Loan A/c` : `${title}${/bank/i.test(title) ? "" : " Bank"}`) : "", creating: false, hint: named ? title : "" });
        if (guess) setBankAccountId(guess.id);
      }
      // Keep the statement itself on the Shelf (Bank rack), so the original is always there
      if (bizId && !fromShelf.current) { const fd = new FormData(); fd.append("business_id", bizId); fd.append("file", file); fd.append("rack", "bank"); void fetch("/api/finance/shelf", { method: "POST", body: fd }).catch(() => null); }
    } catch (e: unknown) {
      if (progressInterval) clearInterval(progressInterval);
      // Locked statement: ask for its password, then read it again
      if (e instanceof PdfPasswordError) { setLocked({ file, wrong: e.wrong }); return; }
      setParseError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false); setParseProgress(0); setParseStep("");
    }
  }

  // Lines from the live bank feed (Integrations → Open in Assign ledgers): loaded like a statement, for the bank
  // ledger chosen when the feed was connected
  const fromFeed = useRef(false);
  useEffect(() => {
    if (!bizId || fromFeed.current || !coa.length || new URLSearchParams(window.location.search).get("feed") !== "1") return;
    let got: { bank_ledger: string; lines: { date: string; description: string; debit: number; credit: number; balance?: number }[]; at: number } | null = null;
    try { got = JSON.parse(sessionStorage.getItem("fw_feed_rows") || "null"); sessionStorage.removeItem("fw_feed_rows"); } catch { /* */ }
    fromFeed.current = true;
    if (!got?.lines?.length || Date.now() - got.at > 30 * 60 * 1000) return;
    setRows(got.lines.map(l => ({ ...l, id: uid(), ledger_id: null, ledger_name: null, pushed: false })) as TxRow[]);
    const want = (got.bank_ledger || "").trim().toLowerCase();
    const hit = bankAccounts.find(a => a.name.trim().toLowerCase() === want) ?? coa.find(a => a.name.trim().toLowerCase() === want);
    if (hit) { setBankAccountId(hit.id); acctChosen.current = true; }
    else setAcctAsk({ kind: "bank", pick: bankAccounts.length === 1 ? bankAccounts[0].id : "", newName: got.bank_ledger || "", creating: false, hint: "" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, coa.length, bankAccounts.length]);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  /* ── Filtered rows ── */
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterType === "debit" && !r.debit) return false;
      if (filterType === "credit" && !r.credit) return false;
      if (filterStatus === "assigned" && !r.ledger_id) return false;
      if (filterStatus === "unassigned" && r.ledger_id) return false;
      if (filterStatus === "pushed" && !r.pushed) return false;
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      if (search && !r.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterType, filterStatus, filterDateFrom, filterDateTo, search]);

  /* ── Selection ── */
  // Big statements (thousands of lines) draw 200 lines at a time — drawing all of them made every click and keystroke slow
  const PAGE = 200;
  const [showN, setShowN] = useState(PAGE);
  useEffect(() => { setShowN(PAGE); }, [search, filterType, filterStatus, filterDateFrom, filterDateTo, rows.length]);
  const allFilteredSelected =filtered.length > 0 && filtered.every(r => selected.has(r.id));
  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(s => { const n = new Set(s); filtered.forEach(r => n.delete(r.id)); return n; });
    } else {
      setSelected(s => { const n = new Set(s); filtered.forEach(r => n.add(r.id)); return n; });
    }
  }
  function toggleRow(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  /* ── Assign ledger to a single row ── */
  function assignLedger(rowId: string, ledgerId: string) {
    const acct = coa.find(a => a.id === ledgerId);
    setRows(r => r.map(x => x.id === rowId ? { ...x, ledger_id: ledgerId || null, ledger_name: acct?.name ?? null, suggested: false } : x));
  }

  /* ── Suggest a ledger for every unassigned row; create the ones that don't exist yet ── */
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState("");
  // Ledgers "Suggest" created for this statement — shown grouped (PhonePe / Paytm / bank transfers / heads), with look-alikes to merge
  const [newLedgers, setNewLedgers] = useState<string[]>([]);
  const [showAllNew, setShowAllNew] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  async function suggestLedgers(createMissing = true) {
    if (!bizId) return;
    setSuggesting(true); setSuggestMsg("");
    try {
      const want = new Map<string, string>();               // ledger name → group key
      const pick: Record<string, string> = {};              // row id → ledger name
      // A loan statement: the loan ledger is the statement account, amounts follow the running balance
      const acct0 = coa.find(a => a.id === bankAccountId);
      let loanAcct = !!acct0 && !bankAccounts.some(b => b.id === acct0.id && !loanLike(b as never));
      let statementAcct = acct0;
      let work = rows;
      if (!loanAcct && looksLikeLoanStatement("", rows)) {
        const ln = bankAccounts.find(a => loanLike(a as never));
        if (ln && !acctChosen.current) { setBankAccountId(ln.id); statementAcct = ln; loanAcct = true; }
        else if (acctChosen.current) { /* the account you picked stays */ }
        else { setSuggestMsg("This looks like a loan statement. Add your loan ledger in Statement account (e.g. \"Federal Bank Term Loan\"), choose it, then Suggest again."); return; }
      }
      if (loanAcct) { work = normaliseLoanRows(rows); setRows(work); }
      for (const r of work) {
        if (r.pushed || r.ledger_id) continue;
        const out = r.debit > 0;
        if (loanAcct) {
          const payBank = bankAccounts.find(a => !loanLike(a as never) && !/cash/i.test(a.name))?.name ?? "Bank Account";
          const ln = suggestLoanLedger(r.description, out, payBank, coa.map(a => a.name), statementAcct?.name ?? "");
          const ex = coa.find(a => a.name.trim().toLowerCase() === ln.toLowerCase()); pick[r.id] = ex?.name ?? ln;
          if (!ex && !want.has(ln)) want.set(ln, ln === "Bank Account" ? "bank" : "indirect_expense");
          continue;
        }
        const g = groupKeyOf(r.description);
        const name = g.rule ? (out ? g.rule[2] : g.rule[3]) : g.label !== "Other" ? g.label : null;
        if (!name) continue;
        const existing = coa.find(a => a.name.trim().toLowerCase() === name.toLowerCase());
        pick[r.id] = existing?.name ?? name;
        if (!existing && !want.has(name)) want.set(name, g.rule ? (inferHead(name)?.key ?? guessGroup(name, out ? "out" : "in")) : out ? "creditors" : "debtors");
      }
      let all = coa;
      if (!createMissing) { for (const [id, nm] of Object.entries(pick)) if (!coa.some(a => a.name.trim().toLowerCase() === nm.toLowerCase())) delete pick[id]; want.clear(); }
      if (want.size) {
        const stamp = Date.now().toString().slice(-6);
        const { data, error } = await supabase.from("fw_fin_chart_of_accounts").insert([...want].map(([name, key], i) => {
          const h = headByKey(key) ?? headByKey("indirect_expense")!;
          return { business_id: bizId, name, code: `AUTO-${stamp}${i}`, type: h.type, sub_type: h.sub_type, is_group: false, is_system: false, description: `Created from bank statement under ${h.label}` };
        })).select("id,name,type,code");
        if (error) throw error;
        all = [...coa, ...((data ?? []) as CoaAccount[])];
        setCoa(all);
      }
      const byName = new Map(all.map(a => [a.name.toLowerCase(), a]));
      let n = 0;
      setRows(rs => rs.map(x => { const nm = pick[x.id]; const a = nm ? byName.get(nm.toLowerCase()) : undefined; if (!a || x.ledger_id || x.pushed) return x; n++; return { ...x, ledger_id: a.id, ledger_name: a.name, suggested: true }; }));
      const left = work.filter(r => !r.pushed && !r.ledger_id && !pick[r.id]).length;
      if (want.size) setNewLedgers(l => [...new Set([...l, ...want.keys()])]);
      setSuggestMsg(`✨ ${Object.keys(pick).length} suggested${want.size ? ` · ${want.size} new ledger${want.size > 1 ? "s" : ""} created — grouped above` : ""}${left ? ` · ${left} need you to choose` : ""}. Check the ✨ rows, then push.`);
    } catch (e) {
      setSuggestMsg(`Couldn't suggest: ${(e as { message?: string })?.message ?? String(e)}`);
    } finally {
      setSuggesting(false);
    }
  }

  /* ── Saved automatically on this device, so a statement in progress isn't lost ── */
  const draftKey = bizId ? `fw_bank_import_${bizId}` : "";
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restorable, setRestorable] = useState<{ rows: TxRow[]; bank: string; at: number } | null>(null);
  // Kept in IndexedDB (a long statement is thousands of rows — too big for localStorage); an older localStorage copy is still picked up
  useEffect(() => {
    if (!draftKey || !bizId) return;
    void loadDraft<{ rows: TxRow[]; bank: string }>("bank-import", bizId).then(d => {
      if (d?.data.rows?.some(r => !r.pushed)) { setRestorable({ rows: d.data.rows, bank: d.data.bank, at: d.savedAt }); return; }
      try { const o = JSON.parse(localStorage.getItem(draftKey) ?? "null"); if (o?.rows?.some((r: TxRow) => !r.pushed)) setRestorable(o); } catch { /* */ }
    });
  }, [draftKey, bizId]);
  useEffect(() => {
    if (!draftKey || !bizId || !rows.length) return;
    const t = setTimeout(() => {
      const pending = rows.filter(r => !r.pushed).length;
      if (!pending) { void clearIdb("bank-import", bizId); setSavedAt(null); return; }   // all posted: nothing to resume
      const at = Date.now();
      void saveDraft({ kind: "bank-import", bizId, savedAt: at, title: `bank statement, ${rows.length} rows`, pending, posted: rows.length - pending, data: { rows, bank: bankAccountId } });
      setSavedAt(at);
    }, 700);
    return () => clearTimeout(t);
  }, [rows, bankAccountId, draftKey, bizId]);
  const clearDraft = () => { try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* */ } if (bizId) void clearIdb("bank-import", bizId); setRestorable(null); setSavedAt(null); };

  /* ── Add the bank account itself, right here ── */
  const [newBank, setNewBank] = useState("");
  // The new-ledger name is typed without re-drawing the page each key (thousands of rows made typing crawl);
  // the page only hears when the box goes from empty to filled, to enable the button
  const newNameRef = useRef<string | null>(null);
  async function confirmAcct() {
    if (!acctAsk || !bizId) return;
    acctChosen.current = true;
    if (acctAsk.pick && acctAsk.pick !== "__new") { setBankAccountId(acctAsk.pick); setLoanMode(acctAsk.kind === "loan"); setAcctAsk(null); return; }
    const name = (newNameRef.current ?? acctAsk.newName).trim();
    if (!name) return;
    const exists = coa.find(a => a.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) { setBankAccountId(exists.id); if (!bankAccounts.some(b => b.id === exists.id)) setBankAccounts(b => [...b, exists]); setAcctAsk(null); return; }
    setAcctAsk(a => a && { ...a, creating: true });
    const h = headByKey(acctAsk.kind === "loan" ? "loan" : "bank")!;
    const { data, error } = await supabase.from("fw_fin_chart_of_accounts").insert({ business_id: bizId, name, code: `AUTO-${Date.now().toString().slice(-7)}`, type: h.type, sub_type: h.sub_type, is_group: false, is_system: false, description: `${acctAsk.kind === "loan" ? "Loan" : "Bank"} account added from statement import` }).select("id,name,type,code").single();
    if (error) { alert(`Couldn't create the ledger: ${error.message}`); setAcctAsk(a => a && { ...a, creating: false }); return; }
    const a = { ...(data as CoaAccount), sub_type: h.sub_type } as CoaAccount;
    setCoa(x => [...x, a]); setBankAccounts(b => [...b, a]); setBankAccountId(a.id); setLoanMode(acctAsk.kind === "loan"); setAcctAsk(null);
  }

  async function addBank() {
    if (!bizId || !newBank.trim()) return;
    const h = headByKey("bank")!;
    const { data, error } = await supabase.from("fw_fin_chart_of_accounts").insert({ business_id: bizId, name: newBank.trim(), code: `AUTO-${Date.now().toString().slice(-7)}`, type: h.type, sub_type: h.sub_type, is_group: false, is_system: false, description: "Bank account added from statement import" }).select("id,name,type,code").single();
    if (error) { alert(`Couldn't add the bank: ${error.message}`); return; }
    const a = data as CoaAccount;
    setCoa(c => [...c, a]); setBankAccounts(b => [...b, a]); setBankAccountId(a.id); setNewBank("");
  }

  // Suggestions fill in by themselves when a statement is loaded (existing ledgers only; "Suggest ledgers" also creates missing ones)
  const autoSuggested = useRef("");
  useEffect(() => {
    if (!bizId || !coa.length || !bankAccountId || suggesting || !rows.length || acctAsk) return;
    const key = `${rows.length}|${rows[0]?.id}`;
    if (autoSuggested.current === key || !rows.some(r => !r.ledger_id && !r.pushed)) return;
    autoSuggested.current = key;
    void suggestLedgers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, bizId, coa.length, bankAccountId, acctAsk]);

  /* ── Bulk assign ── */
  function applyBulkAssign() {
    if (!bulkLedgerId || selected.size === 0) return;
    const acct = coa.find(a => a.id === bulkLedgerId);
    setRows(r => r.map(x => selected.has(x.id) ? { ...x, ledger_id: bulkLedgerId, ledger_name: acct?.name ?? null } : x));
    setSelected(new Set());
    setBulkLedgerId("");
    setBulkSearch("");
  }

  /* ── Add new ledger ── */
  async function addLedger(forRowId: string) {
    if (!bizId || !newLedgerName.trim()) return;
    setAddingLedger(true);
    try {
      // Already have it (any capitalisation)? Use that ledger instead of creating a second one
      const same = coa.find(a => a.name.trim().toLowerCase() === newLedgerName.trim().toLowerCase());
      if (same) { assignLedger(forRowId, same.id); setAddLedgerRow(null); setNewLedgerName(""); return; }
      const { data, error } = await supabase
        .from("fw_fin_chart_of_accounts")
        .insert((() => { const h = headByKey(newLedgerType) ?? headByKey("indirect_expense")!; return { business_id: bizId, name: newLedgerName.trim(), code: `AUTO-${Date.now().toString().slice(-7)}`, type: h.type, sub_type: h.sub_type, is_group: false, is_system: false, description: `Created from bank statement under ${h.label}` }; })())
        .select("id,name,type,code")
        .single();
      if (error) throw error;
      const newAcct = data as CoaAccount;
      setCoa(c => [...c, newAcct]);
      assignLedger(forRowId, newAcct.id);
      setAddLedgerRow(null);
      setNewLedgerName("");
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      alert(/duplicate|unique/i.test(msg) ? `A ledger named "${newLedgerName.trim()}" already exists — pick it from the list.` : `Couldn't add the ledger: ${msg}`);
    } finally {
      setAddingLedger(false);
    }
  }

  /* ── Push to journals ── */
  async function pushToJournals(only?: string[], confirmDup = false) {
    if (!bizId) return;
    if (!bankAccountId) { alert("Choose the bank account this statement belongs to (top of the page). If it isn't listed, add it in Chart of Accounts under Bank Accounts."); return; }
    const toPush = rows.filter(r => r.ledger_id && !r.pushed && (!only || only.includes(r.id)));
    if (!toPush.length) return;
    setPushing(true);
    try {
      const res = await fetch("/api/finance/bank-to-journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: bizId,
          bank_account_id: bankAccountId,
          transactions: toPush.map(r => ({
            id: r.id, date: r.date, description: r.description,
            debit: r.debit, credit: r.credit, ledger_id: r.ledger_id, ...(confirmDup ? { confirm_duplicate: true } : {}),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPushResult(prev => ({ created: (only && prev ? prev.created : 0) + json.created }));
      // Only rows the server actually posted are marked; the rest stay so they can be fixed and posted again
      const fails = new Map(((json.failures ?? []) as { id: string; error: string }[]).map(f => [f.id, f.error]));
      const pushedIds = new Set(toPush.map(r => r.id).filter(id => !fails.has(id)));
      setRows(r => r.map(x => pushedIds.has(x.id) ? { ...x, pushed: true } : x));
      const tried = new Set(toPush.map(r => r.id));
      setFailed(prev => [...prev.filter(f => !tried.has(f.id)), ...((json.failures ?? []) as { id: string; code?: string; error: string }[])]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  }

  /* ── COA filtered for bulk assign search ── */
  const bulkCoa = useMemo(() =>
    coa.filter(a => !bulkSearch || a.name.toLowerCase().includes(bulkSearch.toLowerCase())).slice(0, 40),
    [coa, bulkSearch]);

  const decode = (n: string) => n.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');

  /* ── Summaries ── */
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const assignedCount = rows.filter(r => r.ledger_id).length;
  const unpushedAssigned = rows.filter(r => r.ledger_id && !r.pushed).length;

  /* ─────────────────── JSX ─────────────────────────────── */
  const inp: React.CSSProperties = {
    background: "#FFFDF8", border: "1px solid #FFFFFF", color: "#10241F",
    padding: "7px 10px", borderRadius: 7, fontSize: "0.82rem", outline: "none",
    fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", color: "#10241F", fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .bs-drop { transition: border-color 0.2s, background 0.2s; }
        .bs-drop:hover { border-color: #12352D !important; background: rgba(18,53,45,0.04) !important; }
        .bs-row:hover td { background: #FFFFFF; }
        .bs-row.pushed td { opacity: 0.45; }
        .bs-sel { accent-color: #12352D; width: 14px; height: 14px; cursor: pointer; }
        .bs-chip { font-size: 0.6rem; font-weight: 700; padding: 2px 7px; border-radius: 12px; white-space: nowrap; }
        .bs-badge-dr { background: rgba(194,50,31,0.12); color: #B4321F; }
        .bs-badge-cr { background: rgba(11,122,85,0.12); color: #0B7A55; }
        .bs-btn { border: none; border-radius: 8px; font-family: inherit; font-weight: 700; cursor: pointer; transition: opacity 0.15s, transform 0.1s; display: inline-flex; align-items: center; gap: 0.4rem; }
        .bs-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .bs-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .bs-filter-btn { background: #FFFFFF; border: 1px solid #FFFFFF; color: #6E88A8; border-radius: 7px; padding: 5px 12px; font-size: 0.76rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .bs-filter-btn.active { background: rgba(18,53,45,0.12); border-color: rgba(18,53,45,0.4); color: #12352D; }
        .ledger-sel { background: #FFFFFF; border: 1px solid #E6DFD0; color: #10241F; padding: 0 10px; height: 34px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; outline: none; width: 100%; cursor: text; min-width: 230px; max-width: 320px; font-family: inherit; }
        .bi-review { display: flex; flex-direction: column; gap: 14px; }
        .bi-table { table-layout: fixed; min-width: 980px; }
        .bi-table th, .bi-table td { vertical-align: middle !important; }
        .bi-table th:nth-child(1), .bi-table td:nth-child(1) { width: 44px; }
        .bi-table th:nth-child(2), .bi-table td:nth-child(2) { width: 112px; }
        .bi-table th:nth-child(4), .bi-table td:nth-child(4), .bi-table th:nth-child(5), .bi-table td:nth-child(5) { width: 128px; text-align: right; }
        .bi-table th:nth-child(6), .bi-table td:nth-child(6) { width: 132px; text-align: right; }
        .bi-table th:nth-child(7), .bi-table td:nth-child(7) { width: 330px; }
        .bi-table th:nth-child(8), .bi-table td:nth-child(8) { width: 48px; }
        .bi-table td { padding-top: 10px !important; padding-bottom: 10px !important; border-bottom: 1px solid #F1E8D6; }
        .bi-table td:nth-child(3) { overflow-wrap: anywhere; }
        .bi-table .ledger-sel { max-width: none; }
        .bi-card { background: #FFFDF8; border: 1px solid #EFE2C4; border-radius: 18px; box-shadow: 0 14px 30px -26px rgba(154,107,34,.55); }
        .bi-main > div:last-child { border-radius: 18px; }
        .bi-hero { display: grid; grid-template-columns: minmax(240px, 1.1fr) minmax(280px, 1.6fr) minmax(220px, 0.9fr); gap: 22px; padding: 22px 24px; border-radius: 26px; color: #FFFFFF;
          background: radial-gradient(700px 260px at 100% 0%, rgba(233,194,122,.16), transparent 60%), linear-gradient(160deg, #0A1F1B, #0C2622 60%, #0F2E28); box-shadow: 0 30px 60px -36px rgba(6,26,22,.8); }
        .bi-h-lbl { font-size: 10.5px; font-weight: 800; letter-spacing: .16em; color: #B9D0C7; }
        .bi-h-acct, .bi-h-push { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .bi-h-sel { height: 46px; border-radius: 14px; border: 1px solid rgba(233,194,122,.6); background: #FFFDF8; color: #0B2C25; font: inherit; font-size: 15px; font-weight: 800; padding: 0 12px; cursor: pointer; }
        .bi-h-note { font-size: 12px; color: #B9D0C7; line-height: 1.4; }
        .bi-h-add { flex: 1; min-width: 0; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.06); color: #FFFFFF; padding: 0 10px; font: inherit; font-size: 12.5px; outline: none; }
        .bi-h-add::placeholder { color: #8FA8A0; }
        .bi-h-addbtn { border: none; border-radius: 10px; background: #E9C27A; color: #0B2C25; font-weight: 800; font-size: 12.5px; padding: 0 12px; cursor: pointer; }
        .bi-h-mid { display: grid; grid-template-rows: auto auto; gap: 14px; min-width: 0; }
        .bi-h-prog { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .bi-h-big { font-family: 'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif; font-size: 28px; font-weight: 700; }
        .bi-h-big small { font-size: 15px; color: #B9D0C7; }
        .bi-h-bar { height: 8px; border-radius: 99px; background: rgba(255,255,255,.12); overflow: hidden; }
        .bi-h-bar span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #E9C27A, #F3D9A2); transition: width .4s ease; }
        .bi-h-tags { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11.5px; }
        .bi-h-tags span { padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.08); color: #DCE9E3; }
        .bi-h-tot { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bi-h-tot > div { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .bi-h-tot b { font-family: 'IBM Plex Mono', monospace; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bi-h-tot small { font-size: 11.5px; color: #B9D0C7; }
        .bi-h-push { justify-content: center; }
        .bi-h-go { height: 56px; border-radius: 16px; border: none; background: linear-gradient(135deg, #F3D9A2, #E9C27A); color: #10241F; font: inherit; font-size: 16px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 14px 28px -16px rgba(233,194,122,.9); }
        .bi-h-go:disabled { background: rgba(255,255,255,.1); color: #8FA8A0; box-shadow: none; cursor: default; }
        .bi-h-again { background: none; border: 1px dashed rgba(255,255,255,.25); border-radius: 12px; color: #DCE9E3; font: inherit; font-size: 12.5px; font-weight: 700; padding: 9px 0; cursor: pointer; }
        .bi-done { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 16px; border-radius: 16px; background: #E3F6EE; border: 1px solid rgba(11,122,85,.25); font-size: 13px; color: #0B4F38; }
        .bi-done b { font-size: 14px; } .bi-done a { color: #0B7A55; font-weight: 800; text-decoration: none; }
        .bi-hero select:focus-visible, .bi-h-go:focus-visible, .bi-h-again:focus-visible { outline: 2px solid #E9C27A; outline-offset: 2px; }
        @media (max-width: 980px) { .bi-hero { grid-template-columns: 1fr; } }
        .bi-main { min-width: 0; }
        .bi-side { order: -1; display: flex; flex-direction: column; gap: 10px; }
        .bi-side > div { margin-bottom: 0 !important; }
        .bi-desc { line-height: 1.35; }
        .bi-desc { white-space: normal; word-break: break-word; }
        .bi-main thead th { position: sticky; top: 0; z-index: 1; background: #FFFDF8; }
        .bi-main tbody tr:hover { background: #FFF9EC !important; }
        .ledger-sel:focus { border-color: #12352D; }
        select option { background: #FFFFFF; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        ::-webkit-scrollbar { width: 5px; height: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #FFFFFF; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 960px) { .bi-two { grid-template-columns: minmax(0,1fr) !important; } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      {/* ── Top bar ── */}
      {rows.length > 0 && (
      <div style={{ background: "#0F2621", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 clamp(14px,3vw,28px)", height: 60, display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 20, color: "#FFFFFF" }}>
        <Link href="/finance/banking" style={{ color: "#C9D3CE", textDecoration: "none", fontSize: 16 }}>Banking</Link>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
        <button onClick={() => { setRows([]); setSelected(new Set()); setPushResult(null); setParseError(""); }} style={{ background: "none", border: "none", padding: 0, color: "#C9D3CE", font: "inherit", fontSize: 16, cursor: "pointer" }}>Import statement</button>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
        <span style={{ fontSize: 16 }}>Assign ledgers</span>
        <span style={{ marginLeft: "auto", fontSize: 15, color: "#C9D3CE", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {rows.length} transactions · {assignedCount} assigned · {rows.filter(r => r.pushed).length} posted
        </span>
      </div>
      )}

      {rows.length === 0 && <PageHero eyebrow="Banking · Import statement" title="Bring in" accent="your bank" overlap={70}
        sub="Upload a statement in PDF or Excel. FreBook reads every line, suggests the ledger and drafts the journal entry. Nothing posts until you approve it."
        actions={<div style={{ maxWidth: 420, display: "flex", gap: 12, padding: "20px 24px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.03)", fontSize: 16, lineHeight: 1.6, color: "#D3DCD8" }}><span aria-hidden style={{ color: HT.gold }}>⛉</span><span><span style={{ color: "#FFFFFF" }}>Private by design.</span> Password-protected PDFs open in your browser. The password is never sent or stored.</span></div>}
        tabs={[{ label: "Upload", active: true, onClick: () => fileRef.current?.click() }, { label: "Bank dashboard", href: "/finance/banking" }, { label: "Statement history", href: "/finance/banking/history" }]} />}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: rows.length === 0 ? "0 clamp(14px,3vw,28px) 3rem" : "1.5rem clamp(14px,3vw,28px)" }}>

        {rows.length === 0 && (
          <div>
            <style>{`.bi-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
              @media(max-width:900px){.bi-steps{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:22px}}@media(max-width:520px){.bi-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
              .bi-step{display:flex;flex-direction:column;gap:6px;min-width:0}
              .bi-dot{display:flex;align-items:center;gap:10px;margin-bottom:8px}
              .bi-dot b{width:44px;height:44px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;font-weight:400;font-size:17px;border:1px solid #D9C79A;color:${HT.ink};background:#FFFFFF}
              .bi-dot.on b{background:${HT.green};color:#FFFFFF;border-color:${HT.green};box-shadow:0 0 0 6px #F1E6CC}
              .bi-dot i{flex:1;height:1px;background:#D9D2C2;position:relative}
              .bi-dot.on i::after{content:"";position:absolute;left:0;top:-0.5px;width:40%;height:2px;background:${HT.gold}}
              .bi-drop{border:1.5px dashed #D9C79A;border-radius:22px;padding:56px 28px 44px;text-align:center;cursor:pointer;background:radial-gradient(circle, rgba(201,162,74,.10) 1px, transparent 1.4px) 0 0/22px 22px, #FFFBF2;transition:border-color .15s,background-color .15s}
              .bi-drop:hover{border-color:${HT.gold}}
              .bi-chip{height:40px;padding:0 18px;border-radius:999px;border:1px solid #E6DFD0;display:inline-flex;align-items:center;font-size:16px;color:${HT.ink};background:#FFFFFF}
              .bi-btn{height:58px;padding:0 30px;border-radius:999px;font:inherit;font-size:19px;display:inline-flex;align-items:center;gap:12px;cursor:pointer;text-decoration:none;transition:transform .14s}
              .bi-btn:hover{transform:translateY(-2px)}`}</style>
            <div style={{ marginTop: -70, position: "relative", background: HT.paper, borderRadius: 24, padding: "28px 34px", marginBottom: 32, border: `1px solid ${HT.line}`, boxShadow: "0 24px 50px -30px rgba(16,36,31,.55)" }}>
              <div className="bi-steps">
                {[["Upload", "Drop the statement"], ["Assign ledgers", "Confirm each line"], ["Journal entries", "Drafted for you"], ["Ledger", "Posted on approval"], ["Trial balance", "Always in balance"], ["Financial statements", "Schedule III ready"]].map(([t, d], i) => (
                  <div key={t} className="bi-step">
                    <div className={"bi-dot" + (i === 0 ? " on" : "")}><b>{i + 1}</b>{i < 5 && <i />}</div>
                    <span style={{ fontSize: 19, fontWeight: i === 0 ? 700 : 400, color: HT.ink }}>{t}</span>
                    <span style={{ fontSize: 15, color: HT.muted }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* ── Upload area (shown when no rows) ── */}
            {rows.length === 0 && restorable && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 1rem", padding: "12px 16px", borderRadius: 12, background: "#FFF4DB", border: "1px solid #F2D29B", color: "#5A3A00" }}>
                <span style={{ fontSize: "0.86rem", flex: 1, minWidth: 220 }}>💾 You have a saved statement — <b>{restorable.rows.length} transactions</b>, {restorable.rows.filter(r => r.ledger_id).length} with ledgers, saved {new Date(restorable.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</span>
                <button onClick={() => { setRows(restorable.rows); if (restorable.bank) setBankAccountId(restorable.bank); setRestorable(null); }} style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "none", background: "#12352D", color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>Continue where I left off</button>
                <button onClick={clearDraft} style={{ height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid #F2D29B", background: "#FFFDF8", color: "#9A6B22", fontWeight: 700, cursor: "pointer" }}>Discard</button>
              </div>
            )}
            {rows.length === 0 && !parsing && shelfStatements.length > 0 && showShelf && (
              <section id="bi-shelf" aria-label="Statements on your Shelf" style={{ margin: "0 0 1rem", padding: "14px 16px", borderRadius: 14, background: "#FFFDF8", border: "1px solid #E6DFD0" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <b style={{ fontSize: "0.98rem" }}>📥 Statements on your Shelf</b>
                  <Link href="/finance/shelf" style={{ fontSize: "0.8rem", color: "#9A6B22" }}>See all on the Shelf →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {shelfStatements.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 10, border: "1px solid #EFE8DA", background: "#FFFFFF" }}>
                      <span aria-hidden="true" style={{ fontSize: 18 }}>{/\.pdf$/i.test(s.file_name ?? "") ? "📄" : "📊"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 700, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.file_name || s.title}</span>
                        <span style={{ fontSize: "0.76rem", color: "#6B7570" }}>Added {new Date(s.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                      <button onClick={() => void loadFromShelf(s.id, s.file_name)} style={{ height: 32, padding: "0 14px", borderRadius: 999, border: "none", background: "#12352D", color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>Book</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="bi-two" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 480px", gap: 32, alignItems: "stretch" }}>
            <div>
            <div style={{ display: "none" }}>
              <h1>Bank Statement Import</h1>
              <p style={{ margin: 0, color: "#6B7570", fontSize: "0.88rem" }}>Upload your bank statement (PDF or Excel). Assign ledger accounts and push directly to Journal Entries → Ledger → Trial Balance → Financial Statements.</p>
            </div>

            <div style={{ background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 26, padding: 18 }}>
            <div
              className="bs-drop bi-drop"
              onDrop={onDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              {parsing ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "1rem 0" }}>
                  {/* Progress bar */}
                  <div style={{ width: "100%", maxWidth: 420, background: "#FFFDF8", borderRadius: 99, height: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#12352D,#12352D)", width: `${parseProgress}%`, transition: "width 0.6s ease" }} />
                  </div>
                  {/* Step label */}
                  <div style={{ color: "#12352D", fontWeight: 600, fontSize: "0.9rem" }}>{parseStep || "Processing…"}</div>
                  {/* Sub-steps */}
                  <div style={{ display: "flex", gap: "2rem", marginTop: "0.25rem" }}>
                    {[["📂","Read file"], ["🤖","AI parse"], ["📊","Extract rows"]].map(([icon, label], i) => {
                      const done = parseProgress >= [20, 60, 90][i];
                      const active = !done && parseProgress >= [0, 20, 60][i];
                      return (
                        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", opacity: done || active ? 1 : 0.3 }}>
                          <div style={{ fontSize: "1.4rem" }}>{done ? "✅" : active ? icon : icon}</div>
                          <div style={{ fontSize: "0.68rem", color: done ? "#0B7A55" : active ? "#12352D" : "#E6DFD0", fontWeight: 600 }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#E6DFD0" }}>PDF parsing takes ~20–30 sec via AI · Excel is instant</div>
                </div>
              ) : (
                <>
                  <span aria-hidden="true" style={{ width: 104, height: 104, margin: "0 auto 26px", borderRadius: "50%", background: HT.green, display: "grid", placeItems: "center", boxShadow: "0 0 0 12px #F3E7CC" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E2C98A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></svg>
                  </span>
                  <div style={{ fontSize: "clamp(28px,3.4vw,42px)", fontStyle: "italic", marginBottom: 10 }}>Drop your bank statement here</div>
                  <div style={{ color: HT.muted, fontSize: 18, marginBottom: 22 }}>or choose a file. We&apos;ll read it line by line.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 30 }}>
                    <span className="bi-chip" style={{ background: HT.green, color: "#FFFFFF", borderColor: HT.green }}>PDF · read by AI</span>
                    <span className="bi-chip">XLSX</span><span className="bi-chip">XLS</span><span className="bi-chip">CSV</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                    <span className="bi-btn" style={{ background: "linear-gradient(160deg,#DDBE78,#C9A24A)", color: HT.ink, boxShadow: "0 14px 28px -14px rgba(201,162,74,.95)" }}>Choose file <span aria-hidden>→</span></span>
                    <a href="/finance/whatsapp" onClick={e => e.stopPropagation()} className="bi-btn" style={{ border: "1px solid #D9C79A", background: "#FFFFFF", color: HT.ink }}><span aria-hidden style={{ fontSize: 18 }}>◌</span> Send from WhatsApp</a>
                  </div>
                  {shelfStatements.length > 0 && (
                    <div style={{ marginTop: 26, fontSize: 17, color: HT.muted }}>Already on your Shelf?{" "}
                      <button type="button" onClick={e => { e.stopPropagation(); setShowShelf(true); setTimeout(() => document.getElementById("bi-shelf")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }} style={{ background: "none", border: "none", padding: 0, font: "inherit", color: HT.goldInk, textDecoration: "underline", cursor: "pointer" }}>Pick from {shelfStatements.length} bank file{shelfStatements.length === 1 ? "" : "s"}</button>
                    </div>
                  )}
                </>
              )}
            </div>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={onFileInput} style={{ display: "none" }} />

            {locked && (
              <form onSubmit={e => { e.preventDefault(); if (pdfPassword) void handleFile(locked.file); }}
                style={{ marginTop: 26, background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 26, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                  <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 12, background: "#FBE9E6", color: "#B0402C", display: "grid", placeItems: "center", fontSize: 15, letterSpacing: ".08em", flexShrink: 0 }}>PDF</span>
                  <span style={{ flex: 1, minWidth: 200 }}>
                    <span style={{ display: "block", fontSize: 22, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{locked.file.name}</span>
                    <span style={{ fontSize: 16, color: locked.wrong ? "#B4321F" : HT.muted }}>{locked.wrong ? "That password didn't work. Try again." : "Locked by your bank. Enter the password to read it."}</span>
                  </span>
                  <span style={{ padding: "8px 16px", borderRadius: 999, background: "#FBEFD6", color: HT.goldInk, fontSize: 15.5 }}>🔒 Password-protected</span>
                </div>
                <label htmlFor="bi-pw" style={{ fontSize: 17, marginTop: 6 }}>Statement password</label>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ position: "relative", flex: "1 1 260px", display: "flex" }}>
                    <input id="bi-pw" type={showPw ? "text" : "password"} autoFocus value={pdfPassword} onChange={e => setPdfPassword(e.target.value)} placeholder="e.g. customer ID" autoComplete="off"
                      style={{ flex: 1, height: 60, borderRadius: 14, border: `1px solid ${HT.line}`, background: "#FBF7EE", padding: "0 54px 0 22px", fontSize: 18, fontFamily: "inherit", color: HT.ink, minWidth: 0 }} />
                    <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"} style={{ position: "absolute", right: 10, top: 10, width: 40, height: 40, border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: HT.muted }}>{showPw ? "◡" : "◉"}</button>
                  </span>
                  <button type="submit" disabled={!pdfPassword} style={{ height: 60, padding: "0 34px", borderRadius: 14, border: "none", background: HT.green, color: "#FFFFFF", fontFamily: "inherit", fontSize: 19, cursor: pdfPassword ? "pointer" : "default", opacity: pdfPassword ? 1 : 0.6, display: "inline-flex", alignItems: "center", gap: 10 }}>🔓 Unlock &amp; read</button>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 16, color: HT.muted }}>
                  Banks usually use:
                  <span style={{ padding: "6px 14px", borderRadius: 8, background: "#F1EADB", color: HT.ink }}>Customer ID</span>
                  <span style={{ padding: "6px 14px", borderRadius: 8, background: "#F1EADB", color: HT.ink }}>First letters of name + date of birth</span>
                  <span>· check the bank&apos;s email</span>
                </div>
              </form>
            )}

            {parseError && (
              <div style={{ marginTop: "1rem", background: "rgba(194,50,31,0.07)", border: "1px solid rgba(194,50,31,0.25)", borderRadius: 10, padding: "1rem 1.1rem" }}>
                <div style={{ color: "#B4321F", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>⚠ {parseError}</div>
                <div style={{ color: "#7A93B4", fontSize: "0.78rem", lineHeight: 1.6 }}>
                  <strong style={{ color: "#10241F" }}>Tip:</strong> Most Indian banks (SBI, HDFC, ICICI, Axis, Kotak) let you download statements as <strong style={{ color: "#12352D" }}>Excel (.xlsx)</strong> from NetBanking → Account Statement → Download. Excel always works reliably.
                </div>
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem" }}>
                  <button onClick={() => fileRef.current?.click()} style={{ background: "#12352D", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                    Try Another File
                  </button>
                  <button onClick={() => setParseError("")} style={{ background: "none", border: "1px solid #FFFFFF", color: "#6E88A8", borderRadius: 7, padding: "7px 14px", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            </div>
            <aside style={{ position: "relative", overflow: "hidden", background: HT.green, color: "#FFFFFF", borderRadius: 28, padding: "40px 40px 32px", display: "flex", flexDirection: "column" }}>
              <span aria-hidden="true" style={{ position: "absolute", right: -90, top: -70, width: 260, height: 260, borderRadius: "50%", border: "1px solid rgba(226,201,138,0.18)" }} />
              <span aria-hidden="true" style={{ position: "absolute", right: -40, top: -20, width: 160, height: 160, borderRadius: "50%", border: "1px solid rgba(226,201,138,0.14)" }} />
              <div style={{ fontSize: 13, letterSpacing: "0.3em", color: HT.gold }}>HOW IT WORKS</div>
              <div style={{ fontSize: "clamp(28px,2.6vw,38px)", margin: "14px 0 34px", lineHeight: 1.2 }}>Statement to books, <i style={{ color: "#E2C98A" }}>in three steps</i></div>
              {[["Upload", "Pick the bank ledger and drop the PDF or Excel statement."], ["Assign ledgers", "Check the suggested ledger for each line and change any you disagree with."], ["Approve and post", "Approved lines become journal entries and flow through to the ledger, trial balance and financial statements."]].map(([t, d], i) => (
                <div key={t} style={{ display: "flex", gap: 20, marginBottom: 30 }}>
                  <span style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 999, border: `1px solid ${HT.gold}`, background: i === 0 ? "linear-gradient(160deg,#DDBE78,#C9A24A)" : "transparent", color: i === 0 ? HT.ink : HT.gold, display: "grid", placeItems: "center", fontSize: 20 }}>{i + 1}</span>
                  <span><span style={{ display: "block", fontSize: 24, marginBottom: 6 }}>{t}</span><span style={{ fontSize: 17, color: "#C9D3CE", lineHeight: 1.6 }}>{d}</span></span>
                </div>
              ))}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 14, padding: "20px 24px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", fontSize: 17, fontStyle: "italic", color: "#E9EEEC" }}><span aria-hidden style={{ color: HT.gold, fontStyle: "normal" }}>✳</span>Chat in. Books out.</div>
            </aside>
            </div>
          </div>
        )}

        {/* ── Which account is this statement for? ── */}
        {acctAsk && rows.length > 0 && (() => {
          const pool = bankAccounts.filter(a => acctAsk.kind === "loan" ? loanLike(a as never) : !loanLike(a as never));
          const busy = acctAsk.creating, isNew = acctAsk.pick === "__new" || !pool.length;
          return (
            <div className="bi-ask-wrap" role="dialog" aria-modal="true" aria-labelledby="bi-ask-t" onKeyDown={e => { if (e.key === "Escape") { acctChosen.current = !!bankAccountId; setAcctAsk(null); } }}>
              <div className="bi-ask" style={{ transform: `translate(${askPos.x}px, ${askPos.y}px)` }}>
                <div className="bi-ask-grip" title="Drag to move"
                  onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: askPos.x, oy: askPos.y }; }}
                  onPointerMove={e => { const d = drag.current; if (d) setAskPos({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }); }}
                  onPointerUp={() => { drag.current = null; }}>
                  <span aria-hidden="true">⠿</span>
                  <button onClick={() => { acctChosen.current = !!bankAccountId; setAcctAsk(null); }} aria-label="Close" className="bi-ask-x" onPointerDown={e => e.stopPropagation()}>×</button>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#9A6B22" }}>{rows.length} LINES READ{acctAsk.hint ? ` · LOOKS LIKE ${acctAsk.hint.toUpperCase()}` : ""}</div>
                <h2 id="bi-ask-t">Which account is this statement for?</h2>
                <div className="bi-ask-kind" role="radiogroup" aria-label="Statement type">
                  {(["bank", "loan"] as const).map(k => (
                    <button key={k} role="radio" aria-checked={acctAsk.kind === k} className={acctAsk.kind === k ? "on" : ""}
                      onClick={() => { const pl = bankAccounts.filter(a => k === "loan" ? loanLike(a as never) : !loanLike(a as never)); setAcctAsk(a => a && { ...a, kind: k, pick: pl.length === 1 ? pl[0].id : pl.length ? "" : "__new", newName: a.hint ? (k === "loan" ? `${a.hint} Loan A/c` : `${a.hint}${/bank/i.test(a.hint) ? "" : " Bank"}`) : "" }); }}>
                      <b>{k === "bank" ? "Bank account" : "Loan account"}</b>
                      <small>{k === "bank" ? "Current / savings / OD — posts Payment & Receipt" : "Term, vehicle, home, gold loan — posts Journal"}</small>
                    </button>
                  ))}
                </div>
                <div className="bi-ask-list">
                  {pool.map(a => (
                    <label key={a.id} className={"bi-ask-opt" + (acctAsk.pick === a.id ? " on" : "")}>
                      <input type="radio" name="bi-acct" checked={acctAsk.pick === a.id} onChange={() => setAcctAsk(x => x && { ...x, pick: a.id })} />
                      <span>{decode(a.name)}</span>
                    </label>
                  ))}
                  <label className={"bi-ask-opt" + (isNew ? " on" : "")}>
                    <input type="radio" name="bi-acct" checked={isNew} onChange={() => setAcctAsk(x => x && { ...x, pick: "__new" })} />
                    <span>＋ New {acctAsk.kind === "loan" ? "loan" : "bank"} ledger</span>
                  </label>
                  {isNew && (
                    <input autoFocus key={`${acctAsk.kind}-${acctAsk.hint}`} defaultValue={acctAsk.newName}
                      ref={el => { newNameRef.current = el ? el.value : null; }}
                      onChange={e => { newNameRef.current = e.target.value; const filled = !!e.target.value.trim(); if (filled !== !!acctAsk.newName.trim()) setAcctAsk(x => x && { ...x, newName: e.target.value }); }} onKeyDown={e => { if (e.key === "Enter") void confirmAcct(); }}
                      placeholder={acctAsk.kind === "loan" ? "e.g. Federal Bank Term Loan A/c" : "e.g. Federal Bank Current A/c"} aria-label="New ledger name" className="bi-ask-new" />
                  )}
                </div>
                <div className="bi-ask-foot">
                  <span>{isNew ? `Created under ${acctAsk.kind === "loan" ? "Loans (Liability)" : "Bank Accounts"}.` : "You can change it later at the top of the page."}</span>
                  <button onClick={() => void confirmAcct()} disabled={busy || (isNew ? !acctAsk.newName.trim() : !acctAsk.pick)} className="bi-ask-go">{busy ? "Creating…" : isNew ? "Create & continue →" : "Continue →"}</button>
                </div>
              </div>
              <style>{`
                .bi-ask-wrap{position:fixed;inset:0;z-index:60;background:rgba(10,31,27,.55);display:grid;place-items:center;padding:16px}
                .bi-ask{width:min(560px,100%);max-height:calc(100vh - 32px);overflow-y:auto;background:#FFFDF8;border-radius:26px;padding:10px 28px 24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 40px 80px -30px rgba(6,26,22,.7)}
                .bi-ask h2{margin:0;font-family:'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif;font-size:26px;color:#0B2C25}
                .bi-ask-kind{display:grid;grid-template-columns:1fr 1fr;gap:10px}
                .bi-ask-kind button{text-align:left;padding:12px 14px;border-radius:16px;border:1.5px solid #E6DFD0;background:#fff;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:3px;color:#0B2C25}
                .bi-ask-kind button small{font-size:11.5px;color:#5E6B66}
                .bi-ask-kind button.on{border-color:#0B2C25;background:#0B2C25;color:#fff}.bi-ask-kind button.on small{color:#B9D0C7}
                .bi-ask-list{display:flex;flex-direction:column;gap:6px;max-height:min(300px,40vh);overflow-y:auto;padding:2px}
                .bi-ask-grip{display:flex;align-items:center;justify-content:space-between;cursor:grab;user-select:none;touch-action:none;color:#C9B98F;font-size:18px;padding:6px 0 2px;position:sticky;top:-10px;background:#FFFDF8;z-index:1}
                .bi-ask-grip:active{cursor:grabbing}
                .bi-ask-x{width:34px;height:34px;border-radius:999px;border:1px solid #E6DFD0;background:#fff;color:#0B2C25;font-size:18px;cursor:pointer}
                .bi-ask-opt{flex:none}
                .bi-ask-opt{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:14px;border:1px solid #EFE2C4;background:#fff;cursor:pointer;font-size:14px;font-weight:700;color:#0B2C25}
                .bi-ask-opt.on{border-color:#0B7A55;background:#F2FAF6}
                .bi-ask-opt input{accent-color:#0B2C25;width:17px;height:17px}
                .bi-ask-new{flex:none;height:44px;border-radius:12px;border:1.5px solid #E9C27A;padding:0 14px;font:inherit;font-size:14.5px;font-weight:700;outline:none}
                .bi-ask-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid #F1E8D6;padding-top:14px}
                .bi-ask-foot span{flex:1 1 200px;font-size:12.5px;color:#5E6B66}
                .bi-ask-go{height:46px;padding:0 22px;border-radius:999px;border:none;background:linear-gradient(135deg,#F3D9A2,#E9C27A);color:#10241F;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
                .bi-ask-go:disabled{background:#E6E2D8;color:#8A918D;cursor:default}
                .bi-ask-kind button:focus-visible,.bi-ask-go:focus-visible{outline:2px solid #E9C27A;outline-offset:2px}
              `}</style>
            </div>
          );
        })()}

        {/* ── Main table view ── */}
        {rows.length > 0 && (() => {
          const acctName = bankAccounts.find(a => a.id === bankAccountId)?.name ?? coa.find(a => a.id === bankAccountId)?.name ?? "";
          const sug = rows.filter(r => r.suggested && r.ledger_id && !r.pushed).length;
          const need = rows.filter(r => !r.ledger_id && !r.pushed).length;
          const other = rows.length - sug - need;
          const drRows = rows.filter(r => r.debit > 0), crRows = rows.filter(r => r.credit > 0);
          const drSum = drRows.reduce((s, r) => s + r.debit, 0), crSum = crRows.reduce((s, r) => s + r.credit, 0);
          const inr2 = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const toPush = rows.filter(r => !r.pushed).length;
          const goUnassigned = () => { setFilterStatus("unassigned"); setTimeout(() => document.getElementById("bi-table")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };
          // Group the new ledgers, and find look-alikes (same first word) to merge
          const used = new Set(rows.map(r => (r.ledger_name ?? "").toLowerCase()));
          const fresh = newLedgers.filter(n => used.has(n.toLowerCase()));
          const groups: [string, RegExp | null][] = [["PhonePe payees", /phone ?pe|phonepe|ybl\b/i], ["Paytm payees", /paytm|ptys|paytmqr/i], ["Bank transfers (IMPS / NEFT)", /\b(ibkl|idfb|sibl|fdrl|hdfc|icic|sbin|utib|kkbk|barb|cnrb|ubin|neft|imps|rtgs)\b/i], ["Expense heads & businesses", null]];
          const byGroup = groups.map(([label, re]) => [label, fresh.filter(n => re ? re.test(n) : !groups.slice(0, 3).some(([, r]) => r!.test(n)))] as const).filter(([, l]) => l.length);
          const fw = (n: string) => (n.toLowerCase().match(/[a-z]{4,}/) ?? [""])[0];
          const dupMap = new Map<string, string[]>(); fresh.forEach(n => { const k = fw(n); if (k && !/^(phonepe|paytm|bank|cash|sales|purchase)/.test(k)) dupMap.set(k, [...(dupMap.get(k) ?? []), n]); });
          const dups = [...dupMap.values()].filter(g => g.length > 1);
          const chip: React.CSSProperties = { padding: "8px 16px", borderRadius: 999, background: "#F4ECDD", border: "1px solid #EADFC8", fontSize: 16.5, color: HT.ink, whiteSpace: "nowrap" };
          const steps = [
            { n: 1, t: fresh.length ? `Review ${fresh.length} new ledger${fresh.length === 1 ? "" : "s"}` : "Check the suggestions", d: fresh.length ? "Merge look-alikes before they reach the books" : "Change any ledger you disagree with", on: true, go: () => document.getElementById("bi-new")?.scrollIntoView({ behavior: "smooth" }) },
            { n: 2, t: need ? `Choose a ledger for ${need} row${need === 1 ? "" : "s"}` : "Every row has a ledger", d: need ? "No confident suggestion for these" : "Nothing left unassigned", warn: need > 0, go: goUnassigned },
            { n: 3, t: `Push ${toPush} entr${toPush === 1 ? "y" : "ies"} to books`, d: need ? "Unlocks once nothing is unassigned" : "Ready when you are", go: () => { if (!need && unpushedAssigned) void pushToJournals(); } },
          ];
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, margin: "18px 0 26px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                <div style={{ marginRight: "auto", minWidth: 0 }}>
                  <div style={{ fontSize: 13, letterSpacing: "0.2em", color: HT.goldInk, textTransform: "uppercase" }}>FreBook · Bank import{acctName ? ` · ${acctName}` : ""}</div>
                  <h1 style={{ margin: "10px 0 6px", fontWeight: 400, fontStyle: "italic", fontSize: "clamp(40px,5.2vw,66px)", lineHeight: 1.05 }}>Assign ledgers</h1>
                  <div style={{ fontSize: 18, color: HT.muted }}>{rows.length} transactions read. {sug ? "FreBook suggested most of them; check, fix the rest, then push to books." : "Pick a ledger for each line (or let FreBook suggest), then push to books."}</div>
                </div>
                {savedAt && <span style={{ fontSize: 16, color: HT.muted }}>✓ Saved {new Date(savedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
                {steps.map(s => (
                  <button key={s.n} onClick={s.go} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 18, padding: "24px 26px", borderRadius: 18, background: HT.paper, border: s.on ? `1.5px solid ${HT.green}` : `1px solid ${HT.line}` }}>
                    <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 18, background: s.on ? HT.green : s.warn ? "#FBE9E4" : "#F1EADB", color: s.on ? "#FFFFFF" : s.warn ? "#B23A20" : HT.muted, border: s.warn ? "1px solid #F0CFC5" : "none" }}>{s.n}</span>
                    <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 20, color: HT.ink }}>{s.t}</span><span style={{ fontSize: 15.5, color: HT.muted }}>{s.d}</span></span>
                  </button>
                ))}
              </div>
              <section style={{ background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 22, padding: "28px 30px" }}>
                <div role="img" aria-label={`${sug} suggested, ${need} need you, ${other} other`} style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "#EFE8DA" }}>
                  {sug > 0 && <span style={{ width: `${(sug / rows.length) * 100}%`, background: "#CBA35A" }} />}
                  {need > 0 && <span style={{ width: `${(need / rows.length) * 100}%`, minWidth: 6, background: "#B23A20" }} />}
                  {other > 0 && <span style={{ width: `${(other / rows.length) * 100}%`, background: HT.green }} />}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginTop: 22 }}>
                  {[["Suggested", String(sug), ""], ["Needs you", String(need), "#B23A20"], ["Other rows", String(other), ""], [`Payments (Dr) · ${drRows.length}`, inr2(drSum), ""], [`Receipts (Cr) · ${crRows.length}`, inr2(crSum), ""]].map(([l, v, c]) => (
                    <div key={l} style={{ minWidth: 0 }}><div style={{ fontSize: 16, color: c || HT.muted }}>{l}</div><div style={{ fontSize: 26, marginTop: 4, color: c || HT.ink, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div></div>
                  ))}
                </div>
              </section>
              {fresh.length > 0 && (
                <section id="bi-new" style={{ background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 22, padding: "30px 34px", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ marginRight: "auto" }}><div style={{ fontSize: 36, fontStyle: "italic" }}>{fresh.length} new ledger{fresh.length === 1 ? "" : "s"}</div><div style={{ fontSize: 17, color: HT.muted, marginTop: 4 }}>Grouped by how they were paid, instead of one long paragraph</div></div>
                    <button onClick={() => setShowAllNew(v => !v)} style={{ all: "unset", cursor: "pointer", color: HT.ink, textDecoration: "underline", fontSize: 17 }}>{showAllNew ? "Show fewer" : `See all ${fresh.length} →`}</button>
                  </div>
                  {dups.length > 0 && (
                    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", padding: "22px 24px", borderRadius: 18, background: "#F8EEDA", border: "1px solid #EBD9B0" }}>
                      <div style={{ flex: "1 1 520px", minWidth: 0 }}>
                        <div style={{ fontSize: 19, marginBottom: 12 }}>Possible duplicates — same party, different spelling</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{dups.slice(0, showAllNew ? 99 : 4).map(g => <span key={g.join("|")} style={{ ...chip, background: "#FFFFFF" }}>{g.join(" · ")}</span>)}</div>
                      </div>
                      <button onClick={() => setMergeOpen(true)} style={{ height: 54, padding: "0 26px", borderRadius: 999, border: "none", background: HT.green, color: "#FFFFFF", fontFamily: "inherit", fontSize: 17, cursor: "pointer" }}>Review merges</button>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(420px,100%),1fr))", gap: 18 }}>
                    {byGroup.map(([label, list]) => (
                      <div key={label} style={{ border: `1px solid ${HT.line}`, borderRadius: 18, padding: "20px 22px" }}>
                        <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: HT.goldInk, marginBottom: 14 }}>{label}</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {list.slice(0, showAllNew ? list.length : 6).map(n => <span key={n} style={chip}>{n}</span>)}
                          {!showAllNew && list.length > 6 && <button onClick={() => setShowAllNew(true)} style={{ ...chip, background: "#FFFFFF", cursor: "pointer", fontFamily: "inherit" }}>+ {list.length - 6} more</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {mergeOpen && (
                <div role="dialog" aria-modal="true" aria-label="Merge look-alike ledgers" onClick={() => setMergeOpen(false)} onKeyDown={e => { if (e.key === "Escape") setMergeOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,36,31,.45)", display: "grid", placeItems: "center", padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", maxHeight: "85vh", overflow: "auto", background: HT.paper, borderRadius: 22, padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "baseline" }}><b style={{ fontSize: 24, fontWeight: 400, fontStyle: "italic", flex: 1 }}>Merge look-alikes</b><button onClick={() => setMergeOpen(false)} aria-label="Close" style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: HT.muted }}>×</button></div>
                    <span style={{ fontSize: 15.5, color: HT.muted }}>Pick the one ledger each group should use. Its rows move to that ledger; the unused spelling stays in the Chart of Accounts until you delete it.</span>
                    {dups.map(g => (
                      <div key={g.join("|")} style={{ border: `1px solid ${HT.line}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 15, color: HT.muted, marginRight: 6 }}>Use</span>
                        {g.map(n => <button key={n} onClick={() => {
                          const target = coa.find(a => a.name.toLowerCase() === n.toLowerCase()); if (!target) return;
                          const others = new Set(g.filter(x => x !== n).map(x => x.toLowerCase()));
                          setRows(rs => rs.map(r => !r.pushed && others.has((r.ledger_name ?? "").toLowerCase()) ? { ...r, ledger_id: target.id, ledger_name: target.name } : r));
                          setNewLedgers(l => l.filter(x => !others.has(x.toLowerCase())));
                        }} style={{ ...chip, background: "#FFFFFF", cursor: "pointer", fontFamily: "inherit" }}>{n}</button>)}
                      </div>
                    ))}
                    {!dups.length && <span style={{ color: "#0B7A55" }}>✓ No look-alikes left.</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {rows.length > 0 && (
          <div id="bi-table" className="bi-review">

            {/* ── Table (full width; the account, summary and Push sit in a bar above it) ── */}
            <div className="bi-main">

              {/* Filters row */}
              <div className="bi-card" style={{ padding: "12px 14px", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description…" style={{ ...inp, flex: "1 1 180px", minWidth: 140 }} />

                {/* Date range */}
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inp, width: 130 }} title="From date" />
                <span style={{ color: "#E6DFD0", fontSize: "0.75rem" }}>–</span>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inp, width: 130 }} title="To date" />

                {/* Type filter */}
                {(["all", "debit", "credit"] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`bs-filter-btn${filterType === t ? " active" : ""}`}>
                    {t === "all" ? "All" : t === "debit" ? "💸 Payments" : "💰 Receipts"}
                  </button>
                ))}

                {/* Status filter */}
                {(["all", "unassigned", "assigned", "pushed"] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={`bs-filter-btn${filterStatus === s ? " active" : ""}`}>
                    {s === "all" ? "All" : s === "unassigned" ? "⬜ Unassigned" : s === "assigned" ? "✅ Assigned" : "✓ Pushed"}
                  </button>
                ))}

                <span style={{ marginLeft: "auto", fontSize: "0.74rem", color: "#6B7570" }}>{filtered.length} shown</span>
              </div>

              {/* Suggest + saved */}
              <div className="bi-card bi-suggest" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, padding: "10px 14px" }}>
                <button onClick={() => suggestLedgers(true)} disabled={suggesting || !rows.some(r => !r.pushed && !r.ledger_id)}
                  style={{ height: 38, padding: "0 18px", borderRadius: 999, border: "none", background: rows.some(r => !r.pushed && !r.ledger_id) ? "linear-gradient(135deg,#F3D9A2,#E9C27A)" : "#E6E2D8", color: "#10241F", fontWeight: 800, fontSize: "0.84rem", cursor: "pointer", fontFamily: "inherit" }}>
                  {suggesting ? "Suggesting…" : `✨ Suggest ledgers${rows.some(r => !r.pushed && !r.ledger_id) ? ` for ${rows.filter(r => !r.pushed && !r.ledger_id).length}` : ""}`}
                </button>
                <span style={{ fontSize: "0.76rem", color: "#6B7570", flex: 1, minWidth: 200 }}>{suggestMsg || "Reads each description (rent, salary, electricity, bank charges, party names…) and creates any missing ledger under the right group."}</span>
                {savedAt && <span title="Saved on this device — come back any time" style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0B7A55" }}>💾 Saved {new Date(savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>

              {/* Select by Dr / Cr, see the totals, assign one ledger to all of them */}
              {(() => {
                const open = rows.filter(r => !r.pushed);
                const drs = open.filter(r => r.debit > 0), crs = open.filter(r => r.credit > 0), un = open.filter(r => !r.ledger_id);
                const sel = rows.filter(r => selected.has(r.id));
                const sum = (l: TxRow[], k: "debit" | "credit") => l.reduce((t, r) => t + (r[k] || 0), 0);
                const pick = (l: TxRow[]) => setSelected(new Set(l.map(r => r.id)));
                const same = (l: TxRow[]) => l.length > 0 && l.length === sel.length && l.every(r => selected.has(r.id));
                return (
                  <div className="bi-bulk">
                    <div className="bi-bulk-row">
                      <span className="bi-bulk-lbl">SELECT</span>
                      <button className={"bi-pick dr" + (same(drs) ? " on" : "")} onClick={() => pick(drs)} disabled={!drs.length}>All Dr <b>{drs.length}</b><small>{cur()}{fmt(sum(drs, "debit")) || "0.00"}</small></button>
                      <button className={"bi-pick cr" + (same(crs) ? " on" : "")} onClick={() => pick(crs)} disabled={!crs.length}>All Cr <b>{crs.length}</b><small>{cur()}{fmt(sum(crs, "credit")) || "0.00"}</small></button>
                      <button className={"bi-pick" + (same(un) ? " on" : "")} onClick={() => pick(un)} disabled={!un.length}>No ledger <b>{un.length}</b></button>
                      {sel.length > 0 && <button className="bi-clear" onClick={() => setSelected(new Set())}>Clear</button>}
                    </div>
                    {sel.length > 0 && (
                      <div className="bi-dock" role="region" aria-label="Selected lines">
                        <span className="bi-dock-sel"><b>{sel.length} selected</b>{sum(sel, "debit") > 0 && <span>Dr {cur()}{fmt(sum(sel, "debit"))}</span>}{sum(sel, "credit") > 0 && <span>Cr {cur()}{fmt(sum(sel, "credit"))}</span>}</span>
                        <input list="bs-ledgers" key={bulkLedgerId || "none"} defaultValue={bulkLedgerId ? decode(coa.find(x => x.id === bulkLedgerId)?.name ?? "") : ""} placeholder="Assign one ledger to all selected…" aria-label="Ledger for the selected lines"
                          onChange={e => { const v = e.target.value.trim().toLowerCase(); const hit = coa.find(x => decode(x.name).toLowerCase() === v || `${decode(x.name)} · ${x.type}`.toLowerCase() === v); setBulkLedgerId(hit?.id ?? ""); }}
                          className="bi-dock-in" />
                        <button onClick={applyBulkAssign} disabled={!bulkLedgerId} className="bi-dock-as">Assign</button>
                        <button onClick={() => void pushToJournals()} disabled={pushing || !unpushedAssigned || !bankAccountId || un.length > 0} className="bi-dock-push" title={un.length ? "Give every line a ledger first" : undefined}>{pushing ? "Posting…" : `Push to books${un.length ? ` · ${un.length} left` : ""}`}</button>
                        <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="bi-dock-x">×</button>
                      </div>
                    )}
                    <style>{`
                      .bi-bulk{background:#FFFDF8;border:1px solid #EFE2C4;border-radius:16px;padding:12px 14px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px}
                      .bi-dock{position:fixed;z-index:40;bottom:16px;left:50%;transform:translateX(-50%);width:min(1240px,calc(100vw - 32px));box-sizing:border-box;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 22px;border-radius:18px;background:#16342D;color:#FFFFFF;box-shadow:0 24px 50px -20px rgba(16,36,31,.7)}
                      .bi-dock-sel{display:flex;gap:18px;align-items:baseline;font-size:17px;white-space:nowrap}.bi-dock-sel span{color:#D3DCD8}
                      .bi-dock-in{flex:1 1 260px;min-width:0;height:52px;border-radius:12px;border:none;padding:0 16px;font:inherit;font-size:16.5px;background:#FFFFFF;color:#10241F}
                      .bi-dock-as{height:52px;padding:0 26px;border-radius:999px;border:none;background:#FFFFFF;color:#10241F;font:inherit;font-size:17px;cursor:pointer}
                      .bi-dock-push{height:52px;padding:0 24px;border-radius:999px;border:none;background:linear-gradient(160deg,#DDBE78,#C9A24A);color:#10241F;font:inherit;font-size:17px;cursor:pointer}
                      .bi-dock-as:disabled,.bi-dock-push:disabled{opacity:.5;cursor:default}
                      .bi-dock-x{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:transparent;color:#FFFFFF;font-size:20px;cursor:pointer}
                      .bi-bulk-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
                      .bi-bulk-lbl{font-size:10.5px;font-weight:800;letter-spacing:.16em;color:#9A6B22;margin-right:4px}
                      .bi-pick{height:36px;padding:0 12px;border-radius:999px;border:1px solid #E6DFD0;background:#fff;color:#12352D;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
                      .bi-pick b{font-size:11px;background:#F4EEDF;border-radius:999px;padding:1px 7px}
                      .bi-pick small{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:#6B7570}
                      .bi-pick.dr small{color:#B4321F}.bi-pick.cr small{color:#0B7A55}
                      .bi-pick.on{background:#12352D;color:#fff;border-color:#12352D}.bi-pick.on b{background:#E9C27A;color:#12352D}.bi-pick.on small{color:#E9C27A}
                      .bi-pick:disabled{opacity:.45;cursor:default}
                      .bi-clear{background:none;border:none;color:#6B7570;font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline}
                      .bi-bulk-sel{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#12352D}
                      .bi-amt{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px}
                      .bi-amt.dr{background:#FDECEA;color:#B4321F}.bi-amt.cr{background:#E3F6EE;color:#0B7A55}
                      .bi-assign{height:36px;padding:0 18px;border-radius:999px;border:none;background:#12352D;color:#fff;font:inherit;font-weight:800;font-size:13px;cursor:pointer}
                      .bi-assign:disabled{background:#C9CFC9;cursor:default}
                    `}</style>
                  </div>
                );
              })()}

              {/* Table */}
              <div style={{ background: "#FFFDF8", border: "1px solid #FFFFFF", borderRadius: 12, overflow: "hidden" }}>
        {failed.length > 0 && (() => {
          const byId = new Map(rows.map(r => [r.id, r]));
          const dups = failed.filter(f => f.code === "POSSIBLE_DUPLICATE" && byId.get(f.id) && !byId.get(f.id)!.pushed);
          const other = failed.filter(f => f.code !== "POSSIBLE_DUPLICATE" && byId.get(f.id) && !byId.get(f.id)!.pushed);
          const amt = (r: { debit: number; credit: number }) => `${r.debit ? "−" : "+"}₹${Math.round(r.debit || r.credit).toLocaleString("en-IN")}`;
          const line = (f: { id: string; error: string }, act?: React.ReactNode) => { const r = byId.get(f.id)!; return (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: "90px minmax(0,1fr) 110px auto", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid #EFE6D3", fontSize: 13 }}>
              <span style={{ color: "#6B7570" }}>{r.date}</span>
              <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</span><span style={{ fontSize: 12, color: "#8A5A00" }}>{f.error.replace(/^Possible duplicate — not posted\.\s*/, "Looks like ")}</span></span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.debit ? "#B4321F" : "#0B7A55" }}>{amt(r)}</span>
              {act ?? <span />}
            </div>); };
          if (!dups.length && !other.length) return null;
          return (
            <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
              {dups.length > 0 && (
                <div style={{ background: "#FFF8E8", border: "1px solid #F2D29B", borderRadius: 14, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <b style={{ color: "#5A3A00" }}>⚠ {dups.length} possible duplicate{dups.length === 1 ? "" : "s"} — not posted</b>
                    <span style={{ fontSize: 13, color: "#6B5A2E", flex: 1 }}>An entry with the same amount and ledgers is already in the books. Post only if this is a separate transaction (e.g. a monthly EMI or rent).</span>
                    <button onClick={() => { if (window.confirm(`Post all ${dups.length} anyway? Only do this if each is a separate transaction.`)) void pushToJournals(dups.map(d => d.id), true); }} disabled={pushing}
                      style={{ height: 32, padding: "0 14px", borderRadius: 999, border: "none", background: "#12352D", color: "#FFFFFF", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Post all anyway</button>
                  </div>
                  {dups.map(f => line(f, <button onClick={() => { if (window.confirm("Post this one anyway?")) void pushToJournals([f.id], true); }} disabled={pushing} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: "1px solid #E6DFD0", background: "#FFFFFF", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 12 }}>Post anyway</button>))}
                </div>
              )}
              {other.length > 0 && (
                <div style={{ background: "#FDECEA", border: "1px solid #F3C2BA", borderRadius: 14, padding: "12px 16px" }}>
                  <b style={{ color: "#8A2A1A" }}>✕ {other.length} not posted</b> <span style={{ fontSize: 13, color: "#7A3A2E" }}>— fix the reason below (usually the ledger or the date), then press Push again.</span>
                  {other.map(f => line(f))}
                </div>
              )}
            </div>
          );
        })()}
        <datalist id="bs-ledgers">{coa.map(a => <option key={a.id} value={`${decode(a.name)} · ${a.type}`} />)}</datalist>
                <div style={{ overflowX: "auto" }}>
                  <table className="bi-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "#FFFDF8", borderBottom: "1px solid #FFFFFF" }}>
                        <th style={{ padding: "0.6rem 0.75rem", width: 36, textAlign: "center" }}>
                          <input type="checkbox" className="bs-sel" checked={allFilteredSelected} onChange={toggleAll} />
                        </th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#6B7570", fontWeight: 800, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Date</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#6B7570", fontWeight: 800, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#6B7570", fontWeight: 800, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Debit (Dr)</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#6B7570", fontWeight: 800, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Credit (Cr)</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#6B7570", fontWeight: 800, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Balance</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#6B7570", fontWeight: 800, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ledger Account</th>
                        <th style={{ padding: "0.6rem 0.75rem", width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, showN).map((row, i) => (
                        <React.Fragment key={row.id}>
                          <tr
                            className={`bs-row${row.pushed ? " pushed" : ""}`}
                            style={{ borderTop: i === 0 ? "none" : "1px solid #FFFFFF", background: selected.has(row.id) ? "rgba(37,99,235,0.06)" : "transparent" }}
                          >
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                              <input type="checkbox" className="bs-sel" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", color: "#6E88A8", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem" }}>
                              {fmtDate(row.date)}
                            </td>
                            <td className="bi-desc" style={{ padding: "0.6rem 0.75rem", color: "#10241F" }} title={row.description}>
                              {row.description || <span style={{ color: "#E6DFD0" }}>—</span>}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.debit ? "#B4321F" : "#E6DFD0", fontWeight: row.debit ? 600 : 400 }}>
                              {row.debit ? `${cur()}${fmt(row.debit)}` : ""}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.credit ? "#0B7A55" : "#E6DFD0", fontWeight: row.credit ? 600 : 400 }}>
                              {row.credit ? `${cur()}${fmt(row.credit)}` : ""}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: "#6B7570", fontSize: "0.7rem" }}>
                              {row.balance ? `${cur()}${fmt(row.balance)}` : ""}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              {row.suggested && !row.pushed && addLedgerRow !== row.id && <span title="Suggested from the description — change it if wrong" style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: "#9A6B22", background: "#FFF4DB", borderRadius: 999, padding: "1px 7px", marginBottom: 4 }}>✨ Suggested</span>}
                              {row.pushed ? (
                                <span className="bs-chip" style={{ background: "rgba(11,122,85,0.12)", color: "#0B7A55" }}>✓ Pushed</span>
                              ) : addLedgerRow === row.id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 14, background: "#FFFDF8", border: "1px solid rgba(18,53,45,0.16)", boxShadow: "0 12px 28px -18px rgba(16,36,31,0.45)", minWidth: 300, maxWidth: 380 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A90AE" }}>New ledger</span>
                                    <span style={{ fontSize: 11, color: "#6B7570" }}>· money {row.debit ? "paid out" : "received"}</span>
                                    <button onClick={() => setAddLedgerRow(null)} aria-label="Cancel" style={{ marginLeft: "auto", background: "none", border: "none", color: "#6B7570", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                                  </div>
                                  <input autoFocus value={newLedgerName} placeholder={row.debit ? "e.g. Office Rent, Purchases, Supplier name" : "e.g. Sales, Customer name, Interest Received"}
                                    onChange={e => { const v = e.target.value; setNewLedgerName(v); if (!groupTouched) setNewLedgerType(guessGroup(v, row.debit ? "out" : "in")); }}
                                    onKeyDown={e => { if (e.key === "Enter" && newLedgerName.trim()) addLedger(row.id); if (e.key === "Escape") setAddLedgerRow(null); }}
                                    style={{ height: 36, borderRadius: 10, border: "1px solid rgba(16,36,31,0.16)", padding: "0 12px", fontSize: 13.5, fontWeight: 600, color: "#10241F", fontFamily: "inherit" }} />
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7570", marginBottom: 6 }}>Group</div>
                                    <GroupChips compact value={newLedgerType} onChange={k => { setGroupTouched(true); setNewLedgerType(k); }} />
                                  </div>
                                  <button onClick={() => addLedger(row.id)} disabled={addingLedger || !newLedgerName.trim()}
                                    style={{ height: 36, borderRadius: 10, border: "none", background: newLedgerName.trim() ? "#12352D" : "#B9BDD6", color: "#FFFFFF", fontWeight: 800, fontSize: 13, cursor: newLedgerName.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                                    {addingLedger ? "Adding…" : `Add under ${headByKey(newLedgerType)?.label ?? "Indirect Expenses"}`}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <input list="bs-ledgers" key={row.ledger_id ?? "none"} defaultValue={row.ledger_id ? decode(coa.find(a => a.id === row.ledger_id)?.name ?? "") : ""}
                                    placeholder="Type to find a ledger…" title={row.ledger_id ? decode(coa.find(a => a.id === row.ledger_id)?.name ?? "") : "Type a few letters, then pick"}
                                    onChange={e => { const v = e.target.value.trim().toLowerCase(); const hit = coa.find(a => decode(a.name).toLowerCase() === v || `${decode(a.name)} · ${a.type}`.toLowerCase() === v); if (hit) assignLedger(row.id, hit.id); }}
                                    className="ledger-sel" style={{ borderColor: row.ledger_id ? "rgba(11,122,85,0.45)" : "#EBCB8B", color: row.ledger_id ? "#0B7A55" : "#10241F", background: row.ledger_id ? "#F2FAF6" : "#FFFFFF" }} />
                                  <button type="button" title="Add a new ledger" onClick={() => { setAddLedgerRow(row.id); setNewLedgerName(""); setGroupTouched(false); setNewLedgerType(row.debit ? "indirect_expense" : "indirect_income"); }}
                                    style={{ width: 34, height: 34, flex: "none", borderRadius: 10, border: "1px solid #E6DFD0", background: "#FFFFFF", color: "#12352D", cursor: "pointer", fontWeight: 800 }}>＋</button>
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
                              {row.debit > 0 ? (
                                <span className="bs-chip bs-badge-dr">Dr</span>
                              ) : (
                                <span className="bs-chip bs-badge-cr">Cr</span>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                    {/* Footer totals */}
                    <tfoot>
                      <tr style={{ borderTop: "1px solid #FFFFFF", background: "#FFFDF8" }}>
                        <td colSpan={3} style={{ padding: "0.55rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#6B7570" }}>
                          Total ({rows.length} transactions)
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: "#B4321F", fontSize: "0.78rem" }}>
                          {cur()}{fmt(totalDebit)}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: "#0B7A55", fontSize: "0.78rem" }}>
                          {cur()}{fmt(totalCredit)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {filtered.length > showN && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", padding: "18px 0 6px", fontSize: 15.5, color: "#6B7570" }}>
                  Showing {showN} of {filtered.length} lines
                  <button onClick={() => setShowN(n => n + PAGE)} style={{ height: 46, padding: "0 22px", borderRadius: 999, border: "1px solid #D9C79A", background: "#FFFDF8", color: "#10241F", fontFamily: "inherit", fontSize: 16, cursor: "pointer" }}>Show {Math.min(PAGE, filtered.length - showN)} more</button>
                  <button onClick={() => setShowN(filtered.length)} style={{ height: 46, padding: "0 22px", borderRadius: 999, border: "none", background: "transparent", color: "#10241F", fontFamily: "inherit", fontSize: 16, cursor: "pointer", textDecoration: "underline" }}>Show all {filtered.length} (slower)</button>
                </div>
              )}
              {filtered.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "#E6DFD0", fontSize: "0.84rem" }}>
                  No transactions match the current filters.
                </div>
              )}
            </div>

            {/* ── Statement header: account · progress · totals · Push ── */}
            <div className="bi-side">
              <section className="bi-hero" aria-label="Statement">
                <div className="bi-h-acct">
                  <span className="bi-h-lbl">STATEMENT ACCOUNT</span>
                  <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} aria-label="Statement account" title="Click to choose the bank, loan or other ledger this statement belongs to" className="bi-h-sel">
                    <option value="">— choose the account —</option>
                    <optgroup label="Bank & cash">{bankAccounts.filter(a => !loanLike(a as never)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                    <optgroup label="Loans">{bankAccounts.filter(a => loanLike(a as never)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                    <optgroup label="Any other ledger">{coa.filter(a => !bankAccounts.some(b => b.id === a.id)).map(a => <option key={a.id} value={a.id}>{decode(a.name)}</option>)}</optgroup>
                  </select>
                  <span className="bi-h-note">{(() => { const a = coa.find(x => x.id === bankAccountId); const viaBank = !!a && bankAccounts.some(b => b.id === a.id && !loanLike(b as never)); return !a ? "Choose the bank, loan or ledger this statement belongs to." : viaBank ? "Bank / cash · posts as Payment and Receipt vouchers" : "Loan / other ledger · posts as Journal vouchers"; })()}</span>
                  {loanMode && !bankAccounts.some(a => loanLike(a as never)) && <span className="bi-h-note" style={{ color: "#E9C27A" }}>No loan ledger yet — add one below, e.g. “Federal Bank Term Loan”.</span>}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={newBank} onChange={e => setNewBank(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addBank(); }} placeholder={bankAccounts.length ? "＋ Add another bank or loan…" : "＋ Add your bank, e.g. IDFC First Bank"} aria-label="Add a bank account" className="bi-h-add" />
                    {newBank.trim() && <button onClick={addBank} className="bi-h-addbtn">Add</button>}
                  </div>
                </div>

                <div className="bi-h-mid">
                  {(() => { const pushed = rows.filter(r => r.pushed).length, pct = rows.length ? Math.round(((assignedCount) / rows.length) * 100) : 0; return (<>
                    <div className="bi-h-prog">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span className="bi-h-lbl">LEDGERS SET</span>
                        <span className="bi-h-big">{assignedCount}<small> / {rows.length}</small></span>
                      </div>
                      <div className="bi-h-bar"><span style={{ width: `${pct}%` }} /></div>
                      <div className="bi-h-tags">
                        <span>{rows.length - assignedCount - pushed} need a ledger</span>
                        <span>{unpushedAssigned} ready</span>
                        <span>{pushed} posted</span>
                      </div>
                    </div>
                    <div className="bi-h-tot">
                      <div><span className="bi-h-lbl">MONEY OUT · DR</span><b style={{ color: "#FFB4A8" }}>{cur()}{fmt(totalDebit)}</b><small>{rows.filter(r => r.debit > 0).length} lines</small></div>
                      <div><span className="bi-h-lbl">MONEY IN · CR</span><b style={{ color: "#7FE0B4" }}>{cur()}{fmt(totalCredit)}</b><small>{rows.filter(r => r.credit > 0).length} lines</small></div>
                    </div>
                  </>); })()}
                </div>

                <div className="bi-h-push">
                  <button onClick={() => void pushToJournals()} disabled={pushing || unpushedAssigned === 0 || !bankAccountId} className="bi-h-go">
                    {pushing ? <><span className="spin" style={{ width: 16, height: 16, border: "2px solid rgba(16,36,31,0.25)", borderTopColor: "#10241F", borderRadius: "50%", display: "inline-block" }} /> Posting…</> : <>Post {unpushedAssigned || ""} entr{unpushedAssigned === 1 ? "y" : "ies"} →</>}
                  </button>
                  <span className="bi-h-note" style={{ textAlign: "center" }}>{!bankAccountId ? "Choose the statement account first" : unpushedAssigned ? "Nothing posts until you press this" : "Set a ledger on the lines to post them"}</span>
                  <button onClick={() => fileRef.current?.click()} className="bi-h-again">⬆ Upload another statement</button>
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={onFileInput} style={{ display: "none" }} />
                </div>
              </section>
              {pushResult && (
                <div className="bi-done">
                  <b>✓ {pushResult.created} entr{pushResult.created === 1 ? "y" : "ies"} posted</b>
                  <span>Journal → Ledger → Trial Balance → Financial Statements are updated.</span>
                  <Link href="/finance/journals">View in Journal →</Link>
                  <Link href="/finance/ledger">Ledger →</Link>
                  <Link href="/finance/reports?tab=balance_sheet">Financial Statements →</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
