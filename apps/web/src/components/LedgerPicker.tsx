"use client";
// Tap a ledger to change it: search your ledgers (grouped, with recently used first) or create a new one
// with its group pre-guessed. Used on FreBook draft lines.
import { useEffect, useMemo, useRef, useState } from "react";
import GroupChips, { guessGroup } from "@/components/GroupChips";

export type Ledger = { name: string; type: string; sub_type: string | null };

const GROUPS: { key: string; label: string; tint: string; ink: string; match: (l: Ledger) => boolean }[] = [
  { key: "cash", label: "Bank & cash", tint: "#EAF2FF", ink: "#1F5EFF", match: l => l.sub_type === "bank" || l.sub_type === "cash" },
  { key: "cust", label: "Customers", tint: "#E9F7F0", ink: "#0B7A55", match: l => l.sub_type === "trade_receivables" },
  { key: "supp", label: "Suppliers", tint: "#FFF1E8", ink: "#C2410C", match: l => l.sub_type === "trade_payables" },
  { key: "exp", label: "Expenses", tint: "#FDECEA", ink: "#C2321F", match: l => l.type === "expense" },
  { key: "inc", label: "Income", tint: "#F3EEFB", ink: "#5B4BC4", match: l => l.type === "income" },
  { key: "ast", label: "Assets", tint: "#EEF0FB", ink: "#232A63", match: l => l.type === "asset" },
  { key: "lia", label: "Liabilities & capital", tint: "#FFF7DD", ink: "#8A5A00", match: () => true },
];
export const groupOf = (l: Ledger) => GROUPS.find(g => g.match(l))!;

const HEAD_LABEL: Record<string, string> = {
  debtors: "Customer", creditors: "Supplier", indirect_expense: "Expense", indirect_income: "Income", sales: "Sales",
  purchase: "Purchase", bank: "Bank", cash: "Cash", duties: "Tax (GST/TDS)", capital: "Capital", loan: "Loan",
  fixed_asset: "Fixed asset", current_liability: "Liability", current_asset: "Asset", direct_expense: "Direct expense", advances: "Advance",
};

