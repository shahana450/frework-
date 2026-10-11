"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Link = { portal: "gst" | "it"; identifier: string; provider: string; status: string; expires_at: string | null; last_sync_at: string | null; last_error: string | null };
type Row = { portal: string; kind: string; form: string; period: string; status: string; arn: string | null; filed_on: string | null; amount: number | null; details: Record<string, unknown>; demo: boolean; fetched_at: string };
type Data = { links: Link[]; statuses: Row[]; defaults?: { gstin: string; pan: string }; providers?: { gst: { id: string; demo: boolean; credential?: "otp" | "password" }; it: { id: string; demo: boolean; credential?: "otp" | "password" } }; setup_needed?: string };

const C = { ground: "#F2F3F6", tile: "#FFFFFF", grey: "#ECEEF3", line: "#E3E6EE", ink: "#141A3A", muted: "#5A6080", navy: "#232A63", navySoft: "#E6E8F4", orange: "#C2410C", orangeSoft: "#FFF0E8", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const day = (d: string | null) => d ? new Date(d.length > 10 ? d : d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const monthLabel = (p: string) => /^\d{4}-\d{2}$/.test(p) ? new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : p;
const inr = (n: number | null) => n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN");

function Chip({ s }: { s: string }) {
  const map: Record<string, [string, string, string]> = {
    filed: [C.posSoft, C.pos, "Filed"], e_verified: [C.posSoft, C.pos, "E-verified"], processed: [C.posSoft, C.pos, "Processed"], issued: [C.posSoft, C.pos, "Refund issued"],
    not_filed: [C.warnSoft, C.warn, "Not filed"], pending: [C.warnSoft, C.warn, "Pending"], balance: [C.navySoft, C.navy, "Balance"],
  };
  const [bg, fg, t] = map[s] ?? [C.grey, C.muted, s.replace(/_/g, " ")];
  return <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: bg, color: fg, whiteSpace: "nowrap" }}>{t}</span>;
}

