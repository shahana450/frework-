"use client";
import { readBankStatement } from "@/lib/readStatement";
import { isCashBankAccount } from "@/lib/journalRules";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { LEDGER_HEADS, inferHead, headFromType } from "@/lib/ledgerHeads";
import GroupChips, { guessGroup } from "@/components/GroupChips";
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
const fmt = (n: number) => n ? n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
const inputStyle: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "6px 9px", borderRadius: 7, fontSize: "0.8rem", fontFamily: "inherit", outline: "none" };

export default function StatementModal({ file, bizId, userId, onClose, onPosted }: {
  file: File; bizId: string; userId: string; onClose: () => void; onPosted: (count: number, total: number, journals?: { id: string; date: string; entryNo: string }[]) => void;
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
      const banks = list.filter(a => isCashBankAccount(a as never) && a.sub_type !== "cash");
      if (banks.length) setBankLedger(banks[0].name);

      // Learn "payee → ledger" from statement rows posted before
      const nameOf = new Map(list.map(a => [a.id, a]));
      const { data: past } = await supabase.from("fw_fin_journals").select("narration,fw_fin_journal_lines(account_id,dr_amount,cr_amount)")
        .eq("business_id", bizId).eq("status", "posted").eq("source", "statement").order("date", { ascending: false }).limit(1000);
      const learned: { description: string; ledger: string; debit: number }[] = [];
      for (const j of (past ?? []) as unknown as { narration: string | null; fw_fin_journal_lines: { account_id: string; dr_amount: number; cr_amount: number }[] }[]) {
        const ls = j.fw_fin_journal_lines ?? [];
        const bank = ls.find(l => { const a = nameOf.get(l.account_id); return a && isCashBankAccount(a as never); });
        const other = ls.find(l => l !== bank);
        const acc = other ? nameOf.get(other.account_id) : null;
        if (bank && acc) learned.push({ description: j.narration ?? "", ledger: acc.name, debit: Number(bank.cr_amount) > 0 ? 1 : 0 });
      }
      if (!cancelled) setHistory(learnHistory(learned));

      let data: { transactions: { date: string; description: string; debit: number; credit: number }[] };
      try { data = await readBankStatement(file, { bizId }); }
      catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : "Could not read this statement."); setPhase("error"); } return; }
      if (cancelled) return;
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
  const CONTROL = /^(sundry\s+)?(debtors|creditors)(\s+control)?$|^(debtors|creditors)\s+control$|^accounts?\s+(receivable|payable)$/i;
  const GATEWAY = /\b(gateway|razorpay|paytm|phonepe|payu|cashfree|stripe|ccavenue|instamojo|pine ?labs|settlement)\b/i;
  // A named party is its own ledger (Sundry Debtors / Creditors are groups) — the group's label is the party
  const suggestFor = (g: { label: string; suggested: string }) => CONTROL.test(g.suggested.trim()) ? g.label : g.suggested;
  const ledgerFor = (key: string, suggested: string) => groupLedger[key] ?? suggested;
  const needsLook = (g: { label: string; suggested: string; key: string }) => !ledgerFor(g.key, suggestFor(g)).trim() || CONTROL.test(g.suggested.trim()) || GATEWAY.test(g.label);
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
    for (const g of groups) { if (needsLook(g)) continue; const l = ledgerFor(g.key, suggestFor(g)); if (l) applyGroup(g.rowIds, l); }
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
    const journals: { id: string; date: string; entryNo: string }[] = [];
    for (let i = 0; i < sel.length; i += BATCH) {
      const chunk = sel.slice(i, i + BATCH);
      const ids = new Set(chunk.map(r => r.id));
      setProgress(`Posting ${i + 1}–${i + chunk.length} of ${sel.length}…`);
      setRows(prev => prev.map(x => ids.has(x.id) ? { ...x, state: "posting" } : x));
      try {
        const res = await fetch("/api/finance/chat-book/confirm-batch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk.map(build), business_id: bizId, user_id: userId, account_heads: accountHeads, source: "statement", bank_account_name: bankLedger.trim(), file_name: file.name }),
        });
        const data = await res.json();
        if (!res.ok || data.needs_heads) throw new Error(data.error ?? `Choose a group for ${data.needs_heads?.map((h: { account: string }) => h.account).join(", ")}`);
        const done = new Map(((data.results ?? []) as { ref: string; entry_no: string }[]).map(r => [r.ref, r.entry_no]));
        for (const x of (data.results ?? []) as { ref: string; entry_no: string; journal_id: string; already?: boolean }[]) { const r = chunk.find(c => c.id === x.ref); if (r && !x.already) journals.push({ id: x.journal_id, date: r.date, entryNo: x.entry_no }); }
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
    if (ok) onPosted(ok, total, journals);
  }

  const th = (label: string, key?: SortKey, right = false) => (
    <th onClick={key ? () => sortBy(key) : undefined} style={{ padding: "0.5rem 0.6rem", textAlign: right ? "right" : "left", color: sort.key === key ? GOLD : MUTED, fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.07em", cursor: key ? "pointer" : "default", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#FFFFFF", zIndex: 1 }}>
      {label}{key && sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  const T = { ink: "#10241F", green: "#12352D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", look: "#FFF7E3", muted: "#6B7570" };
  const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
  const monthOf = (() => { const d = rows.find(x => x.date)?.date; return d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }).toUpperCase() : ""; })();
  const chip = (active: boolean, color = GOLD): React.CSSProperties => ({ background: active ? `${color}22` : "transparent", border: `1px solid ${active ? color + "66" : BORDER}`, color: active ? color : MUTED, padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,24,20,0.55)", backdropFilter: "blur(3px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: T.cream, border: `1px solid ${T.line}`, borderRadius: 16, width: "100%", maxWidth: 1180, height: "92vh", display: "flex", flexDirection: "column", color: T.ink, boxShadow: "0 30px 90px rgba(0,0,0,0.35)", overflow: "hidden", fontFamily: SERIF }}>

        {/* Header — the bank book */}
        <div style={{ padding: "1rem 1.4rem", background: T.green, color: "#F4EFE4", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", borderBottom: `2px solid ${T.gold}` }}>
          <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", border: `1px solid ${T.gold}`, display: "grid", placeItems: "center", color: T.gold, fontStyle: "italic", fontSize: "1.2rem" }}>Fb</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.66rem", letterSpacing: "0.22em", color: T.gold }}>FREBOOK · BANK BOOK{monthOf ? ` · ${monthOf}` : ""}</div>
            <div style={{ fontSize: "1.7rem", fontStyle: "italic", lineHeight: 1.15 }}>Book bank statement</div>
            <div style={{ fontSize: "0.78rem", color: "#C9D3CE" }}>{file.name}{rows.length ? ` · ${rows.length} transactions` : ""}</div>
          </div>
          <div style={{ flex: 1 }} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: T.gold }}>BANK LEDGER</span>
            <input list="sm-banks" value={bankLedger} onChange={e => setBankLedger(e.target.value)} placeholder="Your bank ledger" style={{ height: 38, width: 230, borderRadius: 999, border: `1px solid ${bankLedger ? "rgba(255,255,255,0.25)" : T.gold}`, background: "rgba(255,255,255,0.06)", color: "#FFFFFF", padding: "0 16px", fontSize: "0.92rem", fontFamily: SERIF, outline: "none" }} />
            <datalist id="sm-banks">{accounts.filter(a => isCashBankAccount(a as never)).map(a => <option key={a.id} value={a.name} />)}</datalist>
          </label>
          <button onClick={onClose} disabled={posting} aria-label="Close" style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#FFFFFF", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>

        {rows.length > 0 && phase !== "reading" && (() => {
          const openGroups = groups.length, ready = groups.filter(g => { const st = groupState(g.rowIds); const l = ledgerFor(g.key, suggestFor(g)); return st !== "none" && st !== "mixed" && st.toLowerCase() === l.trim().toLowerCase(); }).length;
          const postedN = rows.filter(r => r.state === "posted").length;
          const nIn = rows.filter(r => r.credit > 0).length, nOut = rows.filter(r => r.debit > 0).length, net = totals.cr - totals.dr;
          const money = (n: number) => { const [a, b] = fmt(Math.abs(n)).split("."); return <>{n < 0 ? "−" : ""}{cur()}{a}<span style={{ fontSize: "0.62em" }}>.{b ?? "00"}</span></>; };
          const tile = (top: string, dark = false): React.CSSProperties => ({ background: dark ? T.green : T.paper, color: dark ? "#FFFFFF" : T.ink, border: `1px solid ${dark ? T.green : T.line}`, borderTop: `3px solid ${top}`, borderRadius: 10, padding: "10px 14px" });
          const lab: React.CSSProperties = { fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted };
          return (
            <div style={{ padding: "0.9rem 1.4rem", borderBottom: `1px solid ${T.line}`, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <div style={tile(T.pos)}><div style={lab}>Money in · Cr</div><div style={{ fontSize: "1.55rem", color: T.pos }}>{money(totals.cr)}</div><div style={{ fontSize: "0.72rem", fontStyle: "italic", color: T.muted }}>{nIn} receipt{nIn === 1 ? "" : "s"}</div></div>
              <div style={tile(T.neg)}><div style={lab}>Money out · Dr</div><div style={{ fontSize: "1.55rem", color: T.neg }}>{money(totals.dr)}</div><div style={{ fontSize: "0.72rem", fontStyle: "italic", color: T.muted }}>{nOut} payment{nOut === 1 ? "" : "s"}</div></div>
              <div style={tile(T.green, true)}><div style={{ ...lab, color: T.gold }}>Net movement</div><div style={{ fontSize: "1.55rem" }}>{money(net)}</div><div style={{ fontSize: "0.72rem", fontStyle: "italic", color: "#C9D3CE" }}>{net >= 0 ? "surplus" : "deficit"} for the period</div></div>
              <div style={tile(T.gold)}><div style={lab}>Ledgers applied</div><div style={{ fontSize: "1.55rem" }}>{ready} <span style={{ fontSize: "0.8rem", fontStyle: "italic", color: T.muted }}>of {openGroups}</span></div><div style={{ height: 4, borderRadius: 999, background: T.line, marginTop: 6 }}><div style={{ width: `${openGroups ? Math.round(ready / openGroups * 100) : 0}%`, height: "100%", borderRadius: 999, background: T.gold, transition: "width .4s" }} /></div></div>
              <div style={tile("#9AA39F")}><div style={lab}>Posted</div><div style={{ fontSize: "1.55rem" }}>{postedN} <span style={{ fontSize: "0.8rem", fontStyle: "italic", color: T.muted }}>of {rows.length}</span></div><div style={{ height: 4, borderRadius: 999, background: T.line, marginTop: 6 }}><div style={{ width: `${rows.length ? Math.round(postedN / rows.length * 100) : 0}%`, height: "100%", borderRadius: 999, background: T.pos }} /></div></div>
            </div>
          );
        })()}

        {phase === "reading" || phase === "error" ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: phase === "error" ? RED : MUTED, padding: "2rem", textAlign: "center" }}>
            {phase === "reading" ? <><span style={{ width: 22, height: 22, border: `2px solid ${GOLD}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Reading every page of the statement… this can take up to a minute for long statements.</> : <>⚠ {error}<button onClick={onClose} style={{ ...chip(false), marginTop: 8 }}>Close</button></>}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={{ padding: "0.7rem 1.4rem", borderBottom: `1px solid ${T.line}`, display: "flex", gap: "1.1rem", alignItems: "center", flexWrap: "wrap", background: "#FAF7F0" }}>
              <span style={{ display: "inline-flex", padding: 3, borderRadius: 999, background: "#EAE3D4" }}>
                {(["groups", "rows"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{ height: 32, padding: "0 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: "0.86rem", background: view === v ? T.green : "transparent", color: view === v ? "#FFFFFF" : T.ink }}>{v === "groups" ? "By group" : "All rows"}</button>
                ))}
              </span>
              {([["all", "All", rows.length], ["debit", "Withdrawals", rows.filter(x => x.debit > 0).length], ["credit", "Deposits", rows.filter(x => x.credit > 0).length], ["unassigned", "No ledger", rows.filter(x => !x.ledger.trim() && x.state !== "posted").length], ["posted", "Posted", rows.filter(x => x.state === "posted").length]] as const).map(([k, l, n]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ border: "none", background: "none", padding: "4px 2px", cursor: "pointer", fontFamily: SERIF, fontSize: "0.92rem", fontStyle: filter === k ? "italic" : "normal", color: T.ink, borderBottom: `2px solid ${filter === k ? T.gold : "transparent"}` }}>
                  {l} <span style={{ fontSize: "0.72rem", color: T.goldInk }}>{n}</span>
                </button>
              ))}
              {phase === "suggesting" && <span style={{ fontSize: "0.76rem", fontStyle: "italic", color: T.goldInk }}>Suggesting ledgers…</span>}
              <div style={{ flex: 1 }} />
              {selected.size > 0 && (
                <>
                  <span style={{ fontSize: "0.82rem", fontStyle: "italic" }}>{selected.size} selected</span>
                  <input list="sm-ledgers" value={bulkLedger} onChange={e => setBulkLedger(e.target.value)} onKeyDown={e => { if (e.key === "Enter") applyBulk(); }} placeholder="Ledger for selected…" style={{ height: 36, width: 180, borderRadius: 999, border: `1px solid ${T.line}`, padding: "0 14px", fontFamily: SERIF, background: T.paper }} />
                  <button onClick={applyBulk} style={{ height: 36, padding: "0 16px", borderRadius: 999, border: "none", background: T.green, color: "#FFFFFF", fontFamily: SERIF, cursor: "pointer" }}>Apply</button>
                </>
              )}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search particulars, ledger, amount…" style={{ height: 38, width: 300, maxWidth: "100%", borderRadius: 999, border: `1px solid ${T.line}`, padding: "0 18px", fontFamily: SERIF, fontStyle: "italic", fontSize: "0.86rem", background: T.paper, outline: "none" }} />
            </div>
            <datalist id="sm-ledgers">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>

            {/* Group view: similar transactions together, one ledger per group */}
            {view === "groups" && (() => {
              const cols = "34px 40px minmax(180px,1.5fr) 110px 110px minmax(220px,1.3fr) 110px";
              let n = 0;
              return (
              <div style={{ flex: 1, overflow: "auto", padding: "0.4rem 1.4rem 1rem", background: "#FAF7F0" }}>
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "10px 12px", borderBottom: `1px solid ${T.ink}`, fontSize: "0.66rem", letterSpacing: "0.18em", color: T.muted, position: "sticky", top: 0, background: "#FAF7F0", zIndex: 1 }}>
                  <span /><span>NO.</span><span>PARTICULARS</span><span style={{ textAlign: "right" }}>DR {cur()}</span><span style={{ textAlign: "right" }}>CR {cur()}</span><span>LEDGER</span><span />
                </div>
                {phase === "suggesting" && <div style={{ fontSize: "0.8rem", fontStyle: "italic", color: T.goldInk, padding: "8px 2px" }}>Still reading rows — suggestions fill in as it goes.</div>}
                {(["look", "ready"] as const).map(section => {
                  const list = groups.filter(g => (section === "look") === needsLook(g));
                  if (!list.length) return null;
                  return (
                    <div key={section} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px", fontStyle: "italic", fontSize: "0.88rem", color: section === "look" ? T.goldInk : T.pos }}>
                        {section === "look" ? "Needs your choice" : "Ready to apply"}
                        <span style={{ fontStyle: "normal", fontSize: "0.72rem", padding: "1px 9px", borderRadius: 999, background: section === "look" ? "#F6E3B4" : "#D8EFE4" }}>{list.length}</span>
                        <span style={{ flex: 1, height: 1, background: section === "look" ? "#EBD9A8" : "#CFE3D8" }} />
                      </div>
                      {list.map(g => {
                        n++;
                        const ledger = ledgerFor(g.key, suggestFor(g));
                        const now = groupState(g.rowIds);
                        const applied = now !== "none" && now !== "mixed" && now.toLowerCase() === ledger.trim().toLowerCase();
                        const allSel = g.rowIds.every(id => selected.has(id));
                        const note = CONTROL.test(g.suggested.trim()) ? `New party — create its own ledger under Sundry ${g.dir === "out" ? "Creditors" : "Debtors"}.`
                          : GATEWAY.test(g.label) ? "Gateway payout usually settles sales already booked — consider the gateway ledger."
                          : g.reason ? `${g.source === "history" ? "Matched · " : ""}${g.reason}` : "";
                        return (
                          <div key={g.key} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", padding: "12px", borderRadius: 10, border: `1px solid ${section === "look" ? "#EFDFB4" : T.line}`, background: section === "look" ? T.look : T.paper }}>
                            <input type="checkbox" aria-label={`Select ${g.label}`} checked={allSel} onChange={() => setSelected(s => { const x = new Set(s); g.rowIds.forEach(id => allSel ? x.delete(id) : x.add(id)); return x; })} />
                            <span style={{ fontStyle: "italic", color: T.goldInk }}>{String(n).padStart(2, "0")}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "1.05rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                              <div style={{ fontSize: "0.76rem", color: T.muted }}>
                                <span style={{ color: g.dir === "out" ? T.neg : T.pos }}>{g.dir === "out" ? "↑ Paid out" : "↓ Received"}</span> · {g.count} transaction{g.count > 1 ? "s" : ""} ·{" "}
                                <button onClick={() => { setGroupFilter({ label: g.label, ids: new Set(g.rowIds) }); setView("rows"); setFilter("all"); }} style={{ background: "none", border: "none", color: T.ink, padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline" }}>see rows</button>
                              </div>
                            </div>
                            <span style={{ textAlign: "right", color: T.neg, fontVariantNumeric: "tabular-nums" }}>{g.dir === "out" ? fmt(g.total) : ""}</span>
                            <span style={{ textAlign: "right", color: T.pos, fontVariantNumeric: "tabular-nums" }}>{g.dir === "out" ? "" : fmt(g.total)}</span>
                            <div style={{ minWidth: 0 }}>
                              <input list="sm-ledgers" value={ledger} onChange={e => setGroupLedger(m => ({ ...m, [g.key]: e.target.value }))} placeholder="Choose or type ledger"
                                style={{ width: "100%", height: 38, borderRadius: 999, border: `1px solid ${!ledger.trim() ? "#E3C27A" : T.line}`, background: "#FFFFFF", padding: "0 16px", fontFamily: SERIF, fontSize: "0.92rem", outline: "none" }} />
                              {(note || isNew(ledger) || now === "mixed") && <div style={{ fontSize: "0.72rem", fontStyle: "italic", color: section === "look" ? T.goldInk : "#2F5D8A", marginTop: 4 }}>
                                {note}{isNew(ledger) && !CONTROL.test(g.suggested.trim()) ? `${note ? " · " : ""}new ledger` : ""}{now === "mixed" ? " · rows have different ledgers now" : ""}
                              </div>}
                            </div>
                            <button onClick={() => applyGroup(g.rowIds, ledger)} disabled={!ledger.trim()}
                              style={{ height: 38, padding: "0 16px", borderRadius: 999, cursor: "pointer", fontFamily: SERIF, fontSize: "0.88rem", opacity: ledger.trim() ? 1 : 0.5, whiteSpace: "nowrap",
                                background: applied ? "transparent" : section === "look" ? T.green : "transparent", color: applied ? T.pos : section === "look" ? "#FFFFFF" : T.ink,
                                border: `1px solid ${applied ? T.pos : section === "look" ? T.green : T.ink}`, letterSpacing: applied ? "0.12em" : 0 }}>
                              {applied ? "✓ APPLIED" : g.count > 1 ? `Apply to ${g.count}` : "Apply"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              );
            })()}

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
            <div style={{ borderTop: `1px solid ${T.line}`, padding: "0.8rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.6rem", background: "#F1EADB" }}>
              {newLedgers.size > 0 && (
                <div style={{ display: "flex", gap: "0.5rem 1rem", flexWrap: "wrap", alignItems: "center", fontSize: "0.78rem" }}>
                  <span style={{ color: unsureHeads.length ? AMBER : MUTED, fontWeight: 700 }}>{unsureHeads.length ? "🤔 Choose a group for new ledgers:" : "New ledgers will be created:"}</span>
                  {[...newLedgers.entries()].map(([name, key]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%" }}>
                      <b style={{ minWidth: 140, color: unsureHeads.includes(name) ? AMBER : TEXT }}>{name}</b>
                      <GroupChips compact value={key} onChange={k => setHeads(h => ({ ...h, [name]: k }))} />
                    </div>
                  ))}
                  {unsureHeads.length > 0 && (
                    <button onClick={() => setHeads(h => ({ ...h, ...Object.fromEntries(unsureHeads.map(n => [n, newLedgers.get(n)!])) }))} style={{ ...chip(true, AMBER) }}>✓ Use these groups</button>
                  )}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", fontStyle: "italic", color: progress.startsWith("✓") ? T.pos : T.muted }}>
                  {progress || (sel.length ? `${sel.length} to post · ${cur()}${fmt(sel.reduce((s, r) => s + r.debit + r.credit, 0))}` : "Tick the entries to post · click a column heading to sort")}
                  {selMissing > 0 && <span style={{ color: AMBER }}> · {selMissing} selected without a ledger</span>}
                  {!bankLedger.trim() && <span style={{ color: AMBER }}> · choose the bank ledger at the top</span>}
                </span>
                <div style={{ flex: 1 }} />
                {view === "groups" && <button onClick={applyAllSuggestions} disabled={!groups.some(g => !needsLook(g))} style={{ height: 42, padding: "0 20px", borderRadius: 999, border: `1px solid ${T.green}`, background: "transparent", color: T.ink, fontFamily: SERIF, fontSize: "0.95rem", cursor: "pointer" }}>Apply all ready · {groups.filter(g => !needsLook(g)).length}</button>}
                <button onClick={onClose} disabled={posting} style={{ height: 42, padding: "0 20px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.paper, color: T.ink, fontFamily: SERIF, fontSize: "0.95rem", cursor: "pointer" }}>Close</button>
                <button onClick={postSelected} disabled={posting || !sel.length || selMissing > 0 || !bankLedger.trim() || unsureHeads.length > 0}
                  style={{ background: T.gold, color: T.ink, border: `1px solid ${T.goldInk}`, height: 42, padding: "0 26px", borderRadius: 999, fontSize: "0.98rem", cursor: "pointer", fontFamily: SERIF, opacity: posting || !sel.length || selMissing > 0 || !bankLedger.trim() || unsureHeads.length > 0 ? 0.45 : 1 }}>
                  {posting ? "Posting…" : sel.length ? `Post ${sel.length} selected` : "Post selected"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
