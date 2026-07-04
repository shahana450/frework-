"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Phone, ArrowRight, Star, Shield, Clock,
  BadgeCheck, FileText, TrendingUp, Building2, Users, Loader2,
} from "lucide-react";

const SERVICES = [
  "GST Registration",
  "GST Filing (Monthly / Quarterly)",
  "Income Tax Return (ITR)",
  "Company Registration (Pvt Ltd / LLP / OPC)",
  "Bookkeeping & Accounting",
  "Internal / Statutory Audit",
  "Tax Audit",
  "Pitch Deck Preparation",
  "DPR & Business Plan",
  "MSME / Udyam Registration",
  "Coworking Space",
  "Hire a Freelancer / Skilled Worker",
  "Post a Job",
  "Other",
];

const REVIEWS = [
  { name: "Ravi Menon", role: "Startup Founder, Bangalore", text: "Got GST registered in 3 days. The CA team was incredibly responsive. Worth every rupee.", stars: 5 },
  { name: "Priya Sharma", role: "Freelance Designer, Mumbai", text: "Found my best workspace through FreWork. Profile views tripled after getting the verified badge.", stars: 5 },
  { name: "Ankit Joshi", role: "SME Owner, Pune", text: "Bookkeeping and quarterly filing handled seamlessly. I can finally focus on my business.", stars: 5 },
];

const TRUST = [
  { icon: BadgeCheck, text: "ICAI-registered CA & CS experts" },
  { icon: Shield, text: "100% data security & confidentiality" },
  { icon: Clock, text: "Response within 2 hours" },
  { icon: Star, text: "4.9 / 5 from 500+ clients" },
];

const OFFERINGS = [
  { icon: FileText, label: "GST & Tax Filing", desc: "GSTR-1, 3B, ITR, TDS — handled by experts" },
  { icon: TrendingUp, label: "Business Growth", desc: "Bookkeeping, Audit, DPR, Pitch Decks" },
  { icon: Building2, label: "Workspaces", desc: "Premium coworking in 50+ cities" },
  { icon: Users, label: "Hire Talent", desc: "Verified freelancers & skilled workers" },
];

