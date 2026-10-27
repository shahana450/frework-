"use client";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Suspense } from "react";
import { readActiveBusiness } from "@/lib/activeBusiness";
import { writeStyledWorkbook } from "@/lib/styledWorkbook";
import type { Cell } from "@/lib/statementExport";

type Account = { id: string; code: string; name: string; type: string };
type LedgerEntry = {
  id: string;
  journal_id: string;
  date: string;
  entry_no: string;
  narration: string;
  dr: number;
  cr: number;
  balance: number;
  balance_type: "Dr" | "Cr";
  journal_type: string;
};

function LedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bizId, setBizId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccId, setSelectedAccId] = useState(searchParams.get("account") ?? "");
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openingBal, setOpeningBal] = useState(0);
  const [openingType, setOpeningType] = useState<"Dr" | "Cr">("Dr");
  const [bizName, setBizName] = useState("");
  const [xlBusy, setXlBusy] = useState(false);
  // Period from the report that linked here (?from=&to=); none = the whole ledger
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const BACK: Record<string, string> = { trial_balance: "Trial Balance", profit_loss: "Profit & Loss", balance_sheet: "Balance Sheet" };
  const back = searchParams.get("back") ?? "";
  const backLabel = BACK[back];
  const goBack = () => { if (window.history.length > 1) router.back(); else router.push(`/finance/reports?tab=${back}`); };
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      supabase.from("fw_fin_businesses").select("name").eq("id", saved).maybeSingle().then(({ data }) => setBizName(data?.name ?? ""));
      const { data } = await supabase.from("fw_fin_chart_of_accounts").select("id,code,name,type").eq("business_id", saved).eq("is_group", false).order("code");
      setAccounts(data ?? []);
    });
  }, []);

  // Load once the accounts are known; a date being typed waits until it's a full date
  const reqNo = useRef(0);
  useEffect(() => {
    if (!selectedAccId || !bizId || !accounts.length) return;
    if ((from && !isDate(from)) || (to && !isDate(to))) return;
    const acc = accounts.find(a => a.id === selectedAccId);
    setSelectedAcc(acc ?? null);
    const timer = setTimeout(() => fetchLedger(selectedAccId, bizId, acc?.type ?? ""), 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccId, bizId, accounts.length, from, to]);

  async function fetchLedger(accId: string, bid: string, accType: string) {
    const req = ++reqNo.current;   // a newer request (another account or date) wins over a slower older one
    setLoading(true);
    const f = isDate(from) ? from : "", t = isDate(to) ? to : "";
    // Rows in the period, page by page (the database returns at most 1,000 rows per request)
    const page = async <T,>(make: (a: number, b: number) => PromiseLike<{ data: unknown }>) => {
      const out: T[] = [];
      for (let a = 0; ; a += 1000) {
        const { data } = await make(a, a + 999);
        const got = (data ?? []) as T[];
        out.push(...got);
        if (got.length < 1000) return out;
      }
    };
    const periodQ = (a: number, b: number) => {
      let q = supabase.from("fw_fin_journal_lines")
        .select("id, dr_amount, cr_amount, narration, fw_fin_journals!inner(id, entry_no, date, narration, type, status, business_id)")
        .eq("account_id", accId).eq("fw_fin_journals.business_id", bid).eq("fw_fin_journals.status", "posted")
        .lte("fw_fin_journals.date", t || "9999-12-31");
      if (f) q = q.gte("fw_fin_journals.date", f);
      return q.order("id").range(a, b);
    };
    // Opening balance: only the amounts before the period (balance-sheet accounts; P&L accounts open at nil)
    const plType = accType === "income" || accType === "expense";
    const openQ = (a: number, b: number) => supabase.from("fw_fin_journal_lines")
      .select("dr_amount, cr_amount, fw_fin_journals!inner(business_id, status, date)")
      .eq("account_id", accId).eq("fw_fin_journals.business_id", bid).eq("fw_fin_journals.status", "posted")
      .lt("fw_fin_journals.date", f).order("id").range(a, b);
    const [data, opening] = await Promise.all([
      page<unknown>(periodQ),
      f && !plType ? page<{ dr_amount: number; cr_amount: number }>(openQ) : Promise.resolve([]),
    ]);
    if (req !== reqNo.current) return;

    type RawLine = {
      id: string;
      dr_amount: number;
      cr_amount: number;
      narration: string | null;
      fw_fin_journals: {
        id: string; entry_no: string; date: string; narration: string;
        type: string; status: string; business_id: string;
      } | null;
    };

    const all = ((data as unknown as RawLine[]) ?? []).sort((a, b) => (a.fw_fin_journals?.date ?? "").localeCompare(b.fw_fin_journals?.date ?? ""));
    // Opening = everything before the period. Income and expense accounts start each year at nil.
    const plAcc = accType === "income" || accType === "expense";
    const openNet = plAcc ? 0 : opening.reduce((s, r) => s + (r.dr_amount ?? 0) - (r.cr_amount ?? 0), 0);
    setOpeningBal(Math.abs(openNet)); setOpeningType(openNet >= 0 ? "Dr" : "Cr");
    const rows = all;
    let runningBal = Math.abs(openNet);
    let balType: "Dr" | "Cr" = openNet >= 0 ? "Dr" : "Cr";

    const ledgerRows: LedgerEntry[] = rows.map(row => {
      const j = row.fw_fin_journals;
      const dr = row.dr_amount ?? 0;
      const cr = row.cr_amount ?? 0;

      // Running balance logic
      if (balType === "Dr") {
        const net = runningBal + dr - cr;
        runningBal = Math.abs(net);
        balType = net >= 0 ? "Dr" : "Cr";
      } else {
        const net = runningBal + cr - dr;
        runningBal = Math.abs(net);
        balType = net >= 0 ? "Cr" : "Dr";
      }

      return {
        id: row.id,
        journal_id: j?.id ?? "",
        date: j?.date ?? "",
        entry_no: j?.entry_no ?? "",
        narration: row.narration ?? j?.narration ?? "",
        dr, cr,
        balance: runningBal,
        balance_type: balType,
        journal_type: j?.type ?? "",
      };
    });

    setEntries(ledgerRows);
    setLoading(false);
  }


  const totalDr = entries.reduce((s, e) => s + e.dr, 0);
  const totalCr = entries.reduce((s, e) => s + e.cr, 0);
  const closingNet = (openingType === "Dr" ? openingBal : -openingBal) + totalDr - totalCr;
  const closingBalance = Math.abs(closingNet);
  const closingType: "Dr" | "Cr" = closingNet >= 0 ? "Dr" : "Cr";
  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });

  const filteredAccounts = search
    ? accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
    : accounts;

  // ── Period presets (Indian FY, April–March) ──
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const presets: { k: string; label: string; f: string; t: string }[] = [
    { k: "month", label: "This month", f: iso(new Date(now.getFullYear(), now.getMonth(), 1)), t: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) },
    { k: "fy", label: `FY ${fyStart}–${String(fyStart + 1).slice(2)}`, f: `${fyStart}-04-01`, t: `${fyStart + 1}-03-31` },
    { k: "q", label: `Q${((Math.floor(now.getMonth() / 3) + 3) % 4) + 1}`, f: iso(new Date(now.getFullYear(), qStartMonth, 1)), t: iso(new Date(now.getFullYear(), qStartMonth + 3, 0)) },
  ];
  const activePreset = presets.find(p => p.f === from && p.t === to)?.k ?? (from || to ? "custom" : "all");

  // ── Review flags ──
  const normalSide: "Dr" | "Cr" = selectedAcc && (selectedAcc.type === "asset" || selectedAcc.type === "expense") ? "Dr" : "Cr";
  const isReturn = (n: string) => /\b(reject|return(ed)?|bounce[d]?|dishono(u)?r(ed)?|unpaid)\b/i.test(n);
  const chequeNo = (n: string) => n.match(/\b(?:CL|CHQ|CHEQUE|CH)\s*[:#-]?\s*(\d{5,})/i)?.[1] ?? null;
  const chqCount = new Map<string, number>();
  for (const e of entries) { const c = chequeNo(e.narration); if (c && !isReturn(e.narration)) chqCount.set(c, (chqCount.get(c) ?? 0) + 1); }
  const returnNos = new Set(entries.filter(e => isReturn(e.narration)).map(e => e.narration.match(/(\d{5,})/)?.[1]).filter(Boolean) as string[]);
  const tagOf = (e: LedgerEntry): { t: string; c: string } | null => {
    if (isReturn(e.narration)) return { t: "Cheque returned", c: "#B4321F" };
    const c = chequeNo(e.narration) ?? e.narration.match(/(\d{5,})/)?.[1] ?? null;
    if (c && (chqCount.get(c) ?? 0) > 1) return { t: "Same cheque twice", c: "#9A6B22" };
    if (c && returnNos.has(c)) return { t: "Re-presented", c: "#9A6B22" };
    return null;
  };
  const flags: { sev: "high" | "mid"; title: string; body: string }[] = [];
  if (selectedAcc && entries.length && closingBalance > 0.005 && closingType !== normalSide && selectedAcc.type !== "income" && selectedAcc.type !== "equity")
    flags.push({ sev: "high", title: `${selectedAcc.type === "asset" ? "Asset" : selectedAcc.type === "expense" ? "Expense" : "Liability"} ledger shows a ${closingType === "Cr" ? "credit" : "debit"} balance.`, body: `${selectedAcc.name} normally carries ${normalSide}${normalSide === "Dr" ? " — receipts may be booked here without matching sales." : " — payments may be booked here without matching bills."}` });
  if (returnNos.size || entries.some(e => isReturn(e.narration)))
    flags.push({ sev: "mid", title: "Cheque returns", body: `${returnNos.size ? `(${[...returnNos].join(", ")}) ` : ""}— reversed here; confirm bank charges and party follow-up.` });
  const twice = [...chqCount].filter(([, n]) => n > 1);
  if (twice.length)
    flags.push({ sev: "mid", title: "Same cheque twice", body: `— ${twice.map(([c]) => c).join(", ")}. Check for a duplicate posting.` });

  // ── Tabs & filters ──
  const [tab, setTab] = useState<"all" | "dr" | "cr" | "ret" | "flag">("all");
  const [q, setQ] = useState("");
  const [monthSub, setMonthSub] = useState(true);
  const shown = entries.filter(e => {
    if (tab === "dr" && !(e.dr > 0)) return false;
    if (tab === "cr" && !(e.cr > 0)) return false;
    if (tab === "ret" && !isReturn(e.narration)) return false;
    if (tab === "flag" && !tagOf(e)) return false;
    if (q) { const s = q.toLowerCase(); if (!`${e.narration} ${e.entry_no} ${e.dr} ${e.cr}`.toLowerCase().includes(s)) return false; }
    return true;
  });
  const flaggedN = entries.filter(e => tagOf(e)).length;
  const returnsN = entries.filter(e => isReturn(e.narration)).length;

  // ── Previous / next account (in sidebar order) ──
  const order = ["asset", "liability", "equity", "income", "expense"].flatMap(t => accounts.filter(a => a.type === t));
  const idx = order.findIndex(a => a.id === selectedAccId);
  const goAcc = (d: number) => { const a = order[idx + d]; if (a) setSelectedAccId(a.id); };

  // ── Running balance sparkline, in the account's normal side ──
  const signed = (b: number, t: "Dr" | "Cr") => (t === closingType ? b : -b);
  const pts = [signed(openingBal, openingType), ...entries.map(e => signed(e.balance, e.balance_type))];
  const pMax = Math.max(...pts, 0), pMin = Math.min(...pts, 0);
  const peakI = pts.indexOf(pMax);
  const spark = pts.length > 1 ? pts.map((v, i) => `${(i / (pts.length - 1)) * 400},${100 - ((v - pMin) / ((pMax - pMin) || 1)) * 90 - 5}`).join(" ") : "";

  // Keyboard: / search, ↑↓ move, Enter open
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (ev.key === "/" && tag !== "INPUT") { ev.preventDefault(); searchRef.current?.focus(); return; }
      if (tag === "INPUT") return;
      if (ev.key === "ArrowDown") { ev.preventDefault(); setCursor(c => Math.min(c + 1, shown.length - 1)); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      else if (ev.key === "Enter" && shown[cursor]?.journal_id) router.push(`/finance/journals?id=${shown[cursor].journal_id}&from=ledger`);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const exportXl = async () => {
    if (!selectedAcc) return;
    setXlBusy(true);
    try {
      const dmy = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
      const period = from || to ? `${from ? dmy(from) : "Start"} to ${to ? dmy(to) : "date"}` : "All dates";
      const rows: Cell[][] = [
        [`Ledger — ${selectedAcc.name}`], [bizName || "Business"], [`${period} · Account code ${selectedAcc.code || "—"}`], [],
        ["Date", "Entry No", "Narration", "Debit", "Credit", "Balance", "Dr/Cr"],
        [null, null, "Opening Balance", openingType === "Dr" && openingBal ? openingBal : null, openingType === "Cr" && openingBal ? openingBal : null, openingBal, openingType],
        ...entries.map(e => [dmy(e.date), e.entry_no, e.narration, e.dr || null, e.cr || null, e.balance, e.balance_type] as Cell[]),
        [null, null, "Closing Balance", totalDr, totalCr, closingBalance, closingType],
      ];
      const name = `Ledger-${selectedAcc.name}-${bizName}-${period}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) + ".xlsx";
      await writeStyledWorkbook([{ name: "Ledger", rows, widths: [14, 16, 48, 16, 16, 18, 7], moneyFrom: 3 }], name, `Prepared with FreBook · ${dmy(new Date().toISOString().slice(0, 10))}`);
    } finally { setXlBusy(false); }
  };

  const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
  const T = { ink: "#10241F", green: "#12352D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", muted: "#6B7570" };
  const typeLabels: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Capital", income: "Income", expense: "Expenses" };
  const pill = (on: boolean): React.CSSProperties => ({ border: "none", borderRadius: 999, padding: "6px 13px", fontFamily: SERIF, fontSize: "0.82rem", cursor: "pointer", background: on ? T.green : "transparent", color: on ? "#FFFFFF" : T.ink });
  const navBtn: React.CSSProperties = { height: 38, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#FFFFFF", fontFamily: SERIF, fontSize: "0.9rem", cursor: "pointer" };
  const lightBtn: React.CSSProperties = { height: 38, padding: "0 16px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.paper, color: T.ink, fontFamily: SERIF, fontSize: "0.86rem", cursor: "pointer" };
  const dateIn: React.CSSProperties = { border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 10px", fontFamily: SERIF, fontSize: "0.85rem", color: T.ink, background: T.paper };
  const monthKey = (d: string) => d.slice(0, 7);
  const monthName = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const rowsOut: React.ReactNode[] = [];
  let lastM = "", mDr = 0, mCr = 0;
  const pushSub = () => { if (monthSub && lastM && tab === "all" && !q) rowsOut.push(<tr key={`s${lastM}`} style={{ background: "#F8F3E8" }}><td colSpan={3} style={{ padding: "8px 18px", fontStyle: "italic", fontSize: "0.8rem", color: T.muted }}>Subtotal · {monthName(lastM + "-01")}</td><td style={{ textAlign: "right", padding: "8px 14px", color: T.neg, fontSize: "0.85rem" }}>{fmt(mDr)}</td><td style={{ textAlign: "right", padding: "8px 14px", color: T.pos, fontSize: "0.85rem" }}>{fmt(mCr)}</td><td /></tr>); };
  shown.forEach((e, i) => {
    const m = monthKey(e.date);
    if (m !== lastM) {
      pushSub(); lastM = m; mDr = 0; mCr = 0;
      rowsOut.push(<tr key={`m${m}`}><td colSpan={6} style={{ padding: "12px 18px 2px", fontStyle: "italic", fontSize: "0.8rem", color: T.goldInk }}>{monthName(e.date)}</td></tr>);
    }
    mDr += e.dr; mCr += e.cr;
    const tag = tagOf(e);
    const ret = isReturn(e.narration);
    rowsOut.push(
      <tr key={e.id} className="lg-row" onClick={() => e.journal_id && router.push(`/finance/journals?id=${e.journal_id}&from=ledger`)}
        style={{ borderTop: `1px solid ${T.line}`, cursor: e.journal_id ? "pointer" : undefined, background: cursor === i ? "#F1E9D6" : ret ? "#FCF3F0" : undefined }}>
        <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</td>
        <td style={{ padding: "14px 10px", color: T.goldInk, whiteSpace: "nowrap" }}>{e.entry_no}</td>
        <td style={{ padding: "14px 10px", maxWidth: 300 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.narration}>{e.narration}</div>
          {tag && <span style={{ display: "inline-block", marginTop: 4, fontSize: "0.7rem", padding: "1px 8px", borderRadius: 999, border: `1px solid ${tag.c}`, color: tag.c }}>{tag.t}</span>}
        </td>
        <td style={{ padding: "14px", textAlign: "right", color: e.dr > 0 ? T.neg : T.muted, fontVariantNumeric: "tabular-nums" }}>{e.dr > 0 ? fmt(e.dr) : "—"}</td>
        <td style={{ padding: "14px", textAlign: "right", color: e.cr > 0 ? T.pos : T.muted, fontVariantNumeric: "tabular-nums" }}>{e.cr > 0 ? fmt(e.cr) : "—"}</td>
        <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {fmt(e.balance)} <span style={{ fontSize: "0.72rem", color: T.goldInk }}>{e.balance_type}</span>
          <span style={{ display: "inline-grid", placeItems: "center", width: 30, height: 30, marginLeft: 10, borderRadius: 999, border: `1px solid ${T.line}`, background: "#FFFFFF", fontSize: "0.8rem", verticalAlign: "middle" }}>›</span>
        </td>
      </tr>
    );
  });
  pushSub();

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SERIF }}>
      <style>{`.lg-row:hover{background:#F6EFDF !important}
        @media (max-width: 900px){ .lg-shell{flex-direction:column} .lg-side{width:auto !important; position:static !important; max-height:300px !important} .lg-split{grid-template-columns:1fr !important} }
        @media print{ .lg-side,.lg-nav button{display:none} }`}</style>
      <nav className="lg-nav" style={{ background: T.green, borderBottom: `3px solid ${T.gold}`, padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 68 }}>
        <span style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${T.gold}`, display: "grid", placeItems: "center", color: T.gold, fontStyle: "italic" }}>Fw</span>
        {backLabel
          ? <button onClick={goBack} style={navBtn}>← Back to {backLabel}</button>
          : <Link href="/finance" style={{ color: "#FFFFFF", textDecoration: "none", fontSize: "1.2rem" }}>FreWork <i style={{ color: T.gold }}>Finance</i></Link>}
        <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>Ledger</span>
        {selectedAcc && <><span style={{ color: "rgba(255,255,255,0.4)" }}>/</span><span style={{ color: "#FFFFFF", fontSize: "0.9rem" }}>{selectedAcc.name}</span></>}
        <div style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={navBtn}>Print</button>
        <button onClick={() => window.print()} title="Choose “Save as PDF” in the print window" style={navBtn}>PDF</button>
        {selectedAcc && entries.length > 0 && <button disabled={xlBusy} onClick={exportXl} style={{ ...navBtn, border: "none", background: T.gold, color: T.ink, cursor: xlBusy ? "wait" : "pointer" }}>{xlBusy ? "Preparing…" : "↓ Excel"}</button>}
      </nav>

      <div className="lg-shell" style={{ display: "flex", gap: 24, padding: "24px 28px", alignItems: "flex-start" }}>
        {/* Accounts */}
        <aside className="lg-side" style={{ width: 262, flexShrink: 0, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, position: "sticky", top: 24, maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${T.line}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${T.line}`, borderRadius: 999, padding: "9px 16px", fontFamily: SERIF, fontStyle: "italic", fontSize: "0.85rem", background: "#FFFFFF", color: T.ink, outline: "none" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
            {["asset", "liability", "equity", "income", "expense"].map(type => {
              const list = filteredAccounts.filter(a => a.type === type);
              if (!list.length) return null;
              return (
                <div key={type}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px 6px", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: T.goldInk }}>
                    <span>{typeLabels[type]}</span><span>{list.length}</span>
                  </div>
                  {list.map(acc => {
                    const on = selectedAccId === acc.id;
                    return (
                      <div key={acc.id} onClick={() => setSelectedAccId(acc.id)} style={{ padding: "8px 16px", cursor: "pointer", background: on ? "#EFE6D3" : "transparent", borderLeft: `3px solid ${on ? T.gold : "transparent"}` }}>
                        <div style={{ fontSize: "0.9rem" }}>{acc.name}</div>
                        <div style={{ fontSize: "0.68rem", color: T.muted }}>{acc.code}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Ledger */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {!selectedAcc ? (
            <div style={{ textAlign: "center", padding: "6rem 2rem", color: T.muted, fontStyle: "italic" }}>Select an account on the left to open its ledger.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: "0.72rem", letterSpacing: "0.28em", color: T.goldInk, textTransform: "uppercase" }}>Ledger account · {typeLabels[selectedAcc.type] ?? selectedAcc.type}</div>
                  <h1 style={{ margin: "4px 0", fontSize: "2.6rem", fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.01em" }}>{selectedAcc.name}</h1>
                  <div style={{ color: T.muted, fontSize: "0.92rem" }}>Code {selectedAcc.code} · Type {selectedAcc.type} · Normal balance {normalSide}</div>
                </div>
                <button onClick={() => goAcc(-1)} disabled={idx <= 0} style={{ ...lightBtn, opacity: idx <= 0 ? 0.5 : 1 }}>← Previous account</button>
                <button onClick={() => goAcc(1)} disabled={idx < 0 || idx >= order.length - 1} style={{ ...lightBtn, opacity: idx >= order.length - 1 ? 0.5 : 1 }}>Next account →</button>
              </div>

              {/* Period */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px", background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14 }}>
                <span style={{ fontSize: "0.75rem", letterSpacing: "0.22em", color: T.muted }}>PERIOD</span>
                <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 999, background: "#EFE6D3" }}>
                  <button style={pill(activePreset === "all")} onClick={() => { setFrom(""); setTo(""); }}>All</button>
                  {presets.map(p => <button key={p.k} style={pill(activePreset === p.k)} onClick={() => { setFrom(p.f); setTo(p.t); }}>{p.label}</button>)}
                  <button style={pill(activePreset === "custom")} onClick={() => { if (!from) setFrom(presets[1].f); }}>Custom</button>
                </div>
                <span style={{ color: T.muted, fontSize: "0.85rem" }}>From</span>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={dateIn} />
                <span style={{ color: T.muted, fontSize: "0.85rem" }}>to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={dateIn} />
                <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search narration, cheque no., amount…"
                  style={{ flex: 1, minWidth: 200, border: `1px solid ${T.line}`, borderRadius: 999, padding: "8px 16px", fontFamily: SERIF, fontStyle: "italic", fontSize: "0.85rem", background: "#FFFFFF", color: T.ink, outline: "none" }} />
              </div>

              {/* Tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
                {[
                  { l: "Opening balance", v: openingBal, s: openingType, c: T.ink, top: "#9AA3A0" },
                  { l: "Total debit", v: totalDr, c: T.neg, top: T.neg },
                  { l: "Total credit", v: totalCr, c: T.pos, top: T.pos },
                  { l: "Closing balance", v: closingBalance, s: closingType, c: "#FFFFFF", top: T.gold, dark: true },
                ].map(k => (
                  <div key={k.l} style={{ padding: "14px 18px", borderRadius: 12, borderTop: `3px solid ${k.top}`, background: k.dark ? T.green : T.paper, border: k.dark ? undefined : `1px solid ${T.line}`, borderTopWidth: 3, borderTopStyle: "solid", borderTopColor: k.top }}>
                    <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: k.dark ? T.gold : T.muted }}>{k.l}</div>
                    <div style={{ fontSize: "1.75rem", color: k.c, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{cur()}{fmt(k.v)} {k.s && <span style={{ fontSize: "0.8rem", color: k.dark ? T.gold : T.muted }}>{k.s}</span>}</div>
                  </div>
                ))}
              </div>

              {/* Flags + running balance */}
              {entries.length > 0 && (
                <div className="lg-split" style={{ display: "grid", gridTemplateColumns: flags.length ? "1.4fr 1fr" : "1fr", gap: 14 }}>
                  {flags.length > 0 && (
                    <div style={{ padding: "16px 18px", borderRadius: 12, background: "#FBECE8", border: "1px solid #EBC4BA" }}>
                      <div style={{ fontSize: "0.72rem", letterSpacing: "0.22em", color: T.neg, marginBottom: 10 }}>REVIEW FLAGS · {flags.length}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {flags.map((f, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, fontSize: "0.9rem", lineHeight: 1.45 }}>
                            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", fontSize: "0.72rem", color: "#FFFFFF", background: f.sev === "high" ? T.neg : "#B98A2E" }}>{f.sev === "high" ? "!" : i + 1}</span>
                            <span><b>{f.title}</b> {f.body}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: T.paper, border: `1px solid ${T.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", letterSpacing: "0.22em", color: T.goldInk }}>
                      <span>RUNNING BALANCE · {closingType} {cur()}</span>
                      <span style={{ letterSpacing: 0, color: T.muted }}>{entries[0] && new Date(entries[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {entries.at(-1) && new Date(entries.at(-1)!.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    </div>
                    <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ width: "100%", height: 110, marginTop: 8 }}>
                      <line x1="0" x2="400" y1="95" y2="95" stroke={T.line} />
                      <polyline points={spark} fill="none" stroke={T.green} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      {spark && <circle cx="400" cy={spark.split(" ").at(-1)!.split(",")[1]} r="4" fill={T.gold} />}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: T.muted }}>
                      <span>Peak {fmt(Math.abs(pMax))} {closingType}{peakI > 0 && entries[peakI - 1] ? ` · ${new Date(entries[peakI - 1].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</span>
                      <span>Low {fmt(pMin < 0 ? Math.abs(pMin) : pMin)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
                {([["all", "All entries"], ["dr", "Debits only"], ["cr", "Credits only"], ["ret", "Cheque returns", returnsN], ["flag", "Flagged", flaggedN]] as [typeof tab, string, number?][]).map(([k, l, n]) => (
                  <button key={k} onClick={() => { setTab(k); setCursor(-1); }} style={{ border: "none", background: "none", padding: "10px 14px", fontFamily: SERIF, fontSize: "0.92rem", cursor: "pointer", color: tab === k ? T.ink : "#4A5651", fontStyle: tab === k ? "italic" : "normal", borderBottom: `2px solid ${tab === k ? T.gold : "transparent"}`, marginBottom: -1 }}>
                    {l}{n ? <sup style={{ color: T.goldInk, marginLeft: 3 }}>{n}</sup> : null}
                  </button>
                ))}
                <span style={{ flex: 1 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "#4A5651", cursor: "pointer" }}>
                  <input type="checkbox" checked={monthSub} onChange={e => setMonthSub(e.target.checked)} style={{ accentColor: T.green }} /> Month subtotals
                </label>
              </div>

              {/* Table */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: T.muted, fontStyle: "italic" }}>Loading ledger…</div>
              ) : entries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: T.muted, fontStyle: "italic" }}>No posted transactions for this account{from || to ? " in this period" : ""}.</div>
              ) : (
                <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid #9AA3A0` }}>
                        {[["Date", "left"], ["Entry no.", "left"], ["Particulars", "left"], [`Debit ${cur()}`, "right"], [`Credit ${cur()}`, "right"], ["Balance", "right"]].map(([h, a]) => (
                          <th key={h} style={{ padding: "14px 18px", textAlign: a as "left" | "right", fontWeight: 400, fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#4A5651" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: "#F3ECDD" }}>
                        <td colSpan={2} />
                        <td style={{ padding: "12px 10px", fontStyle: "italic" }}>Opening balance</td>
                        <td style={{ textAlign: "right", padding: "12px 14px", color: T.muted }}>{openingType === "Dr" && openingBal > 0 ? fmt(openingBal) : "—"}</td>
                        <td style={{ textAlign: "right", padding: "12px 14px", color: T.muted }}>{openingType === "Cr" && openingBal > 0 ? fmt(openingBal) : "—"}</td>
                        <td style={{ textAlign: "right", padding: "12px 18px", fontStyle: "italic" }}>{fmt(openingBal)} <span style={{ fontSize: "0.72rem", color: T.goldInk }}>{openingType}</span></td>
                      </tr>
                      {rowsOut}
                      {shown.length === 0 && <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: T.muted, fontStyle: "italic" }}>No entries match.</td></tr>}
                      <tr style={{ background: "#F3ECDD", borderTop: `1px solid ${T.line}` }}>
                        <td colSpan={3} style={{ padding: "16px 18px", textAlign: "right", fontSize: "0.75rem", letterSpacing: "0.22em", color: "#4A5651" }}>PERIOD TOTAL · CLOSING</td>
                        <td style={{ padding: "16px 14px", textAlign: "right", color: T.neg, borderTop: "1px solid #9AA3A0", borderBottom: `3px solid ${T.gold}` }}>{fmt(totalDr)}</td>
                        <td style={{ padding: "16px 14px", textAlign: "right", color: T.pos, borderTop: "1px solid #9AA3A0", borderBottom: `3px solid ${T.gold}` }}>{fmt(totalCr)}</td>
                        <td style={{ padding: "16px 18px", textAlign: "right", borderTop: "1px solid #9AA3A0", borderBottom: `3px solid ${T.gold}` }}>{fmt(closingBalance)} <span style={{ fontSize: "0.72rem", color: T.goldInk }}>{closingType}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ fontSize: "0.8rem", fontStyle: "italic", color: T.muted }}>Click any entry to open its voucher · ↑ ↓ move · Enter open · / search</div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F4EFE4" }} />}><LedgerContent /></Suspense>;
}
