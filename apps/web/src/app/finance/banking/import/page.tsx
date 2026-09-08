"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────── */
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
  error?: string;
};

type CoaAccount = { id: string; name: string; type: string; code: string | null };

/* ─── Helpers ────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(n: number) { return n ? n.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""; }
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const ACC_TYPE_COLOR: Record<string, string> = {
  bank: "#3B82F6", cash: "#10B981", income: "#34D399", expense: "#F59E0B",
  asset: "#60A5FA", liability: "#A78BFA", equity: "#FB923C", receivable: "#34D399",
  payable: "#F87171",
};

/* ─── Main Component ─────────────────────────────────────── */
export default function BankingPage() {
  const [bizId, setBizId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CoaAccount[]>([]);

  // Upload / parse state
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Transactions
  const [rows, setRows] = useState<TxRow[]>([]);

  // Selected bank account for this statement
  const [bankAccountId, setBankAccountId] = useState<string>("");

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

  // Add new ledger inline
  const [addLedgerRow, setAddLedgerRow] = useState<string | null>(null); // row id
  const [newLedgerName, setNewLedgerName] = useState("");
  const [newLedgerType, setNewLedgerType] = useState("expense");
  const [addingLedger, setAddingLedger] = useState(false);

  /* ── Init ── */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").trim();
      if (!saved) return;
      setBizId(saved);

      const { data: accounts } = await supabase
        .from("fw_fin_chart_of_accounts")
        .select("id,name,type,code")
        .eq("business_id", saved)
        .eq("is_group", false)
        .order("name");

      const all = (accounts ?? []) as CoaAccount[];
      setCoa(all);
      const banks = all.filter(a => ["bank", "cash"].includes(a.type));
      setBankAccounts(banks);
      if (banks.length) setBankAccountId(banks[0].id);
    });
  }, []);

  /* ── Parse Excel (client-side) ── */
  async function parseExcel(file: File) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

    // Try to detect header row
    const headerRow = raw.findIndex(r =>
      r.some(c => /date/i.test(String(c))) && r.some(c => /desc|narr|part|detail/i.test(String(c)))
    );
    if (headerRow === -1) {
      // Blind parse: assume col0=date, col1=desc, col2=debit, col3=credit, col4=balance
      return raw.slice(1).filter(r => r[0]).map(r => ({
        id: uid(), date: parseDate(r[0]), description: String(r[1] ?? ""),
        debit: toNum(r[2]), credit: toNum(r[3]), balance: toNum(r[4]),
        ledger_id: null, ledger_name: null, pushed: false,
      }));
    }

    const headers = raw[headerRow].map(h => String(h).toLowerCase());
    const col = (keywords: RegExp) => headers.findIndex(h => keywords.test(h));
    const dateCol = col(/date/);
    const descCol = col(/desc|narr|part|detail|particular/);
    const drCol = col(/debit|dr|withdraw|paid/);
    const crCol = col(/credit|cr|deposit|receiv/);
    const balCol = col(/balance|bal/);

    return raw.slice(headerRow + 1)
      .filter(r => r[dateCol])
      .map(r => ({
        id: uid(),
        date: parseDate(r[dateCol]),
        description: String(r[descCol] ?? "").trim(),
        debit: toNum(r[drCol] ?? 0),
        credit: toNum(r[crCol] ?? 0),
        balance: toNum(r[balCol] ?? 0),
        ledger_id: null, ledger_name: null, pushed: false,
      }));
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
  async function parsePDF(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/finance/parse-bank-pdf", { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "PDF parse failed");
    return (json.transactions as Omit<TxRow, "id" | "ledger_id" | "ledger_name" | "pushed">[]).map(t => ({
      ...t, id: uid(), ledger_id: null, ledger_name: null, pushed: false,
    }));
  }

  /* ── File drop / select ── */
  async function handleFile(file: File) {
    setParsing(true); setParseError(""); setRows([]); setSelected(new Set()); setPushResult(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let txs: TxRow[];
      if (["xlsx", "xls", "csv"].includes(ext)) {
        txs = await parseExcel(file);
      } else if (ext === "pdf") {
        txs = await parsePDF(file);
      } else {
        throw new Error("Unsupported file type. Upload PDF, Excel (.xlsx/.xls), or CSV.");
      }
      if (!txs.length) throw new Error("No transactions found in file.");
      setRows(txs);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

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
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
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
    setRows(r => r.map(x => x.id === rowId ? { ...x, ledger_id: ledgerId || null, ledger_name: acct?.name ?? null } : x));
  }

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
      const { data, error } = await supabase
        .from("fw_fin_chart_of_accounts")
        .insert({ business_id: bizId, name: newLedgerName.trim(), type: newLedgerType, is_group: false, is_system: false })
        .select("id,name,type,code")
        .single();
      if (error) throw error;
      const newAcct = data as CoaAccount;
      setCoa(c => [...c, newAcct]);
      assignLedger(forRowId, newAcct.id);
      setAddLedgerRow(null);
      setNewLedgerName("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setAddingLedger(false);
    }
  }

  /* ── Push to journals ── */
  async function pushToJournals() {
    if (!bizId || !bankAccountId) return;
    const toPush = rows.filter(r => r.ledger_id && !r.pushed);
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
            debit: r.debit, credit: r.credit, ledger_id: r.ledger_id,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPushResult({ created: json.created });
      const pushedIds = new Set(toPush.map(r => r.id));
      setRows(r => r.map(x => pushedIds.has(x.id) ? { ...x, pushed: true } : x));
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

  /* ── Summaries ── */
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const assignedCount = rows.filter(r => r.ledger_id).length;
  const unpushedAssigned = rows.filter(r => r.ledger_id && !r.pushed).length;

  /* ─────────────────── JSX ─────────────────────────────── */
  const inp: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid #1B2E4A", color: "#DEE8F5",
    padding: "7px 10px", borderRadius: 7, fontSize: "0.82rem", outline: "none",
    fontFamily: "'DM Sans',system-ui,sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#05091A", color: "#DEE8F5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .bs-drop { transition: border-color 0.2s, background 0.2s; }
        .bs-drop:hover { border-color: #3B82F6 !important; background: rgba(59,130,246,0.04) !important; }
        .bs-row:hover td { background: rgba(255,255,255,0.015); }
        .bs-row.pushed td { opacity: 0.45; }
        .bs-sel { accent-color: #3B82F6; width: 14px; height: 14px; cursor: pointer; }
        .bs-chip { font-size: 0.6rem; font-weight: 700; padding: 2px 7px; border-radius: 12px; white-space: nowrap; }
        .bs-badge-dr { background: rgba(239,68,68,0.12); color: #FCA5A5; }
        .bs-badge-cr { background: rgba(16,185,129,0.12); color: #34D399; }
        .bs-btn { border: none; border-radius: 8px; font-family: inherit; font-weight: 700; cursor: pointer; transition: opacity 0.15s, transform 0.1s; display: inline-flex; align-items: center; gap: 0.4rem; }
        .bs-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .bs-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .bs-filter-btn { background: rgba(255,255,255,0.04); border: 1px solid #1B2E4A; color: #6E88A8; border-radius: 7px; padding: 5px 12px; font-size: 0.76rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .bs-filter-btn.active { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.4); color: #60A5FA; }
        .ledger-sel { background: rgba(255,255,255,0.03); border: 1px solid #1B2E4A; color: #DEE8F5; padding: 4px 6px; border-radius: 6px; font-size: 0.72rem; outline: none; width: 100%; cursor: pointer; max-width: 200px; }
        .ledger-sel:focus { border-color: #3B82F6; }
        select option { background: #0B1428; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        ::-webkit-scrollbar { width: 5px; height: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #1B2E4A; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: "rgba(5,9,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1B2E4A", padding: "0 1.5rem", height: 52, display: "flex", alignItems: "center", gap: "0.75rem", position: "sticky", top: 0, zIndex: 20 }}>
        <Link href="/finance" style={{ color: "#4A6FA5", textDecoration: "none", fontSize: "0.82rem" }}>Finance</Link>
        <span style={{ color: "#2A4060" }}>›</span>
        <Link href="/finance/banking" style={{ color: "#4A6FA5", textDecoration: "none", fontSize: "0.82rem" }}>Banking</Link>
        <span style={{ color: "#2A4060" }}>›</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Import Statement</span>
        {rows.length > 0 && (
          <>
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#4A6FA5" }}>
              {rows.length} transactions · {assignedCount} assigned · {rows.filter(r => r.pushed).length} pushed
            </span>
            <button onClick={() => { setRows([]); setSelected(new Set()); setPushResult(null); setParseError(""); }}
              style={{ ...inp, padding: "5px 12px", fontSize: "0.75rem", cursor: "pointer", color: "#6E88A8" }}>
              Clear ✕
            </button>
          </>
        )}
      </div>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "1.5rem" }}>

        {/* ── Upload area (shown when no rows) ── */}
        {rows.length === 0 && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Bank Statement Import</h1>
              <p style={{ margin: 0, color: "#4A6FA5", fontSize: "0.88rem" }}>Upload your bank statement (PDF or Excel). Assign ledger accounts and push directly to Journal Entries → Ledger → Trial Balance → Financial Statements.</p>
            </div>

            <div
              className="bs-drop"
              onDrop={onDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #1B2E4A", borderRadius: 16, padding: "3rem 2rem", textAlign: "center", cursor: "pointer", background: "#0B1428" }}
            >
              {parsing ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                  <div className="spin" style={{ width: 36, height: 36, border: "3px solid #1B2E4A", borderTopColor: "#3B82F6", borderRadius: "50%" }} />
                  <div style={{ color: "#4A6FA5" }}>Parsing statement…</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📄</div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.3rem" }}>Drop bank statement here</div>
                  <div style={{ color: "#4A6FA5", fontSize: "0.84rem", marginBottom: "1rem" }}>PDF (parsed by AI) · Excel .xlsx / .xls · CSV</div>
                  <div style={{ display: "inline-block", background: "#2563EB", color: "#fff", padding: "10px 28px", borderRadius: 9, fontWeight: 700, fontSize: "0.88rem" }}>
                    Browse File
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={onFileInput} style={{ display: "none" }} />

            {parseError && (
              <div style={{ marginTop: "1rem", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "1rem 1.1rem" }}>
                <div style={{ color: "#FCA5A5", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>⚠ {parseError}</div>
                <div style={{ color: "#7A93B4", fontSize: "0.78rem", lineHeight: 1.6 }}>
                  <strong style={{ color: "#DEE8F5" }}>Tip:</strong> Most Indian banks (SBI, HDFC, ICICI, Axis, Kotak) let you download statements as <strong style={{ color: "#60A5FA" }}>Excel (.xlsx)</strong> from NetBanking → Account Statement → Download. Excel always works reliably.
                </div>
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem" }}>
                  <button onClick={() => fileRef.current?.click()} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                    Try Another File
                  </button>
                  <button onClick={() => setParseError("")} style={{ background: "none", border: "1px solid #1B2E4A", color: "#6E88A8", borderRadius: 7, padding: "7px 14px", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Main table view ── */}
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>

            {/* ── Left: table ── */}
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Filters row */}
              <div style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 12, padding: "0.8rem 1rem", marginBottom: "0.75rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description…" style={{ ...inp, flex: "1 1 180px", minWidth: 140 }} />

                {/* Date range */}
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inp, width: 130 }} title="From date" />
                <span style={{ color: "#2A4060", fontSize: "0.75rem" }}>–</span>
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

                <span style={{ marginLeft: "auto", fontSize: "0.74rem", color: "#4A6FA5" }}>{filtered.length} shown</span>
              </div>

              {/* Bulk assign bar — visible when rows are selected */}
              {selected.size > 0 && (
                <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, padding: "0.65rem 1rem", marginBottom: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#60A5FA" }}>{selected.size} selected</span>
                  <input value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder="Search ledger…" style={{ ...inp, width: 160, padding: "5px 8px", fontSize: "0.78rem" }} />
                  <select value={bulkLedgerId} onChange={e => setBulkLedgerId(e.target.value)} style={{ ...inp, minWidth: 200, padding: "5px 8px", fontSize: "0.78rem", cursor: "pointer" }}>
                    <option value="">— select ledger to assign —</option>
                    {bulkCoa.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                  <button onClick={applyBulkAssign} disabled={!bulkLedgerId} className="bs-btn" style={{ background: "#2563EB", color: "#fff", padding: "6px 16px", fontSize: "0.8rem" }}>
                    Assign to All
                  </button>
                  <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: "#4A6FA5", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit" }}>
                    Deselect
                  </button>
                </div>
              )}

              {/* Table */}
              <div style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                    <thead>
                      <tr style={{ background: "#080D1C", borderBottom: "1px solid #111E33" }}>
                        <th style={{ padding: "0.6rem 0.75rem", width: 36, textAlign: "center" }}>
                          <input type="checkbox" className="bs-sel" checked={allFilteredSelected} onChange={toggleAll} />
                        </th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Date</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Debit (Dr)</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Credit (Cr)</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Balance</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ledger Account</th>
                        <th style={{ padding: "0.6rem 0.75rem", width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, i) => (
                        <React.Fragment key={row.id}>
                          <tr
                            className={`bs-row${row.pushed ? " pushed" : ""}`}
                            style={{ borderTop: i === 0 ? "none" : "1px solid #0D1827", background: selected.has(row.id) ? "rgba(37,99,235,0.06)" : "transparent" }}
                          >
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                              <input type="checkbox" className="bs-sel" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", color: "#6E88A8", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem" }}>
                              {fmtDate(row.date)}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#DEE8F5", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.description}>
                              {row.description || <span style={{ color: "#2A4060" }}>—</span>}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.debit ? "#FCA5A5" : "#2A4060", fontWeight: row.debit ? 600 : 400 }}>
                              {row.debit ? `₹${fmt(row.debit)}` : ""}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: row.credit ? "#34D399" : "#2A4060", fontWeight: row.credit ? 600 : 400 }}>
                              {row.credit ? `₹${fmt(row.credit)}` : ""}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: "#4A6FA5", fontSize: "0.7rem" }}>
                              {row.balance ? `₹${fmt(row.balance)}` : ""}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              {row.pushed ? (
                                <span className="bs-chip" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399" }}>✓ Pushed</span>
                              ) : addLedgerRow === row.id ? (
                                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                                  <input value={newLedgerName} onChange={e => setNewLedgerName(e.target.value)} placeholder="Ledger name" style={{ ...inp, padding: "4px 8px", fontSize: "0.72rem", width: 140 }} />
                                  <select value={newLedgerType} onChange={e => setNewLedgerType(e.target.value)} style={{ ...inp, padding: "4px 8px", fontSize: "0.72rem", cursor: "pointer" }}>
                                    {["expense","income","asset","liability","bank","cash","receivable","payable"].map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <button onClick={() => addLedger(row.id)} disabled={addingLedger || !newLedgerName.trim()} className="bs-btn" style={{ background: "#10B981", color: "#fff", padding: "4px 10px", fontSize: "0.72rem", borderRadius: 6 }}>
                                    {addingLedger ? "…" : "Add"}
                                  </button>
                                  <button onClick={() => setAddLedgerRow(null)} style={{ background: "none", border: "none", color: "#4A6FA5", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                                </div>
                              ) : (
                                <select
                                  value={row.ledger_id ?? ""}
                                  onChange={e => {
                                    if (e.target.value === "__add__") { setAddLedgerRow(row.id); setNewLedgerName(""); return; }
                                    assignLedger(row.id, e.target.value);
                                  }}
                                  className="ledger-sel"
                                  style={{ borderColor: row.ledger_id ? "rgba(16,185,129,0.3)" : "#1B2E4A", color: row.ledger_id ? "#34D399" : "#4A6FA5" }}
                                >
                                  <option value="">— select ledger —</option>
                                  <option value="__add__">＋ Add new ledger…</option>
                                  {coa.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                  ))}
                                </select>
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
                      <tr style={{ borderTop: "1px solid #1B2E4A", background: "#080D1C" }}>
                        <td colSpan={3} style={{ padding: "0.55rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#4A6FA5" }}>
                          Total ({rows.length} transactions)
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: "#FCA5A5", fontSize: "0.78rem" }}>
                          ₹{fmt(totalDebit)}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: "#34D399", fontSize: "0.78rem" }}>
                          ₹{fmt(totalCredit)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "#2A4060", fontSize: "0.84rem" }}>
                  No transactions match the current filters.
                </div>
              )}
            </div>

            {/* ── Right: action panel ── */}
            <div style={{ width: 260, flexShrink: 0, position: "sticky", top: 68 }}>

              {/* Bank account selector */}
              <div style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 12, padding: "1.1rem", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#4A6FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Bank / Cash Account</div>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} style={{ ...inp, width: "100%", cursor: "pointer", fontSize: "0.8rem" }}>
                  <option value="">— select account —</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div style={{ fontSize: "0.66rem", color: "#2A4060", marginTop: "0.4rem" }}>All transactions in this statement belong to this account</div>
              </div>

              {/* Summary */}
              <div style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 12, padding: "1.1rem", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#4A6FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Summary</div>
                {[
                  ["Total Transactions", rows.length, "#DEE8F5"],
                  ["Assigned", assignedCount, "#34D399"],
                  ["Unassigned", rows.length - assignedCount - rows.filter(r => r.pushed).length, "#F59E0B"],
                  ["Already Pushed", rows.filter(r => r.pushed).length, "#60A5FA"],
                  ["Ready to Push", unpushedAssigned, "#A78BFA"],
                ].map(([label, val, color]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.76rem", color: "#4A6FA5" }}>{label}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: String(color) }}>{val}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: "#111E33", margin: "0.6rem 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.76rem", color: "#4A6FA5" }}>Total Payments</span>
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#FCA5A5", fontFamily: "'IBM Plex Mono',monospace" }}>₹{fmt(totalDebit)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.76rem", color: "#4A6FA5" }}>Total Receipts</span>
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#34D399", fontFamily: "'IBM Plex Mono',monospace" }}>₹{fmt(totalCredit)}</span>
                </div>
              </div>

              {/* Push button */}
              <button
                onClick={pushToJournals}
                disabled={pushing || unpushedAssigned === 0 || !bankAccountId}
                className="bs-btn"
                style={{ width: "100%", padding: "14px 0", fontSize: "0.92rem", fontWeight: 800, background: unpushedAssigned > 0 && bankAccountId ? "#2563EB" : "#111E33", color: unpushedAssigned > 0 && bankAccountId ? "#fff" : "#2A4060", borderRadius: 10, justifyContent: "center", marginBottom: "0.5rem" }}
              >
                {pushing ? (
                  <><span className="spin" style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} /> Pushing…</>
                ) : (
                  `🚀 Push ${unpushedAssigned} to Journals`
                )}
              </button>

              {!bankAccountId && (
                <div style={{ fontSize: "0.72rem", color: "#F59E0B", textAlign: "center", marginBottom: "0.5rem" }}>Select a bank account above first</div>
              )}

              {pushResult && (
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "0.85rem 1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>✅</div>
                  <div style={{ fontWeight: 700, color: "#34D399", fontSize: "0.88rem", marginBottom: "0.2rem" }}>{pushResult.created} entries created</div>
                  <div style={{ fontSize: "0.72rem", color: "#4A6FA5", marginBottom: "0.75rem" }}>Journals → Ledger → TB → FS updated</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <Link href="/finance/journals" style={{ display: "block", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#60A5FA", padding: "7px 0", borderRadius: 7, textDecoration: "none", fontWeight: 600, fontSize: "0.78rem", textAlign: "center" }}>
                      📋 View Journals →
                    </Link>
                    <Link href="/finance/ledger" style={{ display: "block", background: "rgba(255,255,255,0.03)", border: "1px solid #1B2E4A", color: "#6E88A8", padding: "7px 0", borderRadius: 7, textDecoration: "none", fontWeight: 600, fontSize: "0.78rem", textAlign: "center" }}>
                      📒 Ledger →
                    </Link>
                    <Link href="/finance/reports" style={{ display: "block", background: "rgba(255,255,255,0.03)", border: "1px solid #1B2E4A", color: "#6E88A8", padding: "7px 0", borderRadius: 7, textDecoration: "none", fontWeight: 600, fontSize: "0.78rem", textAlign: "center" }}>
                      📈 Financial Statements →
                    </Link>
                  </div>
                </div>
              )}

              {/* Upload another */}
              <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
                <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "1px dashed #1B2E4A", color: "#4A6FA5", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.76rem", fontFamily: "inherit", fontWeight: 600, width: "100%" }}>
                  ⬆ Upload Another Statement
                </button>
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={onFileInput} style={{ display: "none" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