export default function LedgerPicker({ value, ledgers, isNew, head, recent = [], onPick }: {
  value: string;
  ledgers: Ledger[];
  isNew?: boolean;
  head?: string;                      // group chosen for a new ledger
  recent?: string[];
  onPick: (name: string, opts: { isNew: boolean; head?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [newHead, setNewHead] = useState("indirect_expense");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setCreating(null); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setCreating(null); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current = ledgers.find(l => l.name.toLowerCase() === value.toLowerCase());
  const g = current ? groupOf(current) : null;
  const term = q.trim().toLowerCase();
  const hits = useMemo(() => ledgers.filter(l => !term || l.name.toLowerCase().includes(term)), [ledgers, term]);
  const recents = recent.map(n => ledgers.find(l => l.name === n)).filter((l): l is Ledger => !!l && (!term || l.name.toLowerCase().includes(term))).slice(0, 4);
  const exact = ledgers.some(l => l.name.toLowerCase() === term);
  const pick = (name: string) => { onPick(name, { isNew: false }); setOpen(false); setQ(""); };
  const startCreate = () => { const n = q.trim(); setCreating(n); setNewHead(guessGroup(n)); };

  return (
    <div ref={box} style={{ position: "relative", display: "inline-flex", maxWidth: "100%" }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        title="Change ledger"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", padding: "4px 8px 4px 10px", borderRadius: 9, border: `1px solid ${isNew ? "rgba(184,120,0,0.35)" : "transparent"}`, background: isNew ? "rgba(184,120,0,0.06)" : "transparent", cursor: "pointer", font: "inherit", color: "#141A3A", textAlign: "left" }}
        onMouseEnter={e => { if (!isNew) e.currentTarget.style.background = "rgba(35,42,99,0.06)"; }}
        onMouseLeave={e => { if (!isNew) e.currentTarget.style.background = "transparent"; }}>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "Choose ledger"}</span>
        {isNew
          ? <span style={{ fontSize: 10.5, fontWeight: 800, color: "#8A5A00", background: "rgba(184,120,0,0.12)", padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>New · {HEAD_LABEL[head ?? guessGroup(value)] ?? "Ledger"}</span>
          : g && <span style={{ fontSize: 10.5, fontWeight: 800, color: g.ink, background: g.tint, padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>{g.label}</span>}
        <span aria-hidden="true" style={{ color: "#8A90AE", fontSize: 11 }}>▾</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a ledger"
          style={{ position: "absolute", zIndex: 60, top: "calc(100% + 6px)", left: 0, width: 340, maxWidth: "86vw", background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.12)", borderRadius: 16, boxShadow: "0 18px 40px rgba(20,26,58,0.18)", overflow: "hidden" }}>
          {creating === null ? <>
            <div style={{ padding: 10, borderBottom: "1px solid rgba(20,26,58,0.08)" }}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search or type a new ledger…"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const first = hits[0]; if (term && !exact) startCreate(); else if (first) pick(first.name); } }}
                style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid rgba(20,26,58,0.14)", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box", font: "inherit" }} />
            </div>
            <div role="listbox" style={{ maxHeight: 300, overflowY: "auto", padding: "4px 0" }}>
              {term && !exact && (
                <button type="button" onClick={startCreate}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", border: "none", background: "rgba(240,102,43,0.07)", color: "#C2410C", fontWeight: 800, fontSize: 13.5, cursor: "pointer", textAlign: "left", font: "inherit" }}>
                  ＋ Create &ldquo;{q.trim()}&rdquo;
                </button>
              )}
              {recents.length > 0 && <Section label="Used recently" />}
              {recents.map(l => <Row key={"r" + l.name} l={l} on={l.name === value} onPick={pick} />)}
              {GROUPS.map(gr => {
                const rows = hits.filter(l => groupOf(l).key === gr.key && !recents.includes(l));
                if (!rows.length) return null;
                return <div key={gr.key}><Section label={gr.label} />{rows.slice(0, 40).map(l => <Row key={l.name} l={l} on={l.name === value} onPick={pick} />)}</div>;
              })}
              {!hits.length && !term && <p style={{ padding: "14px 12px", margin: 0, color: "#5A6080", fontSize: 13 }}>No ledgers yet — type a name to create one.</p>}
            </div>
          </> : (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A90AE" }}>New ledger</div>
                <input value={creating} onChange={e => setCreating(e.target.value)} autoFocus
                  style={{ marginTop: 6, width: "100%", height: 38, borderRadius: 10, border: "1px solid rgba(20,26,58,0.14)", padding: "0 12px", fontSize: 14, fontWeight: 700, boxSizing: "border-box", font: "inherit" }} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#4A5070", marginBottom: 6 }}>What is it?</div>
                <GroupChips compact value={newHead} onChange={setNewHead} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={!creating.trim()} onClick={() => { onPick(creating.trim(), { isNew: true, head: newHead }); setOpen(false); setCreating(null); setQ(""); }}
                  style={{ flex: 1, height: 40, borderRadius: 11, border: "none", background: "#232A63", color: "#FFFFFF", fontWeight: 800, cursor: "pointer", font: "inherit" }}>Use this ledger</button>
                <button type="button" onClick={() => setCreating(null)}
                  style={{ height: 40, padding: "0 14px", borderRadius: 11, border: "1px solid rgba(20,26,58,0.14)", background: "#FFFFFF", cursor: "pointer", font: "inherit" }}>Back</button>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7194" }}>It&apos;s created when you post this entry.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return <div style={{ padding: "8px 12px 4px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A90AE" }}>{label}</div>;
}

function Row({ l, on, onPick }: { l: Ledger; on: boolean; onPick: (n: string) => void }) {
  const g = groupOf(l);
  return (
    <button type="button" role="option" aria-selected={on} onClick={() => onPick(l.name)}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: on ? "rgba(35,42,99,0.07)" : "transparent", cursor: "pointer", textAlign: "left", font: "inherit", fontSize: 13.5, color: "#141A3A" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(35,42,99,0.06)")}
      onMouseLeave={e => (e.currentTarget.style.background = on ? "rgba(35,42,99,0.07)" : "transparent")}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: g.ink, flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
      {on && <span style={{ color: "#0B7A55", fontWeight: 800 }}>✓</span>}
    </button>
  );
}
