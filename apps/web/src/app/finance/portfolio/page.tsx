"use client";
// All businesses on one screen — for owners with several businesses and CAs with many clients. Each row carries the
// same figures as that business's Home, plus what needs attention: overdue filings, the next due date, drafts.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness, setActiveBusiness, confirmBusinessSwitch } from "@/lib/activeBusiness";
import PageHero, { HeroAction, HT, SERIF } from "@/components/finance/PageHero";

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

  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18 };
  const chip = (on: boolean): React.CSSProperties => ({ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? HT.green : HT.line}`, background: on ? HT.green : "#FFFFFF", color: on ? "#FFFFFF" : HT.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, fontFamily: SERIF, color: HT.ink }}>
      <style>{`.pf-row{transition:background .12s}.pf-row:hover{background:#FBF7EE}.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}`}</style>
      <PageHero eyebrow="FreBook · All businesses" title="Every business," accent="one screen"
        sub="The same figures as each business's Home, side by side — and what needs you in each. Open one to work in it."
        actions={<HeroAction onClick={load}>Refresh</HeroAction>}
        tiles={rows ? [
          { label: "Businesses", value: rows.length, sub: `${rows.filter(needs).length} need attention`, tone: rows.some(needs) ? "warn" : "good" },
          { label: "Cash & bank", value: short(tot("cash")), tone: tot("cash") < 0 ? "bad" : "plain" },
          { label: "Customers owe", value: short(Math.max(0, tot("receivables"))) },
          { label: "Owed to suppliers", value: short(Math.max(0, tot("payables"))) },
          { label: "Overdue filings", value: overdueTotal, tone: overdueTotal ? "bad" : "good" },
        ] : undefined} />

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px clamp(14px,3vw,28px) 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a business by name or GSTIN" aria-label="Find a business" style={{ flex: "1 1 260px", height: 40, borderRadius: 999, border: `1px solid ${HT.line}`, padding: "0 16px", fontFamily: "inherit", fontSize: 14, background: "#FFFFFF" }} />
          <button style={chip(only === "all")} onClick={() => setOnly("all")}>All</button>
          <button style={chip(only === "attention")} onClick={() => setOnly("attention")}>Needs attention</button>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort" style={{ height: 36, borderRadius: 999, border: `1px solid ${HT.line}`, padding: "0 12px", fontFamily: "inherit", background: "#FFFFFF" }}>
            <option value="attention">Most urgent first</option><option value="name">Name A–Z</option><option value="cash">Cash & bank</option><option value="receivables">Receivables</option><option value="profit">Profit</option>
          </select>
        </div>
        {err && <div role="alert" style={{ ...card, padding: 16, background: "#FBE3DE", color: "#8A2A1A" }}>{err}</div>}
        {!rows && !err && <div style={{ ...card, padding: 28, color: HT.muted, fontStyle: "italic" }}>Reading every business&apos;s books…</div>}
        {rows && !shown.length && <div style={{ ...card, padding: 28, color: HT.muted }}>{rows.length ? "No business matches." : "No businesses yet."}</div>}

        <div className="pf-grid">
          {shown.map(b => (
            <article key={b.id} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12, borderColor: b.id === active ? "#C9A24A" : HT.line }}>
              <header style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 11, background: HT.green, color: "#D9B56F", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>{b.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{b.name}{b.id === active && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: HT.goldInk, verticalAlign: "middle" }}>OPEN NOW</span>}</div>
                  <div style={{ fontSize: 12, color: HT.muted, fontFamily: "ui-monospace,monospace" }}>{b.gstin ?? "No GSTIN"}{b.role && b.role !== "owner" ? ` · ${b.role}` : ""}</div>
                </div>
                {!b.error && b.health != null && <span title="Books health (drafts, reviews, warnings)" style={{ fontSize: 12, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: b.health >= 80 ? "#E3F3EC" : b.health >= 50 ? "#FBF1DA" : "#FBE3DE", color: b.health >= 80 ? "#0B7A55" : b.health >= 50 ? "#9A6B22" : "#B4321F" }}>{b.health}</span>}
              </header>
              {b.error ? <div style={{ color: "#B4321F", fontSize: 14 }}>{b.error}</div> : <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([["Cash & bank", b.cash], ["Customers owe", b.receivables], ["Owed to suppliers", b.payables], [`${(b.profit ?? 0) < 0 ? "Loss" : "Profit"} · ${b.period ?? ""}`, b.profit]] as [string, number][]).map(([k, v]) => (
                    <div key={k} style={{ background: "#F8F4EA", borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ fontSize: 11.5, color: HT.muted }}>{k}</div>
                      <div style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", color: v < 0 ? "#B4321F" : HT.ink }}>{inr(v)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                  {(b.overdue ?? []).slice(0, 2).map(o => <span key={o.title + o.period} style={{ color: "#B4321F", fontWeight: 700 }}>⚠ {o.title} {o.period} — {-o.daysLeft} day{o.daysLeft === -1 ? "" : "s"} overdue</span>)}
                  {(b.overdue?.length ?? 0) > 2 && <span style={{ color: "#B4321F" }}>…and {(b.overdue?.length ?? 0) - 2} more overdue</span>}
                  {b.next && <span>🗓 Next: {b.next.title} {b.next.period} · {b.next.daysLeft === 0 ? "due today" : `in ${b.next.daysLeft} day${b.next.daysLeft === 1 ? "" : "s"} (${day(b.next.due)})`}</span>}
                  {b.gstin && <span style={{ color: HT.muted }}>Last filed: GSTR-1 {b.gstr1 ? mon(b.gstr1.period) : "—"} · GSTR-3B {b.gstr3b ? mon(b.gstr3b.period) : "—"}</span>}
                  <span style={{ color: HT.muted }}>{b.drafts ? <b style={{ color: "#9A6B22" }}>{b.drafts} draft{b.drafts > 1 ? "s" : ""} not posted · </b> : ""}{b.pendingReview ? `${b.pendingReview} to review · ` : ""}{b.lastEntry ? `last entry ${day(b.lastEntry)}` : "no entries yet"}</span>
                </div>
              </>}
              <footer style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                <button style={{ ...chip(true), height: 36 }} onClick={() => open(b, "/finance")}>Open</button>
                <button style={chip(false)} onClick={() => open(b, "/finance/chat-book")}>FreBook</button>
                <button style={chip(false)} onClick={() => open(b, "/finance/reports?tab=profit_loss")}>Reports</button>
                {b.gstin && <button style={chip(false)} onClick={() => open(b, "/finance/gst")}>GST</button>}
              </footer>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
