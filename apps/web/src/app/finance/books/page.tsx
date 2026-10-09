"use client";
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTally } from "@/lib/tallyConnection";
import TallyBar from "@/components/TallyBar";
import { tallyFetch, parseTallyVouchers, monthsInRange, VOUCHER_FETCH_XML } from "@/lib/tallyUtils";
import { explainTallyError, eduDateOk, parseImportReply, licenseXml, isEducational } from "@/lib/integrations/tally";
import { type PushState, pushView, isPushedHere, fromSyncRows } from "@/lib/integrations/pushStatus";
import { readActiveBusiness } from "@/lib/activeBusiness";

type FY = { id: string; label: string; is_current: boolean; start_date: string; end_date: string };
type Line = { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string } | null };
type Journal = {
  id: string; entry_no: string; date: string; narration: string; type: string; status: string;
  total_debit: number | null; total_credit: number | null; reference_no: string | null; ai_generated: boolean | null;
  fw_fin_journal_lines: Line[];
};
type Source = "chat" | "tally" | "manual";

const BG = "#F5F6FA", CARD = "#FFFFFF", BORDER = "rgba(20,26,58,0.12)";
const GOLD = "#232A63", GREEN = "#0B7A55", RED = "#C2321F", BLUE = "#1F5EFF", PURPLE = "#5B4BC4", AMBER = "#8A5A00";
const TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.75)";
const MONO = "'IBM Plex Mono', 'Fira Code', monospace";
const fmt = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_LABEL: Record<string, string> = {
  journal: "Journal", payment: "Payment", receipt: "Receipt", sales: "Sales", purchase: "Purchase",
  contra: "Contra", debit_note: "Debit Note", credit_note: "Credit Note", expense: "Expense",
};
const LEDGER_GROUP: Record<string, string> = {
  asset: "Current Assets", bank: "Bank Accounts", cash: "Cash-in-Hand", liability: "Current Liabilities",
  equity: "Capital Account", income: "Sales Accounts", expense: "Indirect Expenses", purchase: "Purchase Accounts",
  cost_of_goods: "Direct Expenses", tax: "Duties & Taxes", loan: "Loans (Liability)", fixed_asset: "Fixed Assets",
};
const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xmlDec = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

const sourceOf = (j: Journal): Source => j.ai_generated ? "chat" : j.entry_no?.startsWith("TLY-") ? "tally" : "manual";
const amountOf = (j: Journal) => j.total_debit || (j.fw_fin_journal_lines ?? []).reduce((s, l) => s + (l.dr_amount || 0), 0);

