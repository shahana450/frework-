"use client";
// Shelf → GST rack: connect the GST portal with an OTP, then download GSTR-1, GSTR-3B and GSTR-2B for chosen months.
import { useCallback, useEffect, useState } from "react";

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", soft: "#EEF0FA", good: "#0B7A55", goodSoft: "#E3F6EE", bad: "#C2321F", badSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
type Status = { connected: boolean; until: string | null; username: string; gstin: string | null; configured?: boolean; setup_needed?: string };
type Result = { period: string; return: string; ok: boolean; note: string };

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ym(d); };
const monthsAgo = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return ym(d); };

export default function GstPortalDownload({ bizId, onSaved }: { bizId: string; onSaved: () => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [from, setFrom] = useState(monthsAgo(3));
  const [to, setTo] = useState(lastMonth());
  const [kinds, setKinds] = useState<Record<string, boolean>>({ gstr1: true, gstr3b: true, gstr2b: true });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/finance/gst-download?business_id=${bizId}`).then(x => x.json()).catch(() => null);
    if (r) { setSt(r); if (r.username) setUsername(u => u || r.username); }
  }, [bizId]);
  useEffect(() => { if (bizId) void load(); }, [bizId, load]);

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/finance/gst-download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...body }) });
    return { ok: r.ok, d: await r.json().catch(() => ({})) };
  }
  async function sendOtp() {
    setBusy("otp"); setMsg(null);
    const { ok, d } = await post({ action: "otp", username });
    setBusy(""); setMsg({ ok, text: ok ? d.message : d.error ?? "Couldn't send the OTP." });
    if (ok) setOtpSent(true);
  }
  async function verify() {
    setBusy("verify"); setMsg(null);
    const { ok, d } = await post({ action: "verify", otp });
    setBusy("");
    if (!ok) { setMsg({ ok: false, text: d.error ?? "OTP not accepted." }); return; }
    setOtp(""); setOtpSent(false); setMsg({ ok: true, text: "Connected to the GST portal." }); await load();
  }
  async function download() {
    setBusy("fetch"); setMsg(null); setResults([]);
    const { ok, d } = await post({ action: "fetch", from, to, returns: Object.keys(kinds).filter(k => kinds[k]) });
    setBusy("");
    setResults(d.results ?? []);
    if (!ok) { setMsg({ ok: false, text: d.error ?? "Download failed." }); if (d.reconnect) await load(); return; }
    const n = (d.results as Result[] ?? []).filter(r => r.ok).length;
    setMsg({ ok: n > 0, text: n ? `${n} return${n === 1 ? "" : "s"} downloaded and saved on the GST shelf.` : "Nothing was downloaded — see the notes below." });
    if (n) onSaved();
  }

  const box: React.CSSProperties = { background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 14 };
  const input: React.CSSProperties = { height: 42, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 15, color: C.ink, minWidth: 0 };
  const btn = (primary: boolean): React.CSSProperties => ({ height: 42, padding: "0 18px", borderRadius: 10, border: primary ? "none" : `1px solid ${C.line}`, background: primary ? C.navy : "#FFFFFF", color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer" });
  if (!st) return null;
  const connected = st.connected;

  return (
    <section style={box} aria-label="Download returns from the GST portal">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>Download from the GST portal</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>GSTR-1, GSTR-3B and GSTR-2B, saved here by month{st.gstin ? ` · GSTIN ${st.gstin}` : ""}</div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 800, padding: "5px 12px", borderRadius: 999, background: connected ? C.goodSoft : C.soft, color: connected ? C.good : C.muted }}>
          {connected ? `● Connected until ${new Date(st.until!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "Not connected"}
        </span>
      </div>

      {st.setup_needed ? <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, padding: "10px 12px", borderRadius: 10 }}>{st.setup_needed}</div>
        : st.configured === false ? <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, padding: "10px 12px", borderRadius: 10 }}>GST downloads aren&apos;t switched on yet for FreWork. Ask your administrator to add the GSP keys.</div>
        : !st.gstin ? <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, padding: "10px 12px", borderRadius: 10 }}>Add this business&apos;s GSTIN in Business Details to connect.</div>
        : !connected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
              First, on the GST portal: <b>My Profile → Manage API Access → Yes</b> (choose how long). Then enter the portal <b>username</b> here — the OTP comes to the registered mobile. FreWork never asks for the portal password.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input id="gst-username" aria-label="GST portal username" placeholder="GST portal username" value={username} onChange={e => setUsername(e.target.value)} style={{ ...input, flex: "1 1 220px" }} autoComplete="off" />
              <button onClick={sendOtp} disabled={!username.trim() || !!busy} style={btn(!otpSent)}>{busy === "otp" ? "Sending…" : otpSent ? "Resend OTP" : "Send OTP"}</button>
            </div>
            {otpSent && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input id="gst-otp" aria-label="OTP" placeholder="OTP from SMS" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} style={{ ...input, flex: "1 1 160px", letterSpacing: 4, fontWeight: 700 }} autoComplete="one-time-code" />
                <button onClick={verify} disabled={otp.length < 4 || !!busy} style={btn(true)}>{busy === "verify" ? "Checking…" : "Connect"}</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13.5, color: C.muted }}>
              From <input id="gst-from" type="month" value={from} onChange={e => setFrom(e.target.value)} style={input} />
              to <input id="gst-to" type="month" value={to} onChange={e => setTo(e.target.value)} style={input} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["gstr1", "GSTR-1"], ["gstr3b", "GSTR-3B"], ["gstr2b", "GSTR-2B"]].map(([k, l]) => (
                <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: `1px solid ${kinds[k] ? C.navy : C.line}`, background: kinds[k] ? C.soft : "#FFFFFF", fontSize: 13.5, fontWeight: 700, color: C.ink, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!kinds[k]} onChange={e => setKinds(p => ({ ...p, [k]: e.target.checked }))} /> {l}
                </label>
              ))}
              <button onClick={download} disabled={!!busy || !Object.values(kinds).some(Boolean) || from > to} style={{ ...btn(true), marginLeft: "auto" }}>{busy === "fetch" ? "Downloading…" : "⬇ Download"}</button>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted }}>GSTR-2B also comes as an invoice list you can open in Excel. The portal session lasts a few hours; after that, send a new OTP.</div>
          </div>
        )}

      {msg && <div role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg.ok ? C.good : C.bad }}>{msg.text}</div>}
      {results.length > 0 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "auto", maxHeight: 220 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>{results.map((r, i) => (
              <tr key={i} style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <td style={{ padding: "7px 10px", fontWeight: 700 }}>{r.return}</td>
                <td style={{ padding: "7px 10px", color: C.muted }}>{r.period}</td>
                <td style={{ padding: "7px 10px", color: r.ok ? C.good : C.bad }}>{r.ok ? "✓ " : ""}{r.note}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
