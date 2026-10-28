"use client";
import { activeCountry, cur } from "@/lib/money";
import { dueChip } from "@/lib/dueText";
// FreBook home — a desk, read top to bottom: the question, books at a glance, what needs you today, what's coming up.
// Cream ground, deep green and gold. Every figure comes from /api/finance/dashboard.
import { useState, useEffect } from "react";
import { useTally, tallyLabel } from "@/lib/tallyConnection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dashboard } from "@/lib/dashboard";

const C = {
  ground: "#F4EFE4", tile: "#FFFDF8", line: "#E6DFD0", ink: "#10241F", muted: "#5E6B66",
  green: "#12352D", greenSoft: "#E4ECE8", gold: "#9A6B22", goldSoft: "#F3E8D2", goldLine: "#C99A4E",
  pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB",
};
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";

type TaxDesk = {
  links: { portal: string; identifier: string; status: string; last_sync_at: string | null; provider: string }[];
  statuses: { portal: string; kind: string; form: string; period: string; status: string; arn: string | null; filed_on: string | null; amount: number | null; demo: boolean }[];
  notices: { id: string; title: string; authority: string | null; reply_due: string | null; amount: number | null }[];
};
type Props = { dash: (Dashboard & { taxDesk?: TaxDesk }) | null; bizName: string; greeting: string; controls: React.ReactNode; dashErr?: string; onRetry?: () => void };

