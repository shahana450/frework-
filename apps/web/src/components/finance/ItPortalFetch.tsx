"use client";
// Shelf → Income Tax / Notices: one button fetches notices, 26AS, AIS, TIS and filed returns from the Income-tax portal.
// Flow: PAN (+ password, or the remembered one) → OTP if the portal asks → the fetch starts by itself and runs in the
// background on FreWork's worker; documents land on the Shelf even if this page is closed.
import { useCallback, useEffect, useRef, useState } from "react";

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", blue: "#1F5EFF", deep: "#232A63", soft: "#EAF2FF", good: "#0B7A55", goodSoft: "#E3F6EE", bad: "#C2321F", badSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const ITEMS: [string, string][] = [["notices", "Notices"], ["26as", "26AS"], ["ais", "AIS"], ["tis", "TIS"], ["filed_returns", "Filed returns"]];
const fyNow = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y - 1}-${String(y).slice(2)}`; };
type Phase = "form" | "working" | "otp" | "running" | "done";
type Report = { item: string; ok: boolean; note: string }[];

export default function ItPortalFetch({ bizId, onSaved }: { bizId: string; onSaved: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [savedPans, setSavedPans] = useState<string[]>([]);
  const [setupMsg, setSetupMsg] = useState("");
  const [pan, setPan] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [consent, setConsent] = useState(false);
  const [items, setItems] = useState<Record<string, boolean>>({ notices: true, "26as": true, ais: true, tis: true, filed_returns: false });
  const [fy, setFy] = useState(fyNow());
  const [phase, setPhase] = useState<Phase>("form");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [session, setSession] = useState("");
  const [otp, setOtp] = useState("");
  const [saved, setSaved] = useState(0);
  const [report, setReport] = useState<Report>([]);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobKey = `fw_it_job_${bizId}`;
  const hasSaved = savedPans.includes(pan);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/finance/it-fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...body }) });
    return { ok: r.ok, d: await r.json().catch(() => ({})) };
  }, [bizId]);

  const watch = useCallback((id: string) => {
    if (poll.current) clearInterval(poll.current);
    setPhase("running");
    const tick = async () => {
      const d = await fetch(`/api/finance/it-fetch?business_id=${bizId}&job=${id}`).then(r => r.json()).catch(() => null);
      if (!d) return;
      if (d.error) { if (poll.current) clearInterval(poll.current); try { localStorage.removeItem(jobKey); } catch { /* */ } setPhase("form"); return; }
      setSaved(d.saved ?? 0);
      if (d.status === "running") return;
      if (poll.current) clearInterval(poll.current);
      try { localStorage.removeItem(jobKey); } catch { /* */ }
      setReport(d.report ?? []); setShot(d.screenshot ?? null); setPhase("done");
      if (d.saved) onSaved();
    };
    void tick();
    poll.current = setInterval(tick, 4000);
  }, [bizId, jobKey, onSaved]);

  useEffect(() => {
    fetch(`/api/finance/it-fetch?business_id=${bizId}`).then(r => r.json()).then(d => {
      setConfigured(!!d.configured); setSavedPans(d.saved ?? []); setSetupMsg(d.setup_needed ?? "");
      if ((d.saved ?? []).length === 1) setPan(p => p || d.saved[0]);
    }).catch(() => setConfigured(false));
    try { const id = localStorage.getItem(jobKey); if (id) watch(id); } catch { /* */ }
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [bizId, jobKey, watch]);

  const fail = (d: { error?: string; screenshot?: string | null }, fallback: string) => {
    setError(d.error ?? fallback); setShot(d.screenshot ?? null); setPhase("form"); setStatus("");
  };

  async function startFetch(sess: string) {
    setStatus("Starting the download…");
    const { ok, d } = await call({ action: "fetch", session: sess, items: Object.keys(items).filter(k => items[k]), fy });
    if (!ok) return fail(d, "The download didn't start.");
    try { localStorage.setItem(jobKey, d.job); } catch { /* */ }
    setSaved(0); watch(d.job);
  }

  async function go() {
    setError(""); setShot(null); setReport([]); setPhase("working"); setStatus("Logging in to the Income-tax portal…");
    const pw = password; setPassword("");
    const { ok, d } = await call({ action: "start", pan, password: pw, consent, remember: remember && !!pw });
    if (!ok) return fail(d, "Login failed.");
    if (remember && pw && !d.warning) setSavedPans(p => [...new Set([...p, pan])]);
    setSession(d.session);
    if (d.state === "otp_required") { setPhase("otp"); setStatus(""); return; }
    await startFetch(d.session);
  }

  async function sendOtp() {
    setError(""); setPhase("working"); setStatus("Checking the OTP…");
    const { ok, d } = await call({ action: "otp", session, otp });
    setOtp("");
    if (!ok) return fail(d, "The portal didn't accept that OTP.");
    await startFetch(session);
  }

  async function forget() {
    await call({ action: "forget", pan });
    setSavedPans(p => p.filter(x => x !== pan));
  }

  if (configured === null) return null;
  const input: React.CSSProperties = { height: 44, borderRadius: 12, border: `1px solid ${C.line}`, padding: "0 14px", fontSize: 15, color: C.ink, minWidth: 0, width: "100%", boxSizing: "border-box" };
  const primary: React.CSSProperties = { height: 46, padding: "0 22px", borderRadius: 12, border: "none", background: C.deep, color: "#FFFFFF", fontWeight: 800, fontSize: 15, cursor: "pointer" };
  const canGo = /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) && (!!password || hasSaved) && consent && Object.values(items).some(Boolean);

  return (
    <section aria-label="Fetch from the Income-tax portal" style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>Get documents from the Income-tax portal</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Notices, 26AS, AIS, TIS — saved on the Shelf automatically</div>
      </div>

      {!configured ? <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, padding: "10px 12px", borderRadius: 10 }}>The Income-tax portal link isn&apos;t switched on yet.</div>

      : phase === "running" || phase === "done" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: phase === "running" ? C.soft : saved ? C.goodSoft : C.warnSoft }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>{phase === "running" ? "⏳" : saved ? "✅" : "⚠️"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: phase === "running" ? C.deep : saved ? C.good : C.warn }}>
                {phase === "running" ? `Downloading… ${saved} saved so far` : saved ? `Done — ${saved} document${saved === 1 ? "" : "s"} saved` : "Finished — nothing was saved"}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{phase === "running" ? "This runs on our server. You can leave this page — documents still arrive on the Shelf." : "See the notes below."}</div>
            </div>
            <button onClick={() => { if (poll.current) clearInterval(poll.current); try { localStorage.removeItem(jobKey); } catch { /* */ } setShot(null); setPhase("form"); }} style={{ border: `1px solid ${C.line}`, background: "#FFFFFF", borderRadius: 10, height: 36, padding: "0 14px", fontWeight: 700, cursor: "pointer", color: C.ink }}>{phase === "running" ? "Hide" : "Fetch again"}</button>
          </div>
          {report.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
              {report.map((r, i) => <li key={i} style={{ color: r.ok ? C.good : C.warn }}><b>{r.item.toUpperCase()}</b> — {r.note}</li>)}
            </ul>
          )}
        </div>
      )

      : phase === "otp" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, color: C.ink }}>The portal sent an OTP to the registered mobile / email. Enter it and the download starts.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input id="it-otp" aria-label="OTP" placeholder="6-digit OTP" inputMode="numeric" autoFocus value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => { if (e.key === "Enter" && otp.length === 6) void sendOtp(); }} style={{ ...input, flex: "0 1 220px", letterSpacing: 6, fontWeight: 800, fontSize: 18 }} autoComplete="one-time-code" />
            <button onClick={sendOtp} disabled={otp.length < 6} style={{ ...primary, opacity: otp.length < 6 ? 0.5 : 1 }}>Continue</button>
          </div>
        </div>
      )

      : phase === "working" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: C.soft, color: C.deep, fontWeight: 700 }}>
          <span aria-hidden="true">⏳</span>{status}
        </div>
      )

      : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            <input id="it-pan" aria-label="PAN" placeholder="PAN" value={pan} onChange={e => setPan(e.target.value.toUpperCase().slice(0, 10))} style={{ ...input, letterSpacing: 1.5, fontWeight: 700 }} autoComplete="off" />
            <input id="it-password" aria-label="Income-tax portal password" type="password" placeholder={hasSaved ? "Saved password will be used" : "Portal password"} value={password} onChange={e => setPassword(e.target.value)} style={input} autoComplete="off" />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {ITEMS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setItems(p => ({ ...p, [k]: !p[k] }))} aria-pressed={!!items[k]}
                style={{ height: 34, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${items[k] ? C.blue : C.line}`, background: items[k] ? C.soft : "#FFFFFF", color: items[k] ? C.blue : C.muted, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{items[k] ? "✓ " : ""}{l}</button>
            ))}
            <select id="it-fy" aria-label="Financial year" value={fy} onChange={e => setFy(e.target.value)} style={{ height: 34, borderRadius: 999, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 13, fontWeight: 700, color: C.ink, background: "#FFFFFF", marginLeft: "auto" }}>
              {[0, 1, 2, 3].map(n => { const y = Number(fyNow().slice(0, 4)) - n; const v = `${y}-${String(y + 1).slice(2)}`; return <option key={v} value={v}>FY {v}</option>; })}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.ink }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I am this taxpayer, or authorised by them.</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember the password (encrypted)
              {hasSaved && <button type="button" onClick={forget} style={{ border: "none", background: "none", color: C.bad, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>· Forget it</button>}
            </label>
          </div>
          <div><button onClick={go} disabled={!canGo} style={{ ...primary, opacity: canGo ? 1 : 0.5, cursor: canGo ? "pointer" : "default" }}>⬇ Fetch documents</button></div>
          {setupMsg && <div style={{ fontSize: 12.5, color: C.warn }}>{setupMsg}</div>}
        </div>
      )}

      {error && <div role="alert" style={{ fontSize: 13.5, fontWeight: 700, color: C.bad, background: C.badSoft, padding: "10px 12px", borderRadius: 10 }}>{error}</div>}
      {shot && (
        <details style={{ fontSize: 12.5, color: C.muted }}>
          <summary style={{ cursor: "pointer" }}>Show what the portal displayed</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${shot}`} alt="Portal screen at the failed step" style={{ marginTop: 8, maxWidth: "100%", borderRadius: 10, border: `1px solid ${C.line}` }} />
        </details>
      )}
    </section>
  );
}
