"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isIncomeEntry } from "@/lib/invoiceDoc";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";
import TallyBar from "@/components/TallyBar";
import { useTally } from "@/lib/tallyConnection";
import { pushToTally, loadPushStatus, type PushState } from "@/lib/tallyPushRun";
import { explainTallyError } from "@/lib/integrations/tally";

type Journal = {
  id: string;
  entry_no: string;
  date: string;
  narration: string;
  type: string;
  status: string;
  total_debit: number;
  total_credit: number;
  reference_no: string | null;
  ai_generated: boolean;
  created_at: string;
};

type SortKey = "posted" | "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "entry";
type JournalLine = {
  id: string;
  account_id: string;
  narration: string;
  dr_amount: number;
  cr_amount: number;
  account?: { name: string; type: string };
};

const TYPE_LABEL: Record<string, string> = {
  journal: "Journal", payment: "Payment", receipt: "Receipt",
  sales: "Sales", purchase: "Purchase", contra: "Contra",
  debit_note: "Debit Note", credit_note: "Credit Note", expense: "Expense",
};

const TYPE_COLOR: Record<string, string> = {
  sales: "#0B7A55", receipt: "#0B7A55", income: "#0B7A55",
  payment: "#C2321F", purchase: "#C2321F", expense: "#C2321F",
  debit_note: "#8A5A00", credit_note: "#8A5A00",
  journal: "#1F5EFF", contra: "#5B4BC4",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#8A5A00", posted: "#0B7A55", voided: "#C2321F",
};

const TYPE_TITLES: Record<string, string> = {
  sales: "Sales Transactions", receipt: "Receipts", payment: "Payments",
  purchase: "Purchase Entries", expense: "Expenses", journal: "Journal Entries",
  contra: "Contra Entries", debit_note: "Debit Notes", credit_note: "Credit Notes",
};

const fmt = (n: number) => cur() + Math.abs(n).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

