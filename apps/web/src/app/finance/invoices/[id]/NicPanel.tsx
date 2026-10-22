"use client";
// Generate the IRN (e-invoice) and the e-way bill on the government system straight from this invoice, through the GSP.
// Shows what's already done on the invoice — IRN, acknowledgement, signed QR and e-way bill — which also prints.
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import type { InvoiceDoc } from "@/lib/invoiceDoc";
import { buildEInvoice, buildEwayBill, type EIssue } from "@/lib/eDocs";

const C = { ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", negSoft: "#FDECEA", warn: "#8A5A00", warnSoft: "#FFF4DB" };
type Einv = { irn: string; ackNo: string; ackDt: string; signedQr: string; cancelled?: string } | null;
type Ewb = { ewbNo: string; ewbDate?: string; validUpto?: string | null; vehicleNo?: string | null } | null;
type Login = { username: string; remembered: boolean; live: boolean } | null;

export default function NicPanel({ bizId, journalId, doc }: { bizId: string; journalId: string; doc: InvoiceDoc }) {
  const [st, setSt] = useState<{ configured: boolean; setup: string | null; logins: Record<"einvoice" | "ewaybill", Login>; einv: Einv; ewb: Ewb } | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [issues, setIssues] = useState<EIssue[]>([]);
  const [login, setLogin] = useState<"" | "einvoice" | "ewaybill">("");
  const [cred, setCred] = useState({ username: "", password: "", remember: true });
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null);
  const [ewbOpen, setEwbOpen] = useState(false);
  const [t, setT] = useState({ vehicle: "", km: "", name: "", id: "" });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancel, setCancel] = useState({ reason: "2", remark: "" });

  const load = useCallback(async () => {
    const d = await fetch(`/api/finance/einvoice?business_id=${bizId}&journal_id=${journalId}`).then(r => r.json()).catch(() => null);
    if (d) setSt({ configured: !!d.configured, setup: d.setup_needed ?? null, logins: d.logins ?? { einvoice: null, ewaybill: null }, einv: d.einvoice ?? null, ewb: d.ewaybill ?? null });
  }, [bizId, journalId]);
  useEffect(() => { if (bizId && journalId) void load(); }, [bizId, journalId, load]);
  useEffect(() => { if (st?.einv?.signedQr && !st.einv.cancelled) QRCode.toDataURL(st.einv.signedQr, { margin: 1, width: 180 }).then(setQr).catch(() => setQr("")); else setQr(""); }, [st?.einv]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/finance/einvoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, journal_id: journalId, ...body }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d };
  };
  // Runs an action; if the portal login is missing, asks for it, then runs the action again
  const run = async (name: string, fn: () => Promise<{ ok: boolean; d: { error?: string; login?: "einvoice" | "ewaybill" } }>, retry: () => Promise<void>) => {
    setErr(""); setBusy(name);
    const { ok, d } = await fn();
    setBusy("");
    if (!ok) { if (d.login) { setLogin(d.login); setPending(() => retry); } else setErr(d.error ?? "That didn't go through."); return; }
    await load();
  };

  const irn = async () => {
    const r = buildEInvoice(doc); setIssues(r.issues);
    if (r.issues.some(i => i.level === "error")) return;
    await run("irn", () => post({ action: "irn", invoice: r.json }), irn);
  };
  const ewb = async () => {
    const r = buildEwayBill(doc, { vehicleNo: t.vehicle, distanceKm: Number(t.km) || 0, transporterName: t.name, transporterId: t.id.toUpperCase() }); setIssues(r.issues);
    if (r.issues.some(i => i.level === "error")) return;
    const bill = (r.json as { billLists: Record<string, unknown>[] }).billLists[0];
    await run("ewb", () => post({ action: "ewb", bill }), ewb);
  };
  const doCancel = async () => run("cancel", () => post({ action: "cancel", reason: cancel.reason, remark: cancel.remark }), doCancel).then(() => setCancelOpen(false));
  const signIn = async () => {
    setErr(""); setBusy("login");
    const { ok, d } = await post({ action: "login", kind: login, ...cred });
    setBusy("");
    if (!ok) { setErr(d.error ?? "Sign-in failed."); return; }
    setLogin(""); setCred(c => ({ ...c, password: "" }));
    const next = pending; setPending(null);
    if (next) await next(); else await load();
  };

  if (!st || !st.configured) return null;
  const btn: React.CSSProperties = { height: 38, padding: "0 14px", borderRadius: 10, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 13.5, cursor: "pointer" };
  const ghost: React.CSSProperties = { ...btn, background: "#FFFFFF", color: C.ink, border: `1px solid ${C.line}` };
  const inp: React.CSSProperties = { height: 36, borderRadius: 9, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 13.5, color: C.ink, minWidth: 0 };
  const live = st.einv && !st.einv.cancelled;
  const canCancel = live && st.einv!.ackDt && Date.now() - Date.parse(st.einv!.ackDt.replace(" ", "T")) < 24 * 3600000;

  return (
    <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* What's on the invoice — prints */}
      {(live || st.ewb) && (
        <div className="irn-strip" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, background: "#FFFFFF", fontSize: 12.5 }}>
          {qr && <img src={qr} alt="e-Invoice QR code" width={110} height={110} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            {live && <>
              <span><b>IRN:</b> <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{st.einv!.irn}</span></span>
              <span><b>Ack No:</b> {st.einv!.ackNo} · <b>Ack Date:</b> {st.einv!.ackDt}</span>
            </>}
            {st.ewb && <span><b>e-Way Bill:</b> {st.ewb.ewbNo}{st.ewb.validUpto ? ` · valid till ${st.ewb.validUpto}` : ""}{st.ewb.vehicleNo ? ` · ${st.ewb.vehicleNo}` : ""}</span>}
          </div>
        </div>
      )}
      {st.einv?.cancelled && <div className="no-print" style={{ fontSize: 13, color: C.neg, fontWeight: 700 }}>IRN {st.einv.irn.slice(0, 12)}… was cancelled on {st.einv.cancelled}.</div>}

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {st.setup ? <span style={{ fontSize: 12.5, color: C.warn, fontWeight: 600 }}>{st.setup}</span> : <>
          {!live && <button onClick={irn} disabled={!!busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy === "irn" ? "Generating IRN…" : "Generate IRN (e-invoice)"}</button>}
          {canCancel && <button onClick={() => setCancelOpen(o => !o)} style={ghost}>Cancel IRN</button>}
          {!st.ewb && <button onClick={() => setEwbOpen(o => !o)} style={ghost}>Generate e-way bill</button>}
          <span style={{ fontSize: 12, color: C.muted }}>Straight to the government system — no file upload.</span>
        </>}
      </div>

      {ewbOpen && !st.ewb && (
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <input id="ewb-vehicle" aria-label="Vehicle number" placeholder="Vehicle no. e.g. KL07AB1234" value={t.vehicle} onChange={e => setT(x => ({ ...x, vehicle: e.target.value.toUpperCase() }))} style={{ ...inp, width: 200 }} />
          <input id="ewb-km" aria-label="Distance in km" placeholder="Distance km" inputMode="numeric" value={t.km} onChange={e => setT(x => ({ ...x, km: e.target.value.replace(/\D/g, "") }))} style={{ ...inp, width: 120 }} />
          <input id="ewb-tid" aria-label="Transporter ID" placeholder="Transporter ID (optional)" value={t.id} onChange={e => setT(x => ({ ...x, id: e.target.value.toUpperCase() }))} style={{ ...inp, width: 200 }} />
          <button onClick={ewb} disabled={!!busy} style={btn}>{busy === "ewb" ? "Generating…" : "Generate"}</button>
        </div>
      )}

      {cancelOpen && (
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select id="irn-cancel-reason" aria-label="Reason" value={cancel.reason} onChange={e => setCancel(c => ({ ...c, reason: e.target.value }))} style={inp}>
            <option value="1">Duplicate</option><option value="2">Data entry mistake</option><option value="3">Order cancelled</option><option value="4">Other</option>
          </select>
          <input id="irn-cancel-remark" aria-label="Remark" placeholder="Remark" value={cancel.remark} onChange={e => setCancel(c => ({ ...c, remark: e.target.value }))} style={{ ...inp, width: 220 }} />
          <button onClick={doCancel} disabled={!!busy} style={{ ...btn, background: C.neg }}>{busy === "cancel" ? "Cancelling…" : "Cancel IRN"}</button>
          <span style={{ fontSize: 12, color: C.muted }}>Allowed within 24 hours, and only if no e-way bill is active.</span>
        </div>
      )}

      {login && (
        <div className="no-print" style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "#FFFFFF" }}>
          <b style={{ fontSize: 13.5 }}>Sign in to the {login === "einvoice" ? "e-invoice" : "e-way bill"} system</b>
          <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Use the <b>API user</b> created on {login === "einvoice" ? "einvoice1.gst.gov.in" : "ewaybillgst.gov.in"} → API Registration → Create API User, choosing your GST Suvidha Provider (Sandbox / Zoop). It isn&apos;t your main portal password.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input id="nic-user" aria-label="API username" placeholder="API username" value={cred.username} onChange={e => setCred(c => ({ ...c, username: e.target.value }))} style={{ ...inp, width: 180 }} autoComplete="off" />
            <input id="nic-pass" aria-label="API password" type="password" placeholder="API password" value={cred.password} onChange={e => setCred(c => ({ ...c, password: e.target.value }))} style={{ ...inp, width: 180 }} autoComplete="off" />
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}><input type="checkbox" checked={cred.remember} onChange={e => setCred(c => ({ ...c, remember: e.target.checked }))} /> Remember (encrypted)</label>
            <button onClick={signIn} disabled={!cred.username || !cred.password || busy === "login"} style={{ ...btn, opacity: !cred.username || !cred.password ? 0.5 : 1 }}>{busy === "login" ? "Signing in…" : "Sign in & continue"}</button>
            <button onClick={() => { setLogin(""); setPending(null); }} style={ghost}>Close</button>
          </div>
        </div>
      )}

      {issues.length > 0 && issues.some(i => i.level === "error") && (
        <ul className="no-print" style={{ margin: 0, padding: "8px 12px 8px 28px", background: C.warnSoft, borderRadius: 10, fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
          {issues.map((i, k) => <li key={k} style={{ color: i.level === "error" ? C.neg : C.warn }}>{i.text}</li>)}
        </ul>
      )}
      {err && <div role="alert" className="no-print" style={{ fontSize: 13, fontWeight: 600, color: C.neg, background: C.negSoft, padding: "8px 12px", borderRadius: 10 }}>{err}</div>}
    </div>
  );
}
