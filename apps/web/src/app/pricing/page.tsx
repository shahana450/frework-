"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, X, Zap, Building, Rocket, Crown } from "lucide-react";

const PLANS = [
  {
    name: "Free", icon: Zap, price: { monthly: 0, yearly: 0 }, currency: "$",
    desc: "Perfect to get started", color: "border-border",
    features: ["5 Job Applications/month", "1 Active Project", "Basic Profile", "Community Access", "Email Support", "Public Job Board Access"],
    notIncluded: ["Custom Portfolio", "Verified Badge", "Priority Search", "Analytics Dashboard", "API Access", "Dedicated Manager"],
    cta: "Get Started Free",
  },
  {
    name: "Professional", icon: Rocket, price: { monthly: 29, yearly: 19 }, currency: "$",
    desc: "For serious freelancers", color: "border-primary", popular: true,
    features: ["Unlimited Applications", "Unlimited Projects", "Verified Profile Badge", "Portfolio Showcase (20 items)", "Analytics Dashboard", "Priority Search Ranking", "Proposal AI Assistant", "Escrow Payments", "24/7 Chat Support"],
    notIncluded: ["Dedicated Manager", "Custom Contracts", "White-label Profile", "API Access"],
    cta: "Start Free Trial",
  },
  {
    name: "Business", icon: Building, price: { monthly: 99, yearly: 69 }, currency: "$",
    desc: "For agencies & teams", color: "border-border",
    features: ["Everything in Professional", "Team of up to 10", "Client Portal", "Custom Contracts", "Branded Proposals", "Revenue Analytics", "Priority Dispute Resolution", "Dedicated Account Manager", "API Access (10K calls/mo)", "Custom Integrations"],
    notIncluded: ["Unlimited API", "White-label Solution", "Custom Domain"],
    cta: "Start Business Trial",
  },
  {
    name: "Enterprise", icon: Crown, price: { monthly: null, yearly: null }, currency: "$",
    desc: "For large organizations", color: "border-border",
    features: ["Everything in Business", "Unlimited Team Members", "White-label Solution", "Custom Domain", "SSO / SAML", "Unlimited API Access", "Custom Integrations", "SLA Guarantee (99.9%)", "Dedicated Customer Success", "On-premise Deployment Option", "Custom Reporting"],
    notIncluded: [],
    cta: "Contact Sales",
  },
];

const ICON_MAP = { Free: Zap, Professional: Rocket, Business: Building, Enterprise: Crown };

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <PageLayout>
      <div className="container py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Start free. Upgrade when you're ready. No hidden fees, no surprises.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-muted rounded-xl p-1">
            <button onClick={() => setYearly(false)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${!yearly ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Monthly</button>
            <button onClick={() => setYearly(true)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${yearly ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              Yearly <span className="text-green-500 font-semibold ml-1">Save 35%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const price = yearly ? plan.price.yearly : plan.price.monthly;
            return (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`relative bg-card border-2 ${plan.popular ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]" : "border-border"} rounded-2xl p-6 flex flex-col`}>
                {plan.popular && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full">Most Popular</div>}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${plan.popular ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.desc}</p>
                <div className="mb-6">
                  {price === null ? (
                    <p className="text-3xl font-bold">Custom</p>
                  ) : (
                    <div>
                      <span className="text-3xl font-bold">{plan.currency}{price}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                      {yearly && price > 0 && <p className="text-xs text-green-500 mt-0.5">Billed ₹{price * 12}/year</p>}
                    </div>
                  )}
                </div>

                <Button className={`w-full mb-6 ${plan.popular ? "bg-gradient-to-r from-brand-500 to-purple-600 text-white" : ""}`} variant={plan.popular ? "default" : "outline"} size="lg">
                  {plan.cta}
                </Button>

                <div className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map(f => (
                    <div key={f} className="flex items-start gap-2 opacity-40">
                      <X className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Pricing FAQs</h2>
          <div className="space-y-4">
            {[
              ["Can I switch plans later?", "Yes, you can upgrade or downgrade at any time. Changes take effect immediately."],
              ["Is there a free trial?", "Professional and Business plans include a 14-day free trial with no credit card required."],
              ["What payment methods do you accept?", "We accept all major credit cards, UPI, Razorpay, Stripe, and bank transfers for annual plans."],
              ["What is the WorkSphere fee on transactions?", "We charge 8% on the first $500/₹40K earned, 5% on $500–$10K, and 3% above $10K."],
            ].map(([q, a]) => (
              <details key={q} className="bg-card border border-border rounded-xl p-5 cursor-pointer">
                <summary className="font-semibold text-sm list-none flex justify-between items-center">
                  {q} <span className="text-muted-foreground">+</span>
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
