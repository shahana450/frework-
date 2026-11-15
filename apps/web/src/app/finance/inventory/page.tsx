"use client";
// Inventory — each item's stock on hand (opening + purchases/adjustments − sales), what it's worth at cost, and what's
// running low. Sales invoices take stock out automatically; stock comes in here (or from bills). Basic by design:
// one location, weighted cost from purchases.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import PageHero, { HT, SERIF } from "@/components/finance/PageHero";

type Item = { id: string; name: string; hsn: string | null; unit: string | null; rate: number; opening_qty: number; opening_rate: number; reorder_level: number; track_stock: boolean; is_service: boolean };
type Move = { id: string; item_id: string; date: string; qty: number; rate: number; kind: string; journal_id: string | null; note: string | null };
const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) => "₹" + Math.round(v).toLocaleString("en-IN");
const qtyFmt = (v: number) => (Math.round(v * 1000) / 1000).toLocaleString("en-IN");
const today = () => new Date().toLocaleDateString("en-CA");

export default function Inventory() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ item: "", qty: "", rate: "", date: today(), kind: "purchase", note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ni, setNi] = useState({ name: "", hsn: "", unit: "NOS", qty: "", cost: "", price: "", gst: "18" });
  const [hsn, setHsn] = useState<{ q: string; busy: boolean; hits: { hsn: string; description: string; gst_rate: number | null }[]; source: string | null; open: boolean }>({ q: "", busy: false, hits: [], source: null, open: false });
  const existing = items.find(i => i.name.trim().toLowerCase() === ni.name.trim().toLowerCase());

  async function load(b: string) {
    setLoading(true);
    const it = await supabase.from("fw_fin_items").select("id,name,hsn,unit,rate,opening_qty,opening_rate,reorder_level,track_stock,is_service").eq("business_id", b).eq("is_active", true).order("name");
    if (it.error) { setSetup(/opening_qty|column|does not exist|schema cache/i.test(it.error.message)); setLoading(false); return; }
    const mv: Move[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("fw_fin_stock_moves").select("id,item_id,date,qty,rate,kind,journal_id,note").eq("business_id", b).order("date").range(from, from + 999);
      if (error) { setSetup(true); break; }
      mv.push(...((data ?? []) as Move[])); if (!data || data.length < 1000) break;
    }
    setItems(((it.data ?? []) as Item[]).filter(i => !i.is_service && i.track_stock !== false));
    setMoves(mv); setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login?next=/finance/inventory"); return; }
      const b = (readActiveBusiness(user.id) ?? "").trim(); if (!b) { router.push("/finance/setup"); return; }
      setBizId(b); void load(b);
    });
  }, [router]);

  // On hand and cost (weighted average of opening + purchases)
  const rows = useMemo(() => items.map(i => {
    const m = moves.filter(x => x.item_id === i.id);
    const inQty = n(i.opening_qty) + m.filter(x => x.qty > 0).reduce((s, x) => s + n(x.qty), 0);
    const inCost = n(i.opening_qty) * n(i.opening_rate) + m.filter(x => x.qty > 0 && x.kind !== "adjustment").reduce((s, x) => s + n(x.qty) * n(x.rate), 0);
    const onHand = n(i.opening_qty) + m.reduce((s, x) => s + n(x.qty), 0);
    const cost = inQty > 0 && inCost > 0 ? inCost / inQty : n(i.opening_rate) || 0;
    const sold = -m.filter(x => x.kind === "sale").reduce((s, x) => s + n(x.qty), 0);
    return { ...i, onHand, cost, value: Math.max(0, onHand) * cost, sold, low: n(i.reorder_level) > 0 && onHand <= n(i.reorder_level) };
  }).filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()) || (r.hsn ?? "").includes(q.trim())), [items, moves, q]);
  const total = rows.reduce((s, r) => s + r.value, 0), lows = rows.filter(r => r.low || r.onHand < 0);

  async function addMove() {
    if (!bizId) return;
    const it = items.find(i => i.name.toLowerCase() === form.item.trim().toLowerCase());
    const qty = Number(form.qty);
    if (!it) { setMsg({ ok: false, text: "Pick an item from the list (add new items in Items)." }); return; }
    if (!qty) { setMsg({ ok: false, text: "Enter a quantity (use minus for an adjustment down)." }); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fw_fin_stock_moves").insert({ business_id: bizId, item_id: it.id, date: form.date, qty: form.kind === "purchase" ? Math.abs(qty) : qty, rate: Number(form.rate) || 0, kind: form.kind, note: form.note.trim() || null, created_by: user?.id ?? null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `✓ ${form.kind === "purchase" ? "Stock in" : "Adjustment"}: ${qtyFmt(qty)} ${it.unit ?? ""} of ${it.name}.` });
    setForm(f => ({ ...f, qty: "", rate: "", note: "" })); void load(bizId);
  }
  async function findHsn() {
    if (!bizId || hsn.q.trim().length < 2) return;
    setHsn(h => ({ ...h, busy: true, hits: [], source: null }));
    const d = await fetch(`/api/finance/hsn?business_id=${bizId}&q=${encodeURIComponent(hsn.q.trim())}`).then(r => r.json()).catch(() => ({}));
    setHsn(h => ({ ...h, busy: false, hits: d.hits ?? [], source: d.source ?? "none" }));
  }
  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["Item name", "HSN", "Unit", "Opening qty", "Cost per unit", "Selling price", "GST %", "Reorder level"], ["Basmati rice 25 kg", "10063020", "BAG", 40, 1850, 2100, 5, 10], ...items.map(i => [i.name, i.hsn ?? "", i.unit ?? "NOS", i.opening_qty || "", i.opening_rate || "", i.rate || "", "", i.reorder_level || ""])]);
    ws["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, "FreBook-Stock-Template.xlsx");
  }
  async function bulkUpload(f: File) {
    if (!bizId) return;
    setBusy(true); setMsg(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const head = (grid[0] ?? []).map(h => String(h).toLowerCase());
      const col = (re: RegExp) => head.findIndex(h => re.test(h));
      const c = { name: col(/item|name|description/), hsn: col(/hsn|sac/), unit: col(/unit|uom/), qty: col(/open.*qty|qty|quantity/), cost: col(/cost/), price: col(/sell|price|rate/), gst: col(/gst|tax/), reorder: col(/reorder|min/) };
      if (c.name < 0) throw new Error("The first row needs an 'Item name' column — download the template.");
      const byName = new Map(items.map(i => [i.name.trim().toLowerCase(), i]));
      let added = 0, updated = 0;
      const num = (r: unknown[], i: number) => i < 0 ? undefined : (String(r[i]).trim() === "" ? undefined : Number(String(r[i]).replace(/[,₹\s]/g, "")) || 0);
      for (const r of grid.slice(1)) {
        const name = String(r[c.name] ?? "").trim();
        if (!name || /^basmati rice 25 kg$/i.test(name) && !byName.has(name.toLowerCase())) continue;   // skip blanks and the sample row
        const row: Record<string, unknown> = {};
        const hsnV = c.hsn >= 0 ? String(r[c.hsn] ?? "").replace(/\D/g, "").slice(0, 8) : "";
        if (hsnV) row.hsn = hsnV;
        if (c.unit >= 0 && String(r[c.unit]).trim()) row.unit = String(r[c.unit]).trim().toUpperCase().slice(0, 8);
        const q = num(r, c.qty), co = num(r, c.cost), pr = num(r, c.price), g = num(r, c.gst), ro = num(r, c.reorder);
        if (q !== undefined) row.opening_qty = q; if (co !== undefined) row.opening_rate = co; if (pr !== undefined) row.rate = pr; if (g !== undefined) row.gst_rate = g; if (ro !== undefined) row.reorder_level = ro;
        const old = byName.get(name.toLowerCase());
        if (old) { if (Object.keys(row).length) { const { error } = await supabase.from("fw_fin_items").update(row).eq("id", old.id); if (!error) updated++; } }
        else { const { error } = await supabase.from("fw_fin_items").insert({ business_id: bizId, name, unit: "NOS", is_service: false, ...row }); if (!error) { added++; byName.set(name.toLowerCase(), { name } as Item); } }
      }
      setMsg({ ok: true, text: `✓ ${added} item${added === 1 ? "" : "s"} added, ${updated} updated from ${f.name}.` });
      void load(bizId);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't read that file." }); }
    setBusy(false);
  }
  async function addItem() {
    if (!bizId || !ni.name.trim()) { setMsg({ ok: false, text: "Type the item's name." }); return; }
    if (existing) {
      await saveItem(existing, { hsn: ni.hsn.trim() || null, unit: ni.unit.trim() || "NOS", rate: Number(ni.price) || 0, opening_qty: Number(ni.qty) || 0, opening_rate: Number(ni.cost) || 0 });
      setMsg({ ok: true, text: `✓ Updated ${existing.name}.` }); setNi({ name: "", hsn: "", unit: "NOS", qty: "", cost: "", price: "", gst: "18" }); return;
    }
    setBusy(true);
    const { error } = await supabase.from("fw_fin_items").insert({ business_id: bizId, name: ni.name.trim(), hsn: ni.hsn.trim() || null, unit: ni.unit.trim() || "NOS", rate: Number(ni.price) || 0, gst_rate: Number(ni.gst) || 0, opening_qty: Number(ni.qty) || 0, opening_rate: Number(ni.cost) || 0, is_service: false });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /duplicate|unique/i.test(error.message) ? `"${ni.name.trim()}" is already an item.` : error.message }); return; }
    setMsg({ ok: true, text: `✓ Added ${ni.name.trim()}.` });
    setNi({ name: "", hsn: "", unit: "NOS", qty: "", cost: "", price: "", gst: "18" }); void load(bizId);
  }
  async function saveItem(i: Item, patch: Partial<Item>) {
    const { error } = await supabase.from("fw_fin_items").update(patch).eq("id", i.id);
    if (error) setMsg({ ok: false, text: error.message }); else setItems(xs => xs.map(x => x.id === i.id ? { ...x, ...patch } : x));
  }
  // Sales already posted with item lines (from the sales invoice form): take that stock out, once each
  async function bringInSales() {
    if (!bizId) return;
    setBusy(true); setMsg(null);
    const byName = new Map(items.map(i => [i.name.trim().toLowerCase(), i]));
    const rowsToAdd: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 500) {
      const { data } = await supabase.from("fw_fin_journals").select("id,date,metadata").eq("business_id", bizId).eq("status", "posted").eq("type", "sales").range(from, from + 499);
      for (const j of (data ?? []) as { id: string; date: string; metadata: { gst_invoice?: { items?: { desc?: string; qty?: number; taxable?: number }[] } } | null }[])
        for (const li of j.metadata?.gst_invoice?.items ?? []) {
          const it = byName.get(String(li.desc ?? "").trim().toLowerCase());
          if (it && n(li.qty) > 0 && !moves.some(m => m.journal_id === j.id && m.item_id === it.id) && !rowsToAdd.some(r => r.journal_id === j.id && r.item_id === it.id))
            rowsToAdd.push({ business_id: bizId, item_id: it.id, date: String(j.date).slice(0, 10), qty: -n(li.qty), rate: n(li.qty) ? n(li.taxable) / n(li.qty) : 0, kind: "sale", journal_id: j.id });
        }
      if (!data || data.length < 500) break;
    }
    for (let i = 0; i < rowsToAdd.length; i += 200) await supabase.from("fw_fin_stock_moves").insert(rowsToAdd.slice(i, i + 200));
    setBusy(false);
    setMsg({ ok: true, text: rowsToAdd.length ? `✓ ${rowsToAdd.length} sale line${rowsToAdd.length === 1 ? "" : "s"} taken out of stock.` : "Nothing new — sales lines match items by name; check item names if you expected some." });
    void load(bizId);
  }

  const card: React.CSSProperties = { background: HT.paper, border: `1px solid ${HT.line}`, borderRadius: 18 };
  const input: React.CSSProperties = { height: 38, borderRadius: 9, border: `1px solid ${HT.line}`, padding: "0 10px", fontFamily: "inherit", fontSize: 14, background: "#FFFFFF", minWidth: 0 };
  const btn: React.CSSProperties = { height: 38, padding: "0 16px", borderRadius: 999, border: "none", background: "#12352D", color: "#FFFFFF", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: HT.cream, color: HT.ink, fontFamily: SERIF }}>
      <PageHero eyebrow="Inventory · stock on hand" title="What's in stock"
        sub="Opening stock plus what came in, less what was sold. Sales invoices take stock out by themselves."
        tiles={loading || setup ? undefined : [
          { label: "Items tracked", value: String(rows.length) },
          { label: "Stock value (cost)", value: inr(total), tone: "good" },
          { label: "Low or negative", value: String(lows.length), tone: lows.length ? "warn" : "plain" },
        ]} />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
        {setup && <div role="alert" style={{ ...card, padding: "16px 20px", color: "#8A5A00" }}>Inventory needs a one-time database step: run <b>2026-11-02_inventory.sql</b> in Supabase → SQL Editor, then reload this page.</div>}
        {msg && <div role="status" style={{ ...card, padding: "12px 18px", color: msg.ok ? "#0B7A55" : "#B4321F" }}>{msg.text}</div>}

        {!setup && (
          <section style={{ ...card, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }} aria-labelledby="mv-h">
            <h2 id="mv-h" style={{ margin: 0, fontSize: 20, fontWeight: 400, fontStyle: "italic" }}>Stock in or adjust</h2>
            <datalist id="inv-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} style={input} aria-label="Kind">
                <option value="purchase">Stock in (purchase)</option><option value="adjustment">Adjustment (+/−)</option><option value="return">Return</option>
              </select>
              <input list="inv-items" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="Item" aria-label="Item" style={{ ...input, flex: "2 1 200px" }} />
              <input value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} inputMode="decimal" placeholder="Qty" aria-label="Quantity" style={{ ...input, width: 90 }} />
              <input value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} inputMode="decimal" placeholder="Cost / unit" aria-label="Cost per unit" style={{ ...input, width: 110 }} />
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} aria-label="Date" style={input} />
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (bill no., reason)" aria-label="Note" style={{ ...input, flex: "1 1 160px" }} />
              <button type="button" onClick={addMove} disabled={busy} style={btn}>Save</button>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: HT.muted }}>
              <button type="button" onClick={bringInSales} disabled={busy} style={{ ...btn, background: "#FFFFFF", color: HT.ink, border: `1px solid ${HT.line}` }}>Take past sales out of stock</button>
              <span>Matches sales-invoice lines to items by name — invoice lines use the item&apos;s exact name.</span>
            </div>
            <h3 style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700 }}>Add an item</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input list="inv-items" value={ni.name} onChange={e => { const v = e.target.value; const it = items.find(i => i.name.trim().toLowerCase() === v.trim().toLowerCase()); setNi(x => it ? { name: it.name, hsn: it.hsn ?? "", unit: it.unit ?? "NOS", qty: String(it.opening_qty || ""), cost: String(it.opening_rate || ""), price: String(it.rate || ""), gst: x.gst } : { ...x, name: v }); }} placeholder="Item name" aria-label="New item name" style={{ ...input, flex: "2 1 200px" }} />
              <input value={ni.hsn} onChange={e => setNi(x => ({ ...x, hsn: e.target.value.replace(/\D/g, "").slice(0, 8) }))} placeholder="HSN" aria-label="HSN" style={{ ...input, width: 90 }} />
              <button type="button" onClick={() => setHsn(h => ({ ...h, open: !h.open, q: h.q || ni.name }))} title="Find the HSN code" style={{ ...btn, background: "#FFFFFF", color: HT.ink, border: `1px solid ${HT.line}`, padding: "0 12px" }}>🔍 HSN</button>
              <input value={ni.unit} onChange={e => setNi(x => ({ ...x, unit: e.target.value.toUpperCase().slice(0, 8) }))} placeholder="Unit" aria-label="Unit" style={{ ...input, width: 70 }} />
              <input value={ni.qty} onChange={e => setNi(x => ({ ...x, qty: e.target.value }))} inputMode="decimal" placeholder="Opening qty" aria-label="Opening quantity" style={{ ...input, width: 100 }} />
              <input value={ni.cost} onChange={e => setNi(x => ({ ...x, cost: e.target.value }))} inputMode="decimal" placeholder="Cost / unit" aria-label="Cost per unit" style={{ ...input, width: 100 }} />
              <input value={ni.price} onChange={e => setNi(x => ({ ...x, price: e.target.value }))} inputMode="decimal" placeholder="Selling price" aria-label="Selling price" style={{ ...input, width: 110 }} />
              <select value={ni.gst} onChange={e => setNi(x => ({ ...x, gst: e.target.value }))} aria-label="GST rate" style={input}>{["0", "5", "12", "18", "28"].map(g => <option key={g} value={g}>{g}% GST</option>)}</select>
              <button type="button" onClick={addItem} disabled={busy} style={btn}>{existing ? "Update item" : "Add item"}</button>
            </div>
            {existing && <div style={{ fontSize: 13, color: HT.muted }}>“{existing.name}” is already added — its details are filled in. Saving updates it.</div>}
            {hsn.open && (
              <div style={{ border: `1px solid ${HT.line}`, borderRadius: 14, padding: 12, display: "grid", gap: 8, background: "#FFFFFF" }}>
                <form onSubmit={e => { e.preventDefault(); void findHsn(); }} style={{ display: "flex", gap: 8 }}>
                  <input autoFocus value={hsn.q} onChange={e => setHsn(h => ({ ...h, q: e.target.value }))} placeholder="Describe the goods (e.g. basmati rice) or type a code" aria-label="HSN search" style={{ ...input, flex: 1 }} />
                  <button type="submit" disabled={hsn.busy} style={btn}>{hsn.busy ? "Searching…" : "Search"}</button>
                </form>
                {hsn.hits.map(h => (
                  <button key={h.hsn + h.description} type="button" onClick={() => { setNi(x => ({ ...x, hsn: h.hsn, gst: h.gst_rate != null && [0, 5, 12, 18, 28].includes(h.gst_rate) ? String(h.gst_rate) : x.gst })); setHsn(x => ({ ...x, open: false })); }}
                    style={{ display: "flex", gap: 12, alignItems: "baseline", textAlign: "left", border: `1px solid ${HT.line}`, borderRadius: 10, background: HT.paper, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", color: HT.ink }}>
                    <b style={{ fontVariantNumeric: "tabular-nums", minWidth: 80 }}>{h.hsn}</b><span style={{ flex: 1 }}>{h.description}</span>{h.gst_rate != null && <span style={{ color: HT.muted }}>{h.gst_rate}% GST</span>}<span style={{ color: "#8A6420", fontWeight: 700 }}>Use</span>
                  </button>
                ))}
                {hsn.source === "suggested" && hsn.hits.length > 0 && <div style={{ fontSize: 12, color: "#8A5A00" }}>Suggested codes — the GST portal search didn't answer. Confirm the code and rate before filing.</div>}
                {hsn.source && !hsn.hits.length && !hsn.busy && <div style={{ fontSize: 13, color: HT.muted }}>No match — try other words.</div>}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: HT.muted, marginTop: 4 }}>
              <b style={{ color: HT.ink }}>Many items?</b>
              <button type="button" onClick={downloadTemplate} style={{ ...btn, background: "#FFFFFF", color: HT.ink, border: `1px solid ${HT.line}` }}>⬇ Stock template</button>
              <label style={{ ...btn, display: "inline-flex", alignItems: "center" }}>⬆ Upload filled template
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void bulkUpload(f); e.target.value = ""; }} />
              </label>
              <span>Items already added are updated, new ones created.</span>
            </div>
          </section>
        )}

        {!setup && (
          <section style={card} aria-labelledby="st-h">
            <div style={{ padding: "16px 20px 8px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 id="st-h" style={{ margin: 0, fontSize: 20, fontWeight: 400, fontStyle: "italic", flex: 1 }}>Stock on hand</h2>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find an item or HSN" aria-label="Find an item" style={{ ...input, width: 220 }} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums", minWidth: 760 }}>
                <thead><tr style={{ color: HT.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                  <th style={{ padding: "8px 20px", textAlign: "left" }}>Item</th><th style={{ padding: 8 }}>Opening</th><th style={{ padding: 8 }}>Opening cost</th><th style={{ padding: 8 }}>Sold</th><th style={{ padding: 8 }}>On hand</th><th style={{ padding: 8 }}>Reorder at</th><th style={{ padding: "8px 20px" }}>Value</th>
                </tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={7} style={{ padding: 20, color: HT.muted, fontStyle: "italic" }}>Reading stock…</td></tr>}
                  {!loading && !rows.length && <tr><td colSpan={7} style={{ padding: 20, color: HT.muted }}>No stock items yet — add goods above (services aren&apos;t tracked).</td></tr>}
                  {rows.map(r => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${HT.line}`, textAlign: "right" }}>
                      <td style={{ padding: "9px 20px", textAlign: "left" }}><b>{r.name}</b>{r.hsn && <span style={{ color: HT.muted }}> · {r.hsn}</span>}
                        {(r.low || r.onHand < 0) && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: r.onHand < 0 ? "#FBE3DE" : "#FBF1DA", color: r.onHand < 0 ? "#B4321F" : "#9A6B22" }}>{r.onHand < 0 ? "Negative" : "Low"}</span>}</td>
                      <td style={{ padding: 6 }}><input defaultValue={r.opening_qty || ""} onBlur={e => { const v = Number(e.target.value) || 0; if (v !== n(r.opening_qty)) void saveItem(r, { opening_qty: v }); }} inputMode="decimal" aria-label={`Opening quantity of ${r.name}`} style={{ ...input, width: 80, textAlign: "right" }} /></td>
                      <td style={{ padding: 6 }}><input defaultValue={r.opening_rate || ""} onBlur={e => { const v = Number(e.target.value) || 0; if (v !== n(r.opening_rate)) void saveItem(r, { opening_rate: v }); }} inputMode="decimal" aria-label={`Opening cost of ${r.name}`} style={{ ...input, width: 90, textAlign: "right" }} /></td>
                      <td style={{ padding: 8 }}>{qtyFmt(r.sold)}</td>
                      <td style={{ padding: 8, fontWeight: 700, color: r.onHand < 0 ? "#B4321F" : HT.ink }}>{qtyFmt(r.onHand)} <span style={{ color: HT.muted, fontWeight: 400 }}>{r.unit ?? ""}</span></td>
                      <td style={{ padding: 6 }}><input defaultValue={r.reorder_level || ""} onBlur={e => { const v = Number(e.target.value) || 0; if (v !== n(r.reorder_level)) void saveItem(r, { reorder_level: v }); }} inputMode="decimal" aria-label={`Reorder level of ${r.name}`} style={{ ...input, width: 80, textAlign: "right" }} /></td>
                      <td style={{ padding: "8px 20px" }}>{inr(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
