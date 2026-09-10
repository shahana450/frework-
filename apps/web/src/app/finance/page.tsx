"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type TallyStatus = { state: "idle" | "checking" | "connected" | "disconnected"; company: string };

function parseTallyCompanyName(xml: string): string {
  // All known patterns Tally Prime uses to return company name
  const patterns: RegExp[] = [
    /<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/i,
    /<SVCURRENTCOMPANY[^>]*>([^<]+)<\/SVCURRENTCOMPANY>/i,
    /<BASICCOMPANYNAME[^>]*>([^<]+)<\/BASICCOMPANYNAME>/i,
    // attribute anywhere in COMPANY tag: <COMPANY REMOTEID="x" NAME="Abc">
    /<COMPANY[^>]+NAME="([^"]+)"/i,
    // NAME child right inside COMPANY (may be wrapped in NAME.LIST)
    /<COMPANY[^>]*>(?:(?!<\/COMPANY>)[\s\S]){0,300}<NAME[^>]*>([^<]{2,})<\/NAME>/i,
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    const v = m?.[1]?.trim();
    if (v && v.length >= 2) return v;
  }
  return "";
}

// Safe lightweight ping — no TDL filters that freeze Tally
async function checkTally(): Promise<TallyStatus & { _raw: string }> {
  try {
    // Fetch Name + CompanyName so we catch whichever field Tally returns
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Companies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,CompanyName,StartingFrom</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const res = await fetch("http://localhost:7001", {
      method: "POST", headers: { "Content-Type": "text/xml" }, body: xml,
      signal: AbortSignal.timeout(3000),
    });
    const text = await res.text();
    const parsed = parseTallyCompanyName(text);
    const stored = typeof window !== "undefined" ? localStorage.getItem("fw_tally_company") ?? "" : "";
    const company = parsed.length >= 2 ? parsed : (stored.length >= 2 ? stored : "Tally");
    if (parsed.length >= 2 && parsed !== stored) {
      try { localStorage.setItem("fw_tally_company", parsed); } catch { /* */ }
    }
    return { state: "connected", company, _raw: text.slice(0, 600) };
  } catch (e) {
    return { state: "disconnected", company: "", _raw: String(e) };
  }
}

type TallyLedger = { name: string; parent: string };

