"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does FreWork verify freelancers?",
    a: "Every freelancer goes through our multi-step verification process: identity verification (KYC), skill assessments, portfolio review, and background checks for premium tiers. Verified badges are awarded to freelancers who pass all checks.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support Stripe, PayPal, Razorpay, and Wise. Payments are held in escrow and released to freelancers only after client approval. We support 50+ currencies and automatic tax invoice generation.",
  },
  {
    q: "How does the escrow system work?",
    a: "When a client hires a freelancer, the agreed amount is held securely in FreWork escrow. Funds are released milestone by milestone as work is approved. In case of disputes, our resolution team mediates within 48 hours.",
  },
  {
    q: "Can I book a coworking space for a team?",
    a: "Absolutely. You can book anywhere from 1 hot desk to entire floors. Corporate accounts get centralized billing, booking management for your whole team, and access to verified spaces across India's major cities.",
  },
  {
    q: "How does the Startup Hub work for fundraising?",
    a: "Startups can upload their pitch deck, financials, and team profile. Investors browse using our AI matching engine based on sector, stage, geography, and investment size. Meeting scheduling, NDAs, and term sheet signing all happen on the platform.",
  },
  {
    q: "Is there a mobile app?",
    a: "Yes. FreWork is available on iOS and Android with full feature parity. You can manage projects, chat with clients, book workspaces, and track payments on the go.",
  },
  {
    q: "What's the platform fee?",
    a: "FreWork charges a 5% platform fee on transactions, which is among the lowest in the industry. The fee covers payment processing, escrow, dispute resolution, and platform maintenance. Enterprise plans have custom fee structures.",
  },
  {
    q: "Can agencies use FreWork?",
    a: "Yes. Agency accounts support team management, shared client dashboards, branded proposals, and bulk project management. You can manage multiple client accounts under one login with role-based permissions.",
  },
];

export function FAQ() {
  return (
    <section className="py-24 bg-muted/20">
      <div className="container max-w-3xl">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about FreWork
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="bg-card border border-border rounded-xl px-6"
            >
              <AccordionTrigger className="text-left font-semibold text-base hover:no-underline py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
