"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Business = { id: string; name: string; gstin: string | null; gst_registration_type: string; state: string | null };
type Stats = { sales: number; expenses: number; drafts: number; pendingTds: number; revenue: number; profit: number };

const QUICK = [
  { icon: "\u{1F9FE}", label: "New Invoice", href: "/finance/sales/new", color: "#C9A84C" },
  { icon: "\u{1F4E6}", label: "Purchase Bill", href: "/finance/purchases/new", color: "#60a5fa" },
  { icon: "\u{1F4B8}", label: "Record Expense", href: "/finance/expenses", color: "#a78bfa" },
  { icon: "\u{1F4E4}", label: "Upload Doc", href: "/finance/upload", color: "#4ade80" },
  { icon: "\u{1F4B3}", label: "Payment Entry", href: "/finance/payment", color: "#fb923c" },
  { icon: "\u{1F6E9}\uFE0F", label: "Ask FrePilot", href: "/finance/virtual-ca", color: "#C9A84C" },
];

const MODULES = [
  { icon: "\u{1F4C8}", label: "P&L / Reports", desc: "Income statement, balance sheet, cash flow", href: "/finance/reports" },
  { icon: "\u{1F3DB}\uFE0F", label: "GST Returns", desc: "GSTR-1, GSTR-3B \u2014 auto-prepared", href: "/finance/gst" },
  { icon: "\u{1F516}", label: "TDS Tracker", desc: "Section-wise TDS, due dates, calculator", href: "/finance/tds" },
  { icon: "\u{1F4D2}", label: "Journal Entries", desc: "Double-entry ledger \u2014 Dr = Cr enforced", href: "/finance/journals" },
  { icon: "\u{1F534}", label: "Credit Notes", desc: "Issue CN to customers \u2014 sales returns", href: "/finance/credit-note" },
  { icon: "\u{1F7E2}", label: "Debit Notes", desc: "Issue DN to vendors \u2014 purchase returns", href: "/finance/debit-note" },
  { icon: "\u{1F4E5}", label: "Receivables (AR)", desc: "Who owes you money, aging report", href: "/finance/receivables" },
  { icon: "\u{1F4E4}", label: "Payables (AP)", desc: "Who you owe, vendor aging", href: "/finance/payables" },
  { icon: "\u{1F3E6}", label: "Bank Reconciliation", desc: "Import CSV, auto-match entries", href: "/finance/banking" },
  { icon: "\u{1F504}", label: "Tally Export", desc: "Export as Tally-compatible XML", href: "/finance/tally" },
  { icon: "\u{1F465}", label: "Contacts", desc: "Customers & vendors with opening balances", href: "/finance/contacts" },
  { icon: "\u{1F4CA}", label: "Chart of Accounts", desc: "Indian account heads structure", href: "/finance/chart-of-accounts" },
];