export default function BooksPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [fys, setFys] = useState<FY[]>([]);
  const [fy, setFy] = useState<FY | null>(null);
  const [allYears, setAllYears] = useState(false);
  const [ready, setReady] = useState(false);
  const [totalAll, setTotalAll] = useState(0);
  // Entries found in Tally itself: by [FW entry-no] tag, or same date + amount + a shared ledger
  const [inTally, setInTally] = useState<Record<string, { vno: string; how: "tag" | "match" }>>({});
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [filter, setFilter] = useState<"all" | "chat" | "pending" | "pushed">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushed, setPushed] = useState<Record<string, PushState>>({});

  // Tally connection
  // The app-wide Tally connection (port and company are chosen on the Tally page)
  const tally = useTally();
  const port = tally.port, conn = tally.status, company = tally.company;
  const [pushing, setPushing] = useState(false);
  const eduMode = tally.educational;
  const [pushMsg, setPushMsg] = useState("");

  const pushKey = bizId ? `fw_tally_pushed_${bizId}` : "";

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f === "chat" || f === "pending" || f === "pushed") setFilter(f);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      try { setPushed(JSON.parse(localStorage.getItem(`fw_tally_pushed_${saved}`) ?? "{}")); } catch { /* */ }
      // Server copy wins: the same push status on every device
      fetch(`/api/finance/integrations/sync?business_id=${saved}&provider=tally`).then(r => r.json()).then(d => {
        const server = fromSyncRows(d.rows ?? []);
        if (Object.keys(server).length) setPushed(prev => ({ ...prev, ...server }));
      }).catch(() => { /* browser copy still works */ });
      const [{ data: biz }, { data: fyData }] = await Promise.all([
        supabase.from("fw_fin_businesses").select("name").eq("id", saved).single(),
        supabase.from("fw_fin_financial_years").select("id,label,is_current,start_date,end_date").eq("business_id", saved).order("start_date", { ascending: false }),
      ]);
      if (biz) setBizName(biz.name);
      setFys(fyData ?? []);
      // Open the year that contains today; if none does, show every year
      const today = new Date().toISOString().slice(0, 10);
      const containing = (fyData ?? []).find(f => f.start_date <= today && (f.end_date ?? "9999") >= today);
      if (containing) setFy(containing); setAllYears(true); // open on every year; the dropdown narrows it
      setReady(true);
    });
  }, []);

  const load = useCallback(async () => {
    if (!bizId || !ready || (!allYears && !fy)) return;
    setLoading(true); setLoadErr(""); setSelected(new Set()); setInTally({}); setCheckMsg("");
    const all: Journal[] = [];
    // Small pages: a big page with every line and ledger name can hit the database time limit
    let size = 200;
    for (let from = 0; from < 50000; from += size) {
      let q = supabase.from("fw_fin_journals")
        .select("id,entry_no,date,narration,type,status,total_debit,total_credit,reference_no,ai_generated,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name))")
        .eq("business_id", bizId);
      if (!allYears && fy) q = q.gte("date", fy.start_date).lte("date", fy.end_date);
      const { data, error } = await q.order("date", { ascending: false }).order("entry_no", { ascending: false }).range(from, from + size - 1);
      if (error && size > 50) { size = 50; from -= size; continue; }            // retry this page smaller
      if (error) { console.error("books load failed", { bizId, from, error }); setLoadErr(`We couldn't load your entries right now (${error.message || error.code || "database error"}).`); break; }
      all.push(...((data ?? []) as unknown as Journal[]));
      if (!data || data.length < size) break;
    }
    setJournals(all); setLoading(false);
    // Entries outside the selected year are easy to miss (e.g. last year's bank statement) — count them so the page can say so
    if (!allYears) {
      const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", bizId);
      setTotalAll(Math.max(0, (count ?? 0) - all.length));
    } else setTotalAll(0);
  }, [bizId, fy, allYears, ready]);

  useEffect(() => { load(); }, [load]);

  function savePushed(next: Record<string, PushState>) {
    setPushed(next);
    try { localStorage.setItem(pushKey, JSON.stringify(next)); } catch { /* */ }
  }

  // "Pushed" means pushed to the company open in Tally now (see pushStatus.ts)
  const isPushed = (id: string) => !!inTally[id] || isPushedHere(pushed[id], company);

  // Reads Tally's vouchers for the loaded dates and marks FreWork entries already there
  const checkTally = useCallback(async () => {
    const own = journals.filter(j => sourceOf(j) !== "tally" && j.status === "posted");
    if (conn !== "connected" || !own.length) return;
    setChecking(true); setCheckMsg("Checking Tally for entries already there…");
    const dates = own.map(j => j.date.slice(0, 10)).sort();
    const months = monthsInRange(dates[0], dates[dates.length - 1]);
    const tagged = new Map<string, string>();
    const byKey = new Map<string, { vno: string; ledgers: Set<string> }[]>();
    let read = 0, failedMonths = 0;
    for (let i = 0; i < months.length; i++) {
      setCheckMsg(`Reading Tally vouchers ${months[i].label} (${i + 1}/${months.length})…`);
      const xml = VOUCHER_FETCH_XML(months[i].from.replace(/-/g, ""), months[i].to.replace(/-/g, ""))
        .replace("<SVEXPORTFORMAT>", company ? `<SVCURRENTCOMPANY>${xmlEsc(company)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>` : "<SVEXPORTFORMAT>");
      try {
        const vouchers = parseTallyVouchers(await (await tallyFetch(`http://localhost:${port}`, xml, 30000)).text());
        for (const v of vouchers) {
          read++;
          const narr = xmlDec(v.narration);
          const tag = narr.match(/\[FW ([^\]]+)\]/)?.[1];
          if (tag) tagged.set(tag.trim(), v.voucherNumber || v.voucherType);
          const amt = Math.round(v.lines.filter(l => l.isDeemed).reduce((s, l) => s + l.amount, 0) || v.lines.reduce((s, l) => s + l.amount, 0) / 2);
          const key = `${v.date}|${amt}`;
          const list = byKey.get(key) ?? [];
          list.push({ vno: v.voucherNumber || v.voucherType, ledgers: new Set(v.lines.map(l => xmlDec(l.ledgerName).toLowerCase())) });
          byKey.set(key, list);
        }
      } catch { failedMonths++; }
    }
    const found: Record<string, { vno: string; how: "tag" | "match" }> = {};
    for (const j of own) {
      const t = tagged.get(j.entry_no);
      if (t) { found[j.id] = { vno: t, how: "tag" }; continue; }
      const list = byKey.get(`${j.date.slice(0, 10)}|${Math.round(amountOf(j))}`);
      if (!list?.length) continue;
      const names = (j.fw_fin_journal_lines ?? []).map(l => (l.fw_fin_chart_of_accounts?.name ?? "").toLowerCase());
      const idx = list.findIndex(c => names.some(n => n && c.ledgers.has(n)));
      if (idx >= 0) { found[j.id] = { vno: list[idx].vno, how: "match" }; list.splice(idx, 1); }
    }
    setInTally(found);
    const n = Object.keys(found).length;
    // A "pushed" mark that Tally doesn't confirm (e.g. pushed to another company) is cleared, so Push all sends it again
    let stale = 0;
    if (!failedMonths) {
      const gone = own.filter(j => !found[j.id] && isPushedHere(pushed[j.id], company)).map(j => j.id);
      stale = gone.length;
      if (stale) {
        // functional update: no dependency on pushed, so the check never re-runs itself
        setPushed(prev => { const next = { ...prev }; for (const id of gone) delete next[id]; try { localStorage.setItem(pushKey, JSON.stringify(next)); } catch { /* */ } return next; });
        fetch("/api/finance/integrations/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, provider: "tally", target: company, results: gone.map(id => ({ journal_id: id, status: "failed", error: `Not found in Tally company ${company || "open"} — push again` })) }) }).catch(() => { /* local copy cleared */ });
      }
    }
    setCheckMsg(`Checked ${read} Tally vouchers in ${company || "the open company"}: ${n} of ${own.length} FreWork entries are already in Tally.${stale ? ` ${stale} marked "pushed" earlier aren't in this company — they're back under "Not in Tally"; use Push all to send them.` : ""}${failedMonths ? ` (${failedMonths} month${failedMonths > 1 ? "s" : ""} couldn't be read)` : ""}`);
    setChecking(false);
  }, [journals, conn, company, port]);

  useEffect(() => { if (conn === "connected" && company && !loading) checkTally(); }, [conn, company, loading, checkTally]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return journals.filter(j => {
      if (filter === "chat" && sourceOf(j) !== "chat") return false;
      if (filter === "pending" && (isPushed(j.id) || sourceOf(j) === "tally" || j.status !== "posted")) return false;
      if (filter === "pushed" && !isPushed(j.id)) return false;
      if (!q) return true;
      return [j.entry_no, j.narration, j.reference_no, ...(j.fw_fin_journal_lines ?? []).map(l => l.fw_fin_chart_of_accounts?.name)]
        .some(v => (v ?? "").toLowerCase().includes(q));
    });
  }, [journals, filter, search, pushed, inTally]);

  const counts = useMemo(() => ({
    all: journals.length,
    chat: journals.filter(j => sourceOf(j) === "chat").length,
    pending: journals.filter(j => !isPushed(j.id) && sourceOf(j) !== "tally" && j.status === "posted").length,
    pushed: journals.filter(j => isPushed(j.id)).length,
  }), [journals, pushed, inTally]);

  // ── Tally ─────────────────────────────────────────────────────────────────
  async function push(requested: string[]) {
    if (!bizId || conn !== "connected" || !requested.length) return;
    // In Educational mode Tally rejects other dates, so don't send them at all
    const blocked = eduMode ? requested.filter(id => !eduDateOk(journals.find(j => j.id === id)?.date ?? "")) : [];
    const ids = requested.filter(id => !blocked.includes(id));
    if (!ids.length) {
      setPushMsg(`Not sent: Tally is in Educational mode and only accepts entries dated the 1st, 2nd or 31st. ${blocked.length} selected entr${blocked.length === 1 ? "y is" : "ies are"} on other dates. Activate your TallyPrime licence (or open a licensed Tally) and push again.`);
      return;
    }
    setPushing(true); setPushMsg("");
    const tallyUrl = `http://localhost:${port}`;
    const next = { ...pushed };
    let ok = 0, failed = 0, newLedgers = 0;
    try {
      for (let b = 0; b < ids.length; b += 50) {
        const batch = ids.slice(b, b + 50);
        setPushMsg(`Preparing ${b + 1}–${b + batch.length} of ${ids.length}…`);
        const res = await fetch("/api/finance/tally-push", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journal_ids: batch, business_id: bizId, company_name: company }),
        });
        const data = await res.json();
        if (!res.ok || !data.vouchers) throw new Error(data.error ?? "Could not prepare vouchers");

        // Create any ledgers Tally doesn't have yet (Tally ignores ones that exist)
        const ledgers = (data.all_ledger_names ?? []) as { name: string; type: string; group?: string }[];
        if (ledgers.length) {
          const masters = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>${company ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xmlEsc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>${ledgers.map(l => `<TALLYMESSAGE><LEDGER NAME="${xmlEsc(l.name)}" ACTION="Create"><NAME>${xmlEsc(l.name)}</NAME><PARENT>${xmlEsc(l.group ?? LEDGER_GROUP[l.type] ?? "Indirect Expenses")}</PARENT></LEDGER></TALLYMESSAGE>`).join("")}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
          try {
            const mt = await (await tallyFetch(tallyUrl, masters, 15000)).text();
            newLedgers += parseInt(mt.match(/<CREATED>\s*(\d+)/i)?.[1] ?? "0", 10);
          } catch { /* vouchers will report missing ledgers */ }
        }

        for (const v of data.vouchers as { id: string; entry_no: string; xml: string; date: string; opening?: boolean }[]) {
          // Opening balances replace the ones already on Tally's ledgers — make sure that's intended
          if (v.opening && !window.confirm(`${v.entry_no} is your opening balances entry. It will SET the opening balance of each ledger in Tally${company ? ` company "${company}"` : ""} (replacing any opening balance already there), not create a voucher.\n\nDo this only if the Tally company's "Books beginning from" date is ${v.date} — e.g. a new company for this year.\n\nContinue?`)) { failed++; next[v.id] = { error: "Skipped — opening balances not sent to Tally." }; continue; }
          setPushMsg(`Pushing ${v.entry_no} (${ok + failed + 1}/${ids.length})…`);
          try {
            const text = await (await tallyFetch(tallyUrl, v.xml, 15000)).text();
            const reply = parseImportReply(text);
            if (!reply.ok) { next[v.id] = { error: explainTallyError(reply.error ?? "Tally rejected the voucher", eduMode, port), target: company || null }; failed++; }
            else { next[v.id] = { at: new Date().toISOString(), target: company || null }; ok++; }
          } catch (e) {
            next[v.id] = { error: explainTallyError(e instanceof Error ? e.message : "Network error", eduMode, port), target: company || null }; failed++;
          }
          await new Promise(r => setTimeout(r, 50));
        }
      }
      const ledgerNote = newLedgers ? ` ${newLedgers} new ledger${newLedgers > 1 ? "s" : ""} created in Tally.` : "";
      const heldNote = blocked.length ? ` ${blocked.length} not sent — Educational mode only accepts the 1st, 2nd and 31st.` : "";
      setPushMsg(failed ? `${ok} pushed to Tally, ${failed} failed — reasons are shown on each row.${ledgerNote}${heldNote}` : `✓ ${ok} entr${ok === 1 ? "y" : "ies"} pushed to Tally.${ledgerNote}${heldNote}`);
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : "Push failed");
    }
    savePushed(next); setSelected(new Set()); setPushing(false);
    const results = ids.filter(id => next[id]).map(id => "at" in next[id]
      ? { journal_id: id, status: "pushed" as const }
      : { journal_id: id, status: "failed" as const, error: (next[id] as { error: string }).error });
    if (results.length) fetch("/api/finance/integrations/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, provider: "tally", target: company, results }) }).catch(() => { /* kept locally */ });
  }

  const selectable = visible.filter(j => j.status === "posted");
  const allChecked = selectable.length > 0 && selectable.every(j => selected.has(j.id));
  const selectedTallyOrigin = [...selected].filter(id => sourceOf(journals.find(j => j.id === id)!) === "tally").length;
  const pendingIds = journals.filter(j => !isPushed(j.id) && sourceOf(j) !== "tally" && j.status === "posted").map(j => j.id);

  const chip = (active: boolean, color = GOLD): React.CSSProperties => ({
    background: active ? `${color}22` : "#FFFFFF", border: `1px solid ${active ? color + "66" : BORDER}`,
    color: active ? color : MUTED, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: "0.78rem", fontFamily: "inherit", whiteSpace: "nowrap",
  });
  const btn = (bg: string, fg = "#F5F6FA", disabled = false): React.CSSProperties => ({
    background: bg, color: fg, border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: "0.8rem",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit", whiteSpace: "nowrap",
  });

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.6rem", height: 54, position: "sticky", top: 0, background: "rgba(255,255,255,0.97)", zIndex: 20, flexWrap: "wrap" }}>
        <Link href="/finance" style={{ color: GOLD, fontWeight: 800, textDecoration: "none" }}>FreWork</Link>
        <span style={{ color: MUTED }}>›</span>
        <span style={{ fontWeight: 700 }}>📚 Books</span>
        {bizName && <span style={{ fontSize: "0.72rem", color: MUTED, border: `1px solid ${BORDER}`, padding: "2px 8px", borderRadius: 20 }}>{bizName}</span>}
        <div style={{ flex: 1 }} />
        {[["/finance/chat-book", "🤖 Chat entry"], ["/finance/ledger", "Ledger"], ["/finance/reports?tab=trial_balance", "Trial Balance"], ["/finance/reports?tab=profit_loss", "P&L"], ["/finance/reports?tab=balance_sheet", "Balance Sheet"]].map(([href, label]) => (
          <Link key={href} href={href} style={{ fontSize: "0.75rem", color: href.includes("chat") ? GOLD : MUTED, textDecoration: "none", padding: "4px 10px", border: `1px solid ${BORDER}`, borderRadius: 7 }}>{label}</Link>
        ))}
        <select value={allYears ? "all" : fy?.id ?? ""} onChange={e => { if (e.target.value === "all") setAllYears(true); else { setAllYears(false); setFy(fys.find(f => f.id === e.target.value) ?? null); } }} style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "5px 10px", borderRadius: 8, fontSize: "0.78rem", fontFamily: "inherit" }}>
          <option value="all">All years</option>
          {fys.map(f => <option key={f.id} value={f.id}>FY {f.label}</option>)}
        </select>
      </nav>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "1.25rem 1.5rem 3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Tally: shared connection; settings live on the Tally page */}
        <TallyBar preferName={bizName} returnTo="/finance/books">
          <a href="/finance/tally?redirect=/finance/books" title="Bring Tally's vouchers into FreWork for analysis. Entries FreWork pushed to Tally are skipped." style={{ fontSize: "0.8rem", color: "#0F2B25", fontWeight: 700, textDecoration: "none", border: "1px solid #D8CDB4", borderRadius: 9, height: 34, padding: "0 12px", display: "flex", alignItems: "center" }}>⬇ Import from Tally</a>
          <button onClick={() => push(pendingIds)} disabled={conn !== "connected" || pushing || !pendingIds.length} style={btn(GREEN, "#F5F6FA", conn !== "connected" || pushing || !pendingIds.length)}>
            ⇪ Push all not-yet-pushed ({pendingIds.length})
          </button>
        </TallyBar>
        {conn === "connected" && eduMode && (
          <div style={{ fontSize: "0.8rem", color: AMBER, background: "rgba(184,120,0,0.07)", border: "1px solid rgba(184,120,0,0.3)", borderRadius: 8, padding: "0.6rem 0.9rem", lineHeight: 1.55 }}>
            ⚠ <strong>Tally is running in Educational mode.</strong> It only accepts vouchers dated the 1st, 2nd or 31st of a month, and rejects every other date as &quot;Voucher date is missing&quot;.
            Activate your TallyPrime licence (or open a licensed Tally) to push these entries. FreWork won&apos;t change your entry dates to get around this.
          </div>
        )}
        {conn === "connected" && (checkMsg || checking) && (<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem", color: checking ? BLUE : MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0.5rem 0.9rem" }}><span>{checking ? "⟳ " : "✓ "}{checkMsg}</span><div style={{ flex: 1 }} />{!checking && <button onClick={checkTally} style={btn("#FFFFFF", MUTED)}>Check Tally again</button>}</div>)}
        {pushMsg && <div style={{ fontSize: "0.82rem", color: pushMsg.startsWith("✓") ? GREEN : pushing ? BLUE : AMBER, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0.55rem 0.9rem" }}>{pushMsg}</div>}

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button style={chip(filter === "all")} onClick={() => setFilter("all")}>All entries ({counts.all})</button>
          <button style={chip(filter === "chat", PURPLE)} onClick={() => setFilter("chat")}>🤖 From chat ({counts.chat})</button>
          <button style={chip(filter === "pending", AMBER)} onClick={() => setFilter("pending")}>Not in Tally ({counts.pending})</button>
          <button style={chip(filter === "pushed", GREEN)} onClick={() => setFilter("pushed")}>Pushed to Tally ({counts.pushed})</button>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entry no, narration, account…" style={{ width: 280, background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "7px 12px", borderRadius: 8, fontSize: "0.82rem", fontFamily: "inherit" }} />
        </div>

        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(31,94,255,0.08)", border: "1px solid rgba(31,94,255,0.25)", borderRadius: 10, padding: "0.55rem 0.9rem", fontSize: "0.82rem", flexWrap: "wrap" }}>
            <strong style={{ color: BLUE }}>{selected.size} selected</strong>
            {selectedTallyOrigin > 0 && <span style={{ color: AMBER }}>⚠ {selectedTallyOrigin} came from Tally — pushing them back will duplicate them in Tally.</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => setSelected(new Set())} style={btn("#FFFFFF", MUTED)}>Clear</button>
            <button onClick={() => push([...selected])} disabled={conn !== "connected" || pushing} title={conn !== "connected" ? "Connect to Tally first" : ""} style={btn(GREEN, "#F5F6FA", conn !== "connected" || pushing)}>
              {pushing ? "Pushing…" : `⇪ Push ${selected.size} to Tally`}
            </button>
          </div>
        )}

        {/* Table */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: MUTED }}>Loading entries…</div>
          ) : loadErr ? (
            <div style={{ padding: "3rem", textAlign: "center", color: MUTED, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}><span>{loadErr}</span><button onClick={load} style={btn(GOLD)}>Try again</button></div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: MUTED, lineHeight: 1.8 }}>
              No entries {filter !== "all" ? "match this filter" : allYears ? "yet" : `in ${fy?.label ?? "this year"}`}.<br />
              <Link href="/finance/chat-book" style={{ color: GOLD }}>Book a transaction by chat →</Link>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ padding: "0.55rem 0.75rem", width: 30 }}>
                    <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(selectable.map(j => j.id)))} />
                  </th>
                  {["Date", "Entry No", "Type", "Narration", "Accounts", "Amount", "Source", "Tally"].map((h, i) => (
                    <th key={h} style={{ padding: "0.55rem 0.75rem", textAlign: i === 5 ? "right" : "left", color: MUTED, fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(j => {
                  const src = sourceOf(j);
                  const p = pushed[j.id];
                  const pv = pushView(p, company);
                  const lines = j.fw_fin_journal_lines ?? [];
                  const drNames = lines.filter(l => l.dr_amount > 0).map(l => l.fw_fin_chart_of_accounts?.name ?? "?");
                  const crNames = lines.filter(l => l.cr_amount > 0).map(l => l.fw_fin_chart_of_accounts?.name ?? "?");
                  const open = expanded === j.id;
                  return (
                    <Fragment key={j.id}>
                      <tr onClick={() => setExpanded(open ? null : j.id)} style={{ borderBottom: `1px solid rgba(20,26,58,0.10)`, cursor: "pointer", background: p && "error" in p ? "rgba(194,50,31,0.05)" : open ? "#FFFFFF" : "transparent" }}>
                        <td style={{ padding: "0.5rem 0.75rem" }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" disabled={j.status !== "posted"} checked={selected.has(j.id)} onChange={() => setSelected(s => { const n = new Set(s); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; })} />
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED, whiteSpace: "nowrap" }}>{new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                        <td style={{ padding: "0.5rem 0.75rem", fontFamily: MONO, fontSize: "0.72rem", color: GOLD, whiteSpace: "nowrap" }}>{j.entry_no}</td>
                        <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>{TYPE_LABEL[j.type] ?? j.type}{j.status !== "posted" && <span style={{ color: AMBER, fontSize: "0.68rem" }}> · {j.status}</span>}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: MUTED, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.narration}>{j.narration}</td>
                        <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.76rem", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`Dr ${drNames.join(", ")} / Cr ${crNames.join(", ")}`}>
                          <span style={{ color: RED }}>Dr</span> {drNames.join(", ")} <span style={{ color: MUTED }}>/</span> <span style={{ color: GREEN }}>Cr</span> {crNames.join(", ")}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontFamily: MONO, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(amountOf(j))}</td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          {src === "chat" ? <span style={{ fontSize: "0.68rem", fontWeight: 700, color: PURPLE, background: "rgba(91,75,196,0.12)", padding: "2px 7px", borderRadius: 5 }}>🤖 Chat</span>
                            : src === "tally" ? <span style={{ fontSize: "0.68rem", fontWeight: 700, color: BLUE, background: "rgba(31,94,255,0.12)", padding: "2px 7px", borderRadius: 5 }}>From Tally</span>
                            : <span style={{ fontSize: "0.68rem", color: MUTED }}>Manual</span>}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>
                          {src === "tally" ? <span style={{ fontSize: "0.7rem", color: MUTED }}>Came from Tally</span>
                            : inTally[j.id] ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: GREEN }} title={inTally[j.id].how === "tag" ? "Found in Tally by its FreWork entry number" : "Tally has a voucher on the same date, same amount and a shared ledger"}>✓ In Tally{inTally[j.id].vno ? ` · Vch ${inTally[j.id].vno}` : ""}{inTally[j.id].how === "match" ? " (likely)" : ""}</span>
                            : pv.kind === "pushed" ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: GREEN }} title={`${new Date(pv.at).toLocaleString("en-IN")}${pv.companyKnown ? "" : " · company not recorded — Check Tally confirms it"}`}>✓ Pushed {new Date(pv.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                            : pv.kind === "elsewhere" ? <span style={{ display: "inline-flex", flexDirection: "column" }} title={`Pushed to Tally company "${pv.company}" on ${new Date(pv.at).toLocaleString("en-IN")}. Not pushed to the company open now.`}><span style={{ fontSize: "0.7rem", color: AMBER }}>Not pushed</span><span style={{ fontSize: "0.64rem", color: MUTED }}>Pushed to {pv.company}</span></span>
                            : p && "error" in p ? <span style={{ display: "inline-flex", flexDirection: "column", maxWidth: 260, whiteSpace: "normal" }} title={p.error}><span style={{ fontSize: "0.7rem", fontWeight: 700, color: RED }}>✗ Failed</span><span style={{ fontSize: "0.66rem", color: MUTED, lineHeight: 1.35 }}>{explainTallyError(p.error, eduMode)}</span></span>
                            : <span style={{ fontSize: "0.7rem", color: AMBER }}>Not pushed</span>}
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER}` }}>
                          <td />
                          <td colSpan={8} style={{ padding: "0.6rem 0.75rem 0.9rem" }}>
                            {p && "error" in p && <div style={{ color: RED, fontSize: "0.78rem", marginBottom: 8 }}>Tally said: {p.error}</div>}
                            <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 480 }}>
                              <thead><tr>{["Account", "Debit", "Credit"].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "3px 14px 3px 0", color: MUTED, fontSize: "0.64rem", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
                              <tbody>
                                {lines.map((l, i) => (
                                  <tr key={i}>
                                    <td style={{ padding: "3px 14px 3px 0" }}>{l.fw_fin_chart_of_accounts?.name ?? "?"}</td>
                                    <td style={{ padding: "3px 14px 3px 0", textAlign: "right", fontFamily: MONO, color: l.dr_amount ? RED : MUTED }}>{l.dr_amount ? fmt(l.dr_amount) : "—"}</td>
                                    <td style={{ padding: "3px 0", textAlign: "right", fontFamily: MONO, color: l.cr_amount ? GREEN : MUTED }}>{l.cr_amount ? fmt(l.cr_amount) : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: "flex", gap: "1rem", marginTop: 10, fontSize: "0.76rem" }}>
                              <Link href={`/finance/journals?id=${j.id}`} style={{ color: BLUE, textDecoration: "none" }}>Open in Journals →</Link>
                              {j.reference_no && <span style={{ color: MUTED }}>Ref: {j.reference_no}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: "0.72rem", color: MUTED }}>
          Every entry stays in FreWork whether or not it&apos;s pushed. &quot;From Tally&quot; entries were imported from Tally and are skipped by &quot;Push all&quot; to avoid duplicates; likewise, importing from Tally skips vouchers FreWork pushed there. Push status is saved to your account, so it shows the same on every device.
        </div>
      </div>
    </div>
  );
}
