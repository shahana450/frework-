"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  { q: "What are the two doors on FreWork?", a: "FreWork has two distinct sides. FIND is the marketplace — search coworking spaces, browse freelancers by skill, and look for jobs. GROW is the professional services side — businesses request quotes for compliance, DPRs, pitch decks, restructuring and training, handled by CA & CS qualified experts." },
  { q: "How does FIND work?", a: "Browse and search without creating an account. When you want to enquire, book or hire, you register and connect directly. Coworking spaces can be filtered by city, capacity and amenities. Freelancers are listed by skill category. Jobs can be searched by role and location." },
  { q: "How does GROW work?", a: "Tell us what you need — compliance filing, a DPR for a bank loan, a pitch deck, a restructuring plan or a training workshop. Our team will contact you within 24 hours, confirm scope and pricing, and assign a named CA or CS to your account." },
  { q: "What compliance services are covered?", a: "Income Tax (ITR filing for individuals and businesses), GST (registration, monthly/quarterly returns), Accounts & bookkeeping (P&L, balance sheet, MIS) and ROC compliance (annual filings, director KYC, board resolutions, MCA forms)." },
  { q: "Are your professionals CA/CS qualified?", a: "Yes. All GROW work is handled by Chartered Accountants and Company Secretaries with active ICAI/ICSI membership. You will have a named professional responsible for your account." },
  { q: "How does the referral programme work?", a: "Refer any business to FreWork. When they sign up for a paid GROW service, you receive ₹500 credit applied to your next invoice. There is no limit on referrals." },
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
