"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Journal = {
  id: string;
  entry_no: string;
  date: string;
  narration: string;
  type: string;
  status: string;
  total_debit: number;
  total_credit: number;
  reference_no: string | null;
  ai_generated: boolean;
  created_at: string;
};

type JournalLine = {
  id: string;
  account_id: string;
  narration: string;
  dr_amount: number;
  cr_amount: number;
  account?: { name: string; type: string };
};

const TYPE_LABEL: Record<string, string> = {
  journal: "Journal", payment: "Payment", receipt: "Receipt",
  sales: "Sales", purchase: "Purchase", contra: "Contra",
  debit_note: "Debit Note", credit_note: "Credit Note", expense: "Expense",
};

const TYPE_COLOR: Record<string, string> = {
  sales: "#34D399", receipt: "#34D399", income: "#34D399",
  payment: "#F87171", purchase: "#F87171", expense: "#F87171",
  debit_note: "#FBBF24", credit_note: "#FBBF24",
  journal: "#60A5FA", contra: "#A78BFA",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#f59e0b", posted: "#4ade80", voided: "#f87171",
};

const TYPE_TITLES: Record<string, string> = {
  sales: "Sales Transactions", receipt: "Receipts", payment: "Payments",
  purchase: "Purchase Entries", expense: "Expenses", journal: "Journal Entries",
  contra: "Contra Entries", debit_note: "Debit Notes", credit_note: "Credit Notes",
};

