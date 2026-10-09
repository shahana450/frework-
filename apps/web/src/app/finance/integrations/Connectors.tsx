"use client";
// Connect panel for each cloud connector and the review list of fetched items waiting to be posted.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Conn = { provider: string; status: string; account_label: string | null; last_sync_at: string | null; last_error: string | null };
type Line = { ledger: string; head: string; dr: number; cr: number };
type Item = { id: string; provider: string; external_id: string; kind: string; date: string; description: string; party: string | null; amount: number; currency: string | null; lines: Line[]; status: string; journal_id: string | null };
export type ConnData = { connections: Conn[]; items: Item[]; oauth_ready?: { zoho_books: boolean; quickbooks: boolean }; key_ready?: boolean; bank_feed_demo?: boolean; setup_needed?: string };

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E3E6EE", navy: "#232A63", grey: "#ECEEF3", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const NAME: Record<string, string> = { razorpay: "Razorpay", shopify: "Shopify", zoho_books: "Zoho Books", quickbooks: "QuickBooks", bank_feed: "Bank feed" };
const inp: React.CSSProperties = { height: 38, borderRadius: 9, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 13.5, color: C.ink, minWidth: 0, flex: 1 };
const btn = (primary: boolean, busy = false): React.CSSProperties => ({ height: 38, padding: "0 14px", borderRadius: 9, border: primary ? "none" : "1px solid #C9CEDF", background: primary ? C.navy : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 13, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" });

export function useConnectors(bizId: string) {
  const [data, setData] = useState<ConnData | null>(null);
  const load = useCallback(async () => {
    if (!bizId) return;
    const r = await fetch(`/api/finance/connectors?business_id=${bizId}`);
    setData(await r.json().catch(() => ({ connections: [], items: [], setup_needed: "Couldn't load connections." })));
  }, [bizId]);
  useEffect(() => { load(); }, [load]);
  const call = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/finance/connectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...payload }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d };
  }, [bizId]);
  return { data, load, call };
}

