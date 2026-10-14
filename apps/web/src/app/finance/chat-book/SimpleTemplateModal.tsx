"use client";
import { cur, activeMoney } from "@/lib/money";
// Review and post the simple Date | Particulars | Debit | Credit | Narration template. Exact — no AI involved.
import { useEffect, useMemo, useState } from "react";
import { LEDGER_HEADS } from "@/lib/ledgerHeads";
import { useTally, tallyUrl } from "@/lib/tallyConnection";
import { readTallyLedgerGroups } from "@/lib/integrations/tallyClient";
import { headForTallyGroup } from "@/lib/integrations/tally";
import GroupChips, { guessGroup } from "@/components/GroupChips";

// Closest Tally ledger for a name: exact (ignoring case/spaces/punctuation), else one containing the other
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function bestMatch(name: string, ledgers: string[]): string | null {
  const k = key(name);
  if (!k) return null;
  const exact = ledgers.find(l => key(l) === k);
  if (exact) return exact;
  if (k.length < 3) return null;
  const close = ledgers.filter(l => { const lk = key(l); return lk.length >= 3 && (lk.startsWith(k) || k.startsWith(lk) || lk.includes(k)); });
  return close.length === 1 ? close[0] : null;
}
import { voucherOf, type SimpleEntry } from "@/lib/simpleTemplate";

