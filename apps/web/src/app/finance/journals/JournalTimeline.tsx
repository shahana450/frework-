"use client";
// Journal entries as a timeline: one card per entry, grouped by week, each showing its Dr / Cr lines and what
// needs doing (duplicate number, Tally, AI check). A side panel sums up attention items, Tally and voucher types.
import Link from "next/link";

export type TLine = { account: string; dr: number; cr: number };
export type TJournal = { id: string; entry_no: string; date: string; narration: string; type: string; status: string; total_debit: number; ai_generated: boolean; party_name?: string | null };

const T = { ink: "#10241F", green: "#12352D", gold: "#C9A24A", goldInk: "#9A6B22", cream: "#F4EFE4", paper: "#FFFDF8", line: "#E6DFD0", pos: "#0B7A55", neg: "#B4321F", muted: "#6B7570", look: "#FFF7E3" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const OUT = new Set(["payment", "purchase", "expense", "debit_note"]);
const IN = new Set(["receipt", "sales", "credit_note"]);
const GATEWAY = /\b(razorpay|paytm|phonepe|payu|cashfree|stripe|gateway|settlement)\b/i;
const money = (n: number) => (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const weekOf = (iso: string) => { const d = new Date(iso.slice(0, 10) + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); };

type Props<J extends TJournal> = {
  journals: J[]; lines: Record<string, TLine[]>; labelOf: (t: string) => string;
  dupCount: (no: string) => number; tallyState: (id: string, j: J) => "tally" | "pushed" | "failed" | "ready" | "none";
  selected: Set<string>; toggle: (id: string) => void; selectable: (j: J) => boolean;
  onOpen: (j: J) => void; incomeIds: Set<string>;
};

export function JournalTimeline<J extends TJournal>({ journals, lines, labelOf, dupCount, tallyState, selected, toggle, selectable, onOpen, incomeIds }: Props<J>) {
  const weeks = new Map<string, J[]>();
  for (const j of journals) { const w = weekOf(j.date); weeks.set(w, [...(weeks.get(w) ?? []), j]); }
  const pill = (bg: string, fg: string, border?: string): React.CSSProperties => ({ fontSize: "0.72rem", padding: "2px 10px", borderRadius: 999, background: bg, color: fg, border: `1px solid ${border ?? fg}`, whiteSpace: "nowrap" });
  const btn = (dark = false, danger = false): React.CSSProperties => ({ height: 34, padding: "0 14px", borderRadius: 999, border: `1px solid ${danger ? T.neg : dark ? T.green : T.line}`, background: danger ? T.neg : dark ? T.green : "#FFFFFF", color: danger || dark ? "#FFFFFF" : T.ink, fontFamily: SERIF, fontSize: "0.84rem", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: SERIF, color: T.ink }}>
      {[...weeks].map(([w, list]) => (
        <section key={w} aria-label={`Week of ${w}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontStyle: "italic", color: T.goldInk, fontSize: "0.92rem", marginTop: 6 }}>
            Week of {new Date(w + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
            <span style={{ flex: 1, height: 1, background: "#E2D5B8" }} />
            <span style={{ fontStyle: "normal", fontSize: "0.76rem", color: T.muted }}>{list.length} entr{list.length === 1 ? "y" : "ies"} · ₹{money(list.reduce((s, j) => s + (Number(j.total_debit) || 0), 0))}</span>
          </div>
          {list.map(j => {
            const d = new Date(j.date.slice(0, 10) + "T00:00:00");
            const dir = OUT.has(j.type) ? "out" : IN.has(j.type) ? "in" : "";
            const ls = lines[j.id];
            const dup = dupCount(j.entry_no) > 1;
            const ts = tallyState(j.id, j);
            const gatewayToSales = j.type === "receipt" && GATEWAY.test(j.narration ?? "") && (ls ?? []).some(l => l.cr > 0 && /^sales/i.test(l.account));
            const typeColor = dir === "out" ? T.neg : dir === "in" ? T.pos : "#2F5D8A";
            return (
              <div key={j.id} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr)", gap: 14 }}>
                <div style={{ textAlign: "center", position: "relative" }}>
                  <div style={{ fontSize: "1.6rem", lineHeight: 1 }}>{d.getDate()}</div>
                  <div style={{ fontSize: "0.66rem", letterSpacing: "0.14em", color: T.muted }}>{d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase()}</div>
                  <span aria-hidden="true" style={{ position: "absolute", top: 4, right: -9, width: 11, height: 11, borderRadius: "50%", border: `2px solid ${typeColor}`, background: T.cream }} />
                  <span aria-hidden="true" style={{ position: "absolute", top: 18, right: -4, bottom: -14, width: 1, background: "#E2D5B8" }} />
                </div>
                <article style={{ background: T.paper, border: `1px solid ${dup ? "#EBC3BB" : T.line}`, borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 8px 22px -20px rgba(16,36,31,0.6)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {selectable(j) && <input type="checkbox" aria-label={`Select ${j.entry_no}`} checked={selected.has(j.id)} onChange={() => toggle(j.id)} style={{ marginTop: 4 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: "0.72rem", letterSpacing: "0.12em" }}>
                        <span style={{ color: typeColor }}>{labelOf(j.type).toUpperCase()}</span>
                        <span style={{ color: T.muted, letterSpacing: 0, fontFamily: "'IBM Plex Mono',ui-monospace,monospace" }}>{j.entry_no}</span>
                        {dup && <span style={{ ...pill("#FDECEA", T.neg, "#F3C6BF"), letterSpacing: 0 }}>Duplicate no.</span>}
                      </div>
                      <div style={{ fontSize: "1.15rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration || "—"}{j.party_name ? <span style={{ color: T.muted }}> — {j.party_name}</span> : null}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.3rem", fontVariantNumeric: "tabular-nums" }}>₹{money(Number(j.total_debit))}</div>
                      {dir && <div style={{ fontSize: "0.72rem", fontStyle: "italic", color: typeColor }}>{dir === "out" ? "↑ money out" : "↓ money in"}</div>}
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, padding: "8px 0", display: "flex", flexDirection: "column", gap: 4, fontSize: "0.92rem" }}>
                    {!ls ? <span style={{ fontStyle: "italic", color: T.muted, fontSize: "0.82rem" }}>Loading lines…</span>
                      : ls.map((l, k) => (
                        <div key={k} style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) 110px 110px", gap: 8, alignItems: "baseline" }}>
                          <span style={{ fontSize: "0.68rem", letterSpacing: "0.12em", color: T.muted }}>{l.dr > 0 ? "DR" : "CR"}</span>
                          <span style={{ paddingLeft: l.cr > 0 ? 22 : 0, fontStyle: l.cr > 0 ? "italic" : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.cr > 0 ? "To " : ""}{l.account}</span>
                          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.dr > 0 ? money(l.dr) : ""}</span>
                          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.cr > 0 ? money(l.cr) : ""}</span>
                        </div>
                      ))}
                  </div>
                  {gatewayToSales && <div style={{ fontSize: "0.8rem", fontStyle: "italic", color: T.goldInk, background: T.look, borderRadius: 8, padding: "6px 10px" }}>Gateway payout — usually settles sales already booked. Consider the gateway / customer ledger.</div>}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={pill("#FFFFFF", j.status === "posted" ? T.pos : T.goldInk)}>{j.status === "posted" ? "✓ Posted" : j.status}</span>
                    {ts === "tally" && <span style={pill("#FFFFFF", T.muted)}>From Tally</span>}
                    {ts === "pushed" && <span style={pill("#E3F6EE", T.pos)}>✓ In Tally</span>}
                    {ts === "failed" && <span style={pill("#FDECEA", T.neg)}>⛔ {dup ? "Blocked in Tally" : "Tally failed"}</span>}
                    {ts === "ready" && <span style={pill("#FFFFFF", T.goldInk)}>○ Ready to push</span>}
                    {j.ai_generated && <span style={pill("#FFFFFF", T.goldInk)}>✦ AI{gatewayToSales ? " · check" : ""}</span>}
                    <span style={{ flex: 1 }} />
                    {incomeIds.has(j.id) && <Link href={`/finance/invoices/${j.id}`} style={btn()}>Invoice</Link>}
                    <button onClick={() => onOpen(j)} style={btn(true)}>Open →</button>
                  </div>
                </article>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Right-hand panel: what needs attention, Tally, voucher types and this view's money in / out. */
export function TimelineSide({ journals, all, dupNos, readyN, inTallyN, failedN, tallyOnline, labelOf, gatewayN }: {
  journals: TJournal[]; all: TJournal[]; dupNos: number; readyN: number; inTallyN: number; failedN: number; tallyOnline: boolean; labelOf: (t: string) => string; gatewayN: number;
}) {
  const byType = all.reduce<Record<string, number>>((m, j) => { m[j.type] = (m[j.type] ?? 0) + 1; return m; }, {});
  const max = Math.max(1, ...Object.values(byType));
  const rec = journals.filter(j => IN.has(j.type)).reduce((s, j) => s + (Number(j.total_debit) || 0), 0);
  const pay = journals.filter(j => OUT.has(j.type)).reduce((s, j) => s + (Number(j.total_debit) || 0), 0);
  const box: React.CSSProperties = { background: T.paper, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 };
  const eyebrow: React.CSSProperties = { fontSize: "0.66rem", letterSpacing: "0.18em", color: T.goldInk };
  const dot = (n: number, c: string) => <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: c, color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: "0.72rem", flexShrink: 0 }}>{n}</span>;
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: SERIF, color: T.ink }}>
      {(dupNos > 0 || gatewayN > 0 || readyN > 0) && (
        <div style={box}>
          <div style={eyebrow}>NEEDS ATTENTION</div>
          {dupNos > 0 && <div style={{ display: "flex", gap: 10, fontSize: "0.88rem" }}>{dot(dupNos, T.neg)}<span><b>Duplicate entry numbers.</b> Tally rejects them — ask us to run the renumbering repair.</span></div>}
          {gatewayN > 0 && <div style={{ display: "flex", gap: 10, fontSize: "0.88rem" }}>{dot(gatewayN, T.goldInk)}<span><b>Gateway receipt booked to Sales.</b> Check whether it settles sales already booked.</span></div>}
          {readyN > 0 && <div style={{ display: "flex", gap: 10, fontSize: "0.88rem" }}>{dot(readyN, T.green)}<span><b>Ready to push</b> {tallyOnline ? "to Tally." : "once Tally reconnects."}</span></div>}
        </div>
      )}
      <div style={{ ...box, background: T.green, border: "none", color: "#F4EFE4" }}>
        <div style={{ display: "flex", alignItems: "center" }}><span style={{ fontSize: "1.1rem" }}>Tally Bridge</span><span style={{ marginLeft: "auto", fontSize: "0.72rem", padding: "2px 10px", borderRadius: 999, background: tallyOnline ? "rgba(11,122,85,0.5)" : "rgba(180,50,31,0.55)" }}>● {tallyOnline ? "Online" : "Offline"}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[[inTallyN, "in Tally"], [readyN, "ready"], [failedN, "failed"]].map(([n, l]) => (
            <div key={String(l)} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", color: l === "ready" ? T.gold : l === "failed" ? "#F3A58F" : "#FFFFFF" }}>{n}</div>
              <div style={{ fontSize: "0.7rem", color: "#C9D3CE" }}>{l}</div>
            </div>
          ))}
        </div>
        {!tallyOnline && <div style={{ fontSize: "0.8rem", color: "#C9D3CE" }}>Open Tally with the company loaded and keep the FreWork Tally Bridge running.</div>}
        <Link href="/finance/tally" style={{ alignSelf: "flex-start", height: 36, padding: "0 16px", borderRadius: 999, background: T.gold, color: T.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: "0.86rem" }}>{tallyOnline ? "Tally page →" : "Set up Tally →"}</Link>
      </div>
      <div style={box}>
        <div style={eyebrow}>BY VOUCHER TYPE</div>
        {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
          <div key={t} style={{ display: "grid", gridTemplateColumns: "84px 1fr 28px", gap: 8, alignItems: "center", fontSize: "0.86rem" }}>
            <span>{labelOf(t)}</span>
            <span style={{ height: 5, borderRadius: 999, background: "#EDE6D6" }}><span style={{ display: "block", width: `${(n / max) * 100}%`, height: "100%", borderRadius: 999, background: T.green }} /></span>
            <span style={{ textAlign: "right", color: T.muted }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={box}>
        <div style={eyebrow}>THIS VIEW</div>
        {[["Receipts", rec, T.pos], ["Payments", pay, T.neg]].map(([l, v, c]) => <div key={String(l)} style={{ display: "flex", fontSize: "0.9rem" }}><span>{l}</span><span style={{ marginLeft: "auto", color: String(c), fontVariantNumeric: "tabular-nums" }}>{money(Number(v))}</span></div>)}
        <div style={{ display: "flex", fontSize: "0.92rem", borderTop: `1px solid ${T.line}`, paddingTop: 6 }}><span>Net</span><span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", borderBottom: `2px solid ${T.gold}` }}>{money(rec - pay)}</span></div>
      </div>
    </aside>
  );
}