function LandingInner() {
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", service: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const utmData = {
    utm_source: params.get("utm_source") || "meta",
    utm_medium: params.get("utm_medium") || "paid",
    utm_campaign: params.get("utm_campaign") || "",
    source: "meta_ad",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) { setError("Please enter your name and mobile number."); return; }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...utmData }),
      });
      if (!res.ok) throw new Error("Submit failed");
      setDone(true);
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Lead");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>
          We&apos;ll call you back!
        </h2>
        <p className="text-white/50 text-base mb-2">Our CA/CS expert will reach you within <span className="text-white font-semibold">2 hours</span>.</p>
        <p className="text-white/30 text-sm mb-10">Check WhatsApp for a confirmation message.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/" className="px-6 py-3 rounded-xl border border-white/15 text-white/60 text-sm font-semibold hover:border-white/30 hover:text-white transition-all">
            Explore FreWork →
          </a>
          <a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl font-semibold text-sm text-[#0B1120]"
            style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)" }}>
            WhatsApp Us
          </a>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060C18] text-white">

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-[#C9A84C]/5 blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-purple-600/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-blue-600/4 blur-3xl" />
      </div>

      <div className="relative z-10">

        {/* ── Header ── */}
        <header className="border-b border-white/6 bg-[#060C18]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg width="30" height="30" viewBox="0 0 38 38" fill="none">
                <defs>
                  <linearGradient id="lp_logo" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#A855F7"/>
                  </linearGradient>
                </defs>
                <rect width="38" height="38" rx="10" fill="url(#lp_logo)"/>
                <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="19" y1="19" x2="19" y2="10"/><line x1="19" y1="19" x2="27" y2="24"/><line x1="19" y1="19" x2="11" y2="24"/>
                </g>
                <g fill="white"><circle cx="19" cy="19" r="3.2"/><circle cx="19" cy="10" r="2.2"/><circle cx="27" cy="24" r="2.2"/><circle cx="11" cy="24" r="2.2"/></g>
              </svg>
              <span className="font-bold text-white text-lg" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
            </div>
            <a href="tel:+919999999999"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C9A84C]/30 text-[#C9A84C] text-sm font-semibold hover:bg-[#C9A84C]/8 transition-all">
              <Phone className="w-3.5 h-3.5" /> Call Us Free
            </a>
          </div>
        </header>

        {/* ── Hero + Form ── */}
        <section className="max-w-6xl mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left — copy */}
          <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] text-xs font-bold tracking-widest uppercase mb-6">
              🇮🇳 India&apos;s Professional Growth Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-6"
              style={{ fontFamily: "var(--font-cormorant), serif" }}>
              Your CA/CS work,<br />
              <span style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                done in days.
              </span>
            </h1>

            <p className="text-white/55 text-lg leading-relaxed mb-8">
              GST filing, ITR, company registration, bookkeeping, audit — handled by <strong className="text-white">ICAI-registered experts</strong> at a fraction of CA firm rates.
            </p>

            {/* Offerings */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {OFFERINGS.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3.5 rounded-2xl border border-white/7 bg-white/3">
                  <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/85">{label}</p>
                    <p className="text-[10px] text-white/35 leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust */}
            <div className="space-y-2.5">
              {TRUST.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white/55">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — form */}
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
            <div className="rounded-3xl border-2 border-[#C9A84C]/30 p-8 relative overflow-hidden"
              style={{ background: "linear-gradient(160deg,#0E0B01 0%,#090B14 100%)", boxShadow: "0 0 80px rgba(201,168,76,0.12), 0 24px 64px rgba(0,0,0,0.5)" }}>

              {/* Gold glow top */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
                style={{ background: "linear-gradient(90deg,#E8C97A,#C9A84C,#A8883A)" }} />

              <div className="mb-6">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#C9A84C]/60 mb-1">Get a free consultation</p>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
                  Talk to an Expert Today
                </h2>
                <p className="text-white/35 text-sm mt-1">Free 30-min call · No obligation · Reply in 2 hours</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/50 mb-1.5 block">Full Name *</label>
                  <input
                    type="text" placeholder="e.g. Rahul Sharma" required
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#C9A84C]/50 focus:bg-white/7 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/50 mb-1.5 block">Mobile Number *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/40 font-semibold">+91</span>
                    <input
                      type="tel" placeholder="9876543210" required maxLength={10}
                      value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))}
                      className="w-full bg-white/5 border border-white/12 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#C9A84C]/50 focus:bg-white/7 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/50 mb-1.5 block">Email (optional)</label>
                  <input
                    type="email" placeholder="rahul@company.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#C9A84C]/50 focus:bg-white/7 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/50 mb-1.5 block">I need help with</label>
                  <select
                    value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                    className="w-full bg-[#0A0E1A] border border-white/12 rounded-xl px-4 py-3 text-sm text-white/70 outline-none focus:border-[#C9A84C]/50 transition-all cursor-pointer">
                    <option value="">Select a service…</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {error && (
                  <p className="text-red-400 text-xs border border-red-500/25 bg-red-500/8 rounded-xl px-4 py-3">{error}</p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-2xl font-black text-[#0B1120] text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C,#A8883A)" }}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                  {loading ? "Submitting…" : "Get Free Callback →"}
                </button>

                <p className="text-center text-[10px] text-white/20 leading-relaxed">
                  By submitting you agree to our Privacy Policy. We never share your data.
                </p>
              </form>
            </div>

            {/* Mini social proof */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="flex -space-x-2">
                {["R","P","A","S","M"].map((l, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-[#060C18] flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: ["#7C3AED","#C9A84C","#0EA5E9","#10B981","#F59E0B"][i] }}>
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/35">
                <span className="text-white/60 font-semibold">500+</span> professionals consulted this month
              </p>
            </div>
          </motion.div>
        </section>

        {/* ── Reviews ── */}
        <section className="border-t border-white/6 py-14 px-4">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-bold tracking-widest uppercase text-white/25 mb-8">What our clients say</p>
            <div className="grid md:grid-cols-3 gap-4">
              {REVIEWS.map((r) => (
                <motion.div key={r.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="rounded-2xl border border-white/8 bg-white/3 p-5">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: r.stars }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-[#C9A84C] fill-[#C9A84C]" />
                    ))}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
                  <div>
                    <p className="text-xs font-bold text-white/80">{r.name}</p>
                    <p className="text-[10px] text-white/30">{r.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer strip ── */}
        <footer className="border-t border-white/6 py-6 px-4 text-center">
          <p className="text-xs text-white/20">
            © 2026 FreWork · <a href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</a> · <a href="/terms" className="hover:text-white/40 transition-colors">Terms</a>
          </p>
        </footer>

      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    }>
      <LandingInner />
    </Suspense>
  );
}
