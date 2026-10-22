"use client";
// File GSTR-1 on the GST portal from FreBook: prepare (save + proceed, then the portal's own summary next to ours) →
// EVC OTP to the authorised signatory → File. Filing can't be undone, so the last step needs a tick and the OTP.
import { useState } from "react";
import Link from "next/link";
import type { Gstr1 } from "@/lib/gstr1";
import type { Gstr1Summary } from "@/lib/gstTaxpayer";

const C = { line: "#E1E4EE", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Step = "start" | "preparing" | "review" | "otp" | "filing" | "filed";

export default function Gstr1FilePanel({ bizId, month, monthLabel, ours, blocked }: { bizId: string; month: string; monthLabel: string; ours: Gstr1["totals"]; blocked: number }) {
  const [step, setStep] = useState<Step>("start");
  const [err, setErr] = useState("");
  const [portalErrors, setPortalErrors] = useState<unknown>(null);
  const [reconnect, setReconnect] = useState(false);
  const [summary, setSummary] = useState<Gstr1Summary | null>(null);
  const [pan, setPan] = useState("");
  const [otp, setOtp] = useState("");
  const [sure, setSure] = useState(false);
  const [arn, setArn] = useState("");

  const call = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/finance/gst-file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, month, ...body }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error ?? "That didn't go through."); setReconnect(!!d.reconnect); setPortalErrors(d.portal_errors ?? null); }
    return r.ok ? d : null;
  };

  async function prepare() {
    setErr(""); setPortalErrors(null); setStep("preparing");
    const d = await call({ action: "prepare" });
    if (!d) { setStep("start"); return; }
    setSummary(d.summary); setStep("review");
  }
  async function sendOtp() {
    setErr("");
    if (await call({ action: "otp", pan })) setStep("otp");
  }
  async function file() {
    setErr(""); setStep("filing");
    const d = await call({ action: "file", pan, otp, confirm: true });
    setOtp("");
    if (!d) { setStep("otp"); return; }
    setArn(d.arn ?? ""); setStep("filed");
  }

  // The portal's figures next to FreBook's, by section
  const ourBy = new Map(ours.map(t => [t.section.toUpperCase().replace(/[^A-Z]/g, ""), t]));
  const portalRows = (summary?.sec_sum ?? []).filter(s => (s.ttl_rec ?? 0) > 0 || (s.ttl_val ?? 0) > 0);
  const input: React.CSSProperties = { height: 40, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 14, color: C.ink };
  const primary: React.CSSProperties = { height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: "pointer" };

  return (
    <section aria-label="File GSTR-1 on the GST portal" style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 15 }}>File on the GST portal</b>
        <span style={{ fontSize: 12.5, color: C.muted }}>Straight from FreBook — no JSON upload. Needs the portal connected (OTP) and the signatory&apos;s EVC OTP.</span>
      </div>

      {step === "filed" ? (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: C.posSoft, color: C.pos, fontWeight: 700 }}>
          ✅ GSTR-1 for {monthLabel} filed.{arn ? <> ARN <span style={{ fontFamily: MONO }}>{arn}</span>.</> : " The ARN will show once the portal confirms it."} It now shows as Filed ✓ on your home page.
        </div>
      ) : step === "start" || step === "preparing" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={prepare} disabled={step === "preparing" || blocked > 0} style={{ ...primary, opacity: step === "preparing" || blocked > 0 ? 0.5 : 1 }}>
            {step === "preparing" ? "Uploading to the portal…" : "1. Upload to the portal & get its summary"}
          </button>
          <span style={{ fontSize: 12.5, color: C.muted }}>{blocked > 0 ? `Fix the ${blocked} problem${blocked === 1 ? "" : "s"} above first.` : "Saves the return as a draft on the portal. Nothing is filed yet."}</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>2. Check the portal&apos;s summary — this is what will be filed</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              <thead><tr style={{ background: "#F7F8FC", color: C.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {["Section", "Docs", "Portal value", "Portal tax", "FreBook value", ""].map((h, i) => <th key={i} style={{ padding: "8px 12px", textAlign: i < 2 ? "left" : "right" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {portalRows.length === 0 ? <tr><td colSpan={6} style={{ padding: 12, color: C.muted }}>Nil return — no outward supplies for {monthLabel}.</td></tr>
                  : portalRows.map(s => {
                    const ourT = ourBy.get(s.sec_nm.toUpperCase().replace(/[^A-Z]/g, ""));
                    const match = !ourT || Math.abs((ourT.taxable ?? 0) - (s.ttl_val ?? 0)) < 1;
                    return (
                      <tr key={s.sec_nm} style={{ borderTop: `1px solid ${C.line}` }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>{s.sec_nm}</td>
                        <td style={{ padding: "8px 12px" }}>{s.ttl_rec ?? 0}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: MONO }}>{fmt(s.ttl_val)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: MONO }}>{fmt(s.ttl_tax ?? (s.ttl_igst ?? 0) + (s.ttl_cgst ?? 0) + (s.ttl_sgst ?? 0))}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: MONO, color: C.muted }}>{ourT ? fmt(ourT.taxable) : "—"}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{ourT && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: match ? C.posSoft : C.warnSoft, color: match ? C.pos : C.warn }}>{match ? "Matches" : "Differs"}</span>}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>3. File with EVC</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input id="gst-pan" aria-label="Authorised signatory PAN" placeholder="Signatory PAN" value={pan} onChange={e => setPan(e.target.value.toUpperCase().slice(0, 10))} style={{ ...input, width: 160, letterSpacing: 1, fontWeight: 700 }} autoComplete="off" />
            <button onClick={sendOtp} disabled={!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)} style={{ ...primary, background: "#FFFFFF", color: C.primary, border: `1px solid ${C.primary}`, opacity: /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ? 1 : 0.5 }}>{step === "otp" ? "Send again" : "Send EVC OTP"}</button>
            {step !== "review" && <input id="gst-evc" aria-label="EVC OTP" inputMode="numeric" placeholder="6-digit OTP" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ ...input, width: 140, letterSpacing: 4, fontWeight: 800 }} autoComplete="one-time-code" />}
          </div>
          {step !== "review" && (
            <>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
                <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} style={{ marginTop: 3 }} />
                I have checked the portal&apos;s summary above. File GSTR-1 for {monthLabel} — once filed it can&apos;t be changed (corrections go in a later month&apos;s amendment).
              </label>
              <div><button onClick={file} disabled={!sure || otp.length !== 6 || step === "filing"} style={{ ...primary, background: C.pos, opacity: !sure || otp.length !== 6 || step === "filing" ? 0.5 : 1 }}>{step === "filing" ? "Filing…" : `File GSTR-1 for ${monthLabel}`}</button></div>
            </>
          )}
        </>
      )}

      {err && (
        <div role="alert" style={{ padding: "10px 12px", borderRadius: 10, background: C.negSoft, color: C.neg, fontSize: 13.5, fontWeight: 600 }}>
          {err} {reconnect && <Link href="/finance/shelf?rack=gst" style={{ color: C.primary }}>Connect the portal →</Link>}
          {portalErrors != null && <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11.5, fontWeight: 400, color: C.ink, maxHeight: 220, overflow: "auto" }}>{JSON.stringify(portalErrors, null, 2)}</pre>}
        </div>
      )}
    </section>
  );
}
