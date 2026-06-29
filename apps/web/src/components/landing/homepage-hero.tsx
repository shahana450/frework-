"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Search, TrendingUp, MapPin, Users, Briefcase, FileText, BarChart3, Presentation, Building2, GraduationCap, ArrowRight } from "lucide-react";

const findLinks = [
  { icon: MapPin, label: "Coworking & Offices", href: "/coworking" },
  { icon: Users, label: "Freelancers", href: "/freelancers" },
  { icon: Briefcase, label: "Jobs", href: "/jobs" },
];

const growLinks = [
  { icon: FileText, label: "Compliance", href: "/services/compliance" },
  { icon: BarChart3, label: "DPR", href: "/services/dpr" },
  { icon: Presentation, label: "Pitch Decks", href: "/services/pitch-decks" },
  { icon: Building2, label: "Restructuring", href: "/services/restructuring" },
  { icon: GraduationCap, label: "Training", href: "/services/training" },
];

export function HomepageHero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060C18]">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_50%,rgba(59,130,246,0.07),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_70%_50%,rgba(201,168,76,0.07),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(201,168,76,0.06),transparent)]" />
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
        backgroundSize: "80px 80px"
      }} />

      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-6xl mx-auto">

          {/* Top badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-10"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/4 text-white/50 text-xs font-medium tracking-widest uppercase">
              India&apos;s Professional Growth Platform
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center mb-6"
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
              <span className="text-white">One platform.</span>
              <br />
              <span className="text-white/35">Two doors.</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center text-white/45 text-base md:text-lg mb-16 max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-poppins), sans-serif" }}
          >
            Search and book workspaces, freelancers and jobs — or get expert CA & CS services to grow your business.
          </motion.p>

          {/* TWO DOOR CARDS */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto"
          >
            {/* FIND door */}
            <div className="group relative rounded-3xl border border-[#3B82F6]/20 bg-gradient-to-b from-[#0D1829] to-[#080E1C] p-8 overflow-hidden hover:border-[#3B82F6]/40 transition-all duration-500">
              {/* Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(59,130,246,0.12),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                {/* Label */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/25 flex items-center justify-center">
                    <Search className="w-5 h-5 text-[#7DD3FC]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.25em] text-[#7DD3FC]/60 uppercase">Door 1</p>
                    <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
                      FIND
                    </h2>
                  </div>
                </div>

                <p className="text-white/45 text-sm mb-7 leading-relaxed">
                  Marketplace & community — search, browse and book.
                </p>

                {/* Links */}
                <ul className="space-y-2.5 mb-8">
                  {findLinks.map(({ icon: Icon, label, href }) => (
                    <li key={href}>
                      <Link href={href} className="flex items-center gap-3 group/item">
                        <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0 group-hover/item:bg-[#3B82F6]/20 transition-colors">
                          <Icon className="w-3.5 h-3.5 text-[#7DD3FC]" />
                        </div>
                        <span className="text-sm text-white/65 group-hover/item:text-white transition-colors">{label}</span>
                        <ArrowRight className="w-3 h-3 text-white/20 ml-auto opacity-0 group-hover/item:opacity-100 -translate-x-1 group-hover/item:translate-x-0 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link href="/coworking"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white border border-[#3B82F6]/30 hover:bg-[#3B82F6]/12 hover:border-[#3B82F6]/50 transition-all group/btn">
                  Start exploring
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* GROW door */}
            <div className="group relative rounded-3xl border border-[#C9A84C]/20 bg-gradient-to-b from-[#150F03] to-[#080E1C] p-8 overflow-hidden hover:border-[#C9A84C]/40 transition-all duration-500">
              {/* Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(201,168,76,0.10),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                {/* Label */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C]/60 uppercase">Door 2</p>
                    <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
                      GROW
                    </h2>
                  </div>
                </div>

                <p className="text-white/45 text-sm mb-7 leading-relaxed">
                  Professional services — get a quote and let our CA & CS team handle it.
                </p>

                {/* Links */}
                <ul className="space-y-2.5 mb-8">
                  {growLinks.map(({ icon: Icon, label, href }) => (
                    <li key={href}>
                      <Link href={href} className="flex items-center gap-3 group/item">
                        <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0 group-hover/item:bg-[#C9A84C]/20 transition-colors">
                          <Icon className="w-3.5 h-3.5 text-[#C9A84C]" />
                        </div>
                        <span className="text-sm text-white/65 group-hover/item:text-white transition-colors">{label}</span>
                        <ArrowRight className="w-3 h-3 text-white/20 ml-auto opacity-0 group-hover/item:opacity-100 -translate-x-1 group-hover/item:translate-x-0 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#0B1120] transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
                  Get a free quote
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-8 mt-16 text-center"
          >
            {[
              ["500+", "Businesses Served"],
              ["CA & CS", "Qualified Experts"],
              ["24 hrs", "Response Time"],
              ["₹999", "Starting/month"],
            ].map(([num, label]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-xl font-bold text-[#C9A84C]" style={{ fontFamily: "var(--font-cormorant), serif" }}>{num}</span>
                <span className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">{label}</span>
              </div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
