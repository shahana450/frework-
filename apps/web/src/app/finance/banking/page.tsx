"use client";
// Bank dashboard: balances, money in/out, 6-month flow and recent bank activity — filled from uploaded bank statements
// (and anything else posted to bank/cash). A live bank feed will keep it updated automatically later.
import { activeMoney, formatMoney } from "@/lib/money";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Acc = { id: string; name: string; kind: string; balance: number; inMonth: number; outMonth: number; count: number; last: string | null; fromStatements: number };
type Dash = { accounts: Acc[]; months: { month: string; in: number; out: number }[]; recent: { id: string; date: string; entry_no: string; narration: string | null; account: string; in: number; out: number; source: string | null }[]; lastStatement: string | null };

const C = { bg: "#F5F6FA", tile: "#FFFFFF", line: "#E1E4EE", ink: "#141A3A", muted: "#5A6080", navy: "#232A63", gold: "#C9A24A", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";

export default function BankingDashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const biz = (readActiveBusiness(user.id) ?? "").trim();
      if (!biz) { setErr("Choose a business first."); return; }
      const r = await fetch(`/api/finance/bank-dashboard?business_id=${biz}`).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok) { setErr(j.error ?? "Couldn't load the bank dashboard."); return; }
      setD(j);
    });
  }, []);

  const m = activeMoney();
  const money = (n: number) => formatMoney(n, m, { decimals: false });
  const banks = d?.accounts.filter(a => a.kind === "bank") ?? [];
  const cash = d?.accounts.filter(a => a.kind === "cash") ?? [];
  const total = (d?.accounts ?? []).reduce((s, a) => s + a.balance, 0);
  const inM = (d?.accounts ?? []).reduce((s, a) => s + a.inMonth, 0), outM = (d?.accounts ?? []).reduce((s, a) => s + a.outMonth, 0);
  const max = useMemo(() => Math.max(1, ...(d?.months ?? []).flatMap(x => [x.in, x.out])), [d]);
  const daysSince = d?.lastStatement ? Math.floor((Date.now() - Date.parse(d.lastStatement)) / 86400000) : null;
  const monthName = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" });
  const day = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{`
        .bd-grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0,1fr)); }
        .bd-two { display: grid; gap: 14px; grid-template-columns: minmax(0,1.4fr) minmax(0,1fr); }
        @media (max-width: 900px) { .bd-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .bd-two { grid-template-columns: minmax(0,1fr); } }
        .bd-acc { transition: transform .15s, box-shadow .15s; }
        .bd-acc:hover { transform: translateY(-2px); box-shadow: 0 12px 26px -18px rgba(35,42,99,.5); }
        @keyframes bdgrow { from { transform: scaleY(0) } }
        .bd-bar { transform-origin: bottom; animation: bdgrow .6s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .bd-bar { animation: none } .bd-acc { transition: none } }
      `}</style>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 18px 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header with sync status */}
        <header style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 32 }}>Bank dashboard</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 14.5 }}>Balances and money movement across your bank and cash accounts.</p>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
            background: daysSince == null ? C.warnSoft : daysSince > 30 ? C.warnSoft : C.posSoft, color: daysSince == null || daysSince > 30 ? C.warn : C.pos }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "currentColor" }} />
            {daysSince == null ? "No statement uploaded yet" : `Updated from statement ${daysSince === 0 ? "today" : `${daysSince} day${daysSince > 1 ? "s" : ""} ago`}`}
          </span>
          <Link href="/finance/banking/import" style={{ height: 42, padding: "0 18px", borderRadius: 11, background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
            Upload statement
          </Link>
        </header>

        {err && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{err}</div>}

        {/* Headline numbers */}
        <div className="bd-grid">
          {[
            { l: "Total bank & cash", v: total, tone: total < 0 ? C.neg : C.ink, dark: true },
            { l: "Money in · this month", v: inM, tone: C.pos },
            { l: "Money out · this month", v: outM, tone: C.neg },
            { l: "Net this month", v: inM - outM, tone: inM - outM < 0 ? C.neg : C.pos },
          ].map(s => (
            <div key={s.l} style={{ borderRadius: 18, padding: "16px 18px", background: s.dark ? "linear-gradient(150deg,#2E3680,#232A63 55%,#1B2152)" : C.tile, border: s.dark ? "none" : `1px solid ${C.line}`, color: s.dark ? "#FFFFFF" : C.ink }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: s.dark ? C.gold : C.muted }}>{s.l}</div>
              <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, marginTop: 6, color: s.dark ? (s.v < 0 ? "#FFB4A8" : "#FFFFFF") : s.tone, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d ? money(s.v) : "—"}</div>
            </div>
          ))}
        </div>

        {/* Accounts */}
        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {!d ? [0, 1, 2].map(k => <div key={k} style={{ height: 130, borderRadius: 18, background: C.tile, border: `1px solid ${C.line}`, opacity: 0.6 }} />)
            : d.accounts.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", background: C.tile, border: `1px dashed ${C.line}`, borderRadius: 18, padding: 28, textAlign: "center", color: C.muted }}>
                <b style={{ color: C.ink, fontSize: 16 }}>No bank account yet</b><br />Upload a bank statement — FreBook creates the bank ledger and fills this dashboard.
              </div>
            ) : [...banks, ...cash].map(a => (
              <Link key={a.id} href={`/finance/ledger?account=${a.id}`} className="bd-acc" style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, textDecoration: "none", color: C.ink, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: a.kind === "bank" ? "#EAF2FF" : "#FFF4DB", color: a.kind === "bank" ? "#1F5EFF" : C.warn }}>
                    {a.kind === "bank"
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: C.muted }}>{a.last ? `Last entry ${day(a.last)}` : "No entries yet"}{a.fromStatements ? ` · ${a.fromStatements} from statements` : ""}</span>
                  </span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: a.balance < 0 ? C.neg : C.ink }}>{money(a.balance)}</div>
                {a.balance < 0 && <div style={{ fontSize: 12, fontWeight: 700, color: C.neg, background: C.negSoft, borderRadius: 8, padding: "4px 8px" }}>{a.kind === "cash" ? "Cash can't go below zero — a receipt may be missing." : "Overdrawn or an entry is missing — check against the statement."}</div>}
                <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
                  <span style={{ color: C.pos, fontWeight: 700 }}>↓ In {money(a.inMonth)}</span>
                  <span style={{ color: C.neg, fontWeight: 700 }}>↑ Out {money(a.outMonth)}</span>
                  <span style={{ color: C.muted, marginLeft: "auto" }}>this month</span>
                </div>
              </Link>
            ))}
        </section>

        <div className="bd-two">
          {/* 6-month flow */}
          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Money in and out · last 6 months</h2>
              <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 12, color: C.muted }}>
                <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: C.pos, marginRight: 5 }} />In</span>
                <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#E8A59B", marginRight: 5 }} />Out</span>
              </span>
            </div>
            <div role="img" aria-label="Money in and out by month" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10, alignItems: "end", height: 170 }}>
              {(d?.months ?? []).map((x, i) => (
                <div key={x.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, borderBottom: `1px solid ${C.line}` }}>
                    <span className="bd-bar" title={`In ${money(x.in)}`} style={{ width: "38%", height: `${(x.in / max) * 100}%`, minHeight: x.in ? 3 : 0, background: C.pos, borderRadius: "5px 5px 0 0", animationDelay: `${i * 60}ms` }} />
                    <span className="bd-bar" title={`Out ${money(x.out)}`} style={{ width: "38%", height: `${(x.out / max) * 100}%`, minHeight: x.out ? 3 : 0, background: "#E8A59B", borderRadius: "5px 5px 0 0", animationDelay: `${i * 60 + 30}ms` }} />
                  </div>
                  <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>{monthName(x.month)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Recent */}
          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Recent bank activity</h2>
              <Link href="/finance/banking/history" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: C.navy, textDecoration: "none" }}>All →</Link>
            </div>
            {!d ? <span style={{ color: C.muted, fontSize: 13 }}>Loading…</span>
              : d.recent.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>Nothing yet — upload a statement to see transactions here.</span>
              : d.recent.map((r, i) => (
                <Link key={r.id + i} href={`/finance/journals?id=${r.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? `1px solid ${C.line}` : "none", textDecoration: "none", color: C.ink }}>
                  <span style={{ width: 44, fontSize: 11.5, color: C.muted, fontWeight: 600, flexShrink: 0 }}>{day(r.date)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.narration || r.entry_no}</span>
                    <span style={{ display: "block", fontSize: 11, color: C.muted }}>{r.account}{r.source === "statement" ? " · statement" : ""}</span>
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: r.in ? C.pos : C.neg, whiteSpace: "nowrap" }}>{r.in ? "+" : "−"}{money(r.in || r.out)}</span>
                </Link>
              ))}
          </section>
        </div>

        {/* How it updates */}
        <section style={{ background: "linear-gradient(120deg,#FFFFFF,#F6F7FC)", border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[
            { t: "Now: upload statements", d: "PDF, Excel or CSV. The AI reads every row, you confirm the ledgers, and this dashboard updates.", on: true },
            { t: "Next: automatic bank feed", d: "Connect your bank once (RBI Account Aggregator) and transactions arrive by themselves — no uploads.", on: false },
            { t: "Always: matched to your books", d: "Every bank line becomes a proper entry — ledger, trial balance and Tally stay in step.", on: true },
          ].map(s => (
            <div key={s.t} style={{ display: "flex", gap: 10 }}>
              <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, background: s.on ? C.posSoft : C.warnSoft, color: s.on ? C.pos : C.warn }}>{s.on ? "✓" : "…"}</span>
              <span><b style={{ fontSize: 14 }}>{s.t}</b><br /><span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{s.d}</span></span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
