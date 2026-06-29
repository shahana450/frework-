"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, Calculator, Building2, BookOpen, ClipboardCheck, BarChart3, Briefcase, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Building2,
    title: "Business Registration",
    desc: "Private Limited, LLP, OPC, Partnership — we handle everything end to end.",
    href: "/services/business-registration",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
  },
  {
    icon: FileText,
    title: "GST Services",
    desc: "GST registration, monthly filing, annual returns and audit support.",
    href: "/services/gst",
    color: "from-blue-500 to-cyan-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Calculator,
    title: "Income Tax",
    desc: "ITR filing for individuals, businesses and corporates. Notices & assessments.",
    href: "/services/income-tax",
    color: "from-green-500 to-emerald-600",
    bg: "bg-green-50 dark:bg-green-950/30",
  },
  {
    icon: BookOpen,
    title: "Accounting",
    desc: "Monthly bookkeeping, P&L statements, balance sheets and MIS reports.",
    href: "/services/accounting",
    color: "from-orange-500 to-amber-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    icon: ClipboardCheck,
    title: "Audit",
    desc: "Statutory audit, internal audit, tax audit and concurrent audit services.",
    href: "/services/audit",
    color: "from-red-500 to-rose-600",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  {
    icon: BarChart3,
    title: "ROC Compliance",
    desc: "Annual filings, director KYC, board resolutions and MCA compliance.",
    href: "/services/roc-compliance",
    color: "from-pink-500 to-fuchsia-600",
    bg: "bg-pink-50 dark:bg-pink-950/30",
  },
  {
    icon: Briefcase,
    title: "Virtual CFO",
    desc: "Strategic financial planning, cash flow management and investor reporting.",
    href: "/services/virtual-cfo",
    color: "from-teal-500 to-cyan-600",
    bg: "bg-teal-50 dark:bg-teal-950/30",
  },
];

export function ServicesGrid() {
  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Everything your business needs
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            From registration to compliance — one platform, one team.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={service.href} className={`group block p-6 rounded-2xl ${service.bg} border border-transparent hover:border-violet-200 dark:hover:border-violet-800 transition-all hover:shadow-lg hover:-translate-y-1`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-4 shadow-sm`}>
                  <service.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {service.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                  {service.desc}
                </p>
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Learn more <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
