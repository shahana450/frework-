"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Briefcase,
  MapPin,
  Users,
  Menu,
  X,
  FileText,
  BarChart3,
  Presentation,
  GraduationCap,
  ChevronRight,
  Search,
  TrendingUp,
  Rocket,
  LayoutDashboard,
  LogOut,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const servicesItems = [
  { title: "Company Registration", href: "/services/compliance", icon: Building2, description: "Pvt Ltd, LLP, OPC, Partnership" },
  { title: "GST Registration", href: "/services/compliance", icon: FileText, description: "GSTIN in 3–5 working days" },
  { title: "Income Tax (ITR)", href: "/services/compliance", icon: BarChart3, description: "Returns filing & planning" },
  { title: "GST Filing", href: "/services/compliance", icon: FileText, description: "GSTR-1, 3B, annual return" },
  { title: "ROC Compliance", href: "/services/compliance", icon: Building2, description: "MCA filings, board meetings" },
  { title: "MSME / Udyam", href: "/services/compliance", icon: GraduationCap, description: "Registration & certificate" },
];

const findItems = [
  { title: "Hire Professionals", href: "/freelancers", icon: Users, description: "CA, CS, developers, designers" },
  { title: "Coworking Spaces", href: "/coworking", icon: MapPin, description: "Premium offices across India" },
  { title: "Job Board", href: "/jobs", icon: Briefcase, description: "Full-time, remote, freelance" },
  { title: "Startup Launchpad", href: "/startups", icon: Rocket, description: "Funding & investor connect" },
];

const growItems = [
  { title: "Detailed Project Report", href: "/services/dpr", icon: BarChart3, description: "For loans, grants, investors" },
  { title: "Pitch Decks", href: "/services/pitch-decks", icon: Presentation, description: "Investor-ready presentations" },
  { title: "Business Restructuring", href: "/services/restructuring", icon: Building2, description: "Strategy, M&A and turnaround" },
  { title: "Training & Workshops", href: "/services/training", icon: GraduationCap, description: "For teams and founders" },
];