export function ConnectPanel({ provider, data, call, reload }: { provider: string; data: ConnData; call: (p: Record<string, unknown>) => Promise<{ ok: boolean; d: any }>; reload: () => void }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const conn = data.connections.find(c => c.provider === provider);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const waiting = data.items.filter(i => i.provider === provider && i.status === "new").length;
  const run = async (payload: Record<string, unknown>, ok: (d: any) => string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setBusy(true); setMsg(null);
    const r = await call({ provider, ...payload });
    setBusy(false);
    if (r.d.url) { window.location.href = r.d.url; return; }
    setMsg(r.ok ? { ok: true, t: ok(r.d) } : { ok: false, t: r.d.error ?? "Something went wrong." });
    if (r.ok) { setF({}); reload(); }
  };
  if (data.setup_needed) return <div style={{ fontSize: 12.5, color: C.warn }}>{data.setup_needed}</div>;
  const oauth = provider === "zoho_books" || provider === "quickbooks";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 4 }}>
      {conn ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: C.muted }}>
          <span style={{ fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: conn.status === "connected" ? C.posSoft : C.negSoft, color: conn.status === "connected" ? C.pos : C.neg }}>{conn.status === "connected" ? "Connected" : conn.status === "expired" ? "Reconnect needed" : "Error"}</span>
          <span style={{ color: C.ink, fontWeight: 600 }}>{conn.account_label}</span>
          {conn.last_sync_at && <span>· fetched {new Date(conn.last_sync_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
          {waiting > 0 && <a href="#review" style={{ color: C.navy, fontWeight: 800 }}>· {waiting} to review</a>}
          <span style={{ flex: 1 }} />
          <button disabled={busy} onClick={() => run({ action: "sync", days: 30 }, d => `Fetched ${d.fetched} item${d.fetched === 1 ? "" : "s"} from the last 30 days.`)} style={btn(true, busy)}>{busy ? "Fetching…" : "Fetch now"}</button>
          {oauth && conn.status !== "connected" && <button disabled={busy} onClick={() => run({ action: "oauth_start" }, () => "")} style={btn(false, busy)}>Sign in again</button>}
          <button disabled={busy} onClick={() => { if (window.confirm(`Disconnect ${NAME[provider]}? Items not yet posted are removed; posted entries stay in your books.`)) run({ action: "disconnect" }, () => "Disconnected."); }} style={{ ...btn(false, busy), color: C.neg }}>Disconnect</button>
        </div>
      ) : oauth ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {data.oauth_ready?.[provider as "zoho_books" | "quickbooks"]
            ? <button disabled={busy} onClick={() => run({ action: "oauth_start" }, () => "")} style={btn(true, busy)}>Sign in with {provider === "zoho_books" ? "Zoho" : "Intuit"} →</button>
            : <span style={{ fontSize: 12.5, color: C.warn, background: C.warnSoft, padding: "6px 10px", borderRadius: 8 }}>Awaiting FreWork&apos;s {NAME[provider]} app approval — sign-in opens here once it&apos;s live.</span>}
          <span style={{ fontSize: 12, color: C.muted }}>Read-only access. You approve it on {NAME[provider]}&apos;s own sign-in page.</span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {provider === "bank_feed" ? (<>
            {data.bank_feed_demo && <div style={{ width: "100%", fontSize: 12.5, color: C.warn, background: C.warnSoft, padding: "6px 10px", borderRadius: 8 }}>Demo mode — sample bank lines, not from your bank. Real feeds start once FreWork&apos;s Account Aggregator partner is live.</div>}
            <input placeholder="Mobile linked to the bank (10 digits)" inputMode="numeric" value={f.mobile ?? ""} onChange={e => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} style={{ ...inp, fontFamily: MONO }} autoComplete="tel" />
            <input placeholder="Your bank ledger in FreWork" value={f.bank_ledger ?? ""} onChange={e => setF({ ...f, bank_ledger: e.target.value })} style={inp} />
          </>) : provider === "razorpay" ? (<>
            <input placeholder="Key ID (rzp_live_…)" value={f.key_id ?? ""} onChange={e => setF({ ...f, key_id: e.target.value })} style={{ ...inp, fontFamily: MONO }} autoComplete="off" />
            <input placeholder="Key Secret" type="password" value={f.key_secret ?? ""} onChange={e => setF({ ...f, key_secret: e.target.value })} style={inp} autoComplete="new-password" />
          </>) : (<>
            <input placeholder="yourstore.myshopify.com" value={f.shop ?? ""} onChange={e => setF({ ...f, shop: e.target.value })} style={inp} autoComplete="off" />
            <input placeholder="Admin API access token (shpat_…)" type="password" value={f.token ?? ""} onChange={e => setF({ ...f, token: e.target.value })} style={inp} autoComplete="new-password" />
          </>)}
          <button disabled={busy || !Object.values(f).filter(Boolean).length} onClick={() => run({ action: "connect", creds: f, days: 30 }, d => `Connected to ${d.label}. Fetched ${d.fetched} item${d.fetched === 1 ? "" : "s"} — review them below.`)} style={btn(true, busy)}>{busy ? "Checking…" : "Connect"}</button>
          <div style={{ width: "100%", fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            {provider === "bank_feed" ? "You approve access in your Account Aggregator app (OneMoney, Finvu, Anumati …) — read-only, for 12 months, revocable any time there. FreWork never sees your net-banking password." : provider === "razorpay" ? "Razorpay Dashboard → Account & Settings → API Keys. Keys are encrypted; FreWork only reads payments, refunds and settlements." : "Shopify admin → Settings → Apps → Develop apps → create an app with read_orders → install → copy the Admin API access token. Stored encrypted."}
          </div>
        </div>
      )}
      {conn?.last_error && !msg && <div style={{ fontSize: 12.5, color: C.neg }}>{conn.last_error}</div>}
      {msg && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? C.pos : C.neg }}>{msg.t}</div>}
    </div>
  );
}

