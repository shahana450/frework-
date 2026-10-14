"use client";
import { cur, activeMoney } from "@/lib/money";
import { useEffect, useState } from "react";
import type { ReviewResult } from "@/lib/reviewChecks";

const TONE = {
  ok: { bg: "#E3F6EE", fg: "#0B7A55", mark: "✓" },
  info: { bg: "#E6E8F4", fg: "#232A63", mark: "i" },
  warn: { bg: "#FFF4DB", fg: "#8A5A00", mark: "!" },
  bad: { bg: "#FDECEA", fg: "#C2321F", mark: "!" },
} as const;

// "Smart checks" + "After you post" for a draft. Read-only; refreshes when the lines change.
export default function ReviewChecks({ bizId, date, lines, onResult }: { bizId: string | null; date: string; lines: { account: string; debit: number; credit: number }[]; onResult?: (r: ReviewResult) => void }) {
  const [res, setRes] = useState<ReviewResult | null>(null);
  const key = JSON.stringify([date, lines.map(l => [l.account, l.debit, l.credit])]);

  useEffect(() => {
    if (!bizId || !lines.length) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch("/api/finance/chat-book/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, date, lines }) })
        .then(r => r.ok ? r.json() : null).then(d => { if (alive && d) { setRes(d); onResult?.(d); } }).catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, key]);

  const badKey = res ? res.checks.filter(c => c.tone === "bad").map(c => c.title).join("|") : "";
  const [seen, setSeen] = useState("");
  useEffect(() => {
    if (!badKey || badKey === seen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSeen(badKey); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [badKey, seen]);

  if (!res || (!res.checks.length && !res.impact.length)) return null;
  const fmt = (n: number) => cur() + n.toLocaleString(activeMoney().locale, { maximumFractionDigits: 0 });

  const bad = res.checks.filter(c => c.tone === "bad");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {bad.length > 0 && badKey !== seen && (
      <div role="dialog" aria-modal="true" aria-labelledby="cmp-pop" onClick={() => setSeen(badKey)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,26,58,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, maxWidth: 520, width: "100%", padding: 22, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 24px 60px -20px rgba(20,26,58,0.5)", borderTop: "6px solid #C2321F" }}>
          <div id="cmp-pop" style={{ fontSize: 18, fontWeight: 800, color: "#C2321F" }}>⚠ Compliance check — fix before posting</div>
          {bad.map((c, i) => (
            <div key={i} style={{ fontSize: 14.5, lineHeight: 1.55, color: "#141A3A", background: "#FDECEA", borderRadius: 12, padding: "10px 12px" }}><b style={{ color: "#C2321F" }}>{c.title}.</b> {c.detail}</div>
          ))}
          {[...new Set(bad.map(c => c.fix).filter(Boolean))].map(f => <div key={f} style={{ fontSize: 12.5, color: "#5A6080" }}>{f}</div>)}
          <button autoFocus onClick={() => setSeen(badKey)} style={{ alignSelf: "flex-end", height: 42, padding: "0 20px", borderRadius: 12, border: "none", background: "#232A63", color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>I&apos;ll review it</button>
        </div>
      </div>
    )}
    {bad.length > 0 && (
      <section role="alert" aria-label="Compliance problems" style={{ background: "#FDECEA", border: "1.5px solid #E8A59B", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#C2321F" }}>⚠ COMPLIANCE — FIX BEFORE POSTING</div>
        {bad.map((c, i) => (
          <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: "#141A3A" }}><b style={{ color: "#C2321F" }}>{c.title}.</b> {c.detail}</div>
        ))}
        {[...new Set(bad.map(c => c.fix).filter(Boolean))].map(f => <div key={f} style={{ fontSize: 12, color: "#5A6080" }}>{f}</div>)}
        <div style={{ fontSize: 11.5, color: "#5A6080" }}>Flagged from the Income-tax Act 2025 rules — check special cases with your CA.</div>
      </section>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
      <section aria-label="Smart checks" style={{ background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#5A6080" }}>SMART CHECKS</div>
        {res.checks.filter(c => c.tone !== "bad").map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: TONE[c.tone].bg, color: TONE[c.tone].fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>{TONE[c.tone].mark}</span>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "#141A3A" }}><b>{c.title}.</b> <span style={{ color: "#5A6080" }}>{c.detail}</span></div>
          </div>
        ))}
      </section>
      {res.impact.length > 0 && (
        <section aria-label="After you post" style={{ background: "#FFFFFF", border: "1px solid #E1E4EE", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#5A6080" }}>AFTER YOU POST</div>
          {res.impact.map(i => (
            <div key={i.account}>
              <div style={{ fontSize: 12.5, color: "#5A6080" }}>{i.account} balance</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontFamily: "'IBM Plex Mono',monospace" }}>
                <span style={{ fontSize: 13, color: "#8A90AE", textDecoration: "line-through" }}>{fmt(i.before)}</span>
                <span style={{ fontSize: 19, fontWeight: 600, color: i.after < 0 ? "#C2321F" : "#141A3A" }}>{fmt(i.after)}</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
    </div>
  );
}
