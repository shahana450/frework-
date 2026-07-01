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
  const [hoveredDoor, setHoveredDoor] = useState<number | null>(null);

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
          {/* ambient bg */}
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute inset-0 transition-all duration-700 ${hoveredDoor === 0 ? "opacity-100" : "opacity-30"} bg-[radial-gradient(ellipse_60%_80%_at_20%_50%,rgba(59,130,246,0.15),transparent)]`} />
            <div className={`absolute inset-0 transition-all duration-700 ${hoveredDoor === 1 ? "opacity-100" : "opacity-30"} bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(201,168,76,0.12),transparent)]`} />
            <div className={`absolute inset-0 transition-all duration-700 ${hoveredDoor === 2 ? "opacity-100" : "opacity-30"} bg-[radial-gradient(ellipse_60%_80%_at_80%_50%,rgba(139,92,246,0.15),transparent)]`} />
          </div>

          <div className="relative z-10 h-full flex flex-col pt-[68px]">

            {/* top headline strip */}
            <div className="text-center pt-5 pb-3 px-4">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/8 bg-white/3 text-white/30 text-[10px] font-semibold tracking-[0.25em] uppercase mb-3">
                India&apos;s Professional Growth Platform
              </span>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight"
                style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
                <span className="text-white">One platform. </span>
                <span className="bg-gradient-to-r from-blue-400 via-[#C9A84C] to-purple-400 bg-clip-text text-transparent">Three doors.</span>
              </h1>
              <p className="text-white/35 text-xs md:text-sm mt-1.5 max-w-lg mx-auto">
                Spaces &amp; Talent &nbsp;·&nbsp; CA &amp; CS Services &nbsp;·&nbsp; Startup Launchpad
              </p>
            </div>

            {/* ── MOBILE: vertical cards ── */}
            <div className="lg:hidden flex-1 flex flex-col gap-3 px-4 pb-16 overflow-y-auto">
              {[
                { navIdx: 1, img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80", label: "FIND", sub: "Coworking · Teachers · Skilled Workers · Jobs", tint: "rgba(30,64,175,0.5)", accent: "#60a5fa", accentBg: "rgba(59,130,246,0.22)", accentBorder: "rgba(96,165,250,0.4)", glow: "rgba(59,130,246,0.3)", Icon: Search,
                  items: ["Coworking Spaces — 500+ offices", "Teachers & Tutors — CBSE · JEE · Music", "Skilled Workers — Electrician · Plumber · Cook", "Jobs & Freelancers — Verified talent"] },
                { navIdx: 2, img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80", label: "GROW", sub: "CA · CS · Tax · Compliance · DPR", tint: "rgba(120,83,10,0.5)", accent: "#fbbf24", accentBg: "rgba(201,168,76,0.22)", accentBorder: "rgba(251,191,36,0.4)", glow: "rgba(201,168,76,0.3)", Icon: TrendingUp,
                  items: ["GST & Income Tax — Returns & audits", "DPR & Projections — Project reports", "Pitch Decks — Investor-ready decks", "Business Restructuring — M&A & strategy"] },
                { navIdx: 3, img: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&q=80", label: "LAUNCH", sub: "Startups · Investors · Partners", tint: "rgba(76,29,149,0.5)", accent: "#a78bfa", accentBg: "rgba(139,92,246,0.22)", accentBorder: "rgba(167,139,250,0.4)", glow: "rgba(139,92,246,0.3)", Icon: Rocket,
                  items: ["List Your Startup — Free listing", "Browse Startups — Discover ventures", "Connect with Investors — Angels & VCs", "CA-Verified Financials — Build trust"] },
              ].map((door, i) => (
                <div key={i} onClick={() => goTo(door.navIdx)}
                  className="relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0"
                  style={{ border: `1.5px solid ${door.accentBorder}`, boxShadow: `0 4px 24px ${door.glow}`, minHeight: "160px" }}>
                  <img src={door.img} alt={door.label} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: door.tint, mixBlendMode: "multiply" }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(4,6,18,0.97) 0%, rgba(4,6,18,0.7) 55%, rgba(4,6,18,0.2) 100%)" }} />

                  <div className="relative z-10 flex items-center gap-4 p-4">
                    {/* left: icon + title */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0 w-16">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: door.accentBg, border: `1.5px solid ${door.accentBorder}`, boxShadow: `0 0 16px ${door.glow}` }}>
                        <door.Icon className="w-5 h-5" style={{ color: door.accent }} />
                      </div>
                      <span className="text-xl font-black text-white leading-none text-center" style={{ fontFamily: "var(--font-cormorant), serif", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{door.label}</span>
                    </div>
                    {/* right: items */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold mb-2" style={{ color: door.accent }}>{door.sub}</p>
                      <div className="grid grid-cols-1 gap-1">
                        {door.items.slice(0, 3).map((item, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-[11px] text-white/70">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: door.accent }} />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: door.accentBg, border: `1px solid ${door.accentBorder}` }}>
                      <ArrowRight className="w-4 h-4" style={{ color: door.accent }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DESKTOP: expanding horizontal cards ── */}
            <div className="hidden lg:flex flex-1 gap-3 px-5 pb-14 min-h-0">

              {[
                {
                  idx: 0, navIdx: 1,
                  img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=85",
                  label: "FIND", sub: "Spaces · Talent · Jobs",
                  desc: "Everything you need to work, hire & grow.",
                  tint: ["rgba(30,64,175,0.55)", "rgba(37,99,235,0.18)", "rgba(59,130,246,0.08)"],
                  accent: "#60a5fa", accentDim: "rgba(96,165,250,0.7)", accentBg: "rgba(59,130,246,0.22)", accentBorder: "rgba(96,165,250,0.4)",
                  glowColor: "rgba(59,130,246,0.35)", borderActive: "rgba(96,165,250,0.6)", borderIdle: "rgba(59,130,246,0.25)",
                  Icon: Search,
                  rows: [
                    { img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&q=70", label: "Coworking Spaces", sub: "500+ premium offices", dot: "#3b82f6" },
                    { img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=200&q=70", label: "Teachers & Tutors", sub: "CBSE · IELTS · JEE · Music", dot: "#10b981" },
                    { img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200&q=70", label: "Skilled Workers", sub: "Electrician · Plumber · Cook · Tailor", dot: "#f59e0b" },
                    { img: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=200&q=70", label: "Jobs & Freelancers", sub: "Verified talent · Hire in minutes", dot: "#60a5fa" },
                  ],
                },
                {
                  idx: 1, navIdx: 2,
                  img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&q=85",
                  label: "GROW", sub: "CA · CS · Tax · Compliance",
                  desc: "CA & CS qualified experts for your business.",
                  tint: ["rgba(120,83,10,0.55)", "rgba(161,110,14,0.18)", "rgba(201,168,76,0.08)"],
                  accent: "#fbbf24", accentDim: "rgba(251,191,36,0.75)", accentBg: "rgba(201,168,76,0.22)", accentBorder: "rgba(251,191,36,0.4)",
                  glowColor: "rgba(201,168,76,0.32)", borderActive: "rgba(251,191,36,0.6)", borderIdle: "rgba(201,168,76,0.28)",
                  Icon: TrendingUp,
                  rows: [
                    { Icon: FileText, label: "GST & Income Tax", sub: "Returns, audits & planning" },
                    { Icon: BarChart3, label: "DPR & Projections", sub: "Detailed project reports" },
                    { Icon: Presentation, label: "Pitch Decks", sub: "Investor-ready presentations" },
                    { Icon: Building2, label: "Business Restructuring", sub: "M&A, strategy & turnaround" },
                  ],
                },
                {
                  idx: 2, navIdx: 3,
                  img: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=900&q=85",
                  label: "LAUNCH", sub: "Startups · Investors · Partners",
                  desc: "List your startup. Get discovered. Pitch to investors.",
                  tint: ["rgba(76,29,149,0.55)", "rgba(109,40,217,0.18)", "rgba(139,92,246,0.08)"],
                  accent: "#a78bfa", accentDim: "rgba(167,139,250,0.75)", accentBg: "rgba(139,92,246,0.22)", accentBorder: "rgba(167,139,250,0.4)",
                  glowColor: "rgba(139,92,246,0.35)", borderActive: "rgba(167,139,250,0.6)", borderIdle: "rgba(139,92,246,0.25)",
                  Icon: Rocket,
                  rows: [
                    { label: "List Your Startup — Free", sub: "Pitch deck + video + funding ask", highlight: true },
                    { label: "Browse Startups", sub: "Discover India's upcoming ventures" },
                    { label: "Connect with Investors", sub: "Angels, VCs and strategic partners" },
                    { label: "CA-Verified Financials", sub: "Build trust with verified numbers" },
                  ],
                },
              ].map((door) => {
                const isActive = hoveredDoor === door.idx;
                return (
                  <div key={door.idx}
                    onMouseEnter={() => setHoveredDoor(door.idx)}
                    onMouseLeave={() => setHoveredDoor(null)}
                    onClick={() => goTo(door.navIdx)}
                    className="relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500"
                    style={{
                      flex: isActive ? "3" : "1",
                      border: `1.5px solid ${isActive ? door.borderActive : door.borderIdle}`,
                      boxShadow: isActive ? `0 0 70px ${door.glowColor}, 0 8px 32px rgba(0,0,0,0.5)` : "0 4px 20px rgba(0,0,0,0.35)",
                    }}>

                    {/* image */}
                    <img src={door.img} alt={door.label}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
                      style={{ transform: isActive ? "scale(1.07)" : "scale(1.02)" }} />

                    {/* colour tint wash — much lighter than before */}
                    <div className="absolute inset-0" style={{ background: door.tint[0], mixBlendMode: "multiply" }} />
                    {/* gradient only at bottom for text legibility */}
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(4,6,18,0.97) 0%, rgba(4,6,18,0.65) 38%, rgba(4,6,18,0.1) 65%, transparent 100%)` }} />
                    {/* active glow pulse from bottom */}
                    {isActive && <div className="absolute inset-0 transition-opacity duration-500" style={{ background: `radial-gradient(ellipse 120% 50% at 50% 110%, ${door.glowColor}, transparent)` }} />}

                    <div className="absolute inset-0 flex flex-col justify-between p-5 pb-6">

                      {/* top badge + icon */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-3 py-1.5 rounded-full font-extrabold tracking-[0.2em] uppercase"
                          style={{ background: door.accentBg, border: `1px solid ${door.accentBorder}`, color: door.accent, backdropFilter: "blur(10px)" }}>
                          {door.label}
                        </span>
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300"
                          style={{ background: door.accentBg, border: `1px solid ${door.accentBorder}`, backdropFilter: "blur(10px)", boxShadow: isActive ? `0 0 28px ${door.glowColor}` : "none" }}>
                          <door.Icon className="w-5 h-5" style={{ color: door.accent }} />
                        </div>
                      </div>

                      {/* bottom text + rows */}
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.28em] uppercase mb-1.5" style={{ color: door.accentDim }}>Door {door.idx + 1}</p>
                        <h3 className="font-black text-white leading-none mb-2 transition-all duration-300"
                          style={{ fontFamily: "var(--font-cormorant), serif", fontSize: isActive ? "3rem" : "2.2rem", textShadow: "0 2px 20px rgba(0,0,0,0.9)" }}>
                          {door.label}
                        </h3>
                        <p className="text-sm font-semibold mb-4 leading-snug"
                          style={{ color: door.accentDim, textShadow: "0 1px 10px rgba(0,0,0,1)" }}>
                          {isActive ? door.desc : door.sub}
                        </p>

                        {/* expanded rows */}
                        {isActive && (
                          <div className="space-y-2">
                            {"rows" in door && (door.rows as any[]).map((r: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:scale-[1.015]"
                                style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.13)", backdropFilter: "blur(14px)" }}>
                                {r.img ? (
                                  <div className="relative flex-shrink-0">
                                    <img src={r.img} alt={r.label} className="w-10 h-10 rounded-xl object-cover" />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#040612]" style={{ background: r.dot }} />
                                  </div>
                                ) : r.Icon ? (
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: door.accentBg, border: `1px solid ${door.accentBorder}` }}>
                                    <r.Icon className="w-4.5 h-4.5" style={{ color: door.accent }} />
                                  </div>
                                ) : (
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.highlight ? door.accent : "rgba(255,255,255,0.3)", boxShadow: r.highlight ? `0 0 10px ${door.glowColor}` : "none" }} />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{r.label}</div>
                                  <div className="text-[10px] text-white/50 truncate">{r.sub}</div>
                                </div>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: door.accentBg, border: `1px solid ${door.accentBorder}` }}>
                                  <ArrowRight className="w-3.5 h-3.5" style={{ color: door.accent }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
