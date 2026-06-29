"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { MapPin, Users, Briefcase, FileText, Calculator, BookOpen, BarChart3, Presentation, Building2, GraduationCap, ArrowUpRight, Search, TrendingUp } from "lucide-react";

const findServices = [
  { icon: MapPin, title: "Coworking & Offices", desc: "Search and filter workspaces by city, size and amenities. Book directly.", href: "/coworking" },
  { icon: Users, title: "Freelancers", desc: "Browse talent by skill. View portfolios and contact to hire.", href: "/freelancers" },
  { icon: Briefcase, title: "Jobs", desc: "Search open vacancies and apply. Post a role for your team.", href: "/jobs" },
];

const growServices = [
  { icon: FileText, title: "Compliance", desc: "Income Tax filing, GST registration & returns, bookkeeping and ROC filings.", href: "/services/compliance", tag: "Most Popular" },
  { icon: BarChart3, title: "DPR", desc: "Detailed Project Reports for banks, investors and government schemes.", href: "/services/dpr", tag: null },
  { icon: Presentation, title: "Pitch Decks", desc: "Investor-ready decks built with financial models and storytelling.", href: "/services/pitch-decks", tag: null },
  { icon: Building2, title: "Business Restructuring", desc: "Strategy, M&A advisory, entity conversion and turnaround planning.", href: "/services/restructuring", tag: null },
  { icon: GraduationCap, title: "Training", desc: "Workshops on GST, accounting, startup finance and team skill-building.", href: "/services/training", tag: null },
];

function DoorSection({
  door,
  label,
  subtitle,
  accent,
  accentLight,
  icon: DoorIcon,
  items,
}: {
  door: "FIND" | "GROW";
  label: string;
  subtitle: string;
  accent: string;
  accentLight: string;
  icon: React.ElementType;
  items: { icon: React.ElementType; title: string; desc: string; href: string; tag?: string | null }[];
}) {
  const isFind = door === "FIND";
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
        >
          <DoorIcon className="w-5 h-5" style={{ color: accentLight }} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              {door}
            </h3>
            <span
              className="text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full"
              style={{ color: accentLight, background: `${accent}15`, border: `1px solid ${accent}25` }}
            >
              {label}
            </span>
          </div>
          <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Cards */}
      <div className={`grid gap-4 ${isFind ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {items.map((item, i) => (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
          >
            <Link
              href={item.href}
              className="group relative flex flex-col h-full rounded-2xl p-6 border transition-all duration-300 overflow-hidden"
              style={{
                background: "#070D1A",
                borderColor: "rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${accent}35`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}0D, transparent)` }}
              />

              {item.tag && (
                <span
                  className="absolute top-4 right-4 text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                  style={{ color: accentLight, background: `${accent}18`, border: `1px solid ${accent}30` }}
                >
                  {item.tag}
                </span>
              )}

              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 flex-shrink-0 transition-colors duration-300"
                style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}
              >
                <item.icon className="w-4.5 h-4.5 w-[18px] h-[18px]" style={{ color: accentLight }} />
              </div>

              <h4 className="text-base font-semibold text-white/90 mb-2 group-hover:text-white transition-colors">{item.title}</h4>
              <p className="text-sm text-white/38 leading-relaxed flex-1">{item.desc}</p>

              <div className="flex items-center gap-1 mt-5 text-xs font-medium transition-colors duration-300" style={{ color: `${accentLight}99` }}>
                <span className="group-hover:text-current" style={{ color: accentLight }}>
                  {isFind ? "Explore" : "Get quote"}
                </span>
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function ServicesGrid() {
  return (
    <section className="py-28 bg-[#070D1A]">
      <div className="container mx-auto px-4">

        <div className="text-center mb-20">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-white/30 uppercase mb-4">What FreWork does</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
            Two doors, one platform
          </h2>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mx-auto mt-4" />
        </div>

        <div className="space-y-20 max-w-6xl mx-auto">

          {/* FIND */}
          <DoorSection
            door="FIND"
            label="Marketplace"
            subtitle="Public users — search, browse and book"
            accent="#3B82F6"
            accentLight="#7DD3FC"
            icon={Search}
            items={findServices}
          />

          {/* Divider */}
          <div className="relative flex items-center gap-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/8 to-white/8" />
            <div className="flex-shrink-0 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03]">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">also</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/8 to-white/8" />
          </div>

          {/* GROW */}
          <DoorSection
            door="GROW"
            label="Business Services"
            subtitle="Businesses — request a quote and our experts handle it"
            accent="#C9A84C"
            accentLight="#E8C97A"
            icon={TrendingUp}
            items={growServices}
          />
        </div>
      </div>
    </section>
  );
}
