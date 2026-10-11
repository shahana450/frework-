"use client";
import { dueText, dueChip } from "@/lib/dueText";
// FreBook home — Bento grid. White and light-grey tiles, navy and orange accents. Every figure comes from /api/finance/dashboard.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";

const C = {
  ground: "#F6F1E7", tile: "#FFFFFF", tileGrey: "#EFE8D9", line: "#E6DFD0", ink: "#10241F", muted: "#5E6B66",
  navy: "#0F2B25", navySoft: "#E4ECE8", orange: "#B07E33", orangeSoft: "#F3E8D2", orangeInk: "#8A6420",
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

/** Donut: expenses (orange) vs profit (mint) as shares of income. */
function Ring({ income, expenses, profit }: { income: number; expenses: number; profit: number }) {
  const R = 52, L = 2 * Math.PI * R;
  const exp = income > 0 ? Math.min(1, Math.max(0, expenses / income)) : profit < 0 ? 1 : 0;
  const pro = income > 0 ? Math.max(0, profit / income) : 0;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Expenses ${Math.round(exp * 100)}% of income, profit ${Math.round(pro * 100)}%`}>
      <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="14" />
      <circle cx="66" cy="66" r={R} fill="none" stroke={C.orange} strokeWidth="14" strokeDasharray={`${exp * L} ${L}`} transform="rotate(-90 66 66)" strokeLinecap="butt" />
      {pro > 0 && <circle cx="66" cy="66" r={R} fill="none" stroke="#7FE0B4" strokeWidth="14" strokeDasharray={`${pro * L} ${L}`} strokeDashoffset={-exp * L} transform="rotate(-90 66 66)" />}
    </svg>
  );
}

export default function HomeDesk({ dash, bizName, greeting, controls, dashErr, onRetry }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"record" | "ask">("record");
  const [text, setText] = useState("");
  const [showAllDues, setShowAllDues] = useState(false);
  const money = (n: number | undefined | null) => n == null ? "—" : formatMoney(n, { currency: dash?.currency ?? "INR", locale: dash?.locale ?? "en-IN" }, { decimals: false });
  const go = (t: string) => { const v = t.trim(); if (v) router.push(`/finance/chat-book?q=${encodeURIComponent(v)}`); };
  const dues = dash?.compliance ?? [];
  const waiting = dash?.alerts.filter(a => a.href.includes("ai-review") || a.href.includes("draft")).length ?? 0;
  const critical = dash?.alerts.filter(a => a.tone === "bad").length ?? 0;
  const income = dash?.revenue ?? 0, spent = dash?.expenses ?? 0, profit = dash?.profit ?? 0;
  const margin = income > 0 ? Math.round((profit / income) * 100) : null;
  const spark = dash?.insight?.spark ?? [];
  const sparkMax = Math.max(1, ...spark);

  const tile: React.CSSProperties = { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 20, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
  const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted };
  const figure: React.CSSProperties = { fontFamily: MONO, fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" };

  return (
    <div className="bento-home" style={{ display: "flex", flexDirection: "column", gap: 18, color: C.ink }}>
      <style>{`
        .bento { display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0,1fr));
          grid-template-areas: "entry entry profit dues" "entry entry profit dues" "cash recv pay quick" "tax tax tax tax" "insight insight recent recent"; }
        .b-tax { grid-area: tax }
        .taxgrid { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0,1fr)); }
        @media (max-width: 1100px) { .taxgrid { grid-template-columns: minmax(0,1fr); } }
        .b-entry { grid-area: entry } .b-profit { grid-area: profit } .b-dues { grid-area: dues } .b-cash { grid-area: cash } .b-recv { grid-area: recv }
        .b-pay { grid-area: pay } .b-quick { grid-area: quick } .b-insight { grid-area: insight } .b-recent { grid-area: recent }
        @media (max-width: 1100px) { .bento { grid-template-columns: repeat(2, minmax(0,1fr)); grid-template-areas: "entry entry" "profit dues" "cash recv" "pay quick" "tax tax" "insight insight" "recent recent"; } }
        @media (max-width: 640px) { .bento { grid-template-columns: minmax(0,1fr); grid-template-areas: "entry" "quick" "profit" "dues" "cash" "recv" "pay" "tax" "insight" "recent"; } }
        .bento a.lift, .bento button.lift { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .bento a.lift:hover, .bento button.lift:hover { transform: translateY(-2px); box-shadow: 0 12px 26px -16px rgba(15,43,37,0.4); border-color: #C99A4E; }
        .bento .chip:hover { border-color: ${C.navy}; color: ${C.navy}; }
      `}</style>

      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.muted }}>
          <span>{bizName}</span><span style={{ color: "#D8CDB4" }}>/</span><span style={{ color: C.ink, fontWeight: 700 }}>Home</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{controls}</div>
      </header>

      {dashErr && <div style={{ ...tile, flexDirection: "row", alignItems: "center", color: C.warn, background: C.warnSoft, borderColor: "#FFE2A8" }}>{dashErr}{onRetry && <button onClick={onRetry} style={{ marginLeft: "auto", border: `1px solid ${C.warn}`, background: "transparent", color: C.warn, borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>Try again</button>}</div>}

      {/* Today: the few things worth doing now */}
      {dash && (() => {
        const todo: { text: string; href: string; tone: "warn" | "info" | "go" }[] = [];
        for (const al of dash.alerts.slice(0, 2)) todo.push({ text: al.text, href: al.href, tone: al.tone === "info" ? "info" : "warn" });
        const nextDue = [...(dash.gst ?? [])].sort((x, y) => x.daysLeft - y.daysLeft)[0];
        if (nextDue) todo.push({ text: `${nextDue.form} for ${nextDue.period} ${dueText(nextDue.daysLeft)}`, href: "/finance/gst/returns", tone: nextDue.daysLeft <= 5 ? "warn" : "info" });
        todo.push({ text: "Drop bank statements & bills in Smart Inbox", href: "/finance/inbox", tone: "go" });
        if (dash.recent.length < 5) todo.push({ text: "Finish setup — about 10 minutes", href: "/finance/start", tone: "go" });
        else todo.push({ text: "This month's MIS report", href: "/finance/mis", tone: "go" });
        return (
          <section aria-label="To do today" style={{ ...tile, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 14px" }}>
            <span style={{ ...label, marginRight: 4 }}>Today</span>
            {todo.map(t => (
              <Link key={t.text} href={t.href} className="lift" style={{ fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 999, textDecoration: "none", border: `1px solid ${C.line}`,
                background: t.tone === "warn" ? C.warnSoft : t.tone === "go" ? "#FFFFFF" : C.navySoft, color: t.tone === "warn" ? C.warn : C.ink }}>{t.text} →</Link>
            ))}
          </section>
        );
      })()}

      <div className="bento">
        {/* Large entry tile */}
        <section className="b-entry" aria-labelledby="hero" style={{ ...tile, padding: 24, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: critical ? "#C2321F" : waiting ? C.orange : C.pos }} />
            {greeting}{critical ? ` — ${critical} balance problem${critical > 1 ? "s" : ""} need${critical > 1 ? "" : "s"} attention` : waiting ? ` — ${waiting} item${waiting > 1 ? "s" : ""} waiting for you` : " — books are up to date"}
            {dash && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: C.navySoft, color: C.navy }}>Health {dash.health.score}{dash.streak > 0 ? ` · ${dash.streak}-day streak` : ""}</span>}
          </div>
          <h1 id="hero" style={{ margin: 0, fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(26px, 3.2vw, 40px)", lineHeight: 1.1, textWrap: "balance" }}>
            What happened in the <span style={{ fontStyle: "italic", fontWeight: 400, color: C.orange }}>business</span> today?
          </h1>
          <div style={{ background: C.tileGrey, borderRadius: 18, padding: 6, display: "flex", flexDirection: "column" }}>
            <div role="tablist" style={{ display: "flex", gap: 4, padding: "4px 4px 0" }}>
              {(["record", "ask"] as const).map(m => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} style={{ height: 32, padding: "0 14px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: mode === m ? C.tile : "transparent", color: mode === m ? C.navy : C.muted, boxShadow: mode === m ? "0 1px 3px rgba(20,26,58,0.12)" : "none" }}>
                  {m === "record" ? "Record" : "Ask your books"}
                </button>
              ))}
            </div>
            <label htmlFor="cmd" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Describe a transaction or ask a question</label>
            <textarea id="cmd" rows={3} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(text); } }}
              placeholder={mode === "record" ? "Paid office rent ₹25,000 from the bank for October" : "Who owes me for more than 60 days?"}
              style={{ display: "block", width: "100%", boxSizing: "border-box", resize: "none", border: "none", outline: "none", background: "transparent", padding: "12px 12px 4px", fontSize: 17, lineHeight: 1.5, color: C.ink }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 6px" }}>
              <Link href="/finance/chat-book?snap=1" aria-label="Snap a bill" title="Snap a bill" style={{ width: 40, height: 40, borderRadius: 11, background: C.tile, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </Link>
              <span style={{ fontSize: 12, color: C.muted }}>Enter to {mode === "record" ? "draft" : "ask"}</span>
              <button onClick={() => go(text)} disabled={!text.trim()} style={{ marginLeft: "auto", height: 42, padding: "0 20px", borderRadius: 12, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: text.trim() ? "pointer" : "default", opacity: text.trim() ? 1 : 0.55 }}>
                {mode === "record" ? "Draft entry →" : "Ask →"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(mode === "record" ? ["Received ₹1.2L from a customer", "Paid salaries for last month", "Bought stationery ₹1,800 in cash"] : ["Who owes me for more than 60 days?", "Profit this month vs last month", "GST collected last month"]).map(c => (
              <button key={c} className="chip" onClick={() => mode === "ask" ? go(c) : setText(c)} style={{ height: 34, padding: "0 13px", borderRadius: 17, border: `1px solid ${C.line}`, background: C.tile, color: C.muted, fontSize: 12.5, cursor: "pointer" }}>{c}</button>
            ))}
          </div>
        </section>

        {/* Navy net-profit tile with ring chart */}
        <Link href="/finance/reports?tab=profit_loss" className="b-profit lift" style={{ ...tile, background: "linear-gradient(160deg, #1B4237 0%, #0F2B25 60%, #0B211C 100%)", border: "none", color: "#FFFFFF", textDecoration: "none", justifyContent: "space-between" }}>
          <div style={{ ...label, color: "#D9B56F" }}>{profit < 0 ? "Net loss" : "Net profit"} · {dash?.period.label ?? "this period"}</div>
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
            <Ring income={income} expenses={spent} profit={profit} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600 }}>{margin == null ? "—" : `${margin}%`}</span>
              <span style={{ fontSize: 11, color: "#C9D3CE" }}>margin</span>
            </div>
          </div>
          <div>
            <div style={{ ...figure, color: "#FFFFFF" }}>{money(profit)}</div>
            <div style={{ display: "flex", gap: 14, fontSize: 12.5, marginTop: 6, color: "#E7ECE9", flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#7FE0B4", marginRight: 6 }} />Income {money(income)}</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.orange, marginRight: 6 }} />Spent {money(spent)}</span>
            </div>
          </div>
        </Link>

        {/* Tall due-dates tile */}
        <section className="b-dues" style={{ ...tile, background: C.tileGrey, border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={label}>Due dates</span>
            {dues.some(d => d.daysLeft < 0) && <span style={{ fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: C.negSoft, color: C.neg }}>{dues.filter(d => d.daysLeft < 0).length} overdue</span>}
          </div>
          {!dash ? <div style={{ fontSize: 13, color: C.muted }}>Checking…</div>
            : dues.length === 0 ? <div style={{ fontSize: 13, color: C.pos, fontWeight: 600 }}>✓ Nothing due in the next few weeks.</div>
            : (showAllDues ? dues : dues.slice(0, 6)).map(d => {
              const t = d.filed ? [C.posSoft, C.pos, "Filed ✓"] : d.daysLeft < 0 ? [C.negSoft, C.neg, dueChip(d.daysLeft)] : d.daysLeft <= 3 ? [C.negSoft, C.neg, dueChip(d.daysLeft)] : d.daysLeft <= 10 ? [C.orangeSoft, C.orangeInk, `${d.daysLeft}d`] : [C.tile, C.navy, `${d.daysLeft}d`];
              return (
                <Link key={d.key} href={d.href} title={d.filed ? `Filed${d.filed.on ? " on " + d.filed.on : ""}${d.filed.arn ? " · ARN " + d.filed.arn : ""}${d.filed.demo ? " (demo data)" : ""}` : d.note} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: C.tile, opacity: d.filed ? 0.75 : 1, textDecoration: "none", color: C.ink }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 38, flexShrink: 0 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: C.orange, textTransform: "uppercase" }}>{new Date(d.due + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, lineHeight: 1 }}>{d.due.slice(8)}</span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.period}{d.amount ? ` · ${money(d.amount)}` : ""}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 7px", borderRadius: 6, background: t[0], color: t[1], whiteSpace: "nowrap" }}>{t[2]}</span>
                </Link>
              );
            })}
          {dues.length > 6 && <button onClick={() => setShowAllDues(s => !s)} style={{ alignSelf: "flex-start", border: "none", background: "none", color: C.navy, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>{showAllDues ? "Show fewer" : `See all ${dues.length}`}</button>}
          {dash?.complianceSetup?.country === "IN" && (!dash.complianceSetup.gst || !dash.complianceSetup.tds) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {!dash.complianceSetup.gst && <Link href="/finance/settings/business" style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, textDecoration: "none", padding: "8px 10px", borderRadius: 10, border: "1px dashed #D8CDB4", background: C.tile }}>＋ Add GSTIN to get GSTR-1 / 3B reminders</Link>}
              {!dash.complianceSetup.tds && <Link href="/finance/settings/business" style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, textDecoration: "none", padding: "8px 10px", borderRadius: 10, border: "1px dashed #D8CDB4", background: C.tile }}>＋ Add TAN to get TDS deposit &amp; return reminders</Link>}
              <span style={{ fontSize: 11.5, color: C.muted }}>PF/ESI and Professional tax reminders appear once salary entries are posted.</span>
            </div>
          )}
          <div style={{ marginTop: "auto", fontSize: 11, color: C.muted }}>Standard dates — check for extensions.</div>
        </section>

        {/* Tax desk: GST filings, Income-tax filing, notices */}
        {dash && (() => {
          const td = dash.taxDesk ?? { links: [], statuses: [], notices: [] };
          const st = (s: string): [string, string, string] => ({ filed: [C.posSoft, C.pos, "Filed"], e_verified: [C.posSoft, C.pos, "E-verified"], processed: [C.posSoft, C.pos, "Processed"], issued: [C.posSoft, C.pos, "Issued"], not_filed: [C.warnSoft, C.warn, "Not filed"] } as Record<string, [string, string, string]>)[s] ?? [C.tileGrey, C.muted, s.replace(/_/g, " ")];
          const fmtD = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
          const mon = (p: string) => /^\d{4}-\d{2}$/.test(p) ? new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) : p;
          const demo = td.statuses.some(s => s.demo);
          const box: React.CSSProperties = { background: C.tileGrey, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };
          const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 11, background: C.tile, fontSize: 13, textDecoration: "none", color: C.ink };
          const pill = (s: string) => { const [bg, fg, t] = st(s); return <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, padding: "3px 7px", borderRadius: 6, background: bg, color: fg, whiteSpace: "nowrap" }}>{t}</span>; };
          const connect = (what: string) => <Link href="/finance/portals" style={{ ...row, border: "1px dashed #D8CDB4", fontWeight: 700, color: C.navy }}>＋ Connect {what} for live status</Link>;
          const gstLinked = td.links.some(l => l.portal === "gst" && l.status === "linked"), itLinked = td.links.some(l => l.portal === "it" && l.status === "linked");
          const gstMonths = [...new Set(td.statuses.filter(s => s.portal === "gst" && s.kind === "return").map(s => s.period))].sort().reverse().slice(0, 3);
          const itRows = td.statuses.filter(s => s.portal === "it").slice(0, 3);
          return (
            <section className="b-tax" style={tile}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={label}>Tax desk · GST · Income tax · Notices</span>
                {demo && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: C.orangeSoft, color: C.orangeInk }}>DEMO DATA</span>}
                <Link href="/finance/portals" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: C.navy, textDecoration: "none" }}>Portal Connect →</Link>
              </div>
              <div className="taxgrid">
                <div style={box}>
                  <b style={{ fontSize: 14 }}>GST filing</b>
                  {!gstLinked ? connect("GST portal") : gstMonths.length === 0 ? <span style={{ fontSize: 13, color: C.muted }}>No returns fetched yet.</span>
                    : gstMonths.map(p => (
                      <div key={p} style={{ ...row, flexWrap: "wrap" }}>
                        <b style={{ width: 52 }}>{mon(p)}</b>
                        {["GSTR-1", "GSTR-3B"].map(f => { const r = td.statuses.find(s => s.portal === "gst" && s.form === f && s.period === p); const [bg, fg, t] = st(r?.status ?? "—"); return (
                          <span key={f} title={r?.arn ? `ARN ${r.arn}` : undefined} style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: r ? bg : C.tileGrey, color: r ? fg : C.muted }}>{f.replace("GSTR-", "")}: {r ? t : "—"}{r?.filed_on ? ` ${fmtD(r.filed_on)}` : ""}</span>
                        ); })}
                      </div>
                    ))}
                </div>
                <div style={box}>
                  <b style={{ fontSize: 14 }}>Income-tax filing</b>
                  {!itLinked ? connect("Income-tax portal") : itRows.length === 0 ? <span style={{ fontSize: 13, color: C.muted }}>No filings fetched yet.</span>
                    : itRows.map((r, i) => (
                      <div key={i} style={row} title={r.arn ? `Ack ${r.arn}` : undefined}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{r.kind === "refund" ? "Refund" : "ITR"}</b> · {r.period}{r.kind === "refund" && r.amount ? ` · ${money(r.amount)}` : ""}{r.filed_on ? ` · ${fmtD(r.filed_on)}` : ""}</span>
                        {pill(r.status)}
                      </div>
                    ))}
                </div>
                <div style={box}>
                  <b style={{ fontSize: 14 }}>Notices (GST / IT)</b>
                  {td.notices.length === 0 ? <span style={{ fontSize: 13, color: C.pos, fontWeight: 600 }}>✓ No open notices</span>
                    : td.notices.map(n => {
                      const dl = n.reply_due ? Math.round((Date.parse(n.reply_due) - Date.now()) / 86400000) : null;
                      return (
                        <Link key={n.id} href="/finance/shelf?rack=notices" style={row}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{n.title}</b>{n.authority ? ` · ${n.authority}` : ""}</span>
                          {dl != null && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, padding: "3px 7px", borderRadius: 6, background: dl <= 3 ? C.negSoft : C.orangeSoft, color: dl <= 3 ? C.neg : C.orangeInk, whiteSpace: "nowrap" }}>{dl < 0 ? `${-dl}d late` : `Reply ${fmtD(n.reply_due)}`}</span>}
                        </Link>
                      );
                    })}
                  <Link href="/finance/shelf?rack=notices" style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, textDecoration: "none" }}>＋ Add a notice to the Shelf</Link>
                </div>
              </div>
            </section>
          );
        })()}

        {/* Small tiles: cash, to receive, to pay */}
        {[
          { cls: "b-cash", label: "Cash & bank", v: dash?.cash, sub: "Today", href: "/finance/banking", tone: (dash?.cash ?? 0) < 0 ? C.neg : C.muted },
          { cls: "b-recv", label: "To receive", v: dash?.receivables, sub: "Collect with reminders →", href: "/finance/collect", tone: C.orange },
          { cls: "b-pay", label: "To pay", v: dash?.payables, sub: "Suppliers", href: "/finance/payables", tone: C.muted },
        ].map(k => (
          <Link key={k.cls} href={k.href} className={`${k.cls} lift`} style={{ ...tile, textDecoration: "none", color: C.ink, gap: 6 }}>
            <span style={label}>{k.label}</span>
            <span style={figure}>{money(k.v)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: k.tone }}>{k.sub}</span>
          </Link>
        ))}

        {/* Quick actions */}
        <section className="b-quick" style={{ ...tile, gap: 10 }}>
          <span style={label}>Quick add</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
            {[
              { t: "Sale", href: "/finance/sales/new" }, { t: "Purchase", href: "/finance/purchases/new" },
              { t: "Receipt", href: "/finance/chat-book?prefill=Received%20" }, { t: "Payment", href: "/finance/payment" },
            ].map((q, i) => (
              <Link key={q.t} href={q.href} className="lift" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 13.5,
                background: i === 0 ? C.navy : C.tileGrey, color: i === 0 ? "#FFFFFF" : C.navy, border: "1px solid transparent" }}>
                <span style={{ color: i === 0 ? "#FFB08A" : C.orange, fontSize: 16, lineHeight: 1 }}>＋</span>{q.t}
              </Link>
            ))}
          </div>
        </section>

        {/* Orange insight panel with a small trend chart */}
        <section className="b-insight" style={{ ...tile, background: `linear-gradient(150deg, #F57A3F 0%, ${C.orange} 60%, #DD5420 100%)`, border: "none", color: "#FFFFFF" }}>
          <span style={{ ...label, color: "#FFE3D4" }}>Insight</span>
          {dash?.insight ? (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{dash.insight.text}</div>
              <svg viewBox="0 0 280 70" preserveAspectRatio="none" style={{ width: "100%", height: 70 }} aria-hidden="true">
                <polyline fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                  points={spark.map((v, i) => `${(i / Math.max(1, spark.length - 1)) * 270 + 5},${65 - (v / sparkMax) * 58}`).join(" ")} />
                {spark.length > 0 && <circle cx={275} cy={65 - (spark[spark.length - 1] / sparkMax) * 58} r="4.5" fill="#FFFFFF" />}
              </svg>
              <div style={{ display: "flex", gap: 14, fontSize: 13, fontWeight: 700 }}>
                <Link href={`/finance/chat-book?q=${encodeURIComponent(`Why is ${dash.insight.account} higher this month?`)}`} style={{ color: "#FFFFFF" }}>See why →</Link>
                <Link href={dash.insight.href} style={{ color: "#FFE3D4" }}>Open ledger</Link>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{dash ? "No unusual spending this month" : "Reading your books…"}</div>
              <div aria-label="Last 14 days of recording" style={{ display: "grid", gridTemplateColumns: "repeat(14, minmax(0,1fr))", gap: 4, alignItems: "end", height: 46 }}>
                {(dash?.activity ?? Array(14).fill(false)).map((on, i) => <span key={i} style={{ height: on ? "100%" : "30%", borderRadius: 4, background: on ? "#FFFFFF" : "rgba(255,255,255,0.35)" }} />)}
              </div>
              <div style={{ fontSize: 12.5, color: "#FFE3D4" }}>Each expense is compared with its 6-month average; anything 30% higher shows here.</div>
            </>
          )}
        </section>

        {/* Recent entries */}
        <section className="b-recent" style={{ ...tile, padding: 0, gap: 0 }}>
          <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={label}>Recent entries</span>
            <Link href="/finance/books" style={{ fontSize: 13, color: C.navy, fontWeight: 700, textDecoration: "none" }}>Day book →</Link>
          </div>
          {!dash ? <div style={{ padding: "4px 20px 18px", fontSize: 14, color: C.muted }}>Loading…</div>
            : dash.recent.length === 0 ? <div style={{ padding: "4px 20px 18px", fontSize: 14, color: C.muted }}>No posted entries yet. <Link href="/finance/chat-book" style={{ color: C.navy, fontWeight: 700 }}>Record one →</Link></div>
            : dash.recent.slice(0, 6).map(t => (
              <Link key={t.id} href={`/finance/journals?id=${t.id}`} style={{ display: "flex", gap: 12, padding: "10px 20px", borderTop: `1px solid ${C.line}`, textDecoration: "none", color: C.ink, fontSize: 13.5, alignItems: "center" }}>
                <span style={{ color: C.muted, whiteSpace: "nowrap", minWidth: 50, fontFamily: MONO, fontSize: 12 }}>{new Date(t.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.narration || t.entry_no}</span>
                <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 600 }}>{money(t.amount)}</span>
              </Link>
            ))}
        </section>
      </div>

      {/* Needs attention (only when something does) */}
      {dash && dash.alerts.length > 0 && (
        <section style={{ ...tile, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "14px 18px" }}>
          <span style={{ ...label, color: C.orangeInk }}>Needs attention</span>
          {dash.alerts.slice(0, 4).map((a, i) => (
            <Link key={i} href={a.href} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: a.tone === "bad" ? C.negSoft : a.tone === "warn" ? C.orangeSoft : C.navySoft, color: a.tone === "bad" ? C.neg : a.tone === "warn" ? C.orangeInk : C.navy, fontSize: 12.5, fontWeight: 600, textDecoration: "none", maxWidth: "100%" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>{a.text}</span><b style={{ whiteSpace: "nowrap" }}>{a.action} →</b>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
