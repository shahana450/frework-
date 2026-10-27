"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cur, activeMoney } from "@/lib/money";

// Receivables / Payables as party cards on the cream ledger theme
export type PartyCard = { id: string | null; name: string; count: number; billed: number; settled: number; outstanding: number; oldest: string; days: number };

const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const T = { ink: "#10241F", green: "#12352D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", muted: "#6B7570" };

export default function PartyBoard({ kind, rows, total, overdue, loading, newHref, cardHref, cardAction, notice }: {
  kind: "receivable" | "payable"; rows: PartyCard[]; total: number; overdue: number; loading: boolean;
  newHref: string; cardHref: (r: PartyCard) => string; cardAction: string; notice?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const ar = kind === "receivable";
  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2 });
  const money = (n: number) => `${n < 0 ? "−" : ""}${cur()}${fmt(Math.abs(n))}`;
  const bucket = (d: number) => d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3;
  const LABELS = ["0–30 days", "31–60 days", "61–90 days", "90+ days"];
  const COLORS = [T.pos, T.goldInk, "#B4561E", T.neg];
  const buckets = [0, 1, 2, 3].map(b => rows.filter(r => bucket(r.days) === b).reduce((s, r) => s + r.outstanding, 0));
  const shown = rows.filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const dmy = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";
  const chip = (dark: boolean, soft?: boolean): React.CSSProperties => ({ padding: "9px 16px", borderRadius: 999, fontSize: "0.92rem", background: dark ? T.green : soft ? "#FBECE8" : T.paper, color: dark ? "#FFFFFF" : soft ? T.neg : T.ink, border: `1px solid ${dark ? T.green : soft ? "#EBC4BA" : T.line}` });

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SERIF }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, flex: 1, fontSize: "2.5rem", fontWeight: 400, fontStyle: "italic" }}>Accounts {ar ? "Receivable" : "Payable"}</h1>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={ar ? "Search customers…" : "Search vendors…"}
            style={{ width: 290, maxWidth: "100%", border: `1px solid ${T.line}`, borderRadius: 999, padding: "10px 16px", background: T.paper, fontFamily: SERIF, fontSize: "0.9rem", color: T.ink, outline: "none" }} />
          <Link href={newHref} style={{ padding: "10px 20px", borderRadius: 999, background: T.green, color: "#FFFFFF", textDecoration: "none", fontWeight: 700 }}>+ New {ar ? "invoice" : "bill"}</Link>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={chip(true)}>{ar ? "Outstanding" : "Total payable"} {money(total)}</span>
          <span style={chip(false, overdue > 0)}>Overdue &gt; 30 days {money(overdue)}</span>
          <span style={chip(false)}>{rows.length} {ar ? (rows.length === 1 ? "customer" : "customers") : (rows.length === 1 ? "vendor" : "vendors")} with dues</span>
          <span style={chip(false)}>Avg {money(rows.length ? total / rows.length : 0)}</span>
        </div>

        {notice}

        {loading ? <div style={{ padding: "3rem", textAlign: "center", color: T.muted, fontStyle: "italic" }}>Loading {ar ? "receivables" : "payables"}…</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(400px,1fr))", gap: 18 }}>
            {shown.map(r => {
              const b = bucket(r.days), adv = r.outstanding < 0;
              const edge = adv ? T.pos : COLORS[b];
              return (
                <div key={r.id ?? r.name} style={{ background: T.paper, border: `1px solid ${T.line}`, borderTop: `3px solid ${edge}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px" }}>
                    <span style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 999, background: T.green, color: T.gold, display: "grid", placeItems: "center", fontStyle: "italic", fontSize: "1.2rem" }}>{initials(r.name)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "1.3rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                      <div style={{ fontSize: "0.8rem", color: T.muted }}>{r.count} {ar ? "invoice" : "bill"}{r.count === 1 ? "" : "s"} · oldest {dmy(r.oldest)}</div>
                    </div>
                    <span style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 999, border: `1px solid ${edge}`, color: edge }}>{adv ? (ar ? "Advance received" : "Advance paid") : LABELS[b]}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
                    {[[ar ? "Invoiced" : "Billed", r.billed, T.muted, T.ink], [ar ? "Received" : "Paid", r.settled, T.pos, T.ink], ["Outstanding", r.outstanding, T.muted, r.outstanding > 0 && b >= 2 ? T.neg : T.ink]].map(([l, v, lc, vc], i) => (
                      <div key={String(l)} style={{ padding: "12px 18px", borderLeft: i ? `1px solid ${T.line}` : undefined }}>
                        <div style={{ fontSize: "0.78rem", color: lc as string }}>{l as string}</div>
                        <div style={{ fontSize: "1.05rem", color: vc as string, fontVariantNumeric: "tabular-nums" }}>{(v as number) < 0 ? "−" : ""}{fmt(Math.abs(v as number))}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px" }}>
                    <div style={{ flex: 1, display: "flex", gap: 4 }} title={LABELS[b]}>
                      {[0, 1, 2, 3].map(i => <span key={i} style={{ flex: 1, maxWidth: 42, height: 5, borderRadius: 999, background: i <= b && !adv ? COLORS[b] : i === 0 && adv ? T.green : "#EFE6D3" }} />)}
                    </div>
                    {r.id && <Link href={`/finance/ledger?account=${r.id}`} style={{ color: T.goldInk }}>Ledger</Link>}
                    <Link href={cardHref(r)} style={{ padding: "8px 16px", borderRadius: 999, background: T.green, color: "#FFFFFF", textDecoration: "none", fontSize: "0.88rem" }}>{cardAction} →</Link>
                  </div>
                </div>
              );
            })}
            <Link href={ar ? "/finance/contacts" : "/finance/contacts"} style={{ minHeight: 200, border: `1px dashed ${T.gold}`, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", color: T.ink }}>
              <span style={{ fontSize: "1.6rem", color: T.gold }}>+</span>
              <span style={{ fontSize: "1.05rem" }}>Add a {ar ? "customer" : "vendor"}</span>
              <span style={{ fontSize: "0.82rem", color: T.muted }}>or import {ar ? "customers" : "vendors"} from Excel</span>
            </Link>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "16px 22px", borderRadius: 14, background: T.green, color: "#C9D3CE" }}>
            <span style={{ fontSize: "0.75rem", letterSpacing: "0.22em", color: T.gold }}>AGING</span>
            {buckets.map((v, i) => <span key={i} style={{ color: i === 0 ? "#FFFFFF" : i === 3 && v ? "#F0A792" : undefined }}>{["0–30", "31–60", "61–90", "90+"][i]} d {i === 0 ? <b>{money(v).replace(cur(), "")}</b> : money(v).replace(cur(), "")}</span>)}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: "0.88rem" }}>{ar ? "Total net of advances" : "Total payable"} {money(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
