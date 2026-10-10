"use client";
// Bulk review for the Excel entry template: every row is drafted by the same rules as chat,
// shown in one table, and the ticked rows are posted together. Each row posts at most once.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ParsedTransaction } from "@/lib/intentEngine";
import { LEDGER_HEADS } from "@/lib/ledgerHeads";
import GroupChips, { guessGroup } from "@/components/GroupChips";

type RowState = "reading" | "ready" | "question" | "error" | "posting" | "posted" | "failed";
type BRow = {
  i: number; text: string; state: RowState; tx?: ParsedTransaction; question?: string; error?: string;
  entryNo?: string; duplicate?: string | null; issues?: string[]; locked?: boolean;
};

const C = { bg: "#F5F6FA", line: "#E1E4EE", strong: "#C9CEDF", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", soft: "#E6E8F4", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB", purple: "#5B4BC4" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const fmt = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MAX_ROWS = 200;

export default function BulkTemplateModal({ fileName, fileKey, sentences, bizId, userId, onClose, onPosted, onSendToChat }: {
  fileName: string; fileKey: string; sentences: string[]; bizId: string; userId: string;
  onClose: () => void; onPosted: (count: number, total: number) => void; onSendToChat: (sentences: string[]) => void;
}) {
  const [rows, setRows] = useState<BRow[]>(() => sentences.slice(0, MAX_ROWS).map((text, i) => ({ i, text, state: "reading" })));
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
    let cursor = 0;
    const worker = async () => {
      while (cursor < Math.min(sentences.length, MAX_ROWS)) {
        const i = cursor++;
        try {
          const res = await fetch("/api/finance/chat-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: sentences[i], business_id: bizId, user_id: userId, bulk: true, history: [] }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { patch(i, { state: "error", error: d.error ?? "Couldn't read this row." }); continue; }
          if (d.answer) { patch(i, { state: "error", error: "This row reads like a question, not a transaction." }); continue; }
          const tx = d.parsed as ParsedTransaction;
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
        for (const x of (d.results ?? []) as { ref: string; entry_no: string }[]) {
          const r = part.find(p => String(p.i) === x.ref);
          patch(+x.ref, { state: "posted", entryNo: x.entry_no });
          posted++; total += r ? r.tx!.lines.reduce((t, l) => t + (l.debit || 0), 0) : 0;
        }
        for (const f of (d.failures ?? []) as { ref: string; error: string }[]) patch(+f.ref, { state: "failed", error: f.error });
      }
      setSelected(new Set());
      setNeedHeads([]);
      setMsg({ ok: true, text: `Posted ${posted} entr${posted === 1 ? "y" : "ies"} · ₹${fmt(total)}` });
      if (posted) onPosted(posted, total);
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
    return <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: bg, color: fg, whiteSpace: "nowrap" }}>{t}</span>;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,26,58,0.35)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div role="dialog" aria-label="Bulk post template entries" style={{ background: C.bg, borderRadius: 16, width: "100%", maxWidth: 1180, height: "92vh", display: "flex", flexDirection: "column", color: C.ink, boxShadow: "0 30px 90px rgba(20,26,58,0.3)", overflow: "hidden" }}>
        <header style={{ padding: "14px 18px", borderBottom: `1px solid ${C.line}`, background: "#FFFFFF", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>📊 Bulk post · {fileName}</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>
              {rows.length} rows{sentences.length > MAX_ROWS ? ` (first ${MAX_ROWS} of ${sentences.length})` : ""} · {counts.ready} ready · {counts.question} need detail · {counts.error} errors · {counts.posted} posted{counts.reading ? ` · reading ${counts.reading}…` : ""}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} disabled={posting} aria-label="Close" style={{ border: "none", background: "transparent", fontSize: 20, color: C.muted, cursor: "pointer", width: 36, height: 36 }}>×</button>
        </header>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 920 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "#FFFFFF", zIndex: 1, color: C.muted, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <th style={{ padding: "9px 10px", width: 30 }}>
                  <input type="checkbox" aria-label="Select all ready rows" checked={counts.ready > 0 && rows.filter(r => r.state === "ready").every(r => selected.has(r.i))}
                    onChange={e => setSelected(e.target.checked ? new Set(rows.filter(r => r.state === "ready").map(r => r.i)) : new Set())} />
                </th>
                <th style={{ padding: "9px 6px", textAlign: "left", width: 34 }}>#</th>
                <th style={{ padding: "9px 6px", textAlign: "left", width: 92 }}>Date</th>
                <th style={{ padding: "9px 6px", textAlign: "left" }}>Entry</th>
                <th style={{ padding: "9px 6px", textAlign: "right", width: 110 }}>Debit</th>
                <th style={{ padding: "9px 6px", textAlign: "right", width: 110 }}>Credit</th>
                <th style={{ padding: "9px 10px", textAlign: "left", width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const canTick = r.state === "ready" && balanced(r.tx) && !r.locked;
                return (
                  <tr key={r.i} style={{ borderTop: `1px solid ${C.line}`, background: r.state === "posted" ? "rgba(11,122,85,0.04)" : selected.has(r.i) ? "rgba(35,42,99,0.04)" : "#FFFFFF", verticalAlign: "top" }}>
                    <td style={{ padding: "10px" }}><input type="checkbox" aria-label={`Select row ${r.i + 1}`} disabled={!canTick} checked={selected.has(r.i)} onChange={() => setSelected(s => { const n = new Set(s); if (n.has(r.i)) n.delete(r.i); else n.add(r.i); return n; })} /></td>
                    <td style={{ padding: "10px 6px", color: C.muted }}>{r.i + 1}</td>
                    <td style={{ padding: "10px 6px", fontFamily: MONO, fontSize: 12 }}>{r.tx?.transaction_date ?? ""}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <div style={{ fontWeight: 600 }}>{r.tx?.narrative || r.text.replace(/^Template row \d+:\s*/, "")}</div>
                      {r.tx && r.state !== "question" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5 }}>
                          {r.tx.lines.map((l, li) => (
                            <div key={li} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                              <span style={{ width: 22, color: l.debit ? C.neg : C.pos, fontFamily: MONO }}>{l.debit ? "Dr" : "Cr"}</span>
                              <input list="bulk-ledgers" value={l.account} disabled={r.state !== "ready"} onChange={e => setAccount(r.i, li, e.target.value)} aria-label={`Ledger for row ${r.i + 1} line ${li + 1}`}
                                style={{ flex: 1, minWidth: 0, maxWidth: 300, border: `1px solid ${C.line}`, borderRadius: 7, padding: "3px 7px", fontSize: 12.5, background: r.state === "ready" ? "#FFFFFF" : "transparent", color: C.ink }} />
                              {l.is_new_account && <span style={{ fontSize: 10.5, color: C.purple }}>new</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {r.question && <div style={{ marginTop: 5, fontSize: 12.5, color: C.warn }}>🤔 {r.question}</div>}
                      {r.error && <div style={{ marginTop: 5, fontSize: 12.5, color: C.neg }}>{r.error}</div>}
                      {r.duplicate && r.state === "ready" && <div style={{ marginTop: 5, fontSize: 12.5, color: C.warn }}>⚠ Possible duplicate of {r.duplicate}</div>}
                      {!!r.issues?.length && r.state === "ready" && <div style={{ marginTop: 5, fontSize: 12.5, color: C.neg }}>⚠ {r.issues.join(" · ")}</div>}
                      {r.locked && <div style={{ marginTop: 5, fontSize: 12.5, color: C.neg }}>🔒 This date is in a locked year.</div>}
                      {r.tx && r.state === "ready" && !balanced(r.tx) && <div style={{ marginTop: 5, fontSize: 12.5, color: C.neg }}>Debits and credits don&apos;t match.</div>}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: MONO, color: C.neg }}>{r.tx ? fmt(r.tx.lines.reduce((s, l) => s + (l.debit || 0), 0)) : ""}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: MONO, color: C.pos }}>{r.tx ? fmt(r.tx.lines.reduce((s, l) => s + (l.credit || 0), 0)) : ""}</td>
                    <td style={{ padding: "10px" }}>{statusChip(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="bulk-ledgers">{[...new Set(rows.flatMap(r => r.tx?.lines.map(l => l.account) ?? []))].map(a => <option key={a} value={a} />)}</datalist>
        </div>

        <footer style={{ borderTop: `1px solid ${C.line}`, background: "#FFFFFF", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
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
              <button onClick={() => { onSendToChat(pending.map(r => r.text)); onClose(); }} style={{ height: 42, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.strong}`, background: "#FFFFFF", color: C.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                Answer {pending.length} in chat
              </button>
            )}
            <button onClick={postSelected} disabled={!chosen.length || posting || counts.reading > 0 && !chosen.length} style={{ height: 42, padding: "0 20px", borderRadius: 10, border: "none", background: C.pos, color: "#FFFFFF", fontWeight: 800, fontSize: 14.5, cursor: chosen.length && !posting ? "pointer" : "default", opacity: chosen.length && !posting ? 1 : 0.5 }}>
              {posting ? "Posting…" : confirmFlagged ? `Post anyway (${chosen.length})` : `✓ Post ${chosen.length} entr${chosen.length === 1 ? "y" : "ies"} · ₹${fmt(chosenTotal)}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
