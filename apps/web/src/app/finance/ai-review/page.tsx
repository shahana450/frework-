"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Link from "next/link";

type SugLine = { account_name: string; dr: number; cr: number };
type Suggestion = {
  id: string;
  created_at: string;
  suggested_type: string;
  suggested_narration: string;
  suggested_lines: SugLine[];
  confidence: number;
  status: string;
  document_id: string;
  fw_fin_documents: {
    file_name: string;
    doc_type: string;
    ai_summary: { vendor?: string; amount?: number; date?: string; gst?: number } | null;
  } | null;
};

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  sales: { label: "Sales Entry", color: "#4ade80" },
  purchase: { label: "Purchase Entry", color: "#60a5fa" },
  expense: { label: "Expense Entry", color: "#f59e0b" },
  payment: { label: "Payment", color: "#a78bfa" },
  receipt: { label: "Receipt", color: "#34d399" },
};

export default function AIReviewPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [bizId, setBizId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<Record<string, SugLine[]>>({});
  const [editNarration, setEditNarration] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "accepted" | "rejected">("pending");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem() ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      loadSuggestions(saved);
    });
  }, []);

  async function loadSuggestions(bid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("fw_fin_ai_suggestions")
      .select(`id,created_at,suggested_type,suggested_narration,suggested_lines,confidence,status,document_id,
        fw_fin_documents(file_name,doc_type,ai_summary)`)
      .eq("business_id", bid)
      .order("created_at", { ascending: false });
    setSuggestions((data as unknown as Suggestion[]) ?? []);
    setLoading(false);
  }

  function toggleExpand(id: string, s: Suggestion) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!editLines[id]) setEditLines(prev => ({ ...prev, [id]: [...(s.suggested_lines ?? [])] }));
    if (!editNarration[id]) setEditNarration(prev => ({ ...prev, [id]: s.suggested_narration }));
  }

  async function accept(s: Suggestion) {
    if (!bizId) return;
    setSaving(s.id);
    try {
      const lines = editLines[s.id] ?? s.suggested_lines ?? [];
      const narration = editNarration[s.id] ?? s.suggested_narration;
      const totalDr = lines.reduce((a, l) => a + (l.dr ?? 0), 0);
      const totalCr = lines.reduce((a, l) => a + (l.cr ?? 0), 0);

      if (Math.abs(totalDr - totalCr) > 0.01) {
        alert(`Debit (₹${totalDr.toLocaleString("en-IN")}) ≠ Credit (₹${totalCr.toLocaleString("en-IN")}). Please balance the entry.`);
        setSaving(null); return;
      }

      // Get current FY
      const { data: fy } = await supabase.from("fw_fin_financial_years").select("id").eq("business_id", bizId).eq("is_current", true).single();

      // Get CoA for name→id mapping
      const { data: coa } = await supabase.from("fw_fin_chart_of_accounts").select("id,name").eq("business_id", bizId);
      const coaMap: Record<string, string> = {};
      (coa ?? []).forEach(a => { coaMap[a.name] = a.id; });

      // Create journal
      const { data: journal, error: jErr } = await supabase.from("fw_fin_journals").insert({
        business_id: bizId,
        financial_year_id: fy?.id ?? null,
        entry_no: `JE/${Date.now()}`,
        date: s.fw_fin_documents?.ai_summary?.date ?? new Date().toISOString().split("T")[0],
        narration,
        type: s.suggested_type,
        status: "posted",
        total_debit: totalDr,
        total_credit: totalCr,
        document_id: s.document_id,
        ai_generated: true,
      }).select("id").single();

      if (jErr) throw new Error(jErr.message);

      // Create journal lines
      await supabase.from("fw_fin_journal_lines").insert(
        lines.map((l, i) => ({
          journal_id: journal.id,
          account_id: coaMap[l.account_name] ?? null,
          dr_amount: l.dr ?? 0,
          cr_amount: l.cr ?? 0,
          narration: l.account_name,
          sort_order: i,
        }))
      );

      // Update suggestion & document status
      await Promise.all([
        supabase.from("fw_fin_ai_suggestions").update({ status: "accepted", journal_id: journal.id, accepted_at: new Date().toISOString() }).eq("id", s.id),
        supabase.from("fw_fin_documents").update({ status: "posted", journal_id: journal.id }).eq("id", s.document_id),
      ]);

      setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: "accepted" } : x));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error creating journal");
    } finally {
      setSaving(null);
    }
  }

  async function reject(id: string) {
    await supabase.from("fw_fin_ai_suggestions").update({ status: "rejected" }).eq("id", id);
    setSuggestions(prev => prev.map(x => x.id === id ? { ...x, status: "rejected" } : x));
  }

  const filtered = suggestions.filter(s => s.status === filter);
  const pendingCount = suggestions.filter(s => s.status === "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>AI Review Queue</span>
        {pendingCount > 0 && <span style={{ background: "#C9A84C", color: "#070C1A", fontSize: "0.7rem", fontWeight: 800, padding: "2px 7px", borderRadius: 10 }}>{pendingCount}</span>}
        <div style={{ flex: 1 }} />
        <Link href="/finance/upload" style={{ background: "#C9A84C", color: "#070C1A", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>+ Upload</Link>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.4rem", fontWeight: 800 }}>AI Journal Suggestions</h1>
          <p style={{ margin: 0, color: "rgba(237,232,220,0.5)", fontSize: "0.85rem" }}>
            Review AI-suggested journal entries from your uploaded documents. You have final authority — edit or reject before posting.
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {(["pending", "accepted", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "#C9A84C" : "rgba(237,232,220,0.06)",
              border: "none", color: filter === f ? "#070C1A" : "rgba(237,232,220,0.5)",
              padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.82rem",
              textTransform: "capitalize",
            }}>
              {f} {f === "pending" && pendingCount > 0 ? `(${pendingCount})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "rgba(237,232,220,0.3)" }}>Loading suggestions…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
              {filter === "pending" ? "🤖" : filter === "accepted" ? "✅" : "❌"}
            </div>
            <div style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.9rem" }}>
              {filter === "pending" ? "No pending suggestions. Upload documents to get started." : `No ${filter} suggestions.`}
            </div>
            {filter === "pending" && <Link href="/finance/upload" style={{ display: "inline-block", marginTop: "1rem", color: "#C9A84C", fontSize: "0.85rem" }}>Upload documents →</Link>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filtered.map(s => {
              const isExp = expanded === s.id;
              const lines = editLines[s.id] ?? s.suggested_lines ?? [];
              const narration = editNarration[s.id] ?? s.suggested_narration;
              const totalDr = lines.reduce((a, l) => a + (l.dr ?? 0), 0);
              const totalCr = lines.reduce((a, l) => a + (l.cr ?? 0), 0);
              const balanced = Math.abs(totalDr - totalCr) < 0.01;
              const tinfo = TYPE_LABEL[s.suggested_type] ?? { label: s.suggested_type, color: "#EDE8DC" };

              return (
                <div key={s.id} style={{
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${s.status === "accepted" ? "rgba(74,222,128,0.2)" : s.status === "rejected" ? "rgba(248,113,113,0.1)" : isExp ? "rgba(201,168,76,0.25)" : "rgba(237,232,220,0.08)"}`,
                  borderRadius: 12, overflow: "hidden",
                }}>
                  {/* Header */}
                  <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }} onClick={() => toggleExpand(s.id, s)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem" }}>
                        <span style={{ background: `${tinfo.color}18`, color: tinfo.color, fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em" }}>
                          {tinfo.label}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.35)" }}>
                          {Math.round(s.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {narration}
                      </div>
                      {s.fw_fin_documents && (
                        <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>
                          {s.fw_fin_documents.file_name}
                          {s.fw_fin_documents.ai_summary?.amount && ` · ₹${s.fw_fin_documents.ai_summary.amount.toLocaleString("en-IN")}`}
                          {s.fw_fin_documents.ai_summary?.date && ` · ${s.fw_fin_documents.ai_summary.date}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                      {s.status === "pending" && (
                        <>
                          <button onClick={e => { e.stopPropagation(); reject(s.id); }} style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
                            Reject
                          </button>
                          <button onClick={e => { e.stopPropagation(); accept(s); }} disabled={saving === s.id} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem", opacity: saving === s.id ? 0.7 : 1 }}>
                            {saving === s.id ? "Posting…" : "✓ Accept"}
                          </button>
                        </>
                      )}
                      {s.status !== "pending" && (
                        <span style={{ fontSize: "0.8rem", color: s.status === "accepted" ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                          {s.status === "accepted" ? "✓ Posted" : "✕ Rejected"}
                        </span>
                      )}
                      <span style={{ color: "rgba(237,232,220,0.3)", fontSize: "0.9rem" }}>{isExp ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded: journal lines editor */}
                  {isExp && (
                    <div style={{ borderTop: "1px solid rgba(237,232,220,0.08)", padding: "1rem 1.25rem", background: "rgba(0,0,0,0.2)" }}>
                      {/* Narration editor */}
                      <div style={{ marginBottom: "1rem" }}>
                        <label style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Narration</label>
                        <input
                          value={narration}
                          onChange={e => setEditNarration(prev => ({ ...prev, [s.id]: e.target.value }))}
                          style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "7px 12px", borderRadius: 6, fontSize: "0.85rem", boxSizing: "border-box" }}
                        />
                      </div>

                      {/* Journal Lines */}
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                        <thead>
                          <tr>
                            {["Account", "Dr (₹)", "Cr (₹)", ""].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "rgba(237,232,220,0.4)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line, li) => (
                            <tr key={li} style={{ borderTop: "1px solid rgba(237,232,220,0.05)" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  value={line.account_name}
                                  onChange={e => {
                                    const updated = lines.map((l, i) => i === li ? { ...l, account_name: e.target.value } : l);
                                    setEditLines(prev => ({ ...prev, [s.id]: updated }));
                                  }}
                                  style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", padding: "4px 8px", borderRadius: 4, fontSize: "0.82rem" }}
                                />
                              </td>
                              {(["dr", "cr"] as const).map(side => (
                                <td key={side} style={{ padding: "6px 8px", width: 100 }}>
                                  <input
                                    type="number"
                                    value={line[side] || ""}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0;
                                      const updated = lines.map((l, i) => i === li ? { ...l, [side]: v } : l);
                                      setEditLines(prev => ({ ...prev, [s.id]: updated }));
                                    }}
                                    style={{ width: "100%", background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", padding: "4px 8px", borderRadius: 4, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}
                                  />
                                </td>
                              ))}
                              <td style={{ padding: "6px 8px" }}>
                                <button onClick={() => setEditLines(prev => ({ ...prev, [s.id]: lines.filter((_, i) => i !== li) }))} style={{ background: "none", border: "none", color: "rgba(237,232,220,0.3)", cursor: "pointer", fontSize: "0.9rem" }}>×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid rgba(237,232,220,0.12)" }}>
                            <td style={{ padding: "6px 8px", fontWeight: 700, fontSize: "0.82rem" }}>Total</td>
                            <td style={{ padding: "6px 8px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#EDE8DC" }}>
                              {totalDr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "6px 8px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#EDE8DC" }}>
                              {totalCr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "6px 8px", fontSize: "0.75rem", color: balanced ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                              {balanced ? "✓ Balanced" : "⚠ Unbalanced"}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      <button onClick={() => setEditLines(prev => ({ ...prev, [s.id]: [...lines, { account_name: "", dr: 0, cr: 0 }] }))} style={{ marginTop: "0.5rem", background: "none", border: "1px dashed rgba(237,232,220,0.2)", color: "rgba(237,232,220,0.4)", padding: "4px 12px", borderRadius: 5, cursor: "pointer", fontSize: "0.78rem" }}>
                        + Add Line
                      </button>

                      {s.status === "pending" && (
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
                          <button onClick={() => reject(s.id)} style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", padding: "7px 18px", borderRadius: 7, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                            Reject
                          </button>
                          <button onClick={() => accept(s)} disabled={saving === s.id || !balanced} style={{ background: "#C9A84C", border: "none", color: "#070C1A", padding: "7px 20px", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", opacity: (saving === s.id || !balanced) ? 0.6 : 1 }}>
                            {saving === s.id ? "Posting…" : "✓ Accept & Post Journal"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
