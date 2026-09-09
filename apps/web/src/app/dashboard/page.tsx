"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const PAID_SERVICES = [
  {
    icon: ReceiptText,   label: "GST Registration & Filing",  sub: "GSTIN in 3–5 days · Monthly GSTR-1 & 3B",  price: "₹999",   href: "/services/gst",                   orderKey: "gst-registration",  color: "#2563EB", grad: "linear-gradient(135deg,#1D4ED8,#2563EB)", bg: "rgba(37,99,235,0.07)",  border: "rgba(37,99,235,0.18)",
  },
  {
    icon: Calculator,    label: "Income Tax Return (ITR)",    sub: "ITR-1 to ITR-6 · Tax planning & refunds",   price: "₹799",   href: "/services/income-tax",            orderKey: "income-tax",        color: "#059669", grad: "linear-gradient(135deg,#047857,#059669)", bg: "rgba(5,150,105,0.07)",  border: "rgba(5,150,105,0.18)",
  },
  {
    icon: BarChart3,     label: "Accounting & Bookkeeping",  sub: "Monthly books · P&L · Balance sheet",        price: "₹1,499", href: "/services/accounting",            orderKey: "accounting",        color: "#D97706", grad: "linear-gradient(135deg,#B45309,#D97706)", bg: "rgba(217,119,6,0.07)",  border: "rgba(217,119,6,0.18)",
  },
  {
    icon: Building2,     label: "Company Registration",      sub: "Pvt Ltd · LLP · OPC · Proprietorship",       price: "₹999",   href: "/services/business-registration", orderKey: "company-reg",       color: "#7C3AED", grad: "linear-gradient(135deg,#6D28D9,#7C3AED)", bg: "rgba(124,58,237,0.07)", border: "rgba(124,58,237,0.18)",
  },
  {
    icon: ClipboardList, label: "GST Audit & Reconciliation",sub: "GSTR-9C · ITC reconciliation · Notices",     price: "₹4,999", href: "/services/audit",                 orderKey: "gst-audit",         color: "#DC2626", grad: "linear-gradient(135deg,#B91C1C,#DC2626)", bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.18)",
  },
  {
    icon: BadgeCheck,    label: "ROC & Compliance",          sub: "Annual filing · MCA · Director KYC",          price: "₹1,999", href: "/services/roc-compliance",        orderKey: "roc-compliance",    color: "#0891B2", grad: "linear-gradient(135deg,#0E7490,#0891B2)", bg: "rgba(8,145,178,0.07)", border: "rgba(8,145,178,0.18)",
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
  { icon: "🏛️", title: "Coworking Submissions", desc: "Review and approve space listings submitted by owners", href: "/dashboard/coworking", color: "#F59E0B", border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.07)", badge: "Approve / Reject" },
  { icon: "📋", title: "Service Orders", desc: "View all paid service orders from customers", href: "/dashboard/orders", color: "#2563EB", border: "rgba(37,99,235,0.25)", bg: "rgba(37,99,235,0.07)", badge: "Manage Orders" },
  { icon: "📂", title: "Service Requests", desc: "Review uploaded docs and grant service packages to users", href: "/dashboard/service-requests", color: "#F59E0B", border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.07)", badge: "Approve Packages" },
  { icon: "👥", title: "Freelancer Profiles", desc: "Review and approve freelancer profile submissions", href: "/dashboard/freelancer", color: "#059669", border: "rgba(5,150,105,0.25)", bg: "rgba(5,150,105,0.07)", badge: "Review Profiles" },
  { icon: "🚀", title: "Startup Listings", desc: "Manage startup profiles and funding listings", href: "/dashboard/startup", color: "#7C3AED", border: "rgba(124,58,237,0.25)", bg: "rgba(124,58,237,0.07)", badge: "View Startups" },
  { icon: "💬", title: "Support Messages", desc: "Customer queries and WhatsApp conversations", href: "https://wa.me/918590874681", color: "#25D366", border: "rgba(37,211,102,0.25)", bg: "rgba(37,211,102,0.07)", badge: "Open WhatsApp", external: true },
  { icon: "🌐", title: "Live Website", desc: "View the public-facing FreWork website", href: "/", color: "#0891B2", border: "rgba(8,145,178,0.25)", bg: "rgba(8,145,178,0.07)", badge: "Open Site" },
];

