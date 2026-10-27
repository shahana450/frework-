"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminCosts from "./AdminCosts";
import AdminWhatsApp, { AdminWhatsAppBanner } from "./AdminWhatsApp";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  MessageSquare, CalendarClock, CheckSquare, Crown, LogOut,
  ArrowRight, FileText, TrendingUp, Building2, Briefcase,
  AlertCircle, Plus, Rocket, ChevronRight, Zap, Star,
  ExternalLink, Globe, MapPin, Users, GraduationCap, Wrench,
  Calculator, ReceiptText, ClipboardList, BarChart3, BadgeCheck, Lock,
  CheckCircle, Clock,
} from "lucide-react";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import { FREBOOK_PLAN, FREBOOK_PLANS_LIST, planLabel } from "@/lib/plans";

const PAID_SERVICES = [
  {
    icon: ReceiptText,   label: "GST Registration & Filing",  sub: "GSTIN in 3–5 days · Monthly GSTR-1 & 3B",  price: "₹999",   href: "/services/gst",                   orderKey: "gst-registration",  color: "#232A63", grad: "linear-gradient(135deg,#1D4ED8,#232A63)", bg: "rgba(35,42,99,0.07)",  border: "rgba(35,42,99,0.18)",
  },
  {
    icon: Calculator,    label: "Income Tax Return (ITR)",    sub: "ITR-1 to ITR-6 · Tax planning & refunds",   price: "₹799",   href: "/services/income-tax",            orderKey: "income-tax",        color: "#047857", grad: "linear-gradient(135deg,#047857,#047857)", bg: "rgba(5,150,105,0.07)",  border: "rgba(5,150,105,0.18)",
  },
  {
    icon: BarChart3,     label: "Accounting & Bookkeeping",  sub: "Monthly books · P&L · Balance sheet",        price: "₹1,499", href: "/services/accounting",            orderKey: "accounting",        color: "#B45309", grad: "linear-gradient(135deg,#B45309,#D97706)", bg: "rgba(217,119,6,0.07)",  border: "rgba(217,119,6,0.18)",
  },
  {
    icon: Building2,     label: "Company Registration",      sub: "Pvt Ltd · LLP · OPC · Proprietorship",       price: "₹999",   href: "/services/business-registration", orderKey: "company-reg",       color: "#5B4BC4", grad: "linear-gradient(135deg,#6D28D9,#5B4BC4)", bg: "rgba(124,58,237,0.07)", border: "rgba(124,58,237,0.18)",
  },
  {
    icon: ClipboardList, label: "GST Audit & Reconciliation",sub: "GSTR-9C · ITC reconciliation · Notices",     price: "₹4,999", href: "/services/audit",                 orderKey: "gst-audit",         color: "#DC2626", grad: "linear-gradient(135deg,#B91C1C,#DC2626)", bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.18)",
  },
  {
    icon: BadgeCheck,    label: "ROC & Compliance",          sub: "Annual filing · MCA · Director KYC",          price: "₹1,999", href: "/services/roc-compliance",        orderKey: "roc-compliance",    color: "#0E6B7A", grad: "linear-gradient(135deg,#0E7490,#0E6B7A)", bg: "rgba(8,145,178,0.07)", border: "rgba(8,145,178,0.18)",
  },
];

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface Startup {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  sector: string;
  stage: string;
  status: string;
}

interface Subscription {
  plan: string;
  billing: string;
  status: string;
  started_at: string;
}

interface MySpace {
  id: string;
  name: string;
  city: string;
  type: string;
  price_per_day: number | null;
  price_per_month: number | null;
  status: string;
  created_at: string;
}

function EmptyState({ icon: Icon, title, desc, cta, href }: {
  icon: React.ElementType; title: string; desc: string; cta: string; href: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600 mb-1">{title}</p>
      <p className="text-xs text-slate-400 mb-4 max-w-[180px]">{desc}</p>
      <Link href={href}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 text-xs font-semibold hover:bg-blue-100 transition-colors">
        <Plus className="w-3 h-3" /> {cta}
      </Link>
    </div>
  );
}

type AdminCard = { icon: string; title: string; desc: string; href: string; color: string; border: string; bg: string; badge: string; external?: boolean };

const PLATFORM_CARDS: AdminCard[] = [
  { icon: "🏛️", title: "Coworking Submissions", desc: "Review and approve space listings submitted by owners", href: "/dashboard/coworking", color: "#B45309", border: "rgba(240,102,43,0.25)", bg: "rgba(240,102,43,0.07)", badge: "Approve / Reject" },
  { icon: "📋", title: "Service Orders", desc: "View all paid service orders from customers", href: "/dashboard/orders", color: "#232A63", border: "rgba(35,42,99,0.25)", bg: "rgba(35,42,99,0.07)", badge: "Manage Orders" },
  { icon: "📂", title: "Service Requests", desc: "Review uploaded docs and grant service packages to users", href: "/dashboard/service-requests", color: "#B45309", border: "rgba(240,102,43,0.25)", bg: "rgba(240,102,43,0.07)", badge: "Approve Packages" },
  { icon: "👥", title: "Freelancer Profiles", desc: "Review and approve freelancer profile submissions", href: "/dashboard/freelancer", color: "#047857", border: "rgba(5,150,105,0.25)", bg: "rgba(5,150,105,0.07)", badge: "Review Profiles" },
  { icon: "🚀", title: "Startup Listings", desc: "Manage startup profiles and funding listings", href: "/dashboard/startup", color: "#5B4BC4", border: "rgba(124,58,237,0.25)", bg: "rgba(124,58,237,0.07)", badge: "View Startups" },
  { icon: "💬", title: "Support Messages", desc: "Customer queries and WhatsApp conversations", href: "https://wa.me/919539028318", color: "#0B7A55", border: "rgba(37,211,102,0.25)", bg: "rgba(37,211,102,0.07)", badge: "Open WhatsApp", external: true },
  { icon: "🌐", title: "Live Website", desc: "View the public-facing FreWork website", href: "/", color: "#0E6B7A", border: "rgba(8,145,178,0.25)", bg: "rgba(8,145,178,0.07)", badge: "Open Site" },
];

