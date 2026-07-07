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
  {
    id: "start",
    label: "START",
    tagline: "Register & Set Up",
    desc: "Company registration, GST, PAN, MSME, Shop License — get your business legally started.",
    icon: Building2,
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
    href: "/services/compliance",
    items: ["Company Registration (Pvt Ltd / LLP / OPC)", "GST Registration", "PAN & TAN", "MSME / Udyam", "Shop & Establishment License"],
    badge: "Most Popular",
  },
  {
    id: "comply",
    label: "COMPLY",
    tagline: "Stay Compliant",
    desc: "Income Tax, GST filing, ROC compliance, accounts maintenance — never miss a deadline.",
    icon: FileText,
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.25)",
    href: "/services/compliance",
    items: ["Income Tax Return (ITR)", "GST Filing (GSTR-1, 3B)", "ROC / MCA Compliance", "Accounts Maintenance", "TDS Filing"],
    badge: null,
  },
  {
    id: "finance",
    label: "FINANCE",
    tagline: "Manage Money",
    desc: "Invoicing, payroll, bookkeeping, and business banking — keep your finances clean.",
    icon: IndianRupee,
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.25)",
    href: "/pricing",
    items: ["Professional Invoicing", "Payroll Processing", "Bookkeeping", "Financial Reports", "Business Banking Assist"],
    badge: "Coming Soon",
  },
  {
    id: "professionals",
    label: "FIND PEOPLE",
    tagline: "Hire Verified Talent",
    desc: "CAs, lawyers, developers, designers — hire verified professionals for your business needs.",
    icon: Users,
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    href: "/freelancers",
    items: ["CA / CS / Lawyers", "Web & App Developers", "Designers & Creatives", "Marketing Professionals", "Business Consultants"],
    badge: "Launching Soon",
  },
  {
    id: "grow",
    label: "GROW",
    tagline: "Scale Your Business",
    desc: "Business plans, DPRs, pitch decks, and restructuring — get the tools to scale.",
    icon: TrendingUp,
    color: "#F43F5E",
    bg: "rgba(244,63,94,0.08)",
    border: "rgba(244,63,94,0.25)",
    href: "/services/dpr",
    items: ["Detailed Project Report (DPR)", "Pitch Deck Design", "Business Plan Writing", "Business Restructuring", "Team Training"],
    badge: null,
  },
  {
    id: "workspace",
    label: "WORKSPACE",
    tagline: "Find Your Office",
    desc: "Premium coworking spaces, private offices, and meeting rooms across India.",
    icon: MapPin,
    color: "#F97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.25)",
    href: "/coworking",
    items: ["Coworking Desks", "Private Cabins", "Meeting Rooms by Hour", "Virtual Office Address", "Day Passes"],
    badge: "Launching Soon",
  },
  {
    id: "launch",
    label: "LAUNCH",
    tagline: "Raise Funding",
    desc: "List your startup, connect with investors, and access funding opportunities across India.",
    icon: Rocket,
    color: "#6366F1",
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.25)",
    href: "/startups",
    items: ["Startup Profile Listing", "Investor Connect", "Fundraising Tools", "Pitch Events", "Mentorship"],
    badge: "Launching Soon",
  },
  {
    id: "dashboard",
    label: "DASHBOARD",
    tagline: "Track Everything",
    desc: "Your central hub — compliance calendar, document vault, renewal reminders, team overview.",
    icon: LayoutDashboard,
    color: "#C9A84C",
    bg: "rgba(201,168,76,0.08)",
    border: "rgba(201,168,76,0.25)",
    href: "/dashboard",
    items: ["Compliance Calendar", "Document Vault", "Service Status Tracker", "Team Overview", "Renewal Reminders"],
    badge: "Early Access",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell us what you need", desc: "Choose a service or describe your business challenge. Our experts understand Indian business needs." },
  { step: "02", title: "Get matched & supported", desc: "We connect you with the right professional — CA, CS, lawyer, or consultant — and track your service end-to-end." },
  { step: "03", title: "Run your business", desc: "Use your FreWork dashboard to stay on top of compliance deadlines, documents, and next steps — all in one place." },
];

const WHY_FREWORK = [
  { icon: Shield, title: "Verified professionals only", desc: "Every CA, CS, and expert on FreWork is manually verified before going live. No fake profiles." },
  { icon: Clock, title: "Never miss a deadline", desc: "Built-in compliance calendar for GST, ITR, ROC, and TDS — with WhatsApp reminders." },
  { icon: Star, title: "Built for Indian business", desc: "We understand Indian compliance, Indian languages, and the real challenges of Indian SMEs and startups." },
];

