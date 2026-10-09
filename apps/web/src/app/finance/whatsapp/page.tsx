"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LinkRow = { id: string; phone: string; verified: boolean; code: string | null; code_expires: string | null };
type Data = { links: LinkRow[]; bot_number?: string | null; live?: boolean; setup_needed?: string };

const C = { ground: "#F2F3F6", tile: "#FFFFFF", grey: "#ECEEF3", line: "#E3E6EE", ink: "#141A3A", muted: "#5A6080", navy: "#232A63", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#C2321F", warn: "#8A5A00", warnSoft: "#FFF4DB", wa: "#0E7A43" };
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const pretty = (p: string) => p.startsWith("91") && p.length === 12 ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`;

export default function WhatsAppPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async (b: string) => {
    const r = await fetch(`/api/finance/whatsapp-link?business_id=${b}`);
    setData(await r.json().catch(() => ({ links: [], setup_needed: "Couldn't load." })));
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const b = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
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
    setPhone(""); load(bizId);
  };
  const bot = data?.bot_number;

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>FreBook on WhatsApp</h1>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 15, lineHeight: 1.55, maxWidth: 640 }}>Chat with your books from your phone. Type a transaction or send a bill photo — FreBook drafts the entry and posts it when you reply <b>YES</b>. Ask &ldquo;profit this month&rdquo; or &ldquo;who owes me&rdquo; for instant answers. Your number acts with your FreWork role.</p>
        </div>
        {data?.setup_needed && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontWeight: 600 }}>{data.setup_needed}</div>}
        {data && !data.setup_needed && !data.live && <div style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 16px", fontSize: 14 }}>The FreWork WhatsApp number isn&apos;t switched on yet. You can register your number now; replies start once it&apos;s live.</div>}

        <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Your numbers</h2>
          {!data ? <span style={{ color: C.muted }}>Loading…</span> : data.links.length === 0 ? <span style={{ color: C.muted, fontSize: 14 }}>No number linked yet.</span> : data.links.map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: C.grey, borderRadius: 14, padding: "12px 14px" }}>
              <b style={{ fontFamily: MONO }}>{pretty(l.phone)}</b>
              {l.verified ? <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: C.posSoft, color: C.pos }}>Linked ✓</span>
                : <span style={{ fontSize: 13, color: C.warn }}>Waiting — from this phone send <b style={{ fontFamily: MONO, fontSize: 15 }}>LINK {l.code}</b>{bot ? <> to <a href={`https://wa.me/${bot}?text=${encodeURIComponent(`LINK ${l.code}`)}`} target="_blank" rel="noreferrer" style={{ color: C.wa, fontWeight: 800 }}>{pretty(bot)} ↗</a></> : null}{l.code_expires ? ` (valid till ${new Date(l.code_expires).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})` : ""}</span>}
              <span style={{ flex: 1 }} />
              <button disabled={busy} onClick={() => { if (window.confirm(`Unlink ${pretty(l.phone)}? It will stop posting to this business.`)) post({ action: "remove", id: l.id }); }} style={{ border: "1px solid #C9CEDF", background: C.tile, color: C.neg, borderRadius: 9, height: 34, padding: "0 12px", fontWeight: 700, cursor: "pointer" }}>Unlink</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: C.muted, flex: 1, minWidth: 220 }}>Add a WhatsApp number
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="98765 43210  or  +974 5555 1234" style={{ height: 44, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 12px", fontFamily: MONO, fontSize: 15, color: C.ink }} />
            </label>
            <button disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={() => post({ phone })} style={{ height: 44, padding: "0 18px", borderRadius: 11, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>Get link code</button>
          </div>
          {err && <div role="alert" style={{ color: C.neg, fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>Sending the code from the phone proves it&apos;s yours. Each team member links their own number — entries show who posted them, and view-only roles can ask questions but not post.</div>
        </section>

        <section style={{ background: C.tile, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, fontSize: 14, lineHeight: 1.6 }}>
          <div><b>Record</b><div style={{ color: C.muted }}>Paid rent 25000 from bank<br />Sold to Asha 11800 incl GST on credit<br />200 ka petrol cash mein<br />📷 a bill photo or PDF</div></div>
          <div><b>Ask</b><div style={{ color: C.muted }}>Profit this month<br />Who owes me?<br />Cash and bank balance<br />GST collected last month</div></div>
          <div><b>Reply words</b><div style={{ color: C.muted }}><b>YES</b> post the draft · <b>NO</b> drop it<br /><b>SWITCH</b> change business<br /><b>HELP</b> examples</div></div>
        </section>
      </div>
    </div>
  );
}
