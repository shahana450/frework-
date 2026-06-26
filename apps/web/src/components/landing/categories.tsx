"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  Code2, Brain, Calculator, Scale, Stethoscope, Building, Cog, Palette,
  Video, Camera, Megaphone, SearchCheck, DollarSign, UserCog, LineChart,
  BookOpen, Languages, Factory, HardHat, Home, Building2, HeartPulse, GraduationCap,
} from "lucide-react";

const categories = [
  { label: "Software Dev", icon: Code2, count: "120K+", color: "from-blue-500 to-cyan-500", href: "/freelancers?category=software" },
  { label: "AI & ML", icon: Brain, count: "45K+", color: "from-purple-500 to-pink-500", href: "/freelancers?category=ai" },
  { label: "Accounting", icon: Calculator, count: "80K+", color: "from-green-500 to-emerald-500", href: "/freelancers?category=accounting" },
  { label: "Legal", icon: Scale, count: "30K+", color: "from-yellow-500 to-orange-500", href: "/freelancers?category=legal" },
  { label: "Healthcare", icon: Stethoscope, count: "25K+", color: "from-red-500 to-rose-500", href: "/freelancers?category=healthcare" },
  { label: "Architecture", icon: Building, count: "18K+", color: "from-stone-500 to-amber-500", href: "/freelancers?category=architecture" },
  { label: "Engineering", icon: Cog, count: "90K+", color: "from-slate-500 to-blue-500", href: "/freelancers?category=engineering" },
  { label: "Graphic Design", icon: Palette, count: "200K+", color: "from-pink-500 to-rose-500", href: "/freelancers?category=design" },
  { label: "Video Editing", icon: Video, count: "55K+", color: "from-violet-500 to-purple-500", href: "/freelancers?category=video" },
  { label: "Photography", icon: Camera, count: "40K+", color: "from-amber-500 to-yellow-500", href: "/freelancers?category=photography" },
  { label: "Marketing", icon: Megaphone, count: "110K+", color: "from-orange-500 to-red-500", href: "/freelancers?category=marketing" },
  { label: "SEO", icon: SearchCheck, count: "65K+", color: "from-teal-500 to-green-500", href: "/freelancers?category=seo" },
  { label: "Finance", icon: DollarSign, count: "75K+", color: "from-emerald-500 to-teal-500", href: "/freelancers?category=finance" },
  { label: "HR", icon: UserCog, count: "35K+", color: "from-indigo-500 to-blue-500", href: "/freelancers?category=hr" },
  { label: "Consulting", icon: LineChart, count: "60K+", color: "from-cyan-500 to-blue-500", href: "/freelancers?category=consulting" },
  { label: "Teaching", icon: BookOpen, count: "95K+", color: "from-lime-500 to-green-500", href: "/freelancers?category=teaching" },
  { label: "Translation", icon: Languages, count: "50K+", color: "from-fuchsia-500 to-pink-500", href: "/freelancers?category=translation" },
  { label: "Manufacturing", icon: Factory, count: "20K+", color: "from-zinc-500 to-slate-500", href: "/freelancers?category=manufacturing" },
  { label: "Construction", icon: HardHat, count: "28K+", color: "from-yellow-600 to-amber-500", href: "/freelancers?category=construction" },
  { label: "Interior Design", icon: Home, count: "32K+", color: "from-rose-500 to-pink-500", href: "/freelancers?category=interior" },
  { label: "Real Estate", icon: Building2, count: "45K+", color: "from-blue-600 to-indigo-500", href: "/freelancers?category=realestate" },
  { label: "Education", icon: GraduationCap, count: "70K+", color: "from-green-600 to-lime-500", href: "/freelancers?category=education" },
];

export function Categories() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24" ref={ref}>
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Browse by Category</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Find experts across 50+ professional categories, from tech to creative arts.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: i * 0.04, duration: 0.4 }}
            >
              <Link
                href={cat.href}
                className="group flex flex-col items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                  <cat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.count}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
          >
            View all categories →
          </Link>
        </div>
      </div>
    </section>
  );
}
