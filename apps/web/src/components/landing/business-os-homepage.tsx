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

const MODULES = [
  { id: "start", label: "START", tagline: "Register & Set Up", desc: "Company registration, GST, PAN, MSME — get legally started.", icon: Building2, color: "#10B981", href: "/services/compliance", badge: "Most Popular", items: ["Company Registration", "GST Registration", "PAN & TAN", "MSME / Udyam"] },
  { id: "comply", label: "COMPLY", tagline: "Stay Compliant", desc: "Income Tax, GST filing, ROC — never miss a deadline.", icon: FileText, color: "#3B82F6", href: "/services/compliance", badge: null, items: ["Income Tax (ITR)", "GST Filing", "ROC / MCA", "TDS Filing"] },
  { id: "finance", label: "FINANCE", tagline: "Manage Money", desc: "Invoicing, payroll, bookkeeping — keep finances clean.", icon: IndianRupee, color: "#8B5CF6", href: "/pricing", badge: "Coming Soon", items: ["Invoicing", "Payroll", "Bookkeeping", "Reports"] },
  { id: "professionals", label: "FIND PEOPLE", tagline: "Hire Talent", desc: "Verified CAs, developers, designers for your business.", icon: Users, color: "#F59E0B", href: "/freelancers", badge: "Launching Soon", items: ["CA / CS / Lawyers", "Developers", "Designers", "Consultants"] },
  { id: "grow", label: "GROW", tagline: "Scale Up", desc: "Business plans, DPRs, pitch decks — tools to scale.", icon: TrendingUp, color: "#F43F5E", href: "/services/dpr", badge: null, items: ["DPR", "Pitch Deck", "Business Plan", "Restructuring"] },
  { id: "workspace", label: "WORKSPACE", tagline: "Find Your Office", desc: "Premium coworking spaces across India.", icon: MapPin, color: "#F97316", href: "/coworking", badge: "Launching Soon", items: ["Coworking Desks", "Private Cabins", "Meeting Rooms", "Virtual Office"] },
  { id: "launch", label: "LAUNCH", tagline: "Raise Funding", desc: "List your startup, connect with investors.", icon: Rocket, color: "#6366F1", href: "/startups", badge: "Launching Soon", items: ["Startup Listing", "Investor Connect", "Pitch Events", "Mentorship"] },
  { id: "dashboard", label: "DASHBOARD", tagline: "Track Everything", desc: "Compliance calendar, documents, reminders — all in one.", icon: LayoutDashboard, color: "#C9A84C", href: "/dashboard", badge: "Early Access", items: ["Compliance Calendar", "Document Vault", "Renewals", "Status Tracker"] },
];

