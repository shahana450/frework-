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

/* FreWork Official Logo Icon */
function FreWorkLogo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fw_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>
        <filter id="fw_glow">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="38" height="38" rx="10" fill="url(#fw_bg)"/>
      <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
        <line x1="19" y1="19" x2="19" y2="10"/>
        <line x1="19" y1="19" x2="27" y2="24"/>
        <line x1="19" y1="19" x2="11" y2="24"/>
      </g>
      <g fill="white" filter="url(#fw_glow)">
        <circle cx="19" cy="19" r="3.2"/>
        <circle cx="19" cy="10" r="2.2"/>
        <circle cx="27" cy="24" r="2.2"/>
        <circle cx="11" cy="24" r="2.2"/>
      </g>
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
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        isScrolled
          ? "bg-[#070D1A]/95 backdrop-blur-xl border-b border-[#C9A84C]/15 shadow-[0_4px_32px_rgba(0,0,0,0.4)]"
          : "bg-[#070D1A]/80 backdrop-blur-sm"
      )}
      onMouseLeave={() => setActiveDropdown(null)}
    >
      <div className="container flex h-[68px] items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
          <FreWorkLogo />
          <div>
            <span
              className="font-bold tracking-[-0.025em] text-[#F6F4FC] group-hover:text-white transition-colors duration-300 block"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "1.22rem", lineHeight: 1 }}
            >
              FreWork
            </span>
            <span className="text-[9px] tracking-[0.1em] uppercase block mt-0.5" style={{ color: "rgba(201,168,76,0.55)" }}>
              Business OS
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">

          {/* SERVICES pill */}
          <div className="relative" onMouseEnter={() => setActiveDropdown("services")}>
            <button className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              activeDropdown === "services"
                ? "bg-[#10B981]/15 text-[#34D399]"
                : "text-white/70 hover:text-white hover:bg-white/6"
            )}>
              <Building2 className="w-3.5 h-3.5" />
              Services
              <span className="text-[10px] font-normal text-white/35 ml-0.5">▾</span>
            </button>

            <AnimatePresence>
              {activeDropdown === "services" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-80 p-4 bg-[#080E1C] border border-[#10B981]/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[#34D399]/60 uppercase mb-3 px-1">Start & Comply</p>
                  <ul className="space-y-1">
                    {servicesItems.map((item) => (
                      <li key={item.title}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-[#10B981]/8 group transition-colors" onClick={() => setActiveDropdown(null)}>
                          <div className="w-8 h-8 rounded-lg bg-[#10B981]/12 border border-[#10B981]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#10B981]/25 transition-colors">
                            <item.icon className="w-4 h-4 text-[#34D399]" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white/90 group-hover:text-white">{item.title}</div>
                            <div className="text-xs text-white/40 mt-0.5">{item.description}</div>
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
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* FIND pill */}
          <div className="relative" onMouseEnter={() => setActiveDropdown("find")}>
            <button className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              activeDropdown === "find"
                ? "bg-[#F59E0B]/15 text-[#FCD34D]"
                : "text-white/70 hover:text-white hover:bg-white/6"
            )}>
              <Search className="w-3.5 h-3.5" />
              Find
              <span className="text-[10px] font-normal text-white/35 ml-0.5">▾</span>
            </button>

            <AnimatePresence>
              {activeDropdown === "find" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-72 p-4 bg-[#080E1C] border border-[#F59E0B]/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[#FCD34D]/60 uppercase mb-3 px-1">Marketplace & Community</p>
                  <ul className="space-y-1">
                    {findItems.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-[#F59E0B]/8 group transition-colors" onClick={() => setActiveDropdown(null)}>
                          <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/12 border border-[#F59E0B]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#F59E0B]/25 transition-colors">
                            <item.icon className="w-4 h-4 text-[#FCD34D]" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white/90 group-hover:text-white">{item.title}</div>
                            <div className="text-xs text-white/40 mt-0.5">{item.description}</div>
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
                ? "bg-[#C9A84C]/15 text-[#E8C97A]"
                : "text-white/70 hover:text-white hover:bg-white/6"
            )}>
              <TrendingUp className="w-3.5 h-3.5" />
              Grow
              <span className="text-[10px] font-normal text-white/35 ml-0.5">▾</span>
            </button>

            <AnimatePresence>
              {activeDropdown === "grow" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-72 p-4 bg-[#080E1C] border border-[#C9A84C]/25 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[#E8C97A]/60 uppercase mb-3 px-1">Scale Your Business</p>
                  <ul className="space-y-1">
                    {growItems.map((item) => (
                      <li key={item.href + item.title}>
                        <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-[#C9A84C]/8 group transition-colors" onClick={() => setActiveDropdown(null)}>
                          <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C9A84C]/25 transition-colors">
                            <item.icon className="w-4 h-4 text-[#E8C97A]" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white/90 group-hover:text-white">{item.title}</div>
                            <div className="text-xs text-white/40 mt-0.5">{item.description}</div>
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
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Other links */}
          {([["Pricing", "/pricing"], ["About", "/about"]] as [string,string][]).map(([label, href]) => (
            <Link key={label} href={href} className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              pathname === href ? "text-[#C9A84C]" : "text-white/60 hover:text-white hover:bg-white/6"
            )}>
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <a href="tel:+918590874681"
            className="flex items-center gap-1.5 text-xs font-medium text-white/35 hover:text-white/65 transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
            <Phone className="w-3 h-3" />
            <span>+91 85908 74681</span>
          </a>
          {user ? (
            <>
              <Link href="/dashboard"
                className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/6">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <button onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-medium text-white/40 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/8">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/6">
                Sign in
              </Link>
              <Link
                href="/register"
                className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0B1120] overflow-hidden group transition-all"
                style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #A07830)" }}
              >
                <span className="relative z-10">Get Started</span>
                <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="lg:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/8 transition-colors">
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#070D1A] border-b border-[#C9A84C]/15 overflow-hidden"
          >
            <div className="container py-5 flex flex-col gap-1">

              {/* FIND section */}
              <div className="flex items-center gap-2 mb-2 px-2">
                <Search className="w-3.5 h-3.5 text-[#7DD3FC]" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#7DD3FC]/70 uppercase">FIND — Marketplace</p>
              </div>
              {findItems.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#3B82F6]/8 transition-colors" onClick={() => setIsMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/12 border border-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-[#7DD3FC]" />
                  </div>
                  <span className="text-sm font-medium text-white/90">{item.title}</span>
                </Link>
              ))}

              <div className="border-t border-white/8 my-3" />

              {/* GROW section */}
              <div className="flex items-center gap-2 mb-2 px-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#C9A84C]" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C]/70 uppercase">GROW — Business Services</p>
              </div>
              {growItems.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#C9A84C]/6 transition-colors" onClick={() => setIsMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-[#C9A84C]" />
                  </div>
                  <span className="text-sm font-medium text-white/90">{item.title}</span>
                </Link>
              ))}

              <div className="border-t border-white/8 pt-4 mt-2 flex flex-col gap-2">
                {user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsMobileOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#0B1120]"
                      style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)" }}>
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <button onClick={handleSignOut}
                      className="w-full text-center py-3 rounded-xl text-sm font-medium text-red-400/70 border border-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-all">
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="w-full text-center py-3 rounded-xl text-sm font-medium text-white/70 border border-white/12 hover:border-white/25 hover:text-white transition-all" onClick={() => setIsMobileOpen(false)}>
                      Sign in
                    </Link>
                    <Link href="/register" className="w-full text-center py-3 rounded-xl text-sm font-semibold text-[#0B1120]" style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)" }} onClick={() => setIsMobileOpen(false)}>
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
