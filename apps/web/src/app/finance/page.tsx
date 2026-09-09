"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type TallyStatus = { state: "idle" | "checking" | "connected" | "disconnected"; company: string };
type TallyStats = { revenue: number; expenses: number; profit: number; salesCount: number; fromDate: string; toDate: string; _raw?: string } | null;
type PeriodKey = "fy" | "quarter" | "month" | "lastmonth";

function fyDates(): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${y}0401`, to: `${y+1}0331`, label: `FY ${y}-${String(y+1).slice(2)}` };
}
function periodDates(key: PeriodKey): { from: string; to: string; label: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const fmtLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (key === "fy") return fyDates();
  if (key === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const qStart = new Date(now.getFullYear(), q * 3, 1);
    const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { from: fmt(qStart), to: fmt(qEnd), label: `${fmtLabel(qStart)} – ${fmtLabel(qEnd)}` };
  }
  if (key === "lastmonth") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lme = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(lm), to: fmt(lme), label: `${fmtLabel(lm)} – ${fmtLabel(lme)}` };
  }
  // month
  const ms = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(ms), to: fmt(now), label: `${fmtLabel(ms)} – ${fmtLabel(now)}` };
}

function parseTallyAmount(raw: string): number {
  // Tally returns "12345.67 Cr" or "12345.67 Dr" or just "12345.67"
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*(Cr|Dr)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2]?.toLowerCase() === "dr" ? -n : n;
}

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

async function fetchTallyStats(from: string, to: string): Promise<TallyStats & { _raw?: string }> {
  try {
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>FPGroupBal</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>${from}</SVFROMDATE><SVTODATE>${to}</SVTODATE></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="FPGroupBal" ISMODIFY="No"><TYPE>Group</TYPE><FETCH>Name,ClosingBalance</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const res = await fetch("http://localhost:7001", {
      method: "POST", headers: { "Content-Type": "text/xml" }, body: xml,
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const groups: Record<string, number> = {};
    // Try attribute format: <GROUP NAME="Sales Accounts">
    const attrRx = /<GROUP\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/GROUP>/gi;
    let m;
    while ((m = attrRx.exec(text)) !== null) {
      const bal = m[2].match(/<CLOSINGBALANCE[^>]*>([\s\S]*?)<\/CLOSINGBALANCE>/i);
      if (bal) groups[m[1].trim().toLowerCase()] = parseTallyAmount(bal[1]);
    }
    // Try child NAME tag: <GROUP><NAME>Sales Accounts</NAME>...
    if (Object.keys(groups).length === 0) {
      const childRx = /<GROUP[^>]*>\s*<NAME[^>]*>([^<]+)<\/NAME>([\s\S]*?)<\/GROUP>/gi;
      while ((m = childRx.exec(text)) !== null) {
        const bal = m[2].match(/<CLOSINGBALANCE[^>]*>([\s\S]*?)<\/CLOSINGBALANCE>/i);
        if (bal) groups[m[1].trim().toLowerCase()] = parseTallyAmount(bal[1]);
      }
    }
    const revenue = (groups["sales accounts"] ?? 0) + (groups["direct incomes"] ?? 0) + (groups["indirect incomes"] ?? 0);
    const expenses = Math.abs(groups["direct expenses"] ?? 0) + Math.abs(groups["indirect expenses"] ?? 0) + Math.abs(groups["purchase accounts"] ?? 0);
    // Store raw snippet for debugging when all zero
    const _raw = revenue === 0 && expenses === 0 ? text.slice(0, 600) : undefined;
    return { revenue, expenses, profit: revenue - expenses, salesCount: 0, fromDate: from, toDate: to, _raw };
  } catch (e) {
    return { revenue: 0, expenses: 0, profit: 0, salesCount: 0, fromDate: from, toDate: to, _raw: String(e) };
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
  const [tallyStats, setTallyStats] = useState<TallyStats>(null);
  const [tallyStatsLoading, setTallyStatsLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("fy");
  const [tallyLedgers, setTallyLedgers] = useState<TallyLedger[]>([]);
  const [tallyLedgersLoading, setTallyLedgersLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");

  const pingTally = useCallback(async () => {
    setTally(t => ({ ...t, state: "checking" }));
    const result = await checkTally();
    setTally(result);
  }, []);

  const loadTallyStats = useCallback(async (p: PeriodKey) => {
    setTallyStatsLoading(true);
    const { from, to } = periodDates(p);
    const data = await fetchTallyStats(from, to);
    setTallyStats(data);
    setTallyStatsLoading(false);
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

  // When Tally connects, load stats only (ledgers are manual to avoid overloading Tally)
  useEffect(() => {
    if (tally.state === "connected") loadTallyStats(period);
    if (tally.state === "disconnected") { setTallyLedgers([]); }
  }, [tally.state]);

  // When period changes + Tally connected, reload
  useEffect(() => {
    if (tally.state === "connected") loadTallyStats(period);
  }, [period]);

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
              <div style={{ marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
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

                {/* Period selector — always shown, drives Tally stats when connected */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                  <div style={{ fontSize: "0.6rem", color: "rgba(232,237,245,0.25)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                    {tally.state === "connected" ? "📡 Tally · Period" : "📊 App Data · Period"}
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    {([
                      { key: "fy" as PeriodKey, label: "This FY" },
                      { key: "quarter" as PeriodKey, label: "Quarter" },
                      { key: "month" as PeriodKey, label: "This Month" },
                      { key: "lastmonth" as PeriodKey, label: "Last Month" },
                    ]).map(p => (
                      <button key={p.key} onClick={() => setPeriod(p.key)}
                        style={{ padding: "4px 11px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", border: "1px solid", fontFamily: "inherit", transition: "all 0.15s",
                          background: period === p.key ? (tally.state === "connected" ? "rgba(52,211,153,0.12)" : "rgba(96,165,250,0.12)") : "rgba(255,255,255,0.03)",
                          borderColor: period === p.key ? (tally.state === "connected" ? "rgba(52,211,153,0.4)" : "rgba(96,165,250,0.4)") : "rgba(255,255,255,0.08)",
                          color: period === p.key ? (tally.state === "connected" ? "#34D399" : "#60A5FA") : "rgba(232,237,245,0.35)",
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: "0.66rem", color: "rgba(232,237,245,0.22)", fontFamily: "'IBM Plex Mono',monospace" }}>
                    {periodDates(period).label}
                  </div>
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

              {/* KPI Cards — Tally data when connected, app data otherwise */}
              {(() => {
                const useTally = tally.state === "connected" && tallyStats;
                const isLoading = useTally ? tallyStatsLoading : loading;
                const rev = useTally ? tallyStats!.revenue : stats.revenue;
                const prof = useTally ? tallyStats!.profit : stats.profit;
                const exp = useTally ? tallyStats!.expenses : stats.expenses;
                const source = useTally ? `📡 ${tally.company}` : "📂 FrePilot";
                return (
                  <>
                    {/* Source badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: useTally ? "rgba(52,211,153,0.08)" : "rgba(96,165,250,0.08)", border: `1px solid ${useTally ? "rgba(52,211,153,0.25)" : "rgba(96,165,250,0.2)"}`, color: useTally ? "#34D399" : "#60A5FA" }}>
                        {source}
                      </span>
                      <span style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.22)", fontFamily: "'IBM Plex Mono',monospace" }}>{periodDates(period).label}</span>
                      {isLoading && <span style={{ fontSize: "0.62rem", color: "rgba(232,237,245,0.2)" }}>Loading…</span>}
                    {useTally && !isLoading && <button onClick={() => loadTallyStats(period)} style={{ fontSize: "0.6rem", color: "rgba(52,211,153,0.5)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>↻ Reload</button>}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.85rem", marginBottom: "1.75rem" }}>
                      {[
                        { label: "Revenue", value: isLoading ? "—" : (useTally && rev === 0 ? "No entries" : fmt(rev)), color: "#34D399", sub: useTally && rev === 0 && !isLoading ? "No sales in Tally this period" : periodDates(period).label, mono: !( useTally && rev === 0) },
                        { label: "Net Profit", value: isLoading ? "—" : (useTally && rev === 0 && exp === 0 ? "No entries" : (prof < 0 ? "−" : "") + fmt(prof)), color: prof >= 0 ? "#34D399" : "#F87171", sub: prof < 0 ? "Net loss" : "Net profit", mono: !(useTally && rev === 0 && exp === 0) },
                        { label: useTally ? "Total Expenses" : "Sales Invoices", value: isLoading ? "—" : (useTally && exp === 0 ? "No entries" : useTally ? fmt(exp) : String(stats.sales)), color: "#F59E0B", sub: useTally ? "All expense groups" : "Posted entries", mono: !(useTally && exp === 0) },
                        { label: "Draft Entries", value: isLoading ? "—" : String(stats.drafts), color: stats.drafts > 0 ? "#FB923C" : "rgba(232,237,245,0.3)", sub: stats.drafts > 0 ? "Needs review" : "All clear", mono: false, alert: stats.drafts > 0 },
                      ].map(k => (
                        <div key={k.label} className="fp-kpi" style={k.alert ? { background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.2)" } : {}}>
                          <div style={{ fontSize: "0.58rem", color: "rgba(232,237,245,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.75rem" }}>{k.label}</div>
                          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: k.color, fontFamily: k.mono ? "'IBM Plex Mono',monospace" : "inherit", letterSpacing: k.mono ? "-0.02em" : "-0.01em", lineHeight: 1, marginBottom: "0.4rem" }}>{k.value}</div>
                          <div style={{ fontSize: "0.65rem", color: "rgba(232,237,245,0.25)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.sub}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

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
