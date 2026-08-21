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
      // Show purpose selector only for non-admin users who haven't chosen yet
      const adminEmails = ["admin.frework@gmail.com", "admin.frework@gmail.com"];
      if (!adminEmails.includes(u.email ?? "")) {
        const chosen = localStorage.getItem(`fw_purpose_${u.id}`);
        if (!chosen) {
          setShowPurpose(true);
        } else {
          // Already chose — redirect immediately
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

  const ADMIN_EMAILS = ["admin.frework@gmail.com", "admin.frework@gmail.com"];
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


          {(() => {
            type Card = { icon: string; title: string; desc: string; href: string; color: string; border: string; bg: string; badge: string; external?: boolean };
            const platformCards: Card[] = [
              { icon: "🏛️", title: "Coworking Submissions", desc: "Review and approve space listings submitted by owners", href: "/dashboard/coworking", color: "#F59E0B", border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.07)", badge: "Approve / Reject" },
              { icon: "📋", title: "Service Orders", desc: "View all paid service orders from customers", href: "/dashboard/orders", color: "#2563EB", border: "rgba(37,99,235,0.25)", bg: "rgba(37,99,235,0.07)", badge: "Manage Orders" },
              { icon: "📂", title: "Service Requests", desc: "Review uploaded docs and grant service packages to users", href: "/dashboard/service-requests", color: "#F59E0B", border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.07)", badge: "Approve Packages" },
              { icon: "👥", title: "Freelancer Profiles", desc: "Review and approve freelancer profile submissions", href: "/dashboard/freelancer", color: "#059669", border: "rgba(5,150,105,0.25)", bg: "rgba(5,150,105,0.07)", badge: "Review Profiles" },
              { icon: "🚀", title: "Startup Listings", desc: "Manage startup profiles and funding listings", href: "/dashboard/startup", color: "#7C3AED", border: "rgba(124,58,237,0.25)", bg: "rgba(124,58,237,0.07)", badge: "View Startups" },
              { icon: "💬", title: "Support Messages", desc: "Customer queries and WhatsApp conversations", href: "https://wa.me/918590874681", color: "#25D366", border: "rgba(37,211,102,0.25)", bg: "rgba(37,211,102,0.07)", badge: "Open WhatsApp", external: true },
              { icon: "🌐", title: "Live Website", desc: "View the public-facing FreWork website", href: "/", color: "#0891B2", border: "rgba(8,145,178,0.25)", bg: "rgba(8,145,178,0.07)", badge: "Open Site" },
            ];
            const financeCards: Card[] = [
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
            const renderCards = (list: Card[]) => list.map(item => (
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
            ));
            return (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="col-span-full mb-1">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(245,158,11,0.6)" }}>Platform Management</p>
                  <div className="h-px" style={{ background: "rgba(245,158,11,0.15)" }} />
                </div>
                {renderCards(platformCards)}
                <div className="col-span-full mt-6 mb-1">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(59,130,246,0.6)" }}>FrePilot Finance</p>
                  <div className="h-px" style={{ background: "rgba(59,130,246,0.15)" }} />
                </div>
                {renderCards(financeCards)}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusColor = (s: string) =>
    s === "live" ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    s === "pending" ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-slate-400 bg-slate-50 border-slate-200";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <FreWorkLogo size={32} />
            <span className="font-black text-slate-900 text-lg tracking-tight">FreWork</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Services", href: "/services", icon: FileText },
              { label: "Freelancers", href: "/freelancers", icon: Users },
              { label: "Coworking", href: "/coworking", icon: Building2 },
              { label: "Startups", href: "/startups", icon: Rocket },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={label} href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                <Icon className="w-3.5 h-3.5" />{label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-slate-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center">
                <span className="text-blue-700 text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm text-slate-600 font-medium hidden sm:block">{user?.name}</span>
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Welcome banner */}
        <div className="rounded-2xl overflow-hidden mb-8 border border-slate-200 shadow-sm"
          style={{ background: "linear-gradient(135deg,#0F2044 0%,#1E3A8A 100%)" }}>
          <div className="px-8 py-7 flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm mb-1">{greeting},</p>
              <h1 className="text-3xl font-black text-white mb-1 tracking-tight">{firstName} 👋</h1>
              <p className="text-blue-300 text-sm">{user?.email}</p>
            </div>
            <div className="hidden md:flex flex-col items-end gap-2">
              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-medium">
                ● Active account
              </span>
              <span className="text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/60 capitalize font-medium">
                {subscription ? `${subscription.plan} Plan` : "Free Plan"}
              </span>
            </div>
          </div>
        </div>

        {/* ── FINANCE BANNER ── */}
        <Link href="/finance" className="block mb-6 rounded-2xl overflow-hidden border transition-all hover:shadow-lg hover:scale-[1.01]"
          style={{ borderColor: "rgba(201,168,76,0.3)", background: "linear-gradient(135deg,rgba(201,168,76,0.12) 0%,rgba(7,12,26,0.8) 100%)", backdropFilter: "blur(8px)" }}>
          <div className="px-6 py-5 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", boxShadow: "0 4px 20px rgba(201,168,76,0.35)" }}>
              📊
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>NEW</span>
                <span className="font-black text-base" style={{ color: "#EDE8DC" }}>FreWork Finance — AI Bookkeeping</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#8A9BB8" }}>
                Upload invoices, bills, and bank statements · AI extracts and posts journal entries · GST returns, P&amp;L, Balance Sheet, FrePilot
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-sm"
              style={{ background: "linear-gradient(135deg,#C9A84C,#A07C2E)", color: "#070C1A" }}>
              Open Finance <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        {/* ── professional SERVICES ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Get Professional Services</h2>
              <p className="text-sm text-slate-500 mt-0.5">Expert-assisted · Paid · Delivered in days, not weeks</p>
            </div>
            <Link href="/services" className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1">
              All services <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAID_SERVICES.map(({ icon: Icon, label, sub, price, href, orderKey, color, grad, bg, border }) => (
              <div key={label}
                className="group flex flex-col rounded-2xl bg-white border hover:shadow-lg transition-all duration-200 overflow-hidden"
                style={{ borderColor: border }}>

                {/* Top coloured strip */}
                <div className="h-1.5 w-full" style={{ background: grad }} />

                {/* Card body */}
                <div className="flex flex-col flex-1 p-5 gap-3">
                  {/* Icon + title row */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: bg, border: `1.5px solid ${border}` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-snug">{label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{sub}</p>
                    </div>
                  </div>

                  {/* Price row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-xl font-black" style={{ color }}>{price}</span>
                      <span className="text-[10px] text-slate-400 ml-1">onwards</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                      style={{ color, background: bg, borderColor: border }}>
                      Expert Professional
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 mt-auto pt-1">
                    <Link href={`/order?service=${orderKey}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-90 hover:scale-[1.02] active:scale-100 transition-all"
                      style={{ background: grad }}>
                      Pay Now
                    </Link>
                    <Link href={href}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold border hover:bg-slate-50 transition-colors flex items-center gap-1"
                      style={{ color, borderColor: border }}>
                      Details <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Free browsing links */}
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { label: "Browse Freelancers — Free", href: "/freelancers", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
              { label: "Find Coworking Spaces — Free", href: "/coworking", color: "#0891B2", bg: "#f0f9ff", border: "#bae6fd" },
              { label: "Explore Startups — Free", href: "/startups", color: "#7C3AED", bg: "#faf5ff", border: "#e9d5ff" },
            ].map(({ label, href, color, bg, border }) => (
              <Link key={label} href={href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm"
                style={{ color, background: bg, borderColor: border }}>
                {label} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── SPACE OWNER SECTION ── */}
        {(userRole === "space_owner" || mySpaces.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" /> My Listed Spaces
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Manage your coworking spaces · Approved listings go live publicly</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/coworking"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 border"
                  style={{ borderColor:"rgba(201,168,76,0.35)", color:"#92742A", background:"rgba(201,168,76,0.08)" }}>
                  <CheckCircle className="w-4 h-4" /> Review Submissions
                </Link>
                <Link href="/dashboard/workspace/submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                  <Plus className="w-4 h-4" /> Add New Space
                </Link>
              </div>
            </div>

            {mySpaces.length === 0 ? (
              /* Empty state */
              <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">No spaces listed yet</h3>
                <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">
                  Add your coworking space or office for free. Once approved it appears publicly on frework.online/coworking for thousands of professionals to discover.
                </p>
                <Link href="/dashboard/workspace/submit"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                  <Plus className="w-4 h-4" /> List Your First Space — Free
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mySpaces.map(space => {
                  const isApproved = space.status === "approved";
                  const isPending  = space.status === "pending";
                  return (
                    <div key={space.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col gap-3">
                      {/* Name + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                          isApproved ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                          isPending  ? "text-amber-700 bg-amber-50 border-amber-200" :
                          "text-slate-400 bg-slate-50 border-slate-200"
                        }`}>
                          {isApproved ? "● Live" : isPending ? "⏳ Under Review" : space.status}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-snug">{space.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{space.city} · {space.type}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {space.price_per_day && (
                          <span className="font-semibold text-slate-700">₹{space.price_per_day.toLocaleString("en-IN")}/day</span>
                        )}
                        {space.price_per_month && (
                          <span className="font-semibold text-slate-700">₹{space.price_per_month.toLocaleString("en-IN")}/mo</span>
                        )}
                        <span className="flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3" />
                          {new Date(space.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
                        </span>
                      </div>

                      {isApproved && (
                        <Link href="/coworking"
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                          <ExternalLink className="w-3 h-3" /> View on FreWork
                        </Link>
                      )}
                      {isPending && (
                        <p className="text-center text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl py-2 font-medium">
                          Reviewing — goes live within 24 hrs
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Add another card */}
                <Link href="/dashboard/workspace/submit"
                  className="rounded-2xl border-2 border-dashed border-slate-200 p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">Add Another Space</p>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── STATS + CONTENT ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MessageSquare, label: "Active Queries",    value: "0", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
            { icon: CalendarClock, label: "Upcoming Meetings", value: "0", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
            { icon: CheckSquare,   label: "Pending Tasks",     value: "0", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
            { icon: Rocket,        label: "My Startups",       value: String(startups.length), color: "#7C3AED", bg: "#FAF5FF", border: "#E9D5FF" },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} className="rounded-2xl bg-white border p-5 hover:shadow-sm transition-all"
              style={{ borderColor: border }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <div className="text-2xl font-black text-slate-900 mb-0.5">{value}</div>
              <div className="text-xs text-slate-500 font-medium">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left — main content */}
          <div className="lg:col-span-2 space-y-5">

            {/* My Queries */}
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">My Service Queries</h2>
                </div>
                <Link href="/contact" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
                  New query <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600 mb-1">No queries yet</p>
                <p className="text-xs text-slate-400 mb-4 max-w-[220px] mx-auto">Submit a query and our expert team will respond within 2 hours.</p>
                <Link href="/contact"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>
                  <Plus className="w-3.5 h-3.5" /> Submit a query
                </Link>
              </div>
            </div>

            {/* Tasks + Meetings */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
                    <CheckSquare className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">Pending Tasks</h2>
                </div>
                <div className="px-5 py-8 text-center">
                  <p className="text-xs text-slate-400">Tasks from your expert team appear here once a service starts.</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <CalendarClock className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">Meetings</h2>
                </div>
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-slate-400 mb-3">Book a free 30-min call with our expert professional.</p>
                  <Link href="/contact"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                    Schedule a call <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* My Startups */}
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                    <Rocket className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">My Startups</h2>
                  {startups.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">{startups.length}</span>
                  )}
                </div>
                <Link href="/dashboard/startup/submit"
                  className="flex items-center gap-1.5 text-xs text-purple-600 font-semibold hover:underline">
                  <Plus className="w-3.5 h-3.5" /> List startup
                </Link>
              </div>
              {startups.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-slate-400 mb-3">No startups listed yet</p>
                  <Link href="/dashboard/startup/submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors">
                    <Rocket className="w-3.5 h-3.5" /> List your startup — Free
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {startups.map(s => (
                    <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-sm font-black text-purple-600 flex-shrink-0">
                        {s.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                        <p className="text-xs text-slate-500 truncate">{s.tagline}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(s.status)}`}>{s.status}</span>
                        {s.status === "live" && (
                          <Link href={`/startups/${s.slug}`} className="text-slate-400 hover:text-slate-700 transition-colors">
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

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* Plan card */}
            <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <h2 className="font-bold text-slate-900 text-sm">Your Plan</h2>
              </div>
              <div className="px-5 py-5">
                {subscription ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold capitalize">
                        {subscription.plan} Plan
                      </span>
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-xs text-emerald-600 font-medium">Active</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-4 capitalize">
                      Billing: {subscription.billing} · Since {new Date(subscription.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <Link href="/pricing"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                      Manage Plan <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-medium">Free Plan</span>
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-xs text-emerald-600 font-medium">Active</span>
                    </div>
                    <ul className="space-y-2 mb-5">
                      {["Browse freelancers & spaces free", "1 active service query", "Email support", "1 startup listing"].map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 12 10" fill="none">
                            <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/pricing"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-white transition-opacity hover:opacity-90"
                      style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>
                      Upgrade Plan <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Popular services */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Popular Services</h3>
              </div>
              <div className="space-y-2">
                {PAID_SERVICES.slice(0, 5).map(s => (
                  <Link key={s.label} href={s.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group">
                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 truncate">{s.label}</span>
                    <span className="text-[11px] font-black ml-2 flex-shrink-0" style={{ color: s.color }}>{s.price}</span>
                  </Link>
                ))}
                <Link href="/services"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-blue-200 text-blue-600 text-xs font-bold hover:bg-blue-50 transition-colors mt-1">
                  View all services <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Quick Links</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Users,     label: "Freelancers",  href: "/freelancers",  color: "text-emerald-600", bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-100" },
                  { icon: Building2, label: "Coworking",    href: "/coworking",    color: "text-cyan-600",    bg: "bg-cyan-50 hover:bg-cyan-100 border-cyan-100" },
                  { icon: Rocket,    label: "Startups",     href: "/startups",     color: "text-purple-600",  bg: "bg-purple-50 hover:bg-purple-100 border-purple-100" },
                  { icon: AlertCircle, label: "Contact CA", href: "/contact",      color: "text-blue-600",    bg: "bg-blue-50 hover:bg-blue-100 border-blue-100" },
                  { icon: BarChart3, label: "Finance",      href: "/finance",      color: "text-amber-600",   bg: "bg-amber-50 hover:bg-amber-100 border-amber-100" },
                ].map(({ icon: Icon, label, href, color, bg }) => (
                  <Link key={label} href={href}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${bg} transition-all text-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-xs font-semibold ${color} leading-tight`}>{label}</span>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

