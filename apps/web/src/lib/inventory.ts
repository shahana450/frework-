// Inventory engine: stock on hand and its value (FIFO or weighted average), stock by godown / branch / job worker,
// batches and expiry, job-work challans still out, the trading figures that feed the P&L (opening stock, purchases,
// closing stock, cost of goods sold, gross margin), period comparison and fast / slow / dead stock.
// Pure functions: the page reads items and movements once, everything here is worked out from them.

export type InvItem = {
  id: string; name: string; unit?: string | null; hsn?: string | null; category?: string | null;
  opening_qty?: number | null; opening_rate?: number | null; rate?: number | null; reorder_level?: number | null; max_qty?: number | null;
  valuation?: string | null; is_capital_good?: boolean | null; gst_rate?: number | null;
};
export type MoveKind = "purchase" | "sale" | "adjustment" | "return" | "transfer_out" | "transfer_in" | "jobwork_out" | "jobwork_in" | "consume" | "produce" | "scrap";
export type InvMove = {
  id: string; item_id: string; date: string; qty: number; rate: number; kind: MoveKind | string;
  godown_id?: string | null; batch?: string | null; expiry?: string | null; ref_no?: string | null; party?: string | null; transfer_id?: string | null;
  journal_id?: string | null; created_at?: string | null;
};
export type Godown = { id: string; name: string; kind: "godown" | "branch" | "job_worker" | string; gstin?: string | null; state?: string | null; is_default?: boolean | null };

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Moves between your own places (and to a job worker, who holds your stock) don't change what the business owns. */
export const isInternal = (k: string) => k === "transfer_out" || k === "transfer_in" || k === "jobwork_out" || k === "jobwork_in";
/** Stock that left the business for good: sold, used up in production, scrapped. */
const isOutflow = (k: string) => k === "sale" || k === "consume" || k === "scrap";
const sortMoves = (ms: InvMove[]) => [...ms].sort((a, b) => a.date.localeCompare(b.date) || (n(b.qty) > 0 ? 1 : 0) - (n(a.qty) > 0 ? 1 : 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
export const addDays = (iso: string, d: number) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

export type Run = {
  qty: number; value: number; cost: number;       // on hand, its value at cost, cost per unit
  // Totals for the window [from, to] (everything up to `to` when no `from`)
  inQty: number; inValue: number;                 // purchases (net of purchase returns) and production
  soldQty: number; salesValue: number; cogs: number;
  consumedQty: number; consumedValue: number; scrapQty: number; scrapValue: number;
  lastOut: string | null; lastIn: string | null;
};

/**
 * Walks one item's movements in date order and values them (FIFO lots, or a running weighted average).
 * Transfers and job work are left out: the stock is still yours wherever it sits.
 */
export function runItem(item: InvItem, moves: InvMove[], opts: { from?: string; to?: string } = {}): Run {
  const method = item.valuation === "avg" ? "avg" : "fifo";
  const lots: { qty: number; rate: number }[] = [];
  let avgQty = 0, avgVal = 0;
  const open = n(item.opening_qty), openRate = n(item.opening_rate);
  if (open > 0) { lots.push({ qty: open, rate: openRate }); avgQty = open; avgVal = open * openRate; }
  else if (open < 0) { avgQty = open; }
  let lastRate = openRate;
  const out: Run = { qty: 0, value: 0, cost: 0, inQty: 0, inValue: 0, soldQty: 0, salesValue: 0, cogs: 0, consumedQty: 0, consumedValue: 0, scrapQty: 0, scrapValue: 0, lastOut: null, lastIn: null };
  const curCost = () => method === "avg" ? (avgQty > 0 ? avgVal / avgQty : lastRate) : (lots.length ? lots[0].rate : lastRate);
  const take = (q: number): number => {   // cost of q units leaving
    let cost = 0;
    if (method === "avg") { const c = avgQty > 0 ? avgVal / avgQty : lastRate; cost = q * c; avgQty -= q; avgVal -= cost; if (avgQty <= 1e-9) avgVal = 0; return cost; }
    let left = q;
    while (left > 1e-9 && lots.length) { const l = lots[0]; const t = Math.min(l.qty, left); cost += t * l.rate; l.qty -= t; left -= t; if (l.qty <= 1e-9) lots.shift(); }
    if (left > 1e-9) cost += left * lastRate;   // more went out than was ever in: cost it at the last known rate
    return cost;
  };
  const give = (q: number, rate: number) => { lots.push({ qty: q, rate }); avgQty += q; avgVal += q * rate; if (rate > 0) lastRate = rate; };
  let held = open;
  for (const m of sortMoves(moves.filter(x => x.item_id === item.id))) {
    if (opts.to && m.date > opts.to) break;
    const k = String(m.kind), q = n(m.qty), inWin = !opts.from || m.date >= opts.from;
    if (isInternal(k)) continue;
    if (q > 0) {
      const rate = n(m.rate) > 0 ? n(m.rate) : curCost();
      give(q, rate); held += q;
      if (inWin && (k === "purchase" || k === "produce" || k === "return" || k === "adjustment")) {
        if (k === "purchase" || k === "produce") { out.inQty += q; out.inValue += q * rate; }
        if (k === "return") { out.soldQty -= q; out.salesValue -= q * n(m.rate); }   // sales return: comes back in
      }
      if (k === "purchase" || k === "produce") out.lastIn = m.date;
    } else if (q < 0) {
      const qq = -q, cost = take(qq); held -= qq;
      if (inWin) {
        if (k === "sale") { out.soldQty += qq; out.salesValue += qq * n(m.rate); out.cogs += cost; }
        else if (k === "consume") { out.consumedQty += qq; out.consumedValue += cost; }
        else if (k === "scrap") { out.scrapQty += qq; out.scrapValue += cost; }
        else if (k === "return") { out.inQty -= qq; out.inValue -= cost; }   // purchase return: goes back to the supplier
      }
      if (isOutflow(k)) out.lastOut = m.date;
    }
  }
  out.qty = r3(held);
  const value = method === "avg" ? (avgQty > 0 ? avgVal : 0) : lots.reduce((s, l) => s + l.qty * l.rate, 0);
  out.value = r2(out.qty > 0 ? value : 0);
  out.cost = out.qty > 0 && out.value > 0 ? out.value / out.qty : curCost();
  for (const k of ["inQty", "soldQty", "consumedQty", "scrapQty"] as const) out[k] = r3(out[k]);
  for (const k of ["inValue", "salesValue", "cogs", "consumedValue", "scrapValue"] as const) out[k] = r2(out[k]);
  return out;
}

export type PeriodRow = { item: InvItem; openQty: number; openValue: number; inQty: number; inValue: number; soldQty: number; salesValue: number; cogs: number; consumedValue: number; scrapValue: number; closeQty: number; closeValue: number; margin: number; marginPct: number | null };
/** The trading account for a period, item by item: what the P&L needs (opening stock, purchases, closing stock, COGS). */
export function periodSummary(items: InvItem[], moves: InvMove[], from: string, to: string) {
  const dayBefore = addDays(from, -1);
  const rows: PeriodRow[] = items.map(item => {
    const o = runItem(item, moves, { to: dayBefore });
    const p = runItem(item, moves, { from, to });
    const margin = r2(p.salesValue - p.cogs);
    return { item, openQty: o.qty, openValue: o.value, inQty: p.inQty, inValue: p.inValue, soldQty: p.soldQty, salesValue: p.salesValue, cogs: p.cogs, consumedValue: p.consumedValue, scrapValue: p.scrapValue, closeQty: p.qty, closeValue: p.value, margin, marginPct: p.salesValue > 0 ? Math.round((margin / p.salesValue) * 1000) / 10 : null };
  });
  const sum = (k: keyof PeriodRow) => r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  const t = { openValue: sum("openValue"), inValue: sum("inValue"), salesValue: sum("salesValue"), cogs: sum("cogs"), consumedValue: sum("consumedValue"), scrapValue: sum("scrapValue"), closeValue: sum("closeValue"), margin: sum("margin") };
  // Trading account: opening + purchases − closing = cost of goods (sold, used, scrapped)
  const tradingCogs = r2(t.openValue + t.inValue - t.closeValue);
  return { rows, totals: { ...t, tradingCogs, marginPct: t.salesValue > 0 ? Math.round((t.margin / t.salesValue) * 1000) / 10 : null } };
}

/** Quantity of each item at each place on a date. Opening stock and moves without a place sit at the default godown. */
export function stockByLocation(items: InvItem[], moves: InvMove[], godowns: Godown[], to?: string) {
  const def = godowns.find(g => g.is_default)?.id ?? godowns.find(g => g.kind !== "job_worker")?.id ?? "main";
  const grid = new Map<string, Map<string, number>>();   // item → place → qty
  const add = (item: string, place: string, q: number) => { const m = grid.get(item) ?? new Map(); m.set(place, r3((m.get(place) ?? 0) + q)); grid.set(item, m); };
  for (const i of items) if (n(i.opening_qty)) add(i.id, def, n(i.opening_qty));
  for (const m of moves) { if (to && m.date > to) continue; add(m.item_id, m.godown_id || def, n(m.qty)); }
  return { defaultId: def, grid };
}

export type BatchRow = { item: InvItem; batch: string; expiry: string | null; qty: number; value: number; daysLeft: number | null; status: "expired" | "30" | "60" | "90" | "ok" | "none" };
/** Each batch still in stock, with its expiry and how many days are left. */
export function batches(items: InvItem[], moves: InvMove[], today: string): BatchRow[] {
  const byId = new Map(items.map(i => [i.id, i]));
  const key = new Map<string, { item: InvItem; batch: string; expiry: string | null; qty: number }>();
  for (const m of moves) {
    if (!m.batch && !m.expiry) continue;
    if (isInternal(String(m.kind))) continue;   // a transfer moves a batch, it doesn't change how much of it you own
    const it = byId.get(m.item_id); if (!it) continue;
    const k = `${m.item_id}|${(m.batch ?? "").trim().toUpperCase()}|${m.expiry ?? ""}`;
    const row = key.get(k) ?? { item: it, batch: (m.batch ?? "").trim() || "—", expiry: m.expiry ?? null, qty: 0 };
    row.qty += n(m.qty); key.set(k, row);
  }
  return [...key.values()].filter(b => b.qty > 1e-9).map(b => {
    const cost = runItem(b.item, moves).cost;
    const daysLeft = b.expiry ? daysBetween(today, b.expiry) : null;
    const status: BatchRow["status"] = daysLeft == null ? "none" : daysLeft < 0 ? "expired" : daysLeft <= 30 ? "30" : daysLeft <= 60 ? "60" : daysLeft <= 90 ? "90" : "ok";
    return { ...b, qty: r3(b.qty), value: r2(b.qty * cost), daysLeft, status };
  }).sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999"));
}

export type JobWorkRow = {
  id: string; challan: string; date: string; worker: string; workerGstin: string | null; item: InvItem; sent: number; back: number; scrap: number; pending: number;
  value: number; dueBy: string; daysLeft: number; status: "overdue" | "due_soon" | "open" | "closed";
};
/**
 * Material sent to job workers on a delivery challan, and what came back. Section 143 CGST: inputs must come back
 * within 1 year (capital goods 3 years), or the material is treated as supplied on the day it went out.
 */
export function jobWork(items: InvItem[], moves: InvMove[], godowns: Godown[], today: string): JobWorkRow[] {
  const byId = new Map(items.map(i => [i.id, i])), place = new Map(godowns.map(g => [g.id, g]));
  const rows: JobWorkRow[] = [];
  // Each send is two legs on one challan: out of your godown (qty < 0) and in at the job worker (qty > 0)
  for (const o of moves.filter(m => m.kind === "jobwork_out" && n(m.qty) < 0)) {
    const it = byId.get(o.item_id); if (!it) continue;
    const same = o.transfer_id ? moves.filter(m => m.transfer_id === o.transfer_id && m.item_id === o.item_id) : [];
    const atWorker = same.find(m => m.kind === "jobwork_out" && n(m.qty) > 0);
    const worker = atWorker?.godown_id ? place.get(atWorker.godown_id) : undefined;
    const sent = Math.abs(n(o.qty));
    const back = same.filter(m => m.kind === "jobwork_in" && n(m.qty) > 0).reduce((s, m) => s + n(m.qty), 0);
    const scrap = same.filter(m => m.kind === "scrap").reduce((s, m) => s + Math.abs(n(m.qty)), 0);
    const pending = r3(Math.max(0, sent - back - scrap));
    const dueBy = addDays(o.date, it.is_capital_good ? 365 * 3 : 365);
    const daysLeft = daysBetween(today, dueBy);
    rows.push({ id: o.id, challan: o.ref_no || "—", date: o.date, worker: worker?.name || o.party || "Job worker", workerGstin: worker?.gstin ?? null, item: it,
      sent: r3(sent), back: r3(back), scrap: r3(scrap), pending,
      value: r2(sent * (n(o.rate) || runItem(it, moves, { to: o.date }).cost)), dueBy, daysLeft,
      status: pending <= 1e-9 ? "closed" : daysLeft < 0 ? "overdue" : daysLeft <= 60 ? "due_soon" : "open" });
  }
  return rows.sort((a, b) => (a.status === "closed" ? 1 : 0) - (b.status === "closed" ? 1 : 0) || a.dueBy.localeCompare(b.dueBy));
}

export type MoverRow = { item: InvItem; qty: number; value: number; outQty: number; lastOut: string | null; idleDays: number | null; turnover: number | null; speed: "fast" | "slow" | "dead" | "new" };
/** How fast each item sells over the last `days`: fast, slow, or dead (stock on hand, nothing out). */
export function movers(items: InvItem[], moves: InvMove[], today: string, days = 90): MoverRow[] {
  const from = addDays(today, -days);
  return items.map(item => {
    const all = runItem(item, moves, { to: today }), win = runItem(item, moves, { from, to: today });
    const outQty = r3(win.soldQty + win.consumedQty);
    const idleDays = all.lastOut ? daysBetween(all.lastOut, today) : null;
    const avgStock = (all.qty + runItem(item, moves, { to: from }).qty) / 2;
    const turnover = avgStock > 0 ? Math.round((outQty / avgStock) * 10) / 10 : null;
    const speed: MoverRow["speed"] = all.qty <= 0 && !outQty ? "new" : outQty <= 0 ? (all.qty > 0 ? "dead" : "new") : turnover != null && turnover >= 1 ? "fast" : "slow";
    return { item, qty: all.qty, value: all.value, outQty, lastOut: all.lastOut, idleDays, turnover, speed };
  });
}

export type ReorderRow = { item: InvItem; qty: number; reorderAt: number; orderQty: number };
export function reorderList(items: InvItem[], moves: InvMove[], today: string): ReorderRow[] {
  return items.filter(i => n(i.reorder_level) > 0).map(item => {
    const q = runItem(item, moves, { to: today }).qty, at = n(item.reorder_level);
    const target = n(item.max_qty) > at ? n(item.max_qty) : at * 2;
    return { item, qty: q, reorderAt: at, orderQty: r3(Math.max(0, target - q)) };
  }).filter(r => r.qty <= r.reorderAt);
}
