"use client";
import { activeCountry, cur } from "@/lib/money";
import { dueChip } from "@/lib/dueText";
// FreBook home — a desk, read top to bottom: the question, books at a glance, what needs you today, what's coming up.
// Cream ground, deep green and gold. Every figure comes from /api/finance/dashboard.
import { useState, useEffect } from "react";
import { useTally, tallyLabel } from "@/lib/tallyConnection";
import Link from "next/link";
import { useBrand } from "@/lib/brand";
import { useRouter } from "next/navigation";
import { gstReturnLink } from "@/lib/gstIntent";
import { setPendingFiles } from "@/lib/pendingFile";
import NewsTicker from "@/components/finance/NewsTicker";
import TypeLine from "@/components/finance/TypeLine";
import type { Dashboard } from "@/lib/dashboard";

const LIGHT = {
  ground: "#F4EFE4", tile: "#FFFDF8", line: "#E6DFD0", ink: "#10241F", muted: "#5E6B66",
  green: "#12352D", greenSoft: "#E4ECE8", gold: "#9A6B22", goldSoft: "#F3E8D2", goldLine: "#C99A4E",
  pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB",
  // Books at a glance: FreBook's deep green panel
  gBg: "#12352D", gBorder: "none", gShadow: "none", gInk: "#F4EFE4", gStrong: "#FFFFFF", gMuted: "#B9C7C1", gHead: "#D9B56F",
  gRule: "rgba(255,255,255,0.14)", gRuleSoft: "rgba(255,255,255,0.1)", gNeg: "#F3A58F", gPos: "#A8F0CF", gBtnLine: "rgba(255,255,255,0.25)", gBtnBg: "transparent",
};
// BooksAI's Home: Sapphire & Platinum, light — white cards, sapphire type and accents, a soft blue summary panel
const SAPPHIRE: typeof LIGHT = {
  ground: "#EEF2FA", tile: "#FFFFFF", line: "#DCE3F0", ink: "#0D1E52", muted: "#5B6785",
  green: "#1F4FD1", greenSoft: "#E8EEFB", gold: "#2F5BD8", goldSoft: "#EAF0FF", goldLine: "#9DB3EA",
  pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB",
  gBg: "linear-gradient(135deg,#F4F7FF 0%,#E7EEFF 100%)", gBorder: "1px solid #D3DDF5", gShadow: "0 18px 40px -30px rgba(31,79,209,0.55)",
  gInk: "#22305C", gStrong: "#0D1E52", gMuted: "#6A7696", gHead: "#2F5BD8",
  gRule: "#C9D5F2", gRuleSoft: "#DCE4F7", gNeg: "#C2321F", gPos: "#0B7A55", gBtnLine: "#C3D1F2", gBtnBg: "#FFFFFF",
};
let C = LIGHT;
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
  const b = useBrand();
  const brand = b.name;
  C = b.key === "cswa" ? SAPPHIRE : LIGHT;
  const router = useRouter();
  const tally = useTally();
  const [mode, setMode] = useState<"record" | "ask">("record");
  // Opened from WhatsApp: recording happens in the chat, so only "Ask" is offered here
  const [fromWa, setFromWa] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem("fw_from_wa") === "1") { setFromWa(true); setMode("ask"); } } catch { /* */ } }, []);
  const [text, setText] = useState("");
  const [allDues, setAllDues] = useState(false);
  const [allNeeds, setAllNeeds] = useState(false);
  // A GST return request opens the GST page on that return and month; everything else goes to the FreBook chat
  const go = (t: string) => { const v = t.trim(); if (!v) return; const gst = gstReturnLink(v); router.push(gst ?? `/finance/chat-book?q=${encodeURIComponent(v)}`); };

  // Figures as accountants write them: grouped, no symbol (the card says the unit), negatives in brackets
  const locale = dash?.locale ?? "en-IN";
  const num = (n: number | undefined | null) => n == null ? "—" : (() => { const s = `${cur()}${Math.round(Math.abs(n)).toLocaleString(locale)}`; return n < 0 ? `(${s})` : s; })();
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
    // Without the GST portal linked FreBook can't know whether it was filed — never call it late on a guess
    if (!(dash as unknown as { portalKnown?: boolean })?.portalKnown && /GSTR/i.test(d.title)) { needs.push({ tone: "warn", title: `${d.title} for ${d.period} — was due ${new Date(d.due + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, sub: "Status unknown — connect the GST portal to check whether it was filed", action: "Connect portal", href: "/finance/portals" }); continue; }
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
        .hd-main { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1.2fr); }
        .hd-glance { display: grid; gap: 28px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .hd-dues { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(0, 1fr)); }
        .hd-bottom { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .hd-lower { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        @media (max-width: 1100px) { .hd-main { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .hd-main > :last-child { grid-column: 1 / -1; } .hd-lower { grid-template-columns: minmax(0, 1fr); } .hd-dues { grid-template-columns: repeat(3, minmax(0, 1fr)); } .hd-bottom { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) {
          .hd-glance, .hd-bottom { grid-template-columns: minmax(0, 1fr); }
          .hd-dues { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 72%; overflow-x: auto; scrollbar-width: none; }
          .hd-main { grid-template-columns: minmax(0, 1fr) !important; } .hd-main > :last-child { grid-column: auto; } .hd-entry textarea { min-height: 70px !important; font-size: 17px !important; } .hd-tip, .hd-sugg { display: none; }
          .hd-h1 { font-size: 26px !important; }
        }
        .hd-pulse { border-radius: 28px; padding: clamp(18px, 2.4vw, 28px); background: radial-gradient(700px 300px at 100% 0%, rgba(233,194,122,0.14), rgba(233,194,122,0) 60%), linear-gradient(160deg, #0A1F1B 0%, #0C2622 60%, #0F2E28 100%); color: #FFFFFF; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 30px 60px -34px rgba(6,26,22,0.75); }
        .hd-glass { min-width: 0; border-radius: 22px; padding: 22px 24px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); display: flex; flex-direction: column; gap: 4px; color: #FFFFFF; }
        .hd-pill-ic { width: 44px; height: 44px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: #DCE9E3; display: flex; align-items: center; justify-content: center; }
        .hd-pill-ic:hover { background: rgba(255,255,255,0.1); }
        .hd-hero::after { content: ""; position: absolute; right: -40px; top: -20px; width: 62%; height: 120%; pointer-events: none; background-image: radial-gradient(rgba(233,194,122,0.55) 1.2px, transparent 1.6px); background-size: 14px 14px; -webkit-mask-image: radial-gradient(ellipse 60% 45% at 65% 55%, #000 10%, transparent 70%); mask-image: radial-gradient(ellipse 60% 45% at 65% 55%, #000 10%, transparent 70%); transform: skewY(-8deg); opacity: .85; }
        .hd-hero > * { position: relative; z-index: 1; }
        @media (max-width: 640px) { .hd-hero::after { display: none; } }
        .hd-dshort, .hd-s { display: none; }
        @media (max-width: 640px) {
          .hd-hero { padding: 22px 18px 18px !important; border-radius: 24px !important; }
          .hd-dlong, .hd-tag, .hd-l { display: none; } .hd-dshort, .hd-s { display: inline; }
          .hd-date { font-size: 11px !important; letter-spacing: .2em !important; }
          .hd-h1 { font-size: 30px !important; line-height: 1.1 !important; }
          .hd-bizline { flex-direction: column; align-items: flex-start !important; gap: 6px !important; }
          .hd-biz { font-size: 13.5px; letter-spacing: .02em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .hd-tallyco { display: none; }
          .hd-controls { margin-left: 0 !important; width: 100%; display: grid !important; grid-template-columns: auto minmax(0,1fr); gap: 8px !important; margin-top: 6px; }
          .hd-controls > * { min-width: 0; }
          .hd-fylab { display: none; }
          .hd-controls > label { padding: 0 5px !important; }
          .hd-controls > select { width: 100%; height: 40px !important; border-radius: 999px !important; padding: 0 14px !important; }
          .hd-controls > [role=group] { grid-column: 1 / -1; display: flex !important; width: 100%; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg,#000 85%,transparent); mask-image: linear-gradient(90deg,#000 85%,transparent); }
          .hd-controls > [role=group]::-webkit-scrollbar { display: none; }
          .hd-controls > [role=group] > * { flex-shrink: 0; }
          .hd-entry { margin-top: 16px !important; padding: 12px 14px 14px !important; border-radius: 20px !important; }
          .hd-acts { display: grid !important; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px !important; }
          .hd-acts > .chip { justify-content: center; padding: 0 8px !important; height: 40px !important; font-size: 13.5px !important; }
          .hd-go { grid-column: 1 / -1; margin-left: 0 !important; width: 100%; justify-content: space-between; height: 52px !important; font-size: 16px !important; }
        }
        .hd a.lift, .hd button.lift { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .hd a.lift:hover, .hd button.lift:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -16px rgba(18,53,45,0.45); }
        .hd .chip:hover { border-color: ${C.green}; color: ${C.green}; }
        .hd .glink { color: #E8DCC2; } .hd .glink:hover { color: #FFFFFF; }
        .hd :focus-visible { outline: 2px solid ${C.goldLine}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .hd .lift { transition: none !important } }
      `}</style>

      {/* Tax & finance news, running along the top */}
      <NewsTicker />

      {/* Hero: greeting and the Record / Ask box on a deep panel */}
      <section aria-label="Record or ask" className="hd-hero" style={{ position: "relative", overflow: "hidden", background: C.green, borderRadius: 26, padding: "clamp(20px,3vw,34px)", color: "#F4EFE4", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
        <span aria-hidden="true" style={{ position: "absolute", right: -10, top: -40, fontFamily: SERIF, fontSize: 300, lineHeight: 1, color: "rgba(255,255,255,0.05)", pointerEvents: "none" }}>{cur().trim() || "₹"}</span>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="hd-date" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#D9B56F", whiteSpace: "nowrap" }}>
            <span aria-hidden="true" style={{ width: 28, height: 1.5, background: "#D9B56F" }} />
            <span className="hd-dlong">{today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            <span className="hd-dshort">{today.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="hd-tag" style={{ letterSpacing: "0.04em", textTransform: "none", fontStyle: "italic", fontWeight: 600, color: "#C9D3CE", marginLeft: 6 }}>· Chat in. Books out.</span>
          </span>
          <h1 className="hd-h1" style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px, 4vw, 54px)", lineHeight: 1.08, textWrap: "balance", color: "#FFFDF8" }}>
            {greeting}.<br />What happened in the business <span style={{ fontStyle: "italic", color: "#D9B56F" }}>today</span>?
          </h1>
          <TypeLine className="hd-type" lead={`${brand} can`} style={{ fontFamily: SERIF, fontSize: "clamp(17px, 1.7vw, 22px)", color: "#DCE6E2", minHeight: "1.5em" }}
            phrases={india
              ? ["record a sale from one sentence", "read your bank statement line by line", "draft GSTR-1 and GSTR-3B", "match purchases with GSTR-2B", "chase payments on WhatsApp", "value your closing stock", "check TDS against Form 26AS", "push entries to Tally"]
              : ["record a sale from one sentence", "read your bank statement line by line", "chase payments on WhatsApp", "value your closing stock", "spot duplicate entries", "prepare your P&L and balance sheet"]} />
          <div className="hd-bizline" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: "#C9D3CE" }}>
            <Link href="/finance/select-business" title="Switch business" className="hd-biz" style={{ color: "#F4EFE4", textDecoration: "none", fontWeight: 600 }}>{bizName}<span className="hd-swap" aria-hidden="true" style={{ color: "#D9B56F", marginLeft: 6 }}>⇄</span></Link>
            <span className="hd-tally" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: tally.status === "connected" ? "#5BD39B" : "#A9B1AD" }} />{tallyLabel(tally).split(" · ")[0]}<span className="hd-tallyco">{tallyLabel(tally).split(" · ").slice(1).length ? ` · ${tallyLabel(tally).split(" · ").slice(1).join(" · ")}` : ""}</span>
            </span>
            <div className="hd-controls" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>{controls}</div>
          </div>
        </div>

        <div className="hd-entry" style={{ position: "relative", marginTop: 20, background: "#FBF7EE", borderRadius: 20, padding: "14px 18px 16px", color: C.ink, boxShadow: "0 24px 50px -30px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div role="tablist" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: "#EFE6D3" }}>
              {(fromWa ? ["ask"] as const : ["record", "ask"] as const).map(m => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} style={{ height: 34, padding: "0 18px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13.5, background: mode === m ? C.green : "transparent", color: mode === m ? "#FFFFFF" : C.muted }}>
                  {m === "record" ? "Record" : "Ask"}
                </button>
              ))}
            </div>
            <span className="hd-tip" style={{ fontSize: 12.5, color: C.muted }}>{mode === "record" ? `Write it the way you'd say it — ${brand} drafts the voucher.` : "Ask anything about your books."}</span>
          </div>
          <textarea id="hd-chat" aria-label="Describe a transaction or ask a question" rows={2} value={text} onChange={e => { setText(e.target.value); const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 320) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(text); } }}
            placeholder={mode === "record" ? (india ? "e.g. Paid office rent ₹25,000 from the bank for October" : `e.g. Paid office rent ${cur()}2,500 from the bank for October`) : "e.g. Who owes me for more than 60 days?"}
            style={{ width: "100%", minHeight: 70, resize: "vertical", boxSizing: "border-box", border: "none", outline: "none", background: "transparent", padding: "12px 2px", fontSize: 20, lineHeight: 1.5, color: C.ink, fontFamily: SERIF }} />
          <div className="hd-acts" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            {!fromWa && <label title="Attach a bill, invoice, bank or loan statement, GSTR-2B or an Excel template — FreBook AI reads it" className="chip" style={{ height: 34, padding: "0 14px", borderRadius: 999, border: `1px solid ${C.ink}`, background: C.ink, color: "#FFFFFF", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E9C27A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9" /></svg>
              <span className="hd-l">Attach file</span><span className="hd-s">Attach</span>
              <input type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv,.json,.doc,.docx,.txt" style={{ display: "none" }} onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (!fs.length) return; setPendingFiles(fs); router.push("/finance/chat-book?attach=1"); }} />
            </label>}
            {!fromWa && <Link href="/finance/chat-book?templates=1" title="Many entries at once: download the Excel template, fill it, attach it" className="chip" style={{ height: 34, padding: "0 14px", borderRadius: 999, border: `1px solid ${C.goldLine}`, background: "#FFF6E3", display: "inline-flex", alignItems: "center", gap: 7, color: C.ink, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M10 4v16" /></svg>
              <span className="hd-l">Bulk entries · Excel template</span><span className="hd-s">Excel</span>
            </Link>}
            {!fromWa && <Link href="/finance/chat-book?snap=1" aria-label="Snap a bill" title="Take a photo of a bill" className="chip" style={{ height: 34, padding: "0 14px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#FFFFFF", display: "inline-flex", alignItems: "center", gap: 7, color: C.ink, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              <span className="hd-l">Snap a bill</span><span className="hd-s">Snap</span>
            </Link>}
            {(mode === "record" ? (india ? ["Received ₹1.2L from a customer", "Paid salaries for last month", "Bought stationery ₹1,800 in cash"] : [`Received ${cur()}12,000 from a customer`, "Paid salaries for last month", `Bought stationery ${cur()}180 in cash`]) : ["Who owes me for more than 60 days?", "Profit this month vs last month", "GST collected last month"]).map(c => (
              <button key={c} className="chip hd-sugg" onClick={() => mode === "ask" ? go(c) : setText(c)} style={{ height: 34, padding: "0 14px", borderRadius: 999, border: `1px dashed ${C.goldLine}`, background: "transparent", color: C.muted, fontSize: 12.5, cursor: "pointer" }}>{c}</button>
            ))}
            <button className="hd-go" onClick={() => go(text)} disabled={!text.trim()} style={{ marginLeft: "auto", height: 48, flexShrink: 0, padding: "0 8px 0 22px", borderRadius: 999, border: "none", background: C.green, color: "#FFFFFF", fontWeight: 800, fontSize: 15, cursor: text.trim() ? "pointer" : "default", opacity: text.trim() ? 1 : 0.75, display: "inline-flex", alignItems: "center", gap: 12 }}>
              {mode === "record" ? "Draft entry" : "Ask"}
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 999, background: "#D9B56F", color: C.green, display: "grid", placeItems: "center", fontSize: 16 }}>→</span>
            </button>
          </div>
        </div>
      </section>

      {dashErr && <div style={{ ...tile, flexDirection: "row", alignItems: "center", color: C.warn, background: C.warnSoft, borderColor: "#FFE2A8" }}>{dashErr}{onRetry && <button onClick={onRetry} style={{ marginLeft: "auto", border: `1px solid ${C.warn}`, background: "transparent", color: C.warn, borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>Try again</button>}</div>}

      {/* Business pulse — one deep panel: KPIs, position, P&L split, what needs you, what's coming */}
      <section aria-labelledby="pulse" className="hd-pulse">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 id="pulse" style={{ margin: 0, fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: "#FFFFFF" }}>Business pulse</h2>
            <span style={{ fontSize: 13, color: "#9DB8AE" }}>{dash?.period.label ?? "This year"} · figures in brackets are negative</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/finance/journals" aria-label="Search entries" className="hd-pill-ic"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5 21 21" /></svg></Link>
            <Link href="/finance/reminders" aria-label="Reminders" className="hd-pill-ic" style={{ position: "relative" }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4" /></svg>{needs.length > 0 && <span style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: 999, background: "#E9C27A", boxShadow: "0 0 8px #E9C27A" }} />}</Link>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <Link href="/finance/reports?tab=profit_loss" className="lift" style={{ borderRadius: 20, padding: "18px 20px", background: "linear-gradient(145deg, #FFFBF1, #F3E3BF)", color: "#0B2C25", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 16px 34px -20px rgba(233,194,122,0.7)", textDecoration: "none" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#5B4A2A" }}>Net result</span>
            <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: profit < 0 ? "#B3261E" : "#0B5E42", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{dash ? num(profit) : "—"}</span>
            <span style={{ alignSelf: "flex-start", height: 24, padding: "0 10px", borderRadius: 999, background: profit < 0 ? "rgba(179,38,30,0.12)" : "rgba(11,94,66,0.12)", color: profit < 0 ? "#9A1F18" : "#0B5E42", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>{profit < 0 ? "Net loss" : "Net profit"}</span>
            <span style={{ fontSize: 12, color: "#5B4A2A" }}>{income === 0 && spent === 0 ? "No income or expenses posted yet" : ratioNote}</span>
          </Link>
          {([
            ["Income", income, "Year to date", "/finance/reports?tab=profit_loss", 1, "linear-gradient(90deg,#3FD3A6,#7FE6C4)"],
            ["Expenses", spent, income > 0 ? `${spent > income ? "About " + (spent / income).toFixed(1).replace(/\.0$/, "") + "×" : Math.round((spent / income) * 100) + "% of"} income` : "This year", "/finance/reports?tab=profit_loss", income > 0 ? Math.min(1, spent / Math.max(income, spent)) : 1, "linear-gradient(90deg,#E9C27A,#F3D9A2)"],
            ["Cash & bank", dash?.cash ?? 0, "Position today", "/finance/banking", 1, "linear-gradient(90deg,#3FD3A6,#E9C27A)"],
          ] as [string, number, string, string, number, string][]).map(([label, v, chip, href, frac, bar]) => (
            <Link key={label} href={href} className="lift" style={{ borderRadius: 20, padding: "18px 20px", background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.10)", display: "flex", flexDirection: "column", gap: 10, textDecoration: "none" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#B9D0C7" }}>{label}</span>
              <span style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 700, lineHeight: 1, color: v < 0 ? "#FF9A8B" : "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>{dash ? num(v) : "—"}</span>
              <span style={{ alignSelf: "flex-start", height: 24, padding: "0 10px", borderRadius: 999, background: "rgba(63,211,166,0.12)", color: "#9FE6CC", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>{chip}</span>
              <span style={{ display: "block", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.max(6, frac * 100)}%`, background: bar, borderRadius: 999 }} /></span>
            </Link>
          ))}
        </div>

        {/* Position today + P&L split */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <div className="hd-glass" style={{ flex: "2 1 520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>Position today</h3>
              <span style={{ fontSize: 12, color: "#9DB8AE" }}>(brackets) = negative</span>
            </div>
            {([
              { k: "Cash & bank", v: dash?.cash, href: "/finance/banking", chip: (dash?.cash ?? 0) < 0 ? "Overdrawn" : "", note: "the bank / cash ledgers are overdrawn; check missing receipts" },
              { k: "Receivables", v: dash?.receivables, href: "/finance/receivables", chip: (dash?.receivables ?? 0) < 0 ? "Customers in credit" : "", note: "customers paid more than invoiced; check advances and missing invoices" },
              { k: "Payables", v: dash?.payables, href: "/finance/payables", chip: (dash?.payables ?? 0) < 0 ? "Suppliers in debit" : "", note: "more paid to suppliers than billed; check advances and missing bills" },
            ]).map(r => (
              <Link key={r.k} href={r.href} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#DCE9E3" }}>{r.k}{r.chip && <span style={{ height: 22, padding: "0 10px", borderRadius: 999, background: "rgba(255,138,122,0.14)", border: "1px solid rgba(255,138,122,0.35)", color: "#FFB4A8", fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>{r.chip}</span>}</span>
                  <span style={{ fontFamily: SERIF, fontSize: r.k === "Cash & bank" ? 28 : 24, fontWeight: 700, color: (r.v ?? 0) < 0 ? "#FF9A8B" : "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>{dash ? num(r.v) : "—"}</span>
                </span>
                {(r.v ?? 0) < 0
                  ? <span style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.5, color: "#FFC7BE" }}><span aria-hidden="true">⚠</span>Balance on the wrong side — {r.note}.</span>
                  : r.k === "Cash & bank" && <span aria-hidden="true" style={{ display: "block", height: 6, borderRadius: 999, background: "linear-gradient(90deg, #3FD3A6, #E9C27A)", boxShadow: "0 0 14px rgba(233,194,122,0.5)" }} />}
              </Link>
            ))}
          </div>
          <Link href="/finance/reports?tab=profit_loss" className="hd-glass" style={{ flex: "1 1 300px", textDecoration: "none", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>Profit &amp; Loss</h3>
              <span style={{ fontSize: 12, color: "#E9C27A" }}>{dash?.period.label ?? ""}</span>
            </div>
            {(() => {
              const tot = Math.max(1, income + spent), inc = income / tot, R = 54, L = 2 * Math.PI * R;
              return (
                <div style={{ display: "grid", placeItems: "center", position: "relative", margin: "6px 0" }}>
                  <svg width="150" height="150" viewBox="0 0 140 140" aria-hidden="true">
                    <circle cx="70" cy="70" r={R} fill="none" stroke="#E9C27A" strokeWidth="14" />
                    <circle cx="70" cy="70" r={R} fill="none" stroke="#3FD3A6" strokeWidth="14" strokeDasharray={`${inc * L} ${L}`} transform="rotate(-90 70 70)" strokeLinecap="round" />
                  </svg>
                  <span style={{ position: "absolute", textAlign: "center" }}>
                    <span style={{ display: "block", fontSize: 10.5, letterSpacing: "0.16em", color: "#9DB8AE" }}>{profit < 0 ? "NET LOSS" : "NET PROFIT"}</span>
                    <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: profit < 0 ? "#FF9A8B" : "#FFFFFF" }}>{dash ? num(profit) : "—"}</span>
                  </span>
                </div>
              );
            })()}
            {([["Income", income, "#3FD3A6"], ["Expenses", spent, "#E9C27A"]] as [string, number, string][]).map(([k, v, c]) => (
              <span key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#DCE9E3" }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: c }} />{k}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{num(v)}</span></span>
            ))}
          </Link>
        </div>

        {/* Needs you today + Coming up */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <div className="hd-glass" style={{ flex: "2 1 520px", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 id="needs" style={{ margin: 0, fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>Needs you today</h3>
              {needs.length > 0 && <span style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid #E9C27A", color: "#E9C27A", fontFamily: SERIF, fontSize: 15, display: "grid", placeItems: "center" }}>{needs.length}</span>}
            </div>
            {!dash ? <span style={{ fontSize: 13, color: "#9DB8AE" }}>Checking your books…</span>
              : needs.length === 0 ? <span style={{ fontSize: 14, color: "#A8F0CF", fontWeight: 700 }}>✓ Nothing needs you right now.</span>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                {(allNeeds ? needs : needs.slice(0, 2)).map((n, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span aria-hidden="true" style={{ fontFamily: SERIF, color: "#E9C27A", fontSize: 16, minWidth: 18 }}>{["I", "II", "III", "IV", "V", "VI"][i] ?? i + 1}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.4 }}>{n.title}</span>
                      {n.sub && <span style={{ fontSize: 12.5, color: "#B9D0C7" }}>{n.sub}</span>}
                      <Link href={n.href} style={{ fontSize: 13, fontWeight: 800, color: "#E9C27A", textDecoration: "none" }}>{n.action} →</Link>
                    </div>
                  </div>
                ))}
              </div>}
            {needs.length > 2 && <button onClick={() => setAllNeeds(v => !v)} style={{ height: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#FFFFFF", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{allNeeds ? "Show fewer" : `View all ${needs.length} items`}</button>}
          </div>
          <div className="hd-glass" style={{ flex: "1 1 300px", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 id="coming" style={{ margin: 0, fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>Coming up</h3>
              {dues.length > 3 && <button onClick={() => setAllDues(s => !s)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#E9C27A", fontFamily: "inherit" }}>{allDues ? "Fewer" : `All ${dues.length} →`}</button>}
            </div>
            {!dash ? <span style={{ fontSize: 13, color: "#9DB8AE" }}>Checking…</span>
              : dues.length === 0 ? <span style={{ fontSize: 13, color: "#A8F0CF", fontWeight: 600 }}>✓ Nothing due in the next few weeks.</span>
              : (allDues ? dues : dues.slice(0, 3)).map(d => {
                const unknown = d.daysLeft < 0 && !d.filed && /GSTR/i.test(d.title) && !(dash as unknown as { portalKnown?: boolean })?.portalKnown;
                const late = d.daysLeft < 0 && !d.filed && !unknown;
                const chip = d.filed ? "Filed ✓" : unknown ? "Status unknown" : late ? "Overdue" : d.daysLeft <= 3 ? dueChip(d.daysLeft) : `${d.daysLeft} days`;
                const dt = new Date(d.due + "T00:00:00");
                return (
                  <Link key={d.key} href={d.href} title={d.note} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, background: "linear-gradient(145deg, #FFFBF1, #F3E3BF)", color: "#0B2C25", textDecoration: "none", opacity: d.filed ? 0.8 : 1 }}>
                    <span style={{ width: 48, height: 48, borderRadius: 12, background: "#0B2C25", color: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{String(dt.getDate()).padStart(2, "0")}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", color: "#E9C27A" }}>{dt.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{d.title}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "#5B4A2A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.period}{d.amount ? ` · ${money(d.amount)}` : ""}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: late ? "#B3261E" : "#0B2C25", color: "#FFFFFF", whiteSpace: "nowrap" }}>{chip}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </section>
      {dash?.complianceSetup?.country === "IN" && (!dash.complianceSetup.gst || !dash.complianceSetup.tds) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!dash.complianceSetup.gst && <Link href="/finance/settings/business" style={{ ...ghostBtn, borderStyle: "dashed" }}>＋ Add GSTIN for GSTR-1 / 3B reminders</Link>}
          {!dash.complianceSetup.tds && <Link href="/finance/settings/business" style={{ ...ghostBtn, borderStyle: "dashed" }}>＋ Add TAN for TDS reminders</Link>}
        </div>
      )}

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
          <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Drop bank statements, bills and invoices — {brand} reads them and drafts the entries for you to confirm.</span>
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
              <Link key={t.id} href={`/finance/entry/${t.id}`} style={{ display: "flex", gap: 12, padding: "10px 20px", borderTop: `1px solid ${C.line}`, textDecoration: "none", color: C.ink, fontSize: 13, alignItems: "center" }}>
                <span style={{ color: C.muted, whiteSpace: "nowrap", minWidth: 50, fontFamily: MONO, fontSize: 12 }}>{new Date(t.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.narration || t.entry_no}</span>
                <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{num(t.amount)}</span>
              </Link>
            ))}
        </section>

        <section aria-labelledby="insight" style={{ ...tile, background: C.goldSoft, border: "none" }}>
          <span style={eyebrow}>Insight</span>
          <h2 id="insight" style={{ ...h2, fontSize: 19, lineHeight: 1.3 }}>{dash?.insight ? dash.insight.text : dash ? "Nothing unusual in the recent spending" : "Reading your books…"}</h2>
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