const C = { ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", soft: "#FBF8F1", forest: "#0F2B25", gold: "#C99A4E", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (n: number) => n ? n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

export default function SimpleTemplateModal({ fileName, fileKey, entries, bizId, onClose, onPosted }: { fileName: string; fileKey: string; entries: SimpleEntry[]; bizId: string; onClose: () => void; onPosted: (count: number, total: number) => void }) {
  const [sel, setSel] = useState<Set<number>>(() => new Set(entries.filter(e => !e.error).map(e => e.row)));
  const [done, setDone] = useState<Record<number, string>>({});      // row → entry no
  const [failed, setFailed] = useState<Record<number, string>>({});
  const [heads, setHeads] = useState<Record<string, string>>({});
  const [need, setNeed] = useState<{ account: string; suggested: string }[]>([]);
  const [busy, setBusy] = useState(false);
  // Template name → the ledger to use (a Tally ledger when one matches)
  const [rename, setRename] = useState<Record<string, string>>({});
  const tally = useTally();
  const [tallyLedgers, setTallyLedgers] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!need.length || tally.status !== "connected" || tallyLedgers) return;
    readTallyLedgerGroups(tallyUrl(), tally.company || null).then(g => {
      setTallyLedgers(g);
      const names = Object.keys(g);
      const auto: Record<string, string> = {}, autoHeads: Record<string, string> = {};
      for (const nd of need) {
        const m = bestMatch(nd.account, names);
        if (m) { auto[nd.account] = m; const h = headForTallyGroup(g[m]); if (h) autoHeads[nd.account] = h.key; }
      }
      setRename(r => ({ ...auto, ...r }));
      setHeads(h => ({ ...h, ...autoHeads }));
    }).catch(() => setTallyLedgers({}));
  }, [need, tally.status, tally.company, tallyLedgers]);
  const nameFor = (l: string) => (rename[l] ?? l).trim() || l;
  const [msg, setMsg] = useState("");
  const ok = entries.filter(e => !e.error), bad = entries.length - ok.length;
  const chosen = useMemo(() => ok.filter(e => sel.has(e.row) && !done[e.row]), [ok, sel, done]);

  async function post() {
    if (!chosen.length) return;
    if (need.some(n => !heads[n.account])) { setMsg("Choose a group for each new ledger first."); return; }
    setBusy(true); setMsg("");
    let count = 0, total = 0;
    for (let i = 0; i < chosen.length; i += 100) {
      const chunk = chosen.slice(i, i + 100);
      setMsg(`Posting ${i + 1}–${i + chunk.length} of ${chosen.length}…`);
      const items = chunk.map(e => ({
        ref: String(e.row), client_key: `tpl:${fileKey}:${e.row}`, original_message: `${fileName} row ${e.row}: ${e.narration}`,
        transaction: { status: "complete", transaction_date: e.date, transaction_type: voucherOf(e.lines), narrative: e.narration.slice(0, 200), amount: e.debit,
          party_name: null, party_type: null, invoice_number: null, payment_mode: null, bank_account_name: null,
          lines: e.lines.map(l => ({ account: nameFor(l.ledger), debit: l.debit, credit: l.credit, confidence: 1, is_new_account: false, suggested_type: null })),
          needs_clarification: [], warnings: [], confidence: 1 },
      }));
      const r = await fetch("/api/finance/chat-book/confirm-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, business_id: bizId, account_heads: Object.fromEntries(Object.entries(heads).map(([k, v]) => [nameFor(k), v])), source: "template" }) });
      const d = await r.json().catch(() => ({}));
      if (d.needs_heads?.length) {
        // Names come back as sent (possibly renamed) — map them to the template names shown in the panel
        const back = Object.fromEntries(Object.entries(rename).map(([k, v]) => [v, k]));
        d.needs_heads = d.needs_heads.map((x: { account: string; suggested: string }) => ({ ...x, account: back[x.account] ?? x.account }));
        const sideOf = (acct: string): "in" | "out" | null => {
          for (const en of entries) for (const l of en.lines) if (l.ledger === acct) {
            const kind = voucherOf(en.lines);
            if (kind === "receipt") return "in";
            if (kind === "payment") return "out";
          }
          return null;
        };
        setNeed(d.needs_heads); setHeads(h => ({ ...Object.fromEntries(d.needs_heads.map((n: { account: string; suggested: string }) => [n.account, guessGroup(n.account, sideOf(n.account))])), ...h })); setBusy(false); setMsg("New ledgers found — check the ✓ group for each and press Post again."); return; }
      if (!r.ok) { setBusy(false); setMsg(d.error ?? "Couldn't post. Nothing in this batch was saved."); return; }
      const posted = Object.fromEntries(((d.results ?? []) as { ref: string; entry_no: string }[]).map(x => [Number(x.ref), x.entry_no]));
      setDone(p => ({ ...p, ...posted }));
      setFailed(p => ({ ...p, ...Object.fromEntries(((d.failures ?? []) as { ref: string; error: string }[]).map(f => [Number(f.ref), f.error])) }));
      for (const e of chunk) if (posted[e.row]) { count++; total += e.debit; }
    }
    setBusy(false); setNeed([]);
    setMsg(`✓ ${count} of ${chosen.length} posted.`);
    if (count) onPosted(count, total);
  }

  const btn = (primary: boolean): React.CSSProperties => ({ height: 42, padding: "0 18px", borderRadius: 11, border: primary ? "none" : `1px solid #D8CDB4`, background: primary ? C.forest : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" });

  return (
    <div role="dialog" aria-modal="true" aria-label="Review template entries" style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,43,37,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#F6F1E7", borderRadius: 20, width: "100%", maxWidth: 1000, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", color: C.ink, boxShadow: "0 30px 80px -30px rgba(0,0,0,0.6)" }}>
        <div style={{ background: C.forest, color: "#FFFFFF", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif", fontSize: "1.3rem", fontWeight: 700 }}>Bulk entries</div>
            <div style={{ fontSize: 13, color: "#C9D3CE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName} · {entries.length} entries{bad ? ` · ${bad} need fixing in the file` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#D9B56F", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {need.length > 0 && (
          <div style={{ background: "#FFF4DB", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <b style={{ fontSize: 14 }}>New ledgers — we picked the likely group (✓). Change any that are wrong, then post.</b>
            <span style={{ fontSize: 12.5, color: C.muted }}>{tally.status === "connected" ? (tallyLedgers ? `${Object.keys(tallyLedgers).length} ledgers loaded from Tally${tally.company ? ` (${tally.company})` : ""}. Matches are filled in — change any you like.` : "Loading ledgers from Tally…") : "Connect Tally (Tally page) to pick from your Tally ledgers."}</span>
            {tallyLedgers && <datalist id="tally-ledgers">{Object.keys(tallyLedgers).sort().map(l => <option key={l} value={l}>{tallyLedgers[l]}</option>)}</datalist>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {need.map(nd => {
                const chosen = nameFor(nd.account), parent = tallyLedgers?.[chosen];
                return (
                  <div key={nd.account} style={{ display: "grid", gridTemplateColumns: "minmax(110px,160px) minmax(0,0.8fr) minmax(0,1.6fr)", gap: 8, alignItems: "center", fontSize: 13, background: "#FFFFFF", borderRadius: 10, padding: "8px 10px" }}>
                    <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nd.account}>{nd.account}</b>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Ledger to use{parent ? " · in Tally ✓" : ""}</span>
                      <input list="tally-ledgers" value={rename[nd.account] ?? nd.account} onChange={e => { const v = e.target.value; setRename(r => ({ ...r, [nd.account]: v })); const p = tallyLedgers?.[v]; const h = p ? headForTallyGroup(p) : null; if (h) setHeads(x => ({ ...x, [nd.account]: h.key })); }}
                        placeholder={tallyLedgers ? "Type to search Tally ledgers" : nd.account} style={{ height: 38, borderRadius: 8, border: `1px solid ${parent ? "rgba(11,122,85,0.45)" : C.line}`, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: C.ink }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Group{parent ? ` · Tally: ${parent}` : ""}</span>
                      <GroupChips value={heads[nd.account] ?? ""} onChange={k => setHeads(h => ({ ...h, [nd.account]: k }))} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map(e => {
            const posted = done[e.row], fail = failed[e.row];
            return (
              <div key={e.row} style={{ background: "#FFFFFF", border: `1px solid ${e.error || fail ? "#E8A59B" : C.line}`, borderRadius: 14, padding: "10px 14px", opacity: posted ? 0.7 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5 }}>
                  <input type="checkbox" aria-label={`Select row ${e.row}`} disabled={!!e.error || !!posted} checked={sel.has(e.row) && !e.error} onChange={() => setSel(s => { const n = new Set(s); if (n.has(e.row)) n.delete(e.row); else n.add(e.row); return n; })} />
                  <span style={{ fontFamily: MONO, color: C.muted }}>{e.date}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: "#EFE8D9", color: C.ink, textTransform: "capitalize" }}>{voucherOf(e.lines)}</span>
                  <b style={{ flex: 1, minWidth: 160 }}>{e.narration}</b>
                  <span style={{ fontFamily: MONO, fontWeight: 600 }}>{cur()}{inr(e.debit)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>row {e.row}</span>
                  {posted && <span style={{ fontSize: 12, fontWeight: 800, color: C.pos, background: C.posSoft, padding: "2px 8px", borderRadius: 6 }}>✓ {posted}</span>}
                </div>
                <table style={{ width: "100%", marginTop: 6, fontSize: 13, borderCollapse: "collapse" }}>
                  <tbody>{e.lines.map((l, k) => (
                    <tr key={k} style={{ borderTop: `1px solid ${C.soft}` }}>
                      <td style={{ padding: "3px 0", paddingLeft: l.credit ? 22 : 0 }}>{l.debit ? "Dr" : "Cr"} {nameFor(l.ledger)}{nameFor(l.ledger) !== l.ledger && <span style={{ color: C.muted, fontSize: 12 }}> (was {l.ledger})</span>}</td>
                      <td style={{ textAlign: "right", fontFamily: MONO, width: 140 }}>{inr(l.debit)}</td>
                      <td style={{ textAlign: "right", fontFamily: MONO, width: 140 }}>{inr(l.credit)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {(e.error || fail) && <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: C.neg }}>⚠ {e.error ?? fail}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, background: "#FFFFFF", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setSel(new Set(chosen.length === ok.filter(e => !done[e.row]).length ? [] : ok.map(e => e.row)))} style={btn(false)}>{chosen.length === ok.filter(e => !done[e.row]).length ? "Clear" : "Select all"}</button>
          <span role="status" style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: msg.startsWith("✓") ? C.pos : C.muted }}>{msg || `${chosen.length} selected · ${cur()}${inr(chosen.reduce((s, e) => s + e.debit, 0)) || "0.00"}`}</span>
          <button onClick={onClose} style={btn(false)}>Close</button>
          <button onClick={post} disabled={busy || !chosen.length} style={{ ...btn(true), opacity: busy || !chosen.length ? 0.55 : 1 }}>{busy ? "Posting…" : `Post ${chosen.length} entr${chosen.length === 1 ? "y" : "ies"}`}</button>
        </div>
      </div>
    </div>
  );
}
