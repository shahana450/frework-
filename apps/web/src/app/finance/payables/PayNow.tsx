"use client";
// Pay now: for each supplier you owe — an amount you can change, the bank or cash ledger it goes from, and three ways
// to pay: UPI (opens your UPI app with the supplier's UPI ID and amount; a QR on a computer), bank transfer (their
// account number and IFSC to copy into your net banking), or both later. FreBook never moves money — once you have paid,
// "Mark paid" posts the payment entry (Dr supplier, Cr bank/cash).
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { saveEntry } from "@/lib/postEntry";

type Sup = { id: string; name: string; outstanding: number };
type Acc = { id: string; name: string; type: string; sub_type: string | null };
type Details = { contactId: string | null; upi: string; bankName: string; account: string; ifsc: string };
type Row = { amount: string; from: string; ref: string; busy: boolean; done: string; err: string };

const T = { ink: "#10241F", muted: "#5E6B66", line: "#E6DFD0", paper: "#FFFDF8", green: "#12352D", gold: "#D9B56F", soft: "#F4EEE2" };
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isMoney = (a: Acc) => a.sub_type === "bank" || a.sub_type === "cash" || (a.type === "asset" && /\b(bank|cash)\b/i.test(a.name) && !/charges/i.test(a.name));
const upiLink = (d: Details, name: string, amt: number, note: string) => `upi://pay?pa=${encodeURIComponent(d.upi)}&pn=${encodeURIComponent(name)}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note.slice(0, 50))}`;
const isPhone = () => typeof navigator !== "undefined" && /android|iphone|ipad|mobile/i.test(navigator.userAgent);

