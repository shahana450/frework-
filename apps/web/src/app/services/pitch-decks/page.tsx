import { Metadata } from "next";
import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import { Presentation, CheckCircle2, ArrowRight, LineChart, LayoutTemplate, FileText, Mic } from "lucide-react";

export const metadata: Metadata = {
  title: "Pitch Decks — FreWork GROW",
  description: "Investor-ready pitch decks with financial models and compelling storytelling, built by CA & business strategy professionals.",
};

const includes = [
  "Problem, solution & market opportunity slides",
  "Business model & revenue streams",
  "5-year financial projections (P&L, cash flow, cap table)",
  "Traction, milestones & roadmap",
  "Team & advisor bios",
  "Competitive landscape & positioning",
  "Funding ask, use of funds & return scenario",
  "Designed to match your brand",
];

const types = [
  { icon: Mic, title: "Seed / Angel Deck", d: "10–12 slides for early-stage investors. Focus on problem-solution fit and founding team." },
  { icon: LineChart, title: "Series A / B Deck", d: "15–20 slides with detailed financials, unit economics and growth plan." },
  { icon: LayoutTemplate, title: "Bank / NBFC Deck", d: "Structured for loan presentations — projections, collateral and repayment model." },
  { icon: FileText, title: "Competition / Accelerator", d: "Sharp, high-impact decks for Y Combinator, Shark Tank India and accelerator programmes." },
];

export default function PitchDecksPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-[#060C18] pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(201,168,76,0.09),transparent)]" />
        <div className="container mx-auto px-4 relative z-10 max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C9A84C]/25 bg-[#C9A84C]/8 text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-8">
            GROW · Professional Services
          </span>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Pitch Decks
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Investor-ready decks that tell your story and back it with rigorous financials. Built by CAs who understand what investors actually look for.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Get a free quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Deck types */}
      <section className="py-24 bg-[#070D1A]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Which deck do you need?</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {types.map((t) => (
              <div key={t.title} className="flex gap-4 rounded-2xl border border-white/6 bg-[#060C18] p-6 hover:border-[#C9A84C]/25 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <t.icon className="w-5 h-5 text-[#C9A84C]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5">{t.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{t.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="py-24 bg-[#060C18]">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Every deck includes</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="rounded-2xl border border-[#C9A84C]/15 bg-[#070D1A] p-8 grid md:grid-cols-2 gap-4">
            {includes.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-white/55">
                <CheckCircle2 className="w-4 h-4 text-[#C9A84C]/60 flex-shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#070D1A] border-t border-white/6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>Ready to raise?</h2>
          <p className="text-white/40 mb-8">Share your idea and funding stage — we&apos;ll confirm deliverables and price within 24 hours.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Start your deck <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
