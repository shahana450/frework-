"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";

export function HomepageHero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060C18]">
      {/* Layered background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,168,76,0.12),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_70%,rgba(99,102,241,0.08),transparent)]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)",
        backgroundSize: "80px 80px"
      }} />

      {/* Gold orb top */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[600px] h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-transparent" />

      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/8 text-[#C9A84C] text-sm font-medium tracking-wide">
              <Star className="w-3.5 h-3.5 fill-[#C9A84C]" />
              India's Premium Business Compliance Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-6xl md:text-8xl font-bold mb-6 leading-[1.05] tracking-tight"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}
          >
            <span className="text-white">Start. Manage.</span>
            <br />
            <span style={{
              background: "linear-gradient(135deg, #E8C97A 0%, #C9A84C 40%, #F0D080 70%, #A07830 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Grow.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-white/55 mb-12 max-w-2xl mx-auto leading-relaxed font-light"
            style={{ fontFamily: "var(--font-poppins), sans-serif" }}
          >
            Expert GST, Income Tax, Company Registration, Accounting, Audit and Compliance — handled by CA & CS qualified professionals.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Link href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-[#0B1120] transition-all hover:scale-[1.02] active:scale-[0.98] gold-shadow"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
              Book Free Consultation
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/services"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-medium text-white/80 border border-white/12 hover:border-[#C9A84C]/40 hover:text-white hover:bg-white/4 transition-all">
              Explore Services
            </Link>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-8 text-center"
          >
            {[
              ["500+", "Businesses Served"],
              ["CA & CS", "Qualified Experts"],
              ["24 hrs", "Response Time"],
              ["₹999", "Starting/month"],
            ].map(([num, label]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-2xl font-bold text-[#C9A84C]" style={{ fontFamily: "var(--font-cormorant), serif" }}>{num}</span>
                <span className="text-xs text-white/35 uppercase tracking-widest mt-0.5">{label}</span>
              </div>
            ))}
          </motion.div>

          {/* Divider line */}
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.6 }} className="mt-14 mx-auto max-w-xs h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
        </div>
      </div>
    </section>
  );
}
