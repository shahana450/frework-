"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Business = {
  id: string;
  name: string;
  gstin: string | null;
  gst_registration_type: string;
};

type DashStats = {
  totalDocs: number;
  pendingReview: number;
  totalJournals: number;
  pendingJournals: number;
};

type RecentDoc = {
  id: string;
  file_name: string;
  doc_type: string | null;
  status: string;
  created_at: string;
  ai_summary: { vendor?: string; amount?: number; date?: string } | null;
};

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Sales Invoice", bill: "Purchase Bill", receipt: "Receipt",
  bank_statement: "Bank Statement", salary_slip: "Salary Slip", other: "Document",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#C9A84C", processing: "#60a5fa", reviewed: "#a78bfa",
  posted: "#4ade80", rejected: "#f87171",
};

export default function FinanceDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [stats, setStats] = useState<DashStats>({ totalDocs: 0, pendingReview: 0, totalJournals: 0, pendingJournals: 0 });
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFY, setCurrentFY] = useState("2024-25");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "" });
      loadBusinesses(u.id);
    });
  }, []);

  async function loadBusinesses(uid: string) {
    const { data } = await supabase
      .from("fw_fin_businesses")
      .select("id,name,gstin,gst_registration_type")
      .eq("owner_id", uid)
      .eq("is_active", true)
      .order("created_at");
    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }
    setBusinesses(data);
    const saved = localStorage.getItem(`fw_fin_biz_${uid}`);
    const biz = data.find(b => b.id === saved) || data[0];
    setActiveBiz(biz);
    loadStats(biz.id);
  }

  async function loadStats(bizId: string) {
    setLoading(true);
    const [docsRes, journalRes, recentRes] = await Promise.all([
      supabase.from("fw_fin_documents").select("id,status").eq("business_id", bizId),
      supabase.from("fw_fin_journals").select("id,status").eq("business_id", bizId),
      supabase.from("fw_fin_documents")
        .select("id,file_name,doc_type,status,created_at,ai_summary")
        .eq("business_id", bizId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    const docs = docsRes.data ?? [];
    const journals = journalRes.data ?? [];
    setStats({
      totalDocs: docs.length,
      pendingReview: docs.filter(d => d.status === "pending" || d.status === "reviewed").length,
      totalJournals: journals.length,
      pendingJournals: journals.filter(j => j.status === "draft").length,
    });
    setRecentDocs(recentRes.data ?? []);
    setLoading(false);
  }

  function switchBiz(biz: Business) {
    setActiveBiz(biz);
    if (user) localStorage.setItem(`fw_fin_biz_${user.id}`, biz.id);
    loadStats(biz.id);
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      {/* Top Nav */}
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1.5rem", height: 56 }}>
        <Link href="/dashboard" style={{ color: "#C9A84C", fontWeight: 700, fontSize: "1.1rem", textDecoration: "none", letterSpacing: "0.05em" }}>
          FreWork
        </Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>|</span>
        <span style={{ color: "#C9A84C", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Finance</span>
        <div style={{ flex: 1 }} />
        {businesses.length > 1 && (
          <select
            value={activeBiz?.id ?? ""}
            onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }}
            style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#EDE8DC", padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}
          >
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <Link href="/finance/upload" style={{ background: "#C9A84C", color: "#070C1A", padding: "6px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none", letterSpacing: "0.05em" }}>
          + Upload
        </Link>
        <Link href="/dashboard" style={{ color: "rgba(237,232,220,0.5)", fontSize: "0.8rem", textDecoration: "none" }}>← Dashboard</Link>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        {/* No business state */}
        {!loading && businesses.length === 0 && (
          <div style={{ textAlign: "center", padding: "6rem 2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
            <h2 style={{ color: "#C9A84C", marginBottom: "0.5rem" }}>Set Up Your Business</h2>
            <p style={{ color: "rgba(237,232,220,0.6)", marginBottom: "2rem" }}>Start by adding your business details to enable AI-powered bookkeeping.</p>
            <Link href="/finance/setup" style={{ background: "#C9A84C", color: "#070C1A", padding: "12px 32px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "0.95rem" }}>
              Get Started →
            </Link>
          </div>
        )}

        {activeBiz && (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
              <div>
                <div style={{ color: "rgba(237,232,220,0.5)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>{greeting}</div>
                <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>{activeBiz.name}</h1>
                {activeBiz.gstin && (
                  <div style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.78rem", marginTop: "0.2rem" }}>
                    GSTIN: {activeBiz.gstin} · FY {currentFY}
                  </div>
                )}
              </div>
              <Link href="/finance/setup" style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.78rem", textDecoration: "none" }}>
                ⚙ Settings
              </Link>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
              {[
                { label: "Documents Uploaded", value: stats.totalDocs, sub: "All time", icon: "📄", link: null },
                { label: "Pending AI Review", value: stats.pendingReview, sub: "Needs your attention", icon: "🤖", link: "/finance/ai-review", alert: stats.pendingReview > 0 },
                { label: "Journal Entries", value: stats.totalJournals, sub: "Total posted", icon: "📒", link: "/finance/journals" },
                { label: "Draft Journals", value: stats.pendingJournals, sub: "Not yet posted", icon: "✏️", link: "/finance/journals", alert: stats.pendingJournals > 0 },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: kpi.alert ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${kpi.alert ? "rgba(201,168,76,0.3)" : "rgba(237,232,220,0.08)"}`,
                  borderRadius: 12, padding: "1.2rem", position: "relative", overflow: "hidden"
                }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{kpi.icon}</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: kpi.alert ? "#C9A84C" : "#EDE8DC", fontVariantNumeric: "tabular-nums" }}>
                    {loading ? "—" : kpi.value}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.5)", marginTop: "0.2rem" }}>{kpi.label}</div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(237,232,220,0.3)", marginTop: "0.15rem" }}>{kpi.sub}</div>
                  {kpi.link && (
                    <Link href={kpi.link} style={{ position: "absolute", inset: 0, borderRadius: 12 }} />
                  )}
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
              {[
                { icon: "📤", title: "Upload Anything", desc: "Invoice, bill, receipt, bank statement — AI extracts and categorizes", href: "/finance/upload", gold: true },
                { icon: "🔍", title: "AI Review Queue", desc: "Review AI-suggested journal entries before posting", href: "/finance/ai-review" },
                { icon: "📋", title: "New Journal Entry", desc: "Manual double-entry journal with Dr = Cr enforcement", href: "/finance/journals/new" },
                { icon: "📈", title: "Financial Reports", desc: "P&L, Balance Sheet, Trial Balance", href: "/finance/reports" },
                { icon: "🏛️", title: "GST Returns", desc: "GSTR-1, GSTR-3B auto-prepared from posted entries", href: "/finance/gst" },
                { icon: "🔄", title: "Tally Bridge", desc: "Export journal entries as Tally-compatible XML", href: "/finance/tally" },
                { icon: "🏦", title: "Bank Reconciliation", desc: "Import CSV bank statement and auto-match entries", href: "/finance/banking" },
                { icon: "👥", title: "Contacts", desc: "Manage customers and vendors with opening balances", href: "/finance/contacts" },
                { icon: "📊", title: "Chart of Accounts", desc: "Manage account heads with Indian structure", href: "/finance/chart-of-accounts" },
              ].map((action, i) => (
                <Link key={i} href={action.href} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: action.gold ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${action.gold ? "rgba(201,168,76,0.35)" : "rgba(237,232,220,0.08)"}`,
                    borderRadius: 12, padding: "1.2rem", cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}>
                    <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{action.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: action.gold ? "#C9A84C" : "#EDE8DC", marginBottom: "0.3rem" }}>{action.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", lineHeight: 1.4 }}>{action.desc}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Recent Documents */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(237,232,220,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Recent Uploads</span>
                <Link href="/finance/upload" style={{ color: "#C9A84C", fontSize: "0.78rem", textDecoration: "none" }}>View all →</Link>
              </div>
              {loading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "rgba(237,232,220,0.3)", fontSize: "0.85rem" }}>Loading…</div>
              ) : recentDocs.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📂</div>
                  <div style={{ color: "rgba(237,232,220,0.4)", fontSize: "0.85rem" }}>No documents yet. Upload your first invoice or bill.</div>
                  <Link href="/finance/upload" style={{ display: "inline-block", marginTop: "1rem", color: "#C9A84C", fontSize: "0.85rem" }}>Upload now →</Link>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["File", "Type", "Vendor / Details", "Amount", "Status", "Date"].map(h => (
                        <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentDocs.map(doc => (
                      <tr key={doc.id} style={{ borderTop: "1px solid rgba(237,232,220,0.05)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#EDE8DC", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.file_name}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem" }}>
                          <span style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem" }}>
                            {DOC_TYPE_LABEL[doc.doc_type ?? ""] ?? "—"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "rgba(237,232,220,0.6)" }}>
                          {doc.ai_summary?.vendor ?? "—"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", color: "#EDE8DC" }}>
                          {doc.ai_summary?.amount ? `₹${doc.ai_summary.amount.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{
                            color: STATUS_COLOR[doc.status] ?? "#EDE8DC",
                            background: `${STATUS_COLOR[doc.status]}18`,
                            padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 600
                          }}>
                            {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>
                          {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Info Bar */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Current Financial Year</div>
                <div style={{ fontWeight: 700, color: "#C9A84C" }}>FY {currentFY}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>1 Apr 2024 – 31 Mar 2025</div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>GST Status</div>
                <div style={{ fontWeight: 700, color: "#4ade80" }}>{activeBiz.gst_registration_type.charAt(0).toUpperCase() + activeBiz.gst_registration_type.slice(1)}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.4)", marginTop: "0.2rem" }}>{activeBiz.gstin || "GSTIN not set"}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Add Another Business</div>
                <Link href="/finance/setup" style={{ color: "#C9A84C", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>+ New Business →</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
