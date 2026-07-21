"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  FileText, Receipt, Building2, Users, MapPin, Briefcase,
  Calculator, ShieldCheck, BarChart3, Presentation, RefreshCcw,
  GraduationCap, ArrowUpRight, Landmark, BookOpen, Search,
  TrendingUp, UserCheck, Wallet, ClipboardList, Scale
} from "lucide-react";

const L = {
  bg: "#FAFAF5",
  bgAlt: "#F3F0E8",
  bgDark: "#1A1208",
  bgDark2: "#2C1F0A",
  text: "#1A1208",
  textSub: "#6B5B3E",
  textMuted: "#9C8B70",
  gold: "#B8903A",
  goldLight: "#E8C97A",
  goldDark: "#8C6A1E",
  border: "rgba(184,144,58,0.18)",
  borderLight: "rgba(184,144,58,0.1)",
  shadow: "0 2px 20px rgba(139,108,50,0.07)",
  shadowHover: "0 16px 48px rgba(139,108,50,0.14)",
};

const CATEGORIES = [
  {
    id: "tax",
    label: "Tax & Compliance",
    tagline: "Stay compliant. Never miss a deadline.",
    accent: "#2563EB",
    accentLight: "#3B82F6",
    accentBg: "rgba(37,99,235,0.06)",
    icon: FileText,
    services: [
      { icon: Receipt,       title: "GST Registration",        desc: "Register your business under GST — GSTIN in 3–5 working days with expert guidance.",        href: "/services/gst",           tag: "Popular" },
      { icon: FileText,      title: "GST Filing",              desc: "Monthly/quarterly GSTR-1, GSTR-3B filing with ITC reconciliation and GSTR-2B matching.",     href: "/services/gst",           tag: null },
      { icon: Landmark,      title: "Income Tax Return",       desc: "ITR filing for individuals, firms, LLPs and companies. Salary, business, capital gains.",     href: "/services/income-tax",    tag: "Deadline Alert" },
      { icon: ClipboardList, title: "ROC & MCA Compliance",   desc: "Annual filings, AOC-4, MGT-7, DIR-3 KYC, charge registration and statutory registers.",       href: "/services/roc-compliance", tag: null },
      { icon: ShieldCheck,   title: "TDS / TCS Filing",       desc: "Quarterly TDS returns, 26QB property TDS, TCS compliance and corrections for all deductors.", href: "/services/compliance",    tag: null },
    ],
  },
  {
    id: "accounting",
    label: "Accounting & CFO",
    tagline: "Your numbers, handled by experts.",
    accent: "#059669",
    accentLight: "#10B981",
    accentBg: "rgba(5,150,105,0.06)",
    icon: Calculator,
    services: [
      { icon: Calculator,  title: "Virtual Accountant",    desc: "Dedicated CA-supervised bookkeeper — daily entries, bank reconciliation, P&L every month.",    href: "/services/accounting",  tag: "Best Value" },
      { icon: Wallet,      title: "Virtual CFO",           desc: "Part-time CFO for growing startups — MIS, cash flow forecasting, investor reporting, board decks.", href: "/services/virtual-cfo", tag: null },
      { icon: BookOpen,    title: "Payroll Management",    desc: "Monthly payroll processing, PF/ESI/PT compliance, payslips and Form-16 generation.",             href: "/services/accounting",  tag: null },
      { icon: BarChart3,   title: "MIS & Reporting",       desc: "Custom management dashboards, ratio analysis and monthly financial health reports.",              href: "/services/accounting",  tag: null },
    ],
  },
  {
    id: "audit",
    label: "Audit & Assurance",
    tagline: "Trust through transparency.",
    accent: "#7C3AED",
    accentLight: "#8B5CF6",
    accentBg: "rgba(124,58,237,0.06)",
    icon: ShieldCheck,
    services: [
      { icon: ShieldCheck,  title: "Statutory Audit",          desc: "Companies Act 2013 statutory audit by qualified CAs with UDIN-signed audit reports.",        href: "/services/audit",  tag: null },
      { icon: Scale,        title: "Tax Audit (44AB)",         desc: "Mandatory tax audit for businesses above threshold — 3CB/3CD with complete computation.",    href: "/services/audit",  tag: null },
      { icon: Search,       title: "Internal Audit",           desc: "Risk-based internal audit, process reviews, control gap reports and management letters.",     href: "/services/audit",  tag: null },
      { icon: ClipboardList,title: "GST Audit & Reconciliation", desc: "GSTR-9C reconciliation, annual return audit and ITC reversal computation.",               href: "/services/audit",  tag: null },
      { icon: Building2,    title: "Stock & Fixed Asset Audit",desc: "Physical verification of inventory and fixed assets with tagged registers.",                  href: "/services/audit",  tag: null },
    ],
  },
  {
    id: "business",
    label: "Business Setup & Growth",
    tagline: "From idea to incorporated in days.",
    accent: "#B8903A",
    accentLight: "#E8C97A",
    accentBg: "rgba(184,144,58,0.07)",
    icon: Building2,
    services: [
      { icon: Building2,    title: "Company / LLP Registration",   desc: "Private Limited, OPC, LLP, Partnership — end-to-end incorporation with PAN, TAN & bank intro.", href: "/services/business-registration", tag: "Fast Track" },
      { icon: RefreshCcw,   title: "Business Restructuring",       desc: "M&A advisory, entity conversion, debt restructuring and turnaround strategy by experts.",        href: "/services/restructuring",         tag: null },
      { icon: Presentation, title: "Pitch Deck & DPR",             desc: "Investor-ready pitch decks with financial models and Detailed Project Reports for bank loans.",   href: "/services/dpr",                   tag: null },
      { icon: TrendingUp,   title: "Startup Funding Support",      desc: "Valuation, DPIIT registration, SEIS, MSME Udyam, angel investor introductions.",                 href: "/services/dpr",                   tag: null },
      { icon: GraduationCap,title: "Business & Tax Training",      desc: "Workshops on GST, accounting, startup finance for founders, teams and CA students.",             href: "/services/training",              tag: null },
    ],
  },
  {
    id: "find",
    label: "Find & Connect",
    tagline: "Discover spaces, talent and opportunities.",
    accent: "#EA580C",
    accentLight: "#F97316",
    accentBg: "rgba(234,88,12,0.06)",
    icon: Search,
    services: [
      { icon: MapPin,     title: "Coworking Spaces",   desc: "Search verified coworking spaces, private cabins and meeting rooms across India — book by hour or month.", href: "/coworking",   tag: "Launching Soon" },
      { icon: UserCheck,  title: "Find Freelancers",   desc: "Hire verified professionals, accountants, designers and developers. View portfolios, rates and reviews.",          href: "/freelancers", tag: null },
      { icon: Briefcase,  title: "Job Board",          desc: "Finance, accounting and business roles from trusted Indian companies. Post or apply — completely free.",     href: "/jobs",        tag: null },
      { icon: Users,      title: "Business Community", desc: "Connect with founders, CAs and business owners. Ask questions, share knowledge and grow together.",         href: "/community",   tag: null },
    ],
  },
];

