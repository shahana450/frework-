"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2, FileText, IndianRupee, Users, TrendingUp, MapPin, Rocket, LayoutDashboard,
  ArrowRight, ChevronRight, MessageCircle, Search, CheckCircle, Shield, Clock, Star,
  Briefcase, BarChart3, Presentation, GraduationCap, Phone, Zap, Check,
} from "lucide-react";

const SUPPORT_PHONE = (process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+91 85908 74681").replace(/^﻿/, "");
const SUPPORT_WA = `918590874681`;

// Light luxury palette
const L = {
  bg: "#FAFAF5",
  bgAlt: "#F4EFE6",
  bgCard: "#FFFFFF",
  text: "#1A1208",
  textSub: "#6B5B3E",
  textMuted: "#9C8B70",
  gold: "#B8903A",
  goldLight: "#E8C97A",
  goldDark: "#8C6A1E",
  border: "rgba(184,144,58,0.18)",
  borderLight: "rgba(184,144,58,0.1)",
  shadow: "0 2px 20px rgba(139,108,50,0.07), 0 1px 3px rgba(139,108,50,0.05)",
  shadowHover: "0 8px 40px rgba(139,108,50,0.13), 0 2px 8px rgba(139,108,50,0.08)",
};

const MODULES = [
  { id: "start", label: "START", tagline: "Register & Set Up", desc: "Company registration, GST, PAN, MSME — get legally started.", icon: Building2, color: "#059669", href: "/services/compliance", badge: "Most Popular", items: ["Company Registration", "GST Registration", "PAN & TAN", "MSME / Udyam"] },
  { id: "comply", label: "COMPLY", tagline: "Stay Compliant", desc: "Income Tax, GST filing, ROC — never miss a deadline.", icon: FileText, color: "#2563EB", href: "/services/compliance", badge: null, items: ["Income Tax (ITR)", "GST Filing", "ROC / MCA", "TDS Filing"] },
  { id: "finance", label: "FINANCE", tagline: "Manage Money", desc: "Invoicing, payroll, bookkeeping — keep finances clean.", icon: IndianRupee, color: "#7C3AED", href: "/pricing", badge: "Coming Soon", items: ["Invoicing", "Payroll", "Bookkeeping", "Reports"] },
  { id: "professionals", label: "FIND PEOPLE", tagline: "Hire Talent", desc: "Verified CAs, developers, designers for your business.", icon: Users, color: "#D97706", href: "/freelancers", badge: "Launching Soon", items: ["CA / CS / Lawyers", "Developers", "Designers", "Consultants"] },
  { id: "grow", label: "GROW", tagline: "Scale Up", desc: "Business plans, DPRs, pitch decks — tools to scale.", icon: TrendingUp, color: "#DC2626", href: "/services/dpr", badge: null, items: ["DPR", "Pitch Deck", "Business Plan", "Restructuring"] },
  { id: "workspace", label: "WORKSPACE", tagline: "Find Your Office", desc: "Premium coworking spaces across India.", icon: MapPin, color: "#EA580C", href: "/coworking", badge: "Launching Soon", items: ["Coworking Desks", "Private Cabins", "Meeting Rooms", "Virtual Office"] },
  { id: "launch", label: "LAUNCH", tagline: "Raise Funding", desc: "List your startup, connect with investors.", icon: Rocket, color: "#4F46E5", href: "/startups", badge: "Launching Soon", items: ["Startup Listing", "Investor Connect", "Pitch Events", "Mentorship"] },
  { id: "dashboard", label: "DASHBOARD", tagline: "Track Everything", desc: "Compliance calendar, documents, reminders — all in one.", icon: LayoutDashboard, color: "#B8903A", href: "/dashboard", badge: "Early Access", items: ["Compliance Calendar", "Document Vault", "Renewals", "Status Tracker"] },
];

const TRUST_TICKER = ["Company Registration", "GST Filing", "Income Tax Returns", "Coworking Spaces", "Hire Professionals", "Pitch Decks", "Startup Funding", "Business Plans", "MSME Registration", "ROC Compliance"];

function GoldDivider() {
  return (
    <div className="flex items-center gap-3 justify-center my-4">
      <div className="h-px w-12 opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${L.gold})` }} />
      <div className="w-1 h-1 rounded-full" style={{ background: L.gold, opacity: 0.5 }} />
      <div className="h-px w-12 opacity-40" style={{ background: `linear-gradient(90deg, ${L.gold}, transparent)` }} />
    </div>
  );
}

export function BusinessOSHomepage() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes("gst") || q.includes("tax") || q.includes("itr") || q.includes("register")) window.location.href = "/services/compliance";
    else if (q.includes("freelanc") || q.includes("ca ") || q.includes("developer")) window.location.href = "/freelancers";
    else if (q.includes("cowork") || q.includes("office") || q.includes("space")) window.location.href = "/coworking";
    else if (q.includes("startup") || q.includes("invest") || q.includes("funding")) window.location.href = "/startups";
    else if (q.includes("pitch") || q.includes("dpr") || q.includes("plan")) window.location.href = "/services/dpr";
    else window.location.href = "/contact";
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: L.bg, color: L.text }}>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-24 pb-20 overflow-hidden">
        {/* Warm ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 55% at 50% -5%, rgba(184,144,58,0.12) 0%, transparent 60%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 40% at 80% 80%, rgba(234,224,200,0.4) 0%, transparent 55%)" }} />
          {/* Subtle linen texture via thin lines */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.018,
            backgroundImage: "linear-gradient(rgba(139,108,50,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,108,50,1) 1px, transparent 1px)",
            backgroundSize: "72px 72px"
          }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badges */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border"
              style={{ background: "rgba(184,144,58,0.08)", borderColor: "rgba(184,144,58,0.25)", color: L.goldDark }}>
              🇮🇳 Made in India
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border"
              style={{ background: "rgba(5,150,105,0.06)", borderColor: "rgba(5,150,105,0.2)", color: "#065F46" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Beta · Early Access Open
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-black leading-[1.0] mb-6 tracking-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2.8rem, 8vw, 6rem)", color: L.text }}>
            The Operating System<br />
            <span style={{ background: `linear-gradient(135deg, ${L.goldLight} 0%, ${L.gold} 40%, ${L.goldDark} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              for Indian Businesses
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed"
            style={{ color: L.textSub }}>
            Start, Run and Grow Your Business — All in One Place.
          </motion.p>

          {/* Search */}
          <motion.form
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            onSubmit={handleSearch}
            className="flex gap-2 max-w-lg mx-auto mb-8 p-1.5 rounded-2xl border shadow-lg"
            style={{ background: L.bgCard, borderColor: L.border, boxShadow: "0 4px 24px rgba(139,108,50,0.1)" }}>
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: L.textMuted }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="What does your business need today?"
                className="flex-1 bg-transparent outline-none text-sm py-2"
                style={{ color: L.text }} />
            </div>
            <button type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${L.goldLight}, ${L.gold})`, color: "#fff" }}>
              Search
            </button>
          </motion.form>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3 mb-16">
            <Link href="/register"
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${L.goldLight}, ${L.gold})`, color: "#fff", boxShadow: `0 4px 24px rgba(184,144,58,0.3)` }}>
              Get Started Free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20want%20to%20know%20more.`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.03]"
              style={{ borderColor: L.border, color: L.textSub, background: L.bgCard, boxShadow: L.shadow }}>
              <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
              Talk to an Expert
            </a>
          </motion.div>

          {/* Scrolling ticker */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="relative overflow-hidden">
            <div className="flex gap-8 animate-marquee whitespace-nowrap">
              {[...TRUST_TICKER, ...TRUST_TICKER].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2.5 text-xs font-semibold flex-shrink-0"
                  style={{ color: L.textMuted }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: L.gold, opacity: 0.5 }} />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── COWORKING SPOTLIGHT ─── */}
      <section className="py-28 px-4 relative overflow-hidden" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", right: "-10%", top: "-20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(234,172,92,0.08) 0%, transparent 65%)", filter: "blur(40px)" }} />
        </div>

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, ${L.gold}, transparent)` }} />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: L.gold }}>Featured Module</span>
            <div className="h-px flex-1" style={{ background: `rgba(184,144,58,0.12)` }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left */}
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase mb-6 border"
                style={{ background: "rgba(234,88,12,0.06)", borderColor: "rgba(234,88,12,0.2)", color: "#C2410C" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Launching Soon
              </span>

              <h2 className="font-black leading-[1.05] mb-5"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", color: L.text }}>
                Your perfect office,<br />
                <span style={{ background: "linear-gradient(135deg, #F97316, #C2410C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  wherever you work.
                </span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: L.textSub }}>
                Day desk or private cabin, by the hour or by the month.
                FreWork is building India&apos;s most trusted coworking directory —
                every space personally verified before listing.
              </p>

              {/* Features */}
              <div className="grid grid-cols-2 gap-2.5 mb-8">
                {[
                  { e: "📶", l: "High-speed WiFi" }, { e: "☕", l: "Café & Cafeteria" },
                  { e: "🚗", l: "Parking Included" }, { e: "🏛️", l: "Meeting Rooms" },
                  { e: "🕐", l: "Day / Monthly Plans" }, { e: "✅", l: "Verified Spaces Only" },
                ].map(f => (
                  <div key={f.l} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border"
                    style={{ background: L.bgCard, borderColor: L.borderLight, boxShadow: L.shadow }}>
                    <span className="text-base">{f.e}</span>
                    <span className="text-xs font-semibold" style={{ color: L.textSub }}>{f.l}</span>
                  </div>
                ))}
              </div>

              {/* Cities */}
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: L.gold }}>Launching in</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"].map(city => (
                  <span key={city} className="px-3 py-1 rounded-full text-xs border font-medium"
                    style={{ background: L.bgCard, borderColor: L.borderLight, color: L.textMuted, boxShadow: L.shadow }}>
                    📍 {city}
                  </span>
                ))}
              </div>

              <div className="flex gap-3 flex-wrap">
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #F97316, #C2410C)", color: "#fff", boxShadow: "0 4px 20px rgba(234,88,12,0.25)" }}>
                  Explore Spaces <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold border transition-all hover:scale-[1.03]"
                  style={{ borderColor: "rgba(234,88,12,0.25)", color: "#C2410C", background: L.bgCard, boxShadow: L.shadow }}>
                  List your space — Free
                </Link>
              </div>
            </motion.div>

            {/* Right — UI card */}
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="relative pt-6">
              <div className="relative rounded-3xl overflow-hidden border"
                style={{ background: L.bgCard, borderColor: "rgba(234,88,12,0.15)", boxShadow: "0 20px 60px rgba(139,108,50,0.1), 0 4px 16px rgba(234,88,12,0.08)" }}>

                {/* Top accent line */}
                <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #F97316, #C2410C, #F97316)" }} />

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(234,88,12,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border"
                      style={{ background: "rgba(234,88,12,0.06)", borderColor: "rgba(234,88,12,0.12)" }}>🏢</div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: L.text }}>FreWork Coworking</p>
                      <p className="text-[10px]" style={{ color: L.textMuted }}>Verified · Bangalore, Indiranagar</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    style={{ background: "rgba(5,150,105,0.06)", color: "#065F46", borderColor: "rgba(5,150,105,0.2)" }}>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Available
                  </span>
                </div>

                {/* Plans */}
                <div className="p-6">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{ color: L.textMuted }}>Choose your plan</p>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { e: "💺", l: "Hot Desk", p: "₹350/day", active: true },
                      { e: "🔒", l: "Private Cabin", p: "₹8,000/mo", active: false },
                      { e: "📽️", l: "Meeting Room", p: "₹500/hr", active: false },
                    ].map((opt) => (
                      <div key={opt.l} className={`rounded-2xl p-3 text-center border cursor-pointer transition-all`}
                        style={opt.active ? {
                          borderColor: "rgba(234,88,12,0.3)", background: "rgba(234,88,12,0.04)",
                          boxShadow: "0 2px 12px rgba(234,88,12,0.08)"
                        } : {
                          borderColor: L.borderLight, background: L.bgAlt
                        }}>
                        <p className="text-xl mb-1.5">{opt.e}</p>
                        <p className="text-[10px] font-semibold mb-1" style={{ color: opt.active ? "#C2410C" : L.textMuted }}>{opt.l}</p>
                        <p className="text-[10px] font-black" style={{ color: opt.active ? "#EA580C" : L.textMuted }}>{opt.p}</p>
                      </div>
                    ))}
                  </div>

                  {/* Amenity tags */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {["📶 WiFi", "☕ Café", "🅿️ Parking", "🖨️ Printer", "❄️ AC", "🔐 24/7"].map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
                        style={{ background: L.bgAlt, color: L.textSub, borderColor: L.borderLight }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <Link href="/coworking"
                    className="w-full py-3 rounded-2xl text-sm font-bold text-center block transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #F97316, #C2410C)", color: "#fff" }}>
                    Book a visit →
                  </Link>
                </div>
              </div>

              {/* Floating chip */}
              <div className="absolute -bottom-3 -left-3 px-4 py-2.5 rounded-xl border shadow-xl"
                style={{ background: L.bgCard, borderColor: "rgba(234,88,12,0.2)", boxShadow: "0 8px 32px rgba(139,108,50,0.12)" }}>
                <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#C2410C" }}>Coming to 8 cities</p>
                <p className="text-xs mt-0.5" style={{ color: L.textMuted }}>
                  <Link href="/coworking" style={{ color: "#EA580C" }}>Get notified</Link> when we launch near you
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 8 MODULES ─── */}
      <section className="py-28 px-4 relative" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>8 Modules · One Platform</p>
            <GoldDivider />
            <h2 className="font-black mb-4 leading-tight mt-4"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 3rem)", color: L.text }}>
              Everything your business needs
            </h2>
            <p className="text-base max-w-md mx-auto" style={{ color: L.textSub }}>
              From day one of registration to raising your Series A
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onMouseEnter={() => setActiveModule(mod.id)}
                  onMouseLeave={() => setActiveModule(null)}>
                  <Link href={mod.href} className="block h-full">
                    <div className="relative h-full rounded-2xl p-5 transition-all duration-300 cursor-pointer"
                      style={{
                        background: isActive ? `${mod.color}06` : L.bgCard,
                        border: `1px solid ${isActive ? mod.color + "35" : L.borderLight}`,
                        boxShadow: isActive ? `0 8px 40px ${mod.color}12, 0 2px 8px ${mod.color}08` : L.shadow,
                        transform: isActive ? "translateY(-2px)" : "none",
                      }}>
                      {/* Top accent on hover */}
                      {isActive && (
                        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl"
                          style={{ background: `linear-gradient(90deg, transparent, ${mod.color}, transparent)` }} />
                      )}

                      {/* Badge */}
                      {mod.badge && (
                        <span className="absolute top-3.5 right-3.5 text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${mod.color}10`, color: mod.color, border: `1px solid ${mod.color}22` }}>
                          {mod.badge}
                        </span>
                      )}

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                        style={{
                          background: `${mod.color}10`,
                          border: `1px solid ${mod.color}22`,
                        }}>
                        <Icon className="w-5 h-5" style={{ color: mod.color }} />
                      </div>

                      <p className="text-[9px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: mod.color }}>
                        {mod.label}
                      </p>
                      <h3 className="font-bold text-sm mb-2" style={{ color: L.text }}>
                        {mod.tagline}
                      </h3>
                      <p className="text-[11px] leading-relaxed mb-4" style={{ color: L.textMuted }}>
                        {mod.desc}
                      </p>

                      <ul className="space-y-1.5">
                        {mod.items.map(item => (
                          <li key={item} className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: `${mod.color}12` }}>
                              <Check className="w-2 h-2" style={{ color: mod.color }} />
                            </div>
                            <span className="text-[11px]" style={{ color: L.textSub }}>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center gap-1 mt-4 text-[11px] font-bold transition-all duration-200"
                        style={{ color: isActive ? mod.color : L.textMuted }}>
                        Explore <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-28 px-4" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>How it works</p>
            <GoldDivider />
            <h2 className="font-black mt-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Simple as 1 — 2 — 3
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${L.gold}40, ${L.gold}40, transparent)` }} />

            {[
              { n: "01", t: "Tell us what you need", d: "Choose a service or describe your business challenge. Our experts understand Indian business inside-out." },
              { n: "02", t: "Get matched & supported", d: "We connect you with the right verified professional and track your service end-to-end via your dashboard." },
              { n: "03", t: "Run your business", d: "Stay on top of deadlines, documents, and renewals — all in one place. No more missed filings." },
            ].map((step, i) => (
              <motion.div key={step.n}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="text-center relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: L.bgCard, border: `1px solid ${L.border}`, boxShadow: `0 4px 20px rgba(184,144,58,0.1)` }}>
                  <span className="font-black text-2xl" style={{ color: L.gold, fontFamily: "var(--font-cormorant), serif" }}>{step.n}</span>
                </div>
                <h3 className="font-bold mb-3 text-base" style={{ color: L.text }}>{step.t}</h3>
                <p className="text-sm leading-relaxed" style={{ color: L.textSub }}>{step.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY FREWORK ─── */}
      <section className="py-28 px-4" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>Why choose us</p>
            <GoldDivider />
            <h2 className="font-black mt-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Built for Indian business, <span style={{ color: L.gold }}>honestly</span>
            </h2>
            <p className="mt-3 text-sm max-w-sm mx-auto" style={{ color: L.textSub }}>
              No fake metrics. No inflated claims. Just real tools for real businesses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Shield, c: "#059669", t: "Verified professionals only", d: "Every CA, CS, and expert on FreWork is manually verified before going live. No stock-photo profiles." },
              { icon: Clock, c: "#2563EB", t: "Never miss a deadline", d: "Built-in compliance calendar for GST, ITR, ROC, and TDS — with WhatsApp reminders before every due date." },
              { icon: Star, c: "#B8903A", t: "Built for Indian business", d: "We understand Indian compliance, Indian languages, and the real challenges of SMEs and startups in India." },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.t}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="p-7 rounded-2xl border group transition-all duration-300 hover:-translate-y-1"
                  style={{ background: L.bgCard, borderColor: L.borderLight, boxShadow: L.shadow }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = L.shadowHover)}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = L.shadow)}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: `${item.c}08`, border: `1px solid ${item.c}20` }}>
                    <Icon className="w-6 h-6" style={{ color: item.c }} />
                  </div>
                  <h3 className="font-bold mb-2.5 text-base" style={{ color: L.text }}>{item.t}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: L.textSub }}>{item.d}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="py-28 px-4 relative" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-3" style={{ color: L.gold }}>Simple pricing</p>
            <GoldDivider />
            <h2 className="font-black mb-4 mt-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Pay only for what you need
            </h2>
            <p className="text-sm" style={{ color: L.textSub }}>Start free. Upgrade as you grow. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[
              { name: "Free", icon: Zap, price: "₹0", per: "forever", tagline: "Just getting started", accent: "#6B5B3E", border: L.borderLight, bg: L.bgCard, popular: false, features: ["Browse all listings", "1 active listing", "5 applications/mo", "Email support"], href: "/register" },
              { name: "Professional", icon: Rocket, price: "₹999", per: "/month", tagline: "Freelancers & CAs", accent: L.goldDark, border: L.border, bg: L.bgCard, popular: true, features: ["Unlimited listings", "Verified Badge", "GST Registration", "Monthly GST filing", "Income Tax (ITR)"], href: "/register?plan=professional" },
              { name: "Growth", icon: TrendingUp, price: "₹2,999", per: "/month", tagline: "SMEs & agencies", accent: "#2563EB", border: "rgba(37,99,235,0.15)", bg: L.bgCard, popular: false, features: ["5 team seats", "Bookkeeping", "ROC filing", "Client portal", "Revenue analytics"], href: "/register?plan=growth" },
              { name: "Business", icon: Building2, price: "₹4,999", per: "/month", tagline: "Established firms", accent: "#7C3AED", border: "rgba(124,58,237,0.15)", bg: L.bgCard, popular: false, features: ["20 team seats", "Dedicated manager", "Internal audit", "Tax audit", "API access"], href: "/register?plan=business" },
            ].map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div key={plan.name}
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="relative flex flex-col rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: plan.bg,
                    borderColor: plan.border,
                    boxShadow: plan.popular ? `0 8px 40px rgba(184,144,58,0.15), 0 2px 8px rgba(184,144,58,0.08)` : L.shadow,
                  }}>
                  {plan.popular && (
                    <>
                      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
                        style={{ background: `linear-gradient(90deg, ${L.goldLight}, ${L.gold}, ${L.goldDark})` }} />
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-0.5 rounded-full text-[10px] font-black tracking-wide"
                          style={{ background: `linear-gradient(135deg, ${L.goldLight}, ${L.gold})`, color: "#fff" }}>
                          Most Popular
                        </span>
                      </div>
                    </>
                  )}

                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 mt-2"
                    style={{ background: `${plan.accent}10`, border: `1px solid ${plan.accent}20` }}>
                    <Icon className="w-4 h-4" style={{ color: plan.accent }} />
                  </div>

                  <p className="text-[9px] font-black tracking-[0.25em] uppercase mb-0.5" style={{ color: plan.accent }}>{plan.name}</p>
                  <p className="text-[11px] mb-4" style={{ color: L.textMuted }}>{plan.tagline}</p>

                  <div className="flex items-end gap-1 mb-5">
                    <span className="text-3xl font-black" style={{ color: L.text, fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                      {plan.price}
                    </span>
                    <span className="text-xs pb-0.5" style={{ color: L.textMuted }}>{plan.per}</span>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${plan.accent}10` }}>
                          <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                        </div>
                        <span className="text-[11px]" style={{ color: L.textSub }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.href}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-center block transition-all hover:scale-[1.02]"
                    style={plan.popular
                      ? { background: `linear-gradient(135deg, ${L.goldLight}, ${L.gold})`, color: "#fff" }
                      : { border: `1px solid ${plan.border}`, color: plan.accent, background: "transparent" }}>
                    {plan.popular ? "Start Free Trial" : plan.price === "₹0" ? "Get Started Free" : "Start Trial"}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-all hover:gap-3"
              style={{ color: L.gold }}>
              View full plan comparison & Enterprise pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── QUICK SERVICES ─── */}
      <section className="py-20 px-4" style={{ background: L.bg, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-black tracking-[0.35em] uppercase mb-10" style={{ color: L.textMuted }}>
            Most searched
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Building2, label: "Company Registration", href: "/services/compliance", color: "#059669" },
              { icon: FileText, label: "GST Registration", href: "/services/compliance", color: "#2563EB" },
              { icon: Briefcase, label: "Income Tax (ITR)", href: "/services/compliance", color: "#D97706" },
              { icon: BarChart3, label: "Detailed Project Report", href: "/services/dpr", color: "#DC2626" },
              { icon: Presentation, label: "Pitch Deck Design", href: "/services/pitch-decks", color: "#7C3AED" },
              { icon: GraduationCap, label: "Business Training", href: "/services/training", color: "#EA580C" },
              { icon: Users, label: "Hire a CA / CS", href: "/freelancers", color: "#4F46E5" },
              { icon: MapPin, label: "Coworking Space", href: "/coworking", color: "#B8903A" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}
                  className="flex items-center gap-3 p-3.5 rounded-xl border transition-all group hover:scale-[1.02] hover:-translate-y-0.5"
                  style={{ background: L.bgCard, borderColor: L.borderLight, boxShadow: L.shadow }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
                    <Icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs font-semibold leading-tight" style={{ color: L.textSub }}>{s.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-4" style={{ background: L.bgAlt, borderTop: `1px solid ${L.borderLight}` }}>
        <div className="container max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl p-12 overflow-hidden border"
            style={{ background: L.bgCard, borderColor: L.border, boxShadow: "0 20px 60px rgba(139,108,50,0.1), 0 4px 16px rgba(139,108,50,0.06)" }}>
            {/* Gold top line */}
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-3xl"
              style={{ background: `linear-gradient(90deg, ${L.goldLight}, ${L.gold}, ${L.goldDark})` }} />
            {/* Warm radial glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(184,144,58,0.05) 0%, transparent 60%)" }} />

            <p className="relative z-10 text-[10px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: L.gold }}>
              Ready to start?
            </p>
            <GoldDivider />
            <h2 className="relative z-10 font-black mb-4 leading-tight mt-4"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: L.text }}>
              Start your business journey today
            </h2>
            <p className="relative z-10 text-base mb-8 max-w-md mx-auto" style={{ color: L.textSub }}>
              Join founders, SMEs, and professionals building their business with FreWork.
            </p>
            <div className="relative z-10 flex flex-wrap gap-3 justify-center">
              <Link href="/register"
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03] hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${L.goldLight}, ${L.gold})`, color: "#fff", boxShadow: `0 4px 24px rgba(184,144,58,0.25)` }}>
                Get Started Free <ChevronRight className="w-4 h-4" />
              </Link>
              <a href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm border transition-all hover:scale-[1.03]"
                style={{ borderColor: L.border, color: L.textSub, background: L.bgAlt, boxShadow: L.shadow }}>
                <Phone className="w-4 h-4" style={{ color: L.gold }} /> {SUPPORT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="py-8 text-center text-xs border-t" style={{ color: L.textMuted, borderColor: L.borderLight, background: L.bg }}>
        FreWork is in Beta — growing and improving every day. Thank you for being an early supporter.
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
