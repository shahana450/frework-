"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  MessageSquare, CalendarClock, CheckSquare, Crown, LogOut,
  ArrowRight, FileText, TrendingUp, Building2, Briefcase,
  AlertCircle, Plus, Rocket, ChevronRight, Zap, Star,
  ExternalLink, Edit3, Globe, MapPin, Users, GraduationCap, Wrench,
} from "lucide-react";

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
      <div className="w-10 h-10 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-white/20" />
      </div>
      <p className="text-sm font-medium text-white/40 mb-1">{title}</p>
      <p className="text-xs text-white/25 mb-4 max-w-[180px]">{desc}</p>
      <Link href={href}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#C9A84C]/25 text-[#C9A84C] text-xs hover:bg-[#C9A84C]/8 transition-colors">
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
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusColor = (s: string) =>
    s === "live" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
    s === "pending" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
    "text-white/40 bg-white/5 border-white/10";

  return (
    <div className="min-h-screen bg-[#060C18]">

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/6 rounded-full blur-3xl" />
        <div className="absolute top-32 right-1/4 w-80 h-80 bg-[#C9A84C]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-white/6 bg-[#060C18]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 38 38" fill="none">
              <defs>
                <linearGradient id="fw_d_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7C3AED"/>
                  <stop offset="100%" stopColor="#A855F7"/>
                </linearGradient>
              </defs>
              <rect width="38" height="38" rx="10" fill="url(#fw_d_bg)"/>
              <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="19" y1="19" x2="19" y2="10"/>
                <line x1="19" y1="19" x2="27" y2="24"/>
                <line x1="19" y1="19" x2="11" y2="24"/>
              </g>
              <g fill="white">
                <circle cx="19" cy="19" r="3.2"/>
                <circle cx="19" cy="10" r="2.2"/>
                <circle cx="27" cy="24" r="2.2"/>
                <circle cx="11" cy="24" r="2.2"/>
              </g>
            </svg>
            <span className="font-bold text-white" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Startups", href: "/startups", icon: Rocket },
              { label: "Coworking", href: "/coworking", icon: Building2 },
              { label: "Jobs", href: "/jobs", icon: Briefcase },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={label} href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/6 transition-colors">
                <Icon className="w-3.5 h-3.5" />{label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-white/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center">
                <span className="text-[#C9A84C] text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm text-white/50 hidden sm:block">{user?.name}</span>
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white hover:bg-white/6 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10 relative z-10">

        {/* Welcome banner */}
        <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/6"
          style={{ background: "linear-gradient(135deg, #0D1428 0%, #0F1635 50%, #0A1020 100%)" }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_50%,rgba(201,168,76,0.08),transparent)]" />
          <div className="relative px-8 py-8 flex items-center justify-between">
            <div>
              <p className="text-white/35 text-sm mb-1">{greeting},</p>
              <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>
                {firstName} 👋
              </h1>
              <p className="text-white/35 text-sm">{user?.email}</p>
            </div>
            <div className="hidden md:flex flex-col items-end gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                ● Active account
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-white/6 border border-white/10 text-white/40 capitalize">
                {subscription ? `${subscription.plan} Plan` : "Free Plan"}
              </span>
            </div>
          </div>
        </div>

        {/* ── POST A LISTING HUB ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Post a Listing</h2>
              <p className="text-xs text-white/30 mt-0.5">Add your space, profile, job or service across all three doors</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* FIND door listings */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/4 p-4 hover:border-blue-500/35 hover:bg-blue-500/7 transition-all">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/25 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-blue-400/50">Door 1</div>
                  <div className="text-sm font-bold text-white">FIND</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Building2, label: "Add Workspace / Office", sub: "List your coworking or office space", href: "/dashboard/workspace/submit", badge: "Free" },
                  { icon: Users, label: "Create Freelancer Profile", sub: "Offer your skills & services", href: "/dashboard/freelancer/submit", badge: "Free" },
                  { icon: GraduationCap, label: "Register as Teacher/Tutor", sub: "Offer classes, tutoring & coaching", href: "/dashboard/teacher/submit", badge: "Free" },
                  { icon: Wrench, label: "Register as Skilled Worker", sub: "Electrician, Plumber, Cook, etc.", href: "/dashboard/skilled/submit", badge: "Free" },
                  { icon: Briefcase, label: "Post a Job", sub: "Hire talent for your business", href: "/dashboard/job/submit", badge: "Free" },
                ].map(({ icon: Icon, label, sub, href, badge }) => (
                  <Link key={label} href={href}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-blue-500/10 bg-blue-500/5 hover:border-blue-500/30 hover:bg-blue-500/12 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/25 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white/85 truncate">{label}</div>
                      <div className="text-[9px] text-white/35 truncate">{sub}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">{badge}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* GROW door listings */}
            <div className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/4 p-4 hover:border-[#C9A84C]/35 transition-all">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/20 border border-[#C9A84C]/25 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]/50">Door 2</div>
                  <div className="text-sm font-bold text-white">GROW</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { icon: FileText, label: "Offer CA/CS Service", sub: "GST, Tax, Audit, Company registration", href: "/dashboard/service/submit", badge: "Free" },
                  { icon: Star, label: "Offer Training / Workshop", sub: "Corporate or individual training", href: "/dashboard/service/submit?type=training", badge: "Free" },
                  { icon: TrendingUp, label: "Offer DPR / Business Plan", sub: "Project reports & financial models", href: "/dashboard/service/submit?type=dpr", badge: "Free" },
                  { icon: Building2, label: "Offer Restructuring Advisory", sub: "M&A, turnaround & strategy", href: "/dashboard/service/submit?type=restructuring", badge: "Free" },
                ].map(({ icon: Icon, label, sub, href, badge }) => (
                  <Link key={label} href={href}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-[#C9A84C]/10 bg-[#C9A84C]/5 hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/12 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C9A84C]/25 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-[#C9A84C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white/85 truncate">{label}</div>
                      <div className="text-[9px] text-white/35 truncate">{sub}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">{badge}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* LAUNCH door listings */}
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/4 p-4 hover:border-purple-500/35 transition-all">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/25 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-purple-400/50">Door 3</div>
                  <div className="text-sm font-bold text-white">LAUNCH</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Rocket, label: "List Your Startup", sub: "Pitch deck, video & funding ask", href: "/dashboard/startup/submit", badge: "Free" },
                  { icon: Star, label: "Investor Profile", sub: "Connect with founders & startups", href: "/dashboard/investor/submit", badge: "Free" },
                  { icon: Users, label: "List as Co-founder", sub: "Looking for a co-founder?", href: "/dashboard/cofounder/submit", badge: "Free" },
                ].map(({ icon: Icon, label, sub, href, badge }) => (
                  <Link key={label} href={href}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-purple-500/10 bg-purple-500/5 hover:border-purple-500/30 hover:bg-purple-500/12 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/25 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white/85 truncate">{label}</div>
                      <div className="text-[9px] text-white/35 truncate">{sub}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">{badge}</span>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: MessageSquare, label: "Active Queries", value: "0", color: "text-blue-400", border: "border-blue-400/15", glow: "bg-blue-400/6" },
            { icon: CalendarClock, label: "Upcoming Meetings", value: "0", color: "text-[#C9A84C]", border: "border-[#C9A84C]/15", glow: "bg-[#C9A84C]/6" },
            { icon: CheckSquare, label: "Pending Tasks", value: "0", color: "text-orange-400", border: "border-orange-400/15", glow: "bg-orange-400/6" },
            { icon: Rocket, label: "My Startups", value: String(startups.length), color: "text-purple-400", border: "border-purple-400/15", glow: "bg-purple-400/6" },
          ].map(({ icon: Icon, label, value, color, border, glow }) => (
            <div key={label} className={`rounded-2xl border ${border} ${glow} p-5 hover:scale-[1.02] transition-transform`}>
              <div className={`${color} mb-3 opacity-80`}><Icon className="w-5 h-5" /></div>
              <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
              <div className="text-xs text-white/35">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">

          {/* Left — main content */}
          <div className="lg:col-span-2 space-y-5">

            {/* My Startups */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A]/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                    <Rocket className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <h2 className="font-semibold text-white text-sm">My Startups</h2>
                  {startups.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">{startups.length}</span>
                  )}
                </div>
                <Link href="/dashboard/startup/submit"
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> List startup
                </Link>
              </div>

              {startups.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/8 border border-purple-500/15 flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-6 h-6 text-purple-400/40" />
                  </div>
                  <p className="text-sm font-medium text-white/40 mb-1">No startups listed yet</p>
                  <p className="text-xs text-white/20 mb-5 max-w-[200px] mx-auto">List your startup to get discovered by investors and partners</p>
                  <Link href="/dashboard/startup/submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
                    <Rocket className="w-3.5 h-3.5" /> List your startup — Free
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-white/4">
                  {startups.map(s => (
                    <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-sm font-bold text-purple-400 flex-shrink-0">
                        {s.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{s.name}</p>
                        <p className="text-xs text-white/35 truncate">{s.tagline}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(s.status)}`}>{s.status}</span>
                        {s.status === "live" && (
                          <Link href={`/startups/${s.slug}`} className="text-white/20 hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="px-6 py-3">
                    <Link href="/startups" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                      Browse all startups <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* My Queries */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A]/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/20 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-[#C9A84C]" />
                  </div>
                  <h2 className="font-semibold text-white text-sm">My Queries</h2>
                </div>
                <Link href="/contact" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] flex items-center gap-1 transition-colors">
                  New query <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <EmptyState icon={FileText} title="No queries yet"
                desc="Submit a query and our CA & CS team will respond within 2 hours."
                cta="Submit a query" href="/contact" />
            </div>

            {/* Tasks + Meetings row */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-white/6 bg-[#070D1A]/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/6">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
                    <CheckSquare className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <h2 className="font-semibold text-white text-sm">Tasks</h2>
                </div>
                <EmptyState icon={CheckSquare} title="No tasks"
                  desc="Tasks from your CA/CS team appear here once a service starts."
                  cta="Start a service" href="/services/compliance" />
              </div>

              <div className="rounded-2xl border border-white/6 bg-[#070D1A]/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/6">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <CalendarClock className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <h2 className="font-semibold text-white text-sm">Meetings</h2>
                </div>
                <EmptyState icon={CalendarClock} title="No meetings"
                  desc="Book a free 30-min call with our CA/CS expert."
                  cta="Schedule a call" href="/contact" />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* Subscription */}
            <div className="rounded-2xl overflow-hidden border border-[#C9A84C]/20"
              style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.03) 100%)" }}>
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#C9A84C]/10">
                <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/20 flex items-center justify-center">
                  <Crown className="w-3.5 h-3.5 text-[#C9A84C]" />
                </div>
                <h2 className="font-semibold text-white text-sm">Subscription</h2>
              </div>
              <div className="px-5 py-5">
                {subscription ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-full capitalize"
                        style={{ background: "linear-gradient(135deg,rgba(232,201,122,0.15),rgba(201,168,76,0.1))", border: "1px solid rgba(201,168,76,0.3)", color: "#E8C97A" }}>
                        {subscription.plan} Plan
                      </span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      <span className="text-xs text-emerald-400">Active</span>
                    </div>
                    <p className="text-[11px] text-white/30 mb-4 capitalize">
                      Billing: {subscription.billing} · Since {new Date(subscription.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <Link href="/pricing"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/8 transition-colors">
                      Manage Plan <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/10 text-white/50">Free Plan</span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      <span className="text-xs text-white/35">Active</span>
                    </div>
                    <ul className="space-y-2 mb-5">
                      {["1 active query", "Basic CA support", "Email updates", "1 startup listing"].map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs text-white/45">
                          <svg className="w-3.5 h-3.5 text-[#C9A84C]/60 flex-shrink-0" viewBox="0 0 12 10" fill="none">
                            <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/pricing"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs text-[#0B1120] transition-opacity hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)" }}>
                      Upgrade to Pro <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A]/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/6">
                <div className="w-7 h-7 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white/40" />
                </div>
                <h2 className="font-semibold text-white text-sm">Quick Actions</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                {[
                  { icon: Rocket, label: "List Startup", href: "/dashboard/startup/submit", color: "text-purple-400", bg: "hover:border-purple-500/25 hover:bg-purple-500/5" },
                  { icon: Globe, label: "Browse Startups", href: "/startups", color: "text-blue-400", bg: "hover:border-blue-500/25 hover:bg-blue-500/5" },
                  { icon: Building2, label: "Find Workspace", href: "/coworking", color: "text-emerald-400", bg: "hover:border-emerald-500/25 hover:bg-emerald-500/5" },
                  { icon: Briefcase, label: "Browse Jobs", href: "/jobs", color: "text-orange-400", bg: "hover:border-orange-500/25 hover:bg-orange-500/5" },
                  { icon: FileText, label: "Compliance", href: "/services/compliance", color: "text-[#C9A84C]", bg: "hover:border-[#C9A84C]/25 hover:bg-[#C9A84C]/5" },
                  { icon: AlertCircle, label: "Contact Us", href: "/contact", color: "text-white/40", bg: "hover:border-white/15 hover:bg-white/4" },
                ].map(({ icon: Icon, label, href, color, bg }) => (
                  <Link key={label} href={href}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-white/6 ${bg} transition-all text-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-white/45 leading-tight">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* FreWork services promo */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A]/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-semibold text-white">GROW your business</h3>
              </div>
              <p className="text-xs text-white/35 leading-relaxed mb-4">
                CA/CS experts for GST, Income Tax, Company Registration, Pitch Decks and more.
              </p>
              <div className="space-y-2">
                {[
                  { label: "Compliance & Tax", href: "/services/compliance" },
                  { label: "Pitch Deck", href: "/services/pitch-decks" },
                  { label: "DPR / Business Plan", href: "/services/dpr" },
                ].map(s => (
                  <Link key={s.label} href={s.href}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/6 hover:border-[#C9A84C]/20 hover:bg-[#C9A84C]/4 transition-colors group">
                    <span className="text-xs text-white/45 group-hover:text-white/70 transition-colors">{s.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-[#C9A84C] transition-colors" />
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