const FINANCE_CARDS: AdminCard[] = [
  { icon: "🛩️", title: "Finance Dashboard", desc: "Overview — P&L snapshot, pending tasks, quick actions", href: "/finance", color: "#3B82F6", border: "rgba(59,130,246,0.25)", bg: "rgba(59,130,246,0.07)", badge: "Dashboard" },
  { icon: "🔑", title: "FrePilot Admin", desc: "Grant trials, activate or revoke FrePilot subscriptions", href: "/finance/admin", color: "#818CF8", border: "rgba(129,140,248,0.25)", bg: "rgba(129,140,248,0.07)", badge: "Manage Subs" },
  { icon: "🧾", title: "Sales Invoices", desc: "Create and manage sales invoices for clients", href: "/finance/sales/new", color: "#3B82F6", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.06)", badge: "New Invoice" },
  { icon: "📦", title: "Purchase Bills", desc: "Record vendor bills and purchase entries", href: "/finance/purchases/new", color: "#60A5FA", border: "rgba(96,165,250,0.2)", bg: "rgba(96,165,250,0.06)", badge: "New Bill" },
  { icon: "💸", title: "Expenses", desc: "Record and categorise business expenses", href: "/finance/expenses", color: "#818CF8", border: "rgba(129,140,248,0.2)", bg: "rgba(129,140,248,0.06)", badge: "Record" },
  { icon: "💳", title: "Payment Entry", desc: "Record receipts and payments against invoices", href: "/finance/payment", color: "#38BDF8", border: "rgba(56,189,248,0.2)", bg: "rgba(56,189,248,0.06)", badge: "Pay / Receive" },
  { icon: "📤", title: "Upload Documents", desc: "Upload invoices & bank statements for AI extraction", href: "/finance/upload", color: "#3B82F6", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.06)", badge: "Upload" },
  { icon: "🤖", title: "AI Review Queue", desc: "Review and approve AI-extracted journal entries", href: "/finance/ai-review", color: "#818CF8", border: "rgba(129,140,248,0.2)", bg: "rgba(129,140,248,0.06)", badge: "Review AI" },
  { icon: "📒", title: "Journal Entries", desc: "Double-entry ledger — Dr = Cr enforced", href: "/finance/journals", color: "#60A5FA", border: "rgba(96,165,250,0.2)", bg: "rgba(96,165,250,0.06)", badge: "Journals" },
  { icon: "📒", title: "Account Ledger", desc: "Account-wise ledger with opening & closing balances", href: "/finance/ledger", color: "#38BDF8", border: "rgba(56,189,248,0.2)", bg: "rgba(56,189,248,0.06)", badge: "Ledger" },
  { icon: "📥", title: "Receivables (AR)", desc: "Who owes you money — customer aging report", href: "/finance/receivables", color: "#3B82F6", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.06)", badge: "AR" },
  { icon: "📤", title: "Payables (AP)", desc: "Who you owe — vendor aging report", href: "/finance/payables", color: "#818CF8", border: "rgba(129,140,248,0.2)", bg: "rgba(129,140,248,0.06)", badge: "AP" },
  { icon: "📈", title: "Financial Reports", desc: "P&L, Balance Sheet, Cash Flow for the business", href: "/finance/reports", color: "#60A5FA", border: "rgba(96,165,250,0.2)", bg: "rgba(96,165,250,0.06)", badge: "Reports" },
  { icon: "🏛️", title: "GST Returns", desc: "GSTR-1, GSTR-3B — auto-prepared from books", href: "/finance/gst", color: "#38BDF8", border: "rgba(56,189,248,0.2)", bg: "rgba(56,189,248,0.06)", badge: "GST" },
  { icon: "🔖", title: "TDS Tracker", desc: "Section-wise TDS deductions, due dates & challan", href: "/finance/tds", color: "#3B82F6", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.06)", badge: "TDS" },
  { icon: "🏦", title: "Bank Reconciliation", desc: "Import CSV, auto-match bank transactions", href: "/finance/banking", color: "#818CF8", border: "rgba(129,140,248,0.2)", bg: "rgba(129,140,248,0.06)", badge: "BRS" },
  { icon: "🔄", title: "Tally Export", desc: "Export books as Tally-compatible XML", href: "/finance/tally", color: "#60A5FA", border: "rgba(96,165,250,0.2)", bg: "rgba(96,165,250,0.06)", badge: "Export" },
  { icon: "📊", title: "Chart of Accounts", desc: "Indian account heads — Assets, Liabilities, Income, Expense", href: "/finance/chart-of-accounts", color: "#38BDF8", border: "rgba(56,189,248,0.2)", bg: "rgba(56,189,248,0.06)", badge: "COA" },
  { icon: "👤", title: "Contacts", desc: "Manage customers and vendors with opening balances", href: "/finance/contacts", color: "#3B82F6", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.06)", badge: "Contacts" },
  { icon: "📅", title: "Financial Years", desc: "Create and manage financial years per business", href: "/finance/fy", color: "#818CF8", border: "rgba(129,140,248,0.2)", bg: "rgba(129,140,248,0.06)", badge: "FY" },
  { icon: "🫂", title: "Team & Access", desc: "Add team members and set access permissions", href: "/finance/team", color: "#60A5FA", border: "rgba(96,165,250,0.2)", bg: "rgba(96,165,250,0.06)", badge: "Team" },
  { icon: "⚙️", title: "Business Setup", desc: "Configure GSTIN, bank accounts and business details", href: "/finance/setup", color: "#38BDF8", border: "rgba(56,189,248,0.2)", bg: "rgba(56,189,248,0.06)", badge: "Setup" },
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
            <h3 className="font-black text-sm mb-1" style={{ color: "#EDE8DC" }}>{item.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#8A9BB8" }}>{item.desc}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold mt-auto" style={{ color: item.color }}>Open <ArrowRight className="w-3.5 h-3.5" /></div>
        </Link>
      ))}
    </>
  );
}

