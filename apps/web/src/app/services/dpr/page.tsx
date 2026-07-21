import { Metadata } from "next";
import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import { BarChart3, CheckCircle2, ArrowRight, Landmark, PieChart, FileSpreadsheet, ClipboardList } from "lucide-react";

export const metadata: Metadata = {
  title: "Detailed Project Reports (DPR) — FreWork GROW",
  description: "Bank-ready, investor-ready DPRs for manufacturing, service, agri and infrastructure projects — prepared by expert professionals.",
};

const includes = [
  "Executive summary & project overview",
  "Market analysis & demand assessment",
  "Technical feasibility & plant/machinery details",
  "Financial projections (5-year P&L, Balance Sheet, Cash Flow)",
  "Break-even analysis & IRR / NPV / DSCR calculations",
  "Means of finance & bank loan repayment schedule",
  "Risk analysis & mitigation plan",
  "Promoter background & management profile",
  "Government scheme eligibility (PMEGP, MUDRA, Stand-Up India, etc.)",
];

const useCases = [
  { icon: Landmark, title: "Bank & NBFC Loans", d: "Term loans, working capital and project finance from PSU and private banks." },
  { icon: PieChart, title: "Investor / VC Funding", d: "Structured financial model and narrative for equity investors." },
  { icon: FileSpreadsheet, title: "Government Schemes", d: "PMEGP, MUDRA, Start-up India, PLI and state subsidy applications." },
  { icon: ClipboardList, title: "Internal Planning", d: "Board-level decision documents for new plants, expansions or diversification." },
];

const sectors = ["Manufacturing", "Food Processing", "Agri & Dairy", "Healthcare", "IT & ITES", "Renewable Energy", "Hospitality", "Retail & E-commerce", "Education", "Infrastructure"];

export default function DPRPage() {
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
            Detailed Project Reports
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Bank-ready and investor-ready DPRs that get loans approved and funding secured. Prepared by experienced CAs with deep sectoral knowledge.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-[#0B1120]"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
              Request a DPR <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-24 bg-[#070D1A]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>When you need a DPR</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {useCases.map((uc) => (
              <div key={uc.title} className="flex gap-4 rounded-2xl border border-white/6 bg-[#060C18] p-6 hover:border-[#C9A84C]/25 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <uc.icon className="w-5 h-5 text-[#C9A84C]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5">{uc.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{uc.d}</p>
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
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>What every DPR includes</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="rounded-2xl border border-[#C9A84C]/15 bg-[#070D1A] p-8">
            <div className="grid md:grid-cols-2 gap-4">
              {includes.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-white/55">
                  <CheckCircle2 className="w-4 h-4 text-[#C9A84C]/60 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sectors */}
      <section className="py-20 bg-[#070D1A]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-white mb-8" style={{ fontFamily: "var(--font-cormorant), serif" }}>Sectors we cover</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {sectors.map((s) => (
              <span key={s} className="px-4 py-2 rounded-full border border-white/8 bg-white/[0.03] text-sm text-white/50">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#060C18] border-t border-white/6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>Tell us about your project</h2>
          <p className="text-white/40 mb-8">Share the project type and purpose — we&apos;ll confirm turnaround time and fixed price within 24 hours.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Request a DPR <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
