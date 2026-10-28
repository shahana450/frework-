"use client";
import { SettingsHero } from "@/components/finance/PageHero";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COUNTRIES, CURRENCIES, COUNTRY_TAX, getTaxModule } from "@/lib/tax";
import { formatMoney } from "@/lib/money";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Settings = { country: string; state: string | null; currency: string; timezone: string; locale: string; tax_regime: string; fiscal_year_start: string };

const BG = "#F4EFE4", BORDER = "rgba(16,36,31,0.14)", TEXT = "#10241F", MUTED = "rgba(16,36,31,0.75)";
const GOLD = "#12352D", GREEN = "#0B7A55", RED = "#B4321F", AMBER = "#9A6B22";
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(16,36,31,0.08)", border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 11px", borderRadius: 7, fontSize: "0.86rem", fontFamily: "inherit" };
const label: React.CSSProperties = { display: "block", fontSize: "0.68rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };

export default function RegionSettingsPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const res = await fetch(`/api/finance/business-settings?business_id=${saved}`);
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't load settings." }); return; }
      setS(d.settings); setLocked(d.currency_locked); setCanEdit(d.can_edit); setSetupNeeded(d.setup_needed);
    });
  }, [router]);

  function pickCountry(code: string) {
    const c = COUNTRIES.find(x => x.code === code)!;
    const regimes = COUNTRY_TAX[code]?.regimes ?? ["NONE"];
    setS(p => p && ({ ...p, country: code, currency: locked ? p.currency : c.currency, timezone: c.timezone, locale: c.locale, tax_regime: regimes[0], state: code === p.country ? p.state : null }));
  }

  async function save() {
    if (!s || !bizId) return;
    setSaving(true); setMsg(null);
    const res = await fetch("/api/finance/business-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, ...s }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Saved. New entries, FreBook and reports now use these settings." } : { ok: false, text: d.error ?? "Couldn't save." });
    setSaving(false);
  }

  const regimes = s ? COUNTRY_TAX[s.country]?.regimes ?? ["NONE"] : [];
  const note = s ? COUNTRY_TAX[s.country]?.note : undefined;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <SettingsHero active="region" eyebrow="Region" title="Region & currency"
        sub="Where the business operates and the currency its books are kept in. Tax rules come from the country’s tax module." />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 100px", display: "flex", flexDirection: "column", gap: 18 }}>

        {setupNeeded && <div style={{ border: `1px solid rgba(184,120,0,0.3)`, color: AMBER, borderRadius: 8, padding: "0.7rem 0.9rem", fontSize: "0.82rem", marginBottom: "1rem" }}>Run the Phase 7 database update (2026-10-06_phase7_international.sql) in Supabase to save these settings.</div>}
        {!s ? <div style={{ color: MUTED }}>{msg?.text ?? "Loading…"}</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1rem" }}>
              <div>
                <label style={label}>Country</label>
                <select value={s.country} disabled={!canEdit} onChange={e => pickCountry(e.target.value)} style={input}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>State / region</label>
                <input value={s.state ?? ""} disabled={!canEdit} onChange={e => setS({ ...s, state: e.target.value })} placeholder={s.country === "IN" ? "e.g. Kerala (decides CGST/SGST vs IGST)" : "Optional"} style={input} />
              </div>
              <div>
                <label style={label}>Base currency {locked && "🔒"}</label>
                <select value={s.currency} disabled={!canEdit || locked} onChange={e => setS({ ...s, currency: e.target.value })} style={input}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {locked && <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 4 }}>Fixed once entries are posted. Foreign-currency entries are still supported.</div>}
              </div>
              <div>
                <label style={label}>Tax regime</label>
                <select value={s.tax_regime} disabled={!canEdit} onChange={e => setS({ ...s, tax_regime: e.target.value })} style={input}>
                  {regimes.map(r => <option key={r} value={r}>{getTaxModule(r).name}</option>)}
                </select>
                {note && <div style={{ fontSize: "0.72rem", color: AMBER, marginTop: 4 }}>{note} Entries are recorded at gross amounts until it&apos;s added.</div>}
              </div>
              <div>
                <label style={label}>Time zone</label>
                <input value={s.timezone} disabled={!canEdit} onChange={e => setS({ ...s, timezone: e.target.value })} style={input} />
              </div>
              <div>
                <label style={label}>Number format (locale)</label>
                <input value={s.locale} disabled={!canEdit} onChange={e => setS({ ...s, locale: e.target.value })} style={input} />
                <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 4 }}>Preview: {(() => { try { return formatMoney(1234567.5, { currency: s.currency, locale: s.locale }); } catch { return "invalid"; } })()}</div>
              </div>
              <div>
                <label style={label}>Financial year starts (MM-DD)</label>
                <input value={s.fiscal_year_start} disabled={!canEdit} onChange={e => setS({ ...s, fiscal_year_start: e.target.value })} placeholder="04-01" style={input} />
              </div>
            </div>
            <div style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0.7rem 0.9rem" }}>
              <strong style={{ color: TEXT }}>Foreign currency:</strong> tell FreBook the amount and rate, e.g. “Received $2,000 from Acme at 83.25”. The entry is posted in {s.currency} and keeps the {`USD`} amount and rate. If no rate is given, FreBook asks — it never guesses one.
            </div>
            {canEdit ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={save} disabled={saving} style={{ background: GOLD, color: BG, border: "none", borderRadius: 8, padding: "9px 22px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving…" : "Save settings"}</button>
                {msg && <span style={{ fontSize: "0.82rem", color: msg.ok ? GREEN : RED }}>{msg.text}</span>}
              </div>
            ) : <div style={{ fontSize: "0.8rem", color: MUTED }}>Only the owner or an admin can change these settings.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
