"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cur, activeMoney } from "@/lib/money";

// Accounts Receivable / Payable on the cream ledger theme: KPI cards, ageing bar, then
// receivables as a collection table and payables as supplier cards (advances shown apart).
export type PartyCard = { id: string | null; name: string; count: number; billed: number; settled: number; outstanding: number; oldest: string; days: number };

const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const T = { ink: "#10241F", green: "#16342D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F2EDE4", paper: "#FFFDF8", line: "#E8E0D0", pos: "#0B7A55", neg: "#B23A20", muted: "#6B7570", head: "#8A6A2A" };

const fyLabel = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };

export default function PartyBoard({ kind, rows, total, loading, newHref, cardHref, cardAction, notice, cardExtra }: {
  kind: "receivable" | "payable"; rows: PartyCard[]; total: number; overdue?: number; loading: boolean;
  newHref: string; cardHref: (r: PartyCard) => string; cardAction: string; notice?: ReactNode;
  cardExtra?: (r: PartyCard) => ReactNode;   // an extra button on a supplier card (e.g. Pay now)
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "high">("all");
  const ar = kind === "receivable";
  const fmt = (n: number) => n.toLocaleString(activeMoney().locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n: number) => `${n < 0 ? "−" : ""}${cur()}${fmt(Math.abs(n))}`;
  const bucket = (d: number) => d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3;
  const LABELS = ["0–30 days", "31–60 days", "61–90 days", "90+ days"];
  const BAR = ["#2F7A57", "#C9A24A", "#C2702E", "#B23A20"];
  const dues = rows.filter(r => r.outstanding > 0.5);
  const advances = rows.filter(r => r.outstanding < -0.5);
  const duesTotal = dues.reduce((s, r) => s + r.outstanding, 0);
  const buckets = [0, 1, 2, 3].map(b => dues.filter(r => bucket(r.days) === b).reduce((s, r) => s + r.outstanding, 0));
  const over90 = buckets[3];
  const oldest = dues.map(r => r.oldest).filter(Boolean).sort()[0] ?? "";
  const docs = dues.reduce((s, r) => s + r.count, 0);
  const pct = (r: PartyCard) => r.billed > 0 ? Math.max(0, Math.min(1, r.settled / r.billed)) : null;
  const initials = (n: string) => n.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "··";
  const dmy = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";
  const match = (r: PartyCard) => !q || r.name.toLowerCase().includes(q.toLowerCase());
  const nWord = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

  const sortedDues = [...dues].sort((a, b) => ar ? b.outstanding - a.outstanding : (a.oldest || "9").localeCompare(b.oldest || "9"));
  const low = sortedDues.filter(r => (pct(r) ?? 0) < 0.5), high = sortedDues.filter(r => (pct(r) ?? 0) >= 0.8);
  const tableRows = (filter === "low" ? low : filter === "high" ? high : sortedDues).filter(match);
  const top2 = sortedDues.slice(0, 2);

  const kpi = (label: string, value: ReactNode, sub: ReactNode, o: { dark?: boolean; red?: boolean; dashed?: boolean } = {}) => (
    <div style={{ background: o.dark ? T.green : T.paper, color: o.dark ? "#FFFFFF" : T.ink, border: o.dark ? "none" : `1px ${o.dashed ? "dashed #D9C79A" : `solid ${o.red ? "#EFD5CC" : T.line}`}`, borderRadius: 20, padding: "26px 28px", minWidth: 0 }}>
      <div style={{ fontSize: 12.5, letterSpacing: "0.2em", textTransform: "uppercase", color: o.dark ? "#D3DCD8" : o.red ? T.neg : T.head }}>{label}</div>
      <div style={{ fontSize: "clamp(26px,2.6vw,36px)", margin: "12px 0 10px", color: o.red ? T.neg : undefined, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: 15, color: o.dark ? "#C9D3CE" : T.muted }}>{sub}</div>
    </div>
  );
  const btn = (kind: "dark" | "line" | "gold"): React.CSSProperties => ({ height: 50, padding: "0 24px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", textDecoration: "none", fontFamily: SERIF, fontSize: 16.5, cursor: "pointer", border: kind === "line" ? `1px solid ${T.ink}` : "none", background: kind === "dark" ? T.green : kind === "gold" ? "#CBA35A" : "transparent", color: kind === "dark" ? "#FFFFFF" : T.ink });

  return (
    <div style={{ minHeight: "100vh", background: T.cream, color: T.ink, fontFamily: SERIF }}>
      <style>{`.pb-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}@media(max-width:1000px){.pb-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.pb-kpis{grid-template-columns:1fr}}
        .pb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:18px}
        .pb-card{transition:box-shadow .18s,transform .18s}.pb-card:hover{box-shadow:0 18px 34px -26px rgba(15,43,37,.55);transform:translateY(-2px)}
        .pb-tbl td,.pb-tbl th{padding:20px 14px;border-bottom:1px solid ${T.line};vertical-align:middle}
        .pb-tbl th{font-weight:400;font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;color:${T.head};background:#F4EFE5;padding-top:18px;padding-bottom:18px;text-align:left}
        .pb-tbl tbody tr:hover{background:#FBF7EE}
        .pb-seg{display:inline-flex;border:1px solid ${T.line};border-radius:999px;overflow:hidden;background:#FFFFFF}
        .pb-seg button{height:50px;padding:0 22px;border:none;background:transparent;font:inherit;font-size:16.5px;color:${T.ink};cursor:pointer}
        .pb-seg button[aria-pressed=true]{background:${T.green};color:#FFFFFF}
        .pb-btn:hover{transform:translateY(-1px)}.pb-btn{transition:transform .14s}`}</style>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(14px,3vw,40px) 60px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 13, letterSpacing: "0.2em", color: T.head, textTransform: "uppercase" }}>FreBook · Books · {fyLabel()}</div>
            <h1 style={{ margin: "10px 0 6px", fontSize: "clamp(40px,5.4vw,66px)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.05 }}>Accounts {ar ? "Receivable" : "Payable"}</h1>
            <div style={{ fontSize: 18, color: T.muted }}>{ar ? "Who owes you, how long it's been, and who to call first." : "What you owe, who to pay first, and what the tax law expects."}</div>
          </div>
          <label style={{ position: "relative", width: 360, maxWidth: "100%" }}>
            <span aria-hidden style={{ position: "absolute", left: 22, top: 15, color: T.muted, fontSize: 17 }}>⌕</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={ar ? "Search customers…" : "Search vendors…"} aria-label={ar ? "Search customers" : "Search vendors"}
              style={{ width: "100%", boxSizing: "border-box", height: 58, border: `1px solid ${T.line}`, borderRadius: 999, padding: "0 20px 0 52px", background: T.paper, fontFamily: SERIF, fontSize: 17, color: T.ink, outline: "none" }} />
          </label>
          <Link href={newHref} className="pb-btn" style={{ ...btn("dark"), height: 58, padding: "0 28px", fontSize: 18 }}>+ New {ar ? "invoice" : "bill"}</Link>
        </div>

        {loading ? <div style={{ padding: "4rem", textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 18 }}>Loading {ar ? "receivables" : "payables"}…</div> : <>
          <div className="pb-kpis">
            {kpi(ar ? "Outstanding" : "Net payable", money(total), `${nWord(dues.length, ar ? "customer" : "supplier")} · ${nWord(docs, ar ? "invoice" : "bill")}`, { dark: true })}
            {kpi("Overdue · 90+ days", money(over90), duesTotal ? `${Math.round((over90 / duesTotal) * 1000) / 10}% of ${ar ? "receivables" : "payables"}${!ar && oldest ? `, oldest ${dmy(oldest)}` : ""}` : "Nothing overdue", { red: over90 > 0 })}
            {ar
              ? kpi(`Top ${top2.length} customer${top2.length === 1 ? "" : "s"}`, duesTotal ? `${Math.round((top2.reduce((s, r) => s + r.outstanding, 0) / duesTotal) * 1000) / 10}%` : "—", top2.length ? `${top2.map(r => r.name.split(/\s+/)[0]).join(" + ")} = ${money(top2.reduce((s, r) => s + r.outstanding, 0))}` : "No dues")
              : kpi("Supplier advances (Dr)", money(-advances.reduce((s, r) => s + r.outstanding, 0)), advances.length ? `${nWord(advances.length, "vendor")} in debit — not a payable` : "No vendor in debit", { dashed: true })}
            {kpi(`Avg per ${ar ? "customer" : "supplier"}`, money(dues.length ? duesTotal / dues.length : 0), `Across ${ar ? "customers" : "suppliers"} with dues`)}
          </div>

          <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 22, padding: "28px 30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 28, fontStyle: "italic" }}>Ageing of dues</span>
              <span style={{ fontSize: 16, color: T.muted }}>By {ar ? "invoice" : "bill"} date</span>
            </div>
            <div role="img" aria-label={buckets.map((v, i) => `${LABELS[i]} ${money(v)}`).join(", ")} style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", background: "#EFE8DA", margin: "20px 0 18px" }}>
              {buckets.map((v, i) => duesTotal > 0 && v > 0 ? <span key={i} style={{ width: `${(v / duesTotal) * 100}%`, background: BAR[i] }} /> : null)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
              {buckets.map((v, i) => (
                <div key={i} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: i === 3 && v > 0 ? T.neg : T.muted }}>{LABELS[i]}</div>
                  <div style={{ fontSize: 20, marginTop: 4, color: i === 3 && v > 0 ? T.neg : T.ink, fontVariantNumeric: "tabular-nums" }}>{money(v)}</div>
                </div>
              ))}
            </div>
          </section>

          {notice}

          {ar ? (
            <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 22, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "28px 36px" }}>
                <div style={{ marginRight: "auto" }}>
                  <div style={{ fontSize: 36, fontStyle: "italic" }}>Customers</div>
                  <div style={{ fontSize: 17, color: T.muted, marginTop: 4 }}>Largest balance first · bar shows how much of each customer&apos;s billing is collected</div>
                </div>
                <div className="pb-seg" role="group" aria-label="Filter customers">
                  {([["all", `All ${sortedDues.length}`], ["low", `Barely collected ${low.length}`], ["high", `Mostly collected ${high.length}`]] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="pb-tbl" style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: 17 }}>
                  <thead><tr><th style={{ paddingLeft: 36 }}>Customer</th><th style={{ textAlign: "right" }}>Invoiced</th><th style={{ textAlign: "right" }}>Received</th><th>Collected</th><th style={{ textAlign: "right" }}>Outstanding</th><th /></tr></thead>
                  <tbody>
                    {tableRows.map(r => { const p = pct(r); return (
                      <tr key={r.id ?? r.name}>
                        <td style={{ paddingLeft: 36 }}><div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <span style={{ width: 58, height: 58, flexShrink: 0, borderRadius: 14, background: T.green, color: "#E2C98A", display: "grid", placeItems: "center", fontStyle: "italic", fontSize: 21 }}>{initials(r.name)}</span>
                          <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 20 }}>{r.name}</span><span style={{ fontSize: 15, color: T.muted }}>{nWord(r.count, "invoice")} · oldest {dmy(r.oldest)}</span></span>
                        </div></td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.billed)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.settled)}</td>
                        <td style={{ minWidth: 220 }}><div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                          <span style={{ flex: 1, height: 8, borderRadius: 999, background: "#EFE8DA", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(p ?? 0) * 100}%`, minWidth: p ? 4 : 0, background: (p ?? 0) < 0.5 ? T.neg : T.green, borderRadius: 999 }} /></span>
                          <span style={{ width: 54, textAlign: "right", fontSize: 15, color: T.muted, fontVariantNumeric: "tabular-nums" }}>{p == null ? "—" : `${(p * 100).toFixed(1)}%`}</span>
                        </div></td>
                        <td style={{ textAlign: "right", color: T.neg, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{money(r.outstanding)}</td>
                        <td style={{ paddingRight: 36 }}><div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "flex-end" }}>
                          {r.id && <Link href={`/finance/ledger?account=${r.id}`} style={{ color: T.ink, fontSize: 17 }}>Ledger</Link>}
                          <Link href={`/finance/collect${r.id ? `?account=${r.id}` : ""}`} className="pb-btn" style={btn("line")}>Send reminder</Link>
                        </div></td>
                      </tr>
                    ); })}
                    {!tableRows.length && <tr><td colSpan={6} style={{ padding: "40px 36px", textAlign: "center", color: T.muted }}>{q ? "No customer matches your search." : filter !== "all" ? "No customer in this group." : "Nobody owes you anything right now."}</td></tr>}
                  </tbody>
                  {sortedDues.length > 0 && <tfoot><tr style={{ background: "#F4EFE5", borderTop: `2px solid ${T.green}` }}>
                    <td style={{ paddingLeft: 36, padding: "22px 14px 22px 36px", fontSize: 19 }} colSpan={4}>Total, {nWord(sortedDues.length, "customer")}</td>
                    <td style={{ textAlign: "right", color: T.neg, fontSize: 21, fontVariantNumeric: "tabular-nums" }}>{money(duesTotal)}</td>
                    <td style={{ paddingRight: 36, textAlign: "right" }}><Link href="/finance/collect" className="pb-btn" style={btn("dark")}>Remind all overdue</Link></td>
                  </tr></tfoot>}
                </table>
              </div>
              {advances.length > 0 && <div style={{ padding: "14px 36px", fontSize: 15.5, color: T.muted, borderTop: `1px solid ${T.line}` }}>{nWord(advances.length, "customer")} paid in advance ({money(-advances.reduce((s, r) => s + r.outstanding, 0))}) — shown apart so the total isn&apos;t reduced: {advances.slice(0, 4).map(a => a.name).join(", ")}{advances.length > 4 ? "…" : ""}</div>}
            </section>
          ) : (
            <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 36, fontStyle: "italic" }}>Suppliers</span>
                <span style={{ fontSize: 16, color: T.muted }}>Sorted by oldest due</span>
              </div>
              <div className="pb-cards">
                {sortedDues.filter(match).map(r => { const p = pct(r) ?? 0; const b = bucket(r.days); return (
                  <article key={r.id ?? r.name} className="pb-card" style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 22, padding: "26px 26px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ width: 58, height: 58, flexShrink: 0, borderRadius: 14, background: T.green, color: "#E2C98A", display: "grid", placeItems: "center", fontStyle: "italic", fontSize: 21 }}>{initials(r.name)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 21, lineHeight: 1.25 }}>{r.name}</span><span style={{ fontSize: 15, color: T.muted }}>{nWord(r.count, "bill")} · since {dmy(r.oldest)}</span></span>
                      <span style={{ flexShrink: 0, fontSize: 13.5, padding: "4px 12px", borderRadius: 999, background: b === 3 ? "#FBE9E4" : b === 2 ? "#FBEEDC" : "#F1EADB", color: b === 3 ? T.neg : b === 2 ? "#9A5520" : T.muted, border: `1px solid ${b === 3 ? "#F0CFC5" : T.line}` }}>{LABELS[b]}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                      <span style={{ fontSize: 16.5, color: T.muted }}>Outstanding</span>
                      <span style={{ fontSize: "clamp(24px,2.2vw,32px)", color: b >= 2 ? T.neg : T.ink, fontVariantNumeric: "tabular-nums" }}>{money(r.outstanding)}</span>
                    </div>
                    <span style={{ height: 7, borderRadius: 999, background: "#EFE8DA", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${p * 100}%`, background: T.green }} /></span>
                    <span style={{ fontSize: 15, color: T.muted }}>Paid {money(r.settled)} of {money(r.billed)} billed</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: "auto", paddingTop: 8 }}>
                      {r.id && <Link href={`/finance/ledger?account=${r.id}`} style={{ color: T.ink, fontSize: 17, marginRight: "auto" }}>Ledger</Link>}
                      <Link href={cardHref(r)} className="pb-btn" style={btn("line")}>{cardAction}</Link>
                      {cardExtra?.(r)}
                    </div>
                  </article>
                ); })}
                {advances.filter(match).map(r => (
                  <article key={r.id ?? r.name} style={{ background: "#FBF5E8", border: "1px dashed #D9C79A", borderRadius: 22, padding: "26px 26px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ width: 58, height: 58, flexShrink: 0, borderRadius: 14, background: "#F6E9CC", color: T.goldInk, border: "1px solid #E7D3A6", display: "grid", placeItems: "center", fontStyle: "italic", fontSize: 21 }}>Dr</span>
                      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 21, lineHeight: 1.25 }}>{r.name}</span><span style={{ fontSize: 15, color: T.muted }}>Advance or excess payment</span></span>
                      <span style={{ flexShrink: 0, fontSize: 13.5, padding: "4px 12px", borderRadius: 999, background: "#F6E9CC", color: T.goldInk, border: "1px solid #E7D3A6" }}>Review</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                      <span style={{ fontSize: 16.5, color: T.muted }}>Debit balance</span>
                      <span style={{ fontSize: "clamp(24px,2.2vw,32px)", fontVariantNumeric: "tabular-nums" }}>{money(-r.outstanding)}</span>
                    </div>
                    <span style={{ fontSize: 15, color: T.muted, lineHeight: 1.6 }}>Shown apart from dues so the total payable isn&apos;t negative. Adjust against the next bill or reclassify as an advance.</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: "auto", paddingTop: 8 }}>
                      {r.id && <Link href={`/finance/ledger?account=${r.id}`} style={{ color: T.ink, fontSize: 17, marginRight: "auto" }}>Ledger</Link>}
                      <Link href="/finance/journals/new" className="pb-btn" style={btn("line")}>Adjust advance</Link>
                    </div>
                  </article>
                ))}
                <Link href="/finance/contacts" style={{ minHeight: 240, border: `1px dashed ${T.gold}`, borderRadius: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", color: T.ink }}>
                  <span style={{ fontSize: 30, color: T.gold }}>+</span>
                  <span style={{ fontSize: 19 }}>Add a vendor</span>
                  <span style={{ fontSize: 15, color: T.muted }}>or import vendors from Excel</span>
                </Link>
              </div>
            </section>
          )}
        </>}
      </div>
    </div>
  );
}
