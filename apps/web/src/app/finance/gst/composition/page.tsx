"use client";
// Composition scheme: CMP-08 quarterly payment and the GSTR-4 annual total.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cmp08, COMPOSITION_RATES } from "@/lib/gstReturns";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", gold: "#D9B56F" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The last six completed calendar quarters (Jan–Mar, Apr–Jun, …), newest first. */
function quarters() {
  const now = new Date();
  const qStart = Math.floor(now.getMonth() / 3) * 3;
  return [1, 2, 3, 4, 5, 6].map(back => {
    const end = new Date(now.getFullYear(), qStart - 3 * (back - 1), 0);             // last day of an earlier quarter
    const months = [2, 1, 0].map(i => { const x = new Date(end.getFullYear(), end.getMonth() - i, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
    const due = new Date(end.getFullYear(), end.getMonth() + 1, 18);
    const first = new Date(`${months[0]}-01T00:00:00`);
    return { label: `${first.toLocaleDateString("en-IN", { month: "short" })}–${end.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`, months, due: due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) };
  });
}

export default function CompositionPage() {
  const router = useRouter();
  const qs = quarters();
  const [bizId, setBizId] = useState("");
  const [q, setQ] = useState(0);
  const [cat, setCat] = useState<string>("trader");
  const [turnover, setTurnover] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; } setBizId(saved);
    });
  }, [router]);
  // Turnover for the quarter = sales in the books for its three months
  useEffect(() => {
    if (!bizId) return;
    setLoading(true);
    Promise.all(qs[q].months.map(m => fetch(`/api/finance/gst?business_id=${bizId}&month=${m}&report=summary`).then(r => r.json()).catch(() => ({}))))
      .then(rs => setTurnover(Math.round(rs.reduce((s, r) => s + (Number(r.total_sales) || 0), 0) * 100) / 100)).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, q]);

  const rate = COMPOSITION_RATES.find(r => r.key === cat)!.rate;
  const r = cmp08(turnover, rate);
  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px" };
  const field: React.CSSProperties = { height: 40, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 10px", fontFamily: "inherit", fontSize: 14 };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(16px,3vw,32px)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Link href="/finance/gst/returns" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#8A6420", textDecoration: "none" }}>← GST RETURNS</Link>
          <h1 style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", fontWeight: 700 }}>Composition — CMP-08 &amp; GSTR-4</h1>
        </div>
        <section style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: C.muted }}>Quarter
            <select value={q} onChange={e => setQ(Number(e.target.value))} style={field}>{qs.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}</select></label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: C.muted }}>Business type
            <select value={cat} onChange={e => setCat(e.target.value)} style={field}>{COMPOSITION_RATES.map(x => <option key={x.key} value={x.key}>{x.label} — {(x.rate * 100).toFixed(0)}%</option>)}</select></label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: C.muted }}>Turnover this quarter (₹){loading ? " — reading books…" : ""}
            <input inputMode="decimal" value={turnover || ""} onChange={e => setTurnover(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} style={{ ...field, width: 180, fontFamily: "'IBM Plex Mono',monospace" }} /></label>
        </section>
        <section style={{ ...card, background: C.forest, color: "#FFFFFF" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, fontWeight: 800 }}>CMP-08 · {qs[q].label} · due {qs[q].due}</div>
          <div style={{ fontFamily: SERIF, fontSize: "2.2rem", fontWeight: 700, margin: "6px 0" }}>{inr(r.total)}</div>
          <div style={{ fontSize: 14, color: "#C9D3CE" }}>Central tax {inr(r.cgst)} · State/UT tax {inr(r.sgst)} · on turnover {inr(r.turnover)} at {(rate * 100).toFixed(0)}%</div>
        </section>
        <section style={card}>
          <b>How to file</b>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8, fontSize: 14 }}>
            <li>GST portal → Services → Returns → Statement for payment of self-assessed tax (CMP-08).</li>
            <li>Enter the outward turnover and tax above; add reverse-charge purchases if any.</li>
            <li>Pay the cash amount through the challan, then file with EVC/DSC by the 18th after the quarter.</li>
            <li>GSTR-4 (annual) is due by 30 April: it adds up the four CMP-08 statements and your purchases.</li>
          </ol>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Composition dealers can&apos;t collect GST on invoices or claim ITC. Check your category&apos;s rate before filing.</div>
        </section>
      </div>
    </div>
  );
}