export default function FrePilotDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [stats, setStats] = useState<Stats>({ sales: 0, expenses: 0, drafts: 0, pendingTds: 0, revenue: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [fyLabel, setFyLabel] = useState("2025-26");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "" });
      loadBusinesses(u.id);
    });
  }, []);

  async function loadBusinesses(uid: string) {
    const { data } = await supabase.from("fw_fin_businesses")
      .select("id,name,gstin,gst_registration_type,state").eq("owner_id", uid).eq("is_active", true).order("created_at");
    if (!data || data.length === 0) { setLoading(false); return; }
    setBusinesses(data);
    const saved = (localStorage.getItem(`fw_fin_biz_${user.id}`) ?? "").replace(/\uFEFF/g, "").trim();
    const biz = data.find(b => b.id === saved) || data[0];
    setActiveBiz(biz);
    loadStats(biz.id, uid);
  }

  async function loadStats(bizId: string, uid: string) {
    setLoading(true);
    const [fyRes, journalsRes] = await Promise.all([
      supabase.from("fw_fin_financial_years").select("label").eq("business_id", bizId).eq("is_current", true).single(),
      supabase.from("fw_fin_journals").select("type,status,total_credit,total_debit").eq("business_id", bizId),
    ]);
    if (fyRes.data) setFyLabel(fyRes.data.label);
    const journals = journalsRes.data ?? [];
    const posted = journals.filter(j => j.status === "posted");
    const salesRev = posted.filter(j => j.type === "sales").reduce((s, j) => s + (j.total_credit || 0), 0);
    const expTotal = posted.filter(j => j.type === "purchase" || j.type === "journal").reduce((s, j) => s + (j.total_debit || 0), 0);
    setStats({
      sales: posted.filter(j => j.type === "sales").length,
      expenses: posted.filter(j => j.type === "purchase").length,
      drafts: journals.filter(j => j.status === "draft").length,
      pendingTds: 0,
      revenue: salesRev,
      profit: salesRev - expTotal,
    });
    setLoading(false);
  }

  function switchBiz(biz: Business) {
    setActiveBiz(biz);
    if (user) { localStorage.setItem(`fw_fin_biz_${user.id}`, biz.id); loadStats(biz.id, user.id); }
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const fmt = (n: number) => "\u20B9" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // \u2500\u2500\u2500 No business yet \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (!loading && businesses.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>\u{1F6E9}\uFE0F</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "#C9A84C", margin: "0 0 0.4rem" }}>Welcome to FrePilot</h1>
        <p style={{ color: "rgba(237,232,220,0.5)", fontSize: "1rem", maxWidth: 400, lineHeight: 1.6, margin: "0 0 2rem" }}>
          Your AI accountant is ready. Set up your business in 2 minutes and let FrePilot handle the books.
        </p>
        <Link href="/finance/setup" style={{ background: "#C9A84C", color: "#070C1A", padding: "14px 36px", borderRadius: 10, fontWeight: 800, textDecoration: "none", fontSize: "1rem", letterSpacing: "0.02em" }}>
          Set Up My Business \u2192
        </Link>
        <div style={{ marginTop: "3rem", display: "flex", gap: "2rem", color: "rgba(237,232,220,0.35)", fontSize: "0.78rem" }}>
          {["GST-ready invoicing", "Double-entry accounting", "TDS tracking", "Financial reports"].map(f => (
            <span key={f}>\u2713 {f}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      {/* Top bar */}
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.15)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56, position: "sticky", top: 0, background: "rgba(7,12,26,0.95)", backdropFilter: "blur(8px)", zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.2rem" }}>\u{1F6E9}\uFE0F</span>
          <span style={{ fontWeight: 900, fontSize: "1rem", color: "#C9A84C", letterSpacing: "-0.01em" }}>FrePilot</span>
          <span style={{ fontSize: "0.65rem", color: "rgba(201,168,76,0.5)", fontWeight: 500, marginLeft: 2 }}>by FreWork</span>
        </div>
        <div style={{ flex: 1 }} />
        {businesses.length > 1 && (
          <select value={activeBiz?.id ?? ""} onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }}
            style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "#EDE8DC", padding: "4px 10px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer" }}>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <Link href="/finance/virtual-ca" style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", padding: "6px 14px", borderRadius: 7, fontSize: "0.8rem", textDecoration: "none", fontWeight: 600 }}>
          \u{1F6E9}\uFE0F Ask FrePilot
        </Link>
        <Link href="/finance/setup" style={{ color: "rgba(237,232,220,0.35)", fontSize: "0.78rem", textDecoration: "none" }}>\u2699</Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem" }}>
        {activeBiz && (
          <>
            {/* Header */}
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.4)", marginBottom: "0.25rem" }}>{greeting} \u00B7 FY {fyLabel}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800 }}>{activeBiz.name}</h1>
                {activeBiz.gstin && <span style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.35)", fontFamily: "monospace" }}>GSTIN {activeBiz.gstin}</span>}
              </div>
            </div>

            {/* FrePilot AI Banner */}
            <Link href="/finance/virtual-ca" style={{ textDecoration: "none", display: "block", marginBottom: "1.5rem" }}>
              <div style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 14, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem", cursor: "pointer", transition: "border-color 0.2s" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(201,168,76,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>\u{1F6E9}\uFE0F</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#C9A84C", fontSize: "0.95rem" }}>FrePilot AI \u2014 Your Virtual Accountant</div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.5)", marginTop: "0.2rem" }}>Ask anything \u2014 GST rates, TDS sections, journal entries, compliance deadlines. Powered by Claude AI.</div>
                </div>
                <div style={{ color: "rgba(201,168,76,0.5)", fontSize: "1.2rem", flexShrink: 0 }}>\u2192</div>
              </div>
            </Link>

            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Revenue", value: loading ? "\u2014" : fmt(stats.revenue), color: "#4ade80", icon: "\u{1F4C8}" },
                { label: "Net Profit", value: loading ? "\u2014" : fmt(stats.profit), color: stats.profit >= 0 ? "#4ade80" : "#f87171", icon: "\u{1F4B0}" },
                { label: "Sales Invoices", value: loading ? "\u2014" : String(stats.sales), color: "#C9A84C", icon: "\u{1F9FE}" },
                { label: "Draft Entries", value: loading ? "\u2014" : String(stats.drafts), color: stats.drafts > 0 ? "#fb923c" : "rgba(237,232,220,0.4)", icon: "\u270F\uFE0F", alert: stats.drafts > 0 },
              ].map(k => (
                <div key={k.label} style={{ background: k.alert ? "rgba(251,146,60,0.06)" : "rgba(255,255,255,0.025)", border: `1px solid ${k.alert ? "rgba(251,146,60,0.2)" : "rgba(237,232,220,0.07)"}`, borderRadius: 12, padding: "1rem 1.1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.6rem", color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{k.label}</span>
                    <span style={{ fontSize: "0.9rem" }}>{k.icon}</span>
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.65rem", color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.75rem" }}>Quick Actions</div>
              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                {QUICK.map(q => (
                  <Link key={q.href} href={q.href} style={{ textDecoration: "none" }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(237,232,220,0.08)", borderRadius: 10, padding: "0.65rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "1rem" }}>{q.icon}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: q.color }}>{q.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Modules grid */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.65rem", color: "rgba(237,232,220,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.75rem" }}>All Modules</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                {MODULES.map(m => (
                  <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.06)", borderRadius: 10, padding: "0.9rem 1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer" }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.83rem", color: "#EDE8DC", marginBottom: "0.2rem" }}>{m.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.35)", lineHeight: 1.4 }}>{m.desc}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.72rem", color: "rgba(237,232,220,0.2)" }}>
              FrePilot \u00B7 Powered by Claude AI \u00B7 {activeBiz.gstin ? `GSTIN ${activeBiz.gstin}` : "GST not configured"} \u00B7 FY {fyLabel}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