const TRUST_TICKER = ["Company Registration", "GST Filing", "Income Tax Returns", "Coworking Spaces", "Hire Professionals", "Pitch Decks", "Startup Funding", "Business Plans", "MSME Registration", "ROC Compliance"];

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
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#060C18", color: "rgba(255,255,255,0.9)" }}>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,168,76,0.18) 0%, transparent 60%)" }} />
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)" }} />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badges */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border backdrop-blur-sm"
              style={{ background: "rgba(201,168,76,0.1)", borderColor: "rgba(201,168,76,0.3)", color: "#C9A84C" }}>
              🇮🇳 Made in India
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border backdrop-blur-sm"
              style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)", color: "#34D399" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Beta · Early Access Open
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-black leading-[1.0] mb-6 tracking-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2.8rem, 8vw, 6rem)" }}>
            The Operating System<br />
            <span style={{ background: "linear-gradient(135deg, #F0D78A 0%, #C9A84C 50%, #A07830 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              for Indian Businesses
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed"
            style={{ color: "rgba(255,255,255,0.5)" }}>
            Start, Run and Grow Your Business — All in One Place.
          </motion.p>

          {/* Search */}
          <motion.form
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            onSubmit={handleSearch}
            className="flex gap-2 max-w-lg mx-auto mb-8 p-1.5 rounded-2xl border backdrop-blur-md"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="What does your business need today?"
                className="flex-1 bg-transparent outline-none text-sm py-2"
                style={{ color: "rgba(255,255,255,0.8)" }} />
            </div>
            <button type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)", color: "#060C18" }}>
              Search
            </button>
          </motion.form>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3 mb-16">
            <Link href="/register"
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)", color: "#060C18", boxShadow: "0 0 32px rgba(201,168,76,0.35)" }}>
              Get Started Free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20want%20to%20know%20more.`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.03] backdrop-blur-sm"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.04)" }}>
              <MessageCircle className="w-4 h-4 text-green-400" />
              Talk to an Expert
            </a>
          </motion.div>

          {/* Scrolling ticker */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="relative overflow-hidden">
            <div className="flex gap-6 animate-marquee whitespace-nowrap">
              {[...TRUST_TICKER, ...TRUST_TICKER].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-xs font-medium flex-shrink-0"
                  style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── COWORKING SPOTLIGHT ─── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-40 top-0 w-[700px] h-[700px] rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #F97316 0%, transparent 65%)", filter: "blur(60px)" }} />
          <div className="absolute -left-20 bottom-0 w-[400px] h-[400px] rounded-full opacity-8"
            style={{ background: "radial-gradient(circle, #F97316 0%, transparent 65%)", filter: "blur(80px)" }} />
        </div>

        <div className="container max-w-6xl mx-auto relative z-10">
          {/* Section label */}
          <div className="flex items-center gap-3 mb-12">
            <div className="h-px flex-1 max-w-[60px]" style={{ background: "rgba(249,115,22,0.4)" }} />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: "#FB923C" }}>Featured Module</span>
            <div className="h-px flex-1" style={{ background: "rgba(249,115,22,0.15)" }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase mb-6 border"
                style={{ background: "rgba(249,115,22,0.08)", borderColor: "rgba(249,115,22,0.25)", color: "#FB923C" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                Launching Soon
              </span>

              <h2 className="font-black leading-[1.05] mb-5"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>
                Your perfect office,<br />
                <span style={{ background: "linear-gradient(135deg, #FB923C, #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  wherever you work.
                </span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
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
                  <div key={f.l} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
                    style={{ background: "rgba(249,115,22,0.04)", borderColor: "rgba(249,115,22,0.12)" }}>
                    <span className="text-base">{f.e}</span>
                    <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{f.l}</span>
                  </div>
                ))}
              </div>

              {/* Cities */}
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: "rgba(249,115,22,0.5)" }}>Launching in</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"].map(city => (
                  <span key={city} className="px-3 py-1 rounded-full text-xs border"
                    style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    📍 {city}
                  </span>
                ))}
              </div>

              <div className="flex gap-3 flex-wrap">
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03]"
                  style={{ background: "linear-gradient(135deg, #FB923C, #EA6A10)", color: "#fff", boxShadow: "0 0 24px rgba(249,115,22,0.3)" }}>
                  Explore Spaces <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold border transition-all hover:scale-[1.03]"
                  style={{ borderColor: "rgba(249,115,22,0.25)", color: "#FB923C", background: "rgba(249,115,22,0.04)" }}>
                  List your space — Free
                </Link>
              </div>
            </motion.div>

            {/* Right — UI card */}
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="relative pt-6">
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(249,115,22,0.12) 0%, transparent 70%)", filter: "blur(20px)" }} />

              <div className="relative rounded-3xl overflow-hidden border"
                style={{ background: "linear-gradient(160deg, #120A00 0%, #0C0F1C 100%)", borderColor: "rgba(249,115,22,0.25)", boxShadow: "0 0 80px rgba(249,115,22,0.1), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

                {/* Top gold line */}
                <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, #F97316, transparent)" }} />

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border"
                      style={{ background: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.2)" }}>🏢</div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>FreWork Coworking</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Verified · Bangalore, Indiranagar</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    style={{ background: "rgba(16,185,129,0.1)", color: "#34D399", borderColor: "rgba(16,185,129,0.25)" }}>
                    <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                    Available
                  </span>
                </div>

                {/* Plans */}
                <div className="p-6">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Choose your plan</p>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { e: "💺", l: "Hot Desk", p: "₹350/day" },
                      { e: "🔒", l: "Private Cabin", p: "₹8,000/mo" },
                      { e: "📽️", l: "Meeting Room", p: "₹500/hr" },
                    ].map((opt, i) => (
                      <div key={opt.l} className={`rounded-2xl p-3 text-center border cursor-pointer transition-all ${i === 0 ? "border-orange-500/40 bg-orange-500/8" : "border-white/6 bg-white/3 hover:border-white/15"}`}>
                        <p className="text-xl mb-1.5">{opt.e}</p>
                        <p className="text-[10px] font-semibold mb-1" style={{ color: i === 0 ? "#FB923C" : "rgba(255,255,255,0.6)" }}>{opt.l}</p>
                        <p className="text-[10px] font-black" style={{ color: i === 0 ? "#F97316" : "rgba(255,255,255,0.4)" }}>{opt.p}</p>
                      </div>
                    ))}
                  </div>

                  {/* Amenity tags */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {["📶 WiFi", "☕ Café", "🅿️ Parking", "🖨️ Printer", "❄️ AC", "🔐 24/7"].map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-medium border"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.07)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <Link href="/coworking"
                    className="w-full py-3 rounded-2xl text-sm font-bold text-center block transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #FB923C, #F97316)", color: "#fff" }}>
                    Book a visit →
                  </Link>
                </div>
              </div>

              {/* Floating chip */}
              <div className="absolute -bottom-3 -left-3 px-4 py-2.5 rounded-xl border shadow-2xl backdrop-blur-sm"
                style={{ background: "rgba(6,12,24,0.95)", borderColor: "rgba(249,115,22,0.3)" }}>
                <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(249,115,22,0.8)" }}>Coming to 8 cities</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Link href="/coworking" style={{ color: "#FB923C" }}>Get notified</Link> when we launch near you
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 8 MODULES ─── */}
      <section className="py-24 px-4 relative" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(201,168,76,0.05) 0%, transparent 70%)" }} />

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-4" style={{ color: "rgba(201,168,76,0.6)" }}>8 Modules · One Platform</p>
            <h2 className="font-black mb-4 leading-tight"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 3rem)" }}>
              Everything your business needs
            </h2>
            <p className="text-base max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              From day one of registration to raising your Series A
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <div className="relative h-full rounded-2xl p-5 transition-all duration-300 cursor-pointer group"
                      style={{
                        background: isActive ? `${mod.color}0D` : "rgba(255,255,255,0.025)",
                        border: `1px solid ${isActive ? mod.color + "40" : "rgba(255,255,255,0.07)"}`,
                        boxShadow: isActive ? `0 0 40px ${mod.color}18, inset 0 1px 0 ${mod.color}15` : "none",
                      }}>
                      {/* Badge */}
                      {mod.badge && (
                        <span className="absolute top-3.5 right-3.5 text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${mod.color}18`, color: mod.color, border: `1px solid ${mod.color}30` }}>
                          {mod.badge}
                        </span>
                      )}

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                        style={{
                          background: isActive ? `${mod.color}20` : `${mod.color}12`,
                          border: `1px solid ${isActive ? mod.color + "50" : mod.color + "25"}`,
                          boxShadow: isActive ? `0 0 20px ${mod.color}30` : "none",
                        }}>
                        <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" style={{ color: mod.color }} />
                      </div>

                      <p className="text-[9px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: mod.color }}>
                        {mod.label}
                      </p>
                      <h3 className="font-bold text-sm mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>
                        {mod.tagline}
                      </h3>
                      <p className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {mod.desc}
                      </p>

                      <ul className="space-y-1.5">
                        {mod.items.map(item => (
                          <li key={item} className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: `${mod.color}18` }}>
                              <Check className="w-2 h-2" style={{ color: mod.color }} />
                            </div>
                            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center gap-1 mt-4 text-[11px] font-semibold transition-all duration-200"
                        style={{ color: isActive ? mod.color : "rgba(255,255,255,0.2)" }}>
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
      <section className="py-24 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-4" style={{ color: "rgba(201,168,76,0.6)" }}>How it works</p>
            <h2 className="font-black" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
              Simple as 1 — 2 — 3
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), rgba(201,168,76,0.3), transparent)" }} />

            {[
              { n: "01", t: "Tell us what you need", d: "Choose a service or describe your business challenge. Our experts understand Indian business inside-out." },
              { n: "02", t: "Get matched & supported", d: "We connect you with the right verified professional and track your service end-to-end via your dashboard." },
              { n: "03", t: "Run your business", d: "Stay on top of deadlines, documents, and renewals — all in one place. No more missed filings." },
            ].map((step, i) => (
              <motion.div key={step.n}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="text-center relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
                  style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", boxShadow: "0 0 30px rgba(201,168,76,0.1)" }}>
                  <span className="font-black text-2xl" style={{ color: "#C9A84C", fontFamily: "var(--font-cormorant), serif" }}>{step.n}</span>
                </div>
                <h3 className="font-bold mb-3 text-base" style={{ color: "rgba(255,255,255,0.9)" }}>{step.t}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>{step.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY FREWORK ─── */}
      <section className="py-24 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-4" style={{ color: "rgba(201,168,76,0.6)" }}>Why choose us</p>
            <h2 className="font-black" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
              Built for Indian business, <span style={{ color: "#C9A84C" }}>honestly</span>
            </h2>
            <p className="mt-3 text-sm max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.38)" }}>
              No fake metrics. No inflated claims. Just real tools for real businesses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Shield, c: "#10B981", t: "Verified professionals only", d: "Every CA, CS, and expert on FreWork is manually verified before going live. No stock-photo profiles." },
              { icon: Clock, c: "#3B82F6", t: "Never miss a deadline", d: "Built-in compliance calendar for GST, ITR, ROC, and TDS — with WhatsApp reminders before every due date." },
              { icon: Star, c: "#C9A84C", t: "Built for Indian business", d: "We understand Indian compliance, Indian languages, and the real challenges of SMEs and startups in India." },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.t}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl border relative overflow-hidden group"
                  style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle at 30% 50%, ${item.c}08 0%, transparent 70%)` }} />
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 relative"
                    style={{ background: `${item.c}12`, border: `1px solid ${item.c}25` }}>
                    <Icon className="w-5 h-5" style={{ color: item.c }} />
                  </div>
                  <h3 className="font-bold mb-2.5 text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{item.t}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>{item.d}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="py-24 px-4 relative" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 60%)" }} />

        <div className="container max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase mb-4" style={{ color: "rgba(201,168,76,0.6)" }}>Simple pricing</p>
            <h2 className="font-black mb-4" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
              Pay only for what you need
            </h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>Start free. Upgrade as you grow. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { name: "Free", icon: Zap, price: "₹0", per: "forever", tagline: "Just getting started", accent: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.02)", popular: false, features: ["Browse all listings", "1 active listing", "5 applications/mo", "Email support"], href: "/register" },
              { name: "Professional", icon: Rocket, price: "₹999", per: "/month", tagline: "Freelancers & CAs", accent: "#C9A84C", border: "rgba(201,168,76,0.4)", bg: "rgba(201,168,76,0.05)", popular: true, features: ["Unlimited listings", "Verified Badge", "GST Registration", "Monthly GST filing", "Income Tax (ITR)"], href: "/register?plan=professional" },
              { name: "Growth", icon: TrendingUp, price: "₹2,999", per: "/month", tagline: "SMEs & agencies", accent: "#60A5FA", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.03)", popular: false, features: ["5 team seats", "Bookkeeping", "ROC filing", "Client portal", "Revenue analytics"], href: "/register?plan=growth" },
              { name: "Business", icon: Building2, price: "₹4,999", per: "/month", tagline: "Established firms", accent: "#A78BFA", border: "rgba(139,92,246,0.2)", bg: "rgba(139,92,246,0.03)", popular: false, features: ["20 team seats", "Dedicated manager", "Internal audit", "Tax audit", "API access"], href: "/register?plan=business" },
            ].map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div key={plan.name}
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="relative flex flex-col rounded-2xl p-5 border transition-all duration-300"
                  style={{ background: plan.bg, borderColor: plan.border, boxShadow: plan.popular ? `0 0 40px rgba(201,168,76,0.12)` : "none" }}>
                  {plan.popular && (
                    <>
                      <div className="absolute inset-x-0 -top-px h-px" style={{ background: "linear-gradient(90deg, transparent, #C9A84C, transparent)" }} />
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-0.5 rounded-full text-[10px] font-black tracking-wide"
                          style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)", color: "#060C18" }}>
                          Most Popular
                        </span>
                      </div>
                    </>
                  )}

                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 mt-2"
                    style={{ background: `${plan.accent}15`, border: `1px solid ${plan.accent}25` }}>
                    <Icon className="w-4 h-4" style={{ color: plan.accent }} />
                  </div>

                  <p className="text-[9px] font-black tracking-[0.25em] uppercase mb-0.5" style={{ color: plan.accent }}>{plan.name}</p>
                  <p className="text-[11px] mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>{plan.tagline}</p>

                  <div className="flex items-end gap-1 mb-5">
                    <span className="text-3xl font-black" style={{ color: "rgba(255,255,255,0.95)", fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                      {plan.price}
                    </span>
                    <span className="text-xs pb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{plan.per}</span>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${plan.accent}15` }}>
                          <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                        </div>
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.href}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-center block transition-all hover:scale-[1.02]"
                    style={plan.popular
                      ? { background: "linear-gradient(135deg,#F0D78A,#C9A84C)", color: "#060C18" }
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
              style={{ color: "rgba(201,168,76,0.7)" }}>
              View full plan comparison & Enterprise pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── QUICK SERVICES ─── */}
      <section className="py-20 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="container max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-black tracking-[0.35em] uppercase mb-10" style={{ color: "rgba(255,255,255,0.2)" }}>
            Most searched
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Building2, label: "Company Registration", href: "/services/compliance", color: "#10B981" },
              { icon: FileText, label: "GST Registration", href: "/services/compliance", color: "#3B82F6" },
              { icon: Briefcase, label: "Income Tax (ITR)", href: "/services/compliance", color: "#F59E0B" },
              { icon: BarChart3, label: "Detailed Project Report", href: "/services/dpr", color: "#F43F5E" },
              { icon: Presentation, label: "Pitch Deck Design", href: "/services/pitch-decks", color: "#8B5CF6" },
              { icon: GraduationCap, label: "Business Training", href: "/services/training", color: "#F97316" },
              { icon: Users, label: "Hire a CA / CS", href: "/freelancers", color: "#6366F1" },
              { icon: MapPin, label: "Coworking Space", href: "/coworking", color: "#C9A84C" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}
                  className="flex items-center gap-3 p-3.5 rounded-xl border transition-all group hover:scale-[1.02]"
                  style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                    style={{ background: `${s.color}12`, border: `1px solid ${s.color}25` }}>
                    <Icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs font-medium leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="container max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl p-12 overflow-hidden border"
            style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)", boxShadow: "inset 0 1px 0 rgba(201,168,76,0.1)" }}>
            <div className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.12) 0%, transparent 60%)" }} />
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)" }} />

            <p className="relative z-10 text-[10px] font-black tracking-[0.3em] uppercase mb-4" style={{ color: "rgba(201,168,76,0.6)" }}>
              Ready to start?
            </p>
            <h2 className="relative z-10 font-black mb-4 leading-tight"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
              Start your business journey today
            </h2>
            <p className="relative z-10 text-base mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.42)" }}>
              Join founders, SMEs, and professionals building their business with FreWork.
            </p>
            <div className="relative z-10 flex flex-wrap gap-3 justify-center">
              <Link href="/register"
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)", color: "#060C18", boxShadow: "0 0 32px rgba(201,168,76,0.3)" }}>
                Get Started Free <ChevronRight className="w-4 h-4" />
              </Link>
              <a href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm border transition-all hover:scale-[1.03]"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.03)" }}>
                <Phone className="w-4 h-4" /> {SUPPORT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="pb-10 text-center text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
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
