"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type JournalRow = {
  id: string;
  entry_no: string;
  date: string;
  narration: string;
  type: string;
  total_debit: number;
  total_credit: number;
  status: string;
};

export default function BankHistoryPage() {
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "payment" | "receipt">("all");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const bizId = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").trim();
      if (!bizId) { setLoading(false); return; }

      // Load journals that came from bank import (source = 'bank_import')
      // Fall back to payment/receipt type journals if source column doesn't exist
      const { data } = await supabase
        .from("fw_fin_journals")
        .select("id,entry_no,date,narration,type,total_debit,total_credit,status")
        .eq("business_id", bizId)
        .in("type", ["payment", "receipt"])
        .order("date", { ascending: false })
        .limit(500);

      setJournals((data ?? []) as JournalRow[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return journals.filter(j => {
      if (filterType !== "all" && j.type !== filterType) return false;
      if (search && !j.narration?.toLowerCase().includes(search.toLowerCase()) && !j.entry_no?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [journals, filterType, search]);

  const totalIn = journals.filter(j => j.type === "receipt").reduce((s, j) => s + Number(j.total_credit), 0);
  const totalOut = journals.filter(j => j.type === "payment").reduce((s, j) => s + Number(j.total_debit), 0);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid #1B2E4A", color: "#DEE8F5", padding: "7px 10px", borderRadius: 7, fontSize: "0.82rem", outline: "none", fontFamily: "'DM Sans',system-ui,sans-serif" };

  return (
    <div style={{ minHeight: "100vh", background: "#05091A", color: "#DEE8F5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .bh-row:hover td { background: rgba(255,255,255,0.015); }
        .bh-filter { background: rgba(255,255,255,0.04); border: 1px solid #1B2E4A; color: #6E88A8; border-radius: 7px; padding: 5px 12px; font-size: 0.76rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .bh-filter.active { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.35); color: #60A5FA; }
        select option { background: #0B1428; }
        ::-webkit-scrollbar { width: 5px; height: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #1B2E4A; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "rgba(5,9,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1B2E4A", padding: "0 2rem", height: 52, display: "flex", alignItems: "center", gap: "0.75rem", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/finance" style={{ color: "#4A6FA5", textDecoration: "none", fontSize: "0.82rem" }}>Finance</Link>
        <span style={{ color: "#2A4060" }}>›</span>
        <Link href="/finance/banking" style={{ color: "#4A6FA5", textDecoration: "none", fontSize: "0.82rem" }}>Banking</Link>
        <span style={{ color: "#2A4060" }}>›</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Transaction History</span>
        <Link href="/finance/banking/import" style={{ marginLeft: "auto", background: "#2563EB", color: "#fff", padding: "6px 16px", borderRadius: 8, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>
          ⬆ Import New Statement
        </Link>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {[
            { label: "Total Transactions", value: journals.length, color: "#DEE8F5", sub: "payment + receipt" },
            { label: "Total Receipts (In)", value: `₹${fmt(totalIn)}`, color: "#34D399", sub: `${journals.filter(j => j.type === "receipt").length} entries` },
            { label: "Total Payments (Out)", value: `₹${fmt(totalOut)}`, color: "#FCA5A5", sub: `${journals.filter(j => j.type === "payment").length} entries` },
          ].map(s => (
            <div key={s.label} style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 12, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#4A6FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>{s.label}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: s.color, fontFamily: typeof s.value === "string" && s.value.startsWith("₹") ? "'IBM Plex Mono',monospace" : "inherit", letterSpacing: "-0.01em" }}>{s.value}</div>
              <div style={{ fontSize: "0.68rem", color: "#2A4060", marginTop: "0.2rem" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "0.75rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search narration or entry no…" style={{ ...inp, flex: "1 1 200px" }} />
          {(["all", "receipt", "payment"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`bh-filter${filterType === t ? " active" : ""}`}>
              {t === "all" ? "All" : t === "receipt" ? "💰 Receipts" : "💸 Payments"}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "0.74rem", color: "#4A6FA5" }}>{filtered.length} entries</span>
        </div>

        {/* Table */}
        <div style={{ background: "#0B1428", border: "1px solid #1B2E4A", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#4A6FA5" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📭</div>
              <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>No bank transactions yet</div>
              <div style={{ color: "#4A6FA5", fontSize: "0.84rem", marginBottom: "1rem" }}>Import a bank statement to get started.</div>
              <Link href="/finance/banking/import" style={{ background: "#2563EB", color: "#fff", padding: "10px 24px", borderRadius: 9, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>
                ⬆ Import Statement
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "#080D1C", borderBottom: "1px solid #111E33" }}>
                    {["Entry No", "Date", "Narration", "Type", "Debit (₹)", "Credit (₹)", ""].map(h => (
                      <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: h.includes("₹") ? "right" : "left", color: "#2A4060", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((j, i) => (
                    <tr key={j.id} className="bh-row" style={{ borderTop: i === 0 ? "none" : "1px solid #0D1827" }}>
                      <td style={{ padding: "0.55rem 0.85rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: "#4A6FA5", whiteSpace: "nowrap" }}>{j.entry_no}</td>
                      <td style={{ padding: "0.55rem 0.85rem", color: "#6E88A8", whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.72rem" }}>
                        {new Date(j.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "0.55rem 0.85rem", color: "#DEE8F5", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.narration}>{j.narration}</td>
                      <td style={{ padding: "0.55rem 0.85rem" }}>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: j.type === "receipt" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)", color: j.type === "receipt" ? "#34D399" : "#FCA5A5" }}>
                          {j.type === "receipt" ? "💰 Receipt" : "💸 Payment"}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 0.85rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: j.total_debit ? "#FCA5A5" : "#2A4060", fontWeight: j.total_debit ? 600 : 400 }}>
                        {j.total_debit ? `₹${fmt(Number(j.total_debit))}` : ""}
                      </td>
                      <td style={{ padding: "0.55rem 0.85rem", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: j.total_credit ? "#34D399" : "#2A4060", fontWeight: j.total_credit ? 600 : 400 }}>
                        {j.total_credit ? `₹${fmt(Number(j.total_credit))}` : ""}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem" }}>
                        <Link href={`/finance/journals/${j.id}/edit`} style={{ fontSize: "0.7rem", color: "#4A6FA5", textDecoration: "none", fontWeight: 600 }}>✏</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
