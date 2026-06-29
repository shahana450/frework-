"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  { q: "What services does FreWork offer?", a: "FreWork offers GST registration & filing, Income Tax returns, Company/LLP registration, monthly accounting, statutory audit, ROC compliance and Virtual CFO services for Indian businesses." },
  { q: "How do I get started?", a: "Book a free consultation call. Our team will assess your needs and recommend the right plan. No commitment required for the first call." },
  { q: "What is the 3-month promotional offer?", a: "New clients get a bundled package covering company registration, GST setup, 3 months of filing, monthly bookkeeping and ROC annual filing — all at a special introductory price. Terms apply." },
  { q: "How does the referral programme work?", a: "Refer any business to FreWork. When they sign up for a paid service, you receive ₹500 credit applied to your next invoice. There is no limit on referrals." },
  { q: "Are your professionals CA/CS qualified?", a: "Yes. All work is handled by Chartered Accountants and Company Secretaries with active ICAI/ICSI membership. You will have a named professional responsible for your account." },
  { q: "When will the marketplace and coworking features be available?", a: "Freelancer Marketplace, Job Portal, Coworking bookings and Investor Network are on our roadmap and will launch in Phase 2. Stay tuned!" },
];

export function HomepageFAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently asked questions
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white pr-4">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-5 pb-5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-4">
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
