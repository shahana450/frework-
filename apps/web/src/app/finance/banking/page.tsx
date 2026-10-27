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

  const plain = (n: number) => Math.round(n).toLocaleString(m.locale);
  const T = { ink: "#10241F", green: "#12352D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", muted: "#6B7570", soft: "#F3ECDD" };
  const all = [...banks, ...cash];
  const [selId, setSelId] = useState("");
  const sel = all.find(a => a.id === selId) ?? all[0];
  const recent = (d?.recent ?? []).filter(r => !sel || r.account === sel.name);
  const curMon = new Date().toLocaleDateString("en-IN", { month: "short" });
  const net = inM - outM;

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SERIF }}>
      <style>{`
        .bk-two { display: grid; gap: 22px; grid-template-columns: 340px minmax(0,1fr); align-items: start; }
        @media (max-width: 900px) { .bk-two { grid-template-columns: minmax(0,1fr); } }
        .bk-acc { cursor: pointer; text-align: left; font-family: inherit; transition: border-color .15s; }
        .bk-acc:hover { border-color: ${T.gold} !important; }
        @keyframes bdgrow { from { transform: scaleY(0) } }
        .bd-bar { transform-origin: bottom; animation: bdgrow .6s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .bd-bar { animation: none } }
      `}</style>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 28px 100px", display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 700 }}>Bank dashboard</h1>
          <span style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.92rem", color: daysSince == null || daysSince > 30 ? T.goldInk : T.pos }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
            {daysSince == null ? "No statement uploaded yet" : `Updated from statement ${daysSince === 0 ? "today" : `${daysSince} day${daysSince > 1 ? "s" : ""} ago`}`}
          </span>
          <Link href="/finance/banking/import" style={{ height: 44, padding: "0 22px", borderRadius: 999, background: T.green, color: "#FFFFFF", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>↑ Upload statement</Link>
        </header>

        {err && <div style={{ background: "#FFF4DB", color: T.goldInk, borderRadius: 12, padding: "12px 16px" }}>{err}</div>}

        <div className="bk-two">
          {/* Left: total + accounts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: T.green, color: "#FFFFFF", borderRadius: 16, padding: "22px 22px" }}>
              <div style={{ fontSize: "0.74rem", letterSpacing: "0.24em", color: T.gold }}>TOTAL BANK &amp; CASH</div>
              <div style={{ fontSize: "2.2rem", marginTop: 6, color: total < 0 ? "#F0A792" : "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>{d ? money(total) : "—"}</div>
              <div style={{ display: "flex", gap: 16, fontSize: "0.9rem", marginTop: 10, flexWrap: "wrap" }}>
                <span>In {d ? plain(inM) : "—"}</span>
                <span>Out {d ? plain(outM) : "—"}</span>
                <span style={{ color: net < 0 ? "#F0A792" : "#9FE0C2" }}>Net {d ? plain(net) : "—"}</span>
              </div>
            </div>
            {!d ? [0, 1].map(k => <div key={k} style={{ height: 150, borderRadius: 16, background: T.paper, border: `1px solid ${T.line}`, opacity: 0.6 }} />)
              : all.length === 0 ? (
                <div style={{ background: T.paper, border: `1px dashed ${T.gold}`, borderRadius: 16, padding: 24, textAlign: "center", color: T.muted }}>
                  <b style={{ color: T.ink }}>No bank account yet</b><br />Upload a bank statement — FreBook creates the bank ledger and fills this dashboard.
                </div>
              ) : all.map(a => {
                const on = sel?.id === a.id, flow = a.inMonth + a.outMonth;
                return (
                  <button key={a.id} className="bk-acc" onClick={() => setSelId(a.id)} style={{ background: T.paper, border: `${on ? 2 : 1}px solid ${on ? T.green : T.line}`, borderRadius: 16, padding: "18px 20px", color: T.ink, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: T.muted }}><span>{a.kind === "bank" ? "Bank account" : "Cash"}</span><span>{a.last ? day(a.last) : ""}</span></div>
                    <div style={{ fontSize: "1.35rem" }}>{a.kind === "cash" && /^cash$/i.test(a.name) ? "Cash in hand" : a.name}</div>
                    <div style={{ fontSize: "1.75rem", color: a.balance < 0 ? T.neg : T.ink, fontVariantNumeric: "tabular-nums" }}>{money(a.balance)}</div>
                    {a.balance < 0 && <div style={{ fontSize: "0.8rem", color: T.neg, background: "#FBECE8", borderRadius: 8, padding: "6px 10px" }}>{a.kind === "cash" ? "Cash can't go below zero — a receipt may be missing." : "Overdrawn or an entry is missing — check against the statement."}</div>}
                    {flow > 0 && a.balance >= 0 && <div style={{ height: 6, borderRadius: 999, background: "#EFE6D3", overflow: "hidden" }}><div style={{ width: `${Math.round((a.inMonth / flow) * 100)}%`, height: "100%", background: T.gold }} /></div>}
                    <div style={{ fontSize: "0.8rem", color: T.muted }}>In {plain(a.inMonth)} · Out {plain(a.outMonth)} this month</div>
                  </button>
                );
              })}
            <Link href="/finance/chart-of-accounts" style={{ padding: "16px", borderRadius: 16, border: `1px dashed ${T.gold}`, textAlign: "center", color: T.ink, textDecoration: "none" }}>+ Add bank or card account</Link>
          </div>

          {/* Right: selected account */}
          <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 18, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.74rem", letterSpacing: "0.24em", color: T.goldInk }}>SELECTED ACCOUNT</div>
                <div style={{ fontSize: "2rem", fontStyle: "italic" }}>{sel ? sel.name : "—"}</div>
              </div>
              {sel && <Link href={`/finance/ledger?account=${sel.id}`} style={{ color: T.goldInk }}>Open ledger →</Link>}
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {[["Balance", sel?.balance ?? 0, T.muted], [`In · ${curMon}`, sel?.inMonth ?? 0, T.pos], [`Out · ${curMon}`, sel?.outMonth ?? 0, T.neg]].map(([l, v, c]) => (
                <div key={l as string} style={{ background: T.soft, borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ fontSize: "0.8rem", color: c as string }}>{l as string}</div>
                  <div style={{ fontSize: "1.4rem", fontVariantNumeric: "tabular-nums" }}>{sel ? plain(v as number) : "—"}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <b>Recent activity</b>
                <Link href="/finance/banking/history" style={{ marginLeft: "auto", fontSize: "0.85rem", color: T.goldInk }}>All →</Link>
              </div>
              {!d ? <span style={{ color: T.muted }}>Loading…</span>
                : recent.length === 0 ? <span style={{ color: T.muted, fontStyle: "italic" }}>Nothing yet — upload a statement to see transactions here.</span>
                : recent.map((r, i) => (
                  <Link key={r.id + i} href={`/finance/journals?id=${r.id}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${T.line}`, textDecoration: "none", color: T.ink }}>
                    <span style={{ width: 64, color: T.muted, flexShrink: 0 }}>{day(r.date)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.narration || r.entry_no}</span>
                      <span style={{ display: "block", fontSize: "0.78rem", color: T.muted }}>{r.source === "statement" ? "from statement" : r.entry_no}</span>
                    </span>
                    <span style={{ fontSize: "1.05rem", color: r.in ? T.pos : T.neg, whiteSpace: "nowrap" }}>{r.in ? "+" : "−"}{money(r.in || r.out)}</span>
                  </Link>
                ))}
            </div>
            <div>
              <b>Last 6 months</b>
              <div role="img" aria-label="Money in and out by month" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10, alignItems: "end", height: 150, marginTop: 10 }}>
                {(d?.months ?? []).map((x, i) => (
                  <div key={x.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, borderBottom: `1px solid ${T.line}` }}>
                      <span className="bd-bar" title={`In ${money(x.in)}`} style={{ width: 18, height: `${(x.in / max) * 100}%`, minHeight: x.in ? 3 : 0, background: T.green, animationDelay: `${i * 60}ms` }} />
                      <span className="bd-bar" title={`Out ${money(x.out)}`} style={{ width: 18, height: `${(x.out / max) * 100}%`, minHeight: x.out ? 3 : 0, background: T.gold, animationDelay: `${i * 60 + 30}ms` }} />
                    </div>
                    <span style={{ fontSize: "0.82rem", color: T.muted }}>{monthName(x.month)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: "0.8rem", color: T.muted, marginTop: 8 }}>
                <span><i style={{ display: "inline-block", width: 9, height: 9, background: T.green, marginRight: 5 }} />In</span>
                <span><i style={{ display: "inline-block", width: 9, height: 9, background: T.gold, marginRight: 5 }} />Out</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
