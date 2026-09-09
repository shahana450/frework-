"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type TallyStatus = { state: "idle" | "checking" | "connected" | "disconnected"; company: string };

async function checkTally(): Promise<TallyStatus> {
  try {
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyCompany</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyCompany"><FORMS>MyCompany</FORMS></REPORT><FORM NAME="MyCompany"><PARTS>MyCompany</PARTS></FORM><PART NAME="MyCompany"><LINES>MyCompany</LINES></PART><LINE NAME="MyCompany"><FIELDS>FName</FIELDS></LINE><FIELD NAME="FName"><SET>$Name</SET></FIELD></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const res = await fetch("http://localhost:7001", {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xml,
      signal: AbortSignal.timeout(3000),
    });
    const text = await res.text();
    // Extract company name from Tally XML response
    const match = text.match(/<COMPANYNAME[^>]*>(.*?)<\/COMPANYNAME>/i)
      || text.match(/<NAME[^>]*>(.*?)<\/NAME>/i)
      || text.match(/<FNAME[^>]*>(.*?)<\/FNAME>/i);
    const company = match?.[1]?.trim() ?? "Tally";
    return { state: "connected", company };
  } catch {
    return { state: "disconnected", company: "" };
  }
}

type Business = { id: string; name: string; gstin: string | null; gst_registration_type: string; state: string | null };
type Stats = { sales: number; expenses: number; drafts: number; pendingTds: number; revenue: number; profit: number };

const QUICK = [
  { icon: "🧾", label: "New Invoice",    href: "/finance/sales/new",     color: "#F59E0B" },
  { icon: "📦", label: "Purchase Bill",  href: "/finance/purchases/new", color: "#60A5FA" },
  { icon: "💸", label: "Record Expense", href: "/finance/expenses",      color: "#A78BFA" },
  { icon: "📤", label: "Upload Doc",     href: "/finance/upload",        color: "#34D399" },
  { icon: "💳", label: "Payment Entry",  href: "/finance/payment",       color: "#FB923C" },
  { icon: "🛩️", label: "Ask FrePilot",  href: "/finance/virtual-ca",    color: "#F59E0B" },
];

const MODULES = [
  { group: "Reports", items: [
    { icon: "📈", label: "P&L / Reports",      desc: "Income statement, balance sheet, cash flow", href: "/finance/reports",           accent: "#34D399" },
    { icon: "🏛️", label: "GST Returns",        desc: "GSTR-1, GSTR-3B — auto-prepared",           href: "/finance/gst",               accent: "#60A5FA" },
    { icon: "🔖", label: "TDS Tracker",         desc: "Section-wise TDS, due dates, calculator",   href: "/finance/tds",               accent: "#F59E0B" },
  ]},
  { group: "Books", items: [
    { icon: "📒", label: "Journal Entries",    desc: "Double-entry ledger — Dr = Cr enforced",     href: "/finance/journals",          accent: "#A78BFA" },
    { icon: "🔴", label: "Credit Notes",       desc: "Issue CN to customers — sales returns",      href: "/finance/credit-note",       accent: "#F87171" },
    { icon: "🟢", label: "Debit Notes",        desc: "Issue DN to vendors — purchase returns",     href: "/finance/debit-note",        accent: "#34D399" },
  ]},
  { group: "Receivables & Payables", items: [
    { icon: "📥", label: "Receivables (AR)",   desc: "Who owes you money, aging report",           href: "/finance/receivables",       accent: "#34D399" },
    { icon: "📤", label: "Payables (AP)",       desc: "Who you owe, vendor aging",                 href: "/finance/payables",          accent: "#F87171" },
    { icon: "🏦", label: "Bank Reconciliation", desc: "Import CSV, auto-match entries",            href: "/finance/banking",           accent: "#60A5FA" },
  ]},
  { group: "Setup", items: [
    { icon: "🔄", label: "Tally Export",        desc: "Export as Tally-compatible XML",            href: "/finance/tally",             accent: "#FB923C" },
    { icon: "👥", label: "Contacts",            desc: "Customers & vendors with opening balances", href: "/finance/contacts",          accent: "#A78BFA" },
    { icon: "📊", label: "Chart of Accounts",  desc: "Indian account heads structure",             href: "/finance/chart-of-accounts", accent: "#60A5FA" },
  ]},
];