const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function JournalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const idParam = searchParams.get("id") ?? "";

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [bizId, setBizId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "posted">("all");

  // Detail drawer state
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [drawerLines, setDrawerLines] = useState<JournalLine[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (statusParam === "draft") setFilter("draft");
    else if (statusParam === "posted") setFilter("posted");
  }, [statusParam]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_journals")
        .select("id,entry_no,date,narration,type,status,total_debit,total_credit,reference_no,ai_generated,created_at")
        .eq("business_id", saved)
        .order("date", { ascending: false });
      const rows = data ?? [];
      setJournals(rows);
      setLoading(false);

      // Auto-open drawer if ?id= is set
      if (idParam) {
        const match = rows.find(j => j.id === idParam);
        if (match) openDrawer(match);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll highlighted row into view once list renders
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [journals, idParam]);

  async function openDrawer(j: Journal) {
    setSelectedJournal(j);
    setDrawerLines([]);
    setDrawerLoading(true);
    const { data: lines } = await supabase
      .from("fw_fin_journal_lines")
      .select("id,account_id,narration,dr_amount,cr_amount")
      .eq("journal_id", j.id);
    if (lines?.length) {
      const accIds = [...new Set(lines.map(l => l.account_id))];
      const { data: accs } = await supabase.from("fw_fin_chart_of_accounts").select("id,name,type").in("id", accIds);
      const accMap = new Map((accs ?? []).map(a => [a.id, a]));
      setDrawerLines(lines.map(l => ({ ...l, account: accMap.get(l.account_id) })));
    }
    setDrawerLoading(false);
  }

  function closeDrawer() {
    setSelectedJournal(null);
    setDrawerLines([]);
  }

  const typeFilter = typeParam ? typeParam.split(",").map(t => t.trim()).filter(Boolean) : [];
  const afterTypeFilter = typeFilter.length > 0 ? journals.filter(j => typeFilter.includes(j.type)) : journals;
  const filtered = filter === "all" ? afterTypeFilter : afterTypeFilter.filter(j => j.status === filter);
  const pageTitle = typeFilter.length === 1 ? (TYPE_TITLES[typeFilter[0]] ?? "Journal Entries") : "Journal Entries";
  const totalDebit = filtered.reduce((a, j) => a + (j.total_debit || 0), 0);

  const referer = searchParams.get("from") ?? "";

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .jrow:hover td { background: rgba(201,168,76,0.04); }
        .jrow-hl td { background: rgba(201,168,76,0.06) !important; outline: 1px solid rgba(201,168,76,0.25); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56, position: "sticky", top: 0, background: "rgba(7,12,26,0.95)", backdropFilter: "blur(12px)", zIndex: 30 }}>
        {referer === "audit" ? (
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#C9A84C", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>← Back to Audit</button>
        ) : (
          <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        )}
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>{pageTitle}</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/journals/new" style={{ background: "#C9A84C", color: "#070C1A", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>
          + New Entry
        </Link>
      </nav>

      <div style={{ maxWidth: selectedJournal ? 1300 : 1100, margin: "0 auto", padding: "2rem", display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

        {/* Main list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: 800 }}>{pageTitle}</h1>
              <div style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.4)" }}>{filtered.length} entries · Total: ₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["all", "draft", "posted"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === f ? "rgba(201,168,76,0.4)" : "rgba(237,232,220,0.1)"}`,
                  color: filter === f ? "#C9A84C" : "rgba(237,232,220,0.5)",
                  padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.8rem", textTransform: "capitalize", fontFamily: "inherit",
                }}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "4rem", textAlign: "center", color: "rgba(237,232,220,0.3)" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "4rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📒</div>
                <div style={{ color: "rgba(237,232,220,0.4)", marginBottom: "1rem" }}>No journal entries yet.</div>
                <Link href="/finance/upload" style={{ color: "#C9A84C", fontSize: "0.85rem" }}>Upload documents to auto-generate entries →</Link>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["Entry No", "Date", "Type", "Narration", "Debit (₹)", "Credit (₹)", "Status", ""].map(h => (
                        <th key={h} style={{ padding: "0.6rem 1rem", textAlign: h === "Debit (₹)" || h === "Credit (₹)" ? "right" : "left", fontSize: "0.68rem", color: "rgba(237,232,220,0.35)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(j => {
                      const isHighlighted = j.id === idParam;
                      const isSelected = selectedJournal?.id === j.id;
                      return (
                        <tr
                          key={j.id}
                          ref={isHighlighted ? highlightRef : null}
                          className={`jrow${isHighlighted || isSelected ? " jrow-hl" : ""}`}
                          onClick={() => openDrawer(j)}
                          style={{ borderTop: "1px solid rgba(237,232,220,0.05)", cursor: "pointer" }}
                        >
                          <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", fontFamily: "'IBM Plex Mono',monospace", color: "#C9A84C", whiteSpace: "nowrap" }}>{j.entry_no}</td>
                          <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.55)", whiteSpace: "nowrap" }}>
                            {new Date(j.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                          <td style={{ padding: "0.65rem 1rem" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: TYPE_COLOR[j.type] ?? "#EDE8DC", background: `${TYPE_COLOR[j.type] ?? "#EDE8DC"}15`, padding: "2px 8px", borderRadius: 4 }}>
                              {TYPE_LABEL[j.type] ?? j.type}
                            </span>
                          </td>
                          <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", maxWidth: selectedJournal ? 160 : 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                          <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", fontFamily: "'IBM Plex Mono',monospace", textAlign: "right", color: "#F87171" }}>
                            {j.total_debit ? j.total_debit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
                          </td>
                          <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", fontFamily: "'IBM Plex Mono',monospace", textAlign: "right", color: "#34D399" }}>
                            {j.total_credit ? j.total_credit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
                          </td>
                          <td style={{ padding: "0.65rem 1rem" }}>
                            <span style={{ color: STATUS_COLOR[j.status] ?? "#EDE8DC", background: `${STATUS_COLOR[j.status] ?? "#EDE8DC"}18`, padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700 }}>
                              {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem" }}>
                            {j.ai_generated && <span style={{ fontSize: "0.68rem", color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "2px 6px", borderRadius: 4 }}>AI</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Detail drawer panel */}
        {selectedJournal && (
          <div style={{ width: 380, flexShrink: 0, position: "sticky", top: 72, animation: "slideIn 0.2s ease-out" }}>
            <div style={{ background: "#0B1221", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 14, overflow: "hidden" }}>

              {/* Drawer header */}
              <div style={{ padding: "1rem 1.1rem 0.85rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#C9A84C", fontSize: "0.82rem", fontWeight: 600, marginBottom: 4 }}>{selectedJournal.entry_no}</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#EDE8DC", lineHeight: 1.4, wordBreak: "break-word" }}>{selectedJournal.narration || "—"}</div>
                </div>
                <button onClick={closeDrawer} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(237,232,220,0.5)", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
              </div>

              {/* Meta row */}
              <div style={{ padding: "0.75rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.5)" }}>
                  {new Date(selectedJournal.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: TYPE_COLOR[selectedJournal.type] ?? "#EDE8DC", background: `${TYPE_COLOR[selectedJournal.type] ?? "#EDE8DC"}15`, padding: "1px 8px", borderRadius: 4 }}>
                  {TYPE_LABEL[selectedJournal.type] ?? selectedJournal.type}
                </span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STATUS_COLOR[selectedJournal.status], background: `${STATUS_COLOR[selectedJournal.status]}18`, padding: "1px 8px", borderRadius: 4 }}>
                  {selectedJournal.status}
                </span>
                {selectedJournal.reference_no && (
                  <span style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)" }}>Ref: {selectedJournal.reference_no}</span>
                )}
              </div>

              {/* Totals */}
              <div style={{ padding: "0.75rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "1.5rem" }}>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Total Debit</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#F87171" }}>{fmt(selectedJournal.total_debit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Total Credit</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#34D399" }}>{fmt(selectedJournal.total_credit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Difference</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1rem", fontWeight: 700, color: Math.abs(selectedJournal.total_debit - selectedJournal.total_credit) < 1 ? "#34D399" : "#F87171" }}>
                    {fmt(Math.abs(selectedJournal.total_debit - selectedJournal.total_credit))}
                  </div>
                </div>
              </div>

              {/* Journal lines */}
              <div style={{ padding: "0.75rem 1.1rem 0.5rem" }}>
                <div style={{ fontSize: "0.65rem", color: "rgba(237,232,220,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "0.6rem" }}>Double-Entry Lines</div>
                {drawerLoading ? (
                  <div style={{ color: "rgba(237,232,220,0.3)", fontSize: "0.8rem", padding: "1rem 0" }}>Loading lines…</div>
                ) : drawerLines.length === 0 ? (
                  <div style={{ color: "rgba(237,232,220,0.3)", fontSize: "0.8rem", padding: "0.5rem 0" }}>No line items found.</div>
                ) : (
                  <div>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.62rem", color: "rgba(237,232,220,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Account</span>
                      <span style={{ fontSize: "0.62rem", color: "#F87171", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Debit</span>
                      <span style={{ fontSize: "0.62rem", color: "#34D399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Credit</span>
                    </div>
                    {drawerLines.map((l, i) => (
                      <div key={l.id ?? i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "0.5rem", padding: "0.42rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div>
                          <div style={{ fontSize: "0.8rem", color: "#EDE8DC", fontWeight: 500 }}>{l.account?.name ?? l.account_id.slice(0, 8)}</div>
                          {l.account?.type && <div style={{ fontSize: "0.65rem", color: "rgba(237,232,220,0.3)", marginTop: 1 }}>{l.account.type}</div>}
                          {l.narration && l.narration !== l.account?.name && (
                            <div style={{ fontSize: "0.66rem", color: "rgba(237,232,220,0.35)", marginTop: 1, fontStyle: "italic" }}>{l.narration}</div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", color: l.dr_amount > 0 ? "#F87171" : "rgba(237,232,220,0.2)", fontWeight: l.dr_amount > 0 ? 600 : 400 }}>
                          {l.dr_amount > 0 ? l.dr_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", color: l.cr_amount > 0 ? "#34D399" : "rgba(237,232,220,0.2)", fontWeight: l.cr_amount > 0 ? 600 : 400 }}>
                          {l.cr_amount > 0 ? l.cr_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
                        </div>
                      </div>
                    ))}
                    {/* Totals footer */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "0.5rem", padding: "0.5rem 0 0.25rem", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(237,232,220,0.5)" }}>Total</span>
                      <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", fontWeight: 700, color: "#F87171" }}>
                        {drawerLines.reduce((s, l) => s + (l.dr_amount || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.78rem", fontWeight: 700, color: "#34D399" }}>
                        {drawerLines.reduce((s, l) => s + (l.cr_amount || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ padding: "0.75rem 1.1rem 1rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "0.6rem" }}>
                <Link href={`/finance/journals/${selectedJournal.id}/edit`} style={{ flex: 1, textAlign: "center", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "7px 0", borderRadius: 7, fontWeight: 700, fontSize: "0.78rem", textDecoration: "none" }}>
                  Edit Entry
                </Link>
                <button onClick={closeDrawer} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(237,232,220,0.5)", padding: "7px 0", borderRadius: 7, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