const FINANCE_CARDS: AdminCard[] = [
  { icon: "🛩️", title: "Finance Dashboard", desc: "Overview — P&L snapshot, pending tasks, quick actions", href: "/finance", color: "#232A63", border: "rgba(35,42,99,0.25)", bg: "rgba(35,42,99,0.07)", badge: "Dashboard" },
  { icon: "🔑", title: "FreBook Admin", desc: "Grant trials, activate or revoke FreBook subscriptions", href: "/finance/admin", color: "#3A4170", border: "rgba(35,42,99,0.25)", bg: "rgba(35,42,99,0.07)", badge: "Manage Subs" },
  { icon: "🧾", title: "Sales Invoices", desc: "Create and manage sales invoices for clients", href: "/finance/sales/new", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "New Invoice" },
  { icon: "📦", title: "Purchase Bills", desc: "Record vendor bills and purchase entries", href: "/finance/purchases/new", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "New Bill" },
  { icon: "💸", title: "Expenses", desc: "Record and categorise business expenses", href: "/finance/expenses", color: "#3A4170", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Record" },
  { icon: "💳", title: "Payment Entry", desc: "Record receipts and payments against invoices", href: "/finance/payment", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Pay / Receive" },
  { icon: "📤", title: "Upload Documents", desc: "Upload invoices & bank statements for AI extraction", href: "/finance/upload", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Upload" },
  { icon: "🤖", title: "AI Review Queue", desc: "Review and approve AI-extracted journal entries", href: "/finance/ai-review", color: "#3A4170", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Review AI" },
  { icon: "📒", title: "Journal Entries", desc: "Double-entry ledger — Dr = Cr enforced", href: "/finance/journals", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Journals" },
  { icon: "📒", title: "Account Ledger", desc: "Account-wise ledger with opening & closing balances", href: "/finance/ledger", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Ledger" },
  { icon: "📥", title: "Receivables (AR)", desc: "Who owes you money — customer aging report", href: "/finance/receivables", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "AR" },
  { icon: "📤", title: "Payables (AP)", desc: "Who you owe — vendor aging report", href: "/finance/payables", color: "#3A4170", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "AP" },
  { icon: "📈", title: "Financial Reports", desc: "P&L, Balance Sheet, Cash Flow for the business", href: "/finance/reports", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Reports" },
  { icon: "🏛️", title: "GST Returns", desc: "GSTR-1, GSTR-3B — auto-prepared from books", href: "/finance/gst", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "GST" },
  { icon: "🔖", title: "TDS Tracker", desc: "Section-wise TDS deductions, due dates & challan", href: "/finance/tds", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "TDS" },
  { icon: "🏦", title: "Bank Reconciliation", desc: "Import CSV, auto-match bank transactions", href: "/finance/banking", color: "#3A4170", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "BRS" },
  { icon: "🔄", title: "Tally Export", desc: "Export books as Tally-compatible XML", href: "/finance/tally", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Export" },
  { icon: "📊", title: "Chart of Accounts", desc: "Indian account heads — Assets, Liabilities, Income, Expense", href: "/finance/chart-of-accounts", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "COA" },
  { icon: "👤", title: "Contacts", desc: "Manage customers and vendors with opening balances", href: "/finance/contacts", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Contacts" },
  { icon: "📅", title: "Financial Years", desc: "Create and manage financial years per business", href: "/finance/fy", color: "#3A4170", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "FY" },
  { icon: "🫂", title: "Team & Access", desc: "Add team members and set access permissions", href: "/finance/team", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Team" },
  { icon: "⚙️", title: "Business Setup", desc: "Configure GSTIN, bank accounts and business details", href: "/finance/setup", color: "#232A63", border: "rgba(35,42,99,0.2)", bg: "rgba(35,42,99,0.06)", badge: "Setup" },
];

function AdminCardGrid({ cards }: { cards: AdminCard[] }) {
  return (
    <>
      {cards.map(item => (
        <Link key={item.title} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}
          className="rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.02] hover:opacity-90"
          style={{ background: item.bg, borderColor: item.border }}>
          <div className="flex items-start justify-between">
            <span className="text-2xl">{item.icon}</span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: item.bg, color: item.color, border: `1px solid ${item.border}` }}>{item.badge}</span>
          </div>
          <div>
            <h3 className="font-black text-sm mb-1" style={{ color: "#141A3A" }}>{item.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#4A5070" }}>{item.desc}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold mt-auto" style={{ color: item.color }}>Open <ArrowRight className="w-3.5 h-3.5" /></div>
        </Link>
      ))}
    </>
  );
}

type AdminMetrics = {
  users: { total: number; new7: number; new30: number; active7: number };
  signups: { day: string; n: number }[];
  businesses: { total: number; new30: number; outsideIndia: number };
  frebook: { paying: number; free: number; mrr: number; revenueMonth: number; autoRenew: number };
  activity: { posted7: number; posted30: number; viaWhatsApp30: number; waLinked: number };
  expiring: { email: string; ends: string; paying: boolean; auto: boolean }[];
  recent: { email: string; created: string; via: string; hasBusiness: boolean }[];
  logins?: { email: string; at: string; via: string }[];
};

// Business overview for FreWork staff: growth, customers, revenue, product use
function AdminOverview() {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const r = await fetch("/api/admin/metrics", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Couldn't load the overview."); return; }
      setM(d as AdminMetrics);
    });
  }, []);
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const day = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.08)", borderRadius: 18, padding: "1rem 1.1rem" };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A90AE" };

  if (err) return <div style={{ ...card, color: "#C2321F", marginBottom: 24 }}>{err}</div>;
  if (!m) return <div style={{ ...card, color: "#5A6080", marginBottom: 24 }}>Loading the business overview…</div>;
  const max = Math.max(1, ...m.signups.map(s => s.n));
  const kpis: { k: string; v: string; sub: string; tone?: string }[] = [
    { k: "Users", v: m.users.total.toLocaleString("en-IN"), sub: `+${m.users.new7} this week · ${m.users.active7} active` },
    { k: "Businesses", v: m.businesses.total.toLocaleString("en-IN"), sub: `+${m.businesses.new30} in 30 days${m.businesses.outsideIndia ? ` · ${m.businesses.outsideIndia} abroad` : ""}` },
    { k: "Paying customers", v: String(m.frebook.paying), sub: `${m.frebook.autoRenew} on auto-renew`, tone: "#0B7A55" },
    { k: "Free / trial", v: String(m.frebook.free), sub: "convert these next", tone: "#B45309" },
    { k: "MRR", v: inr(m.frebook.mrr), sub: "plan prices × paying users, before GST", tone: "#232A63" },
    { k: "Collected this month", v: inr(m.frebook.revenueMonth), sub: "FreBook payments, incl. GST", tone: "#232A63" },
  ];

  return (
    <section style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#141A3A" }}>Business overview</h2>
        <span style={{ fontSize: 12, color: "#8A90AE" }}>Live · test companies excluded</span>
      </div>

      <div className="adm-kpis">
        {kpis.map(x => (
          <div key={x.k} style={card}>
            <div style={label}>{x.k}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: x.tone ?? "#141A3A", marginTop: 6, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{x.v}</div>
            <div style={{ fontSize: 12, color: "#5A6080", marginTop: 2 }}>{x.sub}</div>
          </div>
        ))}
      </div>

      <div className="adm-two">
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={label}>Sign-ups · last 30 days</span>
            <b style={{ fontSize: 13, color: "#141A3A" }}>{m.users.new30} total</b>
          </div>
          <div role="img" aria-label={`Sign-ups per day for the last 30 days, ${m.users.new30} in total`} style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, marginTop: 14 }}>
            {m.signups.map((s, i) => (
              <div key={s.day} title={`${day(s.day)}: ${s.n}`} style={{ flex: 1, height: `${Math.max(4, (s.n / max) * 100)}%`, borderRadius: 4, background: i === m.signups.length - 1 ? "#F0662B" : s.n ? "#3A438E" : "rgba(35,42,99,0.12)" }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8A90AE", marginTop: 6 }}>
            <span>{day(m.signups[0].day)}</span><span>today</span>
          </div>
        </div>
        <div style={card}>
          <span style={label}>Product use · FreBook</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {[["Entries posted · 7 days", m.activity.posted7], ["Entries posted · 30 days", m.activity.posted30], ["Via WhatsApp · 30 days", m.activity.viaWhatsApp30], ["WhatsApp numbers linked", m.activity.waLinked]].map(([k, v]) => (
              <div key={k as string} style={{ background: "#F5F6FA", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#141A3A", fontVariantNumeric: "tabular-nums" }}>{(v as number).toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 12, color: "#5A6080" }}>{k as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="adm-two">
        <div style={card}>
          <span style={label}>Renewals due · next 7 days</span>
          {m.expiring.length === 0 ? <p style={{ margin: "12px 0 0", fontSize: 13, color: "#5A6080" }}>Nobody&apos;s plan ends this week.</p> : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
              {m.expiring.map(e => (
                <div key={e.email + e.ends} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(20,26,58,0.06)", fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#141A3A" }}>{e.email}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: e.paying ? "#E3F6EE" : "#FFF4DB", color: e.paying ? "#0B7A55" : "#8A5A00" }}>{e.auto ? "auto-renews" : e.paying ? "paid" : "free"}</span>
                  <span style={{ color: "#5A6080", fontVariantNumeric: "tabular-nums" }}>{day(e.ends)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={card}>
          <span style={label}>Latest sign-ups</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
            {m.recent.map(u => (
              <div key={u.email + u.created} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(20,26,58,0.06)", fontSize: 13 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#141A3A" }}>{u.email || "(no email)"}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: u.hasBusiness ? "#EEF0FB" : "#F2F3F6", color: u.hasBusiness ? "#232A63" : "#8A90AE" }}>{u.hasBusiness ? "set up books" : "no business yet"}</span>
                <span style={{ color: "#5A6080", fontSize: 12, width: 52, textAlign: "right" }}>{day(u.created)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <span style={label}>Last signed in</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
            {(m.logins ?? []).length === 0 && <p style={{ margin: 0, fontSize: 13, color: "#5A6080" }}>No sign-ins yet.</p>}
            {(m.logins ?? []).map(u => {
              const mins = Math.floor((Date.now() - Date.parse(u.at)) / 60000);
              const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.floor(mins / 60)} h ago` : `${Math.floor(mins / 1440)} d ago`;
              return (
                <div key={u.email + u.at} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(20,26,58,0.06)", fontSize: 13 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: mins < 60 ? "#0B7A55" : mins < 1440 ? "#C9A24A" : "#C9CEDA" }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#141A3A" }}>{u.email || "(no email)"}</span>
                  <span style={{ fontSize: 11, color: "#8A90AE" }}>{u.via}</span>
                  <span title={new Date(u.at).toLocaleString("en-IN")} style={{ color: "#5A6080", fontSize: 12, width: 74, textAlign: "right" }}>{ago}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`
        .adm-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .adm-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 1100px) { .adm-kpis { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 700px) { .adm-kpis { grid-template-columns: repeat(2, 1fr); } .adm-two { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function TrialGrantWidget() {
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<string>(FREBOOK_PLAN.id);
  const [days, setDays] = useState(7);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");

  async function grant(type: "trial" | "active") {
    if (!userId.trim()) { setMsg("Enter a user ID or email"); return; }
    setWorking(true); setMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg("Not logged in"); setWorking(false); return; }
      const res = await fetch("/api/finance/subscription/admin", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: type === "trial" ? "grant_trial" : "activate", user_id: userId.trim(), plan, trial_days: days }),
      });
      const data = await res.json();
      setMsg(data.ok ? (data.message ? `✓ ${data.message}` : `✓ Done${data.ends_at ? " — expires " + new Date(data.ends_at).toLocaleDateString("en-IN") : ""}`) : data.error ?? "Error");
      if (data.ok) setUserId("");
    } catch { setMsg("Network error"); }
    setWorking(false);
  }

  const inp: React.CSSProperties = { background: "rgba(35,42,99,0.06)", border: "1px solid rgba(35,42,99,0.2)", color: "#141A3A", padding: "8px 12px", borderRadius: 8, fontSize: "0.83rem", outline: "none", width: "100%" };

  return (
    <div className="rounded-2xl mb-8 p-6" style={{ background: "rgba(35,42,99,0.06)", border: "1px solid rgba(35,42,99,0.2)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🛩️</span>
        <p className="font-black text-sm" style={{ color: "#232A63" }}>Grant FreBook Access</p>
        <Link href="/finance/admin" className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(35,42,99,0.12)", color: "#3A4170", border: "1px solid rgba(35,42,99,0.2)" }}>
          Full Admin →
        </Link>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(20,26,58,0.60)" }}>User ID or Email</label>
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="uuid or email from Supabase" style={inp} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(20,26,58,0.60)" }}>Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inp, width: "auto", cursor: "pointer" }}>
            {FREBOOK_PLANS_LIST.map(p => <option key={p.id} value={p.id}>{planLabel(p.id)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(20,26,58,0.60)" }}>Trial Days</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ ...inp, width: "auto", cursor: "pointer" }}>
            {[1,3,7,14,30].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>
        <button onClick={() => grant("trial")} disabled={working}
          className="px-5 py-2 rounded-xl font-black text-sm transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#232A63,#1D4ED8)", color: "#fff", opacity: working ? 0.6 : 1 }}>
          Grant Trial
        </button>
        <button onClick={() => grant("active")} disabled={working}
          className="px-5 py-2 rounded-xl font-black text-sm transition-all hover:opacity-90"
          style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#0B7A55", opacity: working ? 0.6 : 1 }}>
          Activate
        </button>
      </div>
      {msg && <p className="mt-3 text-xs font-semibold" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#C2321F" }}>{msg}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [mySpaces, setMySpaces] = useState<MySpace[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hasCoworkingListing, setHasCoworkingListing] = useState(false);
  const [showPurpose, setShowPurpose] = useState(false);
  const [finSub, setFinSub] = useState<{ status: string; subscription_ends_at: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace("/login"); return; }
      const u = session.user;
      setUser({
        id: u.id,
        email: u.email ?? "",
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "User",
        avatar: u.user_metadata?.avatar_url,
      });
      const [{ data: startupData }, { data: subData }, { data: fwUser }, { data: spacesData }, { data: coworkData }] = await Promise.all([
        supabase.from("fw_startups").select("id, slug, name, tagline, sector, stage, status").eq("user_id", u.id).order("created_at", { ascending: false }),
        supabase.from("fw_subscriptions").select("plan, billing, status, started_at").eq("user_id", u.id).maybeSingle(),
        supabase.from("fw_users").select("role").eq("id", u.id).maybeSingle(),
        supabase.from("fw_workspaces").select("id, name, city, type, price_per_day, price_per_month, status, created_at").eq("user_id", u.id).order("created_at", { ascending: false }),
        supabase.from("coworking_spaces").select("id").eq("owner_id", u.id).limit(1).maybeSingle(),
      ]);
      // FreBook plan (the subscription that matters now)
      supabase.from("fw_fin_subscriptions").select("status,subscription_ends_at").eq("user_id", u.id).maybeSingle().then(({ data }) => setFinSub(data ?? null));
      setStartups(startupData ?? []);
      setSubscription(subData);
      setUserRole(fwUser?.role ?? "client");
      setMySpaces(spacesData ?? []);
      setHasCoworkingListing(!!coworkData);
      // Admins always see the admin panel — clear any stale purpose redirect
      const adminEmails = ["admin.frework@gmail.com"];
      if (adminEmails.includes(u.email ?? "")) {
        localStorage.removeItem(`fw_purpose_${u.id}`);
      } else {
        // Clear stale docs-upload redirect so users can reach the main dashboard
        const chosen = localStorage.getItem(`fw_purpose_${u.id}`);
        if (!chosen || chosen === "/dashboard/docs-upload") {
          localStorage.removeItem(`fw_purpose_${u.id}`);
          setShowPurpose(false);
        } else {
          router.replace(chosen);
          return;
        }
      }
      setLoading(false);
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const ADMIN_EMAILS = ["admin.frework@gmail.com"];
  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showPurpose && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#F2F3F6" }}>
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-12">
          <FreWorkLogo size={36} />
          <div>
            <p className="font-black text-base" style={{ color: "#141A3A" }}>FreWork</p>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: "#5A6080" }}>Business OS</p>
          </div>
        </div>

        <div className="max-w-lg w-full">
          <h1 className="text-2xl font-black text-center mb-2" style={{ color: "#141A3A" }}>
            Welcome, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-center mb-10" style={{ color: "#4A5070" }}>
            What would you like to do today?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Coworking option */}
            <button
              onClick={() => {
                const dest = hasCoworkingListing ? "/coworking/my-space" : "/coworking/list";
                if (user?.id) localStorage.setItem(`fw_purpose_${user.id}`, dest);
                router.push(dest);
              }}
              className="group flex flex-col items-start gap-4 p-6 rounded-2xl border text-left transition-all hover:scale-[1.02] hover:shadow-2xl"
              style={{ background: "linear-gradient(135deg,rgba(240,102,43,0.1),rgba(240,102,43,0.04))", borderColor: "rgba(240,102,43,0.25)" }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "linear-gradient(135deg,#C2410C,#A07C2E)", boxShadow: "0 4px 20px rgba(240,102,43,0.4)" }}>
                🏛️
              </div>
              <div>
                <p className="font-black text-base mb-1" style={{ color: "#C2410C" }}>
                  {hasCoworkingListing ? "Manage My Space" : "List My Coworking Space"}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#4A5070" }}>
                  {hasCoworkingListing
                    ? "View enquiries, edit details, track your listing status"
                    : "List your space free · Zero commission · Leads straight to your WhatsApp"}
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-lg mt-auto"
                style={{ background: "rgba(240,102,43,0.15)", color: "#C2410C", border: "1px solid rgba(240,102,43,0.25)" }}>
                {hasCoworkingListing ? "Open Dashboard →" : "List Free →"}
              </span>
            </button>

            {/* Services option */}
            <button
              onClick={() => {
                if (user?.id) localStorage.setItem(`fw_purpose_${user.id}`, "/dashboard/services");
                router.push("/dashboard/services");
              }}
              className="group flex flex-col items-start gap-4 p-6 rounded-2xl border text-left transition-all hover:scale-[1.02] hover:shadow-2xl"
              style={{ background: "linear-gradient(135deg,rgba(35,42,99,0.1),rgba(35,42,99,0.04))", borderColor: "rgba(35,42,99,0.2)" }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "linear-gradient(135deg,#232A63,#232A63)", boxShadow: "0 4px 20px rgba(35,42,99,0.4)" }}>
                📋
              </div>
              <div>
                <p className="font-black text-base mb-1" style={{ color: "#232A63" }}>
                  GST / ITR / Accounting
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#4A5070" }}>
                  Select a service, upload your documents — our CA handles everything within 24 hours
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-lg mt-auto"
                style={{ background: "rgba(35,42,99,0.12)", color: "#232A63", border: "1px solid rgba(35,42,99,0.2)" }}>
                Upload Documents →
              </span>
            </button>
          </div>

          <button onClick={handleSignOut} className="mt-10 text-xs text-center w-full transition-colors hover:opacity-80" style={{ color: "#5A6080" }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen" style={{ background: "#F2F3F6", color: "#141A3A", fontFamily: "var(--font-plus-jakarta),var(--font-inter),system-ui,sans-serif" }}>
        {/* Admin header */}
        <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(240,102,43,0.12)", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)" }}>
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FreWorkLogo size={32} />
              <div>
                <p className="text-xs font-black" style={{ color: "#141A3A" }}>FreWork Admin</p>
                <p className="text-[10px]" style={{ color: "#5A6080" }}>{user?.email}</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
              style={{ borderColor: "rgba(194,50,31,0.25)", color: "#C2321F", background: "rgba(194,50,31,0.06)" }}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-black mb-1" style={{ color: "#141A3A" }}>Admin Panel</h1>
          <p className="text-sm mb-8" style={{ color: "#4A5070" }}>Manage FreWork — approve spaces, review orders, monitor platform.</p>

          <AdminWhatsAppBanner />
          <AdminOverview />
          <AdminWhatsApp />
          <AdminCosts />

          {/* Quick Trial Grant */}
          <TrialGrantWidget />


          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="col-span-full mb-1">
              <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "#C2410C" }}>Platform Management</p>
              <div className="h-px" style={{ background: "rgba(240,102,43,0.15)" }} />
            </div>
            <AdminCardGrid cards={PLATFORM_CARDS} />
            <div className="col-span-full mt-6 mb-1">
              <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(35,42,99,0.9)" }}>FreWork Finance</p>
              <div className="h-px" style={{ background: "rgba(35,42,99,0.15)" }} />
            </div>
            <AdminCardGrid cards={FINANCE_CARDS} />
          </div>
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const finActive = !!finSub && ["active", "trial"].includes(finSub.status) && !!finSub.subscription_ends_at && new Date(finSub.subscription_ends_at) > new Date();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusColor = (s: string) =>
    s === "live" ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/60" :
    s === "pending" ? "text-amber-400 bg-amber-950/40 border-amber-800/60" :
    "text-slate-400 bg-white border-slate-200";

  return (
    <div style={{ minHeight: "100vh", background: "#F2F3F6", color: "#141A3A", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .db-bg { background-image: radial-gradient(circle, rgba(99,130,246,0.035) 1px, transparent 1px); background-size: 30px 30px; }
        .db-nav-link { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 0.84rem; font-weight: 600; color: rgba(20,26,58,0.80); text-decoration: none; transition: all 0.15s; }
        .db-nav-link:hover { color: #141A3A; background: rgba(20,26,58,0.06); }
        .db-stat { background: rgba(20,26,58,0.05); border: 1px solid rgba(20,26,58,0.07); border-radius: 16px; padding: 1.1rem 1.25rem; transition: border-color 0.2s; }
        .db-stat:hover { border-color: rgba(20,26,58,0.62); }
        .db-card { background: rgba(20,26,58,0.05); border: 1px solid rgba(20,26,58,0.07); border-radius: 16px; overflow: hidden; }
        .db-card-hd { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(20,26,58,0.06); }
        .db-startup-row { display: flex; align-items: center; gap: 0.9rem; padding: 0.75rem 1.25rem; border-top: 1px solid rgba(20,26,58,0.05); transition: background 0.15s; }
        .db-startup-row:hover { background: rgba(20,26,58,0.05); }
        .db-ql { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.85rem; border-radius: 12px; border: 1px solid rgba(20,26,58,0.07); text-decoration: none; font-size: 0.72rem; font-weight: 700; text-align: center; transition: all 0.15s; background: rgba(20,26,58,0.05); }
        .db-ql:hover { background: rgba(20,26,58,0.06); border-color: rgba(20,26,58,0.62); transform: translateY(-1px); }
        .db-space-card { background: rgba(20,26,58,0.05); border: 1px solid rgba(20,26,58,0.07); border-radius: 14px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(20,26,58,0.08); border-radius: 4px; }
        select option { background: #FFFFFF; }
        .dbx-hero { display: grid; grid-template-columns: 1fr 1.15fr; gap: 1rem; margin-bottom: 1.75rem; }
        .dbx-hello { background: #FFFFFF; border: 1px solid rgba(20,26,58,0.08); border-radius: 22px; padding: 1.6rem 1.75rem; }
        .dbx-chip { font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 999px; background: #F2F3F6; color: #4A5070; }
        .dbx-frebook { display: block; text-decoration: none; border-radius: 22px; padding: 1.6rem 1.75rem; background: radial-gradient(120% 120% at 100% 0%, #3A438E 0%, #232A63 45%, #161B47 100%); box-shadow: 0 18px 40px rgba(35,42,99,0.28); transition: transform .15s; }
        .dbx-frebook:hover { transform: translateY(-2px); }
        .dbx-plan { font-size: 12px; font-weight: 800; padding: 5px 11px; border-radius: 999px; white-space: nowrap; }
        .dbx-cta { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 12px; background: #F0662B; color: #FFFFFF; font-weight: 800; font-size: 15px; }
        .dbx-h2 { margin: 0 0 .85rem; font-size: 1.05rem; font-weight: 900; letter-spacing: -0.01em; color: #141A3A; }
        .dbx-tiles { display: grid; grid-template-columns: repeat(6, 1fr); gap: .75rem; }
        .dbx-tile { display: flex; flex-direction: column; gap: 6px; padding: 1rem; border-radius: 18px; background: #FFFFFF; border: 1px solid rgba(20,26,58,0.08); text-decoration: none; transition: transform .15s, box-shadow .15s; }
        .dbx-tile:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(20,26,58,0.10); }
        .dbx-ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; margin-bottom: 4px; }
        .dbx-wa { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 1rem 1.25rem; border-radius: 18px; background: #F0FBF4; border: 1px solid rgba(14,122,67,0.18); text-decoration: none; margin-bottom: 1.75rem; }
        .dbx-services { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; }
        .dbx-svc { display: flex; align-items: center; gap: 12px; padding: .9rem 1rem; border-radius: 16px; background: #FFFFFF; border: 1px solid rgba(20,26,58,0.08); text-decoration: none; }
        .dbx-svc:hover { border-color: rgba(35,42,99,0.3); }
        .dbx-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
        @media (max-width: 1000px) { .dbx-tiles { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px) { .dbx-hero, .dbx-two, .dbx-services { grid-template-columns: 1fr; } .dbx-tiles { grid-template-columns: repeat(2, 1fr); } }
        @media (prefers-reduced-motion: reduce) { .dbx-frebook, .dbx-tile { transition: none; } }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(20,26,58,0.06)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 40, padding: "0 1.5rem", height: 60, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <FreWorkLogo size={30} />
            <span style={{ fontWeight: 900, fontSize: "1.05rem", color: "#141A3A", letterSpacing: "-0.02em" }}>FreWork</span>
          </Link>

          <nav style={{ display: "flex", alignItems: "center", gap: "0.2rem", marginLeft: "1.5rem" }}>
            {[
              { label: "Services", href: "/services" },
              { label: "Freelancers", href: "/freelancers" },
              { label: "Coworking", href: "/coworking" },
              { label: "Startups", href: "/startups" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="db-nav-link">{label}</Link>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid rgba(20,26,58,0.10)" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(35,42,99,0.2)", border: "1.5px solid rgba(35,42,99,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#232A63" }}>{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "rgba(20,26,58,1.00)" }} className="hidden sm:block">{user?.name}</span>
            <button onClick={handleSignOut} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(194,50,31,0.2)", background: "rgba(194,50,31,0.06)", color: "#C2321F", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="db-bg" style={{ minHeight: "calc(100vh - 60px)" }}>
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>

          {/* Welcome + FreBook — the one thing most people come here for */}
          <section className="dbx-hero">
            <div className="dbx-hello">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {user?.avatar
                  ? <img src={user.avatar} alt="" width={56} height={56} style={{ borderRadius: 18, border: "2px solid #FFFFFF", boxShadow: "0 6px 18px rgba(20,26,58,0.15)" }} />
                  : <div style={{ width: 56, height: 56, borderRadius: 18, background: "#232A63", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 22 }}>{firstName[0]?.toUpperCase()}</div>}
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: "#5A6080", fontWeight: 600 }}>{greeting}</p>
                  <h1 style={{ margin: "2px 0 0", fontSize: "clamp(1.8rem,3.4vw,2.5rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#141A3A", lineHeight: 1.05 }}>{firstName}</h1>
                </div>
              </div>
              <p style={{ margin: "18px 0 0", fontSize: 15, color: "#4A5070", lineHeight: 1.6, maxWidth: 440 }}>
                What happened in the business today? Tell FreBook in a line — or drop a bill — and your books, GST and Tally stay up to date.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                <span className="dbx-chip">● Signed in as {user?.email}</span>
              </div>
            </div>

            <Link href="/finance" className="dbx-frebook">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFD9C7" }}>FreBook · AI accountant</span>
                <span className="dbx-plan" style={{ background: finActive ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.14)", color: finActive ? "#86EFAC" : "#FFFFFF" }}>
                  {finActive ? `Active · till ${new Date(finSub!.subscription_ends_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "14 days free"}
                </span>
              </div>
              <h2 style={{ margin: "16px 0 6px", fontSize: "clamp(1.5rem,2.6vw,2rem)", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Chat in. Books out.</h2>
              <p style={{ margin: 0, color: "#C8D2F2", fontSize: 14, lineHeight: 1.6 }}>
                Entries drafted for you · GST-ready invoices · bank &amp; bill import · live P&amp;L · two-way Tally sync.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                <span className="dbx-cta">{finActive ? "Open FreBook" : "Start your free trial"} <ArrowRight className="w-4 h-4" /></span>
              </div>
            </Link>
          </section>

          {/* Jump back in */}
          <section style={{ marginBottom: "1.75rem" }}>
            <h2 className="dbx-h2">Jump back in</h2>
            <div className="dbx-tiles">
              {[
                { href: "/finance/chat-book", icon: MessageSquare, label: "Record by chat", sub: "“Paid rent 25,000 by bank”", tint: "#EEF0FB", ink: "#232A63" },
                { href: "/finance/sales/new", icon: ReceiptText, label: "New invoice", sub: "Bill a customer in a minute", tint: "#FFF1E8", ink: "#C2410C" },
                { href: "/finance/inbox", icon: FileText, label: "Smart Inbox", sub: "Drop bills & bank statements", tint: "#E9F7F0", ink: "#0B7A55" },
                { href: "/finance/reports?tab=profit_loss", icon: BarChart3, label: "Reports", sub: "P&L · Balance Sheet", tint: "#F3EEFB", ink: "#5B4BC4" },
                { href: "/finance/gst/returns", icon: ClipboardList, label: "GST returns", sub: "GSTR-1 · 3B prepared", tint: "#FFF7DD", ink: "#8A5A00" },
                { href: "/finance/tally", icon: TrendingUp, label: "Tally", sub: "Push & sync entries", tint: "#EAF2FF", ink: "#1F5EFF" },
              ].map(t => (
                <Link key={t.label} href={t.href} className="dbx-tile">
                  <span className="dbx-ico" style={{ background: t.tint, color: t.ink }}><t.icon className="w-5 h-5" /></span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: "#141A3A" }}>{t.label}</span>
                  <span style={{ fontSize: 12.5, color: "#5A6080" }}>{t.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* WhatsApp */}
          <a href="https://wa.me/919539028318?text=Hi%20FreBook" target="_blank" rel="noopener noreferrer" className="dbx-wa">
            <span style={{ width: 42, height: 42, borderRadius: 12, background: "#25D366", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#FFFFFF" aria-hidden="true"><path d="M12.04 2a9.93 9.93 0 0 0-8.6 14.9L2 22l5.25-1.38A9.94 9.94 0 1 0 12.04 2zm5.8 14.06c-.24.68-1.42 1.32-1.96 1.36-.5.05-1.13.07-1.82-.11a16.6 16.6 0 0 1-1.65-.61 12.9 12.9 0 0 1-4.94-4.37c-.36-.49-.87-1.46-.87-2.79 0-1.33.7-1.99.95-2.26.24-.27.53-.34.71-.34h.51c.16 0 .38-.06.6.46.22.53.75 1.83.82 1.96.07.13.11.29.02.47-.09.18-.13.29-.27.45-.13.16-.28.36-.4.48-.13.13-.27.28-.12.55.16.27.69 1.14 1.48 1.84 1.02.9 1.88 1.18 2.15 1.32.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.56.74 1.83.87.27.13.45.2.51.31.07.11.07.64-.17 1.32z"/></svg>
            </span>
            <span style={{ flex: 1, minWidth: 200 }}>
              <b style={{ display: "block", fontSize: 15, color: "#141A3A" }}>FreBook on WhatsApp</b>
              <span style={{ fontSize: 13, color: "#5A6080" }}>Record entries and ask &ldquo;profit this month&rdquo; from your phone. Link your number once in FreBook → WhatsApp.</span>
            </span>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#0E7A43", whiteSpace: "nowrap" }}>Open chat →</span>
          </a>

          {/* Need a CA? */}
          <section style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2 className="dbx-h2">Need a CA?</h2>
              <Link href="/services" style={{ fontSize: 13, fontWeight: 700, color: "#232A63", textDecoration: "none" }}>All services →</Link>
            </div>
            <div className="dbx-services">
              {PAID_SERVICES.slice(0, 4).map(s => (
                <Link key={s.label} href={s.href} className="dbx-svc">
                  <span className="dbx-ico" style={{ background: "#F2F3F6", color: "#232A63" }}><s.icon className="w-5 h-5" /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 14, color: "#141A3A" }}>{s.label}</b>
                    <span style={{ fontSize: 12, color: "#5A6080" }}>{s.sub}</span>
                  </span>
                  <span style={{ fontWeight: 900, color: "#232A63", fontSize: 15 }}>{s.price}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── SPACE OWNER SECTION ── */}
        {(userRole === "space_owner" || mySpaces.length > 0) && (
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 className="w-4 h-4" style={{ color: "#232A63" }} /> My Listed Spaces
                </h2>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.74rem", color: "rgba(20,26,58,0.70)" }}>Manage your coworking spaces · Approved listings go live publicly</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Link href="/dashboard/coworking" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(240,102,43,0.25)", color: "#C2410C", background: "rgba(240,102,43,0.07)", fontSize: "0.76rem", fontWeight: 700, textDecoration: "none" }}>
                  <CheckCircle className="w-3.5 h-3.5" /> Review Submissions
                </Link>
                <Link href="/dashboard/workspace/submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg,#232A63,#232A63)", color: "#fff", fontSize: "0.76rem", fontWeight: 700, textDecoration: "none" }}>
                  <Plus className="w-3.5 h-3.5" /> Add New Space
                </Link>
              </div>
            </div>

            {mySpaces.length === 0 ? (
              <div style={{ borderRadius: 16, border: "2px dashed rgba(35,42,99,0.2)", padding: "2.5rem", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(35,42,99,0.08)", border: "1px solid rgba(35,42,99,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem" }}>
                  <Building2 className="w-5 h-5" style={{ color: "#232A63", opacity: 0.7 }} />
                </div>
                <p style={{ fontWeight: 600, fontSize: "0.84rem", color: "rgba(20,26,58,0.95)", marginBottom: "0.3rem" }}>No spaces listed yet</p>
                <p style={{ fontSize: "0.74rem", color: "rgba(20,26,58,0.65)", marginBottom: "1.25rem", maxWidth: 340, margin: "0 auto 1.25rem", lineHeight: 1.7 }}>
                  Add your coworking space or office for free. Once approved it appears publicly on frework.online/coworking.
                </p>
                <Link href="/dashboard/workspace/submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, background: "linear-gradient(135deg,#232A63,#232A63)", color: "#fff", fontSize: "0.8rem", fontWeight: 700, textDecoration: "none" }}>
                  <Plus className="w-3.5 h-3.5" /> List Your First Space — Free
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
                {mySpaces.map(space => {
                  const isApproved = space.status === "approved";
                  const isPending  = space.status === "pending";
                  return (
                    <div key={space.id} className="db-space-card">
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(35,42,99,0.08)", border: "1px solid rgba(35,42,99,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Building2 className="w-4 h-4" style={{ color: "#232A63" }} />
                        </div>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: isApproved ? "rgba(11,122,85,0.1)" : isPending ? "rgba(240,102,43,0.1)" : "rgba(20,26,58,0.05)", border: `1px solid ${isApproved ? "rgba(11,122,85,0.25)" : isPending ? "rgba(240,102,43,0.25)" : "rgba(20,26,58,0.10)"}`, color: isApproved ? "#0B7A55" : isPending ? "#B45309" : "rgba(20,26,58,0.75)", flexShrink: 0 }}>
                          {isApproved ? "● Live" : isPending ? "⏳ Reviewing" : space.status}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.84rem", margin: "0 0 0.2rem" }}>{space.name}</p>
                        <p style={{ fontSize: "0.7rem", color: "rgba(20,26,58,0.70)", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin className="w-3 h-3" />{space.city} · {space.type}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.72rem" }}>
                        {space.price_per_day && <span style={{ fontWeight: 700, color: "rgba(20,26,58,1.00)" }}>₹{space.price_per_day.toLocaleString("en-IN")}/day</span>}
                        {space.price_per_month && <span style={{ fontWeight: 700, color: "rgba(20,26,58,1.00)" }}>₹{space.price_per_month.toLocaleString("en-IN")}/mo</span>}
                        <span style={{ marginLeft: "auto", color: "rgba(20,26,58,0.62)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock className="w-3 h-3" />
                          {new Date(space.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
                        </span>
                      </div>
                      {isApproved && (
                        <Link href="/coworking" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", borderRadius: 9, border: "1px solid rgba(35,42,99,0.2)", color: "#232A63", fontSize: "0.72rem", fontWeight: 700, textDecoration: "none" }}>
                          <ExternalLink className="w-3 h-3" /> View on FreWork
                        </Link>
                      )}
                      {isPending && (
                        <p style={{ textAlign: "center", fontSize: "0.68rem", color: "#B45309", background: "rgba(240,102,43,0.08)", border: "1px solid rgba(240,102,43,0.2)", borderRadius: 9, padding: "7px", margin: 0, fontWeight: 600 }}>
                          Reviewing — goes live within 24 hrs
                        </p>
                      )}
                    </div>
                  );
                })}
                <Link href="/dashboard/workspace/submit" style={{ borderRadius: 14, border: "2px dashed rgba(20,26,58,0.08)", padding: "1.25rem", textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", textAlign: "center", minHeight: 140, transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(35,42,99,0.25)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(20,26,58,0.08)"}>
                  <Plus className="w-5 h-5" style={{ color: "rgba(20,26,58,0.62)" }} />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(20,26,58,0.65)" }}>Add Another Space</span>
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="dbx-two">

          {/* Queries */}
          <div className="db-card">
            <div className="db-card-hd">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(35,42,99,0.1)", border: "1px solid rgba(35,42,99,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare className="w-3.5 h-3.5" style={{ color: "#232A63" }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>My Service Queries</span>
              </div>
              <Link href="/contact" style={{ fontSize: "0.74rem", color: "#232A63", textDecoration: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                New query <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div style={{ padding: "2.5rem 1.25rem", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(35,42,99,0.08)", border: "1px solid rgba(35,42,99,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem" }}>
                <FileText className="w-5 h-5" style={{ color: "#232A63", opacity: 0.6 }} />
              </div>
              <p style={{ fontWeight: 600, fontSize: "0.84rem", color: "rgba(20,26,58,1.00)", marginBottom: "0.3rem" }}>No queries yet</p>
              <p style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.65)", marginBottom: "1rem", lineHeight: 1.6 }}>Submit a query and our expert team responds within 2 hours.</p>
              <Link href="/contact" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#232A63,#232A63)", color: "#fff", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
                <Plus className="w-3 h-3" /> Submit a query
              </Link>
            </div>
          </div>

          {/* Startups */}
          <div className="db-card">
            <div className="db-card-hd">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(91,75,196,0.1)", border: "1px solid rgba(91,75,196,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Rocket className="w-3.5 h-3.5" style={{ color: "#5B4BC4" }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>My Startups</span>
                {startups.length > 0 && (
                  <span style={{ fontSize: "0.62rem", padding: "1px 7px", borderRadius: 10, background: "rgba(91,75,196,0.1)", border: "1px solid rgba(91,75,196,0.2)", color: "#5B4BC4", fontWeight: 700 }}>{startups.length}</span>
                )}
              </div>
              <Link href="/dashboard/startup/submit" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.74rem", color: "#5B4BC4", textDecoration: "none", fontWeight: 700 }}>
                <Plus className="w-3 h-3" /> List startup
              </Link>
            </div>
            {startups.length === 0 ? (
              <div style={{ padding: "2.5rem 1.25rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.8rem", color: "rgba(20,26,58,0.65)", marginBottom: "1rem" }}>No startups listed yet</p>
                <Link href="/dashboard/startup/submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, background: "rgba(91,75,196,0.12)", border: "1px solid rgba(91,75,196,0.25)", color: "#5B4BC4", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
                  <Rocket className="w-3 h-3" /> List your startup — Free
                </Link>
              </div>
            ) : (
              <div>
                {startups.map(s => (
                  <div key={s.id} className="db-startup-row">
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(91,75,196,0.1)", border: "1px solid rgba(91,75,196,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.82rem", fontWeight: 800, color: "#5B4BC4", flexShrink: 0 }}>
                      {s.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.82rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                      <p style={{ fontSize: "0.68rem", color: "rgba(20,26,58,0.70)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.tagline}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(s.status)}`}>{s.status}</span>
                      {s.status === "live" && (
                        <Link href={`/startups/${s.slug}`} style={{ color: "rgba(20,26,58,0.65)", textDecoration: "none" }}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
      </div>
    </div>
  );
}