export default function FrePilotDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [stats, setStats] = useState<Stats>({ sales: 0, expenses: 0, drafts: 0, pendingTds: 0, revenue: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [fyLabel, setFyLabel] = useState("2025-26");
  const [tally, setTally] = useState<TallyStatus>({ state: "idle", company: "" });

  const pingTally = useCallback(async () => {
    setTally(t => ({ ...t, state: "checking" }));
    const result = await checkTally();
    setTally(result);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "" });
      loadBusinesses(u.id);
    });
    // Check Tally on mount, then every 30s
    pingTally();
    const id = setInterval(pingTally, 30000);
    return () => clearInterval(id);
  }, []);

  async function loadBusinesses(uid: string) {
    const { data } = await supabase.from("fw_fin_businesses")
      .select("id,name,gstin,gst_registration_type,state").eq("owner_id", uid).eq("is_active", true).order("created_at");
    if (!data || data.length === 0) { setLoading(false); return; }
    setBusinesses(data);
    const saved = (localStorage.getItem(`fw_fin_biz_${uid}`) ?? "").replace(/﻿/g, "").trim();
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
    const salesRev = posted.filter(j => j.type === "sales" || j.type === "receipt").reduce((s, j) => s + (j.total_credit || 0), 0);
    const expTotal = posted.filter(j => j.type === "purchase" || j.type === "expense" || j.type === "payment" || j.type === "journal").reduce((s, j) => s + (j.total_debit || 0), 0);
    setStats({
      sales: posted.filter(j => j.type === "sales").length,
      expenses: posted.filter(j => j.type === "purchase" || j.type === "expense" || j.type === "payment").length,
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
  const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (!loading && businesses.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#1A2E5A,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", marginBottom: "1.5rem", boxShadow: "0 0 40px rgba(201,168,76,0.3)" }}>🛩️</div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 900, background: "linear-gradient(135deg,#E8EDF5,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 0.5rem", letterSpacing: "-0.03em" }}>Welcome to FrePilot</h1>
        <p style={{ color: "rgba(232,237,245,0.45)", fontSize: "1rem", maxWidth: 380, lineHeight: 1.7, margin: "0 0 2.5rem" }}>Your AI accountant is ready. Set up your business in 2 minutes.</p>
        <Link href="/finance/setup" style={{ background: "linear-gradient(135deg,#B8922A,#C9A84C)", color: "#050914", padding: "14px 40px", borderRadius: 12, fontWeight: 800, textDecoration: "none", fontSize: "0.95rem", letterSpacing: "0.01em", boxShadow: "0 8px 32px rgba(201,168,76,0.35)" }}>
          Set Up My Business →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .fp-bg { background-image: radial-gradient(circle, rgba(201,168,76,0.04) 1px, transparent 1px); background-size: 32px 32px; }
        .fp-kpi { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 1.25rem 1.4rem; transition: border-color 0.2s; }
        .fp-kpi:hover { border-color: rgba(255,255,255,0.14); }
        .fp-quick { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 0.7rem 1.1rem; display: flex; align-items: center; gap: 0.55rem; text-decoration: none; transition: all 0.15s; white-space: nowrap; }
        .fp-quick:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); transform: translateY(-1px); }
        .fp-mod { background: rgba(255,255,255,0.018); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1rem 1.1rem; display: flex; gap: 0.85rem; align-items: flex-start; text-decoration: none; transition: all 0.15s; }
        .fp-mod:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
        .fp-ai-banner { background: linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.03) 100%); border: 1px solid rgba(201,168,76,0.22); border-radius: 16px; padding: 1.2rem 1.5rem; display: flex; align-items: center; gap: 1.25rem; text-decoration: none; transition: border-color 0.2s; }
        .fp-ai-banner:hover { border-color: rgba(201,168,76,0.45); }
        select option { background: #0B1221; }
        @keyframes tp-pulse { 0%,100%{opacity:1;box-shadow:0 0 6px rgba(52,211,153,0.6)} 50%{opacity:0.6;box-shadow:0 0 12px rgba(52,211,153,0.9)} }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 1.75rem", display: "flex", alignItems: "center", gap: "1rem", height: 58, position: "sticky", top: 0, background: "rgba(5,9,20,0.92)", backdropFilter: "blur(16px)", zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1A2E5A,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>🛩️</div>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "#C9A84C", letterSpacing: "-0.02em" }}>FrePilot</span>
          <span style={{ fontSize: "0.62rem", color: "rgba(201,168,76,0.4)", fontWeight: 500 }}>by FreWork</span>
        </div>
        <div style={{ flex: 1 }} />
        {businesses.length > 1 && (
          <select value={activeBiz?.id ?? ""} onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }}
            style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "#E8EDF5", padding: "5px 12px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {/* Tally connection pill */}
        {tally.state === "connected" ? (
          <Link href="/finance/tally" title="Tally connected — click to manage" style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 20, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", textDecoration: "none", cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 6px rgba(52,211,153,0.6)", flexShrink: 0, animation: "tp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#34D399" }}>Tally</span>
            <span style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.5)", maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tally.company}</span>
          </Link>
        ) : tally.state === "checking" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(232,237,245,0.2)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.75rem", color: "rgba(232,237,245,0.3)" }}>Checking…</span>
          </div>
        ) : (
          <Link href="/finance/tally" title="Tally not connected — click to set up" style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(232,237,245,0.15)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(232,237,245,0.35)" }}>Connect Tally</span>
          </Link>
        )}

        <Link href="/finance/virtual-ca" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "6px 16px", borderRadius: 8, fontSize: "0.8rem", textDecoration: "none", fontWeight: 700, letterSpacing: "0.01em" }}>
          🛩️ Ask FrePilot
        </Link>
        <Link href="/finance/setup" style={{ color: "rgba(232,237,245,0.3)", fontSize: "1rem", textDecoration: "none", padding: "4px 8px", borderRadius: 6, lineHeight: 1 }}>⚙</Link>
      </nav>

      <div className="fp-bg" style={{ minHeight: "calc(100vh - 58px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "2rem 1.75rem" }}>
          {activeBiz && (
            <>
              {/* Header */}
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: "0.74rem", color: "rgba(232,237,245,0.35)", marginBottom: "0.3rem", letterSpacing: "0.02em" }}>{greeting} · FY {fyLabel}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", background: "linear-gradient(135deg,#E8EDF5 60%,rgba(232,237,245,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{activeBiz.name}</h1>
                  {activeBiz.gstin && (
                    <span style={{ fontSize: "0.7rem", color: "rgba(232,237,245,0.3)", fontFamily: "'IBM Plex Mono',monospace", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "3px 10px", borderRadius: 6 }}>
                      GSTIN {activeBiz.gstin}
                    </span>
                  )}
                </div>
              </div>

              {/* AI Banner */}
              <Link href="/finance/virtual-ca" className="fp-ai-banner" style={{ display: "flex", marginBottom: "1.75rem", textDecoration: "none" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.08))", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🛩️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#C9A84C", fontSize: "0.9rem", marginBottom: "0.2rem" }}>FrePilot AI — Your Virtual Accountant</div>
                  <div style={{ fontSize: "0.76rem", color: "rgba(232,237,245,0.45)", lineHeight: 1.6 }}>Ask anything — GST rates, TDS sections, journal entries, compliance deadlines. Powered by Claude AI.</div>
                </div>
                <div style={{ color: "rgba(201,168,76,0.4)", fontSize: "1.1rem", flexShrink: 0, alignSelf: "center" }}>→</div>
              </Link>

              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.85rem", marginBottom: "1.75rem" }}>
                {[
                  { label: "Revenue", value: loading ? "—" : fmt(stats.revenue), color: "#34D399", sub: "FY total", mono: true },
                  { label: "Net Profit", value: loading ? "—" : (stats.profit < 0 ? "−" : "") + fmt(stats.profit), color: stats.profit >= 0 ? "#34D399" : "#F87171", sub: stats.profit < 0 ? "Net loss" : "Net profit", mono: true },
                  { label: "Sales Invoices", value: loading ? "—" : String(stats.sales), color: "#F59E0B", sub: "Posted entries", mono: false },
                  { label: "Draft Entries", value: loading ? "—" : String(stats.drafts), color: stats.drafts > 0 ? "#FB923C" : "rgba(232,237,245,0.3)", sub: stats.drafts > 0 ? "Needs review" : "All clear", mono: false, alert: stats.drafts > 0 },
                ].map(k => (
                  <div key={k.label} className="fp-kpi" style={k.alert ? { background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.2)" } : {}}>
                    <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.75rem" }}>{k.label}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: k.color, fontFamily: k.mono ? "'IBM Plex Mono',monospace" : "inherit", letterSpacing: k.mono ? "-0.02em" : "-0.01em", lineHeight: 1, marginBottom: "0.4rem" }}>{k.value}</div>
                    <div style={{ fontSize: "0.65rem", color: "rgba(232,237,245,0.25)", fontWeight: 500 }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.75rem" }}>Quick Actions</div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  {QUICK.map(q => (
                    <Link key={q.href} href={q.href} className="fp-quick">
                      <span style={{ fontSize: "1rem" }}>{q.icon}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: q.color }}>{q.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Modules by group */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {MODULES.map(group => (
                  <div key={group.group}>
                    <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.65rem" }}>{group.group}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.65rem" }}>
                      {group.items.map(m => (
                        <Link key={m.href} href={m.href} className="fp-mod">
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(255,255,255,0.04)`, border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{m.icon}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#E8EDF5", marginBottom: "0.2rem" }}>{m.label}</div>
                            <div style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.32)", lineHeight: 1.5 }}>{m.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ marginTop: "3rem", textAlign: "center", fontSize: "0.68rem", color: "rgba(232,237,245,0.15)", letterSpacing: "0.02em" }}>
                FrePilot · Powered by Claude AI · FY {fyLabel} · {activeBiz.name}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
