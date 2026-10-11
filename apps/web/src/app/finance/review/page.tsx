"use client";
// Entries held for review — e.g. a sale or purchase of a GST-registered business with no GST line. Check, then post anyway or discard.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";

const C = { bg: "#F6F1E7", ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", card: "#FFFFFF", forest: "#0F2B25", pos: "#0B7A55", posSoft: "#E3F6EE", amber: "#8A5A00", amberSoft: "#FFF4DB", neg: "#C2321F", negSoft: "#FDECEA" };
const SERIF = "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const inr = (x: number) => "₹" + (x || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
type Entry = { id: string; date: string; type: string; narration: string | null; party_name: string | null; amount: number; reasons: string[]; lines: { account: string; dr: number; cr: number }[] };

export default function ReviewQueue() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/finance/journals/review?business_id=${encodeURIComponent(id)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't load the list." }); setEntries([]); return; }
    setEntries(d.entries ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved); load(saved);
    });
  }, [router, load]);

  async function act(e: Entry, action: "post" | "discard") {
    if (action === "discard" && !confirm("Discard this draft? It was never in your books.")) return;
    setBusy(e.id); setMsg(null);
    const r = await fetch("/api/finance/journals/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, id: e.id, action }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Something went wrong." }); return; }
    setMsg({ ok: true, text: action === "post" ? `Posted as ${d.entry_no}.` : "Draft discarded." });
    setEntries(list => (list ?? []).filter(x => x.id !== e.id));
  }

  const btn = (primary: boolean, disabled: boolean): React.CSSProperties => ({ height: 38, padding: "0 14px", borderRadius: 10, border: primary ? "none" : `1px solid ${C.line}`, background: primary ? C.forest : C.card, color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 13.5, cursor: disabled ? "wait" : "pointer", opacity: disabled ? 0.6 : 1 });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 100px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontFamily: SERIF }}>Waiting for review</h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 14.5, lineHeight: 1.55, maxWidth: 640 }}>
            These entries were saved as drafts, not posted, because something looked off — for example a sale with no GST line. They are not in your books yet. Check each one: post it if it is right (say, an exempt sale), or discard it and enter it again.
          </p>
        </div>
        {msg && <div role="status" style={{ background: msg.ok ? C.posSoft : C.negSoft, color: msg.ok ? C.pos : C.neg, borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 13.5 }}>{msg.text}</div>}
        {entries === null ? <div style={{ color: C.muted }}>Loading…</div>
          : entries.length === 0 ? <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22, color: C.muted }}>Nothing waiting. Every entry has been posted.</div>
          : entries.map(e => (
            <section key={e.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                <b style={{ fontFamily: MONO, fontSize: 13 }}>{e.date}</b>
                <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>{e.type.replace(/_/g, " ")}</span>
                <span style={{ flex: 1, minWidth: 160 }}>{e.narration || e.party_name || "—"}</span>
                <b style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{inr(e.amount)}</b>
              </div>
              {e.reasons.map(r => <div key={r} style={{ background: C.amberSoft, color: C.amber, borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 600 }}>{r}</div>)}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
                  <thead><tr style={{ color: C.muted, textAlign: "left" }}><th style={{ padding: "4px 0", fontWeight: 700 }}>Ledger</th><th style={{ textAlign: "right", fontWeight: 700 }}>Debit</th><th style={{ textAlign: "right", fontWeight: 700 }}>Credit</th></tr></thead>
                  <tbody>{e.lines.map((l, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: "6px 0" }}>{l.account}</td>
                      <td style={{ textAlign: "right", fontFamily: MONO }}>{l.dr ? inr(l.dr) : ""}</td>
                      <td style={{ textAlign: "right", fontFamily: MONO }}>{l.cr ? inr(l.cr) : ""}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => act(e, "post")} disabled={!!busy} style={btn(true, busy === e.id)}>It's correct — post it</button>
                <a href={`/finance/journals/${e.id}/edit`} style={{ ...btn(false, false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Edit</a>
                <button onClick={() => act(e, "discard")} disabled={!!busy} style={{ ...btn(false, busy === e.id), color: C.neg }}>Discard</button>
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
