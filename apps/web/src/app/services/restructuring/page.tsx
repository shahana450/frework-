import { Metadata } from "next";
import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import { Building2, CheckCircle2, ArrowRight, RefreshCcw, GitMerge, TrendingDown, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Business Restructuring — FreWork GROW",
  description: "Entity conversion, M&A advisory, turnaround planning and strategic restructuring by CA & CS professionals.",
};

const services = [
  { icon: RefreshCcw, title: "Entity Conversion", d: "Proprietorship to Pvt Ltd, partnership to LLP, OPC to company — seamless legal conversion with minimal disruption." },
  { icon: GitMerge, title: "Mergers & Acquisitions", d: "Due diligence, valuation, deal structuring and post-merger integration support for SMEs." },
  { icon: TrendingDown, title: "Turnaround Planning", d: "Cash flow repair, debt restructuring, cost rationalisation and stakeholder negotiation for distressed businesses." },
  { icon: Scale, title: "Strategic Restructuring", d: "Group simplification, holding company setup, ESOP structuring and tax-efficient business reorganisation." },
];

const deliverables = [
  "Current structure analysis & gap assessment",
  "Restructuring options memo with pros / cons",
  "Financial impact modelling",
  "Regulatory roadmap (RoC, RBI, FEMA where applicable)",
  "Implementation timeline & project plan",
  "All MCA / NCLT / RoC filings handled",
  "Post-restructuring compliance calendar",
];

export default function RestructuringPage() {
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
            Business Restructuring
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Strategy, M&A advisory, entity conversion and turnaround planning — executed by experienced CA & CS professionals who understand both the law and the business.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Get a free consultation <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="py-24 bg-[#070D1A]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>What we handle</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {services.map((s) => (
              <div key={s.title} className="flex gap-4 rounded-2xl border border-white/6 bg-[#060C18] p-6 hover:border-[#C9A84C]/25 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-5 h-5 text-[#C9A84C]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5">{s.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="py-24 bg-[#060C18]">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>What you receive</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="rounded-2xl border border-[#C9A84C]/15 bg-[#070D1A] p-8 space-y-4">
            {deliverables.map((item) => (
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
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>Let&apos;s talk about your situation</h2>
          <p className="text-white/40 mb-8">No commitment — the first call is free. We&apos;ll listen and tell you what&apos;s possible.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Book a free call <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
