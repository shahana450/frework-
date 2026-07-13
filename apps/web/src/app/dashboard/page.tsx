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
} from "lucide-react";

const PAID_SERVICES = [
  {
    icon: ReceiptText,   label: "GST Registration & Filing",   sub: "GSTIN in 3–5 days · Monthly GSTR-1 & 3B",   price: "₹499", href: "/services/gst",          color: "#2563EB", bg: "rgba(37,99,235,0.08)",  border: "rgba(37,99,235,0.2)",
  },
  {
    icon: Calculator,    label: "Income Tax Return (ITR)",      sub: "ITR-1 to ITR-6 · Tax planning & refunds",   price: "₹799", href: "/services/income-tax",   color: "#059669", bg: "rgba(5,150,105,0.08)",  border: "rgba(5,150,105,0.2)",
  },
  {
    icon: BarChart3,     label: "Accounting & Bookkeeping",     sub: "Monthly books · P&L · Balance sheet",        price: "₹1,499", href: "/services/accounting", color: "#D97706", bg: "rgba(217,119,6,0.08)",   border: "rgba(217,119,6,0.2)",
  },
  {
    icon: Building2,     label: "Company Registration",         sub: "Pvt Ltd · LLP · OPC · Proprietorship",      price: "₹999",  href: "/services/business-registration", color: "#7C3AED", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)",
  },
  {
    icon: ClipboardList, label: "GST Audit & Reconciliation",   sub: "GSTR-9C · ITC reconciliation · Notices",    price: "₹4,999", href: "/services/audit",      color: "#DC2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.2)",
  },
  {
    icon: BadgeCheck,    label: "ROC & Compliance",             sub: "Annual filing · MCA · Director KYC",         price: "₹1,999", href: "/services/roc-compliance", color: "#0891B2", bg: "rgba(8,145,178,0.08)", border: "rgba(8,145,178,0.2)",
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

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
      const [{ data: startupData }, { data: subData }] = await Promise.all([
        supabase.from("fw_startups").select("id, slug, name, tagline, sector, stage, status").eq("user_id", u.id).order("created_at", { ascending: false }),
        supabase.from("fw_subscriptions").select("plan, billing, status, started_at").eq("user_id", u.id).maybeSingle(),
      ]);
      setStartups(startupData ?? []);
      setSubscription(subData);
      setLoading(false);
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>F</div>
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

        {/* ── CA / CS SERVICES ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Get CA / CS Services</h2>
              <p className="text-sm text-slate-500 mt-0.5">Expert-assisted · Paid · Delivered in days, not weeks</p>
            </div>
            <Link href="/services" className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1">
              All services <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAID_SERVICES.map(({ icon: Icon, label, sub, price, href, color, bg, border }) => (
              <Link key={label} href={href}
                className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
                style={{ borderLeftWidth: 4, borderLeftColor: color }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{label}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{sub}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-sm font-black" style={{ color }}>{price}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                    <Lock className="w-2.5 h-2.5" /> Paid
                  </span>
                </div>
              </Link>
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
                <p className="text-xs text-slate-400 mb-4 max-w-[220px] mx-auto">Submit a query and our CA & CS team will respond within 2 hours.</p>
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
                  <p className="text-xs text-slate-400">Tasks from your CA/CS team appear here once a service starts.</p>
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
                  <p className="text-xs text-slate-400 mb-3">Book a free 30-min call with our CA/CS expert.</p>
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