async function fetchTallyLedgers(): Promise<TallyLedger[]> {
  try {
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FP_Ledgers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FP_Ledgers" ISMODIFY="No"><TYPE>Ledger</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const res = await fetch("http://localhost:7001", {
      method: "POST", headers: { "Content-Type": "text/xml" }, body: xml,
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const results: TallyLedger[] = [];
    const seen = new Set<string>();
    // NAME attribute format: <LEDGER NAME="Cash">
    const attrRe = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
    let m;
    while ((m = attrRe.exec(text)) !== null) {
      const name = m[1].trim();
      const block = m[2];
      const pm = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);
      const parent = pm?.[1]?.trim() ?? "";
      if (name && !seen.has(name)) { seen.add(name); results.push({ name, parent }); }
    }
    return results.sort((a, b) => a.parent.localeCompare(b.parent) || a.name.localeCompare(b.name));
  } catch {
    return [];
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
  const [fyId, setFyId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string }[]>([]);
  const [tally, setTally] = useState<TallyStatus>({ state: "idle", company: "" });
  const [tallyLedgers, setTallyLedgers] = useState<TallyLedger[]>([]);
  const [tallyLedgersLoading, setTallyLedgersLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");

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
    pingTally();
    const id = setInterval(pingTally, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (tally.state === "disconnected") setTallyLedgers([]);
  }, [tally.state]);

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

  async function loadStats(bizId: string, uid: string, selectedFyId?: string | null) {
    setLoading(true);
    const [fysRes, journalsRes] = await Promise.all([
      supabase.from("fw_fin_financial_years").select("id,label,is_current").eq("business_id", bizId).order("start_date", { ascending: false }),
      supabase.from("fw_fin_journals").select("type,status,total_credit,total_debit,financial_year_id").eq("business_id", bizId),
    ]);
    const fys = fysRes.data ?? [];
    setFinancialYears(fys.map(f => ({ id: f.id, label: f.label })));
    const activeFy = selectedFyId
      ? fys.find(f => f.id === selectedFyId)
      : (fys.find(f => f.is_current) ?? fys[0]);
    if (activeFy) { setFyLabel(activeFy.label); setFyId(activeFy.id); }
    const allJournals = journalsRes.data ?? [];
    const journals = activeFy ? allJournals.filter(j => j.financial_year_id === activeFy.id) : allJournals;
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
    if (user) { localStorage.setItem(`fw_fin_biz_${user.id}`, biz.id); loadStats(biz.id, user.id, null); }
  }

  function switchFy(selectedId: string) {
    setFyId(selectedId);
    if (activeBiz && user) loadStats(activeBiz.id, user.id, selectedId);
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

      {/* Nav — ProVia-style: logo | business ▾ | FY ▾ | … | actions */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.6rem", height: 54, position: "sticky", top: 0, background: "rgba(5,9,20,0.95)", backdropFilter: "blur(16px)", zIndex: 30 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#1A2E5A,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>🛩️</div>
          <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#C9A84C", letterSpacing: "-0.02em" }}>FrePilot</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)" }} />

        {/* Business selector — always visible */}
        <select
          value={activeBiz?.id ?? ""}
          onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) switchBiz(b); }}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF5", padding: "5px 28px 5px 10px", borderRadius: 8, fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", maxWidth: 200, appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7FA3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
          {businesses.map(b => <option key={b.id} value={b.id} style={{ background: "#0B1221" }}>{b.name}</option>)}
        </select>

        {/* FY selector — always visible */}
        <select
          value={fyId ?? ""}
          onChange={e => switchFy(e.target.value)}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF5", padding: "5px 28px 5px 10px", borderRadius: 8, fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7FA3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
          {financialYears.map(f => <option key={f.id} value={f.id} style={{ background: "#0B1221" }}>FY {f.label}</option>)}
          {financialYears.length === 0 && <option value="">FY {fyLabel}</option>}
        </select>

        <div style={{ flex: 1 }} />

        {/* Tally pill */}
        {tally.state === "connected" ? (
          <Link href="/finance/tally" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 20, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", textDecoration: "none" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", flexShrink: 0, animation: "tp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34D399" }}>Tally · {tally.company}</span>
          </Link>
        ) : (
          <Link href="/finance/tally" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,237,245,0.15)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(232,237,245,0.3)" }}>Connect Tally</span>
          </Link>
        )}

        <Link href="/finance/virtual-ca" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "5px 14px", borderRadius: 8, fontSize: "0.78rem", textDecoration: "none", fontWeight: 700 }}>
          🛩️ Ask FrePilot
        </Link>
        <Link href="/finance/setup" style={{ color: "rgba(232,237,245,0.3)", fontSize: "1rem", textDecoration: "none", padding: "4px 6px", borderRadius: 6 }}>⚙</Link>
      </nav>