export function BusinessOSHomepage() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes("gst") || q.includes("tax") || q.includes("itr") || q.includes("comply") || q.includes("register")) {
      window.location.href = "/services/compliance";
    } else if (q.includes("freelanc") || q.includes("ca ") || q.includes("developer") || q.includes("design")) {
      window.location.href = "/freelancers";
    } else if (q.includes("cowork") || q.includes("office") || q.includes("space")) {
      window.location.href = "/coworking";
    } else if (q.includes("startup") || q.includes("invest") || q.includes("funding")) {
      window.location.href = "/startups";
    } else if (q.includes("pitch") || q.includes("dpr") || q.includes("plan")) {
      window.location.href = "/services/dpr";
    } else {
      window.location.href = "/contact";
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#060C18", color: "rgba(255,255,255,0.9)" }}>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 px-4">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)", filter: "blur(80px)" }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)", filter: "blur(80px)" }} />
        </div>

        <div className="container relative z-10 max-w-5xl mx-auto text-center">
          {/* Badges */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border"
              style={{ background: "rgba(201,168,76,0.12)", borderColor: "rgba(201,168,76,0.3)", color: "#C9A84C" }}>
              🇮🇳 Made in India
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border"
              style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#34D399" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Beta — Early Access Open
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6 tracking-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}
          >
            The Operating System
            <br />
            <span style={{ color: "#C9A84C" }}>for Indian Businesses</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="text-lg md:text-xl mb-10 max-w-2xl mx-auto"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Start, Run and Grow Your Business — All in One Place.
            <br className="hidden md:block" /> Company registration to funding — we cover it all.
          </motion.p>

          {/* Search bar */}
          <motion.form
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            onSubmit={handleSearch}
            className="flex gap-3 max-w-xl mx-auto mb-10"
          >
            <div className="flex-1 flex items-center gap-3 px-4 h-14 rounded-2xl border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="What does your business need? (e.g. GST registration)"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-poppins), sans-serif" }}
              />
            </div>
            <button type="submit"
              className="h-14 px-6 rounded-2xl text-sm font-bold flex-shrink-0 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)", color: "#060C18" }}>
              Search
            </button>
          </motion.form>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <Link href="/register"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)", color: "#060C18" }}>
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
            <a href={`https://wa.me/${SUPPORT_WA}?text=Hi%20FreWork%2C%20I%20want%20to%20know%20more%20about%20your%20services.`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold border transition-all"
              style={{ borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.8)" }}>
              <MessageCircle className="w-4 h-4 text-green-400" />
              Talk to an Expert
            </a>
          </motion.div>
        </div>
      </section>

      {/* Modules — The OS grid */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(201,168,76,0.7)" }}>
              8 Modules. One Platform.
            </p>
            <h2 className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Everything your business needs
            </h2>
            <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
              From day one of registration to raising your Series A — FreWork has you covered at every stage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  onMouseEnter={() => setActiveModule(mod.id)}
                  onMouseLeave={() => setActiveModule(null)}
                  className="relative group"
                >
                  <Link href={mod.href}>
                    <div className="relative h-full rounded-2xl border p-5 transition-all duration-300 cursor-pointer"
                      style={{
                        background: isActive ? mod.bg : "rgba(255,255,255,0.03)",
                        borderColor: isActive ? mod.border : "rgba(255,255,255,0.08)",
                        boxShadow: isActive ? `0 0 40px ${mod.color}20` : "none",
                      }}>
                      {/* Badge */}
                      {mod.badge && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: mod.bg, color: mod.color, border: `1px solid ${mod.border}` }}>
                          {mod.badge}
                        </span>
                      )}

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                        style={{ background: mod.bg, border: `1px solid ${mod.border}` }}>
                        <Icon className="w-5 h-5" style={{ color: mod.color }} />
                      </div>

                      {/* Text */}
                      <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: mod.color }}>
                        {mod.label}
                      </p>
                      <h3 className="font-bold text-sm mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>
                        {mod.tagline}
                      </h3>
                      <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {mod.desc}
                      </p>

                      {/* Item list */}
                      <ul className="space-y-1.5">
                        {mod.items.slice(0, 3).map(item => (
                          <li key={item} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                            <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: mod.color }} />
                            {item}
                          </li>
                        ))}
                      </ul>

                      {/* Arrow */}
                      <div className="flex items-center gap-1 mt-4 text-xs font-semibold transition-all"
                        style={{ color: isActive ? mod.color : "rgba(255,255,255,0.3)" }}>
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

      {/* How it works */}
      <section className="py-20 px-4" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(201,168,76,0.7)" }}>How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Simple as 1 — 2 — 3
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={step.step}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl font-black"
                  style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", fontFamily: "var(--font-cormorant), serif" }}>
                  {step.step}
                </div>
                <h3 className="font-bold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why FreWork */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(201,168,76,0.7)" }}>Why choose us</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Built for Indian business, <span style={{ color: "#C9A84C" }}>honestly</span>
            </h2>
            <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              We&apos;re a young team building something we genuinely believe India needs. No fake metrics, no inflated claims.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY_FREWORK.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl border"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <Icon className="w-5 h-5" style={{ color: "#C9A84C" }} />
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(201,168,76,0.7)" }}>Simple pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Pay only for what you need
            </h2>
            <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Start free. Upgrade as your business grows. Cancel anytime — no lock-in.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                name: "Free",
                icon: Zap,
                price: "₹0",
                per: "forever",
                tagline: "Just getting started",
                color: "rgba(255,255,255,0.06)",
                border: "rgba(255,255,255,0.1)",
                accent: "rgba(255,255,255,0.5)",
                features: ["Browse all listings", "1 active listing", "5 job applications/mo", "Email support"],
                cta: "Get Started",
                ctaHref: "/register",
                popular: false,
              },
              {
                name: "Professional",
                icon: Rocket,
                price: "₹999",
                per: "/month",
                tagline: "For freelancers & CAs",
                color: "rgba(201,168,76,0.06)",
                border: "rgba(201,168,76,0.4)",
                accent: "#C9A84C",
                features: ["Unlimited listings", "Verified Badge", "GST Registration (one-time)", "Monthly GST filing", "Income Tax Return (ITR)", "24/7 chat support"],
                cta: "Start Free Trial",
                ctaHref: "/register?plan=professional",
                popular: true,
              },
              {
                name: "Growth",
                icon: TrendingUp,
                price: "₹2,999",
                per: "/month",
                tagline: "For SMEs & agencies",
                color: "rgba(59,130,246,0.05)",
                border: "rgba(59,130,246,0.25)",
                accent: "#60A5FA",
                features: ["5 team seats", "Monthly bookkeeping", "ROC annual filing", "MSME registration", "Revenue analytics", "Client portal"],
                cta: "Start Trial",
                ctaHref: "/register?plan=growth",
                popular: false,
              },
              {
                name: "Business",
                icon: Building2,
                price: "₹4,999",
                per: "/month",
                tagline: "For established firms",
                color: "rgba(139,92,246,0.05)",
                border: "rgba(139,92,246,0.25)",
                accent: "#A78BFA",
                features: ["20 team seats", "Dedicated manager", "Internal & annual audit", "Tax audit (Form 3CA/3CB)", "DPR & CMA data", "API access"],
                cta: "Start Trial",
                ctaHref: "/register?plan=business",
                popular: false,
              },
            ].map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div key={plan.name}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="relative flex flex-col rounded-2xl border p-5"
                  style={{ background: plan.color, borderColor: plan.border }}>
                  {plan.popular && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                      <div className="px-3 py-1 rounded-b-xl text-[10px] font-black tracking-widest uppercase"
                        style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)", color: "#060C18" }}>
                        Most Popular
                      </div>
                    </div>
                  )}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 mt-2"
                    style={{ background: `${plan.accent}18`, border: `1px solid ${plan.accent}30` }}>
                    <Icon className="w-4 h-4" style={{ color: plan.accent }} />
                  </div>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: plan.accent }}>
                    {plan.name}
                  </p>
                  <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{plan.tagline}</p>
                  <div className="flex items-end gap-1 mb-5">
                    <span className="text-3xl font-black" style={{ color: "rgba(255,255,255,0.95)", fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                      {plan.price}
                    </span>
                    <span className="text-xs pb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{plan.per}</span>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${plan.accent}18` }}>
                          <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                        </div>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.ctaHref}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-center transition-all block"
                    style={plan.popular
                      ? { background: "linear-gradient(135deg,#F0D78A,#C9A84C)", color: "#060C18" }
                      : { border: `1px solid ${plan.border}`, color: plan.accent }}>
                    {plan.cta}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-all"
              style={{ color: "rgba(201,168,76,0.8)" }}>
              See full plan comparison & Enterprise pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Coworking Feature */}
      <section className="py-20 px-4 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #F97316 0%, transparent 70%)", filter: "blur(80px)" }} />
        </div>

        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.25em] uppercase mb-6 border"
                style={{ background: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.3)", color: "#FB923C" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                Launching Soon · Coworking Spaces
              </span>

              <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-5"
                style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                Your perfect office,<br />
                <span style={{ color: "#F97316" }}>wherever you work.</span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
                Day desk or private cabin, by the hour or by the month — FreWork is onboarding
                verified coworking spaces across India. No fake listings. Every space personally checked.
              </p>

              {/* Feature list */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { icon: "📶", label: "High-speed WiFi", desc: "Fibre in every space" },
                  { icon: "☕", label: "Café & Cafeteria", desc: "Coffee & meals on-site" },
                  { icon: "🚗", label: "Parking", desc: "Two-wheeler & car" },
                  { icon: "🏛️", label: "Meeting Rooms", desc: "Book by the hour" },
                  { icon: "🕐", label: "Flexible Plans", desc: "Day · Monthly · Annual" },
                  { icon: "✅", label: "Verified Only", desc: "Every space checked" },
                ].map(f => (
                  <div key={f.label} className="flex items-start gap-3 p-3 rounded-xl border"
                    style={{ background: "rgba(249,115,22,0.05)", borderColor: "rgba(249,115,22,0.15)" }}>
                    <span className="text-lg leading-none">{f.icon}</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>{f.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* City pills */}
              <div className="mb-8">
                <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(249,115,22,0.6)" }}>
                  Launching in these cities
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Mumbai", "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"].map(city => (
                    <span key={city}
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                      📍 {city}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #FB923C, #F97316)", color: "#fff" }}>
                  Explore Spaces <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/coworking"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold border transition-all"
                  style={{ borderColor: "rgba(249,115,22,0.3)", color: "#FB923C" }}>
                  List your space free
                </Link>
              </div>
            </motion.div>

            {/* Right — visual cards */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="relative">

              {/* Main space card */}
              <div className="rounded-3xl border overflow-hidden"
                style={{ background: "linear-gradient(160deg, #0F0A00 0%, #0A0E18 100%)", borderColor: "rgba(249,115,22,0.3)", boxShadow: "0 0 60px rgba(249,115,22,0.12), 0 24px 48px rgba(0,0,0,0.5)" }}>

                {/* Top bar */}
                <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)" }}>
                      🏢
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>FreWork Coworking</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Verified space · Bangalore</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
                    Available
                  </span>
                </div>

                {/* Amenities */}
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { emoji: "💺", label: "Hot Desk", price: "₹350/day" },
                      { emoji: "🔒", label: "Private Cabin", price: "₹8,000/mo" },
                      { emoji: "📽️", label: "Meeting Room", price: "₹500/hr" },
                    ].map(opt => (
                      <div key={opt.label} className="rounded-2xl p-3 text-center border"
                        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                        <p className="text-2xl mb-1">{opt.emoji}</p>
                        <p className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{opt.label}</p>
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: "#F97316" }}>{opt.price}</p>
                      </div>
                    ))}
                  </div>

                  {/* Perks row */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {["📶 WiFi", "☕ Café", "🅿️ Parking", "🖨️ Printer", "❄️ AC", "🔐 24/7 Access"].map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
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

              {/* Floating stat chip */}
              <div className="absolute -bottom-4 -left-4 px-4 py-3 rounded-2xl border shadow-xl"
                style={{ background: "#070D1A", borderColor: "rgba(249,115,22,0.3)" }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "rgba(249,115,22,0.7)" }}>
                  Coming to 8 cities
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Be first in your city →&nbsp;
                  <Link href="/coworking" className="underline" style={{ color: "#FB923C" }}>Notify me</Link>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services quick links */}
      <section className="py-16 px-4" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Most requested services
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Building2, label: "Company Registration", href: "/services/compliance", color: "#10B981" },
              { icon: FileText, label: "GST Registration", href: "/services/compliance", color: "#3B82F6" },
              { icon: Briefcase, label: "Income Tax (ITR)", href: "/services/compliance", color: "#F59E0B" },
              { icon: BarChart3, label: "Detailed Project Report", href: "/services/dpr", color: "#F43F5E" },
              { icon: Presentation, label: "Pitch Deck Design", href: "/services/pitch-decks", color: "#8B5CF6" },
              { icon: GraduationCap, label: "Business Training", href: "/services/training", color: "#F97316" },
              { icon: Users, label: "Hire a CA / CS", href: "/freelancers", color: "#6366F1" },
              { icon: MapPin, label: "Find Coworking Space", href: "/coworking", color: "#C9A84C" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.href}
                  className="flex items-center gap-3 p-4 rounded-xl border transition-all group"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                    <Icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs font-medium leading-tight" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-12 relative overflow-hidden"
            style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 50% 0%, rgba(201,168,76,0.15) 0%, transparent 60%)" }} />
            <h2 className="relative z-10 text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Ready to start your business journey?
            </h2>
            <p className="relative z-10 text-base mb-8 max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
              Join founders, SMEs, and professionals already using FreWork to run their businesses better.
            </p>
            <div className="relative z-10 flex flex-wrap gap-4 justify-center">
              <Link href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C)", color: "#060C18" }}>
                Get Started Free <ChevronRight className="w-4 h-4" />
              </Link>
              <a href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm border transition-all"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}>
                <Phone className="w-4 h-4" /> Call us: {SUPPORT_PHONE}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer note */}
      <div className="pb-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
        FreWork is in Beta. We&apos;re growing and improving every day. Thank you for being an early supporter.
      </div>
    </div>
  );
}
