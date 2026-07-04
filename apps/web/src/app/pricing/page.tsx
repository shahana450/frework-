"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Zap, Building2, Rocket, Crown, Users, ArrowRight,
  Sparkles, ShieldCheck, Clock, BadgeCheck, Headphones,
  FileText, TrendingUp, BookOpen, Search, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PlanFeature = { text: string; note?: string };

type Plan = {
  name: string;
  icon: React.ElementType;
  price: { monthly: number; yearly: number };
  tagline: string;
  desc: string;
  popular?: boolean;
  color: { border: string; iconBg: string; iconText: string; glow: string; badge?: string; cta: string; ctaStyle?: React.CSSProperties; highlight: string };
  sections: { heading: string; icon: React.ElementType; items: PlanFeature[] }[];
  notIncluded: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    icon: Zap,
    price: { monthly: 0, yearly: 0 },
    tagline: "Try before you commit",
    desc: "Perfect for individuals exploring the platform.",
    color: {
      border: "border-white/10",
      iconBg: "bg-white/6", iconText: "text-white/40",
      glow: "rgba(255,255,255,0.03)",
      highlight: "text-white",
      cta: "border border-white/15 text-white/60 hover:border-white/30 hover:text-white/90 transition-all",
    },
    sections: [
      {
        heading: "Platform Access",
        icon: Search,
        items: [
          { text: "Browse all listings & job board" },
          { text: "1 active listing / profile" },
          { text: "Basic public profile" },
          { text: "5 job applications per month" },
          { text: "Community forum access" },
          { text: "Email support (48 hr response)" },
        ],
      },
    ],
    notIncluded: ["Verified Badge", "Priority Search", "Analytics", "CA/CS Services", "Team Seats", "API Access"],
    cta: "Get Started — Free",
  },
  {
    name: "Professional",
    icon: Rocket,
    price: { monthly: 999, yearly: 649 },
    tagline: "Most popular for freelancers & CAs",
    desc: "Everything you need to grow your professional practice.",
    popular: true,
    color: {
      border: "border-[#C9A84C]/50",
      iconBg: "bg-[#C9A84C]/15", iconText: "text-[#E8C97A]",
      glow: "rgba(201,168,76,0.22)",
      badge: "✦ Most Popular",
      highlight: "text-[#E8C97A]",
      cta: "text-[#0B1120] font-bold",
      ctaStyle: { background: "linear-gradient(135deg,#F0D78A,#C9A84C,#A8883A)" },
    },
    sections: [
      {
        heading: "Platform",
        icon: BadgeCheck,
        items: [
          { text: "Unlimited listings & applications" },
          { text: "Verified Profile Badge" },
          { text: "Priority search ranking" },
          { text: "Portfolio showcase (up to 20 items)" },
          { text: "Analytics dashboard" },
          { text: "AI Proposal assistant" },
          { text: "Escrow payment protection" },
          { text: "24/7 chat support" },
        ],
      },
      {
        heading: "CA/CS Services",
        icon: FileText,
        items: [
          { text: "GST Registration", note: "One-time" },
          { text: "Monthly GST Filing (GSTR-1 & 3B)" },
          { text: "Income Tax Return (ITR-1 / ITR-4)" },
          { text: "TDS advisory & compliance" },
        ],
      },
    ],
    notIncluded: ["Team Seats", "Bookkeeping", "Audit", "API Access"],
    cta: "Start 14-Day Free Trial",
  },
  {
    name: "Growth",
    icon: TrendingUp,
    price: { monthly: 2999, yearly: 1949 },
    tagline: "Built for growing SMEs & agencies",
    desc: "Team tools, financial management and compliance in one place.",
    color: {
      border: "border-blue-500/25",
      iconBg: "bg-blue-500/12", iconText: "text-blue-400",
      glow: "rgba(59,130,246,0.1)",
      highlight: "text-blue-300",
      cta: "border border-blue-500/35 text-blue-300 hover:bg-blue-500/8 hover:border-blue-400 transition-all",
    },
    sections: [
      {
        heading: "Everything in Professional, plus",
        icon: Users,
        items: [
          { text: "5 team seats" },
          { text: "Client portal with shared workspace" },
          { text: "Custom contracts & e-signatures" },
          { text: "Branded proposals & templates" },
          { text: "Revenue & pipeline analytics" },
        ],
      },
      {
        heading: "Accounting & Compliance",
        icon: BookOpen,
        items: [
          { text: "Monthly bookkeeping (up to 200 txns)" },
          { text: "P&L and balance sheet reports" },
          { text: "Quarterly advance tax computation" },
          { text: "ROC annual filing (Form AOC-4)" },
          { text: "MSME / Udyam registration" },
        ],
      },
    ],
    notIncluded: ["Internal Audit", "Annual Audit", "Dedicated Manager", "API Access"],
    cta: "Start Growth Trial",
  },
  {
    name: "Business",
    icon: Building2,
    price: { monthly: 4999, yearly: 3249 },
    tagline: "For established businesses & firms",
    desc: "Full audit suite, dedicated manager, and advanced integrations.",
    color: {
      border: "border-violet-500/25",
      iconBg: "bg-violet-500/12", iconText: "text-violet-400",
      glow: "rgba(139,92,246,0.1)",
      highlight: "text-violet-300",
      cta: "border border-violet-500/35 text-violet-300 hover:bg-violet-500/8 hover:border-violet-400 transition-all",
    },
    sections: [
      {
        heading: "Everything in Growth, plus",
        icon: Building2,
        items: [
          { text: "20 team seats" },
          { text: "Dedicated Account Manager" },
          { text: "Priority dispute resolution (4 hr SLA)" },
          { text: "API access (50K calls/month)" },
          { text: "Custom integrations (Tally, Zoho, etc.)" },
          { text: "White-label proposal builder" },
        ],
      },
      {
        heading: "Audit & Advisory",
        icon: ShieldCheck,
        items: [
          { text: "Internal audit (quarterly)" },
          { text: "Statutory / annual audit" },
          { text: "Tax audit (Form 3CA/3CB)" },
          { text: "Transfer pricing advisory" },
          { text: "DPR & CMA data preparation" },
        ],
      },
    ],
    notIncluded: ["Unlimited API", "White-label Platform", "SSO/SAML"],
    cta: "Start Business Trial",
  },
  {
    name: "Enterprise",
    icon: Crown,
    price: { monthly: 9999, yearly: 6499 },
    tagline: "For large corporates & CA firms",
    desc: "Custom infrastructure, unlimited seats and white-label solution.",
    color: {
      border: "border-emerald-500/25",
      iconBg: "bg-emerald-500/12", iconText: "text-emerald-400",
      glow: "rgba(16,185,129,0.1)",
      highlight: "text-emerald-300",
      cta: "border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/8 hover:border-emerald-400 transition-all",
    },
    sections: [
      {
        heading: "Everything in Business, plus",
        icon: Crown,
        items: [
          { text: "Unlimited team members" },
          { text: "White-label platform (your brand)" },
          { text: "Custom domain & subdomain" },
          { text: "SSO / SAML 2.0 authentication" },
          { text: "Unlimited API + webhook access" },
          { text: "Custom ERP / accounting integrations" },
          { text: "99.9% uptime SLA" },
          { text: "On-premise deployment option" },
        ],
      },
      {
        heading: "Premium Advisory",
        icon: Headphones,
        items: [
          { text: "Dedicated Customer Success team" },
          { text: "Custom compliance reporting" },
          { text: "Virtual CFO advisory (monthly)" },
          { text: "M&A and restructuring advisory" },
          { text: "Custom training & onboarding" },
        ],
      },
    ],
    notIncluded: [],
    cta: "Contact Sales",
  },
];

