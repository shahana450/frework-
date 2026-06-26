"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    description: "Perfect for getting started",
    badge: null,
    features: [
      "5 job applications/month",
      "Basic profile",
      "Community access",
      "1 active project",
      "Standard support",
    ],
    cta: "Get Started",
    ctaHref: "/register",
    variant: "outline" as const,
  },
  {
    name: "Professional",
    price: { monthly: 29, yearly: 19 },
    description: "For serious freelancers & clients",
    badge: "Most Popular",
    features: [
      "Unlimited applications",
      "Featured profile",
      "AI Proposal Generator",
      "AI Resume Builder",
      "10 active projects",
      "Priority support",
      "Advanced analytics",
      "Video interviews",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register?plan=professional",
    variant: "default" as const,
  },
  {
    name: "Business",
    price: { monthly: 99, yearly: 69 },
    description: "For agencies & growing teams",
    badge: null,
    features: [
      "Everything in Professional",
      "Team collaboration (10 seats)",
      "API access",
      "Custom contracts",
      "Dedicated account manager",
      "White-label invoices",
      "Bulk hiring tools",
      "SLA guarantee",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register?plan=business",
    variant: "outline" as const,
  },
  {
    name: "Enterprise",
    price: { monthly: null, yearly: null },
    description: "For large organizations",
    badge: null,
    features: [
      "Everything in Business",
      "Unlimited seats",
      "Custom integrations",
      "SSO / SAML",
      "On-premise deployment",
      "Dedicated infrastructure",
      "24/7 premium support",
      "Custom SLA",
    ],
    cta: "Contact Sales",
    ctaHref: "/contact",
    variant: "outline" as const,
  },
];

export function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="py-24" id="pricing">
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 mt-8 bg-muted rounded-xl p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billing === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Yearly
              <span className="text-xs text-green-500 font-semibold">Save 35%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-card border rounded-2xl p-6 flex flex-col ${
                plan.badge ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" : "border-border"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Zap className="w-3 h-3 mr-1" />
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price.monthly !== null ? (
                    <>
                      <span className="text-4xl font-bold">
                        ${billing === "monthly" ? plan.price.monthly : plan.price.yearly}
                      </span>
                      <span className="text-muted-foreground text-sm">/month</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">Custom</span>
                  )}
                </div>
                {billing === "yearly" && plan.price.monthly !== null && plan.price.monthly > 0 && (
                  <p className="text-xs text-green-500 mt-1">
                    Billed ${(plan.price.yearly! * 12).toFixed(0)}/year
                  </p>
                )}
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={plan.badge ? "default" : "outline"}
                className={`w-full ${plan.badge ? "bg-gradient-to-r from-brand-500 to-purple-600 text-white hover:from-brand-600 hover:to-purple-700" : ""}`}
              >
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
