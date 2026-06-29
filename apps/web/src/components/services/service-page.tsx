"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

const colorMap: Record<string, string> = {
  violet: "from-violet-500 to-purple-600",
  blue: "from-blue-500 to-cyan-600",
  green: "from-green-500 to-emerald-600",
  orange: "from-orange-500 to-amber-600",
  red: "from-red-500 to-rose-600",
  pink: "from-pink-500 to-fuchsia-600",
  teal: "from-teal-500 to-cyan-600",
};

interface ServicePageProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  price: string;
  priceNote: string;
  color: string;
}

export function ServicePage({ title, subtitle, description, features, price, priceNote, color }: ServicePageProps) {
  const gradient = colorMap[color] ?? colorMap.violet;

  return (
    <div className="py-16 px-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${gradient} mb-4`}>
            FreWork Services
          </span>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">{subtitle}</p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">{description}</p>
          <ul className="space-y-3 mb-8">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300">{f}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className={`bg-gradient-to-r ${gradient} text-white rounded-xl px-8 shadow-lg`}>
            <Link href="/contact">Book Free Consultation</Link>
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div className={`rounded-3xl bg-gradient-to-br ${gradient} p-8 text-white shadow-2xl`}>
            <p className="text-white/80 text-sm mb-1">Starting from</p>
            <div className="text-6xl font-bold mb-1">{price}</div>
            <p className="text-white/70 text-sm mb-8">{priceNote}</p>
            <div className="bg-white/10 rounded-2xl p-5 space-y-3 mb-6">
              <p className="text-white font-semibold">What's included</p>
              {features.slice(0, 4).map((f) => (
                <div key={f} className="flex items-center gap-2 text-white/90 text-sm">
                  <CheckCircle className="w-4 h-4 text-white/70 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Button asChild size="lg" className="w-full bg-white text-gray-900 hover:bg-gray-50 font-semibold rounded-xl">
              <Link href="/contact">Get Started Today</Link>
            </Button>
            <p className="text-white/60 text-xs text-center mt-3">Free consultation · No commitment</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
