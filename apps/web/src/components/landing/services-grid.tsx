"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, Calculator, Building2, BookOpen, ClipboardCheck, BarChart3, Briefcase, ArrowUpRight } from "lucide-react";

const services = [
  { icon: Building2, title: "Business Registration", desc: "Pvt Ltd, LLP, OPC, Partnership — end-to-end incorporation.", href: "/services/business-registration", tag: "Most Popular" },
  { icon: FileText, title: "GST Services", desc: "Registration, monthly filing, annual returns and audit support.", href: "/services/gst", tag: null },
  { icon: Calculator, title: "Income Tax", desc: "ITR filing for individuals, businesses and corporates. Notices handled.", href: "/services/income-tax", tag: null },
  { icon: BookOpen, title: "Accounting", desc: "Monthly bookkeeping, P&L statements, balance sheets and MIS reports.", href: "/services/accounting", tag: null },
  { icon: ClipboardCheck, title: "Audit", desc: "Statutory, internal, tax audit and concurrent audit by qualified CAs.", href: "/services/audit", tag: null },
  { icon: BarChart3, title: "ROC Compliance", desc: "Annual filings, director KYC, board resolutions and MCA compliance.", href: "/services/roc-compliance", tag: null },
  { icon: Briefcase, title: "Virtual CFO", desc: "Strategic financial planning, cash flow management and investor reporting.", href: "/services/virtual-cfo", tag: "Premium" },
];

export function ServicesGrid() {
  return (
    <section className="py-28 bg-[#070D1A]">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-[#C9A84C]/70 uppercase mb-4">What We Do</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
            Everything your business needs
          </h2>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent mx-auto mb-4" />
          <p className="text-white/45 text-base max-w-md mx-auto">
            One platform. One expert team. Complete financial and legal compliance.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
            >
              <Link href={service.href} className="group relative flex flex-col p-6 rounded-2xl border border-white/6 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#C9A84C]/25 transition-all duration-300 h-full overflow-hidden">
                {/* Gold shimmer on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)" }} />

                {/* Tag */}
                {service.tag && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full"
                    style={{ background: "linear-gradient(135deg, #E8C97A20, #C9A84C30)", color: "#C9A84C", border: "1px solid #C9A84C30" }}>
                    {service.tag}
                  </span>
                )}

                {/* Icon */}
                <div className="w-11 h-11 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/8 flex items-center justify-center mb-5 group-hover:bg-[#C9A84C]/15 group-hover:border-[#C9A84C]/35 transition-all duration-300">
                  <service.icon className="w-5 h-5 text-[#C9A84C]" />
                </div>

                <h3 className="font-semibold text-white/90 mb-2 text-base group-hover:text-white transition-colors">
                  {service.title}
                </h3>
                <p className="text-sm text-white/35 leading-relaxed flex-1 mb-5">
                  {service.desc}
                </p>

                {/* Learn more */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#C9A84C]/60 group-hover:text-[#C9A84C] transition-colors">
                  <span>Learn more</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
