"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  ai_generated: boolean;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  journal: "Journal", payment: "Payment", receipt: "Receipt",
  sales: "Sales", purchase: "Purchase", contra: "Contra",
  debit_note: "Debit Note", credit_note: "Credit Note",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#f59e0b", posted: "#4ade80", voided: "#f87171",
};

export default function JournalsPage() {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [bizId, setBizId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "posted">("all");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem() ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data } = await supabase.from("fw_fin_journals")
        .select("id,entry_no,date,narration,type,status,total_debit,total_credit,ai_generated,created_at")
        .eq("business_id", saved)
        .order("date", { ascending: false });
      setJournals(data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? journals : journals.filter(j => j.status === filter);
  const totalDebit = filtered.reduce((a, j) => a + (j.total_debit || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Journal Entries</span>
        <div style={{ flex: 1 }} />
        <Link href="/finance/journals/new" style={{ background: "#C9A84C", color: "#070C1A", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>
          + New Entry
        </Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.4rem", fontWeight: 800 }}>Journal Entries</h1>
            <div style={{ fontSize: "0.82rem", color: "rgba(237,232,220,0.4)" }}>{filtered.length} entries · Total: ₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["all", "draft", "posted"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${filter === f ? "rgba(201,168,76,0.4)" : "rgba(237,232,220,0.1)"}`,
                color: filter === f ? "#C9A84C" : "rgba(237,232,220,0.5)",
                padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.8rem", textTransform: "capitalize",
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Entry No", "Date", "Type", "Narration", "Debit (₹)", "Credit (₹)", "Status", "Source"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.7rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id} style={{ borderTop: "1px solid rgba(237,232,220,0.05)", cursor: "pointer" }}>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.8rem", fontFamily: "monospace", color: "#C9A84C" }}>{j.entry_no}</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.8rem", color: "rgba(237,232,220,0.6)", whiteSpace: "nowrap" }}>
                      {new Date(j.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span style={{ fontSize: "0.72rem", background: "rgba(237,232,220,0.06)", color: "rgba(237,232,220,0.5)", padding: "2px 7px", borderRadius: 4 }}>
                        {TYPE_LABEL[j.type] ?? j.type}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.narration}</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                      {j.total_debit?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "—"}
                    </td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                      {j.total_credit?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "—"}
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span style={{ color: STATUS_COLOR[j.status] ?? "#EDE8DC", background: `${STATUS_COLOR[j.status] ?? "#EDE8DC"}15`, padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 600 }}>
                        {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      {j.ai_generated && <span style={{ fontSize: "0.7rem", color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "2px 7px", borderRadius: 4 }}>🤖 AI</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
