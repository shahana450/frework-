"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { readActiveBusiness } from "@/lib/activeBusiness";

type FY = { id: string; label: string; start_date: string; end_date: string; is_current: boolean; is_closed: boolean; is_locked?: boolean; locked_at?: string | null };

export default function FinancialYearPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [years, setYears] = useState<FY[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [newStart, setNewStart] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/\uFEFF/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      load(saved);
    });
  }, []);

  async function load(id: string) {
    const { data } = await supabase
      .from("fw_fin_financial_years")
      .select("*")
      .eq("business_id", id)
      .order("start_date", { ascending: false });
    setYears((data ?? []) as FY[]);
  }

  // Auto-compute label and end from start date
  useEffect(() => {
    if (!newStart) return;
    const d = new Date(newStart);
    const endYear = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
    const startYear = endYear - 1;
    setNewLabel(`FY ${startYear}-${String(endYear).slice(2)}`);
  }, [newStart]);

  async function createFY() {
    if (!bizId || !newStart || !newLabel) return;
    setSaving(true); setError(""); setSuccess("");

    const startD = new Date(newStart);
    const endD = new Date(startD);
    endD.setFullYear(endD.getFullYear() + 1);
    endD.setDate(endD.getDate() - 1);

    const { error: e } = await supabase.from("fw_fin_financial_years").insert({
      business_id: bizId,
      label: newLabel.trim().replace(/^FY\s*/i, ""),   // "FY" is added wherever a year is shown
      start_date: newStart,
      end_date: endD.toISOString().split("T")[0],
      is_current: false,
      is_closed: false,
    });
    if (e) { setError(e.message); } else { setSuccess("Financial year created"); setShowNew(false); load(bizId); }
    setSaving(false);
  }

  async function setAsCurrent(fyId: string) {
    if (!bizId) return;
    setSaving(true); setError(""); setSuccess("");
    // Unset all current
    await supabase.from("fw_fin_financial_years").update({ is_current: false }).eq("business_id", bizId);
    const { error: e } = await supabase.from("fw_fin_financial_years").update({ is_current: true }).eq("id", fyId);
    if (e) setError(e.message); else { setSuccess("Active financial year updated"); load(bizId); }
    setSaving(false);
  }

  // Lock = no new postings in this year from any path (app, AI, imports). Unlocking needs a reason.
  async function setLock(fy: FY, locked: boolean) {
    if (!bizId) return;
    let reason: string | null = null;
    if (locked) {
      if (!confirm(`Lock ${fy.label}? No entries can be posted into it until it's unlocked. Corrections then need an entry in an open year.`)) return;
    } else {
      reason = window.prompt(`Why are you unlocking ${fy.label}? This is recorded in the audit log.`)?.trim() ?? null;
      if (!reason) return;
    }
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/finance/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: bizId, fy_id: fy.id, locked, reason }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error ?? "Couldn't change the lock.");
    else { setSuccess(locked ? `${fy.label} locked` : `${fy.label} unlocked`); load(bizId); }
    setSaving(false);
  }
  const inputStyle = { background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.17)", color: "#141A3A", padding: "7px 10px", borderRadius: 6, fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(20,26,58,0.65)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#232A63", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>Financial Years</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNew(s => !s)} style={{ background: "#232A63", border: "none", color: "#F5F6FA", padding: "7px 16px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
          + New Financial Year
        </button>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Financial Year Management</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(20,26,58,0.65)", fontSize: "0.82rem" }}>Manage your accounting periods, switch active year, or close a completed year</p>

        {error && <div style={{ background: "rgba(194,50,31,0.1)", border: "1px solid rgba(194,50,31,0.3)", color: "#C2321F", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
        {success && <div style={{ background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.25)", color: "#0B7A55", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>✓ {success}</div>}

        {/* New FY form */}
        {showNew && (
          <div style={{ background: "rgba(35,42,99,0.06)", border: "1px solid rgba(35,42,99,0.2)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1rem" }}>Create New Financial Year</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} style={inputStyle} />
                <div style={{ fontSize: "0.68rem", color: "rgba(20,26,58,0.55)", marginTop: "0.25rem" }}>Usually April 1 for Indian FY</div>
              </div>
              <div>
                <label style={labelStyle}>Label</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. FY 2025-26" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={createFY} disabled={saving} style={{ background: "#232A63", border: "none", color: "#F5F6FA", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                {saving ? "Creating…" : "Create"}
              </button>
              <button onClick={() => setShowNew(false)} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.14)", color: "rgba(20,26,58,0.75)", padding: "8px 16px", borderRadius: 7, cursor: "pointer", fontSize: "0.85rem" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* FY list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {years.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem", color: "rgba(20,26,58,0.55)" }}>No financial years found. Create one above.</div>
          )}
          {years.map(fy => (
            <div key={fy.id} style={{
              background: "#FFFFFF",
              border: `1px solid ${fy.is_current ? "rgba(35,42,99,0.35)" : "rgba(20,26,58,0.10)"}`,
              borderRadius: 12, padding: "1rem 1.25rem",
              display: "flex", alignItems: "center", gap: "1rem",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: fy.is_current ? "#232A63" : "#141A3A" }}>{fy.label}</span>
                  {fy.is_current && <span style={{ fontSize: "0.65rem", background: "rgba(35,42,99,0.2)", color: "#232A63", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>ACTIVE</span>}
                  {(fy.is_locked || fy.is_closed) && <span title={fy.locked_at ? `Locked ${new Date(fy.locked_at).toLocaleString("en-IN")}` : undefined} style={{ fontSize: "0.65rem", background: fy.is_locked ? "rgba(194,50,31,0.1)" : "rgba(20,26,58,0.08)", color: fy.is_locked ? "#C2321F" : "rgba(20,26,58,0.60)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>{fy.is_locked ? "🔒 LOCKED" : "CLOSED (not locked)"}</span>}
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>
                  {new Date(fy.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  {" — "}
                  {new Date(fy.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {!fy.is_current && !fy.is_locked && (
                  <button onClick={() => setAsCurrent(fy.id)} disabled={saving} style={{ background: "rgba(35,42,99,0.1)", border: "1px solid rgba(35,42,99,0.25)", color: "#232A63", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
                    Set Active
                  </button>
                )}
                {fy.is_locked ? (
                  <button onClick={() => setLock(fy, false)} disabled={saving} style={{ background: "rgba(20,26,58,0.08)", border: "1px solid rgba(20,26,58,0.21)", color: "rgba(20,26,58,0.85)", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem" }}>
                    Unlock…
                  </button>
                ) : (
                  <button onClick={() => setLock(fy, true)} disabled={saving} style={{ background: "rgba(194,50,31,0.07)", border: "1px solid rgba(194,50,31,0.2)", color: "#C2321F", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem" }}>
                    🔒 Lock year
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "2rem", background: "rgba(31,94,255,0.05)", border: "1px solid rgba(31,94,255,0.12)", borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.8rem", color: "rgba(20,26,58,0.70)", lineHeight: 1.65 }}>
          <strong style={{ color: "#1F5EFF" }}>Note:</strong> Indian FY runs from April 1 to March 31. Locking a year blocks every new posting into it — from forms, FreBook, uploads and imports — and is recorded in the audit log. Only the owner or an admin can lock or unlock. You can have multiple open years, but only one can be active at a time.
        </div>
      </div>
    </div>
  );
}