<div className="fp-bg" style={{ minHeight: "calc(100vh - 58px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "2rem 1.75rem" }}>
          {activeBiz && (
            <>
              {/* Header */}
              <div style={{ marginBottom: "1.75rem" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.3)", marginBottom: "0.25rem" }}>{greeting}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", background: "linear-gradient(135deg,#E8EDF5 60%,rgba(232,237,245,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{activeBiz.name}</h1>
                  {activeBiz.gstin && (
                    <span style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.28)", fontFamily: "'IBM Plex Mono',monospace", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px 9px", borderRadius: 6 }}>
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

              {/* KPI Cards — FrePilot app data */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60A5FA" }}>📂 FrePilot · FY {fyLabel}</span>
                {loading && <span style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.2)" }}>Loading…</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.85rem", marginBottom: "1.75rem" }}>
                {[
                  { label: "Revenue", value: loading ? "—" : fmt(stats.revenue), color: "#34D399", sub: `FY ${fyLabel}`, mono: true },
                  { label: "Net Profit", value: loading ? "—" : (stats.profit < 0 ? "−" : "") + fmt(stats.profit), color: stats.profit >= 0 ? "#34D399" : "#F87171", sub: stats.profit < 0 ? "Net loss" : "Net profit", mono: true },
                  { label: "Sales Invoices", value: loading ? "—" : String(stats.sales), color: "#F59E0B", sub: "Posted entries", mono: false },
                  { label: "Draft Entries", value: loading ? "—" : String(stats.drafts), color: stats.drafts > 0 ? "#FB923C" : "rgba(232,237,245,0.3)", sub: stats.drafts > 0 ? "Needs review" : "All clear", mono: false, alert: stats.drafts > 0 },
                ].map(k => (
                  <div key={k.label} className="fp-kpi" style={(k as {alert?:boolean}).alert ? { background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.2)" } : {}}>
                    <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.75rem" }}>{k.label}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: k.color, fontFamily: k.mono ? "'IBM Plex Mono',monospace" : "inherit", letterSpacing: "-0.02em", lineHeight: 1, marginBottom: "0.4rem" }}>{k.value}</div>
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

              {/* Tally Ledgers — shown when connected */}
              {tally.state === "connected" && (
                <div style={{ marginTop: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}>Tally Ledgers</div>
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34D399" }}>
                        {tallyLedgersLoading ? "Loading…" : `${tallyLedgers.length} ledgers`}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)}
                        placeholder="Search ledger or group…"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#E8EDF5", padding: "5px 12px", borderRadius: 8, fontSize: "0.76rem", outline: "none", fontFamily: "inherit", width: 200 }} />
                      {tallyLedgers.length > 0 && (
                        <button onClick={() => { setTallyLedgersLoading(true); fetchTallyLedgers().then(l => { setTallyLedgers(l); setTallyLedgersLoading(false); }); }}
                          disabled={tallyLedgersLoading}
                          style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.4)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                          ↻ Refresh
                        </button>
                      )}
                      <Link href="/finance/tally" style={{ fontSize: "0.72rem", color: "#34D399", textDecoration: "none", fontWeight: 700, padding: "5px 12px", borderRadius: 8, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)" }}>
                        Manage →
                      </Link>
                    </div>
                  </div>

                  {tallyLedgersLoading ? (
                    <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "2rem", textAlign: "center", color: "rgba(232,237,245,0.25)", fontSize: "0.8rem" }}>
                      Fetching ledgers from Tally… (do not use Tally until this finishes)
                    </div>
                  ) : tallyLedgers.length === 0 ? (
                    <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                      <div style={{ color: "rgba(232,237,245,0.3)", fontSize: "0.8rem", marginBottom: "1rem" }}>Ledgers not loaded yet. Click below — keep Tally open and idle while loading.</div>
                      <button onClick={() => { setTallyLedgersLoading(true); fetchTallyLedgers().then(l => { setTallyLedgers(l); setTallyLedgersLoading(false); }); }}
                        style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399", padding: "8px 24px", borderRadius: 8, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
                        Load Ledgers from Tally
                      </button>
                    </div>
                  ) : (() => {
                    const filtered = tallyLedgers.filter(l =>
                      !ledgerSearch || l.name.toLowerCase().includes(ledgerSearch.toLowerCase()) || l.parent.toLowerCase().includes(ledgerSearch.toLowerCase())
                    );
                    // Group by parent
                    const byParent: Record<string, TallyLedger[]> = {};
                    filtered.forEach(l => { (byParent[l.parent || "Other"] ??= []).push(l); });
                    const parents = Object.keys(byParent).sort();
                    return (
                      <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ maxHeight: 380, overflowY: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                            <thead style={{ position: "sticky", top: 0, background: "rgba(5,9,20,0.95)", zIndex: 2 }}>
                              <tr>
                                <th style={{ padding: "0.6rem 1rem", textAlign: "left", color: "rgba(232,237,245,0.25)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Ledger Name</th>
                                <th style={{ padding: "0.6rem 1rem", textAlign: "left", color: "rgba(232,237,245,0.25)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Group / Parent</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parents.map(parent => (
                                byParent[parent].map((l, i) => (
                                  <tr key={l.name} style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                                    <td style={{ padding: "0.5rem 1rem", color: "#E8EDF5", fontWeight: 500 }}>{l.name}</td>
                                    {i === 0 ? (
                                      <td rowSpan={byParent[parent].length} style={{ padding: "0.5rem 1rem", verticalAlign: "top", borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
                                        <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 9px", borderRadius: 8, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", color: "#34D399" }}>{parent}</span>
                                      </td>
                                    ) : null}
                                  </tr>
                                ))
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {filtered.length < tallyLedgers.length && (
                          <div style={{ padding: "0.5rem 1rem", fontSize: "0.66rem", color: "rgba(232,237,245,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            Showing {filtered.length} of {tallyLedgers.length} ledgers
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

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
