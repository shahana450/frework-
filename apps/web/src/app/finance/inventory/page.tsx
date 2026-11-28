"use client";
// Inventory — items, every stock movement, godowns / branches / job workers, inter-branch transfers, job work with the
// GST return deadline and ITC-04, batches and expiry, and how stock feeds the P&L (opening, purchases, closing stock,
// cost of goods sold, gross margin), with period comparison and fast / slow / dead stock. The numbers come from
// lib/inventory (FIFO or weighted average per item).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";
import { runItem, periodSummary, stockByLocation, batches as batchList, jobWork, movers, reorderList, addDays, type InvItem, type InvMove, type Godown } from "@/lib/inventory";

type Item = InvItem & { hsn: string | null; unit: string | null; rate: number; opening_qty: number; opening_rate: number; reorder_level: number; track_stock: boolean; is_service: boolean;
  sku?: string | null; category?: string | null; brand?: string | null; mrp?: number | null; track_batch?: boolean; track_expiry?: boolean; shelf_life_days?: number | null; gst_rate?: number | null };
type Move = InvMove & { note?: string | null; mfg_date?: string | null };
type Tab = "overview" | "items" | "moves" | "places" | "jobwork" | "expiry" | "compare";

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) => (v < 0 ? "−" : "") + "₹" + Math.round(Math.abs(v)).toLocaleString("en-IN");
const qf = (v: number) => (Math.round(v * 1000) / 1000).toLocaleString("en-IN");
const today = () => new Date().toLocaleDateString("en-CA");
const dmy = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";
const fyStart = (d = today()) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return `${m >= 4 ? y : y - 1}-04-01`; };
const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const KINDS: { key: string; label: string; sign: 1 | -1 | 0; hint: string }[] = [
  { key: "purchase", label: "Purchase (stock in)", sign: 1, hint: "Goods bought — cost per unit" },
  { key: "sale", label: "Sale (stock out)", sign: -1, hint: "Goods sold — selling price per unit" },
  { key: "return_in", label: "Sales return (comes back)", sign: 1, hint: "Customer returned goods" },
  { key: "return_out", label: "Purchase return (goes back)", sign: -1, hint: "Sent back to the supplier" },
  { key: "adjustment", label: "Adjustment (+ / −)", sign: 0, hint: "Physical count difference: use minus to reduce" },
  { key: "consume", label: "Used in production", sign: -1, hint: "Raw material consumed" },
  { key: "produce", label: "Produced (finished goods)", sign: 1, hint: "Finished goods made — cost per unit" },
  { key: "scrap", label: "Scrap / damage / expired", sign: -1, hint: "Written off" },
];
const KIND_LABEL: Record<string, string> = { purchase: "Purchase", sale: "Sale", return: "Return", adjustment: "Adjustment", transfer_out: "Transfer out", transfer_in: "Transfer in", jobwork_out: "Job work — sent", jobwork_in: "Job work — back", consume: "Used", produce: "Produced", scrap: "Scrap" };

export default function Inventory() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [places, setPlaces] = useState<Godown[]>([]);
  const [setup, setSetup] = useState<"" | "basic" | "pro">("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(today());

  async function load(b: string) {
    setLoading(true);
    const it = await supabase.from("fw_fin_items").select("*").eq("business_id", b).eq("is_active", true).order("name");
    if (it.error) { setSetup("basic"); setLoading(false); return; }
    const list = (it.data ?? []) as Item[];
    if (!list.length || !("opening_qty" in (list[0] ?? {}))) { if (list.length) { setSetup("basic"); setLoading(false); return; } }
    const mv: Move[] = [];
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from("fw_fin_stock_moves").select("*").eq("business_id", b).order("date").order("created_at").range(f, f + 999);
      if (error) { setSetup("basic"); setLoading(false); return; }
      mv.push(...((data ?? []) as Move[])); if (!data || data.length < 1000) break;
    }
    const g = await supabase.from("fw_fin_godowns").select("*").eq("business_id", b).eq("is_active", true).order("name");
    setSetup(g.error ? "pro" : "");
    setPlaces((g.data ?? []) as Godown[]);
    setItems(list.filter(i => !i.is_service && i.track_stock !== false));
    setMoves(mv); setLoading(false);
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login?next=/finance/inventory"); return; }
      const b = (readActiveBusiness(user.id) ?? "").trim(); if (!b) { router.push("/finance/setup"); return; }
      setBizId(b); void load(b);
    });
  }, [router]);

  const pro = setup === "";
  const t0 = today();
  const stock = useMemo(() => new Map(items.map(i => [i.id, runItem(i, moves, { to: t0 })])), [items, moves, t0]);
  const period = useMemo(() => periodSummary(items, moves, from, to), [items, moves, from, to]);
  const bats = useMemo(() => batchList(items, moves, t0), [items, moves, t0]);
  const jw = useMemo(() => jobWork(items, moves, places, t0), [items, moves, places, t0]);
  const mov = useMemo(() => movers(items, moves, t0, 90), [items, moves, t0]);
  const reorder = useMemo(() => reorderList(items, moves, t0), [items, moves, t0]);
  const totalValue = [...stock.values()].reduce((s, r) => s + r.value, 0);
  const expSoon = bats.filter(b => b.status === "expired" || b.status === "30");
  const jwOpen = jw.filter(j => j.status !== "closed");
  const dead = mov.filter(m => m.speed === "dead");

  async function insertMoves(rows: Record<string, unknown>[], ok: string) {
    if (!bizId) return false;
    setBusy(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fw_fin_stock_moves").insert(rows.map(r => ({ business_id: bizId, created_by: user?.id ?? null, ...r })));
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /check constraint|kind_check/i.test(error.message) ? "This needs the inventory update: run 2026-11-28_inventory_pro.sql in Supabase." : error.message }); return false; }
    setMsg({ ok: true, text: ok }); void load(bizId); return true;
  }

  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 22 };
  const TABS: { key: Tab; label: string; count?: number; needsPro?: boolean }[] = [
    { key: "overview", label: "Overview" }, { key: "items", label: "Items", count: items.length }, { key: "moves", label: "Movements" },
    { key: "places", label: "Godowns & transfers", needsPro: true }, { key: "jobwork", label: "Job work", count: jwOpen.length || undefined, needsPro: true },
    { key: "expiry", label: "Batches & expiry", count: expSoon.length || undefined, needsPro: true }, { key: "compare", label: "Compare & movers" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <style>{CSS}</style>
      <PageHero eyebrow="Inventory · Stock & valuation" title="What's" accent="in stock"
        sub="Items, every movement, godowns and branches, job work, batches and expiry — and the closing stock and cost of goods that go into your P&L."
        tiles={loading || setup === "basic" ? undefined : [
          { label: "Stock value (at cost)", value: inr(totalValue), tone: "good" },
          { label: "Items", value: String(items.length), sub: `${reorder.length} to reorder` },
          { label: "Expired or ≤30 days", value: String(expSoon.length), tone: expSoon.length ? "warn" : "plain", sub: expSoon.length ? inr(expSoon.reduce((s, b) => s + b.value, 0)) + " at risk" : "Nothing close" },
          { label: "With job workers", value: String(jwOpen.length), tone: jwOpen.some(j => j.status === "overdue") ? "bad" : "plain", sub: jwOpen.some(j => j.status === "overdue") ? "Past the 1-year limit" : "challans open" },
        ]}
        tabs={TABS.map(t => ({ label: t.label, count: t.count, active: tab === t.key, onClick: () => setTab(t.key) }))} />

      <div className="iv-wrap">
        {setup === "basic" && <div role="alert" style={{ ...card, padding: "18px 22px", color: "#8A5A00" }}>Inventory needs its database tables: run <b>2026-11-01_items.sql</b>, <b>2026-11-02_inventory.sql</b> and <b>2026-11-28_inventory_pro.sql</b> in Supabase → SQL Editor, then reload.</div>}
        {setup === "pro" && <div role="alert" style={{ ...card, padding: "16px 22px", color: "#8A5A00", background: "#FBF3E2" }}>Godowns, branches, job work and batch / expiry tracking need one more database step: run <b>2026-11-28_inventory_pro.sql</b> in Supabase → SQL Editor. Items, movements, P&amp;L and comparison already work.</div>}
        {msg && <div role="status" style={{ ...card, padding: "14px 20px", color: msg.ok ? "#0B7A55" : "#B4321F" }}>{msg.text}</div>}
        {loading && <div style={{ ...card, padding: 24, fontStyle: "italic", color: HT.muted }}>Reading stock…</div>}

        {!loading && setup !== "basic" && (TABS.find(t => t.key === tab)?.needsPro && !pro
          ? <div style={{ ...card, padding: 24, color: HT.muted }}>This tab opens once <b>2026-11-28_inventory_pro.sql</b> has been run in Supabase.</div>
          : <>
            {tab === "overview" && <Overview {...{ items, stock, period, from, to, setFrom, setTo, reorder, bats, jw, mov, setTab }} />}
            {tab === "items" && <ItemsTab {...{ bizId, items, stock, pro, busy, setBusy, setMsg, reload: () => bizId && load(bizId) }} />}
            {tab === "moves" && <MovesTab {...{ bizId, items, moves, places, pro, busy, insertMoves, setBusy, setMsg, reload: () => bizId && load(bizId) }} />}
            {tab === "places" && <PlacesTab {...{ bizId, items, moves, places, busy, insertMoves, setMsg, reload: () => bizId && load(bizId) }} />}
            {tab === "jobwork" && <JobWorkTab {...{ bizId, items, moves, places, jw, busy, insertMoves, setMsg, reload: () => bizId && load(bizId) }} />}
            {tab === "expiry" && <ExpiryTab {...{ bats, busy, insertMoves }} />}
            {tab === "compare" && <CompareTab {...{ items, moves, mov }} />}
          </>)}
      </div>
    </div>
  );
}

