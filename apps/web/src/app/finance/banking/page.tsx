"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BankStat = {
  name: string;
  totalIn: number;
  totalOut: number;
  txCount: number;
};

export default function BankingLanding() {
  const [stats, setStats] = useState<BankStat[]>([]);
  const [recentCount, setRecentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const bizId = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").trim();
      if (!bizId) { setLoading(false); return; }

      // Load bank/cash accounts + recent journal count with bank lines
      const { data: bankAccounts } = await supabase
        .from("fw_fin_chart_of_accounts")
        .select("id,name")
        .eq("business_id", bizId)
        .in("type", ["bank", "cash"])
        .eq("is_group", false);

      if (bankAccounts?.length) {
        const accountIds = bankAccounts.map(a => a.id);
        const { data: lines } = await supabase
          .from("fw_fin_journal_lines")
          .select("account_id, dr_amount, cr_amount, fw_fin_journals!inner(business_id, source)")
          .in("account_id", accountIds)
          .eq("fw_fin_journals.business_id", bizId);

        const statMap: Record<string, BankStat> = {};
        for (const a of bankAccounts) {
          statMap[a.id] = { name: a.name, totalIn: 0, totalOut: 0, txCount: 0 };
        }
        for (const l of (lines ?? [])) {
          const s = statMap[l.account_id];
          if (!s) continue;
          s.totalIn += l.cr_amount ?? 0;
          s.totalOut += l.dr_amount ?? 0;
          s.txCount += 1;
        }
        setStats(Object.values(statMap).filter(s => s.txCount > 0 || true));
      }

      // Recent imports count (journals with source = 'bank_import')
      const { count } = await supabase
        .from("fw_fin_journals")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bizId)
        .eq("source", "bank_import");
      setRecentCount(count ?? 0);
      setLoading(false);
    });
  }, []);

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ minHeight: "100vh", background: "#05091A", color: "#DEE8F5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .bk-card { background: #0B1428; border: 1px solid #1B2E4A; border-radius: 14px; padding: 1.25rem 1.4rem; }
        .bk-action { background: #0B1428; border: 1px solid #1B2E4A; border-radius: 14px; padding: 1.4rem; text-decoration: none; display: flex; flex-direction: column; gap: 0.5rem; transition: border-color 0.2s, transform 0.15s; }
        .bk-action:hover { border-color: #2563EB; transform: translateY(-2px); }
        .bg-dots { background-image: radial-gradient(circle, rgba(59,130,246,0.05) 1px, transparent 1px); background-size: 28px 28px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "rgba(5,9,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1B2E4A", padding: "0 2rem", height: 52, display: "flex", alignItems: "center", gap: "0.75rem", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/finance" style={{ color: "#4A6FA5", textDecoration: "none", fontSize: "0.82rem" }}>Finance</Link>
        <span style={{ color: "#2A4060" }}>›</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Banking</span>
      </div>

      <div className="bg-dots" style={{ minHeight: "calc(100vh - 52px)", padding: "2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Page title */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#1E3A6B,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>🏦</div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Banking</h1>
              <p style={{ margin: 0, color: "#4A6FA5", fontSize: "0.84rem" }}>Import bank statements, assign ledgers, and push to your books automatically.</p>
            </div>
          </div>

          {/* Quick action cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
            <Link href="/finance/banking/import" className="bk-action">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>⬆</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#DEE8F5" }}>Import Statement</div>
              <div style={{ fontSize: "0.76rem", color: "#4A6FA5", lineHeight: 1.5 }}>Upload PDF or Excel bank statement. AI parses it instantly.</div>
              <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", fontWeight: 700, color: "#60A5FA" }}>PDF · Excel · CSV →</div>
            </Link>

            <Link href="/finance/banking/history" className="bk-action">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>📑</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#DEE8F5" }}>Transaction History</div>
              <div style={{ fontSize: "0.76rem", color: "#4A6FA5", lineHeight: 1.5 }}>View all bank transactions pushed to journals.</div>
              <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", fontWeight: 700, color: "#34D399" }}>
                {recentCount !== null ? `${recentCount} bank entries` : "Loading…"} →
              </div>
            </Link>

            <Link href="/finance/journals" className="bk-action">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#DEE8F5" }}>Journal Entries</div>
              <div style={{ fontSize: "0.76rem", color: "#4A6FA5", lineHeight: 1.5 }}>All entries including those pushed from bank statements.</div>
              <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", fontWeight: 700, color: "#A78BFA" }}>View all journals →</div>
            </Link>
          </div>

          {/* How it works */}
          <div className="bk-card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#4A6FA5", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>How it works</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
              {[
                { step: "1", icon: "📄", title: "Upload", desc: "PDF parsed by Claude AI or Excel/CSV parsed client-side" },
                { step: "2", icon: "🏷️", title: "Assign Ledgers", desc: "Select ledger account per row — bulk assign for speed" },
                { step: "3", icon: "🚀", title: "Push to Journals", desc: "One click creates double-entry journal entries" },
                { step: "4", icon: "📈", title: "Books Updated", desc: "Flows into Ledger → Trial Balance → Financial Statements" },
              ].map(s => (
                <div key={s.step} style={{ textAlign: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", margin: "0 auto 0.5rem" }}>{s.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.2rem" }}>{s.title}</div>
                  <div style={{ fontSize: "0.72rem", color: "#4A6FA5", lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank account stats */}
          {!loading && stats.length > 0 && (
            <div className="bk-card">
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#4A6FA5", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Bank & Cash Accounts</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {stats.map(s => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.7rem 0.9rem", background: "#080D1C", borderRadius: 9, border: "1px solid #111E33" }}>
                    <div style={{ fontSize: "1rem" }}>🏦</div>
                    <div style={{ flex: 1, fontWeight: 600, fontSize: "0.85rem" }}>{s.name}</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.68rem", color: "#4A6FA5" }}>Total In</div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#34D399", fontFamily: "'IBM Plex Mono',monospace" }}>₹{fmt(s.totalIn)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.68rem", color: "#4A6FA5" }}>Total Out</div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#FCA5A5", fontFamily: "'IBM Plex Mono',monospace" }}>₹{fmt(s.totalOut)}</div>
                    </div>
                    <Link href="/finance/banking/import" style={{ background: "#2563EB", color: "#fff", padding: "6px 14px", borderRadius: 7, fontWeight: 700, fontSize: "0.75rem", textDecoration: "none", flexShrink: 0 }}>
                      Import →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
