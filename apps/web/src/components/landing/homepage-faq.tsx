"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  { q: "What services does FreWork offer?", a: "FreWork offers GST registration & filing, Income Tax returns, Company/LLP registration, monthly accounting, statutory audit, ROC compliance and Virtual CFO services for Indian businesses." },
  { q: "How do I get started?", a: "Book a free consultation call. Our CA team will assess your needs and recommend the right plan. No commitment required for the first call." },
  { q: "What is the 3-month promotional offer?", a: "New clients get a bundled package covering company registration, GST setup, 3 months of filing, monthly bookkeeping and ROC annual filing — all at a special introductory price. Terms apply." },
  { q: "How does the referral programme work?", a: "Refer any business to FreWork. When they sign up for a paid service, you receive ₹500 credit applied to your next invoice. There is no limit on referrals." },
  { q: "Are your professionals CA/CS qualified?", a: "Yes. All work is handled by Chartered Accountants and Company Secretaries with active ICAI/ICSI membership. You will have a named professional responsible for your account." },
  { q: "When will the marketplace and coworking features launch?", a: "Freelancer Marketplace, Job Portal, Coworking bookings and Investor Network are on our Phase 2 roadmap. Sign up to be notified when they launch." },
];

export function HomepageFAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-28 bg-[#060C18]">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-16">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-[#C9A84C]/70 uppercase mb-4">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
            Questions answered
          </h2>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent mx-auto mt-4" />
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${open === i ? "border-[#C9A84C]/25 bg-[#C9A84C]/4" : "border-white/6 bg-white/[0.025] hover:border-white/12"}`}>
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                <span className="font-medium text-white/90 pr-6 text-sm leading-relaxed">{faq.q}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${open === i ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-white/6 text-white/40"}`}>
                  {open === i ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <div className="px-6 pb-6 text-sm text-white/45 leading-relaxed border-t border-[#C9A84C]/10 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
