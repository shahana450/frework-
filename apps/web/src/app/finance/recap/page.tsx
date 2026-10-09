"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Recap } from "@/lib/recap";
import { formatMoney } from "@/lib/money";
import { FreBookBookGlyph } from "@/components/FreBookLogo";

const NAVY = "#232A63", SKY = "#7FB0FF", SOFT = "#C8D2F2";
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";

export default function RecapPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [offset, setOffset] = useState(-1);
  const [data, setData] = useState<{ recap: Recap | null; currency: string; locale: string } | null>(null);
  const [err, setErr] = useState("");
  const [i, setI] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz);
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

  const slides = r ? [
    { tag: r.revenueChangePct != null && r.revenueChangePct > 0 ? `${r.revenueChangePct}% up on the month before` : "Your month in numbers", lead: "You brought in", big: fmt(r.revenue),
      body: r.revenueChangePct == null ? "This is the first month with income to compare." : `That's ${Math.abs(r.revenueChangePct)}% ${r.revenueChangePct >= 0 ? "more" : "less"} than the month before (${fmt(r.prevRevenue)}).` },
    { tag: r.profit >= 0 ? "Profit" : "Loss", lead: r.profit >= 0 ? "You kept" : "You spent more than you earned by", big: fmt(Math.abs(r.profit)),
      body: r.marginPct != null ? `A ${r.marginPct}% margin on your income.` : "No income was recorded this month." },
    { tag: "Collections", lead: "Customers paid you", big: fmt(r.collected), body: `Across ${r.entries} entr${r.entries === 1 ? "y" : "ies"} recorded this month.` },
    ...(r.topExpense ? [{ tag: "Where it went", lead: "Your biggest expense was", big: r.topExpense.name, body: `${fmt(r.topExpense.amount)} this month.` }] : []),
    ...(r.bestDay ? [{ tag: "Best day", lead: "Your best sales day", big: new Date(r.bestDay.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }), body: `${fmt(r.bestDay.revenue)} in sales.` }] : []),
  ] : [];
  const s = slides[Math.min(i, Math.max(0, slides.length - 1))];

  const share = async () => {
    if (!r) return;
    const text = `${r.month} recap from FreBook\nIncome: ${fmt(r.revenue)}${r.revenueChangePct != null ? ` (${r.revenueChangePct >= 0 ? "+" : ""}${r.revenueChangePct}%)` : ""}\n${r.profit >= 0 ? "Profit" : "Loss"}: ${fmt(Math.abs(r.profit))}${r.marginPct != null ? ` (${r.marginPct}% margin)` : ""}\nCollected: ${fmt(r.collected)}\nEntries: ${r.entries}${r.topExpense ? `\nBiggest expense: ${r.topExpense.name} ${fmt(r.topExpense.amount)}` : ""}`;
    try { if (navigator.share) { await navigator.share({ title: `${r.month} recap`, text }); return; } } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 420, minHeight: "min(844px, calc(100vh - 32px))", borderRadius: 28, overflow: "hidden", background: NAVY, color: "#FFFFFF", padding: "22px 22px 26px", boxSizing: "border-box", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px -30px rgba(20,26,58,0.6)" }}>
        <span aria-hidden="true" style={{ position: "absolute", right: -90, top: 150, width: 300, height: 300, borderRadius: "50%", border: "40px solid rgba(127,176,255,0.14)" }} />
        <span aria-hidden="true" style={{ position: "absolute", left: -60, bottom: 170, width: 160, height: 160, borderRadius: "50%", background: "rgba(127,176,255,0.10)" }} />

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, slides.length)}, minmax(0,1fr))`, gap: 4 }} aria-label={`Story ${i + 1} of ${slides.length}`}>
          {(slides.length ? slides : [0]).map((_, k) => <span key={k} style={{ height: 3, borderRadius: 2, background: k <= i ? "#FFFFFF" : "rgba(255,255,255,0.3)" }} />)}
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><FreBookBookGlyph size={18} /></span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Your {r?.month ?? "monthly"} recap</span>
          </div>
          <Link href="/finance" aria-label="Close" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", textDecoration: "none", fontSize: 20 }}>✕</Link>
        </div>

        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
          {err ? <div style={{ color: "#FFD2CC" }}>{err}</div>
            : !data ? <div style={{ color: SOFT }}>Reading your books…</div>
            : !r ? (
              <>
                <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700 }}>Nothing recorded that month</div>
                <div style={{ color: SOFT, fontSize: 16 }}>Record a few entries in FreBook and your recap appears here.</div>
              </>
            ) : s && (
              <button onClick={() => setI(k => (k + 1) % slides.length)} style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }} aria-label="Next">
                <span style={{ alignSelf: "flex-start", height: 28, padding: "0 12px", borderRadius: 14, background: SKY, color: "#0B1026", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center" }}>{s.tag}</span>
                <span style={{ fontSize: 16, color: SOFT, marginTop: 8 }}>{s.lead}</span>
                <span style={{ fontFamily: SERIF, fontSize: s.big.length > 14 ? 40 : 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", wordBreak: "break-word" }}>{s.big}</span>
                <span style={{ fontSize: 16, lineHeight: 1.5, color: "#DCE3F8" }}>{s.body}</span>
              </button>
            )}
        </div>

        {r && (
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
            {[{ v: String(r.entries), l: "entries recorded" }, { v: fmt(r.collected), l: "collected" }, { v: r.marginPct != null ? `${r.marginPct}%` : "—", l: "profit margin" }].map(x => (
              <div key={x.l} style={{ padding: "14px 12px", borderRadius: 16, background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.v}</div>
                <div style={{ fontSize: 12, color: SOFT, marginTop: 4 }}>{x.l}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: "relative", display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setOffset(o => o - 1)} aria-label="Previous month" style={{ width: 52, height: 52, borderRadius: 15, border: "none", background: "rgba(255,255,255,0.12)", color: "#FFFFFF", fontSize: 18, cursor: "pointer" }}>‹</button>
          <button onClick={share} disabled={!r} style={{ flex: 1, height: 52, borderRadius: 15, border: "none", background: "#FFFFFF", color: NAVY, fontSize: 15, fontWeight: 800, cursor: r ? "pointer" : "default", opacity: r ? 1 : 0.5 }}>Share with my CA</button>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="Next month" style={{ width: 52, height: 52, borderRadius: 15, border: "none", background: "rgba(255,255,255,0.12)", color: "#FFFFFF", fontSize: 18, cursor: offset >= 0 ? "default" : "pointer", opacity: offset >= 0 ? 0.4 : 1 }}>›</button>
        </div>
        <div style={{ position: "relative", textAlign: "center", fontSize: 11, color: "#AFBCE6", marginTop: 12 }}>Tap the card for the next story · from your posted entries</div>
      </div>
    </div>
  );
}