const CSS = `
.iv-wrap{max-width:1240px;margin:0 auto;padding:28px clamp(14px,3vw,28px) 70px;display:flex;flex-direction:column;gap:22px}
.iv-card{background:${HT.paper};border:1px solid ${HT.line};border-radius:22px;overflow:hidden}
.iv-head{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;padding:24px 28px 18px}
.iv-head h2{margin:0;font-size:clamp(24px,2.6vw,32px);font-weight:400;font-style:italic}
.iv-sub{font-size:15.5px;color:${HT.muted};margin-top:4px}
.iv-in{height:44px;border-radius:12px;border:1px solid ${HT.line};padding:0 12px;font:inherit;font-size:15px;background:#FFFFFF;color:${HT.ink};min-width:0;box-sizing:border-box}
.iv-b{height:44px;padding:0 20px;border-radius:999px;border:none;background:#12352D;color:#FFFFFF;font:inherit;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.iv-b.line{background:#FFFFFF;color:${HT.ink};border:1px solid #D9C79A;font-weight:400}
.iv-b.gold{background:linear-gradient(160deg,#E3C47E,#C9A24A);color:${HT.ink}}
.iv-b:disabled{opacity:.55;cursor:default}
.iv-form{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:0 28px 24px}
.iv-tbl{width:100%;border-collapse:collapse;font-size:15px;font-variant-numeric:tabular-nums}
.iv-tbl th{font-weight:400;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8A6A2A;background:#F4EFE5;padding:14px 12px;text-align:right;white-space:nowrap}
.iv-tbl th:first-child,.iv-tbl td:first-child{text-align:left;padding-left:28px}.iv-tbl th:last-child,.iv-tbl td:last-child{padding-right:28px}
.iv-tbl td{padding:13px 12px;border-top:1px solid ${HT.line};text-align:right;vertical-align:middle}
.iv-tbl tbody tr:hover{background:#FBF7EE}
.iv-chip{display:inline-block;font-size:12.5px;padding:3px 10px;border-radius:999px;white-space:nowrap}
.iv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;padding:0 28px 26px}
.iv-k{border:1px solid ${HT.line};border-radius:16px;padding:16px 18px;background:#FFFFFF}
.iv-k small{display:block;font-size:13.5px;color:${HT.muted}}.iv-k b{display:block;font-weight:400;font-size:24px;margin-top:4px}
.iv-grid2{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:22px}@media(max-width:960px){.iv-grid2{grid-template-columns:minmax(0,1fr)}}
.iv-scroll{overflow-x:auto}
`;

const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg });
const tone = { bad: chip("#FBE9E4", "#B23A20"), warn: chip("#FBF0D9", "#8A5A00"), good: chip("#E6F1EC", "#245E48"), plain: chip("#F1EADB", "#6B7570") };

