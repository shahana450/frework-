"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function TallyPage() {
  const router = useRouter();
  const [bizId, setBizId] = useState<string | null>(null);
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [journalCount, setJournalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const saved = (localStorage.getItem() ?? "").replace(/﻿/g, "").trim();
      if (!saved) { router.push("/finance/setup"); return; }
      setBizId(saved);
      const { data: fys } = await supabase.from("fw_fin_financial_years").select("id,label,start_date,end_date,is_current").eq("business_id", saved).order("start_date", { ascending: false });
      if (fys?.length) {
        setFinancialYears(fys);
        const cur = fys.find(f => f.is_current) ?? fys[0];
        setFyId(cur.id);
        setFrom(cur.start_date);
        setTo(cur.end_date);
      }
      const { count } = await supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", saved).eq("status", "posted");
      setJournalCount(count ?? 0);
    });
  }, []);

  function buildExportUrl() {
    const params = new URLSearchParams({ business_id: bizId! });
    if (fyId) params.set("fy_id", fyId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/finance/tally-export?${params}`;
  }

  const inp: React.CSSProperties = { background: "rgba(237,232,220,0.04)", border: "1px solid rgba(237,232,220,0.12)", color: "#EDE8DC", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/finance" style={{ color: "#C9A84C", fontWeight: 700, textDecoration: "none" }}>FreWork Finance</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>Tally Bridge</span>
      </nav>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.4rem", fontWeight: 800 }}>Tally Bridge</h1>
        <p style={{ margin: "0 0 2rem", color: "rgba(237,232,220,0.5)", fontSize: "0.88rem" }}>Export your posted journal entries as Tally-compatible XML. Import directly into Tally Prime or Tally ERP 9.</p>

        {/* How to import */}
        <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12, padding: "1.25rem", marginBottom: "2rem" }}>
          <div style={{ fontWeight: 700, color: "#C9A84C", marginBottom: "0.75rem", fontSize: "0.88rem" }}>How to Import into Tally</div>
          {[
            "Download the XML file from FreWork",
            "Open Tally Prime / Tally ERP 9",
            'Go to: Gateway of Tally → Import → Vouchers',
            "Select the downloaded XML file",
            'Click "Import" — all vouchers will be created',
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.4rem" }}>
              <span style={{ background: "#C9A84C", color: "#070C1A", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.7rem", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: "0.85rem", color: "rgba(237,232,220,0.7)" }}>{step}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1.25rem" }}>Export Settings</div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Financial Year</label>
            <select value={fyId ?? ""} onChange={e => {
              setFyId(e.target.value);
              const fy = financialYears.find(f => f.id === e.target.value);
            }} style={{ ...inp, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
              {financialYears.map(fy => <option key={fy.id} value={fy.id}>FY {fy.label}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>From Date (optional)</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>To Date (optional)</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📒</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{journalCount ?? "—"} posted journal entries</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)" }}>Ready for export as Tally XML vouchers</div>
            </div>
          </div>

          {bizId && (
            <a href={buildExportUrl()} download style={{
              display: "block", textAlign: "center", background: "#C9A84C", color: "#070C1A",
              padding: "12px 28px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.95rem",
            }}>
              ⬇ Download Tally XML
            </a>
          )}
          <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(237,232,220,0.3)", textAlign: "center" }}>
            Compatible with Tally Prime 3.0+, Tally ERP 9, Tally.ERP
          </div>
        </div>

        {/* Info boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
          {[
            { icon: "🔄", title: "Two-way sync", desc: "Export from FreWork → import into Tally. Use FreWork as your primary entry point." },
            { icon: "✅", title: "All voucher types", desc: "Sales, Purchase, Payment, Receipt, Journal, Contra — all exported correctly." },
            { icon: "🏷️", title: "Ledger names matched", desc: "Account names in FreWork must match your Tally ledger names for clean import." },
            { icon: "📅", title: "Date range filter", desc: "Export specific months or quarters for GST reconciliation." },
          ].map(tip => (
            <div key={tip.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>{tip.icon}</div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>{tip.title}</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", lineHeight: 1.5 }}>{tip.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