function TrialGrantWidget() {
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState("professional");
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
      setMsg(data.ok ? `✓ Done${data.ends_at ? " — expires " + new Date(data.ends_at).toLocaleDateString("en-IN") : ""}` : data.error ?? "Error");
      if (data.ok) setUserId("");
    } catch { setMsg("Network error"); }
    setWorking(false);
  }

  const inp: React.CSSProperties = { background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: "#EDE8DC", padding: "8px 12px", borderRadius: 8, fontSize: "0.83rem", outline: "none", width: "100%" };

  return (
    <div className="rounded-2xl mb-8 p-6" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🛩️</span>
        <p className="font-black text-sm" style={{ color: "#60A5FA" }}>Grant FrePilot Access</p>
        <Link href="/finance/admin" className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(129,140,248,0.12)", color: "#818CF8", border: "1px solid rgba(129,140,248,0.2)" }}>
          Full Admin →
        </Link>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>User ID or Email</label>
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="uuid or email from Supabase" style={inp} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inp, width: "auto", cursor: "pointer" }}>
            {["starter","professional","growth","business","enterprise"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Trial Days</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ ...inp, width: "auto", cursor: "pointer" }}>
            {[1,3,7,14,30].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>
        <button onClick={() => grant("trial")} disabled={working}
          className="px-5 py-2 rounded-xl font-black text-sm transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", color: "#fff", opacity: working ? 0.6 : 1 }}>
          Grant Trial
        </button>
        <button onClick={() => grant("active")} disabled={working}
          className="px-5 py-2 rounded-xl font-black text-sm transition-all hover:opacity-90"
          style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", opacity: working ? 0.6 : 1 }}>
          Activate
        </button>
      </div>
      {msg && <p className="mt-3 text-xs font-semibold" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{msg}</p>}
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#070C1A" }}>
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-12">
          <FreWorkLogo size={36} />
          <div>
            <p className="font-black text-base" style={{ color: "#EDE8DC" }}>FreWork</p>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: "#4A5A72" }}>Business OS</p>
          </div>
        </div>

        <div className="max-w-lg w-full">
          <h1 className="text-2xl font-black text-center mb-2" style={{ color: "#EDE8DC" }}>
            Welcome, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-center mb-10" style={{ color: "#8A9BB8" }}>
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
              style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.1),rgba(201,168,76,0.04))", borderColor: "rgba(201,168,76,0.25)" }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", boxShadow: "0 4px 20px rgba(201,168,76,0.4)" }}>
                🏛️
              </div>
              <div>
                <p className="font-black text-base mb-1" style={{ color: "#E8C97A" }}>
                  {hasCoworkingListing ? "Manage My Space" : "List My Coworking Space"}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#8A9BB8" }}>
                  {hasCoworkingListing
                    ? "View enquiries, edit details, track your listing status"
                    : "List your space free · Zero commission · Leads straight to your WhatsApp"}
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-lg mt-auto"
                style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }}>
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
              style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.1),rgba(37,99,235,0.04))", borderColor: "rgba(37,99,235,0.2)" }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}>
                📋
              </div>
              <div>
                <p className="font-black text-base mb-1" style={{ color: "#93C5FD" }}>
                  GST / ITR / Accounting
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#8A9BB8" }}>
                  Select a service, upload your documents — our CA handles everything within 24 hours
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-lg mt-auto"
                style={{ background: "rgba(37,99,235,0.12)", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.2)" }}>
                Upload Documents →
              </span>
            </button>
          </div>

          <button onClick={handleSignOut} className="mt-10 text-xs text-center w-full transition-colors hover:opacity-80" style={{ color: "#4A5A72" }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
        {/* Admin header */}
        <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FreWorkLogo size={32} />
              <div>
                <p className="text-xs font-black" style={{ color: "#EDE8DC" }}>FreWork Admin</p>
                <p className="text-[10px]" style={{ color: "#4A5A72" }}>{user?.email}</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
              style={{ borderColor: "rgba(248,113,113,0.25)", color: "#F87171", background: "rgba(248,113,113,0.06)" }}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-black mb-1" style={{ color: "#EDE8DC" }}>Admin Panel</h1>
          <p className="text-sm mb-8" style={{ color: "#8A9BB8" }}>Manage FreWork — approve spaces, review orders, monitor platform.</p>

          {/* Quick Trial Grant */}
          <TrialGrantWidget />


          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="col-span-full mb-1">
              <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(245,158,11,0.6)" }}>Platform Management</p>
              <div className="h-px" style={{ background: "rgba(245,158,11,0.15)" }} />
            </div>
            <AdminCardGrid cards={PLATFORM_CARDS} />
            <div className="col-span-full mt-6 mb-1">
              <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(59,130,246,0.6)" }}>FrePilot Finance</p>
              <div className="h-px" style={{ background: "rgba(59,130,246,0.15)" }} />
            </div>
            <AdminCardGrid cards={FINANCE_CARDS} />
          </div>
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusColor = (s: string) =>
    s === "live" ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/60" :
    s === "pending" ? "text-amber-400 bg-amber-950/40 border-amber-800/60" :
    "text-slate-400 bg-slate-900/40 border-slate-700/60";

  return (
    <div style={{ minHeight: "100vh", background: "#050914", color: "#E8EDF5", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .db-bg { background-image: radial-gradient(circle, rgba(99,130,246,0.035) 1px, transparent 1px); background-size: 30px 30px; }
        .db-nav-link { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 0.84rem; font-weight: 600; color: rgba(232,237,245,0.45); text-decoration: none; transition: all 0.15s; }
        .db-nav-link:hover { color: #E8EDF5; background: rgba(255,255,255,0.06); }
        .db-stat { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 1.1rem 1.25rem; transition: border-color 0.2s; }
        .db-stat:hover { border-color: rgba(255,255,255,0.13); }
        .db-card { background: rgba(255,255,255,0.022); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
        .db-card-hd { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .db-startup-row { display: flex; align-items: center; gap: 0.9rem; padding: 0.75rem 1.25rem; border-top: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .db-startup-row:hover { background: rgba(255,255,255,0.025); }
        .db-ql { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.85rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.07); text-decoration: none; font-size: 0.72rem; font-weight: 700; text-align: center; transition: all 0.15s; background: rgba(255,255,255,0.02); }
        .db-ql:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }
        .db-space-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        select option { background: #0B1221; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,9,20,0.92)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 40, padding: "0 1.5rem", height: 60, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <FreWorkLogo size={30} />
            <span style={{ fontWeight: 900, fontSize: "1.05rem", color: "#E8EDF5", letterSpacing: "-0.02em" }}>FreWork</span>
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
              <img src={user.avatar} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(37,99,235,0.2)", border: "1.5px solid rgba(37,99,235,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#60A5FA" }}>{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "rgba(232,237,245,0.7)" }} className="hidden sm:block">{user?.name}</span>
            <button onClick={handleSignOut} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.06)", color: "#F87171", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="db-bg" style={{ minHeight: "calc(100vh - 60px)" }}>
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>

          {/* Welcome banner */}
          <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: "1.75rem", background: "linear-gradient(135deg,#0B1A3E 0%,#0F2252 50%,#0B1A3E 100%)", border: "1px solid rgba(59,130,246,0.2)", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 50%, rgba(37,99,235,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
            <div style={{ padding: "1.75rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
              <div>
                <p style={{ fontSize: "0.8rem", color: "rgba(147,197,253,0.7)", marginBottom: "0.3rem", fontWeight: 500 }}>{greeting},</p>
                <h1 style={{ margin: "0 0 0.3rem", fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#ffffff" }}>{firstName} <span style={{ opacity: 0.8 }}>👋</span></h1>
                <p style={{ fontSize: "0.8rem", color: "rgba(147,197,253,0.5)", margin: 0 }}>{user?.email}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", padding: "5px 14px", borderRadius: 20, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399", fontWeight: 700 }}>
                  ● Active account
                </span>
                <span style={{ fontSize: "0.72rem", padding: "5px 14px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "capitalize" }}>
                  {subscription ? `${subscription.plan} Plan` : "Free Plan"}
                </span>
              </div>
            </div>
          </div>

          {/* Finance banner */}
          <Link href="/finance" style={{ display: "block", marginBottom: "1.75rem", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(201,168,76,0.25)", background: "linear-gradient(135deg,#0E1A0A 0%,#1A2E0E 50%,#0B1A0E 100%)", textDecoration: "none", transition: "border-color 0.2s, transform 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.5)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.25)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
            <div style={{ padding: "1.25rem 1.6rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg,rgba(201,168,76,0.25),rgba(201,168,76,0.08))", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>🛩️</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 10, background: "rgba(201,168,76,0.2)", border: "1px solid rgba(201,168,76,0.35)", color: "#C9A84C", fontWeight: 800, letterSpacing: "0.06em" }}>NEW</span>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#E8C97A" }}>FrePilot Finance — AI Bookkeeping</span>
                </div>
                <p style={{ fontSize: "0.76rem", color: "rgba(232,237,245,0.45)", margin: 0, lineHeight: 1.6 }}>
                  Upload invoices, bills &amp; bank statements · AI posts journal entries · GST returns, P&amp;L, Balance Sheet
                </p>
              </div>
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", fontWeight: 800, fontSize: "0.84rem" }}>
                Open Finance <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* ── SPACE OWNER SECTION ── */}
        {(userRole === "space_owner" || mySpaces.length > 0) && (
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 className="w-4 h-4" style={{ color: "#60A5FA" }} /> My Listed Spaces
                </h2>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.74rem", color: "rgba(232,237,245,0.35)" }}>Manage your coworking spaces · Approved listings go live publicly</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Link href="/dashboard/coworking" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", background: "rgba(201,168,76,0.07)", fontSize: "0.76rem", fontWeight: 700, textDecoration: "none" }}>
                  <CheckCircle className="w-3.5 h-3.5" /> Review Submissions
                </Link>
                <Link href="/dashboard/workspace/submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg,#1246C8,#2563EB)", color: "#fff", fontSize: "0.76rem", fontWeight: 700, textDecoration: "none" }}>
                  <Plus className="w-3.5 h-3.5" /> Add New Space
                </Link>
              </div>
            </div>

            {mySpaces.length === 0 ? (
              <div style={{ borderRadius: 16, border: "2px dashed rgba(96,165,250,0.2)", padding: "2.5rem", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem" }}>
                  <Building2 className="w-5 h-5" style={{ color: "#60A5FA", opacity: 0.7 }} />
                </div>
                <p style={{ fontWeight: 600, fontSize: "0.84rem", color: "rgba(232,237,245,0.6)", marginBottom: "0.3rem" }}>No spaces listed yet</p>
                <p style={{ fontSize: "0.74rem", color: "rgba(232,237,245,0.3)", marginBottom: "1.25rem", maxWidth: 340, margin: "0 auto 1.25rem", lineHeight: 1.7 }}>
                  Add your coworking space or office for free. Once approved it appears publicly on frework.online/coworking.
                </p>
                <Link href="/dashboard/workspace/submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, background: "linear-gradient(135deg,#1246C8,#2563EB)", color: "#fff", fontSize: "0.8rem", fontWeight: 700, textDecoration: "none" }}>
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
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Building2 className="w-4 h-4" style={{ color: "#60A5FA" }} />
                        </div>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: isApproved ? "rgba(52,211,153,0.1)" : isPending ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${isApproved ? "rgba(52,211,153,0.25)" : isPending ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.1)"}`, color: isApproved ? "#34D399" : isPending ? "#F59E0B" : "rgba(232,237,245,0.4)", flexShrink: 0 }}>
                          {isApproved ? "● Live" : isPending ? "⏳ Reviewing" : space.status}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.84rem", margin: "0 0 0.2rem" }}>{space.name}</p>
                        <p style={{ fontSize: "0.7rem", color: "rgba(232,237,245,0.35)", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin className="w-3 h-3" />{space.city} · {space.type}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.72rem" }}>
                        {space.price_per_day && <span style={{ fontWeight: 700, color: "rgba(232,237,245,0.7)" }}>₹{space.price_per_day.toLocaleString("en-IN")}/day</span>}
                        {space.price_per_month && <span style={{ fontWeight: 700, color: "rgba(232,237,245,0.7)" }}>₹{space.price_per_month.toLocaleString("en-IN")}/mo</span>}
                        <span style={{ marginLeft: "auto", color: "rgba(232,237,245,0.25)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock className="w-3 h-3" />
                          {new Date(space.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
                        </span>
                      </div>
                      {isApproved && (
                        <Link href="/coworking" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", borderRadius: 9, border: "1px solid rgba(96,165,250,0.2)", color: "#60A5FA", fontSize: "0.72rem", fontWeight: 700, textDecoration: "none" }}>
                          <ExternalLink className="w-3 h-3" /> View on FreWork
                        </Link>
                      )}
                      {isPending && (
                        <p style={{ textAlign: "center", fontSize: "0.68rem", color: "#F59E0B", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 9, padding: "7px", margin: 0, fontWeight: 600 }}>
                          Reviewing — goes live within 24 hrs
                        </p>
                      )}
                    </div>
                  );
                })}
                <Link href="/dashboard/workspace/submit" style={{ borderRadius: 14, border: "2px dashed rgba(255,255,255,0.08)", padding: "1.25rem", textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", textAlign: "center", minHeight: 140, transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(96,165,250,0.25)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"}>
                  <Plus className="w-5 h-5" style={{ color: "rgba(232,237,245,0.2)" }} />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(232,237,245,0.3)" }}>Add Another Space</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginBottom: "1.75rem" }}>
          {[
            { icon: "💬", label: "Active Queries",    value: "0",                      accent: "#60A5FA" },
            { icon: "📅", label: "Upcoming Meetings", value: "0",                      accent: "#F59E0B" },
            { icon: "✅", label: "Pending Tasks",     value: "0",                      accent: "#F87171" },
            { icon: "🚀", label: "My Startups",       value: String(startups.length),  accent: "#A78BFA" },
          ].map(s => (
            <div key={s.label} className="db-stat">
              <div style={{ fontSize: "1.2rem", marginBottom: "0.6rem" }}>{s.icon}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: s.accent, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: "0.35rem" }}>{s.value}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(232,237,245,0.35)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: "1rem", alignItems: "start" }}>

          {/* Queries */}
          <div className="db-card">
            <div className="db-card-hd">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare className="w-3.5 h-3.5" style={{ color: "#60A5FA" }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>My Service Queries</span>
              </div>
              <Link href="/contact" style={{ fontSize: "0.74rem", color: "#60A5FA", textDecoration: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                New query <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div style={{ padding: "2.5rem 1.25rem", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem" }}>
                <FileText className="w-5 h-5" style={{ color: "#60A5FA", opacity: 0.6 }} />
              </div>
              <p style={{ fontWeight: 600, fontSize: "0.84rem", color: "rgba(232,237,245,0.7)", marginBottom: "0.3rem" }}>No queries yet</p>
              <p style={{ fontSize: "0.72rem", color: "rgba(232,237,245,0.3)", marginBottom: "1rem", lineHeight: 1.6 }}>Submit a query and our expert team responds within 2 hours.</p>
              <Link href="/contact" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#1246C8,#2563EB)", color: "#fff", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
                <Plus className="w-3 h-3" /> Submit a query
              </Link>
            </div>
          </div>

          {/* Startups */}
          <div className="db-card">
            <div className="db-card-hd">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Rocket className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>My Startups</span>
                {startups.length > 0 && (
                  <span style={{ fontSize: "0.62rem", padding: "1px 7px", borderRadius: 10, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#A78BFA", fontWeight: 700 }}>{startups.length}</span>
                )}
              </div>
              <Link href="/dashboard/startup/submit" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.74rem", color: "#A78BFA", textDecoration: "none", fontWeight: 700 }}>
                <Plus className="w-3 h-3" /> List startup
              </Link>
            </div>
            {startups.length === 0 ? (
              <div style={{ padding: "2.5rem 1.25rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.8rem", color: "rgba(232,237,245,0.3)", marginBottom: "1rem" }}>No startups listed yet</p>
                <Link href="/dashboard/startup/submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#A78BFA", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
                  <Rocket className="w-3 h-3" /> List your startup — Free
                </Link>
              </div>
            ) : (
              <div>
                {startups.map(s => (
                  <div key={s.id} className="db-startup-row">
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.82rem", fontWeight: 800, color: "#A78BFA", flexShrink: 0 }}>
                      {s.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.82rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                      <p style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.35)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.tagline}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(s.status)}`}>{s.status}</span>
                      {s.status === "live" && (
                        <Link href={`/startups/${s.slug}`} style={{ color: "rgba(232,237,245,0.3)", textDecoration: "none" }}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

            {/* Plan */}
            <div className="db-card">
              <div className="db-card-hd">
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <Crown className="w-4 h-4" style={{ color: "#F59E0B" }} />
                  <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>Your Plan</span>
                </div>
              </div>
              <div style={{ padding: "1rem 1.25rem" }}>
                {subscription ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                      <span style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 12, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#60A5FA", fontWeight: 700, textTransform: "capitalize" }}>{subscription.plan} Plan</span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.7rem", color: "#34D399", fontWeight: 600 }}>Active</span>
                    </div>
                    <p style={{ fontSize: "0.68rem", color: "rgba(232,237,245,0.3)", marginBottom: "0.9rem", textTransform: "capitalize" }}>
                      {subscription.billing} billing · since {new Date(subscription.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <Link href="/pricing" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, border: "1px solid rgba(96,165,250,0.2)", color: "#60A5FA", fontSize: "0.76rem", fontWeight: 700, textDecoration: "none" }}>
                      Manage Plan <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(232,237,245,0.5)", fontWeight: 600 }}>Free Plan</span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.7rem", color: "#34D399", fontWeight: 600 }}>Active</span>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.9rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {["Browse freelancers & spaces free", "1 active service query", "Email support", "1 startup listing"].map(f => (
                        <li key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", color: "rgba(232,237,245,0.5)" }}>
                          <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/pricing" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#1246C8,#2563EB)", color: "#fff", fontSize: "0.76rem", fontWeight: 700, textDecoration: "none" }}>
                      Upgrade Plan <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="db-card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "rgba(232,237,245,0.25)" }} />
                <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>Explore FreWork</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  { icon: "👥", label: "Freelancers", href: "/freelancers", color: "#34D399" },
                  { icon: "🏛️", label: "Coworking",   href: "/coworking",   color: "#60A5FA" },
                  { icon: "🚀", label: "Startups",    href: "/startups",    color: "#A78BFA" },
                  { icon: "📞", label: "Contact CA",  href: "/contact",     color: "#FB923C" },
                  { icon: "📈", label: "Finance",     href: "/finance",     color: "#F59E0B" },
                ].map(q => (
                  <Link key={q.label} href={q.href} className="db-ql" style={{ color: q.color }}>
                    <span style={{ fontSize: "1.15rem" }}>{q.icon}</span>
                    {q.label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

