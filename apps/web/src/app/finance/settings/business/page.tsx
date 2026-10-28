"use client";
import { SettingsHero } from "@/components/finance/PageHero";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LogoPicker from "@/components/LogoPicker";
import DataControls from "@/components/DataControls";
import { readActiveBusiness } from "@/lib/activeBusiness";

const STATES = ["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
const TYPES = [["proprietorship", "Proprietorship"], ["partnership", "Partnership"], ["llp", "LLP"], ["private_limited", "Private Limited"], ["public_limited", "Public Limited"], ["opc", "One Person Company"], ["huf", "HUF"], ["trust", "Trust / Society"]];
const REG = [["regular", "Regular"], ["composition", "Composition"], ["unregistered", "Not registered"]];

type P = Record<string, string>;
const C = { bg: "#F4EFE4", surface: "#FFFDF8", line: "#E6DFD0", strong: "#D9CDB4", ink: "#10241F", muted: "#6B7570", primary: "#12352D", pos: "#0B7A55", posSoft: "#E3F6EE", neg: "#B4321F", negSoft: "#FDECEA" };

export default function BusinessDetailsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState("");
  const [p, setP] = useState<P | null>(null);
  const [orig, setOrig] = useState<P | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [role, setRole] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const biz = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!biz) { router.push("/finance/setup"); return; }
      setBizId(biz);
      const r = await fetch(`/api/finance/business-profile?business_id=${biz}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't load your business details." }); return; }
      const prof = Object.fromEntries(Object.entries(d.profile).map(([k, v]) => [k, (v as string) ?? ""])) as P;
      setP(prof); setOrig(prof); setCanEdit(!!d.can_edit); setRole(d.role ?? "");
    });
  }, [router]);

  const set = (k: string, v: string) => { setP(x => x ? { ...x, [k]: v } : x); setMsg(null); };
  const dirty = p && orig && JSON.stringify(p) !== JSON.stringify(orig);

  // Fill state and PAN from the GSTIN when they're empty
  const onGstin = (v: string) => {
    const g = v.toUpperCase().replace(/\s/g, "");
    setP(x => {
      if (!x) return x;
      const next: P = { ...x, gstin: g };
      if (g.length >= 12 && !x.pan) next.pan = g.slice(2, 12);
      return next;
    });
    setMsg(null);
  };

  async function save() {
    if (!p) return;
    setSaving(true); setMsg(null);
    const r = await fetch("/api/finance/business-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...p }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save." }); return; }
    setOrig(p); setMsg({ ok: true, text: "Saved. Invoices and reports now use these details." });
  }

  const field = (k: string, label: string, opts: { ph?: string; mono?: boolean; full?: boolean; type?: string; hint?: string } = {}) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: opts.full ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>{label}</span>
      <input value={p?.[k] ?? ""} disabled={!canEdit} type={opts.type ?? "text"} placeholder={opts.ph}
        onChange={e => k === "gstin" ? onGstin(e.target.value) : set(k, e.target.value)}
        style={{ height: 44, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 15, color: C.ink, background: canEdit ? C.surface : "#F8F3E8", fontFamily: opts.mono ? "'IBM Plex Mono',monospace" : "inherit", textTransform: opts.mono ? "uppercase" : undefined }} />
      {opts.hint && <span style={{ fontSize: 12, color: C.muted }}>{opts.hint}</span>}
    </label>
  );
  const select = (k: string, label: string, list: string[][]) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>{label}</span>
      <select value={p?.[k] ?? ""} disabled={!canEdit} onChange={e => set(k, e.target.value)} style={{ height: 44, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 15, color: C.ink, background: canEdit ? C.surface : "#F8F3E8" }}>
        <option value="">Choose…</option>
        {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const section = (title: string, children: React.ReactNode) => (
    <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>{title}</h2>
      <div className="bd-grid">{children}</div>
    </section>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <style>{`.bd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media(max-width:700px){.bd-grid{grid-template-columns:minmax(0,1fr)}}`}</style>
      {(() => {
        const keys = ["name", "legal_name", "business_type", "phone", "email", "gstin", "pan", "address", "city", "pincode", "logo_url"] as const;
        const filled = p ? keys.filter(k => String((p as Record<string, unknown>)[k] ?? "").trim()).length : 0;
        const pr = p as Record<string, string> | null;
        return <SettingsHero active="business" eyebrow="Business" title={pr?.name || "Business details"}
          sub={<>Shown on your invoices, GST returns and reports.{!canEdit && p ? " Only the owner or an admin can change these." : ""}</>}
          tiles={[
            { label: "Profile complete", value: `${Math.round((filled / keys.length) * 100)}%`, bar: filled / keys.length },
            { label: "GSTIN", value: pr?.gstin || "Not added", sub: pr?.gstin ? undefined : "Needed for GST returns", tone: pr?.gstin ? "good" : "warn" },
            { label: "Business type", value: (pr?.business_type || "—").replace(/_/g, " ").replace(/^./, s => s.toUpperCase()), sub: pr?.state || undefined },
          ]} />;
      })()}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 100px", display: "flex", flexDirection: "column", gap: 18 }}>

        {!p ? <div style={{ color: msg ? C.neg : C.muted }}>{msg?.text ?? "Loading…"}</div> : (
          <>
            {section("BUSINESS", <>
              <div style={{ gridColumn: "1 / -1" }}><LogoPicker value={p.logo_url || null} disabled={!canEdit} onChange={v => set("logo_url", v ?? "")} /></div>
              {field("name", "Business name", { ph: "As customers know you" })}
              {field("legal_name", "Legal name", { ph: "As on PAN / registration" })}
              {select("business_type", "Business type", TYPES)}
              {field("phone", "Phone", { type: "tel", ph: "10-digit mobile" })}
              {field("email", "Email", { type: "email" })}
            </>)}
            {section("TAX REGISTRATION", <>
              {field("gstin", "GSTIN", { mono: true, ph: "32ABCDE1234F1Z5", hint: "PAN fills in from the GSTIN." })}
              {select("gst_registration_type", "GST registration", REG)}
              {field("pan", "PAN", { mono: true, ph: "ABCDE1234F" })}
              {field("tan", "TAN (for TDS)", { mono: true, ph: "ABCD12345E" })}
              {field("gst_trade_name", "Trade name on GST portal")}
              {field("gst_username", "GST portal username", { hint: "We never store your GST password." })}
            </>)}
            {section("ADDRESS", <>
              {field("address", "Address", { full: true })}
              {field("city", "City")}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>State</span>
                <select value={p.state ?? ""} disabled={!canEdit} onChange={e => set("state", e.target.value)} style={{ height: 44, borderRadius: 11, border: `1px solid ${C.line}`, padding: "0 10px", fontSize: 15, color: C.ink, background: canEdit ? C.surface : "#F8F3E8" }}>
                  <option value="">Choose…</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {field("pincode", "PIN code", { mono: true, ph: "673001" })}
            </>)}

            {role && <DataControls businessId={bizId} businessName={orig?.name ?? ""} role={role} />}

            <div style={{ position: "sticky", bottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: C.surface, border: `1px solid ${C.strong}`, borderRadius: 16, padding: "12px 14px", boxShadow: "0 18px 40px -20px rgba(16,36,31,0.35)" }}>
              {msg && <span role="status" style={{ flex: 1, minWidth: 200, fontSize: 14, fontWeight: 600, color: msg.ok ? C.pos : C.neg }}>{msg.text}</span>}
              {!msg && <span style={{ flex: 1, minWidth: 200, fontSize: 14, color: C.muted }}>{dirty ? "You have unsaved changes." : "All changes saved."}</span>}
              <Link href="/finance/setup" style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${C.strong}`, color: C.ink, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", textDecoration: "none" }}>＋ Add another business</Link>
              {canEdit && <button onClick={save} disabled={!dirty || saving} style={{ height: 44, padding: "0 22px", borderRadius: 12, border: "none", background: C.primary, color: "#FFFFFF", fontWeight: 800, fontSize: 15, cursor: dirty ? "pointer" : "default", opacity: dirty && !saving ? 1 : 0.5 }}>{saving ? "Saving…" : "Save changes"}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