/* ───────────────────────── Overview: stock in the P&L ───────────────────────── */
function Overview({ items, stock, period, from, to, setFrom, setTo, reorder, bats, jw, mov, setTab }: {
  items: Item[]; stock: Map<string, ReturnType<typeof runItem>>; period: ReturnType<typeof periodSummary>; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
  reorder: ReturnType<typeof reorderList>; bats: ReturnType<typeof batchList>; jw: ReturnType<typeof jobWork>; mov: ReturnType<typeof movers>; setTab: (t: Tab) => void;
}) {
  const t = period.totals;
  const top = [...period.rows].filter(r => r.salesValue > 0).sort((a, b) => b.margin - a.margin).slice(0, 8);
  const closingText = `Closing stock as on ${dmy(to)} is ₹${Math.round(t.closeValue).toLocaleString("en-IN")} (valued at cost). Post the closing stock entry.`;
  return (
    <>
      <section className="iv-card" aria-labelledby="pl-h">
        <div className="iv-head">
          <div style={{ marginRight: "auto" }}><h2 id="pl-h">Stock in your <span style={{ color: HT.goldInk }}>P&amp;L</span></h2><div className="iv-sub">The trading account for the period: what you started with, bought, and still hold — the difference is the cost of goods.</div></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: HT.muted }}>From <input type="date" className="iv-in" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: HT.muted }}>To <input type="date" className="iv-in" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        </div>
        <div className="iv-kpis">
          {[["Opening stock", t.openValue], ["+ Purchases & production", t.inValue], ["− Closing stock", t.closeValue], ["= Cost of goods", t.tradingCogs]].map(([l, v], i) => (
            <div key={String(l)} className="iv-k" style={i === 3 ? { background: "#12352D", color: "#FFFFFF", borderColor: "#12352D" } : undefined}><small style={i === 3 ? { color: "#C9D3CE" } : undefined}>{l}</small><b>{inr(Number(v))}</b></div>
          ))}
          <div className="iv-k"><small>Sales (from stock)</small><b>{inr(t.salesValue)}</b></div>
          <div className="iv-k" style={{ background: t.margin >= 0 ? "#EEF6F1" : "#FBEDE8" }}><small>Gross margin</small><b style={{ color: t.margin >= 0 ? "#2F7A57" : "#B23A20" }}>{inr(t.margin)}{t.marginPct != null ? <span style={{ fontSize: 15, color: HT.muted }}> · {t.marginPct}%</span> : null}</b></div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "0 28px 24px", fontSize: 14.5, color: HT.muted }}>
          <Link className="iv-b gold" href={`/finance/chat-book?q=${encodeURIComponent(closingText)}`}>Post closing stock to books →</Link>
          <Link className="iv-b line" href="/finance/reports?tab=profit_loss">Open P&amp;L</Link>
          <span>FreBook drafts the entry (Closing stock Dr · Trading / P&amp;L Cr); you check it before it posts.{t.consumedValue > 0 ? ` Includes ${inr(t.consumedValue)} used in production.` : ""}{t.scrapValue > 0 ? ` ${inr(t.scrapValue)} scrapped.` : ""}</span>
        </div>
      </section>

      <div className="iv-grid2">
        <section className="iv-card" aria-labelledby="mg-h">
          <div className="iv-head"><div><h2 id="mg-h">Best <span style={{ color: HT.goldInk }}>margins</span></h2><div className="iv-sub">Items sold in the period, by gross margin (sales − cost).</div></div></div>
          <div className="iv-scroll"><table className="iv-tbl"><thead><tr><th>Item</th><th>Sold</th><th>Sales</th><th>Cost</th><th>Margin</th></tr></thead><tbody>
            {top.map(r => <tr key={r.item.id}><td>{r.item.name}</td><td>{qf(r.soldQty)}</td><td>{inr(r.salesValue)}</td><td>{inr(r.cogs)}</td><td style={{ color: r.margin >= 0 ? "#2F7A57" : "#B23A20" }}>{inr(r.margin)}{r.marginPct != null ? <span style={{ color: HT.muted }}> · {r.marginPct}%</span> : null}</td></tr>)}
            {!top.length && <tr><td colSpan={5} style={{ color: HT.muted, textAlign: "left" }}>No sales from stock in this period yet.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="iv-card" aria-labelledby="att-h">
          <div className="iv-head"><div><h2 id="att-h">Needs <span style={{ color: HT.goldInk }}>attention</span></h2></div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 28px 24px" }}>
            {[
              { n: reorder.length, t: `${reorder.length} item${reorder.length === 1 ? "" : "s"} at or below reorder level`, go: "items" as Tab, tone: tone.warn },
              { n: bats.filter(b => b.status === "expired").length, t: `${bats.filter(b => b.status === "expired").length} batch${bats.filter(b => b.status === "expired").length === 1 ? "" : "es"} expired — write off or return`, go: "expiry" as Tab, tone: tone.bad },
              { n: bats.filter(b => b.status === "30").length, t: `${bats.filter(b => b.status === "30").length} batch${bats.filter(b => b.status === "30").length === 1 ? "" : "es"} expiring within 30 days`, go: "expiry" as Tab, tone: tone.warn },
              { n: jw.filter(j => j.status === "overdue").length, t: `${jw.filter(j => j.status === "overdue").length} job-work challan${jw.filter(j => j.status === "overdue").length === 1 ? "" : "s"} past the return limit (treated as supplied — section 143)`, go: "jobwork" as Tab, tone: tone.bad },
              { n: mov.filter(m => m.speed === "dead").length, t: `${mov.filter(m => m.speed === "dead").length} item${mov.filter(m => m.speed === "dead").length === 1 ? "" : "s"} with stock but no sale in 90 days (${inr(mov.filter(m => m.speed === "dead").reduce((s, m) => s + m.value, 0))})`, go: "compare" as Tab, tone: tone.plain },
              { n: [...stock.values()].filter(s => s.qty < 0).length, t: `${[...stock.values()].filter(s => s.qty < 0).length} item${[...stock.values()].filter(s => s.qty < 0).length === 1 ? "" : "s"} with negative stock — a purchase is missing`, go: "items" as Tab, tone: tone.bad },
            ].filter(x => x.n > 0).map(x => (
              <button key={x.t} onClick={() => setTab(x.go)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, border: `1px solid ${HT.line}`, background: "#FFFFFF", fontSize: 15.5 }}>
                <span className="iv-chip" style={x.tone}>{x.n}</span><span style={{ flex: 1 }}>{x.t}</span><span aria-hidden style={{ color: HT.goldInk }}>→</span>
              </button>
            ))}
            {items.length > 0 && !reorder.length && !bats.some(b => b.status === "expired" || b.status === "30") && !jw.some(j => j.status === "overdue") && !mov.some(m => m.speed === "dead") && <span style={{ color: "#2F7A57", fontSize: 15.5 }}>✓ Nothing needs you right now.</span>}
            {!items.length && <span style={{ color: HT.muted, fontSize: 15.5 }}>Add your items to start — Items tab, or upload the stock template.</span>}
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────────────────── Items ───────────────────────── */
function ItemsTab({ bizId, items, stock, pro, busy, setBusy, setMsg, reload }: { bizId: string | null; items: Item[]; stock: Map<string, ReturnType<typeof runItem>>; pro: boolean; busy: boolean; setBusy: (b: boolean) => void; setMsg: (m: { ok: boolean; text: string } | null) => void; reload: () => void }) {
  const blank = { name: "", hsn: "", unit: "NOS", qty: "", cost: "", price: "", gst: "18", sku: "", category: "", mrp: "", reorder: "", max: "", valuation: "fifo", batch: false, expiry: false, capital: false };
  const [ni, setNi] = useState(blank);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [hsn, setHsn] = useState<{ q: string; busy: boolean; hits: { hsn: string; description: string; gst_rate: number | null }[]; source: string | null; open: boolean }>({ q: "", busy: false, hits: [], source: null, open: false });
  const existing = items.find(i => i.name.trim().toLowerCase() === ni.name.trim().toLowerCase());
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];
  const rows = items.filter(i => (!q.trim() || `${i.name} ${i.hsn ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) && (!cat || i.category === cat));

  async function save() {
    if (!bizId || !ni.name.trim()) { setMsg({ ok: false, text: "Type the item's name." }); return; }
    const row: Record<string, unknown> = { name: ni.name.trim(), hsn: ni.hsn.trim() || null, unit: ni.unit.trim() || "NOS", rate: Number(ni.price) || 0, gst_rate: Number(ni.gst) || 0, opening_qty: Number(ni.qty) || 0, opening_rate: Number(ni.cost) || 0, reorder_level: Number(ni.reorder) || 0, is_service: false };
    if (pro) Object.assign(row, { sku: ni.sku.trim() || null, category: ni.category.trim() || null, mrp: Number(ni.mrp) || null, max_qty: Number(ni.max) || null, valuation: ni.valuation, track_batch: ni.batch, track_expiry: ni.expiry, is_capital_good: ni.capital });
    setBusy(true);
    const { error } = existing ? await supabase.from("fw_fin_items").update(row).eq("id", existing.id) : await supabase.from("fw_fin_items").insert({ business_id: bizId, ...row });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /duplicate|unique/i.test(error.message) ? `"${ni.name.trim()}" is already an item.` : error.message }); return; }
    setMsg({ ok: true, text: `✓ ${existing ? "Updated" : "Added"} ${ni.name.trim()}.` }); setNi(blank); reload();
  }
  async function patch(i: Item, p: Partial<Item>) { const { error } = await supabase.from("fw_fin_items").update(p).eq("id", i.id); if (error) setMsg({ ok: false, text: error.message }); else reload(); }
  async function findHsn() {
    if (!bizId || hsn.q.trim().length < 2) return;
    setHsn(h => ({ ...h, busy: true, hits: [], source: null }));
    const d = await fetch(`/api/finance/hsn?business_id=${bizId}&q=${encodeURIComponent(hsn.q.trim())}`).then(r => r.json()).catch(() => ({}));
    setHsn(h => ({ ...h, busy: false, hits: d.hits ?? [], source: d.source ?? "none" }));
  }
  async function template() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["Item name", "SKU", "Category", "HSN", "Unit", "Opening qty", "Cost per unit", "Selling price", "MRP", "GST %", "Reorder level", "Max qty"], ["Basmati rice 25 kg", "RICE-25", "Grocery", "10063020", "BAG", 40, 1850, 2100, 2300, 5, 10, 60], ...items.map(i => [i.name, i.sku ?? "", i.category ?? "", i.hsn ?? "", i.unit ?? "NOS", i.opening_qty || "", i.opening_rate || "", i.rate || "", i.mrp ?? "", i.gst_rate ?? "", i.reorder_level || "", i.max_qty ?? ""])]);
    ws["!cols"] = [34, 12, 14, 12, 8, 12, 14, 14, 10, 8, 14, 10].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Stock"); XLSX.writeFile(wb, "FreBook-Stock-Template.xlsx");
  }
  async function upload(f: File) {
    if (!bizId) return;
    setBusy(true); setMsg(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const head = (grid[0] ?? []).map(h => String(h).toLowerCase());
      const col = (re: RegExp) => head.findIndex(h => re.test(h));
      const c = { name: col(/item|name|description/), sku: col(/sku|code/), cat: col(/categ|group/), hsn: col(/hsn|sac/), unit: col(/unit|uom/), qty: col(/open.*qty|qty|quantity/), cost: col(/cost/), price: col(/sell|price|rate/), mrp: col(/mrp/), gst: col(/gst|tax/), reorder: col(/reorder|min/), max: col(/max/) };
      if (c.name < 0) throw new Error("The first row needs an 'Item name' column — download the template.");
      const byName = new Map(items.map(i => [i.name.trim().toLowerCase(), i]));
      let added = 0, updated = 0;
      const num = (r: unknown[], i: number) => i < 0 ? undefined : (String(r[i]).trim() === "" ? undefined : Number(String(r[i]).replace(/[,₹\s]/g, "")) || 0);
      const txt = (r: unknown[], i: number) => i < 0 ? undefined : String(r[i] ?? "").trim() || undefined;
      for (const r of grid.slice(1)) {
        const name = String(r[c.name] ?? "").trim();
        if (!name || (/^basmati rice 25 kg$/i.test(name) && !byName.has(name.toLowerCase()))) continue;
        const row: Record<string, unknown> = {};
        const hsnV = c.hsn >= 0 ? String(r[c.hsn] ?? "").replace(/\D/g, "").slice(0, 8) : ""; if (hsnV) row.hsn = hsnV;
        if (txt(r, c.unit)) row.unit = txt(r, c.unit)!.toUpperCase().slice(0, 8);
        const vals: [string, number | undefined][] = [["opening_qty", num(r, c.qty)], ["opening_rate", num(r, c.cost)], ["rate", num(r, c.price)], ["gst_rate", num(r, c.gst)], ["reorder_level", num(r, c.reorder)]];
        if (pro) vals.push(["mrp", num(r, c.mrp)], ["max_qty", num(r, c.max)]);
        for (const [k, v] of vals) if (v !== undefined) row[k] = v;
        if (pro) { if (txt(r, c.sku)) row.sku = txt(r, c.sku); if (txt(r, c.cat)) row.category = txt(r, c.cat); }
        const old = byName.get(name.toLowerCase());
        if (old) { if (Object.keys(row).length) { const { error } = await supabase.from("fw_fin_items").update(row).eq("id", old.id); if (!error) updated++; } }
        else { const { error } = await supabase.from("fw_fin_items").insert({ business_id: bizId, name, unit: "NOS", is_service: false, ...row }); if (!error) { added++; byName.set(name.toLowerCase(), { name } as Item); } }
      }
      setMsg({ ok: true, text: `✓ ${added} item${added === 1 ? "" : "s"} added, ${updated} updated from ${f.name}.` }); reload();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't read that file." }); }
    setBusy(false);
  }
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNi(x => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <>
      <section className="iv-card" aria-labelledby="ni-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="ni-h">{existing ? "Update" : "Add an"} <span style={{ color: HT.goldInk }}>item</span></h2><div className="iv-sub">{existing ? `“${existing.name}” is already added — saving updates it.` : "Goods you buy, make or sell. Services aren't counted as stock."}</div></div>
          <button className="iv-b line" onClick={template}>⬇ Stock template</button>
          <label className="iv-b">⬆ Upload filled template<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label>
        </div>
        <datalist id="iv-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
        <div className="iv-form">
          <input className="iv-in" list="iv-items" value={ni.name} placeholder="Item name" aria-label="Item name" style={{ flex: "2 1 220px" }}
            onChange={e => { const v = e.target.value; const it = items.find(i => i.name.trim().toLowerCase() === v.trim().toLowerCase()); setNi(x => it ? { ...blank, name: it.name, hsn: it.hsn ?? "", unit: it.unit ?? "NOS", qty: String(it.opening_qty || ""), cost: String(it.opening_rate || ""), price: String(it.rate || ""), gst: String(it.gst_rate ?? x.gst), sku: it.sku ?? "", category: it.category ?? "", mrp: String(it.mrp ?? ""), reorder: String(it.reorder_level || ""), max: String(it.max_qty ?? ""), valuation: it.valuation === "avg" ? "avg" : "fifo", batch: !!it.track_batch, expiry: !!it.track_expiry, capital: !!it.is_capital_good } : { ...x, name: v }); }} />
          {pro && <input className="iv-in" value={ni.sku} onChange={set("sku")} placeholder="SKU / code" aria-label="SKU" style={{ width: 120 }} />}
          {pro && <input className="iv-in" list="iv-cats" value={ni.category} onChange={set("category")} placeholder="Category" aria-label="Category" style={{ width: 140 }} />}
          <datalist id="iv-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
          <input className="iv-in" value={ni.hsn} onChange={e => setNi(x => ({ ...x, hsn: e.target.value.replace(/\D/g, "").slice(0, 8) }))} placeholder="HSN" aria-label="HSN" style={{ width: 100 }} />
          <button className="iv-b line" onClick={() => setHsn(h => ({ ...h, open: !h.open, q: h.q || ni.name }))}>🔍 HSN</button>
          <input className="iv-in" value={ni.unit} onChange={e => setNi(x => ({ ...x, unit: e.target.value.toUpperCase().slice(0, 8) }))} placeholder="Unit" aria-label="Unit" style={{ width: 80 }} />
          <select className="iv-in" value={ni.gst} onChange={set("gst")} aria-label="GST rate">{["0", "3", "5", "12", "18", "28"].map(g => <option key={g} value={g}>{g}% GST</option>)}</select>
        </div>
        <div className="iv-form">
          <input className="iv-in" value={ni.qty} onChange={set("qty")} inputMode="decimal" placeholder="Opening qty" aria-label="Opening quantity" style={{ width: 120 }} />
          <input className="iv-in" value={ni.cost} onChange={set("cost")} inputMode="decimal" placeholder="Cost / unit" aria-label="Cost per unit" style={{ width: 120 }} />
          <input className="iv-in" value={ni.price} onChange={set("price")} inputMode="decimal" placeholder="Selling price" aria-label="Selling price" style={{ width: 130 }} />
          {pro && <input className="iv-in" value={ni.mrp} onChange={set("mrp")} inputMode="decimal" placeholder="MRP" aria-label="MRP" style={{ width: 100 }} />}
          <input className="iv-in" value={ni.reorder} onChange={set("reorder")} inputMode="decimal" placeholder="Reorder at" aria-label="Reorder level" style={{ width: 110 }} />
          {pro && <input className="iv-in" value={ni.max} onChange={set("max")} inputMode="decimal" placeholder="Max qty" aria-label="Maximum quantity" style={{ width: 100 }} />}
          {pro && <select className="iv-in" value={ni.valuation} onChange={set("valuation")} aria-label="Valuation"><option value="fifo">FIFO</option><option value="avg">Weighted average</option></select>}
          {pro && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 15 }}><input type="checkbox" checked={ni.batch} onChange={set("batch")} /> Batches</label>}
          {pro && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 15 }}><input type="checkbox" checked={ni.expiry} onChange={set("expiry")} /> Expiry</label>}
          {pro && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 15 }} title="Job work: capital goods may stay out 3 years instead of 1"><input type="checkbox" checked={ni.capital} onChange={set("capital")} /> Capital good</label>}
          <button className="iv-b" onClick={save} disabled={busy}>{existing ? "Update item" : "Add item"}</button>
        </div>
        {hsn.open && (
          <div style={{ margin: "0 28px 24px", border: `1px solid ${HT.line}`, borderRadius: 16, padding: 14, display: "grid", gap: 8, background: "#FFFFFF" }}>
            <form onSubmit={e => { e.preventDefault(); void findHsn(); }} style={{ display: "flex", gap: 8 }}>
              <input autoFocus className="iv-in" value={hsn.q} onChange={e => setHsn(h => ({ ...h, q: e.target.value }))} placeholder="Describe the goods (e.g. basmati rice) or type a code" aria-label="HSN search" style={{ flex: 1 }} />
              <button type="submit" className="iv-b" disabled={hsn.busy}>{hsn.busy ? "Searching…" : "Search"}</button>
            </form>
            {hsn.hits.map(h => (
              <button key={h.hsn + h.description} type="button" onClick={() => { setNi(x => ({ ...x, hsn: h.hsn, gst: h.gst_rate != null ? String(h.gst_rate) : x.gst })); setHsn(x => ({ ...x, open: false })); }}
                style={{ display: "flex", gap: 12, alignItems: "baseline", textAlign: "left", border: `1px solid ${HT.line}`, borderRadius: 12, background: HT.paper, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", color: HT.ink, fontSize: 15 }}>
                <b style={{ minWidth: 80 }}>{h.hsn}</b><span style={{ flex: 1 }}>{h.description}</span>{h.gst_rate != null && <span style={{ color: HT.muted }}>{h.gst_rate}% GST</span>}<span style={{ color: HT.goldInk }}>Use</span>
              </button>
            ))}
            {hsn.source && !hsn.hits.length && !hsn.busy && <div style={{ fontSize: 14, color: HT.muted }}>No match — try other words.</div>}
          </div>
        )}
      </section>

      <section className="iv-card" aria-labelledby="it-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="it-h">Stock <span style={{ color: HT.goldInk }}>on hand</span></h2><div className="iv-sub">Opening, reorder level and cost can be changed in place.</div></div>
          {cats.length > 0 && <select className="iv-in" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>}
          <input className="iv-in" value={q} onChange={e => setQ(e.target.value)} placeholder="Find item, SKU or HSN" aria-label="Find an item" style={{ width: 240 }} />
        </div>
        <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 980 }}><thead><tr><th>Item</th><th>Opening</th><th>Opening cost</th><th>On hand</th><th>Cost / unit</th><th>Value</th><th>Reorder at</th><th>Sell</th></tr></thead><tbody>
          {rows.map(i => { const s = stock.get(i.id)!; const low = n(i.reorder_level) > 0 && s.qty <= n(i.reorder_level); return (
            <tr key={i.id}>
              <td><span style={{ display: "block", fontSize: 16 }}>{i.name}</span><span style={{ fontSize: 13.5, color: HT.muted }}>{[i.sku, i.category, i.hsn ? `HSN ${i.hsn}` : "", i.valuation === "avg" ? "Avg cost" : "FIFO", i.track_batch ? "Batches" : "", i.track_expiry ? "Expiry" : ""].filter(Boolean).join(" · ")}</span>
                {(low || s.qty < 0) && <span className="iv-chip" style={{ ...(s.qty < 0 ? tone.bad : tone.warn), marginLeft: 8 }}>{s.qty < 0 ? "Negative" : "Reorder"}</span>}</td>
              <td><input className="iv-in" defaultValue={i.opening_qty || ""} onBlur={e => { const v = Number(e.target.value) || 0; if (v !== n(i.opening_qty)) void patch(i, { opening_qty: v }); }} inputMode="decimal" aria-label={`Opening quantity of ${i.name}`} style={{ width: 90, textAlign: "right" }} /></td>
              <td><input className="iv-in" defaultValue={i.opening_rate || ""} onBlur={e => { const v = Number(e.target.value) || 0; if (v !== n(i.opening_rate)) void patch(i, { opening_rate: v }); }} inputMode="decimal" aria-label={`Opening cost of ${i.name}`} style={{ width: 100, textAlign: "right" }} /></td>
              <td style={{ color: s.qty < 0 ? "#B23A20" : HT.ink, fontSize: 16 }}>{qf(s.qty)} <span style={{ color: HT.muted, fontSize: 13.5 }}>{i.unit ?? ""}</span></td>
              <td>{inr(s.cost)}</td><td>{inr(s.value)}</td>
              <td><input className="iv-in" defaultValue={i.reorder_level || ""} onBlur={e => { const v = Number(e.target.value) || 0; if (v !== n(i.reorder_level)) void patch(i, { reorder_level: v }); }} inputMode="decimal" aria-label={`Reorder level of ${i.name}`} style={{ width: 90, textAlign: "right" }} /></td>
              <td>{i.rate ? inr(i.rate) : "—"}</td>
            </tr>); })}
          {!rows.length && <tr><td colSpan={8} style={{ color: HT.muted }}>No stock items yet — add goods above (services aren&apos;t tracked).</td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}

/* ───────────────────────── Movements ───────────────────────── */
function MovesTab({ bizId, items, moves, places, pro, busy, insertMoves, setBusy, setMsg, reload }: { bizId: string | null; items: Item[]; moves: Move[]; places: Godown[]; pro: boolean; busy: boolean; insertMoves: (r: Record<string, unknown>[], ok: string) => Promise<boolean>; setBusy: (b: boolean) => void; setMsg: (m: { ok: boolean; text: string } | null) => void; reload: () => void }) {
  const own = places.filter(p => p.kind !== "job_worker");
  const [f, setF] = useState({ kind: "purchase", item: "", qty: "", rate: "", date: today(), godown: own.find(p => p.is_default)?.id ?? own[0]?.id ?? "", batch: "", mfg: "", expiry: "", ref: "", party: "", note: "" });
  const [filter, setFilter] = useState({ q: "", kind: "" });
  const it = items.find(i => i.name.toLowerCase() === f.item.trim().toLowerCase());
  const k = KINDS.find(x => x.key === f.kind)!;
  const byId = new Map(items.map(i => [i.id, i])), place = new Map(places.map(p => [p.id, p]));
  const list = [...moves].reverse().filter(m => (!filter.kind || m.kind === filter.kind) && (!filter.q.trim() || `${byId.get(m.item_id)?.name ?? ""} ${m.ref_no ?? ""} ${m.party ?? ""} ${m.batch ?? ""} ${m.note ?? ""}`.toLowerCase().includes(filter.q.trim().toLowerCase()))).slice(0, 300);

  async function save() {
    if (!it) { setMsg({ ok: false, text: "Pick an item from the list (add new items in the Items tab)." }); return; }
    const raw = Number(f.qty); if (!raw) { setMsg({ ok: false, text: "Enter a quantity." }); return; }
    const qty = k.sign === 0 ? raw : k.sign * Math.abs(raw);
    if (it.track_batch && !f.batch.trim() && pro) { setMsg({ ok: false, text: `${it.name} is tracked by batch — enter the batch no.` }); return; }
    const kind = f.kind === "return_in" || f.kind === "return_out" ? "return" : f.kind;
    const row: Record<string, unknown> = { item_id: it.id, date: f.date, qty, rate: Number(f.rate) || 0, kind, note: f.note.trim() || null };
    if (pro) Object.assign(row, { godown_id: f.godown || null, batch: f.batch.trim() || null, mfg_date: f.mfg || null, expiry: f.expiry || (f.mfg && it.shelf_life_days ? addDays(f.mfg, it.shelf_life_days) : null), ref_no: f.ref.trim() || null, party: f.party.trim() || null });
    if (await insertMoves([row], `✓ ${k.label.split(" (")[0]}: ${qf(Math.abs(qty))} ${it.unit ?? ""} of ${it.name}.`)) setF(x => ({ ...x, qty: "", rate: "", batch: "", mfg: "", expiry: "", ref: "", note: "" }));
  }
  // Sales already posted with item lines (sales invoice form): take that stock out, once each
  async function bringInSales() {
    if (!bizId) return;
    setBusy(true); setMsg(null);
    const byName = new Map(items.map(i => [i.name.trim().toLowerCase(), i]));
    const add: Record<string, unknown>[] = [];
    for (let fr = 0; ; fr += 500) {
      const { data } = await supabase.from("fw_fin_journals").select("id,date,metadata").eq("business_id", bizId).eq("status", "posted").eq("type", "sales").range(fr, fr + 499);
      for (const j of (data ?? []) as { id: string; date: string; metadata: { gst_invoice?: { items?: { desc?: string; qty?: number; taxable?: number }[] } } | null }[])
        for (const li of j.metadata?.gst_invoice?.items ?? []) {
          const x = byName.get(String(li.desc ?? "").trim().toLowerCase());
          if (x && n(li.qty) > 0 && !moves.some(m => m.journal_id === j.id && m.item_id === x.id) && !add.some(r => r.journal_id === j.id && r.item_id === x.id))
            add.push({ business_id: bizId, item_id: x.id, date: String(j.date).slice(0, 10), qty: -n(li.qty), rate: n(li.qty) ? n(li.taxable) / n(li.qty) : 0, kind: "sale", journal_id: j.id });
        }
      if (!data || data.length < 500) break;
    }
    for (let i = 0; i < add.length; i += 200) await supabase.from("fw_fin_stock_moves").insert(add.slice(i, i + 200));
    setBusy(false);
    setMsg({ ok: true, text: add.length ? `✓ ${add.length} sale line${add.length === 1 ? "" : "s"} taken out of stock.` : "Nothing new — sales lines match items by name." }); reload();
  }
  async function remove(m: Move) {
    if (m.journal_id) { setMsg({ ok: false, text: "This line came from a posted invoice — reverse the invoice instead." }); return; }
    if (!window.confirm(`Delete this ${KIND_LABEL[m.kind] ?? m.kind} of ${qf(Math.abs(m.qty))}${m.transfer_id ? " (and the other side of the transfer / challan)" : ""}?`)) return;
    const q = m.transfer_id ? supabase.from("fw_fin_stock_moves").delete().eq("transfer_id", m.transfer_id).eq("item_id", m.item_id) : supabase.from("fw_fin_stock_moves").delete().eq("id", m.id);
    const { error } = await q; if (error) setMsg({ ok: false, text: error.message }); else { setMsg({ ok: true, text: "Deleted." }); reload(); }
  }

  return (
    <>
      <section className="iv-card" aria-labelledby="mv-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="mv-h">Record a <span style={{ color: HT.goldInk }}>movement</span></h2><div className="iv-sub">{k.hint}{it?.track_expiry ? " · this item tracks expiry" : ""}</div></div>
          <button className="iv-b line" onClick={bringInSales} disabled={busy}>Take past sales out of stock</button>
        </div>
        <datalist id="iv-items2">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
        <div className="iv-form">
          <select className="iv-in" value={f.kind} onChange={e => setF(x => ({ ...x, kind: e.target.value }))} aria-label="Kind">{KINDS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
          <input className="iv-in" list="iv-items2" value={f.item} onChange={e => setF(x => ({ ...x, item: e.target.value }))} placeholder="Item" aria-label="Item" style={{ flex: "2 1 200px" }} />
          <input className="iv-in" value={f.qty} onChange={e => setF(x => ({ ...x, qty: e.target.value }))} inputMode="decimal" placeholder={k.sign === 0 ? "Qty (+/−)" : "Qty"} aria-label="Quantity" style={{ width: 110 }} />
          <input className="iv-in" value={f.rate} onChange={e => setF(x => ({ ...x, rate: e.target.value }))} inputMode="decimal" placeholder={f.kind === "sale" || f.kind === "return_in" ? "Price / unit" : "Cost / unit"} aria-label="Rate" style={{ width: 120 }} />
          <input className="iv-in" type="date" value={f.date} onChange={e => setF(x => ({ ...x, date: e.target.value }))} aria-label="Date" />
          {pro && own.length > 0 && <select className="iv-in" value={f.godown} onChange={e => setF(x => ({ ...x, godown: e.target.value }))} aria-label="Godown">{own.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        </div>
        {pro && <div className="iv-form">
          <input className="iv-in" value={f.batch} onChange={e => setF(x => ({ ...x, batch: e.target.value }))} placeholder={it?.track_batch ? "Batch no. (required)" : "Batch no."} aria-label="Batch" style={{ width: 140 }} />
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14.5, color: HT.muted }}>Mfg <input className="iv-in" type="date" value={f.mfg} onChange={e => setF(x => ({ ...x, mfg: e.target.value }))} /></label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14.5, color: HT.muted }}>Expiry <input className="iv-in" type="date" value={f.expiry} onChange={e => setF(x => ({ ...x, expiry: e.target.value }))} /></label>
          <input className="iv-in" value={f.ref} onChange={e => setF(x => ({ ...x, ref: e.target.value }))} placeholder="Bill / invoice no." aria-label="Reference" style={{ width: 150 }} />
          <input className="iv-in" value={f.party} onChange={e => setF(x => ({ ...x, party: e.target.value }))} placeholder="Supplier / customer" aria-label="Party" style={{ flex: "1 1 160px" }} />
          <input className="iv-in" value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} placeholder="Note" aria-label="Note" style={{ flex: "1 1 160px" }} />
          <button className="iv-b" onClick={save} disabled={busy}>Save</button>
        </div>}
        {!pro && <div className="iv-form"><input className="iv-in" value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} placeholder="Note (bill no., reason)" aria-label="Note" style={{ flex: "1 1 220px" }} /><button className="iv-b" onClick={save} disabled={busy}>Save</button></div>}
      </section>

      <section className="iv-card" aria-labelledby="ml-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="ml-h">Stock <span style={{ color: HT.goldInk }}>ledger</span></h2><div className="iv-sub">Latest first · {moves.length} movements</div></div>
          <select className="iv-in" value={filter.kind} onChange={e => setFilter(x => ({ ...x, kind: e.target.value }))} aria-label="Kind"><option value="">All kinds</option>{Object.entries(KIND_LABEL).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}</select>
          <input className="iv-in" value={filter.q} onChange={e => setFilter(x => ({ ...x, q: e.target.value }))} placeholder="Item, bill no., party, batch" aria-label="Search movements" style={{ width: 240 }} />
        </div>
        <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 980 }}><thead><tr><th>Date · item</th><th>Kind</th><th>Qty</th><th>Rate</th><th>Place</th><th>Batch / expiry</th><th>Ref · party</th><th /></tr></thead><tbody>
          {list.map(m => (
            <tr key={m.id}>
              <td><span style={{ display: "block" }}>{byId.get(m.item_id)?.name ?? "—"}</span><span style={{ fontSize: 13.5, color: HT.muted }}>{dmy(m.date)}</span></td>
              <td><span className="iv-chip" style={m.qty < 0 ? tone.warn : tone.good}>{KIND_LABEL[m.kind] ?? m.kind}</span></td>
              <td style={{ color: m.qty < 0 ? "#B23A20" : "#2F7A57" }}>{m.qty > 0 ? "+" : ""}{qf(m.qty)}</td>
              <td>{m.rate ? inr(m.rate) : "—"}</td>
              <td>{m.godown_id ? place.get(m.godown_id)?.name ?? "—" : "Main"}</td>
              <td>{m.batch || m.expiry ? `${m.batch ?? ""}${m.expiry ? ` · ${dmy(m.expiry)}` : ""}` : "—"}</td>
              <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[m.ref_no, m.party, m.note].filter(Boolean).join(" · ") || (m.journal_id ? "From invoice" : "—")}</td>
              <td><button onClick={() => remove(m)} aria-label="Delete movement" style={{ border: "none", background: "none", color: "#B23A20", cursor: "pointer", fontSize: 18 }}>×</button></td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={8} style={{ color: HT.muted }}>No movements yet.</td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}

/* ───────────────────────── Godowns, branches & transfers ───────────────────────── */
function PlacesTab({ bizId, items, moves, places, busy, insertMoves, setMsg, reload }: { bizId: string | null; items: Item[]; moves: Move[]; places: Godown[]; busy: boolean; insertMoves: (r: Record<string, unknown>[], ok: string) => Promise<boolean>; setMsg: (m: { ok: boolean; text: string } | null) => void; reload: () => void }) {
  const [np, setNp] = useState({ name: "", kind: "godown", gstin: "", state: "" });
  const own = places.filter(p => p.kind !== "job_worker");
  const [t, setT] = useState({ from: own.find(p => p.is_default)?.id ?? own[0]?.id ?? "", to: "", item: "", qty: "", date: today(), ref: "", batch: "" });
  const { grid, defaultId } = useMemo(() => stockByLocation(items, moves, places), [items, moves, places]);
  const cols = places.length ? places : [{ id: defaultId, name: "Main", kind: "godown" } as Godown];
  const fromP = places.find(p => p.id === t.from), toP = places.find(p => p.id === t.to);
  const crossGst = !!(fromP?.gstin && toP?.gstin && fromP.gstin.slice(0, 15).toUpperCase() !== toP.gstin.slice(0, 15).toUpperCase());

  async function addPlace() {
    if (!bizId || !np.name.trim()) { setMsg({ ok: false, text: "Name the godown, branch or job worker." }); return; }
    if (np.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(np.gstin.trim())) { setMsg({ ok: false, text: "That GSTIN doesn't look right (15 characters, e.g. 32ABCDE1234F1Z5)." }); return; }
    const { error } = await supabase.from("fw_fin_godowns").insert({ business_id: bizId, name: np.name.trim(), kind: np.kind, gstin: np.gstin.trim().toUpperCase() || null, state: np.state.trim() || null, is_default: !places.some(p => p.kind !== "job_worker") && np.kind !== "job_worker" });
    if (error) { setMsg({ ok: false, text: /duplicate|unique/i.test(error.message) ? "That name is already used." : error.message }); return; }
    setMsg({ ok: true, text: `✓ Added ${np.name.trim()}.` }); setNp({ name: "", kind: "godown", gstin: "", state: "" }); reload();
  }
  async function makeDefault(p: Godown) {
    if (!bizId) return;
    await supabase.from("fw_fin_godowns").update({ is_default: false }).eq("business_id", bizId);
    await supabase.from("fw_fin_godowns").update({ is_default: true }).eq("id", p.id); reload();
  }
  async function transfer() {
    const it = items.find(i => i.name.toLowerCase() === t.item.trim().toLowerCase());
    const q = Math.abs(Number(t.qty));
    if (!it || !q || !t.from || !t.to || t.from === t.to) { setMsg({ ok: false, text: "Choose the item, quantity, and two different places." }); return; }
    const have = grid.get(it.id)?.get(t.from) ?? 0;
    if (have < q && !window.confirm(`${fromP?.name} shows only ${qf(have)} of ${it.name}. Transfer ${qf(q)} anyway?`)) return;
    const id = uuid(), cost = runItem(it, moves, { to: t.date }).cost;
    const base = { item_id: it.id, date: t.date, rate: cost, ref_no: t.ref.trim() || null, batch: t.batch.trim() || null, transfer_id: id };
    if (await insertMoves([{ ...base, qty: -q, kind: "transfer_out", godown_id: t.from, party: toP?.name ?? null }, { ...base, qty: q, kind: "transfer_in", godown_id: t.to, party: fromP?.name ?? null }],
      `✓ Moved ${qf(q)} ${it.unit ?? ""} of ${it.name} from ${fromP?.name} to ${toP?.name}.${crossGst ? " Different GSTIN — raise a tax invoice for this stock transfer." : ""}`)) setT(x => ({ ...x, qty: "", ref: "", batch: "" }));
  }

  return (
    <>
      <div className="iv-grid2">
        <section className="iv-card" aria-labelledby="tr-h">
          <div className="iv-head"><div><h2 id="tr-h">Inter-branch <span style={{ color: HT.goldInk }}>transfer</span></h2><div className="iv-sub">Moves stock between your godowns and branches — your total stock stays the same.</div></div></div>
          <datalist id="iv-items3">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
          <div className="iv-form">
            <select className="iv-in" value={t.from} onChange={e => setT(x => ({ ...x, from: e.target.value }))} aria-label="From">{own.map(p => <option key={p.id} value={p.id}>From: {p.name}</option>)}</select>
            <select className="iv-in" value={t.to} onChange={e => setT(x => ({ ...x, to: e.target.value }))} aria-label="To"><option value="">To…</option>{own.filter(p => p.id !== t.from).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input className="iv-in" list="iv-items3" value={t.item} onChange={e => setT(x => ({ ...x, item: e.target.value }))} placeholder="Item" aria-label="Item" style={{ flex: "1 1 180px" }} />
            <input className="iv-in" value={t.qty} onChange={e => setT(x => ({ ...x, qty: e.target.value }))} inputMode="decimal" placeholder="Qty" aria-label="Quantity" style={{ width: 90 }} />
            <input className="iv-in" type="date" value={t.date} onChange={e => setT(x => ({ ...x, date: e.target.value }))} aria-label="Date" />
            <input className="iv-in" value={t.ref} onChange={e => setT(x => ({ ...x, ref: e.target.value }))} placeholder="Challan / e-way bill no." aria-label="Reference" style={{ width: 190 }} />
            <input className="iv-in" value={t.batch} onChange={e => setT(x => ({ ...x, batch: e.target.value }))} placeholder="Batch" aria-label="Batch" style={{ width: 110 }} />
            <button className="iv-b" onClick={transfer} disabled={busy || own.length < 2}>Transfer</button>
          </div>
          {own.length < 2 && <div style={{ padding: "0 28px 22px", color: HT.muted, fontSize: 15 }}>Add at least two godowns or branches to transfer between them.</div>}
          {crossGst && <div style={{ margin: "0 28px 22px", padding: "12px 16px", borderRadius: 14, background: "#FBF0D9", color: "#6B4A00", fontSize: 15, lineHeight: 1.55 }}>These two places have <b>different GSTINs</b>. A transfer between them is a supply under GST (Schedule I) — raise a tax invoice at a fair value and include it in GSTR-1; the receiving branch takes the ITC.</div>}
        </section>
        <section className="iv-card" aria-labelledby="pl-add">
          <div className="iv-head"><div><h2 id="pl-add">Add a <span style={{ color: HT.goldInk }}>place</span></h2><div className="iv-sub">Godowns, branches (same or another GSTIN), and job workers who hold your material.</div></div></div>
          <div className="iv-form">
            <input className="iv-in" value={np.name} onChange={e => setNp(x => ({ ...x, name: e.target.value }))} placeholder="Name" aria-label="Name" style={{ flex: "1 1 180px" }} />
            <select className="iv-in" value={np.kind} onChange={e => setNp(x => ({ ...x, kind: e.target.value }))} aria-label="Type"><option value="godown">Godown</option><option value="branch">Branch</option><option value="job_worker">Job worker</option></select>
            <input className="iv-in" value={np.gstin} onChange={e => setNp(x => ({ ...x, gstin: e.target.value.toUpperCase() }))} placeholder="GSTIN (optional)" aria-label="GSTIN" style={{ width: 190 }} />
            <input className="iv-in" value={np.state} onChange={e => setNp(x => ({ ...x, state: e.target.value }))} placeholder="State" aria-label="State" style={{ width: 120 }} />
            <button className="iv-b" onClick={addPlace} disabled={busy}>Add</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 28px 24px" }}>
            {places.map(p => <span key={p.id} className="iv-chip" style={{ ...(p.kind === "job_worker" ? tone.warn : p.kind === "branch" ? tone.good : tone.plain), fontSize: 14, padding: "6px 12px", display: "inline-flex", gap: 8, alignItems: "center" }}>
              {p.name} · {p.kind === "job_worker" ? "Job worker" : p.kind === "branch" ? "Branch" : "Godown"}{p.gstin ? ` · ${p.gstin}` : ""}
              {p.is_default ? <b style={{ fontWeight: 700 }}>· default</b> : p.kind !== "job_worker" ? <button onClick={() => makeDefault(p)} style={{ border: "none", background: "none", color: HT.goldInk, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>make default</button> : null}
            </span>)}
            {!places.length && <span style={{ color: HT.muted, fontSize: 15 }}>No places yet — everything sits in “Main”.</span>}
          </div>
        </section>
      </div>

      <section className="iv-card" aria-labelledby="loc-h">
        <div className="iv-head"><div><h2 id="loc-h">Stock by <span style={{ color: HT.goldInk }}>place</span></h2><div className="iv-sub">Opening stock and entries without a place count at the default godown.</div></div></div>
        <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 300 + cols.length * 140 }}><thead><tr><th>Item</th>{cols.map(c => <th key={c.id}>{c.name}</th>)}<th>Total</th></tr></thead><tbody>
          {items.map(i => { const g = grid.get(i.id); const tot = [...(g?.values() ?? [])].reduce((s, v) => s + v, 0); if (!g || !tot && ![...g.values()].some(v => v)) return null; return (
            <tr key={i.id}><td>{i.name}</td>{cols.map(c => { const v = g.get(c.id) ?? 0; return <td key={c.id} style={{ color: v < 0 ? "#B23A20" : v ? HT.ink : "#C9C2B2" }}>{v ? qf(v) : "—"}</td>; })}<td style={{ fontSize: 16 }}>{qf(tot)} <span style={{ color: HT.muted, fontSize: 13 }}>{i.unit ?? ""}</span></td></tr>); })}
        </tbody></table></div>
      </section>
    </>
  );
}

/* ───────────────────────── Job work ───────────────────────── */
function JobWorkTab({ bizId, items, moves, places, jw, busy, insertMoves, setMsg }: { bizId: string | null; items: Item[]; moves: Move[]; places: Godown[]; jw: ReturnType<typeof jobWork>; busy: boolean; insertMoves: (r: Record<string, unknown>[], ok: string) => Promise<boolean>; setMsg: (m: { ok: boolean; text: string } | null) => void; reload: () => void }) {
  const own = places.filter(p => p.kind !== "job_worker"), workers = places.filter(p => p.kind === "job_worker");
  const [s, setS] = useState({ from: own.find(p => p.is_default)?.id ?? own[0]?.id ?? "", worker: workers[0]?.id ?? "", item: "", qty: "", date: today(), challan: "", process: "" });
  const [back, setBack] = useState<{ id: string; qty: string; scrap: string; date: string } | null>(null);
  const [period, setPeriod] = useState({ from: fyStart(), to: today() });
  const byMove = new Map(moves.map(m => [m.id, m]));

  async function send() {
    const it = items.find(i => i.name.toLowerCase() === s.item.trim().toLowerCase());
    const q = Math.abs(Number(s.qty)); const w = workers.find(x => x.id === s.worker);
    if (!it || !q || !w || !s.from) { setMsg({ ok: false, text: "Choose the item, quantity, your godown and the job worker (add job workers in Godowns & transfers)." }); return; }
    if (!s.challan.trim()) { setMsg({ ok: false, text: "Enter the delivery challan number — job work goods move on a challan (rule 45)." }); return; }
    const id = uuid(), cost = runItem(it, moves, { to: s.date }).cost;
    const base = { item_id: it.id, date: s.date, rate: cost, ref_no: s.challan.trim(), transfer_id: id, note: s.process.trim() || null };
    if (await insertMoves([{ ...base, qty: -q, kind: "jobwork_out", godown_id: s.from, party: w.name }, { ...base, qty: q, kind: "jobwork_out", godown_id: w.id, party: w.name }],
      `✓ Sent ${qf(q)} ${it.unit ?? ""} of ${it.name} to ${w.name} on challan ${s.challan.trim()}. It must come back by ${dmy(addDays(s.date, it.is_capital_good ? 1095 : 365))}.`)) setS(x => ({ ...x, qty: "", challan: "", process: "" }));
  }
  async function receive(row: (typeof jw)[number]) {
    if (!back) return;
    const out = byMove.get(row.id); if (!out?.transfer_id) return;
    const atWorker = moves.find(m => m.transfer_id === out.transfer_id && m.kind === "jobwork_out" && m.qty > 0);
    const q = Math.abs(Number(back.qty) || 0), sc = Math.abs(Number(back.scrap) || 0);
    if (!q && !sc) { setMsg({ ok: false, text: "Enter the quantity received back (and any scrap)." }); return; }
    if (q + sc > row.pending + 1e-9) { setMsg({ ok: false, text: `Only ${qf(row.pending)} is still with the job worker.` }); return; }
    const base = { item_id: row.item.id, date: back.date, rate: out.rate, ref_no: row.challan, transfer_id: out.transfer_id, party: row.worker };
    const legs: Record<string, unknown>[] = [];
    if (q) legs.push({ ...base, qty: -q, kind: "jobwork_in", godown_id: atWorker?.godown_id ?? null }, { ...base, qty: q, kind: "jobwork_in", godown_id: out.godown_id ?? null });
    if (sc) legs.push({ ...base, qty: -sc, kind: "scrap", godown_id: atWorker?.godown_id ?? null, note: "Job-work scrap / process loss" });
    if (await insertMoves(legs, `✓ Received ${qf(q)} back from ${row.worker}${sc ? `, ${qf(sc)} scrap written off` : ""}.`)) setBack(null);
  }
  async function itc04() {
    const XLSX = await import("xlsx");
    const inP = (d: string) => d >= period.from && d <= period.to;
    const sent = jw.filter(j => inP(j.date)).map(j => [j.workerGstin ?? "", j.worker, j.challan, j.date, j.item.name, j.item.hsn ?? "", j.item.unit ?? "", j.sent, Math.round(j.value), j.item.gst_rate ?? ""]);
    const recd = moves.filter(m => m.kind === "jobwork_in" && m.qty > 0 && inP(m.date)).map(m => { const it = items.find(i => i.id === m.item_id); const o = jw.find(j => byMove.get(j.id)?.transfer_id === m.transfer_id); return [o?.workerGstin ?? "", o?.worker ?? m.party ?? "", m.ref_no ?? "", o?.date ?? "", m.date, it?.name ?? "", it?.unit ?? "", m.qty]; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ITC-04 · Goods sent to job worker", `${period.from} to ${period.to}`], [], ["Job worker GSTIN", "Job worker", "Challan no.", "Challan date", "Goods", "HSN", "UQC", "Quantity", "Taxable value", "GST rate %"], ...sent]), "Sent (4)");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ITC-04 · Goods received back from job worker", `${period.from} to ${period.to}`], [], ["Job worker GSTIN", "Job worker", "Original challan no.", "Original challan date", "Received on", "Goods", "UQC", "Quantity"], ...recd]), "Received (5A)");
    XLSX.writeFile(wb, `ITC-04-${period.from}-to-${period.to}.xlsx`);
    if (!bizId) return;
  }
  const status = { overdue: ["Past the limit", tone.bad], due_soon: ["Due soon", tone.warn], open: ["Open", tone.plain], closed: ["Closed", tone.good] } as const;

  return (
    <>
      <section className="iv-card" aria-labelledby="jw-h">
        <div className="iv-head"><div><h2 id="jw-h">Send to a <span style={{ color: HT.goldInk }}>job worker</span></h2><div className="iv-sub">On a delivery challan, without tax (section 143). Inputs must come back within 1 year, capital goods within 3 — otherwise they count as supplied on the day they left.</div></div></div>
        <datalist id="iv-items4">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
        <div className="iv-form">
          <select className="iv-in" value={s.from} onChange={e => setS(x => ({ ...x, from: e.target.value }))} aria-label="From godown">{own.map(p => <option key={p.id} value={p.id}>From: {p.name}</option>)}</select>
          <select className="iv-in" value={s.worker} onChange={e => setS(x => ({ ...x, worker: e.target.value }))} aria-label="Job worker">{!workers.length && <option value="">Add a job worker first</option>}{workers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input className="iv-in" list="iv-items4" value={s.item} onChange={e => setS(x => ({ ...x, item: e.target.value }))} placeholder="Material" aria-label="Item" style={{ flex: "1 1 180px" }} />
          <input className="iv-in" value={s.qty} onChange={e => setS(x => ({ ...x, qty: e.target.value }))} inputMode="decimal" placeholder="Qty" aria-label="Quantity" style={{ width: 90 }} />
          <input className="iv-in" type="date" value={s.date} onChange={e => setS(x => ({ ...x, date: e.target.value }))} aria-label="Date" />
          <input className="iv-in" value={s.challan} onChange={e => setS(x => ({ ...x, challan: e.target.value }))} placeholder="Challan no." aria-label="Challan number" style={{ width: 130 }} />
          <input className="iv-in" value={s.process} onChange={e => setS(x => ({ ...x, process: e.target.value }))} placeholder="Process (e.g. polishing)" aria-label="Process" style={{ width: 190 }} />
          <button className="iv-b" onClick={send} disabled={busy || !workers.length}>Send</button>
        </div>
      </section>

      <section className="iv-card" aria-labelledby="jwo-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="jwo-h">Challans <span style={{ color: HT.goldInk }}>out</span></h2><div className="iv-sub">{jw.filter(j => j.status !== "closed").length} open · {jw.filter(j => j.status === "overdue").length} past the limit</div></div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14.5, color: HT.muted }}>ITC-04 from <input className="iv-in" type="date" value={period.from} onChange={e => setPeriod(x => ({ ...x, from: e.target.value }))} /></label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14.5, color: HT.muted }}>to <input className="iv-in" type="date" value={period.to} onChange={e => setPeriod(x => ({ ...x, to: e.target.value }))} /></label>
          <button className="iv-b gold" onClick={itc04}>⬇ ITC-04 (Excel)</button>
        </div>
        <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 1040 }}><thead><tr><th>Challan · job worker</th><th>Material</th><th>Sent</th><th>Back</th><th>Scrap</th><th>Pending</th><th>Return by</th><th>Status</th><th /></tr></thead><tbody>
          {jw.map(j => { const [lab, st] = status[j.status]; return (
            <tr key={j.id}>
              <td><span style={{ display: "block" }}>{j.challan} · {dmy(j.date)}</span><span style={{ fontSize: 13.5, color: HT.muted }}>{j.worker}{j.workerGstin ? ` · ${j.workerGstin}` : ""}</span></td>
              <td>{j.item.name}</td><td>{qf(j.sent)}</td><td>{qf(j.back)}</td><td>{j.scrap ? qf(j.scrap) : "—"}</td><td style={{ fontSize: 16 }}>{qf(j.pending)}</td>
              <td>{dmy(j.dueBy)}{j.status !== "closed" && <span style={{ display: "block", fontSize: 13, color: j.daysLeft < 0 ? "#B23A20" : HT.muted }}>{j.daysLeft < 0 ? `${-j.daysLeft} days late` : `${j.daysLeft} days left`}</span>}</td>
              <td><span className="iv-chip" style={st}>{lab}</span></td>
              <td>{j.status !== "closed" && (back?.id === j.id
                ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input className="iv-in" autoFocus value={back.qty} onChange={e => setBack({ ...back, qty: e.target.value })} placeholder="Back" aria-label="Quantity back" style={{ width: 80 }} />
                    <input className="iv-in" value={back.scrap} onChange={e => setBack({ ...back, scrap: e.target.value })} placeholder="Scrap" aria-label="Scrap" style={{ width: 80 }} />
                    <input className="iv-in" type="date" value={back.date} onChange={e => setBack({ ...back, date: e.target.value })} aria-label="Received on" />
                    <button className="iv-b" onClick={() => receive(j)} disabled={busy}>Save</button>
                  </span>
                : <button className="iv-b line" onClick={() => setBack({ id: j.id, qty: String(j.pending), scrap: "", date: today() })}>Receive back</button>)}</td>
            </tr>); })}
          {!jw.length && <tr><td colSpan={9} style={{ color: HT.muted }}>No material sent for job work yet.</td></tr>}
        </tbody></table></div>
        <div style={{ padding: "14px 28px 22px", fontSize: 14.5, color: HT.muted, lineHeight: 1.6 }}>ITC-04 is filed half-yearly (April–September by 25 October, October–March by 25 April) by manufacturers with turnover above ₹5 crore, and yearly otherwise. Check the export against your challans before filing.</div>
      </section>
    </>
  );
}

/* ───────────────────────── Batches & expiry ───────────────────────── */
function ExpiryTab({ bats, busy, insertMoves }: { bats: ReturnType<typeof batchList>; busy: boolean; insertMoves: (r: Record<string, unknown>[], ok: string) => Promise<boolean> }) {
  const [show, setShow] = useState<"risk" | "all">("risk");
  const list = show === "risk" ? bats.filter(b => b.status !== "ok" && b.status !== "none") : bats;
  const sum = (s: string) => bats.filter(b => b.status === s).reduce((t, b) => t + b.value, 0);
  const label: Record<string, [string, React.CSSProperties]> = { expired: ["Expired", tone.bad], "30": ["≤ 30 days", tone.warn], "60": ["31–60 days", tone.warn], "90": ["61–90 days", tone.plain], ok: ["OK", tone.good], none: ["No expiry", tone.plain] };
  async function writeOff(b: (typeof bats)[number]) {
    if (!window.confirm(`Write off ${qf(b.qty)} of ${b.item.name}, batch ${b.batch} (expired ${dmy(b.expiry)})? This takes it out of stock as scrap.`)) return;
    await insertMoves([{ item_id: b.item.id, date: today(), qty: -b.qty, rate: 0, kind: "scrap", batch: b.batch === "—" ? null : b.batch, expiry: b.expiry, note: "Expired stock written off" }], `✓ Wrote off ${qf(b.qty)} of ${b.item.name} (batch ${b.batch}).`);
  }
  return (
    <section className="iv-card" aria-labelledby="ex-h">
      <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="ex-h">Batches & <span style={{ color: HT.goldInk }}>expiry</span></h2><div className="iv-sub">Stock still on hand, batch by batch, soonest expiry first. Enter batch and expiry when stock comes in (Movements).</div></div>
        <div className="iv-form" style={{ padding: 0 }}><button className={"iv-b" + (show === "risk" ? "" : " line")} onClick={() => setShow("risk")}>Expiring & expired</button><button className={"iv-b" + (show === "all" ? "" : " line")} onClick={() => setShow("all")}>All batches</button></div>
      </div>
      <div className="iv-kpis">
        {[["Expired", sum("expired"), tone.bad], ["Within 30 days", sum("30"), tone.warn], ["31–60 days", sum("60"), tone.warn], ["61–90 days", sum("90"), tone.plain]].map(([l, v, st]) => <div key={String(l)} className="iv-k" style={Number(v) ? { background: (st as React.CSSProperties).background as string } : undefined}><small>{String(l)}</small><b>{inr(Number(v))}</b></div>)}
      </div>
      <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 860 }}><thead><tr><th>Item · batch</th><th>Expiry</th><th>Days left</th><th>Qty</th><th>Value</th><th>Status</th><th /></tr></thead><tbody>
        {list.map(b => (
          <tr key={`${b.item.id}-${b.batch}-${b.expiry}`}>
            <td><span style={{ display: "block" }}>{b.item.name}</span><span style={{ fontSize: 13.5, color: HT.muted }}>Batch {b.batch}</span></td>
            <td>{dmy(b.expiry)}</td><td style={{ color: (b.daysLeft ?? 1) < 0 ? "#B23A20" : HT.ink }}>{b.daysLeft == null ? "—" : b.daysLeft}</td>
            <td>{qf(b.qty)} <span style={{ color: HT.muted, fontSize: 13 }}>{b.item.unit ?? ""}</span></td><td>{inr(b.value)}</td>
            <td><span className="iv-chip" style={label[b.status][1]}>{label[b.status][0]}</span></td>
            <td>{b.status === "expired" && <button className="iv-b line" onClick={() => writeOff(b)} disabled={busy}>Write off</button>}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={7} style={{ color: HT.muted }}>{bats.length ? "Nothing expiring in the next 90 days." : "No batches yet — tick Batches / Expiry on an item and enter them when stock comes in."}</td></tr>}
      </tbody></table></div>
    </section>
  );
}

/* ───────────────────────── Compare & movers ───────────────────────── */
function CompareTab({ items, moves, mov }: { items: Item[]; moves: Move[]; mov: ReturnType<typeof movers> }) {
  const presets = useMemo(() => {
    const t = today(), fy = fyStart(t), lastFy = `${+fy.slice(0, 4) - 1}-04-01`;
    const m0 = t.slice(0, 7) + "-01", pm = new Date(+t.slice(0, 4), +t.slice(5, 7) - 2, 1), pmS = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, "0")}-01`;
    return {
      month: { a: { from: m0, to: t }, b: { from: pmS, to: addDays(m0, -1) }, l: ["This month", "Last month"] },
      fy: { a: { from: fy, to: t }, b: { from: lastFy, to: addDays(fy, -1) }, l: ["This FY", "Last FY"] },
      ytd: { a: { from: fy, to: t }, b: { from: lastFy, to: t.slice(5) === "02-29" ? `${+t.slice(0, 4) - 1}-02-28` : `${+t.slice(0, 4) - 1}${t.slice(4)}` }, l: ["This FY to date", "Same period last FY"] },
    };
  }, []);
  const [p, setP] = useState<keyof typeof presets>("ytd");
  const [speed, setSpeed] = useState<"" | "fast" | "slow" | "dead">("");
  const A = useMemo(() => periodSummary(items, moves, presets[p].a.from, presets[p].a.to), [items, moves, presets, p]);
  const B = useMemo(() => periodSummary(items, moves, presets[p].b.from, presets[p].b.to), [items, moves, presets, p]);
  const chg = (a: number, b: number) => b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null;
  const pct = (v: number | null) => v == null ? "—" : `${v > 0 ? "▲" : v < 0 ? "▼" : ""} ${Math.abs(v)}%`;
  const rows = A.rows.map((r, i) => ({ a: r, b: B.rows[i] })).filter(x => x.a.salesValue || x.b.salesValue || x.a.closeQty || x.b.closeQty).sort((x, y) => y.a.salesValue - x.a.salesValue);
  const [la, lb] = presets[p].l;
  const sp = { fast: ["Fast", tone.good], slow: ["Slow", tone.warn], dead: ["Dead", tone.bad], new: ["New / none", tone.plain] } as const;

  return (
    <>
      <section className="iv-card" aria-labelledby="cmp-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="cmp-h">Period <span style={{ color: HT.goldInk }}>comparison</span></h2><div className="iv-sub">{la}: {dmy(presets[p].a.from)} – {dmy(presets[p].a.to)} · {lb}: {dmy(presets[p].b.from)} – {dmy(presets[p].b.to)}</div></div>
          <select className="iv-in" value={p} onChange={e => setP(e.target.value as keyof typeof presets)} aria-label="Compare">{Object.entries(presets).map(([k, v]) => <option key={k} value={k}>{v.l[0]} vs {v.l[1]}</option>)}</select>
        </div>
        <div className="iv-kpis">
          {[["Sales", A.totals.salesValue, B.totals.salesValue], ["Cost of goods", A.totals.cogs, B.totals.cogs], ["Gross margin", A.totals.margin, B.totals.margin], ["Closing stock", A.totals.closeValue, B.totals.closeValue], ["Purchases", A.totals.inValue, B.totals.inValue]].map(([l, a, b]) => { const c = chg(Number(a), Number(b)); return (
            <div key={String(l)} className="iv-k"><small>{String(l)}</small><b>{inr(Number(a))}</b><span style={{ fontSize: 13.5, color: c == null ? HT.muted : (l === "Cost of goods" ? c <= 0 : c >= 0) ? "#2F7A57" : "#B23A20" }}>{pct(c)} vs {inr(Number(b))}</span></div>); })}
        </div>
        <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 1000 }}><thead><tr><th>Item</th><th>Sold ({la})</th><th>Sold ({lb})</th><th>Sales</th><th>Change</th><th>Margin</th><th>Margin %</th><th>Closing qty</th></tr></thead><tbody>
          {rows.map(({ a, b }) => (
            <tr key={a.item.id}><td>{a.item.name}</td><td>{qf(a.soldQty)}</td><td style={{ color: HT.muted }}>{qf(b.soldQty)}</td><td>{inr(a.salesValue)}</td>
              <td style={{ color: (chg(a.salesValue, b.salesValue) ?? 0) >= 0 ? "#2F7A57" : "#B23A20" }}>{pct(chg(a.salesValue, b.salesValue))}</td>
              <td>{inr(a.margin)}</td><td>{a.marginPct == null ? "—" : `${a.marginPct}%`}{b.marginPct != null && <span style={{ color: HT.muted }}> ({b.marginPct}%)</span>}</td><td>{qf(a.closeQty)}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={8} style={{ color: HT.muted }}>No sales in either period.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="iv-card" aria-labelledby="mvr-h">
        <div className="iv-head"><div style={{ marginRight: "auto" }}><h2 id="mvr-h">Fast, slow <span style={{ color: HT.goldInk }}>& dead stock</span></h2><div className="iv-sub">Last 90 days. Turnover = quantity out ÷ average stock. Dead = stock on hand, nothing sold or used.</div></div>
          <div className="iv-form" style={{ padding: 0 }}>{(["", "fast", "slow", "dead"] as const).map(k => <button key={k} className={"iv-b" + (speed === k ? "" : " line")} onClick={() => setSpeed(k)}>{k ? sp[k][0] : "All"} {k ? mov.filter(m => m.speed === k).length : mov.length}</button>)}</div>
        </div>
        <div className="iv-scroll"><table className="iv-tbl" style={{ minWidth: 820 }}><thead><tr><th>Item</th><th>On hand</th><th>Value</th><th>Out (90 d)</th><th>Turnover</th><th>Last sold</th><th>Speed</th></tr></thead><tbody>
          {mov.filter(m => !speed || m.speed === speed).sort((a, b) => b.value - a.value).map(m => (
            <tr key={m.item.id}><td>{m.item.name}</td><td>{qf(m.qty)}</td><td>{inr(m.value)}</td><td>{qf(m.outQty)}</td><td>{m.turnover == null ? "—" : `${m.turnover}×`}</td>
              <td>{m.lastOut ? `${dmy(m.lastOut)} · ${m.idleDays} d ago` : "Never"}</td><td><span className="iv-chip" style={sp[m.speed][1]}>{sp[m.speed][0]}</span></td></tr>
          ))}
        </tbody></table></div>
      </section>
    </>
  );
}
