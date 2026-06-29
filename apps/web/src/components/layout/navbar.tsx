"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Briefcase,
  Building2,
  Rocket,
  TrendingUp,
  Users,
  Menu,
  X,
  FileText,
  Calculator,
  BookOpen,
  ClipboardCheck,
  BarChart2,
  Globe,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const solutions = [
  { title: "Business Registration", href: "/services/business-registration", icon: Building2, description: "Pvt Ltd, LLP, OPC, Partnership — end to end" },
  { title: "GST Services", href: "/services/gst", icon: FileText, description: "Registration, monthly filing & annual returns" },
  { title: "Income Tax", href: "/services/income-tax", icon: Calculator, description: "ITR filing for individuals and businesses" },
  { title: "Accounting", href: "/services/accounting", icon: BookOpen, description: "Bookkeeping, P&L and MIS reports" },
  { title: "Audit", href: "/services/audit", icon: ClipboardCheck, description: "Statutory, internal and tax audit" },
  { title: "ROC Compliance", href: "/services/roc-compliance", icon: BarChart2, description: "Annual filings, KYC and MCA compliance" },
  { title: "Virtual CFO", href: "/services/virtual-cfo", icon: TrendingUp, description: "Strategic financial planning & reporting" },
];

const comingSoon = [
  { title: "Freelancer Marketplace", icon: Users },
  { title: "Job Portal", icon: Briefcase },
  { title: "Coworking Spaces", icon: Globe },
  { title: "Investor Network", icon: Rocket },
];

/* Premium FW Monogram Logo */
function FreWorkLogo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="38" height="38" rx="10" fill="#0B1120"/>
      <rect x="0.5" y="0.5" width="37" height="37" rx="9.5" stroke="url(#goldBorder)" strokeOpacity="0.6"/>
      {/* F letter */}
      <path d="M8 10H17.5V13H11V17.5H16.5V20.5H11V28H8V10Z" fill="url(#goldFill)"/>
      {/* W letter */}
      <path d="M19 10H22L24.5 21.5L27 10H30L32 28H29L27.8 17L25 28H24L21.2 17L20 28H17L19 10Z" fill="url(#goldFill)"/>
      <defs>
        <linearGradient id="goldFill" x1="8" y1="10" x2="32" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8C97A"/>
          <stop offset="50%" stopColor="#C9A84C"/>
          <stop offset="100%" stopColor="#A07830"/>
        </linearGradient>
        <linearGradient id="goldBorder" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8C97A"/>
          <stop offset="100%" stopColor="#A07830"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
      isScrolled
        ? "bg-[#070D1A]/95 backdrop-blur-xl border-b border-[#C9A84C]/15 shadow-[0_4px_32px_rgba(0,0,0,0.4)]"
        : "bg-[#070D1A]/80 backdrop-blur-sm"
    )}>
      <div className="container flex h-[68px] items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <FreWorkLogo />
          <span className="font-bold text-[1.18rem] tracking-[-0.01em] text-white group-hover:text-[#E8C97A] transition-colors duration-300"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
            Fre<span className="text-[#C9A84C]">Work</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="bg-transparent text-white/80 hover:text-white hover:bg-white/8 data-[state=open]:bg-white/8 data-[state=open]:text-white text-sm font-medium px-4 rounded-lg transition-colors">
                Services
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-[540px] p-5 bg-[#080E1C] border border-[#C9A84C]/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[#C9A84C]/70 uppercase mb-4 px-2">Business Services</p>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {solutions.map((item) => (
                      <li key={item.href}>
                        <NavigationMenuLink asChild>
                          <Link href={item.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-white/6 group transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C9A84C]/20 transition-colors">
                              <item.icon className="w-4 h-4 text-[#C9A84C]" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{item.title}</div>
                              <div className="text-xs text-white/40 mt-0.5">{item.description}</div>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-white/8">
                    <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase mb-3 px-2">Coming Soon</p>
                    <div className="flex flex-wrap gap-2 px-2">
                      {comingSoon.map(({ title, icon: Icon }) => (
                        <span key={title} className="flex items-center gap-1.5 text-xs text-white/30 bg-white/4 px-3 py-1.5 rounded-full border border-white/8">
                          <Icon className="w-3 h-3" />{title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {[["Pricing", "/pricing"], ["About", "/about"], ["Contact", "/contact"]].map(([label, href]) => (
              <NavigationMenuItem key={label}>
                <Link href={href} className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  pathname === href ? "text-[#C9A84C]" : "text-white/70 hover:text-white hover:bg-white/6"
                )}>
                  {label}
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/6">
            Sign in
          </Link>
          <Link href="/register" className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0B1120] overflow-hidden group transition-all"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #A07830)" }}>
            <span className="relative z-10">Get Started</span>
            <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
          </Link>
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
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#C9A84C]/60 uppercase mb-2 px-2">Services</p>
              {solutions.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/6 transition-colors" onClick={() => setIsMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-[#C9A84C]" />
                  </div>
                  <span className="text-sm font-medium text-white/90">{item.title}</span>
                </Link>
              ))}
              <div className="border-t border-white/8 pt-4 mt-2 flex flex-col gap-2">
                <Link href="/login" className="w-full text-center py-3 rounded-xl text-sm font-medium text-white/70 border border-white/12 hover:border-white/25 hover:text-white transition-all" onClick={() => setIsMobileOpen(false)}>
                  Sign in
                </Link>
                <Link href="/register" className="w-full text-center py-3 rounded-xl text-sm font-semibold text-[#0B1120]" style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)" }} onClick={() => setIsMobileOpen(false)}>
                  Get Started Free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
