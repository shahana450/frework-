"use client";
import { SettingsHero } from "@/components/finance/PageHero";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";
import QRCode from "qrcode";

type LinkRow = { id: string; phone: string; verified: boolean; code: string | null; code_expires: string | null };
type Data = { links: LinkRow[]; bot_number?: string | null; live?: boolean; setup_needed?: string };

const C = { ground: "#F4EFE4", tile: "#FFFDF8", grey: "#F3ECDD", line: "#E6DFD0", ink: "#10241F", muted: "#6B7570", navy: "#12352D", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#B4321F", warn: "#9A6B22", warnSoft: "#FFF4DB", wa: "#0E7A43" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const pretty = (p: string) => p.startsWith("91") && p.length === 12 ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`;

export default function WhatsAppPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<Record<string, { ok: boolean; note?: string }>>({});   // phone → was a code sent to WhatsApp
  const [typed, setTyped] = useState<Record<string, string>>({});
  const load = useCallback(async (b: string) => {
    const r = await fetch(`/api/finance/whatsapp-link?business_id=${b}`);
    setData(await r.json().catch(() => ({ links: [], setup_needed: "Couldn't load." })));
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const b = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!b) { router.push("/finance/setup"); return; }
      setBizId(b); load(b);
    });
  }, [router, load]);
  // Poll while a code is waiting, so the page turns green once the message arrives
  useEffect(() => {
    if (!bizId || !data?.links.some(l => !l.verified)) return;
    const t = setInterval(() => load(bizId), 5000);
    return () => clearInterval(t);
  }, [bizId, data, load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setErr("");
    const r = await fetch("/api/finance/whatsapp-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...body }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Something went wrong."); return; }
    if (d.phone) setSent(s => ({ ...s, [d.phone]: { ok: !!d.sent, note: d.send_error ?? undefined } }));
    setPhone(""); load(bizId);
  };
  const bot = data?.bot_number;
  // Scan-to-chat: opens the FreBook chat directly (WhatsApp search only finds saved contacts, so it shows "Invite")
  const chatUrl = bot ? `https://wa.me/${bot}?text=${encodeURIComponent("Hi FreBook")}` : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!chatUrl) return;
    QRCode.toDataURL(chatUrl, { width: 480, margin: 1, color: { dark: "#10241F", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [chatUrl]);

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <SettingsHero active="whatsapp" eyebrow="WhatsApp" title="Your books, in WhatsApp"
        sub="Type a transaction or send a bill photo — FreBook drafts the entry and posts it when you reply YES. Ask “profit this month” or “who owes me” any time." />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 100px", display: "flex", flexDirection: "column", gap: 18 }}>

        {data?.setup_needed && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{data.setup_needed}</div>}
        {data && !data.setup_needed && !data.live && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontSize: 14 }}>The FreWork WhatsApp number isn&apos;t switched on yet. You can register your number now; replies start once it&apos;s live.</div>}

        <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Your numbers</h2>
          {!data ? <span style={{ color: C.muted }}>Loading…</span> : data.links.length === 0 ? <span style={{ color: C.muted, fontSize: 14 }}>No number linked yet.</span> : data.links.map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: C.grey, borderRadius: 14, padding: "12px 14px" }}>
              <b style={{ fontFamily: MONO }}>{pretty(l.phone)}</b>
              {l.verified ? <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: C.posSoft, color: C.pos }}>Linked ✓</span>
                : <span style={{ display: "flex", flexDirection: "column", gap: 8, flexBasis: "100%" }}>
                  {sent[l.phone]?.ok && (
                    <form onSubmit={e => { e.preventDefault(); post({ action: "verify", phone: l.phone, code: typed[l.phone] ?? "" }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 14, color: C.pos, fontWeight: 700 }}>We sent a 6-digit code to this WhatsApp. Type it here:</span>
                      <input value={typed[l.phone] ?? ""} onChange={e => setTyped(t => ({ ...t, [l.phone]: e.target.value.replace(/\D/g, "").slice(0, 6) }))} inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label="Code from WhatsApp" placeholder="••••••"
                        style={{ height: 40, width: 130, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: MONO, fontSize: 18, letterSpacing: "0.25em", color: C.ink }} />
                      <button type="submit" disabled={busy || (typed[l.phone] ?? "").length !== 6} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, cursor: "pointer", opacity: (typed[l.phone] ?? "").length === 6 ? 1 : 0.5 }}>Link</button>
                      <button type="button" disabled={busy} onClick={() => post({ phone: l.phone })} style={{ height: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.tile, cursor: "pointer" }}>Send again</button>
                    </form>
                  )}
                  {sent[l.phone] && !sent[l.phone].ok && sent[l.phone].note && <span style={{ fontSize: 13, color: C.neg }}>{sent[l.phone].note}</span>}
                  <span style={{ fontSize: 13, color: C.warn }}>{sent[l.phone]?.ok ? "Or" : "Waiting —"} from this phone send <b style={{ fontFamily: MONO, fontSize: 15 }}>LINK {l.code}</b>{bot ? <> to <a href={`https://wa.me/${bot}?text=${encodeURIComponent(`LINK ${l.code}`)}`} target="_blank" rel="noreferrer" style={{ color: C.wa, fontWeight: 800 }}>{pretty(bot)} ↗</a></> : null}{l.code_expires ? ` (valid till ${new Date(l.code_expires).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})` : ""}</span></span>}
              <span style={{ flex: 1 }} />
              <button disabled={busy} onClick={() => { if (window.confirm(`Unlink ${pretty(l.phone)}? It will stop posting to this business.`)) post({ action: "remove", id: l.id }); }} style={{ border: "1px solid #D9CDB4", background: C.tile, color: C.neg, borderRadius: 9, height: 34, padding: "0 12px", fontWeight: 700, cursor: "pointer" }}>Unlink</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted, flex: 1, minWidth: 220 }}>Add a WhatsApp number
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="98765 43210  or  +974 5555 1234" style={{ height: 44, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: MONO, fontSize: 15, color: C.ink }} />
            </label>
            <button disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={() => post({ phone })} style={{ height: 44, padding: "0 18px", borderRadius: 11, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>Send code</button>
          </div>
          {err && <div role="alert" style={{ color: C.neg, fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>FreBook sends a code to that WhatsApp number — typing it here proves the number is yours. Each team member links their own number — entries show who posted them, and view-only roles can ask questions but not post.</div>
        </section>

        {bot && (
          <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
            {qr ? <img src={qr} alt={`QR code that opens a WhatsApp chat with FreBook, ${pretty(bot)}`} width={176} height={176} style={{ borderRadius: 14, border: `1px solid ${C.line}`, flexShrink: 0 }} />
              : <div style={{ width: 176, height: 176, borderRadius: 14, background: C.grey }} />}
            <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>Open FreBook on your phone</h2>
              <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.55 }}>Scan with your phone camera — the FreBook chat opens in WhatsApp. Then save <b style={{ fontFamily: MONO, color: C.ink }}>{pretty(bot)}</b> as <b style={{ color: C.ink }}>FreBook</b> so it shows by name. (Searching the number in WhatsApp shows &ldquo;Invite&rdquo; until it&apos;s saved.)</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={chatUrl} target="_blank" rel="noreferrer" style={{ height: 42, padding: "0 16px", borderRadius: 11, background: C.wa, color: "#FFFFFF", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Open FreBook on WhatsApp</a>
                <a href="/frebook.vcf" download="FreBook.vcf" title="Adds FreBook to your phone contacts, so WhatsApp shows it by name" style={{ height: 42, padding: "0 16px", borderRadius: 11, background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M2 21c0-4 4-6 8-6s8 2 8 6M19 8v6M16 11h6" /></svg>
                  Save FreBook to contacts
                </a>
                {qr && <a href={qr} download="FreBook-WhatsApp-QR.png" style={{ height: 42, padding: "0 14px", borderRadius: 11, border: `1px solid ${C.line}`, color: C.ink, fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Download QR</a>}
                <button onClick={() => navigator.clipboard?.writeText(chatUrl)} style={{ height: 42, padding: "0 14px", borderRadius: 11, border: `1px solid ${C.line}`, background: C.tile, color: C.ink, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Copy link</button>
              </div>
            </div>
          </section>
        )}

        <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, fontSize: 14, lineHeight: 1.6 }}>
          <div><b>Record</b><div style={{ color: C.muted }}>Paid rent 25000 from bank<br />Sold to Asha 11800 incl GST on credit<br />200 ka petrol cash mein<br />📷 a bill photo or PDF</div></div>
          <div><b>Ask</b><div style={{ color: C.muted }}>Profit this month<br />Who owes me?<br />Cash and bank balance<br />GST collected last month</div></div>
          <div><b>Reply words</b><div style={{ color: C.muted }}><b>YES</b> post the draft · <b>NO</b> drop it<br /><b>SWITCH</b> change business<br /><b>HELP</b> examples</div></div>
        </section>
      </div>
    </div>
  );
}