export default function PayNow({ bizId, suppliers, accounts, onPaid, only, onClose }: { bizId: string; suppliers: Sup[]; accounts: Acc[]; onPaid: () => void; only?: string | null; onClose?: () => void }) {
  const owed = useMemo(() => suppliers.filter(s => s.outstanding > 0.5 && (!only || s.id === only)).sort((a, b) => b.outstanding - a.outstanding), [suppliers, only]);
  const money = useMemo(() => accounts.filter(isMoney), [accounts]);
  const defBank = money.find(a => a.sub_type === "bank")?.id ?? money[0]?.id ?? "";
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [det, setDet] = useState<Record<string, Details>>({});
  const [needSql, setNeedSql] = useState(false);
  const [edit, setEdit] = useState<{ sup: Sup; d: Details } | null>(null);
  const [show, setShow] = useState<{ sup: Sup; kind: "upi" | "bank"; qr?: string } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setRows(r => Object.fromEntries(owed.map(s => [s.id, r[s.id] ?? { amount: String(s.outstanding.toFixed(2)), from: defBank, ref: "", busy: false, done: "", err: "" }])));
  }, [owed, defBank]);
  useEffect(() => {
    if (!owed.length) return;
    (async () => {
      const { data, error } = await supabase.from("fw_fin_contacts").select("id,name,ledger_account_id,upi_id,bank_name,bank_account,bank_ifsc").eq("business_id", bizId);
      if (error) { setNeedSql(/upi_id|bank_|column/i.test(error.message)); return; }
      const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const out: Record<string, Details> = {};
      for (const s of owed) {
        const c = (data ?? []).find(x => x.ledger_account_id === s.id) ?? (data ?? []).find(x => key(x.name) === key(s.name));
        out[s.id] = { contactId: c?.id ?? null, upi: c?.upi_id ?? "", bankName: c?.bank_name ?? "", account: c?.bank_account ?? "", ifsc: c?.bank_ifsc ?? "" };
      }
      setDet(out);
    })();
  }, [owed, bizId]);

  const set = (id: string, p: Partial<Row>) => setRows(r => ({ ...r, [id]: { ...r[id], ...p } }));
  const amt = (id: string) => Math.round((parseFloat(rows[id]?.amount ?? "0") || 0) * 100) / 100;

  async function saveDetails() {
    if (!edit) return;
    const d = edit.d;
    const patch = { upi_id: d.upi.trim() || null, bank_name: d.bankName.trim() || null, bank_account: d.account.replace(/\s+/g, "") || null, bank_ifsc: d.ifsc.trim().toUpperCase() || null };
    if (patch.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(patch.bank_ifsc)) { window.alert("IFSC looks wrong — it is 11 characters, e.g. HDFC0001234."); return; }
    if (patch.upi_id && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(patch.upi_id)) { window.alert("UPI ID looks wrong — e.g. name@okhdfcbank."); return; }
    const q = d.contactId
      ? supabase.from("fw_fin_contacts").update(patch).eq("id", d.contactId)
      : supabase.from("fw_fin_contacts").insert({ business_id: bizId, name: edit.sup.name, type: "vendor", is_active: true, ledger_account_id: edit.sup.id, ...patch }).select("id").single();
    const { data, error } = await q;
    if (error) { window.alert(/column|upi_id/.test(error.message) ? "Run 2026-11-11_supplier_payment_details.sql in Supabase first." : error.message); return; }
    setDet(x => ({ ...x, [edit.sup.id]: { ...d, contactId: d.contactId ?? (data as { id: string } | null)?.id ?? null } }));
    setEdit(null);
  }

  async function payUpi(s: Sup) {
    const d = det[s.id];
    if (!d?.upi) { setEdit({ sup: s, d: d ?? { contactId: null, upi: "", bankName: "", account: "", ifsc: "" } }); return; }
    const link = upiLink(d, s.name, amt(s.id), `Payment to ${s.name}`);
    if (isPhone()) { window.location.href = link; return; }
    setShow({ sup: s, kind: "upi", qr: await QRCode.toDataURL(link, { width: 260, margin: 1 }) });
  }

  async function markPaid(s: Sup) {
    const r = rows[s.id]; const a = amt(s.id);
    if (!(a > 0)) { set(s.id, { err: "Enter the amount paid." }); return; }
    if (!r.from) { set(s.id, { err: "Choose the bank or cash it was paid from." }); return; }
    if (a > s.outstanding + 0.5 && !window.confirm(`${inr(a)} is more than the ${inr(s.outstanding)} you owe ${s.name}. The extra will show as an advance. Post it?`)) return;
    set(s.id, { busy: true, err: "" });
    try {
      const fromName = money.find(m => m.id === r.from)?.name ?? "Bank";
      const res = await saveEntry({ business_id: bizId, date: new Date().toLocaleDateString("en-CA"), type: "payment", party_name: s.name, reference_no: r.ref.trim() || null, source: "pay_now",
        narration: `Paid ${s.name} ${inr(a)} from ${fromName}${r.ref.trim() ? ` (ref ${r.ref.trim()})` : ""}`,
        lines: [{ account_id: s.id, dr: a, cr: 0 }, { account_id: r.from, dr: 0, cr: a }] });
      set(s.id, { busy: false, done: `Posted ${res.entry_no}` });
      onPaid();
    } catch (e) { set(s.id, { busy: false, err: e instanceof Error ? e.message : "Couldn't post." }); }
  }

  if (!owed.length) return null;
  const totalSel = owed.reduce((t, s) => t + (rows[s.id]?.done ? 0 : amt(s.id)), 0);
  const btn = (primary?: boolean): React.CSSProperties => ({ height: 36, padding: "0 14px", borderRadius: 999, border: primary ? "none" : `1px solid ${T.line}`, background: primary ? T.green : "#FFFFFF", color: primary ? "#FFFFFF" : T.ink, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const field: React.CSSProperties = { height: 36, borderRadius: 10, border: `1px solid ${T.line}`, padding: "0 10px", fontFamily: "inherit", fontSize: 14, background: "#FFFFFF", color: T.ink };

  const panel = (
    <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 20, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", width: "calc(100% - 40px)" }}>
        <span style={{ fontSize: 22, fontStyle: "italic", color: T.ink }}>Pay now</span>
        <span style={{ fontSize: 13.5, color: T.muted, flex: 1 }}>{owed.length} supplier{owed.length > 1 ? "s" : ""} · {inr(totalSel)} to pay · UPI or bank transfer, then mark paid</span>
        <span aria-hidden="true" style={{ color: T.muted }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <>
        {needSql && <div style={{ margin: "0 20px 12px", padding: "10px 14px", borderRadius: 10, background: "#FBF1DA", color: "#7A5300", fontSize: 13.5 }}>To save suppliers&apos; UPI and bank details, run <code>2026-11-11_supplier_payment_details.sql</code> in Supabase once. You can still mark payments as paid.</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, fontSize: 14 }}>
            <thead><tr style={{ background: T.soft, color: "#9A7A2E", fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left" }}>
              <th style={{ padding: "10px 20px" }}>Supplier</th><th style={{ padding: 10, textAlign: "right" }}>You owe</th><th style={{ padding: 10 }}>Pay now</th><th style={{ padding: 10 }}>From</th><th style={{ padding: 10 }}>Pay with</th><th style={{ padding: "10px 20px 10px 10px" }}>Then</th>
            </tr></thead>
            <tbody>
              {owed.map(s => {
                const r = rows[s.id]; const d = det[s.id];
                if (!r) return null;
                return (
                  <tr key={s.id} style={{ borderTop: `1px solid ${T.line}`, verticalAlign: "top", opacity: r.done ? 0.6 : 1 }}>
                    <td style={{ padding: "12px 20px" }}><b>{s.name}</b>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{d?.upi ? `UPI ${d.upi}` : ""}{d?.upi && d?.account ? " · " : ""}{d?.account ? `A/c …${d.account.slice(-4)} ${d.ifsc}` : ""}{!d?.upi && !d?.account ? "No payment details" : ""}
                        {" · "}<button onClick={() => setEdit({ sup: s, d: d ?? { contactId: null, upi: "", bankName: "", account: "", ifsc: "" } })} style={{ all: "unset", cursor: "pointer", color: "#8A6420", textDecoration: "underline" }}>{d?.upi || d?.account ? "edit" : "add UPI / bank"}</button></div></td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{inr(s.outstanding)}</td>
                    <td style={{ padding: 10 }}><input aria-label={`Amount to pay ${s.name}`} inputMode="decimal" value={r.amount} disabled={!!r.done} onChange={e => set(s.id, { amount: e.target.value.replace(/[^\d.]/g, "") })} style={{ ...field, width: 130, textAlign: "right", fontVariantNumeric: "tabular-nums" }} /></td>
                    <td style={{ padding: 10 }}><select aria-label="Pay from" value={r.from} disabled={!!r.done} onChange={e => set(s.id, { from: e.target.value })} style={{ ...field, maxWidth: 200 }}>{money.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
                    <td style={{ padding: 10 }}><div style={{ display: "flex", gap: 6 }}>
                      <button style={btn()} disabled={!!r.done} onClick={() => payUpi(s)} title={d?.upi ? "Opens your UPI app with the amount filled in" : "Add the supplier's UPI ID first"}>UPI</button>
                      <button style={btn()} disabled={!!r.done} onClick={() => d?.account ? setShow({ sup: s, kind: "bank" }) : setEdit({ sup: s, d: d ?? { contactId: null, upi: "", bankName: "", account: "", ifsc: "" } })}>Net banking</button>
                    </div></td>
                    <td style={{ padding: "10px 20px 10px 10px" }}>
                      {r.done ? <span style={{ color: "#0B7A55", fontWeight: 700 }}>✓ {r.done}</span> : <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input aria-label="UTR / reference" placeholder="UTR / ref (optional)" value={r.ref} onChange={e => set(s.id, { ref: e.target.value })} style={{ ...field, width: 150 }} />
                        <button style={btn(true)} disabled={r.busy} onClick={() => markPaid(s)}>{r.busy ? "Posting…" : "Mark paid"}</button>
                      </div>}
                      {r.err && <div role="alert" style={{ color: "#B4321F", fontSize: 12.5, marginTop: 4 }}>{r.err}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 20px 16px", fontSize: 12.5, color: T.muted }}>FreBook doesn&apos;t move money: UPI opens your own UPI app, Net banking shows the details to use in your bank. After paying, press Mark paid — it posts the payment (supplier Dr, bank/cash Cr) with today&apos;s date.</div>
      </>}

      {(edit || show) && (
        <div role="dialog" aria-modal="true" onClick={() => { setEdit(null); setShow(null); }} style={{ position: "fixed", inset: 0, background: "rgba(16,36,31,.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 70 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(460px,100%)", background: T.paper, borderRadius: 18, padding: 22, display: "grid", gap: 12, color: T.ink }}>
            {edit && <>
              <b style={{ fontSize: 19 }}>Payment details · {edit.sup.name}</b>
              {([["upi", "UPI ID", "name@okhdfcbank"], ["bankName", "Bank name", "e.g. HDFC Bank"], ["account", "Account number", ""], ["ifsc", "IFSC", "e.g. HDFC0001234"]] as [keyof Details, string, string][]).map(([k, l, ph]) => (
                <label key={k} style={{ display: "grid", gap: 4, fontSize: 13, color: T.muted }}>{l}<input value={String(edit.d[k] ?? "")} placeholder={ph} onChange={e => setEdit({ ...edit, d: { ...edit.d, [k]: e.target.value } })} style={{ ...field, height: 40 }} /></label>
              ))}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button style={btn()} onClick={() => setEdit(null)}>Cancel</button><button style={btn(true)} onClick={saveDetails}>Save</button></div>
            </>}
            {show?.kind === "upi" && <>
              <b style={{ fontSize: 19 }}>Pay {show.sup.name} {inr(amt(show.sup.id))}</b>
              <span style={{ fontSize: 13.5, color: T.muted }}>Scan with any UPI app on your phone. The UPI ID and amount are filled in — check them before you pay.</span>
              {show.qr && <img src={show.qr} alt={`UPI QR code to pay ${show.sup.name}`} width={260} height={260} style={{ justifySelf: "center" }} />}
              <div style={{ fontSize: 13, textAlign: "center" }}>UPI ID: <b>{det[show.sup.id]?.upi}</b></div>
              <button style={btn(true)} onClick={() => setShow(null)}>Done — I&apos;ll mark it paid</button>
            </>}
            {show?.kind === "bank" && (() => { const d = det[show.sup.id]; const copy = (v: string) => navigator.clipboard?.writeText(v).catch(() => null); return <>
              <b style={{ fontSize: 19 }}>Bank transfer to {show.sup.name}</b>
              {([["Amount", amt(show.sup.id).toFixed(2)], ["Account name", show.sup.name], ["Account number", d?.account ?? ""], ["IFSC", d?.ifsc ?? ""], ["Bank", d?.bankName ?? ""]] as [string, string][]).filter(x => x[1]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, background: T.soft, borderRadius: 10, padding: "8px 12px" }}><span style={{ fontSize: 12.5, color: T.muted, width: 110 }}>{k}</span><b style={{ flex: 1, fontVariantNumeric: "tabular-nums" }}>{v}</b><button style={{ ...btn(), height: 30 }} onClick={() => copy(v)}>Copy</button></div>
              ))}
              <span style={{ fontSize: 12.5, color: T.muted }}>Open your bank&apos;s net banking or app, pay by NEFT / IMPS / RTGS, then come back and press Mark paid with the UTR.</span>
              <button style={btn(true)} onClick={() => setShow(null)}>Done</button>
            </>; })()}
          </div>
        </div>
      )}
    </section>
  );
  if (!only) return panel;
  return (
    <div role="dialog" aria-modal="true" aria-label="Pay now" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,36,31,.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(1000px,100%)", maxHeight: "90vh", overflow: "auto", position: "relative" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 14, zIndex: 1, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#FFFFFF", cursor: "pointer", fontSize: 16 }}>×</button>
        {panel}
      </div>
    </div>
  );
}
