"use client";

import { motion } from "framer-motion";
import { Gift, Share2, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const steps = [
  { icon: Share2, title: "Refer a business", desc: "Share your unique referral link with a friend or colleague." },
  { icon: Gift, title: "They sign up", desc: "When they book any service, you both get rewarded." },
  { icon: IndianRupee, title: "Earn rewards", desc: "Get ₹500 credit for every successful referral. No limit." },
];

export function ReferralSection() {
  return (
    <section className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Refer & Earn
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            Know someone who needs business services? Refer them and earn ₹500 for every successful signup.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto mb-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-7 h-7 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <Button asChild size="lg" className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8">
            <Link href="/referral">Join Referral Programme</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
