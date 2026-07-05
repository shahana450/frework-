"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Search, Briefcase, ArrowRight, CheckCircle, Building2, Globe, Clock, IndianRupee } from "lucide-react";
import Link from "next/link";

const JOB_TYPES = [
  { icon: Building2, label: "Full-time", desc: "Permanent roles at growing companies" },
  { icon: Clock, label: "Part-time & Contract", desc: "Flexible short-term projects" },
  { icon: Globe, label: "Remote Jobs", desc: "Work from anywhere in India" },
  { icon: IndianRupee, label: "Freelance Projects", desc: "Get paid per project or milestone" },
];

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-xs font-bold tracking-widest uppercase mb-4">
            🚧 Launching Soon
          </div>
          <h1 className="text-4xl font-bold mb-2">Find Jobs & Projects</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Full-time, part-time, remote, and freelance opportunities — we&apos;re onboarding employers and clients now.
          </p>
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by role, skill or company..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white gap-2">
              <Search className="w-4 h-4" /> Search
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Job board launching soon</h2>
          <p className="text-muted-foreground mb-8">
            We&apos;re partnering with startups, SMEs, and growing businesses to bring you real, verified job listings.
            No recycled postings — every job is live and actively hiring.
          </p>

          {!submitted ? (
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-sm outline-none focus:border-blue-400 transition-colors"
              />
              <Button
                onClick={() => { if (email) setSubmitted(true); }}
                className="h-11 px-5 bg-blue-500 hover:bg-blue-600 text-white gap-2 shrink-0"
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

        <div className="mb-14">
          <p className="text-center text-xs font-bold tracking-widest uppercase text-muted-foreground mb-8">What we&apos;re launching</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {JOB_TYPES.map((t, i) => (
              <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-border bg-card">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <t.icon className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg mb-2">Hiring? Post your job for free.</h3>
          <p className="text-muted-foreground text-sm mb-5">
            Reach verified professionals and freelancers across India. Early employers get priority listing at no cost.
          </p>
          <Link href="/dashboard/job/submit">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
              Post a job — Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
