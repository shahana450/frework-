"use client";
// Monthly recap: the month as a few story slides, the slides you choose, and one-tap sharing with partners or the CA.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Recap } from "@/lib/recap";
import { formatMoney } from "@/lib/money";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

type SlideKey = "sales" | "spend" | "profit" | "bestday";
const SLIDES: { key: SlideKey; title: string; desc: string }[] = [
  { key: "sales", title: "Sales & collections", desc: "Billed this month and what customers paid" },
  { key: "spend", title: "Where the money went", desc: "The biggest expense head for the month" },
  { key: "profit", title: "Profit for the month", desc: "Net profit and margin from the P&L" },
  { key: "bestday", title: "Best sales day", desc: "The day with the most sales" },
];

export default function RecapPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [bizName, setBizName] = useState("");
  const [offset, setOffset] = useState(-1);
  const [data, setData] = useState<{ recap: Recap | null; currency: string; locale: string } | null>(null);
  const [err, setErr] = useState("");
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [on, setOn] = useState<Record<SlideKey, boolean>>({ sales: true, spend: true, profit: true, bestday: true });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz);
      supabase.from("fw_fin_businesses").select("name").eq("id", biz).maybeSingle().then(({ data: b }) => setBizName(b?.name ?? ""));
      try { const s = JSON.parse(localStorage.getItem(`fw_recap_slides_${biz}`) ?? "null"); if (s) setOn(o => ({ ...o, ...s })); } catch { /* defaults */ }
    });
  }, [router]);

  useEffect(() => {
    if (!bizId) return;
    setData(null); setErr(""); setI(0);
    fetch(`/api/finance/recap?business_id=${bizId}&offset=${offset}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "Couldn't build the recap."); else setData(d);
    });
  }, [bizId, offset]);

  const r = data?.recap ?? null;
  const fmt = (n: number) => formatMoney(n, { currency: data?.currency ?? "INR", locale: data?.locale ?? "en-IN" }, { decimals: false });
  const monthLabel = (o: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + o); return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };
  const toggle = (k: SlideKey) => setOn(o => { const n = { ...o, [k]: !o[k] }; try { localStorage.setItem(`fw_recap_slides_${bizId}`, JSON.stringify(n)); } catch { /* */ } return n; });

  type Slide = { key: SlideKey; tag: string; lead: string; big: string; body: string; bar?: { label: string; value: string; pct: number; rest: string } };
  const all: Slide[] = r ? [
    { key: "sales", tag: "Sales", lead: "You billed", big: fmt(r.revenue),
      body: r.revenueChangePct == null ? "The first month with income to compare." : `${r.revenueChangePct >= 0 ? "↑" : "↓"} ${Math.abs(r.revenueChangePct)}% on the month before (${fmt(r.prevRevenue)}) · ${r.entries} entr${r.entries === 1 ? "y" : "ies"}`,
      bar: r.revenue > 0 ? { label: "Collected", value: fmt(r.collected), pct: Math.min(1, r.collected / r.revenue), rest: fmt(Math.max(0, r.revenue - r.collected)) } : undefined },
    ...(r.topExpense ? [{ key: "spend" as const, tag: "Where it went", lead: "Your biggest expense was", big: r.topExpense.name, body: `${fmt(r.topExpense.amount)} this month.` }] : []),
    { key: "profit", tag: r.profit >= 0 ? "Profit" : "Loss", lead: r.profit >= 0 ? "You kept" : "You spent more than you earned by", big: fmt(Math.abs(r.profit)), body: r.marginPct != null ? `A ${r.marginPct}% margin on your income.` : "No income was recorded this month." },
    ...(r.bestDay ? [{ key: "bestday" as const, tag: "Best day", lead: "Your best sales day", big: new Date(r.bestDay.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }), body: `${fmt(r.bestDay.revenue)} in sales.` }] : []),
  ] : [];
  const slides = all.filter(s => on[s.key]);
  const n = slides.length;
  const s = slides[Math.min(i, Math.max(0, n - 1))];

  // Slides move on by themselves every 5 seconds unless paused
  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => setI(k => (k + 1) % n), 5000);
    return () => clearTimeout(t);
  }, [i, n, paused]);

  const text = r ? `${r.month} recap — ${bizName || "FreBook"}\nIncome: ${fmt(r.revenue)}${r.revenueChangePct != null ? ` (${r.revenueChangePct >= 0 ? "+" : ""}${r.revenueChangePct}%)` : ""}\n${r.profit >= 0 ? "Profit" : "Loss"}: ${fmt(Math.abs(r.profit))}${r.marginPct != null ? ` (${r.marginPct}% margin)` : ""}\nCollected: ${fmt(r.collected)}\nEntries: ${r.entries}${r.topExpense ? `\nBiggest expense: ${r.topExpense.name} ${fmt(r.topExpense.amount)}` : ""}\n\nFrom FreBook — posted entries only.` : "";
  const T = HT;
  const btn = (primary: boolean, dark = false): React.CSSProperties => ({ height: 48, padding: "0 22px", borderRadius: 999, fontFamily: SERIF, fontSize: 15.5, cursor: r ? "pointer" : "not-allowed", opacity: r ? 1 : 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center",
    border: primary ? "none" : `1px solid ${dark ? "rgba(255,255,255,0.35)" : "#D9C68F"}`, background: primary ? T.gold : "transparent", color: primary ? T.ink : dark ? "#FFFFFF" : "#6B5320", fontWeight: primary ? 700 : 400 });

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SERIF }}>
      <style>{`@media print { .no-print { display: none !important } aside, nav.fw-topicons, .fw-tabs { display: none !important } main.fw-main { margin-left: 0 !important } header, .rc-card { -webkit-print-color-adjust: exact; print-color-adjust: exact } }
        .rc-main { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start }`}</style>
      <PageHero eyebrow="Reports · monthly recap" title="Your month, as a story"
        sub="Sales, spend and profit for the month in a few slides. Send it to partners or your CA in one tap."
        actions={<div className="no-print" role="group" aria-label="Month" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
          <button type="button" aria-label="Previous month" onClick={() => setOffset(o => o - 1)} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: "transparent", color: "#FFFFFF", cursor: "pointer", fontSize: 18 }}>‹</button>
          <select aria-label="Recap month" value={offset} onChange={e => setOffset(Number(e.target.value))} style={{ fontFamily: SERIF, fontSize: 17, padding: "10px 16px", borderRadius: 999, border: "none", background: T.cream, color: T.green }}>
            {Array.from({ length: 13 }, (_, k) => -k).map(o => <option key={o} value={o}>{monthLabel(o)}{o === 0 ? " (so far)" : ""}</option>)}
          </select>
          <button type="button" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset(o => Math.min(0, o + 1))} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: "transparent", color: "#FFFFFF", cursor: offset >= 0 ? "default" : "pointer", opacity: offset >= 0 ? 0.4 : 1, fontSize: 18 }}>›</button>
        </div>} />

      <main className="rc-main" style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 28px 64px" }}>
        <section aria-label="Recap story" style={{ flex: "0 1 420px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, margin: "0 auto" }}>
          <div className="rc-card" style={{ width: "100%", maxWidth: 400, minHeight: 680, boxSizing: "border-box", borderRadius: 28, background: T.green, color: "#FFFFFF", padding: "22px 26px 28px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <svg width="320" height="320" viewBox="0 0 320 320" aria-hidden="true" style={{ position: "absolute", right: -120, top: 150 }}><circle cx="160" cy="160" r="135" fill="none" stroke="rgba(201,162,74,0.16)" strokeWidth="40" /></svg>
            <div aria-label={`Slide ${Math.min(i, n - 1) + 1} of ${n}`} style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, n)},1fr)`, gap: 5, marginBottom: 18 }}>
              {(n ? slides : [null]).map((_, k) => <span key={k} style={{ height: 3, borderRadius: 2, background: k <= i ? T.gold : "rgba(244,239,230,0.25)" }} />)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
              <span style={{ fontSize: 15 }}>Fre<span style={{ color: T.gold }}>Book</span>{bizName ? ` · ${bizName}` : ""}</span>
              {n > 0 && <span style={{ fontSize: 13, color: "#C8D3CC" }}>{Math.min(i, n - 1) + 1} / {n}</span>}
            </div>
            <button type="button" onClick={() => n && setI(k => (k + 1) % n)} aria-label="Next slide" style={{ all: "unset", cursor: n ? "pointer" : "default", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, position: "relative" }}>
              {err ? <span style={{ color: "#F0A792" }}>{err}</span>
                : !data ? <span style={{ color: "#C8D3CC", fontStyle: "italic" }}>Reading your books…</span>
                : !r ? <><span style={{ fontSize: 34, fontStyle: "italic" }}>Nothing recorded in {monthLabel(offset)}</span><span style={{ color: "#D9E2DC", fontSize: 16 }}>Record a few entries and the recap appears here.</span></>
                : !s ? <span style={{ fontSize: 24, fontStyle: "italic" }}>Turn on a slide on the right to see it here.</span>
                : <>
                  <span style={{ fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: T.gold }}>{r.month} · {s.tag}</span>
                  <span style={{ fontSize: 38, lineHeight: 1.1, fontStyle: "italic" }}>{s.lead}</span>
                  <span style={{ fontSize: s.big.length > 14 ? 38 : 54, lineHeight: 1.05, color: T.gold, wordBreak: "break-word" }}>{s.big}</span>
                  <span style={{ fontSize: 17, color: "#D9E2DC", lineHeight: 1.5 }}>{s.body}</span>
                  {s.bar && <span style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#D9E2DC" }}><span>{s.bar.label}</span><span>{s.bar.value}</span></span>
                    <span style={{ height: 8, borderRadius: 4, background: "rgba(244,239,230,0.15)" }}><span style={{ display: "block", width: `${Math.round(s.bar.pct * 100)}%`, height: 8, borderRadius: 4, background: "#9FD8B8" }} /></span>
                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#D9E2DC" }}><span>Still to collect</span><span>{s.bar.rest}</span></span>
                  </span>}
                </>}
            </button>
            {n > 1 && <span style={{ fontSize: 13, color: "#C8D3CC", position: "relative" }}>Tap the card for the next slide</span>}
          </div>
          {n > 1 && <div className="no-print" style={{ display: "flex", gap: 10 }}>
            <button type="button" aria-label="Previous slide" onClick={() => setI(k => (k - 1 + n) % n)} style={{ width: 48, height: 48, borderRadius: "50%", border: "1px solid #D9C68F", background: T.paper, color: T.green, cursor: "pointer", fontSize: 18 }}>‹</button>
            <button type="button" onClick={() => setPaused(p => !p)} style={{ fontFamily: SERIF, fontSize: 15, padding: "0 22px", height: 48, borderRadius: 999, border: "1px solid #D9C68F", background: T.paper, color: "#6B5320", cursor: "pointer" }}>{paused ? "Play" : "Pause"}</button>
            <button type="button" aria-label="Next slide" onClick={() => setI(k => (k + 1) % n)} style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: T.green, color: "#FFFFFF", cursor: "pointer", fontSize: 18 }}>›</button>
          </div>}
        </section>

        <div className="no-print" style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 24 }}>
          <section aria-label="Slides in this recap" style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 18, padding: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontStyle: "italic", fontWeight: 400, color: T.green }}>Slides in this recap</h2>
              <span style={{ fontSize: 14, color: "#5A6862" }}>{SLIDES.filter(x => on[x.key]).length} of {SLIDES.length} on</span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#5A6862" }}>Choose what partners and your CA see. Order follows this list.</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {SLIDES.map(x => {
                const has = all.some(a => a.key === x.key);
                return (
                  <li key={x.key} style={{ borderTop: "1px solid #EDE4D2" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={on[x.key]} onChange={() => toggle(x.key)} style={{ width: 18, height: 18, accentColor: T.green }} />
                      <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 16 }}>{x.title}</span><span style={{ display: "block", fontSize: 13, color: "#5A6862" }}>{x.desc}</span></span>
                      {s?.key === x.key ? <span style={{ fontSize: 13, color: "#8A6A22" }}>Now showing</span> : r && !has ? <span style={{ fontSize: 13, color: "#5A6862", fontStyle: "italic" }}>No data this month</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Share" style={{ background: T.green, color: "#FFFFFF", borderRadius: 18, padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 13, letterSpacing: "0.22em", color: T.gold, marginBottom: 6 }}>SHARE</div>
              <h2 style={{ margin: 0, fontSize: 24, fontStyle: "italic", fontWeight: 400 }}>Send {r ? r.month.split(" ")[0] : "the"}&apos;s recap</h2>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <a href={r ? `https://wa.me/?text=${encodeURIComponent(text)}` : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!r} style={btn(true)}>Send on WhatsApp →</a>
              <a href={r ? `mailto:?subject=${encodeURIComponent(`${r.month} recap — ${bizName}`)}&body=${encodeURIComponent(text)}` : undefined} aria-disabled={!r} style={btn(false, true)}>Email to CA</a>
              <button type="button" disabled={!r} onClick={() => window.print()} style={btn(false, true)}>Download PDF</button>
            </div>
            <div style={{ fontSize: 13.5, color: "#C8D3CC" }}>WhatsApp and email open with the summary ready — you choose who to send it to. Download PDF opens the print window; choose “Save as PDF”.</div>
          </section>

          <section aria-label="Empty month" style={{ background: T.paper, border: "1px dashed #D9C68F", borderRadius: 18, padding: "22px 26px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
            <div style={{ flex: "1 1 280px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 19, fontStyle: "italic", fontWeight: 400, color: T.green }}>Nothing recorded for a month?</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#5A6862" }}>The recap stays empty until entries exist. Import a bank statement or upload bills to fill it.</p>
            </div>
            <Link href="/finance/banking/import" style={{ fontSize: 15, padding: "0 20px", height: 44, display: "inline-flex", alignItems: "center", borderRadius: 999, border: "1px solid #D9C68F", color: "#6B5320", textDecoration: "none" }}>Import statement</Link>
          </section>
        </div>
      </main>
    </div>
  );
}