export function ReviewList({ data, call, reload }: { data: ConnData; call: (p: Record<string, unknown>) => Promise<{ ok: boolean; d: any }>; reload: () => void }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [tab, setTab] = useState<"new" | "posted" | "ignored">("new");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string[]>>({});
  const saveEdit = async (id: string) => { setBusy(true); const r = await call({ action: "edit", ids: [id], lines: edit[id].map(ledger => ({ ledger })) }); setBusy(false); if (!r.ok) { setMsg({ ok: false, t: r.d.error ?? "Couldn't save." }); return; } setEdit(e => { const n = { ...e }; delete n[id]; return n; }); reload(); };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const items = data.items.filter(i => i.status === tab);
  if (!data.items.length) return null;
  const act = async (action: "post" | "ignore") => {
    setBusy(true); setMsg(null);
    const r = await call({ action, ids: [...sel] });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.d.error ?? "Couldn't do that." }); return; }
    setMsg({ ok: !r.d.failed?.length, t: action === "ignore" ? `${sel.size} ignored.` : `Posted ${r.d.posted} entr${r.d.posted === 1 ? "y" : "ies"}${r.d.created?.length ? ` · created ledgers: ${r.d.created.map((c: { name: string }) => c.name).join(", ")}` : ""}${r.d.failed?.length ? ` · ${r.d.failed.length} failed: ${r.d.failed[0].error}` : ""}` });
    setSel(new Set()); reload();
  };
  const fmt = (n: number, cur: string | null) => (cur && cur !== "INR" ? cur + " " : "₹") + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <section id="review" style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 14, padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: "1rem" }}>Fetched items</strong>
        {(["new", "posted", "ignored"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSel(new Set()); }} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "none", background: tab === t ? C.navy : C.grey, color: tab === t ? "#FFFFFF" : C.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {t === "new" ? "To review" : t === "posted" ? "Posted" : "Ignored"} ({data.items.filter(i => i.status === t).length})
          </button>
        ))}
        {tab === "new" && items.length > 0 && <>
          <span style={{ flex: 1 }} />
          <button onClick={() => setSel(sel.size === items.length ? new Set() : new Set(items.map(i => i.id)))} style={btn(false)}>{sel.size === items.length ? "Clear" : "Select all"}</button>
          <button disabled={busy || !sel.size} onClick={() => act("ignore")} style={btn(false, busy)}>Ignore</button>
          <button disabled={busy || !sel.size} onClick={() => act("post")} style={btn(true, busy)}>{busy ? "Posting…" : `Post ${sel.size || ""} to books`}</button>
        </>}
      </div>
      {tab === "new" && <div style={{ fontSize: 12, color: C.muted }}>Nothing reaches your books until you post it. Each item can be posted only once. Missing ledgers (e.g. Razorpay Clearing, Payment Gateway Charges) are created under the right group.</div>}
      {msg && <div role="status" style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? C.pos : C.neg }}>{msg.t}</div>}
      {items.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>Nothing here.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.slice(0, 200).map(i => (
            <div key={i.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                {tab === "new" && <input type="checkbox" aria-label={`Select ${i.description}`} checked={sel.has(i.id)} onChange={() => { const s = new Set(sel); if (s.has(i.id)) s.delete(i.id); else s.add(i.id); setSel(s); }} />}
                <span style={{ fontFamily: MONO, color: C.muted, width: 84, flexShrink: 0 }}>{i.date}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: C.grey, color: C.navy, flexShrink: 0 }}>{NAME[i.provider]} · {i.kind}</span>
                <button onClick={() => setOpen(open === i.id ? null : i.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "none", cursor: "pointer", color: C.ink, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: 0 }} title="Show the entry">{i.description}</button>
                <span style={{ fontFamily: MONO, fontWeight: 600 }}>{fmt(i.amount, i.currency)}</span>
                {i.journal_id && <Link href={`/finance/journals?id=${i.journal_id}`} style={{ fontSize: 12, color: C.navy, fontWeight: 700 }}>Entry →</Link>}
              </div>
              {open === i.id && (
                <table style={{ marginTop: 8, width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead><tr style={{ color: C.muted }}><th style={{ textAlign: "left", fontWeight: 700 }}>Ledger</th><th style={{ textAlign: "right", fontWeight: 700 }}>Debit</th><th style={{ textAlign: "right", fontWeight: 700 }}>Credit</th></tr></thead>
                  <tbody>{i.lines.map((l, k) => <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}><td style={{ padding: "4px 0" }}>{edit[i.id] ? <input aria-label="Ledger" value={edit[i.id][k]} onChange={e => setEdit(s => ({ ...s, [i.id]: s[i.id].map((v, x) => x === k ? e.target.value : v) }))} style={{ ...inp, height: 30, width: "100%" }} /> : l.ledger}</td><td style={{ textAlign: "right", fontFamily: MONO }}>{l.dr ? l.dr.toLocaleString("en-IN") : ""}</td><td style={{ textAlign: "right", fontFamily: MONO }}>{l.cr ? l.cr.toLocaleString("en-IN") : ""}</td></tr>)}</tbody>
                </table>
              )}
              {open === i.id && i.status === "new" && (edit[i.id]
                ? <div style={{ display: "flex", gap: 6, marginTop: 6 }}><button disabled={busy} onClick={() => saveEdit(i.id)} style={btn(true, busy)}>Save ledgers</button><button onClick={() => setEdit(e => { const n = { ...e }; delete n[i.id]; return n; })} style={btn(false)}>Cancel</button></div>
                : <button onClick={() => setEdit(e => ({ ...e, [i.id]: i.lines.map(l => l.ledger) }))} style={{ marginTop: 6, border: "none", background: "none", color: C.navy, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Change ledgers</button>)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
