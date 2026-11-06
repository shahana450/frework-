"use client";
import { cur, activeMoney } from "@/lib/money";
import { matchToTally, tallyGuidFor } from "@/lib/tallyMatch";
import { verifyOpenCompany, PUSHED_EVENT } from "@/lib/tallyPushRun";
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTally, connectTally } from "@/lib/tallyConnection";
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

const BG = "#F4EFE4", CARD = "#FFFFFF", BORDER = "rgba(16,36,31,0.12)";
const GOLD = "#12352D", GREEN = "#0B7A55", RED = "#B4321F", BLUE = "#12352D", PURPLE = "#5B4BC4", AMBER = "#9A6B22";
const TEXT = "#10241F", MUTED = "rgba(16,36,31,0.75)";
const MONO = "'IBM Plex Mono', 'Fira Code', monospace";
const fmt = (n: number) => cur() + (n ?? 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [inTally, setInTally] = useState<Record<string, { vno: string; how: "guid" | "match" }>>({});
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [filter, setFilter] = useState<"all" | "chat" | "pending" | "pushed">("all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");          // "YYYY-MM", or "" for every month in the year
  const [shown, setShown] = useState(50);          // entries drawn; "Load more" adds 50
  useEffect(() => { setShown(50); }, [filter, search, month]);
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
    // Read on the server: one access check instead of row security on every journal, line and ledger
    const qs = new URLSearchParams({ business_id: bizId });
    if (!allYears && fy) { qs.set("from", fy.start_date); if (fy.end_date) qs.set("to", fy.end_date); }
    const r = await fetch(`/api/finance/books?${qs}`).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { console.error("books load failed", { bizId, status: r?.status, d }); setLoadErr(d.error ?? "We couldn't load your entries right now."); setJournals([]); setLoading(false); return; }
    const all = (d.journals ?? []) as Journal[];
    setJournals(all); setLoading(false);
    // Entries outside the selected year are easy to miss (e.g. last year's bank statement) — count them so the page can say so
    setTotalAll(allYears ? 0 : Math.max(0, (d.total ?? 0) - all.length));
  }, [bizId, fy, allYears, ready]);

  useEffect(() => { load(); }, [load]);
  // Pushes done elsewhere in this tab (Auto-push) show here straight away
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail as { bizId: string; results: Record<string, PushState> }; if (d?.bizId === bizId) setPushed(prev => ({ ...prev, ...d.results })); };
    window.addEventListener(PUSHED_EVENT, on); return () => window.removeEventListener(PUSHED_EVENT, on);
  }, [bizId]);

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
    const seen: { date: string; amount: number; ledgers: string[]; remoteId?: string | null; guid?: string | null; voucherNumber?: string }[] = [];
    let read = 0, failedMonths = 0;
    for (let i = 0; i < months.length; i++) {
      setCheckMsg(`Reading Tally vouchers ${months[i].label} (${i + 1}/${months.length})…`);
      const xml = VOUCHER_FETCH_XML(months[i].from.replace(/-/g, ""), months[i].to.replace(/-/g, ""))
        .replace("<SVEXPORTFORMAT>", company ? `<SVCURRENTCOMPANY>${xmlEsc(company)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>` : "<SVEXPORTFORMAT>");
      try {
        const vouchers = parseTallyVouchers(await (await tallyFetch(`http://localhost:${port}`, xml, 30000)).text());
        for (const v of vouchers) {
          read++;
          const amt = v.lines.filter(l => l.isDeemed).reduce((s, l) => s + l.amount, 0) || v.lines.reduce((s, l) => s + l.amount, 0) / 2;
          seen.push({ date: v.date, amount: amt, ledgers: v.lines.map(l => xmlDec(l.ledgerName)), remoteId: v.remoteId ?? null, guid: v.guid ?? null, voucherNumber: v.voucherNumber || v.voucherType });
        }
      } catch { failedMonths++; }
    }
    const found = matchToTally(own.map(j => ({ id: j.id, date: j.date.slice(0, 10), amount: amountOf(j), ledgers: (j.fw_fin_journal_lines ?? []).map(l => l.fw_fin_chart_of_accounts?.name ?? ""), tallyGuid: (j as { tally_guid?: string | null }).tally_guid ?? null })), seen);
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
      if (month && String(j.date).slice(0, 7) !== month) return false;
      if (filter === "chat" && sourceOf(j) !== "chat") return false;
      if (filter === "pending" && (isPushed(j.id) || sourceOf(j) === "tally" || j.status !== "posted")) return false;
      if (filter === "pushed" && !isPushed(j.id)) return false;
      if (!q) return true;
      return [j.entry_no, j.narration, j.reference_no, ...(j.fw_fin_journal_lines ?? []).map(l => l.fw_fin_chart_of_accounts?.name)]
        .some(v => (v ?? "").toLowerCase().includes(q));
    });
  }, [journals, filter, search, pushed, inTally, month]);

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
    setPushing(true); setPushMsg("Checking the company open in Tally…");
    const live = await verifyOpenCompany(port, company);
    if (live) { setPushMsg(live); setPushing(false); return; }
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
      ? { journal_id: id, status: "pushed" as const, external_ref: tallyGuidFor(id) }
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
  const btn = (bg: string, fg = "#F4EFE4", disabled = false): React.CSSProperties => ({
    background: bg, color: fg, border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: "0.8rem",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit", whiteSpace: "nowrap",
  });

  const T = { ink: "#10241F", green: "#12352D", tile: "#1C3D35", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", band: "#F3ECDD", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", muted: "#6B7570", mint: "#7FE0B4" };
  const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
  const SANS = "'Manrope',system-ui,sans-serif";
  const on = conn === "connected";
  const ghost = (dis = false): React.CSSProperties => ({ height: 42, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.28)", background: "transparent", color: "#FFFFFF", fontFamily: SANS, fontSize: "0.92rem", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, cursor: dis ? "not-allowed" : "pointer", opacity: dis ? 0.5 : 1 });
  const goldBtn: React.CSSProperties = { ...ghost(), background: T.gold, color: T.ink, border: "none" };
  const fchip = (active: boolean): React.CSSProperties => ({ height: 34, padding: "0 14px", borderRadius: 999, border: `1px solid ${active ? T.green : T.line}`, background: active ? T.green : T.paper, color: active ? "#FFFFFF" : T.ink, fontFamily: SANS, fontSize: "0.86rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" });
  // Voucher type → pill colours
  const TYPE_TONE: Record<string, [string, string]> = { sales: ["#E3F3EC", "#0B7A55"], receipt: ["#E6EEFB", "#2753A6"], payment: ["#FBE9DA", "#A3541C"], purchase: ["#EFE9FA", "#5B4BC4"], contra: ["#E2F1F1", "#1D6F6F"], expense: ["#FBE9DA", "#A3541C"], credit_note: ["#FBE3DE", "#B4321F"], debit_note: ["#FBE3DE", "#B4321F"], journal: ["#EEF0EF", "#4A5651"] };
  const months = [...new Set(journals.map(j => String(j.date).slice(0, 7)))].sort().reverse();
  const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  // Day groups of the entries drawn so far (newest first), each with its day total
  const days: { date: string; items: Journal[]; total: number }[] = [];
  for (const j of visible.slice(0, shown)) {
    const d = String(j.date).slice(0, 10);
    const g = days[days.length - 1];
    if (g && g.date === d) { g.items.push(j); g.total += amountOf(j); } else days.push({ date: d, items: [j], total: amountOf(j) });
  }
  const newCount = journals.filter(j => sourceOf(j) !== "tally" && j.status === "posted").length;

  function exportCsv() {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Date", "Voucher no.", "Type", "Narration", "Debit", "Credit", "Amount", "Source", "Tally"]];
    for (const j of visible) {
      const ls = j.fw_fin_journal_lines ?? [];
      rows.push([String(j.date).slice(0, 10), j.entry_no, TYPE_LABEL[j.type] ?? j.type, j.narration ?? "",
        ls.filter(l => l.dr_amount > 0).map(l => l.fw_fin_chart_of_accounts?.name ?? "").join("; "),
        ls.filter(l => l.cr_amount > 0).map(l => l.fw_fin_chart_of_accounts?.name ?? "").join("; "),
        String(amountOf(j)), sourceOf(j) === "tally" ? "From Tally" : sourceOf(j) === "chat" ? "From chat" : "Manual", isPushed(j.id) ? "Pushed" : ""]);
    }
    const blob = new Blob(["﻿" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `Day-book-${(bizName || "books").replace(/[^A-Za-z0-9]+/g, "-")}${month ? `-${month}` : ""}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  const tiles: { l: string; v: number; sub: React.ReactNode; c: string; lc?: string; bar?: number }[] = [
    { l: "Total entries", v: counts.all, sub: <><span aria-hidden="true" style={{ color: T.gold }}>●</span> {counts.chat.toLocaleString("en-IN")} captured from chat</>, c: "#FFFFFF" },
    { l: "Pushed to Tally", v: counts.pushed, bar: newCount ? counts.pushed / newCount : 0, sub: <>{counts.pushed} of {newCount} new entries synced</>, c: T.mint, lc: T.mint },
    { l: "Waiting to push", v: counts.pending, bar: newCount ? counts.pending / newCount : 0, sub: <>Not yet in Tally</>, c: "#F2D58A", lc: "#F2D58A" },
  ];
  const tallyPill: [string, string] = conn === "connecting" ? ["Connecting…", "#F2D58A"] : on ? ["Connected", T.mint] : conn === "error" ? ["Not reachable", "#F3A58F"] : company ? ["Not checked", "#F2D58A"] : ["Not set up", "#F3A58F"];
  const GRID = "28px 150px minmax(0,1fr) 170px 150px";

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SANS }}>
      <style>{`.bk-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,1.6fr);gap:16px}@media(max-width:1100px){.bk-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}.bk-tiles>:last-child{grid-column:1/-1}}@media(max-width:640px){.bk-tiles{grid-template-columns:1fr}.bk-grid{grid-template-columns:28px minmax(0,1fr) auto !important}.bk-src,.bk-vh{display:none !important}}.bk-row:hover{background:#FBF6EC}.bk-row:focus-visible{outline:2px solid #C9A24A;outline-offset:-2px}`}</style>
      {/* Dark header: summary and Tally status */}
      <header style={{ background: T.green, color: "#FFFFFF" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "30px 28px 34px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: "0.74rem", letterSpacing: "0.22em", color: T.gold, fontWeight: 800 }}>BOOKS · DAY BOOK{bizName ? ` · ${bizName.toUpperCase()}` : ""}</div>
              <h1 style={{ margin: "6px 0 4px", fontFamily: SERIF, fontSize: "clamp(1.9rem,3.6vw,2.7rem)", fontWeight: 700, lineHeight: 1.1, textWrap: "balance" }}>Every voucher, one ledger of truth</h1>
              <div style={{ fontSize: "0.98rem", color: "#C9D3CE" }}>Entries from chat and Tally, side by side — review, select and push in one place.</div>
            </div>
            <button onClick={exportCsv} disabled={!visible.length} style={ghost(!visible.length)} title="Download the entries shown as a CSV (opens in Excel)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Export
            </button>
            <Link href="/finance/chat-book" style={goldBtn}><span aria-hidden="true" style={{ fontSize: "1.1rem" }}>+</span> New entry</Link>
          </div>
          <div className="bk-tiles">
            {tiles.map(t => (
              <div key={t.l} style={{ background: T.tile, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: "0.88rem", color: t.lc ?? "#DCE4E0" }}>{t.l}</div>
                <div style={{ fontFamily: SERIF, fontSize: "2.6rem", color: t.c, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{loading ? "—" : t.v.toLocaleString("en-IN")}</div>
                {t.bar !== undefined && <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.round(t.bar * 100))}%`, minWidth: t.v ? 8 : 0, height: "100%", background: t.c }} /></div>}
                <div style={{ fontSize: "0.84rem", color: "#C9D3CE" }}>{t.sub}</div>
              </div>
            ))}
            <div style={{ border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12, background: "rgba(0,0,0,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: SERIF, fontSize: "1.25rem", flex: 1 }}>Tally sync{on && company ? <span style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#C9D3CE" }}> · {company}</span> : null}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `1px solid ${tallyPill[1]}55`, color: tallyPill[1], fontSize: "0.76rem", fontWeight: 800 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: tallyPill[1] }} />{tallyPill[0]}</span>
                {on && eduMode && <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999, background: "rgba(242,213,138,0.18)", color: "#F2D58A" }}>Educational mode</span>}
              </div>
              {!on ? (
                <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Open Tally with your company loaded", "Keep the FreWork Tally Bridge running", `Press ${company ? "Reconnect" : "Set up Tally"}`].map((s, i) => (
                    <li key={s} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.92rem", color: "#E7ECE9" }}>
                      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${T.gold}`, color: T.gold, display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>{s}
                    </li>
                  ))}
                </ol>
              ) : <div style={{ fontSize: "0.9rem", color: "#C9D3CE" }}>{counts.pending ? `${counts.pending} entr${counts.pending === 1 ? "y is" : "ies are"} waiting to go to Tally.` : "Everything from chat is in Tally."}</div>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: "auto" }}>
                {company
                  ? <button onClick={() => connectTally({ preferName: bizName })} disabled={conn === "connecting"} style={on ? ghost() : { ...goldBtn, opacity: conn === "connecting" ? 0.5 : 1 }}>{on ? "Recheck" : "Reconnect"}</button>
                  : <Link href="/finance/tally?redirect=/finance/books" style={goldBtn}>Set up Tally</Link>}
                {company && <Link href="/finance/tally?redirect=/finance/books" style={ghost()}>Manage</Link>}
                <a href="/finance/tally?redirect=/finance/books" title="Bring Tally's vouchers into FreWork. Entries FreWork pushed to Tally are skipped." style={ghost()}>Import</a>
                <button onClick={() => push(pendingIds)} disabled={!on || pushing || !pendingIds.length} title={on ? "" : "Connect to Tally first"} style={ghost(!on || pushing || !pendingIds.length)}>{pushing ? "Pushing…" : `Push ${pendingIds.length}`}</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 28px 3rem", display: "flex", flexDirection: "column", gap: 14 }}>
        {on && eduMode && (
          <div style={{ fontSize: "0.88rem", color: T.goldInk, background: "#FFF4DB", border: "1px solid #EBD9A8", borderRadius: 12, padding: "0.7rem 1rem", lineHeight: 1.55 }}>
            <strong>Tally is running in Educational mode.</strong> It only accepts vouchers dated the 1st, 2nd or 31st of a month. Activate your TallyPrime licence (or open a licensed Tally) to push these entries — FreWork won&apos;t change your entry dates to get around this.
          </div>
        )}
        {on && (checkMsg || checking) && <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.88rem", color: T.muted, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 12, padding: "0.55rem 1rem" }}><span>{checking ? "⟳ " : "✓ "}{checkMsg}</span><div style={{ flex: 1 }} />{!checking && <button onClick={checkTally} style={fchip(false)}>Check Tally again</button>}</div>}
        {pushMsg && <div style={{ fontSize: "0.9rem", color: pushMsg.startsWith("✓") ? T.pos : T.goldInk, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 12, padding: "0.6rem 1rem" }}>{pushMsg}</div>}

        {/* Filters · search · period */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div role="tablist" aria-label="Show entries" style={{ display: "inline-flex", gap: 2, padding: 4, borderRadius: 14, background: T.band, border: `1px solid ${T.line}`, flexWrap: "wrap" }}>
            {([["all", "All", counts.all], ["chat", "From chat", counts.chat], ["pending", "Not in Tally", counts.pending], ["pushed", "Pushed", counts.pushed]] as const).map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "none", background: filter === k ? T.green : "transparent", color: filter === k ? "#FFFFFF" : T.ink, fontFamily: SANS, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                {l}<span style={{ minWidth: 22, height: 20, padding: "0 7px", borderRadius: 999, background: filter === k ? T.gold : "#FFFFFF", color: T.ink, fontSize: "0.72rem", fontWeight: 800, display: "inline-grid", placeItems: "center", fontVariantNumeric: "tabular-nums" }}>{n.toLocaleString("en-IN")}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <label style={{ position: "relative", flex: "1 1 300px", maxWidth: 440 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entry no., narration, account…" aria-label="Search entries" style={{ width: "100%", height: 44, background: T.paper, border: `1px solid ${T.line}`, color: T.ink, padding: "0 16px 0 40px", borderRadius: 12, fontSize: "0.92rem", fontFamily: SANS, outline: "none", boxSizing: "border-box" }} />
          </label>
          <select aria-label="Month" value={month} onChange={e => setMonth(e.target.value)} style={{ height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: T.paper, color: T.ink, padding: "0 12px", fontFamily: SANS, fontSize: "0.92rem", fontWeight: 700 }}>
            <option value="">All months</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select aria-label="Financial year" value={allYears ? "all" : fy?.id ?? ""} onChange={e => { setMonth(""); if (e.target.value === "all") setAllYears(true); else { setAllYears(false); setFy(fys.find(f => f.id === e.target.value) ?? null); } }} style={{ height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: T.paper, color: T.ink, padding: "0 12px", fontFamily: SANS, fontSize: "0.92rem", fontWeight: 700 }}>
            <option value="all">All years</option>
            {fys.map(f => <option key={f.id} value={f.id}>FY {f.label.replace(/^FY\s*/i, "")}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.green, color: "#FFFFFF", borderRadius: 12, padding: "10px 16px", flexWrap: "wrap", position: "sticky", top: 12, zIndex: 5 }}>
            <b>{selected.size} selected</b>
            {selectedTallyOrigin > 0 && <span style={{ color: "#F2D58A", fontSize: "0.88rem" }}>{selectedTallyOrigin} came from Tally — pushing them back will duplicate them.</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => setSelected(new Set())} style={ghost()}>Clear</button>
            <button onClick={() => push([...selected])} disabled={!on || pushing} title={on ? "" : "Connect to Tally first"} style={{ ...goldBtn, opacity: !on || pushing ? 0.5 : 1 }}>{pushing ? "Pushing…" : `Push ${selected.size} to Tally`}</button>
          </div>
        )}

        {/* Day book */}
        <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 14px 34px -30px rgba(15,43,37,0.6)" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: T.muted, fontStyle: "italic" }}>Loading entries…</div>
          ) : loadErr ? (
            <div style={{ padding: "3rem", textAlign: "center", color: T.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}><span>{loadErr}</span><button onClick={load} style={fchip(true)}>Try again</button></div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: T.muted, lineHeight: 1.8 }}>
              No entries {filter !== "all" || month ? "match this filter" : allYears ? "yet" : `in ${fy?.label ?? "this year"}`}.<br />
              <Link href="/finance/chat-book" style={{ color: T.goldInk, fontWeight: 700 }}>Book a transaction by chat →</Link>
            </div>
          ) : (<>
            <div className="bk-grid" style={{ display: "grid", gridTemplateColumns: GRID, gap: 16, alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${T.line}`, fontSize: "0.74rem", letterSpacing: "0.12em", fontWeight: 800, color: T.muted }}>
              <input type="checkbox" aria-label="Select all posted" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(selectable.map(j => j.id)))} style={{ width: 17, height: 17, accentColor: T.green }} />
              <span className="bk-vh">VOUCHER</span><span>PARTICULARS</span><span style={{ textAlign: "right" }}>AMOUNT</span><span className="bk-src" style={{ textAlign: "right" }}>SOURCE</span>
            </div>
            {days.map(day => {
              const dt = new Date(`${day.date}T00:00:00`);
              return (
                <Fragment key={day.date}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "12px 20px", background: T.band, borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
                    <b style={{ fontFamily: SERIF, fontSize: "1.08rem" }}>{dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b>
                    <span style={{ fontSize: "0.84rem", color: T.muted }}>{dt.toLocaleDateString("en-IN", { weekday: "long" })} · {day.items.length} entr{day.items.length === 1 ? "y" : "ies"}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: "0.84rem", color: T.muted }}>Day total</span>
                    <b style={{ fontFamily: SERIF, fontSize: "1.02rem", fontVariantNumeric: "tabular-nums" }}>{fmt(day.total)}</b>
                  </div>
                  {day.items.map(j => {
                    const src = sourceOf(j);
                    const p = pushed[j.id];
                    const pv = pushView(p, company);
                    const lines = j.fw_fin_journal_lines ?? [];
                    const drNames = lines.filter(l => l.dr_amount > 0).map(l => l.fw_fin_chart_of_accounts?.name ?? "?");
                    const crNames = lines.filter(l => l.cr_amount > 0).map(l => l.fw_fin_chart_of_accounts?.name ?? "?");
                    const open = expanded === j.id;
                    const failed = p && "error" in p;
                    const done = src === "tally" || !!inTally[j.id] || pv.kind === "pushed";
                    const tone = TYPE_TONE[j.type] ?? TYPE_TONE.journal;
                    const srcPill = src === "tally" ? "From Tally" : inTally[j.id] ? `In Tally${inTally[j.id].vno ? ` · ${inTally[j.id].vno}` : ""}` : pv.kind === "pushed" ? `Pushed ${new Date(pv.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : src === "chat" ? "From chat" : "Manual";
                    const nameChip = (side: "Dr" | "Cr", names: string[]) => (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ flexShrink: 0, fontSize: "0.68rem", fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: side === "Dr" ? "#EEF0EF" : "#FBEBD2", color: side === "Dr" ? "#4A5651" : "#9A6B22" }}>{side}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.join(", ")}</span>
                      </span>
                    );
                    return (
                      <Fragment key={j.id}>
                        <div className="bk-row bk-grid" tabIndex={0} onClick={() => setExpanded(open ? null : j.id)} onKeyDown={e => { if (e.key === "Enter") setExpanded(open ? null : j.id); }}
                          style={{ display: "grid", gridTemplateColumns: GRID, gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${T.line}`, cursor: "pointer", background: failed ? "#FCF3F0" : open ? "#FBF6EC" : undefined }}>
                          <span onClick={e => e.stopPropagation()} style={{ display: "flex" }}>
                            <input type="checkbox" aria-label={`Select ${j.entry_no}`} disabled={j.status !== "posted"} checked={selected.has(j.id)} onChange={() => setSelected(s => { const n = new Set(s); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; })} style={{ width: 17, height: 17, accentColor: T.green }} />
                          </span>
                          <span className="bk-vh" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, minWidth: 0 }}>
                            <span style={{ fontSize: "0.74rem", fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: tone[0], color: tone[1] }}>{TYPE_LABEL[j.type] ?? j.type}</span>
                            <span style={{ fontSize: "0.8rem", color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{j.entry_no}{j.status !== "posted" ? ` · ${j.status}` : ""}</span>
                          </span>
                          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontFamily: SERIF, fontSize: "1.06rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.narration}>{j.narration || j.entry_no}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "#4A5651", minWidth: 0 }} title={`Dr ${drNames.join(", ")} / Cr ${crNames.join(", ")}`}>
                              {nameChip("Dr", drNames)}<span aria-hidden="true" style={{ color: T.muted, flexShrink: 0 }}>→</span>{nameChip("Cr", crNames)}
                            </span>
                            {failed && <span style={{ fontSize: "0.78rem", color: T.neg }}>✗ {explainTallyError((p as { error: string }).error, eduMode)}</span>}
                            {pv.kind === "elsewhere" && <span style={{ fontSize: "0.78rem", color: T.goldInk }}>Pushed to {pv.company}, not the company open now</span>}
                          </span>
                          <span style={{ fontFamily: SERIF, fontSize: "1.12rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right" }}>{fmt(amountOf(j))}</span>
                          <span className="bk-src" onClick={e => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
                            {j.status === "posted" && !done
                              ? <button onClick={() => push([j.id])} disabled={!on || pushing} title={on ? "Push this entry to Tally" : "Connect to Tally first"} style={{ height: 30, padding: "0 12px", borderRadius: 999, border: `1px solid ${failed ? T.neg : T.gold}`, background: "#FFFFFF", color: failed ? T.neg : T.goldInk, fontFamily: SANS, fontSize: "0.78rem", fontWeight: 800, cursor: on && !pushing ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>{failed ? "Retry push" : `${srcPill} · Push`}</button>
                              : <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 11px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#FFFFFF", fontSize: "0.76rem", fontWeight: 700, color: src === "tally" ? "#4A5651" : T.pos, whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 99, background: src === "tally" ? "#4A5651" : T.pos }} />{srcPill}</span>}
                          </span>
                        </div>
                        {open && (
                          <div style={{ padding: "6px 20px 16px 214px", background: "#FBF6EC", borderBottom: `1px solid ${T.line}`, overflowX: "auto" }}>
                            {failed && <div style={{ color: T.neg, fontSize: "0.84rem", marginBottom: 8 }}>Tally said: {(p as { error: string }).error}</div>}
                            <table style={{ borderCollapse: "collapse", fontSize: "0.88rem", minWidth: 420 }}>
                              <thead><tr>{["Account", "Debit", "Credit"].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "4px 18px 4px 0", color: T.muted, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
                              <tbody>
                                {lines.map((l, i) => (
                                  <tr key={i}>
                                    <td style={{ padding: "4px 18px 4px 0" }}>{l.fw_fin_chart_of_accounts?.name ?? "?"}</td>
                                    <td style={{ padding: "4px 18px 4px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: l.dr_amount ? T.ink : T.muted }}>{l.dr_amount ? fmt(l.dr_amount) : "—"}</td>
                                    <td style={{ padding: "4px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: l.cr_amount ? T.ink : T.muted }}>{l.cr_amount ? fmt(l.cr_amount) : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: "flex", gap: "1rem", marginTop: 10, fontSize: "0.84rem" }}>
                              <Link href={`/finance/journals?id=${j.id}`} style={{ color: T.goldInk, fontWeight: 700 }}>Open in Journals →</Link>
                              {j.reference_no && <span style={{ color: T.muted }}>Ref: {j.reference_no}</span>}
                            </div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px" }}>
              <span style={{ fontSize: "0.86rem", color: T.muted }}>Showing {Math.min(shown, visible.length).toLocaleString("en-IN")} of {visible.length.toLocaleString("en-IN")} entries</span>
              <span style={{ flex: 1 }} />
              {shown < visible.length && <button onClick={() => setShown(s => s + 50)} style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${T.line}`, background: "#FFFFFF", color: T.ink, fontFamily: SANS, fontWeight: 800, cursor: "pointer" }}>Load more</button>}
            </div>
          </>)}
        </div>
        <div style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#6B7570" }}>
          Every entry stays in FreWork whether or not it&apos;s pushed. &quot;From Tally&quot; entries were imported from Tally and are skipped by &quot;Push all&quot; to avoid duplicates; likewise, importing from Tally skips vouchers FreWork pushed there. Push status is saved to your account, so it shows the same on every device.
        </div>
      </div>
    </div>
  );
}
