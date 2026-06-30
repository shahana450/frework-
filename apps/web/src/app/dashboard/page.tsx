"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  User,
  LayoutDashboard,
  MessageSquare,
  CalendarClock,
  CheckSquare,
  Crown,
  LogOut,
  ArrowRight,
  Clock,
  FileText,
  TrendingUp,
  Building2,
  Briefcase,
  AlertCircle,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

const mockQueries = [
  { id: 1, service: "GST Filing", status: "In Progress", date: "28 Jun 2026", message: "Pending documents from client" },
  { id: 2, service: "DPR Preparation", status: "Under Review", date: "25 Jun 2026", message: "Draft sent for review" },
  { id: 3, service: "Income Tax", status: "Completed", date: "20 Jun 2026", message: "Filed successfully" },
];

const mockMeetings = [
  { id: 1, title: "GST Consultation", with: "CA Ravi Kumar", date: "2 Jul 2026", time: "11:00 AM", type: "Video Call" },
  { id: 2, title: "Business Restructuring Review", with: "CS Priya Sharma", date: "5 Jul 2026", time: "3:00 PM", type: "In-person" },
];

const mockTasks = [
  { id: 1, task: "Upload last 3 months bank statements", due: "1 Jul 2026", done: false },
  { id: 2, task: "Sign the engagement letter", due: "30 Jun 2026", done: false },
  { id: 3, task: "Share PAN & Aadhaar copies", due: "28 Jun 2026", done: true },
  { id: 4, task: "Review draft financials", due: "5 Jul 2026", done: false },
];

const statusColor: Record<string, string> = {
  "In Progress": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Under Review": "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "Completed": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState(mockTasks);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      const u = session.user;
      setUser({
        id: u.id,
        email: u.email ?? "",
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "User",
        avatar: u.user_metadata?.avatar_url,
      });
      setLoading(false);
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const completedTasks = tasks.filter(t => t.done).length;

  return (
    <div className="min-h-screen bg-[#060C18]">
      {/* Top nav */}
      <header className="border-b border-white/6 bg-[#070D1A]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="fw_dash_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7C3AED"/>
                  <stop offset="100%" stopColor="#A855F7"/>
                </linearGradient>
              </defs>
              <rect width="38" height="38" rx="10" fill="url(#fw_dash_bg)"/>
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

          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-white/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center">
                <span className="text-[#C9A84C] text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm text-white/60 hidden sm:block">{user?.name}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/6 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">

        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Good day, {firstName} 👋
          </h1>
          <p className="text-white/40 text-sm">Here's everything happening on your account.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: MessageSquare, label: "Active Queries", value: "2", color: "text-blue-400", bg: "bg-blue-400/8 border-blue-400/15" },
            { icon: CalendarClock, label: "Upcoming Meetings", value: "2", color: "text-[#C9A84C]", bg: "bg-[#C9A84C]/8 border-[#C9A84C]/15" },
            { icon: CheckSquare, label: "Tasks Pending", value: String(tasks.filter(t => !t.done).length), color: "text-orange-400", bg: "bg-orange-400/8 border-orange-400/15" },
            { icon: TrendingUp, label: "Services Used", value: "3", color: "text-emerald-400", bg: "bg-emerald-400/8 border-emerald-400/15" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border ${bg} p-5`}>
              <div className={`${color} mb-3`}><Icon className="w-5 h-5" /></div>
              <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
              <div className="text-xs text-white/40">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left column: Queries + Tasks */}
          <div className="lg:col-span-2 space-y-6">

            {/* My Queries */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
                  <h2 className="font-semibold text-white text-sm">My Queries</h2>
                </div>
                <Link href="/contact" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] flex items-center gap-1">
                  New query <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-white/4">
                {mockQueries.map(q => (
                  <div key={q.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-sm font-medium text-white">{q.service}</span>
                      </div>
                      <p className="text-xs text-white/35">{q.message}</p>
                      <p className="text-xs text-white/25 mt-1">{q.date}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${statusColor[q.status]}`}>
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Dashboard */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-[#C9A84C]" />
                  <h2 className="font-semibold text-white text-sm">Task Dashboard</h2>
                </div>
                <span className="text-xs text-white/30">{completedTasks}/{tasks.length} done</span>
              </div>
              {/* Progress bar */}
              <div className="px-6 pt-4">
                <div className="w-full h-1.5 bg-white/6 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] rounded-full transition-all duration-500"
                    style={{ width: `${(completedTasks / tasks.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="divide-y divide-white/4 mt-2">
                {tasks.map(t => (
                  <div
                    key={t.id}
                    className="px-6 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-white/2 transition-colors"
                    onClick={() => toggleTask(t.id)}
                  >
                    <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      t.done ? "bg-[#C9A84C] border-[#C9A84C]" : "border-white/20 bg-transparent"
                    }`}>
                      {t.done && <svg className="w-2.5 h-2.5 text-[#0B1120]" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${t.done ? "line-through text-white/25" : "text-white/75"}`}>{t.task}</p>
                    </div>
                    <div className="flex items-center gap-1 text-white/25 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{t.due}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Meetings + Subscription + Quick links */}
          <div className="space-y-6">

            {/* Upcoming Meetings */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A] overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-white/6">
                <CalendarClock className="w-4 h-4 text-[#C9A84C]" />
                <h2 className="font-semibold text-white text-sm">Meeting Schedules</h2>
              </div>
              <div className="divide-y divide-white/4">
                {mockMeetings.map(m => (
                  <div key={m.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-white leading-snug">{m.title}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/6 border border-white/8 text-white/40 flex-shrink-0">{m.type}</span>
                    </div>
                    <p className="text-xs text-white/35 mb-1">with {m.with}</p>
                    <div className="flex items-center gap-1.5 text-[#C9A84C]/70">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{m.date} · {m.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-5">
                <Link href="/contact" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#C9A84C]/25 text-[#C9A84C] text-xs hover:bg-[#C9A84C]/8 transition-colors">
                  Schedule a meeting <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-2xl border border-[#C9A84C]/20 bg-gradient-to-br from-[#C9A84C]/8 to-transparent overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#C9A84C]/10">
                <Crown className="w-4 h-4 text-[#C9A84C]" />
                <h2 className="font-semibold text-white text-sm">Subscription</h2>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/10 text-white/50">Free Plan</span>
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span className="text-xs text-white/40">Active</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {["1 active query", "Basic support", "Email updates"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/45">
                      <svg className="w-3.5 h-3.5 text-[#C9A84C]/60 flex-shrink-0" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs text-[#0B1120]"
                  style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)" }}>
                  Upgrade to Pro <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-white/6 bg-[#070D1A] overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-white/6">
                <LayoutDashboard className="w-4 h-4 text-[#C9A84C]" />
                <h2 className="font-semibold text-white text-sm">Quick Actions</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                {[
                  { icon: Building2, label: "Find Workspace", href: "/coworking" },
                  { icon: Briefcase, label: "Browse Jobs", href: "/jobs" },
                  { icon: FileText, label: "Get Compliance", href: "/services/compliance" },
                  { icon: AlertCircle, label: "Contact Us", href: "/contact" },
                ].map(({ icon: Icon, label, href }) => (
                  <Link key={label} href={href}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/6 hover:border-[#C9A84C]/25 hover:bg-[#C9A84C]/4 transition-colors text-center">
                    <Icon className="w-4 h-4 text-white/40" />
                    <span className="text-xs text-white/50 leading-tight">{label}</span>
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