/* FreWork Official Logo Icon — Professional Navy */
function FreWorkLogo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fw_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F2044"/>
          <stop offset="100%" stopColor="#1E40AF"/>
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="9" fill="url(#fw_bg)"/>
      <g stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round">
        <line x1="19" y1="19" x2="19" y2="11"/>
        <line x1="19" y1="19" x2="26.5" y2="24"/>
        <line x1="19" y1="19" x2="11.5" y2="24"/>
      </g>
      <circle cx="19" cy="19" r="3" fill="white"/>
      <circle cx="19" cy="11" r="2" fill="rgba(255,255,255,0.9)"/>
      <circle cx="26.5" cy="24" r="2" fill="rgba(255,255,255,0.9)"/>
      <circle cx="11.5" cy="24" r="2" fill="rgba(255,255,255,0.9)"/>
    </svg>
  );
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"services" | "find" | "grow" | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    setIsMobileOpen(false);
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-[0_2px_16px_rgba(15,32,68,0.1)]"
          : "bg-white border-b border-slate-200 shadow-[0_1px_8px_rgba(15,32,68,0.06)]"
      )}
      onMouseLeave={() => setActiveDropdown(null)}
    >
      <div className="container flex h-[68px] items-center justify-between">

        {/* Logo + Workplace link */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group min-w-0">
            <div className="flex-shrink-0">
              <FreWorkLogo size={36} />
            </div>
            <div className="flex-shrink-0">
              <span
                className="font-bold tracking-[-0.025em] transition-colors duration-300 block whitespace-nowrap"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "1.18rem", lineHeight: 1.1, color: "#0F2044" }}
              >
                FreWork
              </span>
              <span className="text-[9px] tracking-[0.12em] uppercase block mt-0.5 whitespace-nowrap" style={{ color: "#94A3B8" }}>
                Business OS
              </span>
            </div>
          </Link>

          {/* FreWork Workplace shortcut */}
          <a
            href="https://freworkplace.onrender.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}
          >
            <Building2 className="w-3.5 h-3.5" />
            Workplace ↗
          </a>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">

          {/* SERVICES pill */}
          <div className="relative" onMouseEnter={() => setActiveDropdown("services")}>
            <button className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              activeDropdown === "services"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}>
              <Building2 className="w-3.5 h-3.5" />
              Services
              <span className="text-[10px] font-normal text-slate-400 ml-0.5">▾</span>
            </button>

            <AnimatePresence>
              {activeDropdown === "services" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-80 p-4 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_40px_rgba(15,32,68,0.12)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Start & Comply</p>
                  <ul className="space-y-1">
                    {servicesItems.map((item) => (
                      <li key={item.title}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-blue-50 group transition-colors" onClick={() => setActiveDropdown(null)}>
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                            <item.icon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* FIND pill */}
          <div className="relative" onMouseEnter={() => setActiveDropdown("find")}>
            <button className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              activeDropdown === "find"
                ? "bg-violet-50 text-violet-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}>
              <Search className="w-3.5 h-3.5" />
              Find
              <span className="text-[10px] font-normal text-slate-400 ml-0.5">▾</span>
            </button>

            <AnimatePresence>
              {activeDropdown === "find" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-72 p-4 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_40px_rgba(15,32,68,0.12)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Marketplace & Community</p>
                  <ul className="space-y-1">
                    {findItems.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-violet-50 group transition-colors" onClick={() => setActiveDropdown(null)}>
                          <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                            <item.icon className="w-4 h-4 text-violet-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* GROW pill */}
          <div className="relative" onMouseEnter={() => setActiveDropdown("grow")}>
            <button className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              activeDropdown === "grow"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}>
              <TrendingUp className="w-3.5 h-3.5" />
              Grow
              <span className="text-[10px] font-normal text-slate-400 ml-0.5">▾</span>
            </button>

            <AnimatePresence>
              {activeDropdown === "grow" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-72 p-4 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_40px_rgba(15,32,68,0.12)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Scale Your Business</p>
                  <ul className="space-y-1">
                    {growItems.map((item) => (
                      <li key={item.href + item.title}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-emerald-50 group transition-colors" onClick={() => setActiveDropdown(null)}>
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                            <item.icon className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Other links */}
          {([["Pricing", "/pricing"], ["About", "/about"]] as [string,string][]).map(([label, href]) => (
            <Link key={label} href={href} className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              pathname === href ? "text-blue-600 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}>
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA — always visible on sm+ */}
        <div className="flex items-center gap-2">

          {/* WhatsApp — desktop only */}
          <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20need%20help%20with%20my%20business"
            target="_blank" rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>

          {user ? (
            /* ── LOGGED IN ── */
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full border-2 border-blue-200 overflow-hidden flex-shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xs font-black">
                    {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Dashboard button */}
              <Link href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#0F2044,#1E3A8A)", color: "#fff", boxShadow: "0 2px 12px rgba(15,32,68,0.25)" }}>
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <button onClick={handleSignOut} title="Sign out"
                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ── NOT LOGGED IN ── */
            <div className="flex items-center gap-2">
              <Link href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Login</span>
              </Link>
              <Link href="/register"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)", color: "#fff", boxShadow: "0 2px 12px rgba(18,70,200,0.25)" }}>
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Sign Up</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors ml-1">
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="container py-5 flex flex-col gap-1">

              {/* SERVICES section */}
              <div className="flex items-center gap-2 mb-2 px-2">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Services — Start & Comply</p>
              </div>
              {servicesItems.slice(0, 4).map((item) => (
                <Link key={item.title} href={item.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors" onClick={() => setIsMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-800">{item.title}</span>
                </Link>
              ))}

              <div className="border-t border-slate-100 my-3" />

              {/* FIND section */}
              <div className="flex items-center gap-2 mb-2 px-2">
                <Search className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Find — Marketplace</p>
              </div>
              {findItems.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 transition-colors" onClick={() => setIsMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-800">{item.title}</span>
                </Link>
              ))}

              <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col gap-2">
                {user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsMobileOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #1246C8, #2563EB)" }}>
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <button onClick={handleSignOut}
                      className="w-full text-center py-3 rounded-xl text-sm font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-all">
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="w-full text-center py-3 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all" onClick={() => setIsMobileOpen(false)}>
                      Sign in
                    </Link>
                    <Link href="/register" className="w-full text-center py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #1246C8, #2563EB)" }} onClick={() => setIsMobileOpen(false)}>
                      Get Started Free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
