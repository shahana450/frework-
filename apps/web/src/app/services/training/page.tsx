import { Metadata } from "next";
import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import { GraduationCap, CheckCircle2, ArrowRight, Users, Video, BookOpen, Award } from "lucide-react";

export const metadata: Metadata = {
  title: "Training — FreWork GROW",
  description: "GST, accounting, startup finance and business workshops for teams and founders, delivered by CA & CS professionals.",
};

const programmes = [
  {
    icon: BookOpen,
    title: "GST & Tax Fundamentals",
    audience: "Business owners, finance teams",
    duration: "1 day / Half-day",
    topics: ["GST registration to filing", "Input tax credit rules", "Common compliance mistakes", "Handling notices"],
  },
  {
    icon: Award,
    title: "Accounting for Non-Accountants",
    audience: "Founders, operations managers",
    duration: "Half-day",
    topics: ["Reading P&L and Balance Sheet", "Cash flow vs profit", "Key ratios to track", "Budgeting basics"],
  },
  {
    icon: Users,
    title: "Startup Finance & Fundraising",
    audience: "Early-stage founders",
    duration: "1 day",
    topics: ["Cap table basics", "Financial models", "Term sheet essentials", "Investor due diligence prep"],
  },
  {
    icon: Video,
    title: "Custom Corporate Workshops",
    audience: "Finance & accounts teams",
    duration: "Custom",
    topics: ["Tailored to your team's gaps", "IND AS / IGAAP", "Internal controls", "MIS & reporting"],
  },
];

const formats = [
  { label: "In-person", d: "Conducted at your office or a venue you choose." },
  { label: "Online / Virtual", d: "Live interactive session over Zoom or Google Meet." },
  { label: "Recorded", d: "Custom video course your team can replay anytime." },
];

export default function TrainingPage() {
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
            Training
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Practical, jargon-free workshops on GST, accounting, startup finance and compliance — delivered by CAs who work with businesses every day.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Enquire about a workshop <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Programmes */}
      <section className="py-24 bg-[#070D1A]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Programmes</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {programmes.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/6 bg-[#060C18] p-7 hover:border-[#C9A84C]/25 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <p.icon className="w-[18px] h-[18px] text-[#C9A84C]" />
                  </div>
                  <h3 className="font-semibold text-white">{p.title}</h3>
                </div>
                <div className="flex gap-4 mb-5 pl-12">
                  <span className="text-xs text-white/35">{p.audience}</span>
                  <span className="text-xs text-[#C9A84C]/60">{p.duration}</span>
                </div>
                <ul className="space-y-2">
                  {p.topics.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-white/50">
                      <CheckCircle2 className="w-4 h-4 text-[#C9A84C]/50 flex-shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery formats */}
      <section className="py-20 bg-[#060C18]">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Delivery formats</h2>
            <div className="w-12 h-px bg-[#C9A84C]/30 mx-auto mt-4" />
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {formats.map((f) => (
              <div key={f.label} className="rounded-2xl border border-white/6 bg-[#070D1A] p-6 text-center hover:border-[#C9A84C]/20 transition-colors">
                <h4 className="font-semibold text-white mb-2">{f.label}</h4>
                <p className="text-sm text-white/40 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#070D1A] border-t border-white/6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>Upskill your team</h2>
          <p className="text-white/40 mb-8">Tell us your team size and topic — we&apos;ll design the right workshop and send a proposal.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-[#0B1120]"
            style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
            Enquire now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
