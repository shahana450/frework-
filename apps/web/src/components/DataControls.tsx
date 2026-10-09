"use client";
// Finance settings → "Your data": export everything (members) and delete the business (owner only).
// Both are promised in the Privacy Policy.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { deleteConfirmed, PURGE_AFTER_DAYS } from "@/lib/dataExport";
import { clearActiveBusiness } from "@/lib/activeBusiness";

const C = { surface: "#FFFFFF", line: "#E1E4EE", strong: "#C9CEDF", ink: "#141A3A", muted: "#5A6080", primary: "#232A63", pos: "#0B7A55", neg: "#C2321F", negSoft: "#FDECEA" };

export default function DataControls({ businessId, businessName, role }: { businessId: string; businessName: string; role: string }) {
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = role === "owner";
  const canExport = role !== "admin";   // members only

  async function exportAll() {
    setExporting(true); setMsg(null);
    try {
      const r = await fetch(`/api/finance/data-export?business_id=${businessId}`);
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg({ ok: false, text: d.error ?? "Couldn't prepare the export." }); return; }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "FreWork-data.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg({ ok: true, text: "Downloaded: a ZIP of CSV files (ledgers, entries, entry lines, parties)." });
    } catch { setMsg({ ok: false, text: "Network error — try again." }); }
    finally { setExporting(false); }
  }

  async function deleteBusiness() {
    if (!deleteConfirmed(confirm, businessName)) return;
    setDeleting(true); setMsg(null);
    const r = await fetch("/api/finance/business/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: businessId, confirm_name: confirm }) });
    const d = await r.json().catch(() => ({}));
    setDeleting(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't delete the business." }); return; }
    // Forget it as the active business on this device, then let the user pick another
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { clearActiveBusiness(user.id); }
    window.location.href = "/finance/select-business";
  }

  const btn = (primary: boolean, danger = false): React.CSSProperties => ({
    height: 42, padding: "0 18px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer",
    border: primary ? "none" : `1px solid ${danger ? C.neg : C.strong}`, background: primary ? (danger ? C.neg : C.primary) : C.surface,
    color: primary ? "#FFFFFF" : danger ? C.neg : C.ink,
  });

  return (
    <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>YOUR DATA</h2>

      {canExport && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 700 }}>Export all my data</div>
            <div style={{ fontSize: 13.5, color: C.muted }}>A ZIP of CSV files for {businessName || "this business"}: ledgers, entries, entry lines and parties.</div>
          </div>
          <button onClick={exportAll} disabled={exporting} style={btn(false)}>{exporting ? "Preparing…" : "⬇ Export all my data"}</button>
        </div>
      )}

      {isOwner && (
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, color: C.neg }}>Delete this business</div>
          <div style={{ fontSize: 13.5, color: C.muted }}>
            The business disappears for you and your team at once. Everything is erased for good after {PURGE_AFTER_DAYS} days; until then you can ask us to restore it.
            Export your data first if you may need it.
          </div>
          {!open ? <button onClick={() => setOpen(true)} style={{ ...btn(false, true), alignSelf: "flex-start" }}>Delete this business…</button> : (
            <div style={{ background: C.negSoft, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 13.5, color: C.ink }}>Type <b>{businessName}</b> to confirm</label>
              <input value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" aria-label="Business name to confirm"
                style={{ height: 42, borderRadius: 10, border: `1px solid ${C.neg}`, padding: "0 12px", fontSize: 15, color: C.ink, background: C.surface }} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={deleteBusiness} disabled={!deleteConfirmed(confirm, businessName) || deleting}
                  style={{ ...btn(true, true), opacity: deleteConfirmed(confirm, businessName) ? 1 : 0.45, cursor: deleteConfirmed(confirm, businessName) ? "pointer" : "not-allowed" }}>
                  {deleting ? "Deleting…" : "Delete this business"}
                </button>
                <button onClick={() => { setOpen(false); setConfirm(""); }} style={btn(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {msg && <div role="status" style={{ fontSize: 14, fontWeight: 600, color: msg.ok ? C.pos : C.neg }}>{msg.text}</div>}
    </section>
  );
}