export default function HomeDesk({ dash, bizName, greeting, controls, dashErr, onRetry }: Props) {
  const india = activeCountry() === "IN";
  const router = useRouter();
  const tally = useTally();
  const [mode, setMode] = useState<"record" | "ask">("record");
  // Opened from WhatsApp: recording happens in the chat, so only "Ask" is offered here
  const [fromWa, setFromWa] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem("fw_from_wa") === "1") { setFromWa(true); setMode("ask"); } } catch { /* */ } }, []);
  const [text, setText] = useState("");
  const [allDues, setAllDues] = useState(false);
  const go = (t: string) => { const v = t.trim(); if (v) router.push(`/finance/chat-book?q=${encodeURIComponent(v)}`); };

  // Figures as accountants write them: grouped, no symbol (the card says the unit), negatives in brackets
  const locale = dash?.locale ?? "en-IN";
  const num = (n: number | undefined | null) => n == null ? "—" : (() => { const s = Math.round(Math.abs(n)).toLocaleString(locale); return n < 0 ? `(${s})` : s; })();
  const money = (n: number | undefined | null) => n == null ? "—" : `${n < 0 ? "−" : ""}${cur()}${Math.round(Math.abs(n)).toLocaleString(locale)}`;

  const income = dash?.revenue ?? 0, spent = dash?.expenses ?? 0, profit = dash?.profit ?? 0;
  const ratioNote = income > 0 && spent > 0
    ? spent > income ? `Expenses are about ${(spent / income).toFixed(spent / income >= 10 ? 0 : 1).replace(/\.0$/, "")}× income so far.` : `Expenses are ${Math.round((spent / income) * 100)}% of income — ${Math.round((profit / income) * 100)}% margin.`
    : income === 0 && spent > 0 ? "No income recorded yet this period." : "";
  const dues = dash?.compliance ?? [];
  const today = new Date();

  // Needs you today: overdue filings first, then the books' own alerts
  const needs: { tone: "bad" | "warn" | "info"; title: string; sub: string; action: string; href: string; primary?: boolean }[] = [];
  for (const d of dues.filter(x => x.daysLeft < 0 && !x.filed).slice(0, 2)) {
    needs.push({ tone: "bad", title: `${d.title} for ${d.period} is overdue`, sub: `Due ${new Date(d.due + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · late fee running`, action: "Prepare return", href: d.href, primary: true });
  }
  for (const a of dash?.alerts ?? []) {
    if (needs.length >= 4) break;
    const [title, ...rest] = a.text.split(/(?<=[.—])\s+/);
    needs.push({ tone: a.tone, title: title.replace(/[.—]$/, ""), sub: rest.join(" "), action: a.action, href: a.href });
  }

  const tile: React.CSSProperties = { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
  const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold };
  const h2: React.CSSProperties = { margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: C.ink };
  const ghostBtn: React.CSSProperties = { alignSelf: "flex-start", fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#FFFFFF", color: C.ink, textDecoration: "none", whiteSpace: "nowrap" };

  return (
    <div className="hd" style={{ display: "flex", flexDirection: "column", gap: 22, color: C.ink }}>
      <style>{`
        .hd-main { display: grid; gap: 18px; grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); }
        .hd-glance { display: grid; gap: 28px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .hd-dues { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(0, 1fr)); }
        .hd-bottom { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .hd-lower { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        @media (max-width: 1100px) { .hd-main, .hd-lower { grid-template-columns: minmax(0, 1fr); } .hd-dues { grid-template-columns: repeat(3, minmax(0, 1fr)); } .hd-bottom { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) {
          .hd-glance, .hd-bottom { grid-template-columns: minmax(0, 1fr); }
          .hd-dues { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 72%; overflow-x: auto; scrollbar-width: none; }
          .hd-entry textarea { min-height: 80px !important; } .hd-entry span { display: none; }
          .hd-h1 { font-size: 26px !important; }
        }
        .hd a.lift, .hd button.lift { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .hd a.lift:hover, .hd button.lift:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -16px rgba(18,53,45,0.45); }
        .hd .chip:hover { border-color: ${C.green}; color: ${C.green}; }
        .hd .glink { color: #E8DCC2; } .hd .glink:hover { color: #FFFFFF; }
        .hd :focus-visible { outline: 2px solid ${C.goldLine}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .hd .lift { transition: none !important } }
      `}</style>

      {/* Greeting */}
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={eyebrow}>{today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        <h1 className="hd-h1" style={{ margin: 0, fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.12, textWrap: "balance" }}>
          {greeting}. What happened in the <span style={{ fontStyle: "italic", fontWeight: 400, color: C.gold }}>business</span> today?
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link href="/finance/select-business" title="Switch business" className="lift" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px 0 4px", borderRadius: 10, background: "#FFFFFF", border: `1px solid ${C.line}`, textDecoration: "none", color: C.ink }}>
            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", background: C.green, color: "#E8C27A", fontFamily: SERIF, fontWeight: 700, fontSize: 14 }}>{(bizName || "?").trim()[0]?.toUpperCase()}</span>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.02em" }}>{bizName}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tally.status === "connected" ? C.posSoft : C.goldSoft, color: tally.status === "connected" ? C.pos : C.muted }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />{tallyLabel(tally)}
            </span>
          </Link>
          <div className="hd-controls" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{controls}</div>
        </div>
      </header>

      {dashErr && <div style={{ ...tile, flexDirection: "row", alignItems: "center", color: C.warn, background: C.warnSoft, borderColor: "#FFE2A8" }}>{dashErr}{onRetry && <button onClick={onRetry} style={{ marginLeft: "auto", border: `1px solid ${C.warn}`, background: "transparent", color: C.warn, borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>Try again</button>}</div>}

      {/* Record / Ask */}
      <section aria-label="Record or ask" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="hd-entry" style={{ display: "flex", flexDirection: "column", gap: 6, background: "#FFFFFF", border: `1.5px solid ${text.trim() ? C.goldLine : C.line}`, borderRadius: 20, padding: 12, boxShadow: "0 18px 36px -26px rgba(18,53,45,0.55)", transition: "border-color .15s" }}>
          <div role="tablist" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 11, background: C.ground, alignSelf: "flex-start" }}>
            {(fromWa ? ["ask"] as const : ["record", "ask"] as const).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} style={{ height: 32, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: mode === m ? C.green : "transparent", color: mode === m ? "#FFFFFF" : C.muted }}>
                {m === "record" ? "Record" : "Ask"}
              </button>
            ))}
          </div>
          <textarea id="hd-chat" aria-label="Describe a transaction or ask a question" rows={3} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(text); } }}
            placeholder={mode === "record" ? (india ? "Tell FreBook what happened — e.g. Paid office rent ₹25,000 from the bank for October" : `Tell FreBook what happened — e.g. Paid office rent ${cur()}2,500 from the bank for October`) : "Ask about your books — e.g. Who owes me for more than 60 days?"}
            style={{ width: "100%", minHeight: 96, resize: "vertical", boxSizing: "border-box", border: "none", outline: "none", background: "transparent", padding: "8px 6px", fontSize: 16, lineHeight: 1.55, color: C.ink, fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!fromWa && <Link href="/finance/chat-book?snap=1" aria-label="Snap a bill" title="Snap a bill or attach a PDF" style={{ height: 40, padding: "0 12px", flexShrink: 0, borderRadius: 10, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 6, color: C.muted, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Bill photo / PDF
            </Link>}
            <span style={{ fontSize: 12, color: C.muted }}>Enter to {mode === "record" ? "draft" : "ask"} · Shift+Enter for a new line</span>
            <button onClick={() => go(text)} disabled={!text.trim()} style={{ marginLeft: "auto", height: 42, flexShrink: 0, padding: "0 20px", borderRadius: 12, border: "none", background: C.green, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: text.trim() ? "pointer" : "default", opacity: text.trim() ? 1 : 0.6 }}>
              {mode === "record" ? "Draft entry →" : "Ask →"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.muted }}>Try:</span>
          {(mode === "record" ? (india ? ["Received ₹1.2L from a customer", "Paid salaries for last month", "Bought stationery ₹1,800 in cash"] : [`Received ${cur()}12,000 from a customer`, "Paid salaries for last month", `Bought stationery ${cur()}180 in cash`]) : ["Who owes me for more than 60 days?", "Profit this month vs last month", "GST collected last month"]).map(c => (
            <button key={c} className="chip" onClick={() => mode === "ask" ? go(c) : setText(c)} style={{ height: 30, padding: "0 12px", borderRadius: 999, border: `1px solid ${C.line}`, background: C.tile, color: C.muted, fontSize: 12, cursor: "pointer" }}>{c}</button>
          ))}
        </div>
      </section>

      {/* Books at a glance · Needs you today */}
      <div className="hd-main">
        <section aria-labelledby="glance" style={{ ...tile, background: C.green, border: "none", color: "#F4EFE4", padding: 24, gap: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 id="glance" style={{ ...h2, color: "#FFFFFF" }}>Books at a glance</h2>
            <span style={{ fontSize: 11.5, color: "#B9C7C1" }}>{dash?.period.label ?? "This year"} · amounts in {cur().trim() || dash?.currency} · (brackets) = negative</span>
          </div>
          <div className="hd-glance">
            {[
              { head: "Profit & loss", rows: [
                { k: "Income", v: income, href: "/finance/reports?tab=profit_loss" },
                { k: "Expenses", v: spent, href: "/finance/reports?tab=profit_loss" },
              ], total: { k: profit < 0 ? "Net loss" : "Net profit", v: profit, note: ratioNote } },
              { head: "Position today", rows: [
                { k: "Cash & bank", v: dash?.cash, href: "/finance/banking", note: (dash?.cash ?? 0) < 0 ? "Overdrawn — check the bank balances" : "" },
                { k: "Receivables", v: dash?.receivables, href: "/finance/collect", link: (dash?.receivables ?? 0) > 0 ? { t: "Set up reminders →", href: "/finance/collect" } : undefined },
                { k: "Payables", v: dash?.payables, href: "/finance/payables", note: (dash?.payables ?? 0) < 0 ? "Suppliers in debit" : "" },
              ] },
            ].map(col => (
              <div key={col.head} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ ...eyebrow, color: "#D9B56F", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.14)" }}>{col.head}</span>
                {col.rows.map(r => (
                  <Link key={r.k} href={r.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#F4EFE4", textDecoration: "none" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 13.5 }}>
                      {r.k}
                      {"note" in r && r.note && <span style={{ fontSize: 11, color: "#F3A58F" }}>{r.note}</span>}
                      {"link" in r && r.link && <span className="glink" style={{ fontSize: 11, fontWeight: 700, textDecoration: "underline" }}>{r.link.t}</span>}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 14, fontVariantNumeric: "tabular-nums", color: (r.v ?? 0) < 0 ? "#F3A58F" : "#FFFFFF" }}>{num(r.v)}</span>
                  </Link>
                ))}
                {"total" in col && col.total && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>{col.total.k}</span>
                      <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: col.total.v < 0 ? "#F3A58F" : "#A8F0CF" }}>{num(col.total.v)}</span>
                    </div>
                    {col.total.note && <span style={{ fontSize: 11.5, color: "#B9C7C1" }}>{col.total.note}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
            {[["Profit & Loss", "/finance/reports?tab=profit_loss"], ["Balance Sheet", "/finance/reports?tab=balance_sheet"], ["Trial Balance", "/finance/reports?tab=trial_balance"]].map(([t, h]) => (
              <Link key={t} href={h} className="lift" style={{ fontSize: 12.5, fontWeight: 700, padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.25)", color: "#FFFFFF", textDecoration: "none" }}>{t} →</Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="needs" style={tile}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 id="needs" style={h2}>Needs you today</h2>
            {needs.length > 0 && <span style={{ minWidth: 24, height: 22, padding: "0 7px", borderRadius: 999, background: C.green, color: "#FFFFFF", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center" }}>{needs.length}</span>}
          </div>
          {!dash ? <span style={{ fontSize: 13, color: C.muted }}>Checking your books…</span>
            : needs.length === 0 ? <span style={{ fontSize: 13.5, color: C.pos, fontWeight: 700 }}>✓ Nothing needs you right now.</span>
            : needs.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 10, paddingTop: i ? 12 : 0, borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0, background: n.tone === "bad" ? C.neg : n.tone === "warn" ? "#D49A3A" : C.pos }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{n.title}</span>
                  {n.sub && <span style={{ fontSize: 12, color: C.muted }}>{n.sub}</span>}
                  <Link href={n.href} className="lift" style={n.primary ? { ...ghostBtn, background: C.green, color: "#FFFFFF", border: "none", marginTop: 4 } : { ...ghostBtn, marginTop: 4 }}>{n.action}</Link>
                </div>
              </div>
            ))}
        </section>
      </div>

      {/* Coming up */}
      <section aria-labelledby="coming" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 id="coming" style={h2}>Coming up</h2>
          {dues.length > 5 && <button onClick={() => setAllDues(s => !s)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.gold, textDecoration: "underline" }}>{allDues ? "Show fewer" : `All ${dues.length} due dates →`}</button>}
        </div>
        {!dash ? <span style={{ fontSize: 13, color: C.muted }}>Checking…</span>
          : dues.length === 0 ? <span style={{ fontSize: 13, color: C.pos, fontWeight: 600 }}>✓ Nothing due in the next few weeks.</span>
          : <div className="hd-dues">
            {(allDues ? dues : dues.slice(0, 5)).map(d => {
              const late = d.daysLeft < 0 && !d.filed;
              const tone = d.filed ? C.pos : late ? C.neg : d.daysLeft <= 10 ? C.goldLine : C.line;
              const chip = d.filed ? ["Filed ✓", C.posSoft, C.pos] : late ? ["Overdue", C.negSoft, C.neg] : d.daysLeft <= 3 ? [dueChip(d.daysLeft), C.negSoft, C.neg] : [`${d.daysLeft} days`, d.daysLeft <= 10 ? C.goldSoft : C.ground, d.daysLeft <= 10 ? C.gold : C.muted];
              const dt = new Date(d.due + "T00:00:00");
              return (
                <Link key={d.key} href={d.href} title={d.note} className="lift" style={{ ...tile, padding: 14, gap: 6, borderTop: `3px solid ${tone}`, textDecoration: "none", color: C.ink, opacity: d.filed ? 0.75 : 1 }}>
                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                    <span><span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600 }}>{String(dt.getDate()).padStart(2, "0")}</span> <span style={{ fontSize: 11, fontWeight: 800, color: C.gold, textTransform: "uppercase" }}>{dt.toLocaleDateString("en-IN", { month: "short" })}</span></span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: chip[1], color: chip[2], whiteSpace: "nowrap" }}>{chip[0]}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{d.title}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>{d.period}{d.amount ? ` · ${money(d.amount)}` : ""}</span>
                </Link>
              );
            })}
          </div>}
        {dash?.complianceSetup?.country === "IN" && (!dash.complianceSetup.gst || !dash.complianceSetup.tds) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!dash.complianceSetup.gst && <Link href="/finance/settings/business" style={{ ...ghostBtn, borderStyle: "dashed" }}>＋ Add GSTIN for GSTR-1 / 3B reminders</Link>}
            {!dash.complianceSetup.tds && <Link href="/finance/settings/business" style={{ ...ghostBtn, borderStyle: "dashed" }}>＋ Add TAN for TDS reminders</Link>}
          </div>
        )}
      </section>

      {/* Quick add · Smart Inbox · Tax desk */}
      <div className="hd-bottom">
        <section aria-labelledby="quick" style={tile}>
          <h2 id="quick" style={{ ...h2, fontSize: 18 }}>Quick add</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ t: "Sale", href: "/finance/sales/new" }, { t: "Purchase", href: "/finance/purchases/new" }, { t: "Receipt", href: "/finance/chat-book?prefill=Received%20" }, { t: "Payment", href: "/finance/payment" }].map((q, i) => (
              <Link key={q.t} href={q.href} className="lift" style={{ display: "grid", placeItems: "center", height: 44, borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 13.5, background: i === 0 ? C.green : C.goldSoft, color: i === 0 ? "#FFFFFF" : C.ink }}>+ {q.t}</Link>
            ))}
          </div>
        </section>

        <Link href="/finance/inbox" className="lift" style={{ ...tile, border: `1.5px dashed ${C.goldLine}`, background: "transparent", textDecoration: "none", color: C.ink }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M4 15v5h16v-5" /></svg>
          <h2 style={{ ...h2, fontSize: 18 }}>Smart Inbox</h2>
          <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Drop bank statements, bills and invoices — FreBook reads them and drafts the entries for you to confirm.</span>
          <span style={{ marginTop: "auto", fontSize: 12.5, fontWeight: 700, color: C.gold }}>Open Smart Inbox →</span>
        </Link>

        {(() => {
          const td = dash?.taxDesk ?? { links: [], statuses: [], notices: [] };
          const gstLinked = td.links.some(l => l.portal === "gst" && l.status === "linked"), itLinked = td.links.some(l => l.portal === "it" && l.status === "linked");
          const unfiled = td.statuses.filter(s => s.portal === "gst" && s.status === "not_filed").length;
          return (
            <section aria-labelledby="taxdesk" style={tile}>
              <h2 id="taxdesk" style={{ ...h2, fontSize: 18 }}>Tax desk</h2>
              <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                {!gstLinked && !itLinked ? "Connect the GST and Income-tax portals to see filing status and notices here." : `${gstLinked ? (unfiled ? `${unfiled} GST return${unfiled > 1 ? "s" : ""} not filed.` : "GST returns up to date.") : "GST portal not connected."} ${itLinked ? "Income-tax portal connected." : ""}`}
                {" "}{td.notices.length ? `${td.notices.length} notice${td.notices.length > 1 ? "s are" : " is"} saved on your Shelf.` : "No open notices."}
              </span>
              {td.notices.slice(0, 2).map(n => (
                <Link key={n.id} href="/finance/shelf?rack=notices" style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>• {n.title}{n.reply_due ? ` — reply by ${new Date(n.reply_due + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</Link>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                <Link href="/finance/portals" style={ghostBtn}>Portal Connect →</Link>
                <Link href="/finance/shelf?rack=notices" style={ghostBtn}>Notices</Link>
              </div>
            </section>
          );
        })()}
      </div>

      {/* Recent entries · Insight */}
      <div className="hd-lower">
        <section aria-labelledby="recent" style={{ ...tile, padding: 0, gap: 0 }}>
          <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 id="recent" style={{ ...h2, fontSize: 18 }}>Recent entries</h2>
            <Link href="/finance/books" style={{ fontSize: 12.5, color: C.gold, fontWeight: 700, textDecoration: "none" }}>Day book →</Link>
          </div>
          {!dash ? <div style={{ padding: "4px 20px 18px", fontSize: 13.5, color: C.muted }}>Loading…</div>
            : dash.recent.length === 0 ? <div style={{ padding: "4px 20px 18px", fontSize: 13.5, color: C.muted }}>No posted entries yet. <Link href="/finance/chat-book" style={{ color: C.green, fontWeight: 700 }}>Record one →</Link></div>
            : dash.recent.slice(0, 6).map(t => (
              <Link key={t.id} href={`/finance/journals?id=${t.id}`} style={{ display: "flex", gap: 12, padding: "10px 20px", borderTop: `1px solid ${C.line}`, textDecoration: "none", color: C.ink, fontSize: 13, alignItems: "center" }}>
                <span style={{ color: C.muted, whiteSpace: "nowrap", minWidth: 50, fontFamily: MONO, fontSize: 12 }}>{new Date(t.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.narration || t.entry_no}</span>
                <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{num(t.amount)}</span>
              </Link>
            ))}
        </section>

        <section aria-labelledby="insight" style={{ ...tile, background: C.goldSoft, border: "none" }}>
          <span style={eyebrow}>Insight</span>
          <h2 id="insight" style={{ ...h2, fontSize: 19, lineHeight: 1.3 }}>{dash?.insight ? dash.insight.text : dash ? "No unusual spending this month" : "Reading your books…"}</h2>
          {dash?.insight ? (() => {
            const spark = dash.insight.spark, max = Math.max(1, ...spark);
            return (
              <>
                <svg viewBox="0 0 280 60" preserveAspectRatio="none" style={{ width: "100%", height: 60 }} aria-hidden="true">
                  <polyline fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={spark.map((v, i) => `${(i / Math.max(1, spark.length - 1)) * 270 + 5},${55 - (v / max) * 48}`).join(" ")} />
                  {spark.length > 0 && <circle cx={275} cy={55 - (spark[spark.length - 1] / max) * 48} r="4" fill={C.gold} />}
                </svg>
                <div style={{ display: "flex", gap: 14, fontSize: 12.5, fontWeight: 700 }}>
                  <Link href={`/finance/chat-book?q=${encodeURIComponent(`Why is ${dash.insight.account} higher this month?`)}`} style={{ color: C.green }}>See why →</Link>
                  <Link href={dash.insight.href} style={{ color: C.gold }}>Open ledger</Link>
                </div>
              </>
            );
          })() : <span style={{ fontSize: 12.5, color: C.muted }}>Each expense is compared with its 6-month average; anything 30% higher shows here.</span>}
        </section>
      </div>
    </div>
  );
}
