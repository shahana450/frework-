"use client";
import Link from "next/link";
import { useState } from "react";
import type { Answer } from "@/lib/bookQueries";

const BORDER = "rgba(20,26,58,0.11)", TEXT = "#141A3A", MUTED = "rgba(20,26,58,0.75)";
const GREEN = "#0B7A55", RED = "#C2321F", BLUE = "#1F5EFF", GOLD = "#232A63";
const MONO = "'IBM Plex Mono', 'Fira Code', monospace";
import { formatMoney } from "@/lib/money";

// Answer to a question about the books. Every figure comes from posted entries; the rows link back to them.
export default function AnswerCard({ answer }: { answer: Answer & { tool: string; currency?: string; locale?: string } }) {
  const money = (n: number) => formatMoney(n, { currency: answer.currency ?? "INR", locale: answer.locale ?? "en-IN" });
  const cell = (v: string | number) => typeof v === "number" ? money(v) : v;
  const [showTx, setShowTx] = useState(false);
  const tx = answer.transactions ?? [];
  return (
    <div style={{ maxWidth: "88%", background: "#FFFFFF", border: `1px solid rgba(31,94,255,0.22)`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "1rem" }}>📊</span>
        <div>
          <div style={{ fontSize: "0.66rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>From your books</div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{answer.title}</div>
        </div>
      </div>

      <div style={{ padding: "0.75rem 1rem", fontSize: "0.88rem", lineHeight: 1.6, color: TEXT }}>{answer.summary}</div>

      {answer.metrics.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", borderTop: `1px solid ${BORDER}` }}>
          {answer.metrics.map(m => (
            <div key={m.label} style={{ flex: "1 1 140px", padding: "0.6rem 1rem", borderRight: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: "0.64rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>{m.label}</div>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: "1rem", color: m.tone === "good" ? GREEN : m.tone === "bad" ? RED : TEXT, fontVariantNumeric: "tabular-nums" }}>
                {m.label === "Entries" ? m.value : money(m.value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {answer.table && (
        <div style={{ borderTop: `1px solid ${BORDER}`, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead><tr style={{ background: "#FFFFFF" }}>
              {answer.table.columns.map((c, i) => <th key={c} style={{ padding: "0.45rem 1rem", textAlign: i ? "right" : "left", color: MUTED, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{c}</th>)}
            </tr></thead>
            <tbody>
              {answer.table.rows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid rgba(20,26,58,0.10)` }}>
                  {r.map((v, j) => <td key={j} style={{ padding: "0.4rem 1rem", textAlign: j ? "right" : "left", fontFamily: typeof v === "number" ? MONO : undefined, color: typeof v === "number" && v < 0 ? RED : TEXT, whiteSpace: "nowrap" }}>{cell(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tx.length > 0 && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={() => setShowTx(s => !s)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: BLUE, padding: "0.55rem 1rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit" }}>
            {showTx ? "▾ Hide" : "▸ View"} {tx.length} transaction{tx.length > 1 ? "s" : ""}
          </button>
          {showTx && (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {tx.map(t => (
                <Link key={t.id} href={`/finance/journals?id=${t.id}`} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "0.45rem 1rem", borderTop: `1px solid rgba(20,26,58,0.10)`, textDecoration: "none", color: TEXT, fontSize: "0.78rem" }}>
                  <span style={{ color: MUTED, whiteSpace: "nowrap", minWidth: 78 }}>{t.date}</span>
                  <span style={{ fontFamily: MONO, color: GOLD, fontSize: "0.7rem", whiteSpace: "nowrap" }}>{t.entry_no}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.narration || "—"}</span>
                    <span style={{ display: "block", color: MUTED, fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.accounts}</span>
                  </span>
                  <span style={{ fontFamily: MONO, whiteSpace: "nowrap" }}>{money(t.amount)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "0.55rem 1rem", borderTop: `1px solid ${BORDER}`, display: "flex", gap: "0.9rem", flexWrap: "wrap", alignItems: "center", fontSize: "0.74rem" }}>
        {answer.period && <span style={{ color: MUTED }}>{answer.period.from} → {answer.period.to}</span>}
        {answer.links.map(l => <Link key={l.href} href={l.href} style={{ color: BLUE, textDecoration: "none" }}>{l.label} →</Link>)}
        <span style={{ color: MUTED, marginLeft: "auto" }}>Calculated from posted entries</span>
      </div>
      {answer.note && <div style={{ padding: "0 1rem 0.6rem", fontSize: "0.72rem", color: MUTED }}>{answer.note}</div>}
    </div>
  );
}
