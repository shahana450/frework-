"use client";
// Shelf → Income Tax / Notices racks: fetch notices, 26AS, AIS, TIS and filed returns live from the Income-tax portal.
// The PAN, password and OTP are typed each time and stored nowhere; the password field is cleared as soon as it's sent.
import { useEffect, useState } from "react";

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#1F5EFF", deep: "#232A63", soft: "#EAF2FF", good: "#0B7A55", goodSoft: "#E3F6EE", bad: "#C2321F", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const ITEMS: [string, string, string][] = [
  ["notices", "Notices", "e-Proceedings, Worklist, outstanding demand"],
  ["26as", "Form 26AS", "Tax credit statement (TRACES)"],
  ["ais", "AIS", "Annual Information Statement"],
  ["tis", "TIS", "Taxpayer Information Summary"],
  ["filed_returns", "Filed returns", "ITR list with status"],
];
const fyNow = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y - 1}-${String(y).slice(2)}`; };

export default function ItPortalFetch({ bizId, onSaved }: { bizId: string; onSaved: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pan, setPan] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState("");
  const [state, setState] = useState<"" | "otp_required" | "logged_in">("");
  const [otp, setOtp] = useState("");
  const [items, setItems] = useState<Record<string, boolean>>({ notices: true, "26as": true, ais: true, tis: true, filed_returns: false });
  const [fy, setFy] = useState(fyNow());
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<{ item: string; ok: boolean; note: string }[]>([]);
  const [shot, setShot] = useState<string | null>(null);

  useEffect(() => { fetch("/api/finance/it-fetch").then(r => r.json()).then(d => setConfigured(!!d.configured)).catch(() => setConfigured(false)); }, []);

  async function call(body: Record<string, unknown>) {
    const r = await fetch("/api/finance/it-fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...body }) });
    return { ok: r.ok, d: await r.json().catch(() => ({})) };
  }
  async function start() {
    setBusy("start"); setMsg(null); setShot(null); setReport([]);
    const pw = password; setPassword("");                      // cleared from the page straight away
    const { ok, d } = await call({ action: "start", pan, password: pw, consent });
    setBusy("");
    if (!ok) { setMsg({ ok: false, text: d.error ?? "Login failed." }); setShot(d.screenshot ?? null); return; }
    setSession(d.session); setState(d.state);
    setMsg({ ok: true, text: d.state === "otp_required" ? "The portal sent an OTP to the registered mobile / email. Enter it below." : "Logged in to the Income-tax portal." });
  }
  async function sendOtp() {
    setBusy("otp"); setMsg(null); setShot(null);
    const { ok, d } = await call({ action: "otp", session, otp });
    setBusy("");
    if (!ok) { setMsg({ ok: false, text: d.error ?? "OTP not accepted." }); setShot(d.screenshot ?? null); return; }
    setOtp(""); setState("logged_in"); setMsg({ ok: true, text: "Logged in. Choose what to fetch." });
  }
  async function fetchDocs() {
    setBusy("fetch"); setMsg(null); setShot(null);
    const { ok, d } = await call({ action: "fetch", session, items: Object.keys(items).filter(k => items[k]), fy });
    setBusy("");
    if (!ok) { setMsg({ ok: false, text: d.error ?? "Fetch failed." }); setShot(d.screenshot ?? null); return; }
    setReport(d.report ?? []); setShot(d.screenshots?.[0] ?? null);
    setMsg({ ok: d.saved > 0, text: d.saved ? `${d.saved} document${d.saved === 1 ? "" : "s"} saved on the Shelf.` : "Nothing was saved — see the notes below." });
    if (d.saved) onSaved();
    await close(false);
  }
  async function close(say = true) {
    if (session) await call({ action: "close", session });
    setSession(""); setState("");
    if (say) setMsg({ ok: true, text: "Logged out of the portal." });
  }

  const input: React.CSSProperties = { height: 42, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 15, color: C.ink, minWidth: 0 };
  const btn = (p: boolean): React.CSSProperties => ({ height: 42, padding: "0 18px", borderRadius: 10, border: p ? "none" : `1px solid ${C.line}`, background: p ? C.deep : "#FFFFFF", color: p ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer" });
  if (configured === null) return null;

  return (
    <section aria-label="Fetch from the Income-tax portal" style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 14, position: "relative", overflow: "hidden" }}>
      <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: C.navy }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>Fetch from the Income-tax portal</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Notices, Form 26AS, AIS, TIS and filed returns — saved on the Shelf</div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 800, padding: "5px 12px", borderRadius: 999, background: state === "logged_in" ? C.goodSoft : C.soft, color: state === "logged_in" ? C.good : C.navy }}>
          {state === "logged_in" ? "● Logged in" : state === "otp_required" ? "Waiting for OTP" : "🔒 Nothing stored"}
        </span>
      </div>

      {!configured ? <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, padding: "10px 12px", borderRadius: 10 }}>The Income-tax portal link isn&apos;t switched on yet. Your administrator needs to start FreWork&apos;s portal worker.</div>
        : !state ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <input id="it-pan" aria-label="PAN" placeholder="PAN (user ID)" value={pan} onChange={e => setPan(e.target.value.toUpperCase().slice(0, 10))} style={{ ...input, letterSpacing: 1.5, fontWeight: 700 }} autoComplete="off" />
              <input id="it-password" aria-label="Income-tax portal password" type="password" placeholder="Income-tax portal password" value={password} onChange={e => setPassword(e.target.value)} style={input} autoComplete="off" />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              I am this taxpayer, or authorised by them, to access their Income-tax account. The password is used once for this login and is not stored.
            </label>
            <div><button onClick={start} disabled={!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan) || !password || !consent || !!busy} style={btn(true)}>{busy === "start" ? "Opening the portal…" : "Log in to the portal"}</button></div>
          </div>
        ) : state === "otp_required" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input id="it-otp" aria-label="OTP" placeholder="OTP" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ ...input, flex: "1 1 160px", letterSpacing: 4, fontWeight: 700 }} autoComplete="one-time-code" />
            <button onClick={sendOtp} disabled={otp.length < 6 || !!busy} style={btn(true)}>{busy === "otp" ? "Checking…" : "Submit OTP"}</button>
            <button onClick={() => close()} style={btn(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              {ITEMS.map(([k, l, h]) => (
                <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${items[k] ? C.navy : C.line}`, background: items[k] ? C.soft : "#FFFFFF", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!items[k]} onChange={e => setItems(p => ({ ...p, [k]: e.target.checked }))} style={{ marginTop: 3 }} />
                  <span><b style={{ fontSize: 14, color: C.ink }}>{l}</b><br /><span style={{ fontSize: 12, color: C.muted }}>{h}</span></span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13.5, color: C.muted }}>
              Financial year for 26AS / AIS / TIS
              <select value={fy} onChange={e => setFy(e.target.value)} style={{ ...input, height: 38 }}>
                {[0, 1, 2, 3].map(n => { const y = Number(fyNow().slice(0, 4)) - n; const v = `${y}-${String(y + 1).slice(2)}`; return <option key={v} value={v}>FY {v}</option>; })}
              </select>
              <button onClick={fetchDocs} disabled={!!busy || !Object.values(items).some(Boolean)} style={{ ...btn(true), marginLeft: "auto" }}>{busy === "fetch" ? "Fetching… (up to a few minutes)" : "⬇ Fetch now"}</button>
              <button onClick={() => close()} style={btn(false)}>Log out</button>
            </div>
          </div>
        )}

      {msg && <div role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg.ok ? C.good : C.bad }}>{msg.text}</div>}
      {report.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.ink, display: "flex", flexDirection: "column", gap: 4 }}>
          {report.map((r, i) => <li key={i} style={{ color: r.ok ? C.good : C.warn }}><b>{r.item.toUpperCase()}</b> — {r.note}</li>)}
        </ul>
      )}
      {shot && (
        <details style={{ fontSize: 12.5, color: C.muted }}>
          <summary style={{ cursor: "pointer" }}>Show what the portal displayed (to share with support)</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${shot}`} alt="Portal screen at the failed step" style={{ marginTop: 8, maxWidth: "100%", borderRadius: 10, border: `1px solid ${C.line}` }} />
        </details>
      )}
      <div style={{ fontSize: 12, color: C.muted }}>AIS / TIS PDFs open with the PAN in small letters plus date of birth (ddmmyyyy); 26AS uses the date of birth.</div>
    </section>
  );
}
