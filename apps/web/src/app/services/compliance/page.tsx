import { Metadata } from "next";
import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import { FileText, Calculator, BookOpen, BarChart3, CheckCircle2, ArrowRight, Clock, ShieldCheck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Compliance Services — FreWork GROW",
  description: "Income Tax, GST, Accounts & Bookkeeping and ROC Compliance handled by CA & CS qualified professionals.",
};

const services = [
  {
    icon: Calculator,
    title: "Income Tax",
    items: ["ITR filing for individuals & businesses", "Advance tax calculations", "Tax planning & optimisation", "Notice handling & assessment support", "TDS returns (24Q / 26Q)"],
  },
  {
    icon: FileText,
    title: "GST",
    items: ["GST registration (Regular / Composition)", "Monthly & quarterly GSTR filing", "GST annual return (GSTR-9)", "Input tax credit reconciliation", "GST audit & notice support"],
  },
  {
    icon: BookOpen,
    title: "Accounts & Bookkeeping",
    items: ["Monthly bookkeeping & ledger maintenance", "P&L statement & Balance Sheet", "MIS reports & cash flow statements", "Bank reconciliation", "Payroll processing & Form 16"],
  },
  {
    icon: BarChart3,
    title: "ROC Compliance",
    items: ["Annual Return (MGT-7) & Financial Statements (AOC-4)", "Director KYC (DIR-3 KYC)", "Board meeting minutes & resolutions", "MCA form filing & charge registration", "Change of name / registered office / directors"],
  },
];

const steps = [
  { n: "01", t: "Tell us what you need", d: "Fill the quote form with your business type and compliance requirements." },
  { n: "02", t: "We confirm scope & price", d: "Our CA reviews your requirements and sends a fixed-price proposal within 24 hours." },
  { n: "03", t: "We get to work", d: "Your named CA handles all filings, portals and deadlines. You receive copies of everything." },
  { n: "04", t: "Ongoing support", d: "Monthly check-ins, deadline reminders and notice support included in your plan." },
];

export default function CompliancePage() {
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
            Compliance
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Income Tax, GST, Accounts & ROC filings — handled end-to-end by Chartered Accountants and Company Secretaries so you never miss a deadline.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-[#0B1120]"
              style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
              Get a free quote <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-medium text-white/70 border border-white/12 hover:border-white/25 hover:text-white transition-all">
              Talk to a CA
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-white/6 bg-[#070D1A] py-5">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-10 md:gap-20">
            {[
              [ShieldCheck, "100% Deadline Guarantee"],
              [Users, "CA & CS Qualified"],
              [Clock, "24-hr Response"],
            ].map(([Icon, label]: any) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-[#C9A84C]/60" />
                <span className="text-xs font-medium text-white/40 tracking-wide uppercase">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service breakdown */}
      <section className="py-24 bg-[#070D1A]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              What&apos;s covered
            </h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {services.map((svc) => (
              <div key={svc.title} className="rounded-2xl border border-white/6 bg-[#060C18] p-7 hover:border-[#C9A84C]/25 transition-colors">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center">
                    <svc.icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-[#C9A84C]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{svc.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {svc.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/50">
                      <CheckCircle2 className="w-4 h-4 text-[#C9A84C]/50 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-24 bg-[#060C18]">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              How it works
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-5 rounded-2xl border border-white/6 bg-[#070D1A] p-6">
                <span className="text-3xl font-bold text-[#C9A84C]/20 flex-shrink-0" style={{ fontFamily: "var(--font-cormorant), serif" }}>{s.n}</span>
                <div>
                  <h4 className="font-semibold text-white mb-1.5">{s.t}</h4>
                  <p className="text-sm text-white/40 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#070D1A] border-t border-white/6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>Ready to stay compliant?</h2>
          <p className="text-white/40 mb-8">Starting from ₹999/month. No hidden fees. Cancel anytime.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Get a free quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
