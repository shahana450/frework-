"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Clock, CheckCircle, ChevronRight } from "lucide-react";

const included = [
  "GST Registration + 3 months filing",
  "Company / LLP Incorporation",
  "Income Tax Return (ITR) filing",
  "Monthly bookkeeping & MIS report",
  "ROC Annual Filing",
  "Dedicated CA / CS manager",
];

export function PromoOffer() {
  return (
    <section className="py-28 bg-[#060C18] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(201,168,76,0.06),transparent)]" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl border border-[#C9A84C]/20 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D1628 0%, #111D35 50%, #0A1220 100%)" }}
        >
          {/* Top bar */}
          <div className="flex items-center gap-2 px-8 py-4 border-b border-[#C9A84C]/15"
            style={{ background: "linear-gradient(90deg, rgba(201,168,76,0.08), transparent)" }}>
            <Clock className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.2em]">Limited Time Offer</span>
          </div>

          <div className="p-8 md:p-12 flex flex-col md:flex-row gap-10 items-start">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight"
                style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
                3-Month Business<br />Starter Pack
              </h2>
              <p className="text-white/45 text-base mb-8 leading-relaxed">
                Everything a new or growing business needs for the first quarter — one transparent price, zero surprises.
              </p>
              <ul className="space-y-3 mb-10">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3 h-3 text-[#C9A84C]" />
                    </div>
                    <span className="text-sm text-white/70">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-[#0B1120] transition-all hover:scale-[1.02] gold-shadow"
                style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
                Claim Offer — Book Free Call
                <ChevronRight className="w-4 h-4" />
              </Link>
              <p className="text-white/25 text-xs mt-3">*Valid for new clients only. Terms apply.</p>
            </div>

            {/* Price card */}
            <div className="md:w-52 rounded-2xl border border-[#C9A84C]/25 p-7 text-center flex-shrink-0"
              style={{ background: "rgba(201,168,76,0.05)" }}>
              <p className="text-[#C9A84C]/60 text-xs uppercase tracking-widest mb-3">Starting from</p>
              <p className="text-6xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>₹999</p>
              <p className="text-white/35 text-sm">/ month</p>
              <div className="my-5 h-px bg-[#C9A84C]/15" />
              <p className="text-[#C9A84C]/50 text-xs">GST inclusive</p>
              <p className="text-white/30 text-xs mt-1">No hidden charges</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
