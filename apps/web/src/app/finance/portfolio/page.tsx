"use client";
// All businesses on one screen — for owners with several businesses and CAs with many clients. Each row carries the
// same figures as that business's Home, plus what needs attention: overdue filings, the next due date, drafts.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness, setActiveBusiness, confirmBusinessSwitch } from "@/lib/activeBusiness";
import { HT, SERIF } from "@/components/finance/PageHero";

type Due = { title: string; period: string; due: string; daysLeft: number };
type Last = { period: string; on: string | null; arn: string | null } | null;
type Biz = {
  id: string; name: string; gstin: string | null; role?: string; period?: string; error?: string;
  cash?: number; receivables?: number; payables?: number; revenue?: number; expenses?: number; profit?: number; monthRevenue?: number;
  drafts?: number; pendingReview?: number; health?: number; alerts?: number; entries?: number; lastEntry?: string | null;
  overdue?: Due[]; next?: Due | null; gstr1?: Last; gstr3b?: Last;
};
type Sort = "attention" | "name" | "cash" | "receivables" | "profit";

const inr = (n?: number) => n == null ? "—" : `${n < 0 ? "(" : ""}₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}${n < 0 ? ")" : ""}`;
const short = (n?: number) => { if (n == null) return "—"; const a = Math.abs(n), s = n < 0 ? "−" : ""; return a >= 1e7 ? `${s}₹${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `${s}₹${(a / 1e5).toFixed(2)} L` : `${s}₹${Math.round(a).toLocaleString("en-IN")}`; };
const mon = (p: string) => new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const day = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const score = (b: Biz) => (b.error ? 100 : 0) + (b.overdue?.length ?? 0) * 20 + ((b.cash ?? 0) < 0 ? 10 : 0) + (b.drafts ? 5 : 0) + (b.next && b.next.daysLeft <= 3 ? 8 : 0);

export default function Portfolio() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [active, setActive] = useState("");
  const [rows, setRows] = useState<Biz[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("attention");
  const [only, setOnly] = useState<"all" | "attention">("all");

  const load = () => {
    setRows(null); setErr("");
    fetch("/api/finance/portfolio").then(r => r.json().then(d => ({ ok: r.ok, d }))).then(({ ok, d }) => { if (!ok) setErr(d.error ?? "Couldn't load."); else setRows(d.businesses ?? []); }).catch(() => setErr("Couldn't load."));
  };
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUid(user.id); setActive((readActiveBusiness(user.id) ?? "").trim());
      load();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const open = async (b: Biz, href: string) => {
    if (b.id !== active && !(await confirmBusinessSwitch(uid, b.id, b.name))) return;
    setActiveBusiness(uid, b.id, b.name);
    router.push(href);
  };

  const ok = (rows ?? []).filter(b => !b.error);
  const tot = (k: keyof Biz) => ok.reduce((s, b) => s + (Number(b[k]) || 0), 0);
  const needs = (b: Biz) => !!b.error || (b.overdue?.length ?? 0) > 0 || (b.cash ?? 0) < 0 || (b.drafts ?? 0) > 0 || (!!b.next && b.next.daysLeft <= 3);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (rows ?? []).filter(b => (!s || `${b.name} ${b.gstin ?? ""}`.toLowerCase().includes(s)) && (only === "all" || needs(b)));
    const by: Record<Sort, (a: Biz, b: Biz) => number> = {
      attention: (a, b) => score(b) - score(a) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name),
      cash: (a, b) => (b.cash ?? 0) - (a.cash ?? 0), receivables: (a, b) => (b.receivables ?? 0) - (a.receivables ?? 0), profit: (a, b) => (b.profit ?? 0) - (a.profit ?? 0),
    };
    return [...list].sort(by[sort]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, only]);
  const overdueTotal = ok.reduce((s, b) => s + (b.overdue?.length ?? 0), 0);

  const words = (n: number) => {
    const a = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const t = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    return n < 20 ? a[n] : n < 100 ? t[Math.floor(n / 10)] + (n % 10 ? `-${a[n % 10].toLowerCase()}` : "") : String(n);
  };
  const GOLD = "#D9B56F", INK = "#1F3B2D";
  const sel: React.CSSProperties = { height: 48, borderRadius: 999, border: `1px solid ${HT.line}`, padding: "0 18px", fontFamily: "inherit", fontSize: 15, background: "#FFFDF8", color: HT.ink };
  const pill = (on: boolean): React.CSSProperties => ({ ...sel, cursor: "pointer", background: on ? INK : "#FFFDF8", color: on ? "#FFFFFF" : HT.ink, borderColor: on ? INK : HT.line });

  return (
    <div style={{ minHeight: "100vh", background: "#F4EEE2", fontFamily: SERIF, color: HT.ink }}>
      <style>{`.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:22px}.pf-card{transition:transform .15s,box-shadow .15s}.pf-card:hover{transform:translateY(-2px);box-shadow:0 18px 40px -28px rgba(31,59,45,.55)}
        .pf-tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px}@media(max-width:900px){.pf-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
        .pf-btn:hover{border-color:${GOLD} !important}`}</style>
      <header style={{ background: INK, color: "#F6F1E7" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "44px clamp(16px,4vw,60px) 40px" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase" }}>FreBook · All businesses</div>
              <h1 style={{ margin: "12px 0 10px", fontWeight: 400, fontSize: "clamp(36px,5vw,58px)", lineHeight: 1.04, color: "#FFFFFF" }}>
                {rows ? `${words(rows.length)} business${rows.length === 1 ? "" : "es"},` : "Your businesses,"}<br /><span style={{ fontStyle: "italic", color: GOLD }}>one glance.</span>
              </h1>
              <p style={{ margin: 0, maxWidth: 720, fontSize: 17, lineHeight: 1.6, color: "#E3E8E3" }}>The same figures as each business&apos;s Home, side by side — and what needs you in each. Open one to work in it.</p>
            </div>
            <button onClick={load} className="pf-btn" style={{ height: 48, padding: "0 24px", borderRadius: 999, border: "none", background: GOLD, color: INK, fontFamily: "inherit", fontSize: 16, cursor: "pointer" }}>Refresh</button>
          </div>
          {rows && (
            <div className="pf-tiles" style={{ borderTop: "1px solid rgba(255,255,255,0.18)", marginTop: 36, paddingTop: 26 }}>
              {([["Businesses", String(rows.length), `${rows.filter(needs).length} need attention`, false], ["Cash & bank", short(tot("cash")), "", tot("cash") < 0], ["Customers owe", short(Math.max(0, tot("receivables"))), "", false], ["Owed to suppliers", short(Math.max(0, tot("payables"))), "", false]] as [string, string, string, boolean][]).map(([k, v, sub, neg]) => (
                <div key={k}><div style={{ fontSize: 14, color: "#E3E8E3" }}>{k}</div><div style={{ fontSize: "clamp(30px,3.6vw,46px)", lineHeight: 1.15, color: neg ? "#F3A58F" : "#FFFFFF" }}>{v}</div>{sub && <div style={{ fontSize: 13, color: "#E3E8E3", fontWeight: 700 }}>{sub}</div>}</div>
              ))}
              <div><div style={{ fontSize: 14, color: "#E3E8E3" }}>Overdue filings</div>
                <span style={{ display: "inline-grid", placeItems: "center", minWidth: 52, height: 52, padding: "0 6px", marginTop: 4, borderRadius: 999, background: overdueTotal ? GOLD : "rgba(255,255,255,0.12)", color: overdueTotal ? INK : "#FFFFFF", fontSize: 34 }}>{overdueTotal}</span></div>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "30px clamp(16px,4vw,60px) 70px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a business by name or GSTIN" aria-label="Find a business" style={{ ...sel, flex: "1 1 300px" }} />
          <button style={pill(only === "all")} onClick={() => setOnly("all")}>All</button>
          <button style={pill(only === "attention")} onClick={() => setOnly("attention")}>Needs attention</button>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort" style={sel}>
            <option value="attention">Most urgent first</option><option value="name">Name A–Z</option><option value="cash">Cash & bank</option><option value="receivables">Receivables</option><option value="profit">Profit</option>
          </select>
        </div>
        {err && <div role="alert" style={{ background: "#FBE3DE", color: "#8A2A1A", borderRadius: 18, padding: 18 }}>{err}</div>}
        {!rows && !err && <div style={{ background: "#FFFDF8", borderRadius: 22, padding: 30, color: HT.muted, fontStyle: "italic" }}>Reading every business&apos;s books…</div>}
        {rows && !shown.length && <div style={{ background: "#FFFDF8", borderRadius: 22, padding: 30, color: HT.muted }}>{rows.length ? "No business matches." : "No businesses yet."}</div>}

        <div className="pf-grid">
          {shown.map(b => {
            const od = b.overdue?.[0];
            const tiles = [["Cash & bank", b.cash], ["Customers owe", b.receivables], ["Owed to suppliers", b.payables], [`${(b.profit ?? 0) < 0 ? "Loss" : "Profit"} · ${b.period ?? ""}`, b.profit]] as [string, number | undefined][];
            return (
              <article key={b.id} className="pf-card" style={{ background: "#FFFDF8", border: `1px solid ${b.id === active ? GOLD : "#ECE3D0"}`, borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {od && <div style={{ background: "#EEE1B6", color: INK, padding: "12px 22px", display: "flex", gap: 8, fontSize: 15 }}>
                  <b>Overdue</b><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {od.title} {od.period}{(b.overdue?.length ?? 0) > 1 ? ` +${(b.overdue?.length ?? 0) - 1} more` : ""}</span><span>{-od.daysLeft} day{od.daysLeft === -1 ? "" : "s"}</span>
                </div>}
                <div style={{ padding: "22px 22px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 12, background: "#C9A24A", color: INK, display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>{(b.name.trim()[0] ?? "?").toUpperCase()}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                      <div style={{ fontSize: 12.5, color: HT.muted, fontFamily: "ui-monospace,monospace" }}>{b.gstin ?? "No GSTIN"}{b.id === active ? " · open now" : ""}{b.role && b.role !== "owner" ? ` · ${b.role}` : ""}</div>
                    </div>
                    {!b.error && b.health != null && <span title="Books health — 100 is clean (no drafts, reviews or warnings)" style={{ fontSize: 26, color: b.health >= 50 ? INK : "#B4321F" }}>{b.health}</span>}
                  </div>
                  {b.error ? <div style={{ color: "#B4321F" }}>{b.error}</div> : <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {tiles.map(([k, v], i) => {
                        const profitTile = i === 3 && (v ?? 0) > 0;
                        return (
                          <div key={k} style={{ background: profitTile ? "#E3EEE5" : "#F4EEE2", borderRadius: 14, padding: "12px 14px" }}>
                            <div style={{ fontSize: 13, color: profitTile ? "#2E6B4A" : HT.muted }}>{k}</div>
                            <div style={{ fontSize: 19, fontVariantNumeric: "tabular-nums", color: (v ?? 0) < 0 ? "#B4321F" : profitTile ? "#1F6B45" : HT.ink }}>{inr(v)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 15 }}>
                      {b.next && <span>Next: <b>{b.next.title} {b.next.period}</b> <span style={{ color: HT.muted }}>· {b.next.daysLeft === 0 ? "due today" : `in ${b.next.daysLeft} day${b.next.daysLeft === 1 ? "" : "s"} (${day(b.next.due)})`}</span></span>}
                      <span style={{ color: HT.muted }}>{b.gstin ? <>Last filed: GSTR-1 {b.gstr1 ? mon(b.gstr1.period) : "—"} · GSTR-3B {b.gstr3b ? mon(b.gstr3b.period) : "—"} · </> : null}{b.lastEntry ? `last entry ${day(b.lastEntry)}` : "no entries yet"}</span>
                      {(b.drafts || b.pendingReview) ? <span style={{ color: "#9A6B22", fontWeight: 700 }}>{b.drafts ? `${b.drafts} draft${b.drafts > 1 ? "s" : ""} not posted` : ""}{b.drafts && b.pendingReview ? " · " : ""}{b.pendingReview ? `${b.pendingReview} to review` : ""}</span> : null}
                    </div>
                  </>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                    <button className="pf-btn" style={{ height: 44, padding: "0 22px", borderRadius: 999, border: "none", background: INK, color: "#FFFFFF", fontFamily: "inherit", fontSize: 15, cursor: "pointer" }} onClick={() => open(b, "/finance")}>Open</button>
                    {([["FreBook", "/finance/chat-book"], ["Reports", "/finance/reports?tab=profit_loss"], ...(b.gstin ? [["GST", "/finance/gst"]] : [])] as [string, string][]).map(([t, h]) => (
                      <button key={t} className="pf-btn" style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "1px solid #E3D6B4", background: "#FFFDF8", color: HT.ink, fontFamily: "inherit", fontSize: 15, cursor: "pointer" }} onClick={() => open(b, h)}>{t}</button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
