"use client";
import { cur, activeMoney } from "@/lib/money";
// Bulk review for the Excel entry template: every row is drafted by the same rules as chat,
// shown in one table, and the ticked rows are posted together. Each row posts at most once.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ParsedTransaction } from "@/lib/intentEngine";
import { LEDGER_HEADS } from "@/lib/ledgerHeads";
import GroupChips, { guessGroup } from "@/components/GroupChips";
import { useAutoDraft } from "@/lib/importDraft";
import { mergeSameLedgerLines } from "@/lib/frebook/mergeLines";

type RowState = "reading" | "ready" | "question" | "error" | "posting" | "posted" | "failed";
type BRow = {
  i: number; text: string; state: RowState; tx?: ParsedTransaction; question?: string; error?: string;
  entryNo?: string; duplicate?: string | null; issues?: string[]; locked?: boolean;
};

const C = { bg: "#F4EFE4", line: "#E6DCC6", strong: "#D9CBAA", ink: "#10241F", muted: "#5E6B66", primary: "#12352D", soft: "#E4ECE8", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB", purple: "#5B4BC4" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const fmt = (n: number) => (n ?? 0).toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MAX_ROWS = 200;

export type BulkDraft = { fileName: string; fileKey: string; sentences: string[]; rows: BRow[] };

export default function BulkTemplateModal({ fileName, fileKey, sentences, bizId, userId, onClose, onPosted, onSendToChat, initialRows }: {
  fileName: string; fileKey: string; sentences: string[]; bizId: string; userId: string;
  onClose: () => void; onPosted: (count: number, total: number, journals?: { id: string; date: string; entryNo: string }[]) => void; onSendToChat: (sentences: string[]) => void;
  initialRows?: BRow[];   // resuming: rows as they were left; only rows still unread are read again
}) {
  const [rows, setRows] = useState<BRow[]>(() => initialRows
    ? initialRows.map(r => ({ ...(r.state === "posting" ? { ...r, state: "ready" as const } : r), ...(r.tx && r.state !== "posted" ? { tx: { ...r.tx, lines: mergeSameLedgerLines(r.tx.lines) } } : {}) }))   // the server's per-row key stops a double post
    : sentences.slice(0, MAX_ROWS).map((text, i) => ({ i, text, state: "reading" })));
  useAutoDraft<BulkDraft>("bulk-template", bizId, true, () => {
    const pending = rows.filter(r => r.state !== "posted").length;
    return { title: `${fileName} · ${rows.length} template rows`, pending, posted: rows.length - pending, data: { fileName, fileKey, sentences, rows } };
  }, [rows]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [posting, setPosting] = useState(false);
  // B14 — flagged entries need a second, deliberate click (no browser pop-up)
  const [confirmFlagged, setConfirmFlagged] = useState(0);
  const [heads, setHeads] = useState<Record<string, string>>({});
  const [needHeads, setNeedHeads] = useState<{ account: string; suggested: string }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const started = useRef(false);

  const patch = (i: number, p: Partial<BRow>) => setRows(prev => prev.map(r => r.i === i ? { ...r, ...p } : r));

  // Draft every row (4 at a time) with the same AI + rules as the chat, then run the compliance checks
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Resumed: only the rows that were never read; fresh: every row
    const todo = initialRows ? initialRows.filter(r => r.state === "reading").map(r => r.i) : sentences.slice(0, MAX_ROWS).map((_, i) => i);
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const i = todo[cursor++];
        try {
          const res = await fetch("/api/finance/chat-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: sentences[i], business_id: bizId, user_id: userId, bulk: true, history: [] }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { patch(i, { state: "error", error: d.error ?? "Couldn't read this row." }); continue; }
          if (d.answer) { patch(i, { state: "error", error: "This row reads like a question, not a transaction." }); continue; }
          const raw = d.parsed as ParsedTransaction;
          const tx = { ...raw, lines: mergeSameLedgerLines(raw.lines) };
          if (tx.status !== "complete") { patch(i, { state: "question", tx, question: tx.needs_clarification?.[0] ?? "More detail needed." }); continue; }
          const dup = d.duplicate ? `${d.duplicate.entry_no} · ${d.duplicate.date}` : null;
          let issues: string[] = [];
          try {
            const c = await fetch("/api/finance/chat-book/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, date: tx.transaction_date, lines: tx.lines.map(l => ({ account: l.account, debit: l.debit || 0, credit: l.credit || 0 })) }) }).then(r => r.ok ? r.json() : null);
            issues = (c?.checks ?? []).filter((x: { tone: string }) => x.tone === "bad").map((x: { title: string }) => x.title);
          } catch { /* checks are advisory */ }
          patch(i, { state: "ready", tx, duplicate: dup, issues, locked: !!d.fy_locked });
          // Clean rows are ticked for posting; rows with a duplicate, a compliance problem or a locked year are left for review
          if (!dup && !issues.length && !d.fy_locked) setSelected(s => new Set(s).add(i));
        } catch { patch(i, { state: "error", error: "Network error." }); }
      }
    };
    Promise.all([worker(), worker(), worker(), worker()]);
  }, [sentences, bizId, userId]);

  const counts = useMemo(() => ({
    reading: rows.filter(r => r.state === "reading").length,
    ready: rows.filter(r => r.state === "ready").length,
    question: rows.filter(r => r.state === "question").length,
    error: rows.filter(r => r.state === "error" || r.state === "failed").length,
    posted: rows.filter(r => r.state === "posted").length,
  }), [rows]);
  const chosen = rows.filter(r => selected.has(r.i) && r.state === "ready" && r.tx);
  const chosenTotal = chosen.reduce((s, r) => s + (r.tx!.lines.reduce((t, l) => t + (l.debit || 0), 0)), 0);
  const balanced = (tx?: ParsedTransaction) => !!tx && Math.abs(tx.lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0)) < 0.01;

  function setAccount(i: number, li: number, account: string) {
    setRows(prev => prev.map(r => r.i === i && r.tx ? { ...r, tx: { ...r.tx, lines: r.tx.lines.map((l, k) => k === li ? { ...l, account } : l) } } : r));
  }

  async function postSelected() {
    if (!chosen.length || posting) return;
    const flagged = chosen.filter(r => r.duplicate || r.issues?.length);
    if (flagged.length && !confirmFlagged) { setConfirmFlagged(flagged.length); return; }
    setConfirmFlagged(0);
    setPosting(true); setMsg(null);
    const ids = new Set(chosen.map(r => r.i));
    setRows(prev => prev.map(r => ids.has(r.i) ? { ...r, state: "posting" } : r));
    let posted = 0, total = 0;
    const journals: { id: string; date: string; entryNo: string }[] = [];
    try {
      for (let k = 0; k < chosen.length; k += 100) {
        const part = chosen.slice(k, k + 100);
        const res = await fetch("/api/finance/chat-book/confirm-batch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: bizId, source: "template", account_heads: heads,
            items: part.map(r => ({ ref: String(r.i), transaction: r.tx, original_message: r.text, client_key: `${userId}:tpl:${fileKey}:${r.i}` })) }),
        });
        const d = await res.json().catch(() => ({}));
        if (d.needs_heads) {
          setNeedHeads(d.needs_heads);
          setHeads(h => ({ ...Object.fromEntries((d.needs_heads as { account: string; suggested: string }[]).map(n => [n.account, guessGroup(n.account) === "indirect_expense" ? n.suggested : guessGroup(n.account)])), ...h }));
          setRows(prev => prev.map(r => r.state === "posting" ? { ...r, state: "ready" } : r));
          setMsg({ ok: false, text: "Choose a group for the new ledgers below, then press Post again." });
          return;
        }
        if (!res.ok) throw new Error(d.error ?? "Posting failed.");
        for (const x of (d.results ?? []) as { ref: string; entry_no: string; journal_id: string; already?: boolean }[]) {
          const r = part.find(p => String(p.i) === x.ref);
          if (r && !x.already) journals.push({ id: x.journal_id, date: r.tx!.transaction_date, entryNo: x.entry_no });
          patch(+x.ref, { state: "posted", entryNo: x.entry_no });
          posted++; total += r ? r.tx!.lines.reduce((t, l) => t + (l.debit || 0), 0) : 0;
        }
        for (const f of (d.failures ?? []) as { ref: string; error: string }[]) patch(+f.ref, { state: "failed", error: f.error });
      }
      setSelected(new Set());
      setNeedHeads([]);
      setMsg({ ok: true, text: `Posted ${posted} entr${posted === 1 ? "y" : "ies"} · ${cur()}${fmt(total)}` });
      if (posted) onPosted(posted, total, journals);
    } catch (e) {
      setRows(prev => prev.map(r => r.state === "posting" ? { ...r, state: "ready" } : r));
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Posting failed." });
    } finally { setPosting(false); }
  }

  const pending = rows.filter(r => r.state === "question" || r.state === "error" || r.state === "failed");
  const statusChip = (r: BRow) => {
    const s: Record<RowState, [string, string, string]> = {
      reading: ["Reading…", C.soft, C.primary], ready: ["Ready", C.posSoft, C.pos], question: ["Needs detail", C.warnSoft, C.warn],
      error: ["Error", C.negSoft, C.neg], posting: ["Posting…", C.soft, C.primary], posted: [`✓ ${r.entryNo ?? "Posted"}`, C.posSoft, C.pos], failed: ["Failed", C.negSoft, C.neg],
    };
    const [t, bg, fg] = s[r.state];
    return <span style={{ fontSize: 11.5, fontWeight: 800, padding: "4px 11px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{t}</span>;
  };

  const total = (tx?: ParsedTransaction) => tx ? tx.lines.reduce((s, l) => s + (l.debit || 0), 0) : 0;
  // "Voucher 16 from KIZZA BILL.PDF: Purchase bill …" → "Purchase bill …"
  const title = (r: BRow) => (r.tx?.narrative || r.text).replace(/^Template row \d+:\s*/, "").replace(/^Voucher \d+ from [^:]+:\s*/i, "");
  const readyRows = rows.filter(r => r.state === "ready" && balanced(r.tx) && !r.locked);
  const allTicked = readyRows.length > 0 && readyRows.every(r => selected.has(r.i));
  const done = rows.length - counts.reading;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,26,0.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, fontFamily: "inherit" }}>
      <style>{`.br-row{transition:background .12s,box-shadow .12s}.br-row:hover{box-shadow:0 10px 26px -20px rgba(15,43,37,.6)}.br-led:focus{outline:none;border-color:#C9A24A !important;box-shadow:0 0 0 3px rgba(201,162,74,.18)}.br-btn:focus-visible,.br-row input[type=checkbox]:focus-visible{outline:2px solid #C9A24A;outline-offset:2px}
        @media (max-width:760px){.br-grid{grid-template-columns:28px minmax(0,1fr) !important}.br-amt{grid-column:2;text-align:left !important}.br-date{display:none}}`}</style>
      <div role="dialog" aria-label="Review and post entries" style={{ background: C.bg, borderRadius: 22, width: "100%", maxWidth: 1180, height: "92vh", display: "flex", flexDirection: "column", color: C.ink, boxShadow: "0 40px 100px rgba(0,0,0,0.45)", overflow: "hidden" }}>
        <header style={{ padding: "18px 22px", background: "linear-gradient(120deg,#12352D,#0B1F1A)", color: "#F6F1E7", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(217,181,111,0.16)", border: "1px solid rgba(217,181,111,0.45)", color: "#D9B56F", fontFamily: SERIF, fontWeight: 700, fontSize: 18 }}>Fb</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#D9B56F" }}>Review &amp; post</div>
            <div style={{ fontFamily: SERIF, fontSize: 21, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60vw" }}>{fileName}</div>
          </div>
          <div style={{ flex: 1 }} />
          {[[counts.ready, "Ready", "#A8F0CF"], [counts.question, "Need detail", "#F3D99C"], [counts.error, "Errors", "#F6B8AA"], [counts.posted, "Posted", "#D9B56F"]].map(([n, l, c]) => (
            <div key={l as string} style={{ textAlign: "center", minWidth: 64 }}>
              <div style={{ fontFamily: SERIF, fontSize: 22, color: c as string, lineHeight: 1 }}>{n as number}</div>
              <div style={{ fontSize: 11, color: "#B9C7C1", marginTop: 3 }}>{l as string}</div>
            </div>
          ))}
          <button className="br-btn" onClick={onClose} disabled={posting} aria-label="Close" style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#FFFFFF", fontSize: 18, cursor: "pointer" }}>×</button>
          {counts.reading > 0 && (
            <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#B9C7C1" }}>
              <span>Reading {done} of {rows.length}…</span>
              <span aria-hidden="true" style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(done / Math.max(1, rows.length)) * 100}%`, background: "#D9B56F" }} /></span>
            </div>
          )}
        </header>

        <div style={{ padding: "10px 22px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.line}`, background: "#FBF7EE", fontSize: 13 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, cursor: "pointer" }}>
            <input type="checkbox" checked={allTicked} disabled={!readyRows.length} onChange={e => setSelected(e.target.checked ? new Set(readyRows.map(r => r.i)) : new Set())} style={{ width: 17, height: 17, accentColor: "#12352D" }} />
            Select all ready ({readyRows.length})
          </label>
          <span style={{ color: C.muted }}>Rows with a warning aren&apos;t ticked automatically — check them first.</span>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(r => {
            const canTick = r.state === "ready" && balanced(r.tx) && !r.locked;
            const on = selected.has(r.i);
            const flags = [
              r.question && { t: `🤔 ${r.question}`, c: C.warn, bg: C.warnSoft },
              r.error && { t: r.error, c: C.neg, bg: C.negSoft },
              r.duplicate && r.state === "ready" && { t: `⚠ Possible duplicate of ${r.duplicate}`, c: C.warn, bg: C.warnSoft },
              !!r.issues?.length && r.state === "ready" && { t: `⚠ ${r.issues.join(" · ")}`, c: C.neg, bg: C.negSoft },
              r.locked && { t: "🔒 This date is in a locked year", c: C.neg, bg: C.negSoft },
              r.tx && r.state === "ready" && !balanced(r.tx) && { t: "Debits and credits don't match", c: C.neg, bg: C.negSoft },
            ].filter(Boolean) as { t: string; c: string; bg: string }[];
            return (
              <div key={r.i} className="br-row br-grid" style={{ display: "grid", gridTemplateColumns: "28px 40px 96px minmax(0,1fr) 130px 110px", gap: 12, alignItems: "start", padding: "14px 16px", borderRadius: 16, background: r.state === "posted" ? "#EEF7F1" : on ? "#FFFFFF" : "#FFFDF8", border: `1px solid ${on ? "#C9A24A" : C.line}` }}>
                <input type="checkbox" aria-label={`Select entry ${r.i + 1}`} disabled={!canTick} checked={on} onChange={() => setSelected(s => { const n = new Set(s); if (n.has(r.i)) n.delete(r.i); else n.add(r.i); return n; })} style={{ width: 17, height: 17, marginTop: 4, accentColor: "#12352D" }} />
                <span className="br-date" style={{ fontFamily: SERIF, fontSize: 18, color: "#9A7A2E", lineHeight: 1.2 }}>{r.i + 1}</span>
                <span className="br-date" style={{ fontSize: 12.5, color: C.muted, paddingTop: 4, fontVariantNumeric: "tabular-nums" }}>{r.tx?.transaction_date ? new Date(r.tx.transaction_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.4 }}>{title(r)}</div>
                  {r.tx && r.state !== "question" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {r.tx.lines.map((l, li) => (
                        <div key={li} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,320px) auto", gap: 8, alignItems: "center", paddingLeft: l.debit ? 0 : 18 }}>
                          <span style={{ display: "inline-grid", placeItems: "center", height: 20, borderRadius: 6, fontSize: 10.5, fontWeight: 900, letterSpacing: "0.04em", background: l.debit ? "#12352D" : "#F3E8D2", color: l.debit ? "#D9B56F" : "#8A6420" }}>{l.debit ? "DR" : "CR"}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <input className="br-led" list="bulk-ledgers" value={l.account} disabled={r.state !== "ready"} onChange={e => setAccount(r.i, li, e.target.value)} aria-label={`Ledger for entry ${r.i + 1} line ${li + 1}`}
                              style={{ flex: 1, minWidth: 0, height: 32, border: `1px solid ${C.line}`, borderRadius: 9, padding: "0 10px", fontSize: 13, background: r.state === "ready" ? "#FFFFFF" : "transparent", color: C.ink, fontFamily: "inherit" }} />
                            {l.is_new_account && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "#EEE8FB", color: C.purple }}>new</span>}
                          </span>
                          <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: C.muted }}>{fmt(l.debit || l.credit)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {flags.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{flags.map(f => <span key={f.t} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: f.bg, color: f.c }}>{f.t}</span>)}</div>}
                </div>
                <span className="br-amt" style={{ textAlign: "right", fontFamily: SERIF, fontSize: 19, fontVariantNumeric: "tabular-nums", color: C.ink }}>{r.tx ? `${cur()}${fmt(total(r.tx))}` : ""}</span>
                <span className="br-amt" style={{ textAlign: "right" }}>{statusChip(r)}</span>
              </div>
            );
          })}
          <datalist id="bulk-ledgers">{[...new Set(rows.flatMap(r => r.tx?.lines.map(l => l.account) ?? []))].map(a => <option key={a} value={a} />)}</datalist>
        </div>

        <footer style={{ borderTop: `1px solid ${C.line}`, background: "#FBF7EE", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
          {needHeads.length > 0 && (
            <div style={{ display: "flex", gap: "8px 16px", flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
              <b style={{ color: C.warn, width: "100%" }}>New ledgers — likely group is ticked ✓; change if wrong, then post again:</b>
              {needHeads.map(n => (
                <div key={n.account} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                  <b style={{ minWidth: 140 }}>{n.account}</b>
                  <GroupChips compact value={heads[n.account] ?? n.suggested} onChange={k => setHeads(h => ({ ...h, [n.account]: k }))} />
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {confirmFlagged > 0 && !posting && <span role="alert" style={{ fontSize: 13.5, fontWeight: 700, color: C.neg }}>⚠ {confirmFlagged} ticked entr{confirmFlagged === 1 ? "y has" : "ies have"} a possible duplicate or compliance warning. Untick {confirmFlagged === 1 ? "it" : "them"}, or press Post again to post anyway. <button onClick={() => setConfirmFlagged(0)} style={{ border: "none", background: "none", color: C.ink, textDecoration: "underline", cursor: "pointer", fontWeight: 700 }}>Cancel</button></span>}
            {msg && !confirmFlagged && <span role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg.ok ? C.pos : C.warn }}>{msg.text}</span>}
            <div style={{ flex: 1 }} />
            {pending.length > 0 && !posting && (
              <button className="br-btn" onClick={() => { onSendToChat(pending.map(r => r.text)); onClose(); }} style={{ height: 46, padding: "0 18px", borderRadius: 999, border: "1px solid #D9CBAA", background: "#FFFFFF", color: C.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                Answer {pending.length} in chat
              </button>
            )}
            <button className="br-btn" onClick={postSelected} disabled={!chosen.length || posting} style={{ height: 50, padding: "0 8px 0 22px", borderRadius: 999, border: "none", background: confirmFlagged ? C.neg : "#12352D", color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: chosen.length && !posting ? "pointer" : "default", opacity: chosen.length && !posting ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 12 }}>
              {posting ? "Posting…" : confirmFlagged ? `Post anyway (${chosen.length})` : `Post ${chosen.length} entr${chosen.length === 1 ? "y" : "ies"} · ${cur()}${fmt(chosenTotal)}`}
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", background: "#D9B56F", color: "#12352D", display: "grid", placeItems: "center" }}>✓</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
