"use client";

import { motion } from "framer-motion";
import { Share2, Gift, IndianRupee, ChevronRight } from "lucide-react";
import Link from "next/link";

const steps = [
  { icon: Share2, num: "01", title: "Refer a business", desc: "Share your unique referral link with a friend or colleague." },
  { icon: Gift, num: "02", title: "They sign up", desc: "When they book any paid service, you both get rewarded." },
  { icon: IndianRupee, num: "03", title: "Earn ₹500", desc: "Get ₹500 credit per successful referral. Unlimited referrals." },
];

export function ReferralSection() {
  return (
    <section className="py-28 bg-[#070D1A]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-[#C9A84C]/70 uppercase mb-4">Referral Programme</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
            Refer & Earn
          </h2>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent mx-auto mb-4" />
          <p className="text-white/40 text-base max-w-md mx-auto">
            Know a business that needs compliance help? Refer them and earn ₹500 every time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-6 rounded-2xl border border-white/6 bg-white/[0.025] text-center group hover:border-[#C9A84C]/20 transition-colors"
            >
              <div className="text-[#C9A84C]/20 text-5xl font-bold absolute top-4 right-5 font-display leading-none">{step.num}</div>
              <div className="w-12 h-12 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/8 flex items-center justify-center mx-auto mb-5">
                <step.icon className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <h3 className="font-semibold text-white/90 mb-2">{step.title}</h3>
              <p className="text-sm text-white/35 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/referral"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-[#0B1120] gold-shadow"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Join Referral Programme
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
