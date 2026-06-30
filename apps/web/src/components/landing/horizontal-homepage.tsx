"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, TrendingUp, MapPin, Users, Briefcase, FileText,
  BarChart3, Presentation, Building2, GraduationCap, ArrowRight,
  Rocket, ChevronLeft, ChevronRight, Phone, Mail, Star,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";

const PANELS = ["Home", "FIND", "GROW", "LAUNCH", "Connect"];

export function HorizontalHomepage() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (!trackRef.current || isScrolling) return;
    setIsScrolling(true);
    const w = trackRef.current.clientWidth;
    trackRef.current.scrollTo({ left: idx * w, behavior: "smooth" });
    setActive(idx);
    setTimeout(() => setIsScrolling(false), 700);
  }, [isScrolling]);

  // Track scroll position → update active dot
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActive(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(Math.min(active + 1, PANELS.length - 1));
      if (e.key === "ArrowLeft") goTo(Math.max(active - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  // Wheel → horizontal
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 30) return;
      goTo(delta > 0 ? Math.min(active + 1, PANELS.length - 1) : Math.max(active - 1, 0));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [active, goTo]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060C18]">

      {/* Navbar — floats above everything */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* Horizontal track */}
      <div
        ref={trackRef}
        className="flex w-full h-full overflow-x-auto overflow-y-hidden"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`.hide-scroll::-webkit-scrollbar{display:none}`}</style>

        {/* ── PANEL 0: HERO ── */}
        <Panel>
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_15%_50%,rgba(59,130,246,0.09),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_85%_40%,rgba(201,168,76,0.07),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_60%_90%,rgba(139,92,246,0.07),transparent)]" />
          </div>

          <div className="relative z-10 flex h-full pt-20">

            {/* ── LEFT: headline ── */}
            <div className="flex flex-col justify-center px-10 md:px-16 w-full lg:w-[46%] shrink-0">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/4 text-white/35 text-[10px] font-semibold tracking-[0.25em] uppercase mb-8 w-fit">
                India&apos;s Professional Growth Platform
              </span>
              <h1 className="text-5xl md:text-6xl lg:text-[72px] font-bold leading-[1.04] mb-5"
                style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
                <span className="text-white">One platform.</span><br />
                <span className="bg-gradient-to-r from-blue-400 via-[#C9A84C] to-purple-400 bg-clip-text text-transparent">Three doors.</span>
              </h1>
              <p className="text-white/35 text-base max-w-sm mb-10 leading-relaxed">
                Find workspaces, freelancers &amp; jobs.<br />
                Grow with CA &amp; CS services.<br />
                Launch your startup to investors.
              </p>
              <div className="flex flex-wrap gap-3">
                {([
                  { label: "FIND", sub: "Spaces & Talent", color: "border-blue-500/30 text-blue-300 hover:bg-blue-500/10", idx: 1 },
                  { label: "GROW", sub: "Expert Services", color: "border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10", idx: 2 },
                  { label: "LAUNCH", sub: "Startups", color: "border-purple-500/30 text-purple-300 hover:bg-purple-500/10", idx: 3 },
                ] as const).map(d => (
                  <button key={d.label} onClick={() => goTo(d.idx)}
                    className={`px-4 py-2 rounded-full border text-xs font-semibold transition-all flex items-center gap-1.5 ${d.color}`}>
                    <span>{d.label}</span>
                    <span className="text-white/25">·</span>
                    <span className="text-white/40 font-normal">{d.sub}</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* ── RIGHT: bento infographic ── */}
            <div className="hidden lg:grid flex-1 grid-cols-3 grid-rows-2 gap-3 p-6 pt-24 pb-8 min-w-0">

              {/* FIND — spans 2 rows col 1 */}
              <button onClick={() => goTo(1)}
                className="row-span-2 relative rounded-3xl overflow-hidden group border border-blue-500/15 hover:border-blue-500/35 transition-all duration-500 text-left">
                <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&q=80"
                  alt="Coworking" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050A16]/95 via-[#050A16]/40 to-transparent" />
                <div className="absolute inset-0 bg-blue-900/20" />
                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/25 border border-blue-400/30 backdrop-blur-sm flex items-center justify-center">
                    <Search className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.3em] text-blue-400/70 uppercase mb-1">Door 1</div>
                    <div className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>FIND</div>
                    <p className="text-xs text-white/50 leading-relaxed mb-4">Coworking · Freelancers · Jobs</p>
                    <div className="flex flex-wrap gap-2">
                      {["500+ Spaces", "Verified Talent", "Live Jobs"].map(t => (
                        <span key={t} className="text-[9px] px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/25 text-blue-300 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>

              {/* GROW top */}
              <button onClick={() => goTo(2)}
                className="relative rounded-3xl overflow-hidden group border border-[#C9A84C]/15 hover:border-[#C9A84C]/40 transition-all duration-500 text-left">
                <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500&q=80"
                  alt="CA Services" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#100900]/95 via-[#100900]/50 to-transparent" />
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/25 border border-[#C9A84C]/30 backdrop-blur-sm flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold tracking-[0.3em] text-[#C9A84C]/60 uppercase mb-0.5">Door 2</div>
                    <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>GROW</div>
                    <p className="text-[11px] text-white/40 mt-0.5">CA · CS · Tax · Compliance</p>
                  </div>
                </div>
              </button>

              {/* LAUNCH top */}
              <button onClick={() => goTo(3)}
                className="relative rounded-3xl overflow-hidden group border border-purple-500/15 hover:border-purple-500/40 transition-all duration-500 text-left">
                <img src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=500&q=80"
                  alt="Startup" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0416]/95 via-[#0A0416]/50 to-transparent" />
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/25 border border-purple-400/30 backdrop-blur-sm flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-purple-300" />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold tracking-[0.3em] text-purple-400/60 uppercase mb-0.5">Door 3</div>
                    <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>LAUNCH</div>
                    <p className="text-[11px] text-white/40 mt-0.5">Startups · Investors · Partners</p>
                  </div>
                </div>
              </button>

              {/* Bottom middle: freelancers stat card */}
              <div className="relative rounded-3xl overflow-hidden group border border-blue-500/10 hover:border-blue-500/25 transition-all duration-500">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&q=80"
                  alt="Freelancer" className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050A16]/90 via-[#050A16]/30 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-xs font-semibold text-white/70">Hire verified freelancers</div>
                  <div className="text-[10px] text-white/35 mt-0.5">Teachers · Designers · CAs · Plumbers</div>
                </div>
              </div>

              {/* Bottom right: quick stat pill */}
              <div className="relative rounded-3xl border border-white/6 bg-white/2 p-5 flex flex-col justify-between overflow-hidden group hover:border-white/12 transition-all">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(201,168,76,0.08),transparent)]" />
                <div className="grid grid-cols-2 gap-3 relative z-10">
                  {[
                    { n: "500+", l: "Businesses", c: "text-[#C9A84C]" },
                    { n: "CA·CS", l: "Qualified", c: "text-blue-400" },
                    { n: "24hr", l: "Response", c: "text-emerald-400" },
                    { n: "₹999", l: "Starting", c: "text-purple-400" },
                  ].map(s => (
                    <div key={s.l} className="flex flex-col">
                      <span className={`text-xl font-bold ${s.c}`} style={{ fontFamily: "var(--font-cormorant), serif" }}>{s.n}</span>
                      <span className="text-[9px] text-white/30 uppercase tracking-widest">{s.l}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-white/20 mt-3 relative z-10 tracking-widest uppercase">India&apos;s all-in-one platform</div>
              </div>

            </div>
          </div>
          <ScrollHint onClick={() => goTo(1)} label="Explore FIND" />
        </Panel>

        {/* ── PANEL 1: FIND ── */}
        <Panel>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_30%_40%,rgba(59,130,246,0.12),transparent)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          <div className="relative z-10 flex flex-col justify-center h-full max-w-5xl mx-auto px-8 pt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <Search className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.3em] text-blue-400/50 uppercase">Door 1</p>
                <h2 className="text-5xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>FIND</h2>
              </div>
            </div>
            <p className="text-white/40 text-lg mb-10 max-w-md">Marketplace & community — search, browse and book anything you need to work and grow.</p>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: MapPin, title: "Coworking & Offices", desc: "Search, filter and book premium workspaces across India.", href: "/coworking", tag: "500+ spaces" },
                { icon: Users, title: "Freelancers", desc: "Browse skilled freelancers by expertise and hire in minutes.", href: "/freelancers", tag: "Verified talent" },
                { icon: Briefcase, title: "Jobs", desc: "Discover job vacancies and apply directly to growing companies.", href: "/jobs", tag: "Live listings" },
              ].map(c => (
                <Link key={c.title} href={c.href}
                  className="group relative rounded-2xl border border-blue-500/15 bg-blue-500/4 p-6 hover:border-blue-500/35 hover:bg-blue-500/8 transition-all overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/6 rounded-full blur-2xl" />
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mb-4">
                    <c.icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 mb-3 inline-block">{c.tag}</span>
                  <h3 className="font-semibold text-white mb-2">{c.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">{c.desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-blue-400 group-hover:gap-2 transition-all">Explore <ArrowRight className="w-3 h-3" /></span>
                </Link>
              ))}
            </div>
          </div>
          <ScrollHint onClick={() => goTo(2)} label="Next: GROW" />
        </Panel>

        {/* ── PANEL 2: GROW ── */}
        <Panel>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_70%_40%,rgba(201,168,76,0.10),transparent)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-transparent" />
          <div className="relative z-10 flex flex-col justify-center h-full max-w-5xl mx-auto px-8 pt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.3em] text-[#C9A84C]/50 uppercase">Door 2</p>
                <h2 className="text-5xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>GROW</h2>
              </div>
            </div>
            <p className="text-white/40 text-lg mb-10 max-w-md">CA & CS qualified experts handle your compliance, finances and growth — so you can focus on building.</p>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { icon: FileText, title: "Compliance & Tax", desc: "GST, Income Tax, ROC", href: "/services/compliance" },
                { icon: BarChart3, title: "DPR", desc: "Detailed Project Reports", href: "/services/dpr" },
                { icon: Presentation, title: "Pitch Decks", desc: "Investor-ready decks", href: "/services/pitch-decks" },
                { icon: Building2, title: "Restructuring", desc: "M&A & turnaround", href: "/services/restructuring" },
                { icon: GraduationCap, title: "Training", desc: "Workshops for teams", href: "/services/training" },
              ].map(s => (
                <Link key={s.title} href={s.href}
                  className="group rounded-2xl border border-[#C9A84C]/12 bg-[#C9A84C]/4 p-5 hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/8 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/20 flex items-center justify-center mb-3">
                    <s.icon className="w-4 h-4 text-[#C9A84C]" />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-white/35">{s.desc}</p>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Link href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-[#0B1120] transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>
                Get a free quote <ArrowRight className="w-4 h-4" />
              </Link>
              <span className="text-xs text-white/25">Free 30-min consultation · No commitment</span>
            </div>
          </div>
          <ScrollHint onClick={() => goTo(3)} label="Next: LAUNCH" />
        </Panel>

        {/* ── PANEL 3: LAUNCH ── */}
        <Panel>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_30%,rgba(139,92,246,0.12),transparent)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          <div className="relative z-10 flex flex-col justify-center h-full max-w-5xl mx-auto px-8 pt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                <Rocket className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.3em] text-purple-400/50 uppercase">Door 3</p>
                <h2 className="text-5xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>LAUNCH</h2>
              </div>
            </div>
            <p className="text-white/40 text-lg mb-10 max-w-md">Startup Launchpad — list your startup, pitch to investors, and get discovered by customers and partners across India.</p>

            <div className="grid md:grid-cols-2 gap-5">
              {/* For founders */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
                <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-purple-400" /> For Founders
                </h3>
                <p className="text-sm text-white/35 mb-5">List your startup free — pitch deck, founder video, traction, and funding ask all in one place.</p>
                <ul className="space-y-2.5 mb-6">
                  {["Pitch deck + founder video embed", "Funding ask & equity details", "Connect with investors directly", "CA-verified financials badge"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard/startup/submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors">
                  List your startup — Free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* For investors */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-6">
                <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#C9A84C]" /> For Investors & Partners
                </h3>
                <p className="text-sm text-white/35 mb-5">Browse India's upcoming startups — filter by sector, stage, city, and funding ask.</p>
                <ul className="space-y-2.5 mb-6">
                  {["Filter by sector, stage & city", "Watch 90-second founder pitches", "View pitch decks in-browser", "Direct connect via FreWork"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/startups"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/12 text-white/60 hover:text-white hover:border-white/25 text-sm font-semibold transition-colors">
                  Browse Launchpad <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
          <ScrollHint onClick={() => goTo(4)} label="Next: Connect" />
        </Panel>

        {/* ── PANEL 4: CONNECT / CTA ── */}
        <Panel>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(201,168,76,0.08),transparent)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8 pt-16">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/6 text-[#C9A84C] text-xs font-medium tracking-widest uppercase mb-8">
              Free Consultation
            </span>
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              Let&apos;s build something<br />
              <span className="text-[#C9A84C]">great together.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-lg mb-12">
              Talk to our CA & CS experts for free. No commitment. We'll tell you exactly what your business needs.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-14">
              <Link href="/contact"
                className="inline-flex items-center gap-2 px-9 py-4 rounded-xl font-semibold text-[#0B1120] transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>
                Book Free Consultation <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/startups"
                className="inline-flex items-center gap-2 px-9 py-4 rounded-xl font-semibold text-white border border-purple-500/25 hover:bg-purple-500/8 transition-colors">
                <Rocket className="w-4 h-4 text-purple-400" /> Explore Launchpad
              </Link>
            </div>

            {/* Contact info */}
            <div className="flex flex-wrap justify-center gap-8 text-sm text-white/30">
              <a href="tel:+918590874681" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4" /> +91 8590874681
              </a>
              <a href="mailto:contact.frework@gmail.com" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4" /> contact.frework@gmail.com
              </a>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Mumbai, India
              </span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Side nav dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {PANELS.map((name, i) => (
          <button key={name} onClick={() => goTo(i)} title={name}
            className="group relative flex items-center justify-end gap-2">
            <span className={`text-[10px] font-medium tracking-widest uppercase transition-all duration-300 ${active === i ? "opacity-60 translate-x-0" : "opacity-0 translate-x-2"} text-white`}>
              {name}
            </span>
            <span className={`block rounded-full transition-all duration-300 ${active === i
              ? "w-6 h-2 bg-[#C9A84C]"
              : "w-2 h-2 bg-white/20 group-hover:bg-white/40"}`} />
          </button>
        ))}
      </div>

      {/* Left/right arrows */}
      {active > 0 && (
        <button onClick={() => goTo(active - 1)}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {active < PANELS.length - 1 && (
        <button onClick={() => goTo(active + 1)}
          className="fixed right-14 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Panel counter */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-[10px] text-white/20 tracking-widest uppercase">
        {String(active + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="relative flex-shrink-0 w-screen h-screen overflow-hidden bg-[#060C18]"
      style={{ scrollSnapAlign: "start" }}
    >
      {children}
    </section>
  );
}

function ScrollHint({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 hover:text-white/50 transition-colors group">
      <span className="text-[10px] tracking-widest uppercase">{label}</span>
      <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent group-hover:from-white/50 transition-colors" />
      <ChevronRight className="w-4 h-4 rotate-90" />
    </button>
  );
}
