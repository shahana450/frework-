"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type FY = { id: string; label: string; start_date: string; end_date: string; is_current: boolean; is_closed: boolean };

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
      const saved = (localStorage.getItem(`fw_fin_biz_$user.id`) ?? "").replace(/\uFEFF/g, "").trim();
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
      label: newLabel,
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

  async function closeFY(fyId: string) {
    if (!bizId) return;
    if (!confirm("Close this financial year? It will become read-only. Journals posted in this period cannot be edited.")) return;
    setSaving(true); setError("");
    await supabase.from("fw_fin_financial_years").update({ is_closed: true, is_current: false }).eq("id", fyId);
    setSuccess("Financial year closed");
    load(bizId);
    setSaving(false);
  }

  const inputStyle = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 10px", borderRadius: 6, fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.3rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>â€º</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Financial Years</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNew(s => !s)} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "7px 16px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
          + New Financial Year
        </button>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>Financial Year Management</h1>
        <p style={{ margin: "0 0 1.5rem", color: "rgba(237,232,220,0.4)", fontSize: "0.82rem" }}>Manage your accounting periods, switch active year, or close a completed year</p>

        {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}
        {success && <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>âœ“ {success}</div>}

        {/* New FY form */}
        {showNew && (
          <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1rem" }}>Create New Financial Year</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} style={inputStyle} />
                <div style={{ fontSize: "0.68rem", color: "rgba(237,232,220,0.3)", marginTop: "0.25rem" }}>Usually April 1 for Indian FY</div>
              </div>
              <div>
                <label style={labelStyle}>Label</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. FY 2025-26" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={createFY} disabled={saving} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                {saving ? "Creatingâ€¦" : "Create"}
              </button>
              <button onClick={() => setShowNew(false)} style={{ background: "rgba(237,232,220,0.05)", border: "1px solid rgba(237,232,220,0.1)", color: "rgba(237,232,220,0.5)", padding: "8px 16px", borderRadius: 7, cursor: "pointer", fontSize: "0.85rem" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* FY list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {years.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem", color: "rgba(237,232,220,0.3)" }}>No financial years found. Create one above.</div>
          )}
          {years.map(fy => (
            <div key={fy.id} style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${fy.is_current ? "rgba(201,168,76,0.35)" : "rgba(237,232,220,0.07)"}`,
              borderRadius: 12, padding: "1rem 1.25rem",
              display: "flex", alignItems: "center", gap: "1rem",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: fy.is_current ? "#C9A84C" : "#EDE8DC" }}>{fy.label}</span>
                  {fy.is_current && <span style={{ fontSize: "0.65rem", background: "rgba(201,168,76,0.2)", color: "#C9A84C", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>ACTIVE</span>}
                  {fy.is_closed && <span style={{ fontSize: "0.65rem", background: "rgba(237,232,220,0.06)", color: "rgba(237,232,220,0.35)", padding: "2px 8px", borderRadius: 8 }}>CLOSED</span>}
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>
                  {new Date(fy.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  {" â€” "}
                  {new Date(fy.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {!fy.is_current && !fy.is_closed && (
                  <button onClick={() => setAsCurrent(fy.id)} disabled={saving} style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
                    Set Active
                  </button>
                )}
                {!fy.is_closed && (
                  <button onClick={() => closeFY(fy.id)} disabled={saving} style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem" }}>
                    Close Year
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "2rem", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.8rem", color: "rgba(237,232,220,0.45)", lineHeight: 1.65 }}>
          <strong style={{ color: "#60a5fa" }}>Note:</strong> Indian FY runs from April 1 to March 31. Closing a year marks it read-only â€” all journals in that period are locked. You can have multiple open years, but only one can be active at a time.
        </div>
      </div>
    </div>
  );
}