function PortalCard({ portal, data, bizId, reload }: { portal: "gst" | "it"; data: Data; bizId: string; reload: () => void }) {
  const link = data.links.find(l => l.portal === portal);
  const prov = data.providers?.[portal];
  const [identifier, setIdentifier] = useState(link?.identifier ?? (portal === "gst" ? data.defaults?.gstin : data.defaults?.pan) ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const usesPassword = prov?.credential === "password";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const call = async (action: string, extra: Record<string, string> = {}) => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/finance/portals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, portal, action, ...extra }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setPassword("");
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Something went wrong." }); return; }
    setMsg({ ok: true, text: action === "start" ? d.message : action === "verify" ? `Linked · ${d.synced} statuses fetched` : action === "sync" ? `Updated · ${d.synced} statuses` : "Unlinked." });
    setOtp(""); setPassword(""); setConsent(false); reload();
  };
  const title = portal === "gst" ? "GST portal" : "Income-tax portal";
  const idLabel = portal === "gst" ? "GSTIN" : "PAN";
  const rows = data.statuses.filter(s => s.portal === portal);
  const btn = (primary: boolean): React.CSSProperties => ({ height: 42, padding: "0 16px", borderRadius: 11, border: primary ? "none" : `1px solid #C9CEDF`, background: primary ? C.navy : C.tile, color: primary ? "#FFFFFF" : C.ink, fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 });

  return (
    <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        {link?.status === "linked" ? <Chip s="filed" /> : null}
        {link?.status === "linked" && <span style={{ fontSize: 12.5, color: C.muted }}>Linked {idLabel} <b style={{ fontFamily: MONO }}>{link.identifier}</b></span>}
        {prov?.demo && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 6, background: C.orangeSoft, color: C.orange }}>DEMO DATA</span>}
      </div>
      {prov?.demo && <div style={{ fontSize: 13, color: C.warn, background: C.warnSoft, borderRadius: 10, padding: "8px 12px" }}>Demo mode — sample statuses, not from the real portal. Real data starts once a {portal === "gst" ? "GSP" : "ERI"} provider is connected.</div>}

      {link?.status !== "linked" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
            {portal === "gst"
              ? "Enter the GSTIN and press Connect. FreWork fetches GSTR-1, GSTR-3B and annual return filing status with ARNs from the GST record — no OTP and no portal password needed."
              : usesPassword
                ? "Link once with the Income-tax portal password for this PAN. It goes straight to our ERI partner (Deepvue) to connect the account — FreWork never stores or logs it. FreWork then fetches ITR filing, e-verification, processing and refund status."
                : "Approve once with an OTP from the Income-tax portal. FreWork then fetches ITR filing, e-verification and refund status. Your portal password is never asked for or stored."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>{idLabel}
              <input value={identifier} onChange={e => setIdentifier(e.target.value.toUpperCase())} placeholder={portal === "gst" ? "32ABCDE1234F1Z5" : "ABCDE1234F"} maxLength={portal === "gst" ? 15 : 10}
                style={{ height: 42, width: 220, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: MONO, fontSize: 14, color: C.ink }} />
            </label>
            <button onClick={() => call("start", { identifier })} disabled={busy || !identifier} style={{ ...btn(!link || link.status !== "otp_pending"), alignSelf: "flex-end" }}>Connect</button>
          </div>
          {link?.status === "otp_pending" && usesPassword && (
            <form onSubmit={e => { e.preventDefault(); call("verify", { password }); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>Income-tax portal password
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" placeholder="Password for this PAN"
                    style={{ height: 42, width: 240, maxWidth: "100%", borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 14, color: C.ink }} />
                </label>
                <button type="submit" disabled={busy || password.length < 8 || !consent} style={btn(true)}>Link &amp; fetch</button>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                I am the PAN holder or have their permission, and I agree to share this login with Deepvue only to read ITR filing and refund status. FreWork does not store the password.
              </label>
            </form>
          )}
          {link?.status === "otp_pending" && !usesPassword && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted }}>OTP
                <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits"
                  style={{ height: 42, width: 140, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: MONO, fontSize: 16, letterSpacing: "0.2em", color: C.ink }} />
              </label>
              <button onClick={() => call("verify", { otp })} disabled={busy || otp.length !== 6} style={btn(true)}>Approve &amp; fetch</button>
            </div>
          )}
          {link?.status === "expired" && <div style={{ fontSize: 13, color: C.neg }}>{usesPassword ? "Access expired — connect again with the portal password." : "Access expired — send a new OTP to reconnect."}</div>}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: C.muted }}>
          <span>Last updated {link.last_sync_at ? new Date(link.last_sync_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          {link.expires_at && <span>· Access valid till {day(link.expires_at)}</span>}
          <span style={{ flex: 1 }} />
          <button onClick={() => call("sync")} disabled={busy} style={btn(true)}>{busy ? "Updating…" : "Update now"}</button>
          <button onClick={() => { if (window.confirm(`Unlink the ${title}? Fetched statuses are removed from FreWork.`)) call("unlink"); }} disabled={busy} style={{ ...btn(false), color: C.neg }}>Unlink</button>
        </div>
      )}
      {msg && <div role="status" style={{ fontSize: 13.5, fontWeight: 600, color: msg.ok ? C.pos : C.neg }}>{msg.text}</div>}
      {link?.last_error && !msg && <div style={{ fontSize: 13, color: C.neg }}>{link.last_error}</div>}

      {rows.length > 0 && portal === "gst" && (() => {
        const months = [...new Set(rows.filter(r => r.kind === "return").map(r => r.period))].sort().reverse();
        const ledgers = rows.filter(r => r.kind === "ledger");
        const cell = (form: string, p: string) => rows.find(r => r.form === form && r.period === p);
        return (
          <>
            {ledgers.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ledgers.map(l => <div key={l.form} style={{ background: C.grey, borderRadius: 14, padding: "10px 14px", minWidth: 170 }}><div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{l.form}</div><div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600 }}>{inr(l.amount)}</div></div>)}
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 560 }}>
                <thead><tr style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Month</th><th style={{ textAlign: "left", padding: "8px 6px" }}>GSTR-1</th><th style={{ textAlign: "left", padding: "8px 6px" }}>GSTR-3B</th>
                </tr></thead>
                <tbody>
                  {months.map(p => (
                    <tr key={p} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: "10px 6px", fontWeight: 700 }}>{monthLabel(p)}</td>
                      {["GSTR-1", "GSTR-3B"].map(f => { const r = cell(f, p); return (
                        <td key={f} style={{ padding: "10px 6px" }}>
                          {r ? <span style={{ display: "flex", flexDirection: "column", gap: 3 }}><Chip s={r.status} />{r.filed_on && <span style={{ fontSize: 11.5, color: C.muted }}>{day(r.filed_on)}{r.arn ? <> · <span style={{ fontFamily: MONO }}>{r.arn}</span></> : null}</span>}</span> : <span style={{ color: C.muted }}>—</span>}
                        </td>
                      ); })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {rows.length > 0 && portal === "it" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...new Set(rows.map(r => r.period))].sort().reverse().map(p => {
            const itr = rows.find(r => r.period === p && r.kind === "itr"), ref = rows.find(r => r.period === p && r.kind === "refund");
            return (
              <div key={p} style={{ background: C.grey, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <b style={{ minWidth: 100 }}>{p}</b>
                {itr && <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>ITR <Chip s={itr.status} />{itr.filed_on && <span style={{ color: C.muted }}>{day(itr.filed_on)}{itr.details?.itrForm ? ` · ${String(itr.details.itrForm)}` : ""}</span>}{itr.arn && <span style={{ fontFamily: MONO, color: C.muted }}>Ack {itr.arn}</span>}</span>}
                {ref && <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>Refund <Chip s={ref.status} /><span style={{ fontFamily: MONO }}>{inr(ref.amount)}</span>{ref.filed_on && <span style={{ color: C.muted }}>{day(ref.filed_on)}</span>}</span>}
                {itr?.details?.processing ? <span style={{ fontSize: 12.5, color: C.muted }}>{String(itr.details.processing)}</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function PortalsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(async (biz: string) => {
    const r = await fetch(`/api/finance/portals?business_id=${biz}`);
    setData(await r.json().catch(() => ({ links: [], statuses: [], setup_needed: "Couldn't load." })));
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz); load(biz);
    });
  }, [router, load]);

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Portal Connect</h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 15, maxWidth: 680, lineHeight: 1.55 }}>Live filing status from the GST and Income-tax portals, through a licensed GSP / ERI. Each business approves access with a portal OTP — passwords are never stored. Filed returns show as <b>Filed ✓</b> in your Due dates.</p>
        </div>
        {data?.setup_needed && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{data.setup_needed}</div>}
        {!data ? <div style={{ color: C.muted }}>Loading…</div> : !data.setup_needed && bizId && (
          <>
            <PortalCard portal="gst" data={data} bizId={bizId} reload={() => load(bizId)} />
            <PortalCard portal="it" data={data} bizId={bizId} reload={() => load(bizId)} />
          </>
        )}
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>Notices are not available through the portal APIs. Save notices on the Shelf — the AI reads the reply-by date and adds it to Due dates.</p>
      </div>
    </div>
  );
}
