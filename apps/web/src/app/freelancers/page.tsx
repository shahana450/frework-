"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Search, Users, ArrowRight, CheckCircle,
  Code2, Palette, TrendingUp, Calculator,
  GraduationCap, Wrench, Zap, ChefHat, Shield,
} from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { icon: Calculator, label: "CA & CS", desc: "Tax, audit, compliance" },
  { icon: Code2, label: "Tech & Dev", desc: "Web, mobile, cloud" },
  { icon: Palette, label: "Design", desc: "UI/UX, branding, graphics" },
  { icon: TrendingUp, label: "Marketing", desc: "SEO, ads, content" },
  { icon: GraduationCap, label: "Teachers & Tutors", desc: "CBSE, JEE, IELTS, music" },
  { icon: Zap, label: "Electrician", desc: "Wiring, AC, solar" },
  { icon: Wrench, label: "Plumber & Carpenter", desc: "Repairs & installation" },
  { icon: ChefHat, label: "Cook & Chef", desc: "Home & event catering" },
  { icon: Shield, label: "Security", desc: "Licensed guards & CCTV" },
];

export default function FreelancersPage() {
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <PageLayout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 text-xs font-bold tracking-widest uppercase mb-4">
            🚧 Launching Soon
          </div>
          <h1 className="text-4xl font-bold mb-2">Hire Verified Freelancers</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Professionals, teachers, and skilled workers — all in one place. We&apos;re onboarding and verifying talent now.
          </p>
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by skill or name..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white gap-2">
              <Search className="w-4 h-4" /> Search
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-10">
        {/* Coming soon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Talent directory launching soon</h2>
          <p className="text-muted-foreground mb-8">
            Every freelancer on FreWork is manually reviewed before going live. No fake profiles, no stock photos.
            We&apos;re actively onboarding professionals across India right now.
          </p>

          {!submitted ? (
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-sm outline-none focus:border-purple-400 transition-colors"
              />
              <Button
                onClick={() => { if (email) setSubmitted(true); }}
                className="h-11 px-5 bg-purple-500 hover:bg-purple-600 text-white gap-2 shrink-0"
              >
                Notify me <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle className="w-5 h-5" /> You&apos;re on the list!
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">One email when we launch. No spam.</p>
        </motion.div>

        {/* Categories */}
        <div className="mb-14">
          <p className="text-center text-xs font-bold tracking-widest uppercase text-muted-foreground mb-8">Categories we&apos;re onboarding</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {CATEGORIES.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <c.icon className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA for freelancers */}
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg mb-2">Are you a freelancer or service provider?</h3>
          <p className="text-muted-foreground text-sm mb-5">
            Create your profile now and be among the first verified professionals on FreWork. Free forever for early members.
          </p>
          <Link href="/dashboard/freelancer/submit">
            <Button className="bg-purple-500 hover:bg-purple-600 text-white gap-2">
              Join as a freelancer — Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
