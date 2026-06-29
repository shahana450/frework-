"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock, CheckCircle } from "lucide-react";

const included = [
  "GST Registration + 3 months filing",
  "Company/LLP Incorporation",
  "Income Tax Return (ITR) filing",
  "Monthly bookkeeping & MIS report",
  "ROC Annual Filing",
  "Dedicated CA/CS manager",
];

export function PromoOffer() {
  return (
    <section className="py-20 bg-gradient-to-br from-violet-600 to-purple-700 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-white/20">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-yellow-300" />
                <span className="text-yellow-300 font-semibold text-sm uppercase tracking-wide">Limited Time Offer</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                3-Month Business Starter Pack
              </h2>
              <p className="text-violet-200 text-lg mb-6">
                Everything a new or growing business needs for the first 3 months — at one transparent price.
              </p>
              <ul className="space-y-2 mb-8">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-white/90">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="bg-white text-violet-700 hover:bg-violet-50 font-semibold px-8 rounded-xl">
                <Link href="/contact">Claim Offer — Book Free Call</Link>
              </Button>
              <p className="text-violet-300 text-xs mt-3">*Terms apply. Offer valid for new clients only. See full terms.</p>
            </div>
            <div className="md:w-48 flex flex-col items-center justify-center bg-white/10 rounded-2xl p-6 text-center border border-white/20">
              <span className="text-violet-200 text-sm mb-1">Starting from</span>
              <span className="text-5xl font-bold text-white">₹999</span>
              <span className="text-violet-300 text-sm mt-1">/ month</span>
              <div className="mt-4 pt-4 border-t border-white/20 w-full">
                <span className="text-white/80 text-xs">GST inclusive</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
