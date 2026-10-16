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
import { FREBOOK_PLANS_LIST, FREBOOK_PRICE_LABEL, REFERRAL_DISCOUNT_PCT } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/claimTrial";

type PlanFeature = { text: string; note?: string };

type Plan = {
  name: string;
  icon: React.ElementType;
  price: number; // INR per month, + GST
  tagline: string;
  desc: string;
  popular?: boolean;
  color: { border: string; iconBg: string; iconText: string; glow: string; badge?: string; cta: string; ctaStyle?: React.CSSProperties; highlight: string };
  sections: { heading: string; icon: React.ElementType; items: PlanFeature[] }[];
  notIncluded: string[];
  cta: string;
};

const PLANS: Plan[] = FREBOOK_PLANS_LIST.map(p => ({
    name: p.name,
    icon: BookOpen,
    price: p.price,
    tagline: p.businesses === null ? "Unlimited businesses · one login" : `Up to ${p.businesses} businesses · one login`,
    desc: "Every FreBook feature. Plans differ only in how many businesses you keep under one login.",
    popular: !!p.badge,
    color: {
      badge: p.badge,
      border: "border-[#C9A84C]/50",
      iconBg: "bg-[#C9A84C]/15", iconText: "text-[#E8C97A]",
      glow: "rgba(201,168,76,0.22)",
      highlight: "text-[#E8C97A]",
      cta: "text-[#0B1120] font-bold",
      ctaStyle: { background: "linear-gradient(135deg,#F0D78A,#C9A84C,#A8883A)" },
    },
    sections: [{ heading: "FreBook Accounting", icon: BookOpen, items: p.features.map(text => ({ text })) }],
    notIncluded: [],
    cta: "Get Started",
}));

const FAQS = [
  { q: "What's the difference between the plans?", a: "Only the number of businesses one login can keep: Basic up to 2, Pro up to 5, Unlimited any number. Every plan has every FreBook feature — chat bookkeeping, invoicing, ledgers, bank import, GST returns preparation, TDS tracker, Tally push and import, and reports." },
  { q: "Is there a free trial?", a: `Yes — ${TRIAL_DAYS} days with every feature and any number of businesses. No card needed.` },
  { q: "Is there a referral discount?", a: `Yes. Share your link from the Plans page: your friend gets ${REFERRAL_DISCOUNT_PCT}% off their first month, and when they pay, your next month is ${REFERRAL_DISCOUNT_PCT}% off too.` },
  { q: "Are professional services included?", a: "No. GST registration, ITR filing, ROC filings and audits are ordered separately, at the price shown on each service. Audits are performed by an independent Chartered Accountant." },
  { q: "Is GST extra?", a: "Yes. Plan prices are per month plus 18% GST, billed monthly." },
  { q: "Can I cancel?", a: "Yes, anytime. Access continues until the end of the month you paid for. See the Refund Policy for the 7-day refund rule." },
  { q: "What payment methods do you accept?", a: "UPI, cards and net banking." },
];

const TRUST = [
  { icon: ShieldCheck, label: "Encrypted connections (HTTPS)" },
  { icon: BadgeCheck, label: "Verified professional experts" },
  { icon: Clock, label: "Cancel anytime" },
  { icon: Headphones, label: "Support on WhatsApp and email" },
];

export default function PricingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);   // any subscription row (paid, trial or expired) means the free week is gone
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setLoggedIn(!!session);
      if (!session) return;
      const { count } = await supabase.from("fw_fin_subscriptions").select("user_id", { count: "exact", head: true }).eq("user_id", session.user.id);
      if ((count ?? 0) > 0) setTrialUsed(true);
    });
  }, []);

  // One free week, once per account. The server refuses a second claim with 409.
  async function claimFreeMonth() {
    setClaiming(true); setClaimMsg("");
    try {
      const r = await fetch("/api/finance/subscription/claim-trial", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setClaimMsg(d.error ?? "Couldn't start your free week. Please try again.");
        if (r.status === 409) { setTrialUsed(true); setTimeout(() => router.push("/finance/pricing"), 1800); }
        return;
      }
      setClaimMsg(`✓ Your free week has started — FreBook is yours until ${new Date(d.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`);
      setTimeout(() => router.push("/finance/start"), 1800);
    } catch {
      setClaimMsg("Couldn't start your free week. Please try again.");
    } finally { setClaiming(false); }
  }

  const handlePlanClick = (plan: Plan) => {
    const key = plan.name.toLowerCase();
    if (!loggedIn) router.push(`/register?plan=${key}`);
    else if (trialUsed) router.push(`/finance/pricing`);
    else claimFreeMonth();
  };

  const ctaLabel = (plan: Plan) => {
    if (loggedIn && trialUsed) return "Subscribe Now";
    return claiming ? "Starting your free week…" : `🎁 Start ${TRIAL_DAYS} days free`;
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
            CA Compliance +<br />
            <span style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              FreBook Accounting
            </span>
          </h1>
          <p className="text-white/45 text-lg mb-10 leading-relaxed">
            Start with {TRIAL_DAYS} days free. Then FreBook from {FREBOOK_PRICE_LABEL}/month + GST — Basic, Pro or Unlimited by number of businesses.<br className="hidden sm:block" /> Professional services are ordered separately when you need them.
          </p>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/8 text-white/50 text-xs">
                <Icon className="w-3.5 h-3.5 text-[#C9A84C]/70" /> {label}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Plan Cards ── */}
      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const price = plan.price;
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
                        <span className="text-white/25 text-xs block leading-none">/mo + GST</span>
                      </div>
                    </div>
                    {price === 0 && <p className="text-[11px] text-white/20 mt-1.5">Free forever · No card required</p>}
                    {price > 0 && !trialUsed && <p className="text-[11px] font-semibold text-emerald-400/80 mt-1.5">₹0 for {TRIAL_DAYS} days · then ₹{price.toLocaleString("en-IN")} + GST/month</p>}
                  </div>

                  {/* CTA */}
                  {claimMsg && (
                    <div role="status" className={`mb-3 rounded-xl px-3 py-2 text-xs font-semibold text-center ${claimMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{claimMsg}</div>
                  )}
                  <button onClick={() => handlePlanClick(plan)} disabled={claiming}
                    className={`w-full mb-7 py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer transition-all active:scale-[0.98]
                      ${isPopular ? plan.color.cta : plan.color.cta}`}
                    style={plan.color.ctaStyle}>
                    {ctaLabel(plan)}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Divider */}
                  <div className={`h-px mb-5 ${isPopular ? "bg-[#C9A84C]/15" : "bg-white/[0.06]"}`} />

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
                        <div className="h-px bg-white/[0.04] mb-4" />
                        <div className="space-y-2">
                          {plan.notIncluded.map(f => (
                            <div key={f} className="flex items-start gap-2.5 opacity-25">
                              <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
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
              { val: "₹699", label: "From, per month + GST", sub: "Basic · Pro · Unlimited" },
              { val: "7 days", label: "Refund window", sub: "See Refund Policy" },
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

          <div className="mt-12 text-center rounded-3xl border border-white/6 bg-white/[0.02] p-8">
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
