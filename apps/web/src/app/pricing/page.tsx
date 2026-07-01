"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";
import { Check, X, Zap, Building2, Rocket, Crown, Users, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const PLANS = [
  {
    name: "Free",
    icon: Zap,
    price: { monthly: 0, yearly: 0 },
    desc: "Get started, no card needed",
    accent: { card: "border-white/8", icon: "bg-white/6 text-white/50", badge: null, cta: "border border-white/15 text-white/60 hover:border-white/30 hover:text-white" },
    features: [
      "5 Job Applications / month",
      "1 Active Project",
      "Basic Profile",
      "Community Access",
      "Email Support",
      "Public Job Board Access",
    ],
    notIncluded: ["Custom Portfolio", "Verified Badge", "Priority Search", "Analytics Dashboard", "API Access", "Dedicated Manager"],
    cta: "Get Started Free",
    ctaHref: "/register",
  },
  {
    name: "Professional",
    icon: Rocket,
    price: { monthly: 299, yearly: 194 },
    desc: "For serious freelancers",
    popular: true,
    accent: { card: "border-[#C9A84C]/40", icon: "bg-[#C9A84C]/15 text-[#E8C97A]", badge: "Most Popular", cta: "text-[#0B1120] font-bold" },
    features: [
      "Unlimited Applications",
      "Unlimited Projects",
      "Verified Profile Badge",
      "Portfolio Showcase (20 items)",
      "Analytics Dashboard",
      "Priority Search Ranking",
      "Proposal AI Assistant",
      "Escrow Payments",
      "24/7 Chat Support",
      "GST Registration",
      "Monthly GST Filing",
    ],
    notIncluded: ["Team Collaboration", "Client Portal", "Dedicated Manager", "API Access"],
    cta: "Start Free Trial",
    ctaHref: "/register?plan=professional",
  },
  {
    name: "Growth",
    icon: Users,
    price: { monthly: 2999, yearly: 1949 },
    desc: "For growing teams",
    accent: { card: "border-blue-500/20", icon: "bg-blue-500/12 text-blue-400", badge: null, cta: "border border-blue-500/30 text-blue-300 hover:border-blue-400 hover:text-blue-200" },
    features: [
      "Everything in Professional",
      "Team of up to 5 seats",
      "Client Portal",
      "Custom Contracts",
      "Branded Proposals",
      "Revenue Analytics",
      "Bookkeeping",
    ],
    notIncluded: ["Priority Dispute Resolution", "Dedicated Account Manager", "White-label Solution", "Unlimited API"],
    cta: "Start Growth Trial",
    ctaHref: "/register?plan=growth",
  },
  {
    name: "Business",
    icon: Building2,
    price: { monthly: 4999, yearly: 3249 },
    desc: "For agencies & teams",
    accent: { card: "border-purple-500/20", icon: "bg-purple-500/12 text-purple-400", badge: null, cta: "border border-purple-500/30 text-purple-300 hover:border-purple-400 hover:text-purple-200" },
    features: [
      "Everything in Growth",
      "Team of up to 20 seats",
      "Priority Dispute Resolution",
      "Dedicated Account Manager",
      "API Access (50K calls/mo)",
      "Custom Integrations",
      "White-label Proposals",
      "Internal Audit",
      "Annual Audit",
    ],
    notIncluded: ["Unlimited API", "White-label Solution", "Custom Domain"],
    cta: "Start Business Trial",
    ctaHref: "/register?plan=business",
  },
  {
    name: "Enterprise",
    icon: Crown,
    price: { monthly: 9999, yearly: 6499 },
    desc: "For large organisations",
    accent: { card: "border-emerald-500/20", icon: "bg-emerald-500/12 text-emerald-400", badge: null, cta: "border border-emerald-500/30 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200" },
    features: [
      "Everything in Business",
      "Unlimited Team Members",
      "White-label Solution",
      "Custom Domain",
      "SSO / SAML",
      "Unlimited API Access",
      "Custom Integrations",
      "SLA Guarantee (99.9%)",
      "Dedicated Customer Success",
      "On-premise Deployment Option",
      "Custom Reporting",
    ],
    notIncluded: [],
    cta: "Contact Sales",
    ctaHref: "/contact?plan=enterprise",
  },
];

const FAQS = [
  ["Can I switch plans later?", "Yes — upgrade or downgrade at any time. Changes take effect immediately with prorated billing."],
  ["Is there a free trial?", "Professional, Growth, Business, and Enterprise plans all include a 14-day free trial. No credit card required."],
  ["What payment methods do you accept?", "All major credit cards, UPI, Razorpay, Stripe, and bank transfers for annual plans."],
  ["What is the FreWork transaction fee?", "We charge a 5% platform fee on transactions — covering payment processing, escrow, and dispute resolution."],
  ["Can I get a custom quote?", "Enterprise plans can be customised. Reach out via the Contact page and our team will respond within one business day."],
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="min-h-screen bg-[#060C18]">
      <Navbar />

      <div className="pt-28 pb-20 px-4">

        {/* Hero */}
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-semibold tracking-wide mb-5">
            <Sparkles className="w-3 h-3" /> Simple, transparent pricing
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 leading-tight"
            style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Start free.<br />Scale when ready.
          </h1>
          <p className="text-white/40 text-base mb-10">No hidden fees, no surprises. Cancel anytime.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-[#0A1020] border border-white/8 rounded-2xl p-1 gap-1">
            <button onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${!yearly ? "bg-white/8 text-white shadow" : "text-white/35 hover:text-white/60"}`}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${yearly ? "bg-white/8 text-white shadow" : "text-white/35 hover:text-white/60"}`}>
              Yearly
              <span className="text-emerald-400 text-xs font-bold">Save 35%</span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-20 items-start">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const price = yearly ? plan.price.yearly : plan.price.monthly;
            const isPopular = !!plan.popular;
            return (
              <motion.div key={plan.name}
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.4 }}
                className={`relative flex flex-col rounded-3xl border-2 p-6 transition-all duration-300
                  ${isPopular
                    ? "bg-gradient-to-b from-[#1A1506] via-[#0F0E04] to-[#070D1A] shadow-[0_0_80px_rgba(201,168,76,0.18)] scale-[1.02]"
                    : "bg-[#070D1A] hover:bg-[#0A1120]"}
                  ${plan.accent.card}`}>

                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide text-[#0B1120]"
                    style={{ background: "linear-gradient(90deg,#E8C97A,#C9A84C)" }}>
                    ✦ Most Popular
                  </div>
                )}

                {/* Icon */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 border ${plan.accent.icon} ${isPopular ? "border-[#C9A84C]/25" : "border-white/6"}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Name & desc */}
                <h3 className="text-lg font-bold text-white mb-0.5">{plan.name}</h3>
                <p className="text-xs text-white/35 mb-5">{plan.desc}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`text-4xl font-bold ${isPopular ? "text-[#E8C97A]" : "text-white"}`}>
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    {plan.price.original && !yearly && (
                      <span className="text-sm text-white/25 line-through">₹{plan.price.original}</span>
                    )}
                    <span className="text-white/30 text-xs">/mo</span>
                  </div>
                  {yearly && price > 0 && (
                    <p className="text-[11px] text-emerald-400/70 mt-1">Billed ₹{(price * 12).toLocaleString("en-IN")}/year</p>
                  )}
                  {price === 0 && <p className="text-[11px] text-white/25 mt-1">Forever free</p>}
                </div>

                {/* CTA */}
                <Link href={plan.ctaHref}
                  className={`w-full mb-6 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all group
                    ${isPopular
                      ? "text-[#0B1120]"
                      : `${plan.accent.cta} bg-transparent`}`}
                  style={isPopular ? { background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" } : {}}>
                  {plan.cta}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                {/* Feature divider */}
                <div className="border-t border-white/6 mb-4" />

                {/* Features */}
                <div className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular ? "bg-[#C9A84C]/20" : "bg-emerald-500/12"}`}>
                        <Check className={`w-2.5 h-2.5 ${isPopular ? "text-[#E8C97A]" : "text-emerald-400"}`} />
                      </div>
                      <span className="text-xs text-white/60 leading-relaxed">{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map(f => (
                    <div key={f} className="flex items-start gap-2 opacity-30">
                      <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-white/6">
                        <X className="w-2.5 h-2.5 text-white/40" />
                      </div>
                      <span className="text-xs text-white/40 leading-relaxed line-through">{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison hint */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <div className="inline-flex flex-wrap justify-center gap-6 px-8 py-4 rounded-2xl bg-white/3 border border-white/6">
            {[["5%", "Platform transaction fee"], ["14 days", "Free trial on paid plans"], ["24 hrs", "Avg. support response"], ["No", "Lock-in contracts"]].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-xl font-bold text-[#E8C97A]" style={{ fontFamily: "var(--font-cormorant), serif" }}>{v}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Pricing FAQs
          </h2>
          <div className="space-y-3">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group bg-[#070D1A] border border-white/8 rounded-2xl overflow-hidden">
                <summary className="flex justify-between items-center px-5 py-4 cursor-pointer list-none">
                  <span className="text-sm font-semibold text-white/80">{q}</span>
                  <span className="text-white/25 group-open:text-[#C9A84C] transition-colors text-lg leading-none ml-4 flex-shrink-0">+</span>
                </summary>
                <p className="text-sm text-white/40 px-5 pb-4 leading-relaxed -mt-1">{a}</p>
              </details>
            ))}
          </div>

          <p className="text-center text-xs text-white/20 mt-10">
            Questions? <Link href="/contact" className="text-[#C9A84C] hover:underline">Contact us</Link> — we reply within 24 hours.
          </p>
        </div>

      </div>
    </div>
  );
}
