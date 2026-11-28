"use client";
import PageHero from "@/components/finance/PageHero";
import { cur, activeMoney } from "@/lib/money";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { readActiveBusiness } from "@/lib/activeBusiness";

type Row = {
  id: number; at: string; actor_name: string; action: string; source: string | null; reason: string | null;
  detail: Record<string, unknown> | null; journal_id: string | null; fw_fin_journals: { entry_no: string; narration: string | null } | null;
};

const BG = "#F4EFE4", BORDER = "#E6DFD0", TEXT = "#10241F", MUTED = "#6B7570";
const GOLD = "#9A6B22", GREEN = "#0B7A55", RED = "#B4321F", BLUE = "#9A6B22", AMBER = "#8A5A00";
const ACTIONS: Record<string, { label: string; color: string }> = {
  post: { label: "Posted", color: GREEN }, reverse: { label: "Reversed", color: RED }, lock_year: { label: "Locked year", color: AMBER },
  unlock_year: { label: "Unlocked year", color: AMBER }, tally_push: { label: "Pushed to Tally", color: BLUE },
  shelf_upload: { label: "Filed on the Shelf", color: TEXT }, connector_connect: { label: "Connected an app", color: BLUE },
  connector_disconnect: { label: "Disconnected an app", color: AMBER }, connector_file_import: { label: "Imported a file", color: BLUE },
};
// Anything not listed reads as words ("year_end_close" → "Year end close"), never a raw code
const actionLabel = (a: string) => ACTIONS[a] ?? { label: a.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), color: TEXT };
const SOURCES: Record<string, string> = {
  ai_copilot: "FreBook", statement: "Bank statement", ai_review: "Review queue", manual_journal: "Manual journal", sales_invoice: "Sales invoice",
  purchase_bill: "Purchase bill", expense: "Expense", payment_entry: "Payment", credit_note: "Credit note", debit_note: "Debit note",
  payroll: "Payroll", whatsapp: "WhatsApp", bank_import: "Bank import", reversal: "Reversal", correction: "Correction", settings: "Settings", integration: "Integration",
  shelf: "Shelf", connectors: "Integrations",
};

function describe(r: Row): string {
  const d = r.detail ?? {};
  if (r.action === "post") return `${d.entry_no ?? r.fw_fin_journals?.entry_no ?? ""} · ${cur()}${Number(d.total ?? 0).toLocaleString(activeMoney().locale)}${r.fw_fin_journals?.narration ? ` · ${r.fw_fin_journals.narration}` : ""}`;
  if (r.action === "reverse") return `${r.fw_fin_journals?.entry_no ?? "Entry"} reversed by ${d.reversal_entry ?? "a reversing entry"}`;
  if (r.action === "lock_year" || r.action === "unlock_year") return `FY ${d.fy ?? ""}`;
  if (r.action === "tally_push") return `${d.pushed ?? 0} pushed, ${d.failed ?? 0} failed${d.target ? ` → ${d.target}` : ""}`;
  if (r.action === "shelf_upload") return [d.title ?? d.file_name ?? d.name, d.rack ? `rack: ${d.rack}` : "", d.fy ? `FY ${d.fy}` : ""].filter(Boolean).join(" · ");
  if (r.action.startsWith("connector_")) return [d.provider, d.account, d.added != null ? `${d.added} added` : ""].filter(Boolean).join(" · ");
  return "";
}

export default function AuditLogPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [action, setAction] = useState("");
  const [more, setMore] = useState(true);

  const load = useCallback(async (bid: string, before?: string) => {
    setLoading(true); setError("");
    const res = await fetch(`/api/finance/audit-log?business_id=${bid}${action ? `&action=${action}` : ""}${before ? `&before=${encodeURIComponent(before)}` : ""}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error ?? "We couldn't load the audit log right now.");
    else {
      setSetupNeeded(!!d.setup_needed);
      setRows(prev => before ? [...prev, ...d.rows] : d.rows);
      setMore((d.rows ?? []).length === 100);
    }
    setLoading(false);
  }, [action]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (readActiveBusiness(user.id) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
    });
  }, [router]);
  useEffect(() => { if (bizId) load(bizId); }, [bizId, load]);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Book Antiqua','Palatino Linotype',Palatino,Georgia,serif" }}>
      <PageHero eyebrow="Books · Audit log" title="Who did" accent="what, and when"
        sub="Every posting, reversal, year lock and Tally push, with who did it and when. These records can't be edited or deleted from the app."
        actions={<select value={action} onChange={e => setAction(e.target.value)} style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "5px 10px", borderRadius: 7, fontSize: "0.8rem" }}>
          <option style={{ color: "#10241F" }} value="">All activity</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option style={{ color: "#10241F" }} key={k} value={k}>{v.label}</option>)}
        </select>} />
      <div style={{ maxWidth: 1050, margin: "0 auto", padding: "1.5rem" }}>
        {setupNeeded && <div style={{ padding: "0.8rem 1rem", border: `1px solid rgba(184,120,0,0.3)`, borderRadius: 8, color: AMBER, fontSize: "0.82rem", marginBottom: "1rem" }}>The audit log starts recording once the Phase 1 database update (2026-10-03_phase1_posting_engine.sql) has been run in Supabase.</div>}
        {error && <div style={{ padding: "0.8rem 1rem", border: `1px solid rgba(194,50,31,0.3)`, borderRadius: 8, color: RED, fontSize: "0.82rem", marginBottom: "1rem" }}>{error}</div>}
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 20, overflowX: "auto", background: "#FFFDF8" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 760 }}>
            <thead><tr style={{ background: "#FFFFFF" }}>
              {["When", "Who", "What", "Source", "Details", "Reason"].map(h => <th key={h} style={{ textAlign: "left", padding: "0.55rem 0.8rem", color: MUTED, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const a = actionLabel(r.action);
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "0.5rem 0.8rem", whiteSpace: "nowrap", color: MUTED }}>{new Date(r.at).toLocaleString(activeMoney().locale, { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "0.5rem 0.8rem", whiteSpace: "nowrap" }}>{r.actor_name}</td>
                    <td style={{ padding: "0.5rem 0.8rem", whiteSpace: "nowrap", color: a.color, fontWeight: 700 }}>{a.label}</td>
                    <td style={{ padding: "0.5rem 0.8rem", whiteSpace: "nowrap", color: MUTED }}>{SOURCES[r.source ?? ""] ?? r.source ?? "—"}</td>
                    <td style={{ padding: "0.5rem 0.8rem", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.journal_id ? <Link href={`/finance/entry/${r.journal_id}`} style={{ color: BLUE, textDecoration: "none" }}>{describe(r)}</Link> : describe(r)}
                    </td>
                    <td style={{ padding: "0.5rem 0.8rem", color: MUTED, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && !setupNeeded && <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: MUTED }}>No activity recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          {loading ? <span style={{ color: MUTED, fontSize: "0.82rem" }}>Loading…</span>
            : more && rows.length > 0 && <button onClick={() => bizId && load(bizId, rows[rows.length - 1].at)} style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, color: TEXT, padding: "7px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Load older</button>}
        </div>
      </div>
    </div>
  );
}