const FAQS = [
  { q: "Can I switch plans anytime?", a: "Yes — upgrade or downgrade instantly. Upgrades are prorated; downgrades take effect at the next billing cycle." },
  { q: "Is there really a 14-day free trial?", a: "Yes. Professional, Growth, and Business plans include a full 14-day trial with no credit card required. You won't be charged until the trial ends." },
  { q: "What CA/CS services are included?", a: "GST filing, ITR filing, bookkeeping, internal audit, and annual audit are performed by our qualified CA/CS team — not automated tools. Scope varies by plan." },
  { q: "What payment methods do you accept?", a: "UPI, all major credit/debit cards (Visa, Mastercard, RuPay), Net Banking, EMI, and bank transfer for annual plans — via Razorpay." },
  { q: "How does the yearly billing discount work?", a: "Choosing yearly billing saves you up to 35% compared to monthly. You're billed for 12 months upfront at the discounted monthly rate." },
  { q: "Can I get a custom quote for my firm?", a: "Enterprise plans are fully customisable. Contact us and our team responds within 1 business day with a tailored proposal." },
];

const TRUST = [
  { icon: ShieldCheck, label: "SOC 2 compliant infrastructure" },
  { icon: BadgeCheck, label: "ICAI-registered CA/CS experts" },
  { icon: Clock, label: "14-day free trial, no card" },
  { icon: Headphones, label: "24/7 dedicated support" },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session));
  }, []);

  const handlePlanClick = (plan: Plan) => {
    const key = plan.name.toLowerCase();
    if (loggedIn) {
      if (key === "free") router.push("/dashboard");
      else if (key === "enterprise") router.push("/contact?plan=enterprise");
      else router.push(`/subscribe?plan=${key}`);
    } else {
      router.push(key === "free" ? "/register" : `/register?plan=${key}`);
    }
  };

  const ctaLabel = (plan: Plan) => {
    const key = plan.name.toLowerCase();
    if (key === "enterprise") return "Contact Sales";
    if (key === "free") return loggedIn ? "Go to Dashboard" : "Get Started — Free";
    return loggedIn ? "Subscribe Now" : plan.cta;
  };

  return (
    <div className="min-h-screen bg-[#060C18]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-32 pb-16 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-6">
            <Sparkles className="w-3 h-3" /> Transparent Pricing · No Hidden Fees
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold text-white leading-[1.05] mb-5"
            style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Invest in your<br />
            <span style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              professional growth.
            </span>
          </h1>
          <p className="text-white/45 text-lg mb-10 leading-relaxed">
            CA/CS services, workspace, talent, and compliance —<br className="hidden sm:block" /> all in one platform. Cancel anytime.
          </p>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/4 border border-white/8 text-white/50 text-xs">
                <Icon className="w-3.5 h-3.5 text-[#C9A84C]/70" /> {label}
              </div>
            ))}
          </div>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-[#0A1020] border border-white/10 rounded-2xl p-1.5 gap-1">
            <button onClick={() => setYearly(false)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${!yearly ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/60"}`}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${yearly ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/60"}`}>
              Yearly
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide">
                SAVE 35%
              </span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Plan Cards ── */}
      <section className="px-4 pb-24">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 items-start">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const price = yearly ? plan.price.yearly : plan.price.monthly;
            const isPopular = !!plan.popular;

            return (
              <motion.div key={plan.name}
                initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={`relative flex flex-col rounded-3xl border-2 overflow-hidden transition-all duration-300
                  ${plan.color.border}
                  ${isPopular ? "scale-[1.02] lg:scale-[1.03]" : "hover:translate-y-[-2px]"}`}
                style={{
                  background: isPopular
                    ? "linear-gradient(160deg,#1C1604 0%,#100F04 40%,#08090F 100%)"
                    : "#070D1A",
                  boxShadow: `0 0 60px ${plan.color.glow}, 0 8px 32px rgba(0,0,0,0.4)`,
                }}>

                {/* Popular ribbon */}
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: "linear-gradient(90deg,#E8C97A,#C9A84C,#A8883A)" }} />
                )}

                {/* Badge */}
                {plan.color.badge && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <div className="px-4 py-1.5 rounded-b-2xl text-[10px] font-black tracking-[0.2em] uppercase text-[#0B1120]"
                      style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)" }}>
                      {plan.color.badge}
                    </div>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">

                  {/* Header */}
                  <div className="flex items-start justify-between mb-5 mt-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${plan.color.iconBg} ${isPopular ? "border-[#C9A84C]/30" : "border-white/8"}`}>
                      <Icon className={`w-5 h-5 ${plan.color.iconText}`} />
                    </div>
                  </div>

                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: isPopular ? "#C9A84C" : "rgba(255,255,255,0.3)" }}>
                    {plan.tagline}
                  </p>
                  <h3 className="text-2xl font-black text-white mb-1"
                    style={{ fontFamily: "var(--font-cormorant), serif", letterSpacing: "-0.01em" }}>
                    {plan.name}
                  </h3>
                  <p className="text-xs text-white/35 leading-relaxed mb-6">{plan.desc}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1.5">
                      <span className={`text-5xl font-black leading-none ${plan.color.highlight}`}
                        style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                        {price === 0 ? "₹0" : `₹${price.toLocaleString("en-IN")}`}
                      </span>
                      <div className="pb-1">
                        <span className="text-white/25 text-xs block leading-none">/mo</span>
                        {yearly && price > 0 && (
                          <span className="text-emerald-400/80 text-[10px] block leading-none mt-0.5">billed yearly</span>
                        )}
                      </div>
                    </div>
                    {price === 0 && <p className="text-[11px] text-white/20 mt-1.5">Free forever · No card required</p>}
                    {yearly && price > 0 && (
                      <p className="text-[11px] text-white/25 mt-1.5">
                        ₹{(price * 12).toLocaleString("en-IN")} billed annually
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <button onClick={() => handlePlanClick(plan)}
                    className={`w-full mb-7 py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer transition-all active:scale-[0.98]
                      ${isPopular ? plan.color.cta : plan.color.cta}`}
                    style={plan.color.ctaStyle}>
                    {ctaLabel(plan)}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Divider */}
                  <div className={`h-px mb-5 ${isPopular ? "bg-[#C9A84C]/15" : "bg-white/6"}`} />

                  {/* Feature sections */}
                  <div className="space-y-5 flex-1">
                    {plan.sections.map(section => (
                      <div key={section.heading}>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <section.icon className={`w-3 h-3 ${plan.color.iconText} opacity-70`} />
                          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/25">{section.heading}</p>
                        </div>
                        <div className="space-y-2">
                          {section.items.map(item => (
                            <div key={item.text} className="flex items-start gap-2.5">
                              <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular ? "bg-[#C9A84C]/18" : "bg-emerald-500/12"}`}>
                                <Check className={`w-2.5 h-2.5 ${isPopular ? "text-[#E8C97A]" : "text-emerald-400"}`} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-white/65 leading-relaxed">{item.text}</span>
                                {item.note && <span className="text-[10px] text-white/25 ml-1">({item.note})</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Not included */}
                    {plan.notIncluded.length > 0 && (
                      <div>
                        <div className="h-px bg-white/4 mb-4" />
                        <div className="space-y-2">
                          {plan.notIncluded.map(f => (
                            <div key={f} className="flex items-start gap-2.5 opacity-25">
                              <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-white/6">
                                <X className="w-2.5 h-2.5 text-white/50" />
                              </div>
                              <span className="text-xs text-white/40 line-through leading-relaxed">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="px-4 pb-20">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl border border-white/6 overflow-hidden"
          style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.06),rgba(201,168,76,0.02))" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/6">
            {[
              { val: "5%", label: "Platform transaction fee", sub: "Lowest in India" },
              { val: "14 days", label: "Free trial on paid plans", sub: "No credit card" },
              { val: "< 4 hrs", label: "Avg. support response", sub: "For paid plans" },
              { val: "Zero", label: "Lock-in or exit fees", sub: "Cancel anytime" },
            ].map(({ val, label, sub }) => (
              <div key={label} className="py-7 px-6 text-center">
                <p className="text-3xl font-black mb-1"
                  style={{ fontFamily: "var(--font-cormorant), serif", background: "linear-gradient(135deg,#F0D78A,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {val}
                </p>
                <p className="text-xs font-semibold text-white/60 mb-0.5">{label}</p>
                <p className="text-[10px] text-white/25">{sub}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]/60 mb-3">Got questions?</p>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              Frequently asked
            </h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="rounded-2xl border border-white/8 overflow-hidden bg-[#070D1A]">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className="text-sm font-semibold text-white/80 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#C9A84C] flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <p className="px-6 pb-5 text-sm text-white/40 leading-relaxed border-t border-white/6 pt-4">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center rounded-3xl border border-white/6 bg-white/2 p-8">
            <p className="text-white/50 text-sm mb-2">Need something custom?</p>
            <p className="text-white font-semibold mb-5">Our team will build a plan around your requirements.</p>
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[#0B1120] transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)" }}>
              Talk to us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