export default function JournalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const idParam = searchParams.get("id") ?? "";

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomeIds, setIncomeIds] = useState<Set<string>>(new Set());
  const [bizId, setBizId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "posted" | "ai">("all");
  const [loadErr, setLoadErr] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("posted");
  const [shown, setShown] = useState(100);          // rows drawn; thousands at once froze the page
  const checkedIncome = useRef<Set<string>>(new Set());

  // Detail drawer state
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [drawerLines, setDrawerLines] = useState<JournalLine[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  // Tally: select and push from this list
  const tally = useTally();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushed, setPushed] = useState<Record<string, PushState>>({});
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [bizName, setBizName] = useState("");

  useEffect(() => {
    if (statusParam === "draft") setFilter("draft");
    else if (statusParam === "posted") setFilter("posted");
    else if (statusParam === "ai") setFilter("ai");
  }, [statusParam]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      loadPushStatus(saved).then(setPushed);
      supabase.from("fw_fin_businesses").select("name").eq("id", saved).single().then(({ data: b }) => { if (b) setBizName(b.name); });
      // One server read (access checked once) — the browser query was slow on big books
      const r = await fetch(`/api/finance/books?business_id=${saved}&lines=0`).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (!r || !r.ok) setLoadErr(d.error ?? "We couldn't load your entries right now.");
      const rows = (d.journals ?? []) as Journal[];
      setJournals(rows);
      setLoading(false);

      // Auto-open drawer if ?id= is set
      if (idParam) {
        const at = rows.findIndex(j => j.id === idParam);
        if (at >= 0) { if (at >= 100) setShown(at + 20); openDrawer(rows[at]); }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll highlighted row into view once list renders
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [journals, idParam]);

  async function openDrawer(j: Journal) {
    setSelectedJournal(j);
    setDrawerLines([]);
    setDrawerLoading(true);
    const { data: lines } = await supabase
      .from("fw_fin_journal_lines")
      .select("id,account_id,narration,dr_amount,cr_amount")
      .eq("journal_id", j.id);
    if (lines?.length) {
      const accIds = [...new Set(lines.map(l => l.account_id))];
      const { data: accs } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").in("id", accIds);
      const accMap = new Map((accs ?? []).map(a => [a.id, a]));
      setDrawerLines(lines.map(l => ({ ...l, account: accMap.get(l.account_id) })));
    }
    setDrawerLoading(false);
  }

  function closeDrawer() {
    setSelectedJournal(null);
    setDrawerLines([]);
  }

  const typeFilter = typeParam ? typeParam.split(",").map(t => t.trim()).filter(Boolean) : [];
  const afterTypeFilter = typeFilter.length > 0 ? journals.filter(j => typeFilter.includes(j.type)) : journals;
  const byStatus = filter === "all" ? afterTypeFilter
    : filter === "ai" ? afterTypeFilter.filter(j => j.ai_generated)
    : afterTypeFilter.filter(j => j.status === filter);
  const q = query.trim().toLowerCase();
  const matched = q ? byStatus.filter(j => j.entry_no?.toLowerCase().includes(q) || j.narration?.toLowerCase().includes(q) || String(j.total_debit).includes(q)) : byStatus;
  // Sort: latest posted first by default (when it was entered, not the transaction date)
  const amt = (j: Journal) => Number(j.total_debit ?? 0);
  const cmp: Record<SortKey, (a: Journal, b: Journal) => number> = {
    posted: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    date_desc: (a, b) => b.date.localeCompare(a.date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    date_asc: (a, b) => a.date.localeCompare(b.date) || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    amount_desc: (a, b) => amt(b) - amt(a),
    amount_asc: (a, b) => amt(a) - amt(b),
    entry: (a, b) => (a.entry_no ?? "").localeCompare(b.entry_no ?? "", undefined, { numeric: true }),
  };
  const filtered = [...matched].sort(cmp[sort]);
  const visible = filtered.slice(0, shown);

  // Which rows on screen record income? Those get an "Invoice" button. Checked only for what's drawn.
  const visibleKey = visible.map(j => j.id).join(",");
  useEffect(() => {
    const todo = visible.filter(j => j.status === "posted" && !checkedIncome.current.has(j.id)).map(j => j.id);
    if (!todo.length) return;
    todo.forEach(id => checkedIncome.current.add(id));
    (async () => {
      for (let i = 0; i < todo.length; i += 100) {
        const { data: ls } = await supabase.from("fw_fin_journal_lines")
          .select("journal_id,dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type,sub_type)").in("journal_id", todo.slice(i, i + 100));
        const byJ = new Map<string, { dr: number; cr: number; account: string; accountType: string | null; subType: string | null }[]>();
        for (const l of (ls ?? []) as unknown as { journal_id: string; dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string; type: string; sub_type: string | null } | null }[]) {
          const a = byJ.get(l.journal_id) ?? [];
          a.push({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "", accountType: l.fw_fin_chart_of_accounts?.type ?? null, subType: l.fw_fin_chart_of_accounts?.sub_type ?? null });
          byJ.set(l.journal_id, a);
        }
        const found = [...byJ].filter(([, lines]) => isIncomeEntry(lines)).map(([id]) => id);
        if (found.length) setIncomeIds(prev => new Set([...prev, ...found]));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const pageTitle = typeFilter.length === 1 ? (TYPE_TITLES[typeFilter[0]] ?? "Journal Entries") : "Journal Entries";
  const totalDebit = filtered.reduce((a, j) => a + (j.total_debit || 0), 0);

  const referer = searchParams.get("from") ?? "";

  const pushable = (j: Journal) => j.status === "posted" && !j.entry_no?.startsWith("TLY-");
  const isPushed = (id: string) => { const p = pushed[id]; return !!p && "at" in p; };
  const selectableHere = filtered.filter(pushable);
  const allSelected = selectableHere.length > 0 && selectableHere.every(j => selected.has(j.id));
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const notPushed = selectableHere.filter(j => !isPushed(j.id));

  async function pushSelected(ids: string[]) {
    if (!bizId || tally.status !== "connected" || !ids.length || pushing) return;
    const already = ids.filter(isPushed).length;
    if (already && !window.confirm(`${already} of the selected entr${already === 1 ? "y is" : "ies are"} already marked as pushed. Pushing again can create duplicates in Tally. Continue?`)) return;
    setPushing(true); setPushMsg("");
    const dates = Object.fromEntries(journals.filter(j => ids.includes(j.id)).map(j => [j.id, j.date.slice(0, 10)]));
    const r = await pushToTally({ bizId, ids, dates, company: tally.company, port: tally.port, educational: tally.educational, onProgress: setPushMsg });
    setPushed(p => ({ ...p, ...r.results }));
    setPushMsg(r.message); setSelected(new Set()); setPushing(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .jrow td { transition: background .12s; }
        .jrow:hover td { background: #F7F8FE; }
        .jrow-hl td { background: #EEF0FB !important; }
        .jrow-rev td { opacity: .62; }
        .jr-head th { background: #F9FAFD; border-bottom: 1px solid rgba(20,26,58,0.08); }
        .jr-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; }
        .jr-pill i { width: 6px; height: 6px; border-radius: 999px; background: currentColor; display: inline-block; }
        .jr-seg { display: inline-flex; padding: 4px; gap: 2px; border-radius: 12px; background: #FFFFFF; border: 1px solid rgba(20,26,58,0.1); }
        .jr-seg button { border: none; background: transparent; padding: 7px 14px; border-radius: 9px; font-weight: 700; font-size: 0.8rem; color: rgba(20,26,58,0.7); cursor: pointer; font-family: inherit; display: inline-flex; gap: 6px; align-items: center; }
        .jr-seg button.on { background: #232A63; color: #FFFFFF; box-shadow: 0 6px 14px -8px rgba(35,42,99,.7); }
        .jr-seg button span { font-size: 0.68rem; padding: 1px 7px; border-radius: 999px; background: rgba(20,26,58,0.07); }
        .jr-seg button.on span { background: rgba(255,255,255,0.18); }
        .jr-stat { background: #FFFFFF; border: 1px solid rgba(20,26,58,0.09); border-radius: 14px; padding: 12px 16px; min-width: 150px; flex: 1; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #FFFFFF; border-radius: 4px; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56, background: "rgba(255,255,255,0.95)" }}>
        {referer === "audit" || referer === "ledger" ? (
          <button onClick={() => router.back()} style={{ background: "rgba(35,42,99,0.08)", border: "1px solid rgba(35,42,99,0.2)", color: "#232A63", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", padding: "5px 12px", borderRadius: 8 }}>← Back to {referer === "ledger" ? "Ledger" : "Audit"}</button>
        ) : (
          <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        )}
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>{pageTitle}</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/journals/new" style={{ background: "#232A63", color: "#F5F6FA", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>
          + New Entry
        </Link>
      </nav>

      <div style={{ maxWidth: selectedJournal ? 1480 : 1320, margin: "0 auto", padding: "2rem", display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

        {/* Main list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h1 style={{ margin: "0 0 0.2rem", fontSize: "1.9rem", fontWeight: 700, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", letterSpacing: "-0.01em" }}>{pageTitle}</h1>
              <div style={{ fontSize: "0.84rem", color: "rgba(20,26,58,0.6)" }}>Every entry in your books — click one to see its lines.</div>
            </div>
            <div className="jr-seg" role="tablist" aria-label="Filter entries">
              {(["all", "draft", "posted", "ai"] as const).map(f => (
                <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "ai" ? "AI / Chat" : f === "draft" ? "Draft" : "Posted"}
                  <span>{(f === "all" ? afterTypeFilter : f === "ai" ? afterTypeFilter.filter(j => j.ai_generated) : afterTypeFilter.filter(j => j.status === f)).length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* At a glance */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1rem" }}>
            {[
              { l: "Entries shown", v: filtered.length.toLocaleString("en-IN"), c: "#141A3A" },
              { l: "Total value", v: `${cur()}${totalDebit.toLocaleString(activeMoney().locale, { maximumFractionDigits: 0 })}`, c: "#232A63" },
              { l: "Posted", v: filtered.filter(j => j.status === "posted").length.toLocaleString("en-IN"), c: "#0B7A55" },
              { l: "Not in Tally", v: notPushed.length.toLocaleString("en-IN"), c: notPushed.length ? "#8A5A00" : "#0B7A55" },
            ].map(s => (
              <div key={s.l} className="jr-stat">
                <div style={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(20,26,58,0.5)" }}>{s.l}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <input value={query} onChange={ev => { setQuery(ev.target.value); setShown(100); }} placeholder="Search entry no, narration or amount…" aria-label="Search entries"
              style={{ flex: "1 1 260px", height: 40, borderRadius: 10, border: "1px solid rgba(20,26,58,0.14)", padding: "0 14px", fontSize: "0.88rem", fontFamily: "inherit", background: "#FFFFFF" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 4px 0 12px", borderRadius: 10, border: "1px solid rgba(20,26,58,0.14)", background: "#FFFFFF", fontSize: "0.8rem", fontWeight: 700, color: "rgba(20,26,58,0.65)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>
              Sort<style>{`.jr-sort:focus-visible{box-shadow:0 0 0 2px #C9A24A !important}`}</style>
              <select value={sort} onChange={e => { setSort(e.target.value as SortKey); setShown(100); }} aria-label="Sort entries"
                className="jr-sort" style={{ height: 32, padding: "0 26px 0 8px", margin: 0, lineHeight: "32px", border: "none", borderRadius: 8, background: "transparent url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23232A63%27 stroke-width=%273%27 stroke-linecap=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E\") no-repeat right 8px center", appearance: "none", WebkitAppearance: "none", boxShadow: "none", outline: "none", fontSize: "0.85rem", fontWeight: 700, color: "#141A3A", fontFamily: "inherit", cursor: "pointer" }}>
                <option value="posted">Latest posted first</option>
                <option value="date_desc">Date — newest first</option>
                <option value="date_asc">Date — oldest first</option>
                <option value="amount_desc">Amount — highest first</option>
                <option value="amount_asc">Amount — lowest first</option>
                <option value="entry">Entry no.</option>
              </select>
            </label>
          </div>
          <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
            <TallyBar preferName={bizName} returnTo="/finance/journals">
              {tally.status === "connected" && (
                <>
                  <button onClick={() => pushSelected([...selected])} disabled={pushing || !selected.size}
                    style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "none", background: selected.size ? "#0B7A55" : "#9FC9B8", color: "#FFFFFF", fontWeight: 800, fontSize: "0.8rem", cursor: pushing ? "wait" : selected.size ? "pointer" : "default", fontFamily: "inherit" }}>
                    {pushing ? "Pushing…" : `⇪ Push selected (${selected.size})`}
                  </button>
                  <button onClick={() => pushSelected(notPushed.map(j => j.id))} disabled={pushing || !notPushed.length}
                    style={{ height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid #D8CDB4", background: "#FFFFFF", color: "#10241F", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", opacity: notPushed.length ? 1 : 0.5 }}>
                    Push all not pushed ({notPushed.length})
                  </button>
                </>
              )}
            </TallyBar>
            {tally.status === "connected" && tally.educational && <div style={{ fontSize: "0.8rem", color: "#8A5A00", background: "#FFF4DB", borderRadius: 10, padding: "8px 12px" }}>Tally is in Educational mode: only entries dated the 1st, 2nd or 31st will be accepted. Others are held back, not sent.</div>}
            {pushMsg && <div role="status" style={{ fontSize: "0.82rem", fontWeight: 600, color: pushMsg.startsWith("✓") ? "#0B7A55" : "#10241F", background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.11)", borderRadius: 10, padding: "8px 12px" }}>{pushMsg}</div>}
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.09)", borderRadius: 18, overflow: "hidden", boxShadow: "0 16px 40px -32px rgba(20,26,58,0.5)" }}>
            {loading ? (
              <div style={{ padding: "4rem", textAlign: "center", color: "rgba(20,26,58,0.55)" }}>Loading…</div>
            ) : loadErr ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#C2321F" }}>{loadErr} <button onClick={() => window.location.reload()} style={{ marginLeft: 8, background: "#232A63", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Try again</button></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "4rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📒</div>
                <div style={{ color: "rgba(20,26,58,0.65)", marginBottom: "1rem" }}>No journal entries yet.</div>
                <Link href="/finance/upload" style={{ color: "#232A63", fontSize: "0.85rem" }}>Upload documents to auto-generate entries →</Link>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead className="jr-head">
                    <tr>
                      <th style={{ padding: "0.6rem 0 0.6rem 1rem", width: 28 }}>
                        <input type="checkbox" aria-label="Select all entries that can be pushed" checked={allSelected} disabled={!selectableHere.length}
                          onChange={() => setSelected(allSelected ? new Set() : new Set(selectableHere.map(j => j.id)))} />
                      </th>
                      {["Entry No", "Date", "Type", "Narration", "Debit (" + cur() + ")", "Credit (" + cur() + ")", "Status", "Tally", ""].map((h, i) => {
                        const key: SortKey | null = i === 0 ? "entry" : i === 1 ? (sort === "date_desc" ? "date_asc" : "date_desc") : i === 4 ? (sort === "amount_desc" ? "amount_asc" : "amount_desc") : null;
                        const on = (i === 0 && sort === "entry") || (i === 1 && sort.startsWith("date")) || (i === 4 && sort.startsWith("amount"));
                        const arrow = !on ? "" : sort.endsWith("asc") || sort === "entry" ? " ↑" : " ↓";
                        return (
                          <th key={h} aria-sort={on ? (arrow === " ↑" ? "ascending" : "descending") : undefined} style={{ padding: "0.6rem 1rem", textAlign: i === 4 || i === 5 ? "right" : "left", fontSize: "0.68rem", color: on ? "#141A3A" : "rgba(20,26,58,0.60)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            {key ? <button onClick={() => { setSort(key); setShown(100); }} title="Sort by this column" style={{ all: "unset", cursor: "pointer" }}>{h}{arrow || <span style={{ opacity: 0.35 }}> ↕</span>}</button> : h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(j => {
                      const isHighlighted = j.id === idParam;
                      const isSelected = selectedJournal?.id === j.id;
                      return (
                        <tr
                          key={j.id}
                          ref={isHighlighted ? highlightRef : null}
                          className={`jrow${isHighlighted || isSelected ? " jrow-hl" : ""}${(j as { reversed_by?: string | null }).reversed_by ? " jrow-rev" : ""}`}
                          onClick={() => openDrawer(j)}
                          style={{ borderTop: "1px solid rgba(20,26,58,0.08)", cursor: "pointer" }}
                        >
                          <td style={{ padding: "0.65rem 0 0.65rem 1rem" }} onClick={e => e.stopPropagation()}>
                            {pushable(j) && <input type="checkbox" aria-label={`Select ${j.entry_no}`} checked={selected.has(j.id)} onChange={() => toggle(j.id)} />}
                          </td>
                          <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "0.76rem", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500, color: "#232A63", background: "#F1F3FB", border: "1px solid #E1E5F5", padding: "3px 8px", borderRadius: 7 }}>{j.entry_no}</span>
                          </td>
                          <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</div>
                            <div style={{ fontSize: "0.66rem", color: "rgba(20,26,58,0.45)" }}>{new Date(j.date).toLocaleDateString("en-IN", { weekday: "short" })}</div>
                          </td>
                          <td style={{ padding: "0.8rem 1rem" }}>
                            <span className="jr-pill" style={{ color: TYPE_COLOR[j.type] ?? "#141A3A", background: `${TYPE_COLOR[j.type] ?? "#141A3A"}14` }}><i />{TYPE_LABEL[j.type] ?? j.type}</span>
                          </td>
                          <td style={{ padding: "0.8rem 1rem", fontSize: "0.84rem", fontWeight: 500, maxWidth: selectedJournal ? 160 : 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.narration}>{j.narration}</td>
                          <td style={{ padding: "0.8rem 1rem", fontSize: "0.84rem", fontWeight: 500, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right", color: "#B4321F", fontVariantNumeric: "tabular-nums" }}>
                            {j.total_debit ? j.total_debit.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : "—"}
                          </td>
                          <td style={{ padding: "0.8rem 1rem", fontSize: "0.84rem", fontWeight: 500, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right", color: "#0B7A55", fontVariantNumeric: "tabular-nums" }}>
                            {j.total_credit ? j.total_credit.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : "—"}
                          </td>
                          <td style={{ padding: "0.8rem 1rem" }}>
                            <span className="jr-pill" style={{ color: STATUS_COLOR[j.status] ?? "#141A3A", background: `${STATUS_COLOR[j.status] ?? "#141A3A"}16` }}><i />{j.status.charAt(0).toUpperCase() + j.status.slice(1)}</span>
                            {/* B13 — reversal pairs are linked both ways */}
                            {(j as { reversed_by?: string | null }).reversed_by && <div style={{ fontSize: "0.68rem", color: "#C2321F", marginTop: 3 }}>Reversed by {journals.find(x => x.id === (j as { reversed_by?: string | null }).reversed_by)?.entry_no ?? "a reversal"}</div>}
                            {(j as { reversal_of?: string | null }).reversal_of && <div style={{ fontSize: "0.68rem", color: "#5A6080", marginTop: 3 }}>Reverses {journals.find(x => x.id === (j as { reversal_of?: string | null }).reversal_of)?.entry_no ?? "an entry"}</div>}
                          </td>
                          <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap" }}>
                            {j.entry_no?.startsWith("TLY-") ? <span className="jr-pill" style={{ color: "#5E6B66", background: "#EEF1EF" }}><i />From Tally</span>
                              : isPushed(j.id) ? <span className="jr-pill" style={{ color: "#0B7A55", background: "#E3F6EE" }}>✓ Pushed</span>
                              : pushed[j.id] && "error" in pushed[j.id] ? <span className="jr-pill" style={{ color: "#C2321F", background: "#FDECEA" }} title={explainTallyError((pushed[j.id] as { error: string }).error, tally.educational)}>✗ Failed</span>
                              : j.status === "posted" ? <span className="jr-pill" style={{ color: "#8A5A00", background: "#FFF4DB" }}><i />Not pushed</span> : null}
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                            {j.ai_generated && <span className="jr-pill" title="Drafted by FreBook AI" style={{ color: "#5B4BC4", background: "rgba(91,75,196,0.1)" }}>✦ AI</span>}
                            {incomeIds.has(j.id) && (
                              <Link href={`/finance/invoices/${j.id}`} onClick={e => e.stopPropagation()} title="Create an invoice for this sale"
                                style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 700, color: "#FFFFFF", background: "#232A63", padding: "4px 9px", borderRadius: 6, textDecoration: "none" }}>Invoice</Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length > visible.length && (
                  <div style={{ padding: "0.9rem", textAlign: "center", borderTop: "1px solid rgba(20,26,58,0.08)" }}>
                    <button onClick={() => setShown(n => n + 200)} style={{ background: "#232A63", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
                      Show 200 more ({(filtered.length - visible.length).toLocaleString(activeMoney().locale)} left)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detail drawer panel */}
        {selectedJournal && (
          <div style={{ width: 380, flexShrink: 0, position: "sticky", top: 112, maxHeight: "calc(100vh - 128px)", overflowY: "auto", animation: "slideIn 0.2s ease-out" }}>
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(35,42,99,0.2)", borderRadius: 14, overflow: "hidden" }}>

              {/* Drawer header */}
              <div style={{ padding: "1rem 1.1rem 0.85rem", borderBottom: "1px solid rgba(20,26,58,0.11)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#232A63", fontSize: "0.82rem", fontWeight: 600, marginBottom: 4 }}>{selectedJournal.entry_no}</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#141A3A", lineHeight: 1.4, wordBreak: "break-word" }}>{selectedJournal.narration || "—"}</div>
                </div>
                <button onClick={closeDrawer} style={{ background: "#FFFFFF", border: "none", color: "rgba(20,26,58,0.75)", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
              </div>

              {/* Meta row */}
              <div style={{ padding: "0.75rem 1.1rem", borderBottom: "1px solid rgba(20,26,58,0.10)", display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.75)" }}>
                  {new Date(selectedJournal.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: TYPE_COLOR[selectedJournal.type] ?? "#141A3A", background: `${TYPE_COLOR[selectedJournal.type] ?? "#141A3A"}15`, padding: "1px 8px", borderRadius: 4 }}>
                  {TYPE_LABEL[selectedJournal.type] ?? selectedJournal.type}
                </span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STATUS_COLOR[selectedJournal.status], background: `${STATUS_COLOR[selectedJournal.status]}18`, padding: "1px 8px", borderRadius: 4 }}>
                  {selectedJournal.status}
                </span>
                {selectedJournal.reference_no && (
                  <span style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)" }}>Ref: {selectedJournal.reference_no}</span>
                )}
              </div>

              {/* Totals */}
              <div style={{ padding: "0.75rem 1.1rem", borderBottom: "1px solid rgba(20,26,58,0.10)", display: "flex", gap: "1.5rem" }}>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Total Debit</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#C2321F" }}>{fmt(selectedJournal.total_debit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Total Credit</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#0B7A55" }}>{fmt(selectedJournal.total_credit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(20,26,58,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Difference</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", fontWeight: 700, color: Math.abs(selectedJournal.total_debit - selectedJournal.total_credit) < 1 ? "#0B7A55" : "#C2321F" }}>
                    {fmt(Math.abs(selectedJournal.total_debit - selectedJournal.total_credit))}
                  </div>
                </div>
              </div>

              {/* Journal lines */}
              <div style={{ padding: "0.75rem 1.1rem 0.5rem" }}>
                <div style={{ fontSize: "0.65rem", color: "rgba(20,26,58,0.60)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "0.6rem" }}>Double-Entry Lines</div>
                {drawerLoading ? (
                  <div style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.8rem", padding: "1rem 0" }}>Loading lines…</div>
                ) : drawerLines.length === 0 ? (
                  <div style={{ color: "rgba(20,26,58,0.55)", fontSize: "0.8rem", padding: "0.5rem 0" }}>No line items found.</div>
                ) : (
                  <div>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid rgba(20,26,58,0.11)", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.62rem", color: "rgba(20,26,58,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Account</span>
                      <span style={{ fontSize: "0.62rem", color: "#C2321F", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Debit</span>
                      <span style={{ fontSize: "0.62rem", color: "#0B7A55", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Credit</span>
                    </div>
                    {drawerLines.map((l, i) => (
                      <div key={l.id ?? i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "0.5rem", padding: "0.42rem 0", borderBottom: "1px solid rgba(20,26,58,0.10)" }}>
                        <div>
                          <div style={{ fontSize: "0.8rem", color: "#141A3A", fontWeight: 500 }}>{l.account?.name ?? l.account_id.slice(0, 8)}</div>
                          {l.account?.type && <div style={{ fontSize: "0.65rem", color: "rgba(20,26,58,0.55)", marginTop: 1 }}>{l.account.type}</div>}
                          {l.narration && l.narration !== l.account?.name && (
                            <div style={{ fontSize: "0.66rem", color: "rgba(20,26,58,0.60)", marginTop: 1, fontStyle: "italic" }}>{l.narration}</div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", color: l.dr_amount > 0 ? "#C2321F" : "rgba(20,26,58,0.28)", fontWeight: l.dr_amount > 0 ? 600 : 400 }}>
                          {l.dr_amount > 0 ? l.dr_amount.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : "—"}
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", color: l.cr_amount > 0 ? "#0B7A55" : "rgba(20,26,58,0.28)", fontWeight: l.cr_amount > 0 ? 600 : 400 }}>
                          {l.cr_amount > 0 ? l.cr_amount.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 }) : "—"}
                        </div>
                      </div>
                    ))}
                    {/* Totals footer */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "0.5rem", padding: "0.5rem 0 0.25rem", borderTop: "1px solid rgba(20,26,58,0.15)", marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(20,26,58,0.75)" }}>Total</span>
                      <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", fontWeight: 700, color: "#C2321F" }}>
                        {drawerLines.reduce((s, l) => s + (l.dr_amount || 0), 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", fontWeight: 700, color: "#0B7A55" }}>
                        {drawerLines.reduce((s, l) => s + (l.cr_amount || 0), 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ padding: "0.75rem 1.1rem 1rem", borderTop: "1px solid rgba(20,26,58,0.10)", display: "flex", gap: "0.6rem" }}>
                <Link href={`/finance/journals/${selectedJournal.id}/edit`} style={{ flex: 1, textAlign: "center", background: "rgba(35,42,99,0.1)", border: "1px solid rgba(35,42,99,0.25)", color: "#232A63", padding: "7px 0", borderRadius: 7, fontWeight: 700, fontSize: "0.78rem", textDecoration: "none" }}>
                  {selectedJournal.status === "posted" ? "Correct Entry" : "Edit Entry"}
                </Link>
                {selectedJournal.status === "posted" && (
                  <button onClick={async () => {
                    const reason = window.prompt(`Reverse ${selectedJournal.entry_no}? A reversing entry dated today will cancel it. Reason:`)?.trim();
                    if (!reason) return;
                    const res = await fetch("/api/finance/journals/reverse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, journal_id: selectedJournal.id, reason }) });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok) { alert(d.error ?? "Could not reverse this entry."); return; }
                    alert(`Reversed. Reversing entry ${d.reversal_entry_no} posted.`);
                    window.location.reload();
                  }} style={{ flex: 1, background: "rgba(194,50,31,0.08)", border: "1px solid rgba(194,50,31,0.25)", color: "#C2321F", padding: "7px 0", borderRadius: 7, fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                    Reverse
                  </button>
                )}
                <button onClick={closeDrawer} style={{ flex: 1, background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.12)", color: "rgba(20,26,58,0.75)", padding: "7px 0", borderRadius: 7, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
