"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { LEDGER_HEADS, inferHead, headFromType } from "@/lib/ledgerHeads";
import { groupStatement, learnHistory } from "@/lib/statementGroups";

type Account = { id: string; name: string; type: string; sub_type: string | null };
type Row = {
  id: string; date: string; description: string; debit: number; credit: number;
  ledger: string; aiLedger: string; aiType: string; confidence: number;
  state: "open" | "posting" | "posted" | "failed"; entryNo?: string; error?: string;
};
type SortKey = "date" | "description" | "debit" | "credit" | "ledger";

const BG = "#FFFFFF", BORDER = "rgba(20,26,58,0.12)", GOLD = "#232A63", GREEN = "#0B7A55", RED = "#C2321F";
const BLUE = "#1F5EFF", AMBER = "#8A5A00", PURPLE = "#5B4BC4", TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.75)";
const MONO = "'IBM Plex Mono', 'Fira Code', monospace";
const fmt = (n: number) => n ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
const inputStyle: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "6px 9px", borderRadius: 7, fontSize: "0.8rem", fontFamily: "inherit", outline: "none" };

export default function StatementModal({ file, bizId, userId, onClose, onPosted }: {
  file: File; bizId: string; userId: string; onClose: () => void; onPosted: (count: number, total: number) => void;
}) {
  const [phase, setPhase] = useState<"reading" | "suggesting" | "ready" | "error">("reading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankLedger, setBankLedger] = useState("");
  const [heads, setHeads] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "debit" | "credit" | "unassigned" | "posted">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });
  const [bulkLedger, setBulkLedger] = useState("");
  const [posting, setPosting] = useState(false);
  const [view, setView] = useState<"groups" | "rows">("groups");
  const [history, setHistory] = useState<Record<string, string>>({});
  const [groupLedger, setGroupLedger] = useState<Record<string, string>>({});
  const [groupFilter, setGroupFilter] = useState<{ label: string; ids: Set<string> } | null>(null);
  const [progress, setProgress] = useState("");

  // Read the statement, then ask the AI for a ledger per row
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: accs } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type,sub_type").eq("business_id", bizId).eq("is_group", false).order("name");
      if (cancelled) return;
      const list = (accs ?? []) as Account[];
      setAccounts(list);
      const banks = list.filter(a => a.sub_type === "bank" || /bank/i.test(a.name));
      if (banks.length) setBankLedger(banks[0].name);

      // Learn "payee → ledger" from statement rows posted before
      const nameOf = new Map(list.map(a => [a.id, a]));
      const { data: past } = await supabase.from("fw_fin_journals").select("narration,fw_fin_journal_lines(account_id,dr_amount,cr_amount)")
        .eq("business_id", bizId).eq("status", "posted").eq("source", "statement").order("date", { ascending: false }).limit(1000);
      const learned: { description: string; ledger: string; debit: number }[] = [];
      for (const j of (past ?? []) as unknown as { narration: string | null; fw_fin_journal_lines: { account_id: string; dr_amount: number; cr_amount: number }[] }[]) {
        const ls = j.fw_fin_journal_lines ?? [];
        const bank = ls.find(l => { const a = nameOf.get(l.account_id); return a && (a.sub_type === "bank" || /bank/i.test(a.name)); });
        const other = ls.find(l => l !== bank);
        const acc = other ? nameOf.get(other.account_id) : null;
        if (bank && acc) learned.push({ description: j.narration ?? "", ledger: acc.name, debit: Number(bank.cr_amount) > 0 ? 1 : 0 });
      }
      if (!cancelled) setHistory(learnHistory(learned));

      const fd = new FormData(); fd.append("file", file); fd.append("business_id", bizId);
      const res = await fetch("/api/finance/parse-bank-pdf", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok || !Array.isArray(data.transactions)) { setError(data.error ?? "Could not read this statement."); setPhase("error"); return; }
      const parsed: Row[] = (data.transactions as { date: string; description: string; debit: number; credit: number }[])
        .filter(t => (Number(t.debit) || 0) > 0 || (Number(t.credit) || 0) > 0)
        .map((t, i) => ({ id: `r${i}`, date: String(t.date ?? "").slice(0, 10), description: String(t.description ?? ""), debit: Number(t.debit) || 0, credit: Number(t.credit) || 0, ledger: "", aiLedger: "", aiType: "", confidence: 0, state: "open" }));
      if (!parsed.length) { setError("No transactions found in this statement."); setPhase("error"); return; }
      setRows(parsed); setPhase("suggesting");

      for (let i = 0; i < parsed.length; i += 25) {
        const chunk = parsed.slice(i, i + 25);
        try {
          const r = await fetch("/api/finance/bank-ai-categorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, rows: chunk.map(c => ({ id: c.id, date: c.date, description: c.description, debit: c.debit, credit: c.credit })) }) });
          const s = await r.json();
          if (cancelled) return;
          const byId = new Map(((s.suggestions ?? []) as { id: string; account: string; account_type: string; confidence: number }[]).map(x => [x.id, x]));
          setRows(prev => prev.map(row => {
            const sg = byId.get(row.id);
            return sg && !row.ledger ? { ...row, ledger: sg.account, aiLedger: sg.account, aiType: sg.account_type, confidence: sg.confidence ?? 0 } : row;
          }));
        } catch { /* leave these rows for the user */ }
      }
      if (!cancelled) setPhase("ready");
    })();
    return () => { cancelled = true; };
  }, [file, bizId]);

  const existing = useMemo(() => new Set(accounts.map(a => a.name.toLowerCase())), [accounts]);
  const isNew = (name: string) => !!name.trim() && !existing.has(name.trim().toLowerCase());

  // New ledgers in use (from selected rows + the bank) and their groups
  const newLedgers = useMemo(() => {
    const m = new Map<string, string>();
    const consider = (name: string, aiType: string) => {
      const n = name.trim(); if (!isNew(n) || m.has(n)) return;
      m.set(n, heads[n] ?? inferHead(n)?.key ?? headFromType(aiType).key);
    };
    if (bankLedger) consider(bankLedger, "asset");
    rows.filter(r => r.state !== "posted" && selected.has(r.id) && r.ledger).forEach(r => consider(r.ledger, r.aiType));
    return m;
  }, [rows, selected, bankLedger, heads, existing]);
  const unsureHeads = [...newLedgers.keys()].filter(n => !inferHead(n) && !heads[n]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter(r => {
      if (filter === "debit" && !r.debit) return false;
      if (filter === "credit" && !r.credit) return false;
      if (filter === "unassigned" && r.ledger.trim()) return false;
      if (filter === "posted" && r.state !== "posted") return false;
      if (filter !== "posted" && filter !== "all" && r.state === "posted") return false;
      if (groupFilter && !groupFilter.ids.has(r.id)) return false;
      return !q || r.description.toLowerCase().includes(q) || r.ledger.toLowerCase().includes(q) || String(r.debit || r.credit).includes(q);
    });
    const k = sort.key;
    return [...list].sort((a, b) => {
      const av = a[k], bv = b[k];
      return (typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [rows, filter, search, sort, groupFilter]);

  // Similar transactions grouped by payee / purpose, with one suggested ledger per group
  const groups = useMemo(() => groupStatement(rows.filter(r => r.state !== "posted").map(r => ({ id: r.id, date: r.date, description: r.description, debit: r.debit, credit: r.credit, aiLedger: r.aiLedger, confidence: r.confidence })), history), [rows, history]);
  const ledgerFor = (key: string, suggested: string) => groupLedger[key] ?? suggested;
  const groupState = (ids: string[]) => {
    const ls = new Set(rows.filter(r => ids.includes(r.id)).map(r => r.ledger.trim()).filter(Boolean));
    return ls.size === 0 ? "none" : ls.size === 1 ? [...ls][0] : "mixed";
  };
  function applyGroup(ids: string[], ledger: string, select = true) {
    if (!ledger.trim()) return;
    const set = new Set(ids);
    setRows(prev => prev.map(r => set.has(r.id) && r.state !== "posted" ? { ...r, ledger: ledger.trim() } : r));
    if (select) setSelected(s => { const n = new Set(s); ids.forEach(id => n.add(id)); return n; });
  }
  function applyAllSuggestions() {
    for (const g of groups) { const l = ledgerFor(g.key, g.suggested); if (l) applyGroup(g.rowIds, l); }
  }

  const openVisible = visible.filter(r => r.state !== "posted");
  const allChecked = openVisible.length > 0 && openVisible.every(r => selected.has(r.id));
  const sel = rows.filter(r => selected.has(r.id) && r.state !== "posted");
  const selMissing = sel.filter(r => !r.ledger.trim()).length;
  const totals = { dr: rows.reduce((s, r) => s + r.debit, 0), cr: rows.reduce((s, r) => s + r.credit, 0) };

  function setLedger(id: string, ledger: string) { setRows(prev => prev.map(r => r.id === id ? { ...r, ledger } : r)); }
  function toggle(id: string) { setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function sortBy(key: SortKey) { setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 })); }
  function applyBulk() {
    if (!bulkLedger.trim()) return;
    setRows(prev => prev.map(r => selected.has(r.id) && r.state !== "posted" ? { ...r, ledger: bulkLedger.trim() } : r));
  }
  function selectSimilar(r: Row) {
    const key = r.description.toLowerCase().replace(/[0-9/:\-_.]+/g, " ").split(/\s+/).filter(w => w.length > 3).slice(0, 2).join(" ");
    if (!key) return;
    setSelected(s => { const n = new Set(s); rows.forEach(x => { if (x.state !== "posted" && x.description.toLowerCase().replace(/[0-9/:\-_.]+/g, " ").includes(key)) n.add(x.id); }); return n; });
  }

  async function postSelected() {
    if (!bankLedger.trim() || !sel.length || selMissing || unsureHeads.length) return;
    setPosting(true);
    const accountHeads = Object.fromEntries(newLedgers);
    let ok = 0, total = 0;
    const build = (r: Row) => {
      const amount = r.debit || r.credit;
      const isOut = r.debit > 0;
      const tx = {
        status: "complete", transaction_date: r.date, transaction_type: isOut ? "bank_payment" : "bank_receipt",
        narrative: r.description.slice(0, 200), amount, party_name: null, party_type: null, invoice_number: null,
        payment_mode: "bank", bank_account_name: bankLedger,
        gst: { applicable: false, rate: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0, transaction_type: null },
        tds: { applicable: false, section: null, rate: 0, amount: 0, net_payment: amount },
        lines: isOut
          ? [{ account: r.ledger.trim(), debit: amount, credit: 0, confidence: 1, is_new_account: isNew(r.ledger), suggested_type: null },
             { account: bankLedger.trim(), debit: 0, credit: amount, confidence: 1, is_new_account: isNew(bankLedger), suggested_type: "asset" }]
          : [{ account: bankLedger.trim(), debit: amount, credit: 0, confidence: 1, is_new_account: isNew(bankLedger), suggested_type: "asset" },
             { account: r.ledger.trim(), debit: 0, credit: amount, confidence: 1, is_new_account: isNew(r.ledger), suggested_type: null }],
        needs_clarification: [], warnings: [], confidence: 1,
      };
      return { ref: r.id, transaction: tx, original_message: `Bank statement ${file.name}: ${r.description}` };
    };

    const BATCH = 100;
    for (let i = 0; i < sel.length; i += BATCH) {
      const chunk = sel.slice(i, i + BATCH);
      const ids = new Set(chunk.map(r => r.id));
      setProgress(`Posting ${i + 1}–${i + chunk.length} of ${sel.length}…`);
      setRows(prev => prev.map(x => ids.has(x.id) ? { ...x, state: "posting" } : x));
      try {
        const res = await fetch("/api/finance/chat-book/confirm-batch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk.map(build), business_id: bizId, user_id: userId, account_heads: accountHeads }),
        });
        const data = await res.json();
        if (!res.ok || data.needs_heads) throw new Error(data.error ?? `Choose a group for ${data.needs_heads?.map((h: { account: string }) => h.account).join(", ")}`);
        const done = new Map(((data.results ?? []) as { ref: string; entry_no: string }[]).map(r => [r.ref, r.entry_no]));
        const fails = new Map(((data.failures ?? []) as { ref: string; error: string }[]).map(f => [f.ref, f.error]));
        chunk.forEach(r => { if (done.has(r.id)) { ok++; total += r.debit || r.credit; } });
        setRows(prev => prev.map(x => done.has(x.id) ? { ...x, state: "posted", entryNo: done.get(x.id), error: undefined }
          : fails.has(x.id) ? { ...x, state: "failed", error: fails.get(x.id) } : x));
        if (data.created_ledgers?.length) {
          setAccounts(prev => [...prev, ...data.created_ledgers.map((c: { name: string }) => ({ id: c.name, name: c.name, type: "", sub_type: null }))]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setRows(prev => prev.map(x => ids.has(x.id) ? { ...x, state: "failed", error: msg } : x));
      }
    }
    setSelected(new Set()); setPosting(false);
    setProgress(`✓ ${ok} of ${sel.length} posted${ok < sel.length ? " — failed rows are marked in red" : ""}.`);
    if (ok) onPosted(ok, total);
  }

  const th = (label: string, key?: SortKey, right = false) => (
    <th onClick={key ? () => sortBy(key) : undefined} style={{ padding: "0.5rem 0.6rem", textAlign: right ? "right" : "left", color: sort.key === key ? GOLD : MUTED, fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.07em", cursor: key ? "pointer" : "default", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#FFFFFF", zIndex: 1 }}>
      {label}{key && sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  const chip = (active: boolean, color = GOLD): React.CSSProperties => ({ background: active ? `${color}22` : "transparent", border: `1px solid ${active ? color + "66" : BORDER}`, color: active ? color : MUTED, padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,26,58,0.33)", backdropFilter: "blur(3px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, width: "100%", maxWidth: 1180, height: "92vh", display: "flex", flexDirection: "column", color: TEXT, boxShadow: "0 30px 90px rgba(20,26,58,0.30)" }}>

        {/* Header */}
        <div style={{ padding: "0.9rem 1.2rem", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem" }}>🏦 Book bank statement</div>
            <div style={{ fontSize: "0.74rem", color: MUTED }}>{file.name}{rows.length ? ` · ${rows.length} transactions · Withdrawals ₹${fmt(totals.dr)} · Deposits ₹${fmt(totals.cr)}` : ""}</div>
          </div>
          <div style={{ flex: 1 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
            <span style={{ color: MUTED }}>Bank ledger</span>
            <input list="sm-banks" value={bankLedger} onChange={e => setBankLedger(e.target.value)} placeholder="e.g. HDFC Bank" style={{ ...inputStyle, width: 190, borderColor: bankLedger ? BORDER : AMBER }} />
            <datalist id="sm-banks">{accounts.filter(a => a.sub_type === "bank" || /bank/i.test(a.name)).map(a => <option key={a.id} value={a.name} />)}</datalist>
          </label>
          <button onClick={onClose} disabled={posting} style={{ background: "#FFFFFF", border: "none", color: MUTED, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: "1.1rem" }}>×</button>
        </div>

        {phase === "reading" || phase === "error" ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: phase === "error" ? RED : MUTED, padding: "2rem", textAlign: "center" }}>
            {phase === "reading" ? <><span style={{ width: 22, height: 22, border: `2px solid ${GOLD}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Reading every page of the statement… this can take up to a minute for long statements.</> : <>⚠ {error}<button onClick={onClose} style={{ ...chip(false), marginTop: 8 }}>Close</button></>}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={{ padding: "0.7rem 1.2rem", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", marginRight: 6 }}>
                <button onClick={() => setView("groups")} style={{ ...chip(view === "groups", GOLD), border: "none", borderRadius: 0 }}>By group</button>
                <button onClick={() => { setView("rows"); }} style={{ ...chip(view === "rows", GOLD), border: "none", borderRadius: 0 }}>All rows</button>
              </span>
              <button style={chip(filter === "all")} onClick={() => setFilter("all")}>All</button>
              <button style={chip(filter === "debit", RED)} onClick={() => setFilter("debit")}>Withdrawals</button>
              <button style={chip(filter === "credit", GREEN)} onClick={() => setFilter("credit")}>Deposits</button>
              <button style={chip(filter === "unassigned", AMBER)} onClick={() => setFilter("unassigned")}>No ledger ({rows.filter(r => !r.ledger.trim() && r.state !== "posted").length})</button>
              <button style={chip(filter === "posted", BLUE)} onClick={() => setFilter("posted")}>Posted ({rows.filter(r => r.state === "posted").length})</button>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, ledger, amount…" style={{ ...inputStyle, width: 230 }} />
              {phase === "suggesting" && <span style={{ fontSize: "0.74rem", color: PURPLE }}>🤖 AI is suggesting ledgers…</span>}
              <div style={{ flex: 1 }} />
              {selected.size > 0 && (
                <>
                  <span style={{ fontSize: "0.78rem", color: BLUE, fontWeight: 700 }}>{selected.size} selected</span>
                  <input list="sm-ledgers" value={bulkLedger} onChange={e => setBulkLedger(e.target.value)} onKeyDown={e => { if (e.key === "Enter") applyBulk(); }} placeholder="Ledger for selected…" style={{ ...inputStyle, width: 180 }} />
                  <button onClick={applyBulk} style={{ ...chip(true, BLUE) }}>Apply</button>
                </>
              )}
            </div>
            <datalist id="sm-ledgers">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>

            {/* Group view: similar transactions together, one ledger per group */}
            {view === "groups" && (
              <div style={{ flex: 1, overflow: "auto", padding: "0.8rem 1.2rem", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: "0.8rem", color: MUTED }}>
                  <span><b style={{ color: TEXT }}>{groups.length} groups</b> from {rows.filter(r => r.state !== "posted").length} open transactions. Check each ledger, then apply.</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={applyAllSuggestions} disabled={!groups.some(g => ledgerFor(g.key, g.suggested))} style={{ ...chip(true, GREEN), fontWeight: 800 }}>✓ Apply all suggestions &amp; select</button>
                </div>
                {phase === "suggesting" && <div style={{ fontSize: "0.76rem", color: PURPLE }}>🤖 AI is still reading rows — groups will fill in suggestions as it goes.</div>}
                {groups.map(g => {
                  const ledger = ledgerFor(g.key, g.suggested);
                  const now = groupState(g.rowIds);
                  const applied = now !== "none" && now !== "mixed" && now.toLowerCase() === ledger.trim().toLowerCase();
                  const allSel = g.rowIds.every(id => selected.has(id));
                  return (
                    <div key={g.key} style={{ display: "grid", gridTemplateColumns: "26px minmax(180px,1.4fr) 110px minmax(200px,1.2fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10, border: `1px solid ${applied ? "rgba(11,122,85,0.35)" : BORDER}`, background: applied ? "rgba(11,122,85,0.05)" : "#FFFFFF" }}>
                      <input type="checkbox" aria-label={`Select ${g.label}`} checked={allSel} onChange={() => setSelected(s => { const n = new Set(s); g.rowIds.forEach(id => allSel ? n.delete(id) : n.add(id)); return n; })} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                        <div style={{ fontSize: "0.72rem", color: MUTED }}>
                          <span style={{ color: g.dir === "out" ? RED : GREEN, fontWeight: 700 }}>{g.dir === "out" ? "Paid out" : "Received"}</span> · {g.count} transaction{g.count > 1 ? "s" : ""}
                          {" · "}<button onClick={() => { setGroupFilter({ label: g.label, ids: new Set(g.rowIds) }); setView("rows"); setFilter("all"); }} style={{ background: "none", border: "none", color: BLUE, padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>see rows</button>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", fontFamily: MONO, fontWeight: 700, color: g.dir === "out" ? RED : GREEN }}>₹{fmt(g.total)}</div>
                      <div style={{ minWidth: 0 }}>
                        <input list="sm-ledgers" value={ledger} onChange={e => setGroupLedger(m => ({ ...m, [g.key]: e.target.value }))} placeholder="Choose or type ledger" style={{ ...inputStyle, width: "100%", borderColor: !ledger.trim() ? "rgba(184,120,0,0.4)" : isNew(ledger) ? "rgba(91,75,196,0.5)" : BORDER }} />
                        <div style={{ fontSize: "0.68rem", color: MUTED, marginTop: 3 }}>
                          {g.reason && <span style={{ color: g.source === "history" ? GREEN : g.source === "rule" ? BLUE : PURPLE }}>{g.source === "history" ? "★ " : ""}{g.reason}</span>}
                          {isNew(ledger) && <span style={{ color: PURPLE }}> · new ledger</span>}
                          {now === "mixed" && <span style={{ color: AMBER }}> · rows have different ledgers now</span>}
                        </div>
                      </div>
                      <button onClick={() => applyGroup(g.rowIds, ledger)} disabled={!ledger.trim()} style={{ ...chip(!applied, applied ? GREEN : BLUE), whiteSpace: "nowrap", opacity: ledger.trim() ? 1 : 0.5 }}>{applied ? "✓ Applied" : `Apply to ${g.count}`}</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table */}
            {view === "rows" && (
            <div style={{ flex: 1, overflow: "auto" }}>
              {groupFilter && (
                <div style={{ padding: "6px 12px", fontSize: "0.76rem", background: "rgba(31,94,255,0.06)", color: BLUE, display: "flex", gap: 10, alignItems: "center" }}>
                  Showing group: <b>{groupFilter.label}</b>
                  <button onClick={() => setGroupFilter(null)} style={{ background: "none", border: "none", color: BLUE, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>Show all rows ×</button>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "0.5rem 0.6rem", position: "sticky", top: 0, background: "#FFFFFF", zIndex: 1, width: 30 }}>
                      <input type="checkbox" checked={allChecked} onChange={() => setSelected(s => { const n = new Set(s); openVisible.forEach(r => allChecked ? n.delete(r.id) : n.add(r.id)); return n; })} />
                    </th>
                    {th("Date", "date")}{th("Description", "description")}{th("Withdrawal", "debit", true)}{th("Deposit", "credit", true)}{th("Ledger", "ledger")}{th("Status")}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => {
                    const posted = r.state === "posted";
                    return (
                      <tr key={r.id} style={{ borderTop: `1px solid rgba(20,26,58,0.10)`, background: r.state === "failed" ? "rgba(194,50,31,0.06)" : selected.has(r.id) ? "rgba(31,94,255,0.06)" : "transparent", opacity: posted ? 0.55 : 1 }}>
                        <td style={{ padding: "0.4rem 0.6rem" }}><input type="checkbox" disabled={posted} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                        <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap", color: MUTED }}>{r.date}</td>
                        <td style={{ padding: "0.4rem 0.6rem", maxWidth: 360 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>{r.description}</div>
                          {!posted && <button onClick={() => selectSimilar(r)} style={{ background: "none", border: "none", color: BLUE, fontSize: "0.66rem", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>select similar</button>}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", textAlign: "right", fontFamily: MONO, color: RED }}>{fmt(r.debit)}</td>
                        <td style={{ padding: "0.4rem 0.6rem", textAlign: "right", fontFamily: MONO, color: GREEN }}>{fmt(r.credit)}</td>
                        <td style={{ padding: "0.4rem 0.6rem" }}>
                          <input list="sm-ledgers" value={r.ledger} disabled={posted} onChange={e => setLedger(r.id, e.target.value)} placeholder="Choose or type ledger" style={{ ...inputStyle, width: 210, borderColor: !r.ledger.trim() ? "rgba(184,120,0,0.4)" : isNew(r.ledger) ? "rgba(91,75,196,0.5)" : BORDER }} />
                          {isNew(r.ledger) && !posted && <span style={{ fontSize: "0.64rem", color: PURPLE, marginLeft: 6 }}>new</span>}
                          {r.aiLedger && r.ledger === r.aiLedger && !posted && <span style={{ fontSize: "0.64rem", color: MUTED, marginLeft: 6 }} title={`AI confidence ${Math.round(r.confidence * 100)}%`}>AI {Math.round(r.confidence * 100)}%</span>}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap", fontSize: "0.72rem" }}>
                          {posted ? <span style={{ color: GREEN, fontWeight: 700 }}>✓ {r.entryNo}</span>
                            : r.state === "posting" ? <span style={{ color: BLUE }}>Posting…</span>
                            : r.state === "failed" ? <span style={{ color: RED }} title={r.error}>✗ {r.error?.slice(0, 40)}</span>
                            : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            {/* New ledgers + footer */}
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: "0.75rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {newLedgers.size > 0 && (
                <div style={{ display: "flex", gap: "0.5rem 1rem", flexWrap: "wrap", alignItems: "center", fontSize: "0.78rem" }}>
                  <span style={{ color: unsureHeads.length ? AMBER : MUTED, fontWeight: 700 }}>{unsureHeads.length ? "🤔 Choose a group for new ledgers:" : "New ledgers will be created:"}</span>
                  {[...newLedgers.entries()].map(([name, key]) => (
                    <label key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: unsureHeads.includes(name) ? AMBER : TEXT }}>{name}</span>
                      <select value={key} onChange={e => setHeads(h => ({ ...h, [name]: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", borderColor: unsureHeads.includes(name) ? AMBER : BORDER }}>
                        {LEDGER_HEADS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
                      </select>
                    </label>
                  ))}
                  {unsureHeads.length > 0 && (
                    <button onClick={() => setHeads(h => ({ ...h, ...Object.fromEntries(unsureHeads.map(n => [n, newLedgers.get(n)!])) }))} style={{ ...chip(true, AMBER) }}>✓ Use these groups</button>
                  )}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", color: progress.startsWith("✓") ? GREEN : MUTED }}>
                  {progress || (sel.length ? `${sel.length} to post · ₹${fmt(sel.reduce((s, r) => s + r.debit + r.credit, 0))}` : "Tick the transactions to post. Click a column header to sort.")}
                  {selMissing > 0 && <span style={{ color: AMBER }}> · {selMissing} selected without a ledger</span>}
                  {!bankLedger.trim() && <span style={{ color: AMBER }}> · choose the bank ledger at the top</span>}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={onClose} disabled={posting} style={{ ...chip(false), padding: "8px 16px" }}>Close</button>
                <button onClick={postSelected} disabled={posting || !sel.length || selMissing > 0 || !bankLedger.trim() || unsureHeads.length > 0}
                  style={{ background: GREEN, color: "#F5F6FA", border: "none", padding: "9px 22px", borderRadius: 8, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", opacity: posting || !sel.length || selMissing > 0 || !bankLedger.trim() || unsureHeads.length > 0 ? 0.45 : 1 }}>
                  {posting ? "Posting…" : `✓ Post ${sel.length || ""} selected`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