function ServiceCard({
  service,
  accent,
  accentLight,
  accentBg,
  index,
}: {
  service: { icon: React.ElementType; title: string; desc: string; href: string; tag?: string | null };
  accent: string;
  accentLight: string;
  accentBg: string;
  index: number;
}) {
  const Icon = service.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Link
        href={service.href}
        className="group relative flex flex-col h-full rounded-2xl border p-6 transition-all duration-300 overflow-hidden"
        style={{ background: "#fff", borderColor: L.border, boxShadow: L.shadow }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = L.shadowHover;
          (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`;
          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = L.shadow;
          (e.currentTarget as HTMLElement).style.borderColor = L.border;
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
      >
        {/* Top accent bar */}
        <div className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(90deg, ${accent}, ${accentLight})` }} />

        {/* Subtle hover glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accent}06, transparent)` }} />

        {/* Tag */}
        {service.tag && (
          <span className="absolute top-4 right-4 text-[9px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
            style={{ color: accent, background: accentBg, border: `1px solid ${accent}25` }}>
            {service.tag}
          </span>
        )}

        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
          style={{ background: accentBg, border: `1px solid ${accent}20` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>

        <h4 className="font-black text-sm mb-2 leading-snug" style={{ color: L.text }}>{service.title}</h4>
        <p className="text-xs leading-relaxed flex-1" style={{ color: L.textSub }}>{service.desc}</p>

        <div className="flex items-center gap-1 mt-5 text-[11px] font-bold transition-all duration-200"
          style={{ color: `${accent}80` }}>
          <span className="group-hover:underline" style={{ color: accent }}>Learn more</span>
          <ArrowUpRight size={11} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" style={{ color: accent }} />
        </div>
      </Link>
    </motion.div>
  );
}

export function ServicesPage() {
  return (
    <div style={{ background: L.bg, color: L.text }}>
      <Navbar />

      {/* ── Hero ── */}
      <div className="relative overflow-hidden pt-36 pb-20 px-4"
        style={{ background: `linear-gradient(135deg, ${L.bgDark} 0%, ${L.bgDark2} 50%, ${L.bgDark} 100%)` }}>
        <div className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #B8903A, #E8C97A, #B8903A, transparent)" }} />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(184,144,58,0.1) 0%, transparent 65%)", filter: "blur(40px)" }} />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[11px] font-black tracking-[0.35em] uppercase mb-5" style={{ color: L.gold }}>
              Everything your business needs
            </p>
            <h1 className="font-black mb-5 leading-tight"
              style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)", color: "#FAFAF5", fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              One Platform.{" "}
              <span style={{ background: "linear-gradient(135deg, #E8C97A, #B8903A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                All Services.
              </span>
            </h1>
            <p className="text-base max-w-xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.8 }}>
              From GST filing to finding a coworking space — FreWork brings together
              CA-grade professional services, verified talent and workspace discovery under one roof.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-8">
              {[
                { value: "20+", label: "Services" },
                { value: "500+", label: "Clients Served" },
                { value: "professional", label: "Qualified Experts" },
                { value: "2 hrs", label: "Response Time" },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="font-black text-xl" style={{ color: L.goldLight }}>{value}</p>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Service Categories ── */}
      <main className="py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-20">
          {CATEGORIES.map((cat, ci) => {
            const CatIcon = cat.icon;
            return (
              <motion.div key={cat.id}
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}>

                {/* Category header */}
                <div className="flex items-start gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: cat.accentBg, border: `1px solid ${cat.accent}25` }}>
                    <CatIcon size={20} style={{ color: cat.accent }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-black text-2xl" style={{ color: L.text, fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
                        {cat.label}
                      </h2>
                      <span className="text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full"
                        style={{ background: cat.accentBg, color: cat.accent, border: `1px solid ${cat.accent}20` }}>
                        {cat.services.length} services
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: L.textMuted }}>{cat.tagline}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px mb-8" style={{ background: `linear-gradient(90deg, ${cat.accent}30, transparent)` }} />

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.services.map((svc, i) => (
                    <ServiceCard
                      key={svc.title}
                      service={svc}
                      accent={cat.accent}
                      accentLight={cat.accentLight}
                      accentBg={cat.accentBg}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* ── Bottom CTA ── */}
      <section className="py-20 px-4 mx-4 mb-12 rounded-3xl max-w-5xl lg:mx-auto"
        style={{ background: `linear-gradient(135deg, ${L.bgDark} 0%, ${L.bgDark2} 100%)`, border: `1px solid rgba(184,144,58,0.2)` }}>
        <div className="absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl"
          style={{ background: "linear-gradient(90deg, transparent, #B8903A, transparent)" }} />
        <div className="text-center">
          <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: L.gold }}>Not sure where to start?</p>
          <h2 className="font-black text-3xl mb-4" style={{ color: "#FAFAF5", fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
            Get a free 30-min consultation
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Our CA will understand your business and recommend exactly what you need — no upselling, no obligation.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #E8C97A, #B8903A)", color: L.bgDark, boxShadow: "0 6px 28px rgba(184,144,58,0.4)" }}>
              Book Free Consultation <ArrowUpRight size={15} />
            </Link>
            <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20need%20help%20choosing%20a%20service"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm transition-all hover:scale-[1.02]"
              style={{ background: "rgba(37,211,102,0.12)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.123 1.522 5.854L.054 23.267a.75.75 0 0 0 .918.918l5.413-1.468A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.5-5.22-1.37l-.374-.213-3.876 1.052 1.017-3.742-.231-.386A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
