"use client";
import { cur, activeMoney } from "@/lib/money";
// Upload last year's trial balance → AI lists every ledger → review → one opening entry on day 1 of the year.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LEDGER_HEADS } from "@/lib/ledgerHeads";
import { planOpening, isPL } from "@/lib/openingTb";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Row = { ledger: string; head: string; debit: number; credit: number; existing?: boolean };
type Fy = { id: string; label: string; start_date: string; end_date: string; is_current: boolean; is_locked: boolean };
type Posted = { id: string; entry_no: string; date: string; total: number; fy_id: string };
type Led = { id: string; name: string; type: string; sub_type: string | null; head: string; dr: number; cr: number };

const C = { ground: "#F3ECDD", tile: "#FFFFFF", grey: "#F3ECDD", line: "#E6DFD0", ink: "#10241F", muted: "#6B7570", navy: "#12352D", orange: "#C2410C", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#B4321F", negSoft: "#FDECEA", warn: "#9A6B22", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (n: number) => cur() + Number(n || 0).toLocaleString(activeMoney().locale, { maximumFractionDigits: 2 });
const cell: React.CSSProperties = { height: 34, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 8px", fontSize: 13, color: C.ink, background: C.tile, width: "100%", boxSizing: "border-box" };

export default function OpeningBalancesPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [fys, setFys] = useState<Fy[]>([]);
  const [posted, setPosted] = useState<Posted[]>([]);
  const [fyId, setFyId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [stock, setStock] = useState(0);
  const [retained, setRetained] = useState("Capital Account");
  const [retainedHead, setRetainedHead] = useState("capital");
  const [diffTo, setDiffTo] = useState("");
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState<"" | "read" | "post">("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  // Every ledger with its opening balance — edited here and saved as a revised opening entry
  const [leds, setLeds] = useState<Led[]>([]);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [onlyNonZero, setOnlyNonZero] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadLeds = useCallback(async (b: string, f: string) => {
    if (!b || !f) return;
    const r = await fetch(`/api/finance/opening-balances?business_id=${b}&fy_id=${f}&view=ledgers`);
    const d = await r.json().catch(() => ({}));
    const ls = (d.ledgers ?? []) as Led[];
    setLeds(ls); setOrig(Object.fromEntries(ls.map(l => [l.id, `${l.dr}|${l.cr}`])));
  }, []);
  useEffect(() => { loadLeds(bizId, fyId); }, [bizId, fyId, loadLeds]);

  const load = useCallback(async (b: string) => {
    const r = await fetch(`/api/finance/opening-balances?business_id=${b}`);
    const d = await r.json().catch(() => ({}));
    setFys(d.fys ?? []); setPosted(d.posted ?? []);
    setFyId(f => f || (d.fys ?? []).find((x: Fy) => x.is_current)?.id || d.fys?.[0]?.id || "");
    if (/company|pvt|ltd|llp/i.test(d.entity ?? "")) { setRetained("Profit & Loss A/c (Reserves & Surplus)"); }
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const b = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!b) { router.push("/finance/setup"); return; }
      setBizId(b); load(b);
    });
  }, [router, load]);

  const plan = useMemo(() => planOpening(rows.map(r => ({ ...r, head: r.head })), { retained, retainedHead, closingStock: stock, differenceTo: diffTo.trim() || null }), [rows, retained, retainedHead, stock, diffTo]);
  const raw = useMemo(() => ({ dr: rows.reduce((s, r) => s + (+r.debit || 0), 0), cr: rows.reduce((s, r) => s + (+r.credit || 0), 0) }), [rows]);
  const fy = fys.find(f => f.id === fyId);
  const already = posted.find(p => p.fy_id === fyId);
  const noHead = rows.filter(r => r.ledger.trim() && !r.head).length;

  const read = async (f: File) => {
    setBusy("read"); setMsg(null); setFile(f.name);
    const fd = new FormData(); fd.append("business_id", bizId); fd.append("file", f);
    const r = await fetch("/api/finance/opening-balances", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setMsg({ ok: false, t: d.error ?? "Couldn't read that file." }); return; }
    setRows(d.rows ?? []); setStock(d.closing_stock ?? 0);
    setMsg({ ok: true, t: `Read ${d.rows?.length ?? 0} ledgers${d.as_on ? ` as on ${d.as_on}` : ""}. Check the groups and amounts, then post.` });
  };
  const postIt = async () => {
    if (!window.confirm(`Post opening balances for FY ${fy?.label} dated ${fy?.start_date}? Total ${inr(plan.totalDr + (plan.difference < 0 ? -plan.difference : 0))}.`)) return;
    setBusy("post"); setMsg(null);
    const r = await fetch("/api/finance/opening-balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, fy_id: fyId, rows, retained, retained_head: retainedHead, closing_stock: stock, difference_to: diffTo.trim() || null }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setMsg({ ok: false, t: d.error ?? "Couldn't post." }); return; }
    setMsg({ ok: true, t: `Posted as ${d.entry_no}${d.created?.length ? ` · ${d.created.length} new ledgers created` : ""}. Your ledgers now open with last year's closing balances.` });
    setRows([]); load(bizId);
  };
  const ledTot = useMemo(() => ({ dr: leds.reduce((s, l) => s + (l.dr || 0), 0), cr: leds.reduce((s, l) => s + (l.cr || 0), 0) }), [leds]);
  const ledDiff = Math.round((ledTot.dr - ledTot.cr) * 100) / 100;
  const changed = leds.filter(l => orig[l.id] !== `${l.dr}|${l.cr}`).length;
  const setLed = (id: string, side: "dr" | "cr", v: number) => setLeds(ls => ls.map(l => l.id !== id ? l : side === "dr" ? { ...l, dr: v, cr: v > 0 ? 0 : l.cr } : { ...l, cr: v, dr: v > 0 ? 0 : l.dr }));
  const headLabel = (k: string) => LEDGER_HEADS.find(h => h.key === k)?.label ?? k;
  const shown = leds.filter(l => (!onlyNonZero || l.dr || l.cr) && (!q.trim() || `${l.name} ${headLabel(l.head)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const saveLeds = async () => {
    if (!window.confirm(already ? `Save the changed opening balances? ${already.entry_no} will be reversed and a revised opening entry posted on ${fy?.start_date}.` : `Post these opening balances on ${fy?.start_date}?`)) return;
    setSaving(true); setMsg(null);
    const r = await fetch("/api/finance/opening-balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, fy_id: fyId, mode: "edit", lines: leds.filter(l => l.dr || l.cr).map(l => ({ account_id: l.id, dr: l.dr, cr: l.cr })) }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg({ ok: false, t: d.error ?? "Couldn't save." }); return; }
    setMsg({ ok: true, t: d.entry_no ? `Saved as ${d.entry_no}${d.replaced ? ` (replaces ${d.replaced}, which was reversed)` : ""}.` : `Opening balances cleared${d.replaced ? ` — ${d.replaced} was reversed` : ""}.` });
    load(bizId); loadLeds(bizId, fyId);
  };
  const set = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, k) => k === i ? { ...r, ...patch } : r));

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 120px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Opening Balances</h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 15, lineHeight: 1.55, maxWidth: 700 }}>Already running a business? Upload last year&apos;s closing <b>trial balance</b> (PDF, Excel or photo). FreBook reads every ledger, carries the balance-sheet balances forward, moves last year&apos;s profit or loss into Capital / Reserves, and posts one opening entry on the first day of the year.</p>
        </div>

        <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Opening balances for
            <select value={fyId} onChange={e => setFyId(e.target.value)} style={{ ...cell, height: 42, width: 230, fontSize: 14 }}>
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.label.replace(/^FY\s*/i, "")} — opens {f.start_date}</option>)}
            </select>
          </label>
          <label style={{ height: 42, padding: "0 18px", borderRadius: 11, background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", cursor: busy ? "wait" : "pointer", opacity: busy || already ? 0.6 : 1 }}>
            {busy === "read" ? "Reading trial balance…" : "Upload trial balance"}
            <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" disabled={!!busy || !!already} onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} style={{ display: "none" }} />
          </label>
          <button onClick={() => setRows(r => [...r, { ledger: "", head: "", debit: 0, credit: 0 }])} disabled={!!already} style={{ height: 42, padding: "0 16px", borderRadius: 11, border: "1px solid #D9CDB4", background: C.tile, color: C.ink, fontWeight: 700, cursor: "pointer" }}>＋ Type rows instead</button>
          {file && <span style={{ fontSize: 13, color: C.muted }}>{file}</span>}
          {already && <div style={{ width: "100%", background: C.posSoft, color: C.pos, borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 14 }}>✓ Opening balances for FY {fy?.label} are posted as <Link href={`/finance/journals?id=${already.id}`} style={{ color: C.pos }}>{already.entry_no}</Link> ({inr(already.total)}). Change any ledger&apos;s balance in the list below and press Save.</div>}
        </section>

        {msg && <div role="status" style={{ background: msg.ok ? C.posSoft : C.negSoft, color: msg.ok ? C.pos : C.neg, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{msg.t}</div>}

        {rows.length === 0 && fyId && (
          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ flex: "1 1 260px" }}>
                <h2 style={{ margin: 0, fontSize: 21 }}>Ledgers &amp; opening balances</h2>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{leds.length} ledgers · as on {fy?.start_date ?? "—"} · type a figure in Debit or Credit</div>
              </div>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ledger or group…" aria-label="Search ledgers" style={{ ...cell, width: 240, height: 38, borderRadius: 999, padding: "0 14px" }} />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, cursor: "pointer" }}><input type="checkbox" checked={onlyNonZero} onChange={e => setOnlyNonZero(e.target.checked)} style={{ accentColor: C.navy }} /> Only with a balance</label>
            </div>
            <div style={{ overflow: "auto", maxHeight: "60vh" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680, fontSize: 13.5 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#FBF7EE", zIndex: 1, color: "#9A7A2E", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  <th style={{ textAlign: "left", padding: "10px 20px" }}>Ledger</th><th style={{ textAlign: "left", padding: 10, width: 220 }}>Group</th>
                  <th style={{ textAlign: "right", padding: 10, width: 160 }}>Debit</th><th style={{ textAlign: "right", padding: "10px 20px 10px 10px", width: 160 }}>Credit</th>
                </tr></thead>
                <tbody>
                  {shown.map(l => {
                    const edited = orig[l.id] !== `${l.dr}|${l.cr}`;
                    return (
                      <tr key={l.id} style={{ borderTop: `1px solid ${C.line}`, background: edited ? "#FFF8E6" : undefined }}>
                        <td style={{ padding: "6px 20px", fontWeight: l.dr || l.cr ? 600 : 400 }}>{l.name}{edited && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: C.warn }}>edited</span>}</td>
                        <td style={{ padding: "6px 10px", color: C.muted, fontSize: 12.5 }}>{headLabel(l.head)}</td>
                        {(["dr", "cr"] as const).map(side => (
                          <td key={side} style={{ padding: side === "cr" ? "4px 20px 4px 10px" : "4px 10px" }}>
                            <input key={`${l.id}-${side}-${l[side]}`} aria-label={`${side === "dr" ? "Debit" : "Credit"} opening balance of ${l.name}`} inputMode="decimal" defaultValue={l[side] ? String(l[side]) : ""} placeholder="—"
                              onBlur={e => { const v = Math.round((parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0) * 100) / 100; if (v !== l[side]) setLed(l.id, side, v); }}
                              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              style={{ ...cell, textAlign: "right", fontFamily: MONO, background: l[side] ? "#FFFFFF" : "#FBF9F4" }} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {!shown.length && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: C.muted }}>{leds.length ? "No ledger matches." : "Loading ledgers…"}</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "14px 20px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderTop: `2px solid ${C.ink}`, background: "#FBF7EE", position: "sticky", bottom: 0 }}>
              <b style={{ fontFamily: MONO }}>Dr {inr(ledTot.dr)} · Cr {inr(ledTot.cr)}</b>
              {Math.abs(ledDiff) >= 0.01 ? <span style={{ fontSize: 13, fontWeight: 700, color: C.neg }}>Out by {inr(Math.abs(ledDiff))} — debits and credits must agree</span> : <span style={{ fontSize: 13, fontWeight: 700, color: C.pos }}>Balanced ✓</span>}
              {changed > 0 && <span style={{ fontSize: 12.5, color: C.warn, fontWeight: 700 }}>{changed} changed</span>}
              <span style={{ flex: 1 }} />
              {changed > 0 && <button onClick={() => loadLeds(bizId, fyId)} disabled={saving} style={{ height: 42, padding: "0 16px", borderRadius: 999, border: "1px solid #D9CDB4", background: C.tile, color: C.ink, fontWeight: 700, cursor: "pointer" }}>Undo changes</button>}
              <button onClick={saveLeds} disabled={saving || !changed || Math.abs(ledDiff) >= 0.01} style={{ height: 44, padding: "0 22px", borderRadius: 999, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: "pointer", opacity: saving || !changed || Math.abs(ledDiff) >= 0.01 ? 0.5 : 1 }}>{saving ? "Saving…" : already ? "Save opening balances" : "Post opening balances"}</button>
            </div>
            <div style={{ padding: "0 20px 14px", fontSize: 12, color: C.muted, background: "#FBF7EE" }}>Saving reverses the current opening entry and posts a revised one dated {fy?.start_date ?? "the first day of the year"} — the old entry stays in the Journal for the audit trail.</div>
          </section>
        )}

        {rows.length > 0 && (<>
          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>Last year&apos;s trial balance</h2>
              <span style={{ fontSize: 13, color: C.muted }}>{rows.length} ledgers · Dr {inr(raw.dr)} · Cr {inr(raw.cr)}</span>
              {Math.abs(raw.dr - raw.cr) >= 0.01 && <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: C.negSoft, color: C.neg }}>Differs by {inr(Math.abs(raw.dr - raw.cr))}</span>}
              {noHead > 0 && <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: C.warnSoft, color: C.warn }}>{noHead} need a group</span>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 13 }}>
                <thead><tr style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <th style={{ textAlign: "left", padding: 6 }}>Ledger</th><th style={{ textAlign: "left", padding: 6, width: 240 }}>Group</th><th style={{ textAlign: "right", padding: 6, width: 140 }}>Debit</th><th style={{ textAlign: "right", padding: 6, width: 140 }}>Credit</th><th style={{ width: 110 }} /><th style={{ width: 30 }} />
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: 4 }}><input aria-label="Ledger" value={r.ledger} onChange={e => set(i, { ledger: e.target.value, existing: false })} style={cell} /></td>
                      <td style={{ padding: 4 }}>
                        <select aria-label="Group" value={r.head} onChange={e => set(i, { head: e.target.value })} style={{ ...cell, borderColor: r.head ? C.line : C.warn, background: r.head ? C.tile : C.warnSoft }}>
                          <option value="">Choose group…</option>
                          {LEDGER_HEADS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 4 }}><input aria-label="Debit" inputMode="decimal" value={r.debit || ""} onChange={e => set(i, { debit: +e.target.value.replace(/[^\d.]/g, "") || 0 })} style={{ ...cell, textAlign: "right", fontFamily: MONO }} /></td>
                      <td style={{ padding: 4 }}><input aria-label="Credit" inputMode="decimal" value={r.credit || ""} onChange={e => set(i, { credit: +e.target.value.replace(/[^\d.]/g, "") || 0 })} style={{ ...cell, textAlign: "right", fontFamily: MONO }} /></td>
                      <td style={{ padding: 4, fontSize: 11.5, color: C.muted }}>{r.head && isPL(r.head, r.ledger) ? <span title="Income/expense balances don't carry forward — their net goes to the profit ledger">→ to profit</span> : r.existing ? "existing ledger" : r.ledger ? "new ledger" : ""}</td>
                      <td><button aria-label={`Remove ${r.ledger}`} onClick={() => setRows(rs => rs.filter((_, k) => k !== i))} style={{ border: "none", background: "none", color: C.neg, cursor: "pointer", fontSize: 16 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Last year&apos;s profit / loss goes to
              <input value={retained} onChange={e => setRetained(e.target.value)} style={{ ...cell, height: 40 }} />
              <select value={retainedHead} onChange={e => setRetainedHead(e.target.value)} style={{ ...cell, height: 36 }}>
                <option value="capital">Capital Account (owner / partners / reserves)</option>
                <option value="current_liability">Current Liabilities</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Closing stock (from last year&apos;s accounts)
              <input inputMode="decimal" value={stock || ""} onChange={e => setStock(+e.target.value.replace(/[^\d.]/g, "") || 0)} placeholder="0" style={{ ...cell, height: 40, fontFamily: MONO }} />
              <span style={{ fontWeight: 400 }}>Becomes the Stock-in-Trade opening balance.</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>If Dr ≠ Cr, put the difference in (optional)
              <input value={diffTo} onChange={e => setDiffTo(e.target.value)} placeholder="e.g. Opening Difference (Suspense)" style={{ ...cell, height: 40 }} />
              <span style={{ fontWeight: 400 }}>Better: fix the rows so it balances.</span>
            </label>
          </section>

          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>Opening entry · {fy?.start_date ?? "—"}</h2>
              <span style={{ fontSize: 13, color: C.muted }}>{plan.lines.length} lines · last year&apos;s {plan.profit >= 0 ? "profit" : "loss"} {inr(Math.abs(plan.profit))} → {retained}</span>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 360 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <tbody>{plan.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}><td style={{ padding: "5px 4px" }}>{l.ledger}</td><td style={{ textAlign: "right", fontFamily: MONO }}>{l.dr ? inr(l.dr) : ""}</td><td style={{ textAlign: "right", fontFamily: MONO }}>{l.cr ? inr(l.cr) : ""}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: `2px solid ${C.ink}`, paddingTop: 10 }}>
              <b style={{ fontFamily: MONO }}>Dr {inr(plan.totalDr + (diffTo.trim() && plan.difference < 0 ? -plan.difference : 0))} · Cr {inr(plan.totalCr + (diffTo.trim() && plan.difference > 0 ? plan.difference : 0))}</b>
              {plan.difference !== 0 && !diffTo.trim() ? <span style={{ fontSize: 13, fontWeight: 700, color: C.neg }}>Out by {inr(Math.abs(plan.difference))} — fix the rows or choose a ledger for the difference.</span> : <span style={{ fontSize: 13, fontWeight: 700, color: C.pos }}>Balanced ✓</span>}
              <span style={{ flex: 1 }} />
              <button onClick={postIt} disabled={!!busy || !!already || noHead > 0 || !fyId || (plan.difference !== 0 && !diffTo.trim())} style={{ height: 44, padding: "0 22px", borderRadius: 12, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: "pointer", opacity: busy || already || noHead > 0 || (plan.difference !== 0 && !diffTo.trim()) ? 0.5 : 1 }}>{busy === "post" ? "Posting…" : "Post opening balances"}</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>Customer and supplier balances post to their ledgers — use Customers &amp; Suppliers for bill-wise detail. Posted once per year; to change it, reverse the entry and post again.</div>
          </section>
        </>)}
      </div>
    </div>
  );
}
