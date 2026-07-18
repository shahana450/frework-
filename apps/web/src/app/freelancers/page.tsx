"use client";

import { useState, useMemo } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MapPin, CheckCircle, ArrowRight, Phone,
  Code2, Palette, TrendingUp, Calculator, GraduationCap,
  Wrench, Zap, ChefHat, Shield, Clock, Briefcase,
  Camera, Music2, Heart, Home, Scale, Megaphone,
  Languages, Dumbbell, Truck, Scissors, FlowerIcon as Flower,
  X, Loader2, User, Mail,
} from "lucide-react";
import Link from "next/link";

const CITIES = ["All Cities","Mumbai","Delhi","Bangalore","Hyderabad","Pune","Chennai","Gurgaon","Noida","Kolkata","Ahmedabad","Jaipur","Kochi","Chandigarh","Indore","Surat"];

const CATEGORIES = [
  { icon: Calculator,    label: "CA & CS",               color: "#1E40AF", bg: "rgba(30,64,175,0.08)" },
  { icon: Scale,         label: "Legal",                 color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  { icon: Code2,         label: "Tech & Dev",            color: "#0891B2", bg: "rgba(8,145,178,0.08)" },
  { icon: Palette,       label: "Design & Creative",     color: "#EC4899", bg: "rgba(236,72,153,0.08)" },
  { icon: TrendingUp,    label: "Digital Marketing",     color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { icon: Megaphone,     label: "Content & Copywriting", color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  { icon: Camera,        label: "Photography & Video",   color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  { icon: GraduationCap, label: "Teaching & Tutoring",   color: "#0891B2", bg: "rgba(8,145,178,0.08)" },
  { icon: Zap,           label: "Electrician",           color: "#B45309", bg: "rgba(180,83,9,0.08)" },
  { icon: Wrench,        label: "Plumber & Carpenter",   color: "#64748B", bg: "rgba(100,116,139,0.08)" },
  { icon: ChefHat,       label: "Cook & Catering",       color: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  { icon: Shield,        label: "Security",              color: "#374151", bg: "rgba(55,65,81,0.08)" },
  { icon: Heart,         label: "Healthcare & Wellness", color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  { icon: Home,          label: "Interior Design",       color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  { icon: Languages,     label: "Translation",           color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { icon: Music2,        label: "Music & Events",        color: "#EC4899", bg: "rgba(236,72,153,0.08)" },
  { icon: Dumbbell,      label: "Fitness & Yoga",        color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  { icon: Truck,         label: "Logistics & Driver",    color: "#374151", bg: "rgba(55,65,81,0.08)" },
  { icon: Scissors,      label: "Salon & Beauty",        color: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  { icon: Flower,        label: "Vastu & Astrology",     color: "#D97706", bg: "rgba(217,119,6,0.08)" },
];

const EXPERIENCE_LEVELS = ["All Levels", "0–2 yrs (Junior)", "3–5 yrs (Mid)", "6–10 yrs (Senior)", "10+ yrs (Expert)"];

interface Freelancer {
  id: string; name: string; title: string; category: string;
  city: string; rating: number; reviews: number; rate: number; rateUnit: string;
  experience: string; expYears: number;
  skills: string[]; badge: string | null; badgeColor: string;
  available: boolean; completedJobs: number; phone: string;
  about: string;
}

const FREELANCERS: Freelancer[] = [];

interface HireTarget { name: string; title: string; city: string; rate: number; rateUnit: string; }

export default function FreelancersPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [city,           setCity]           = useState("All Cities");
  const [expLevel,       setExpLevel]       = useState("All Levels");
  const [query,          setQuery]          = useState("");
  const [hireTarget,     setHireTarget]     = useState<HireTarget | null>(null);
  const [hireForm,       setHireForm]       = useState({ name: "", phone: "", email: "", message: "" });
  const [hireLoading,    setHireLoading]    = useState(false);
  const [hireDone,       setHireDone]       = useState(false);

  const filtered = useMemo(() => FREELANCERS.filter(f => {
    if (activeCategory !== "All"       && f.category !== activeCategory) return false;
    if (city           !== "All Cities" && f.city     !== city)           return false;
    if (expLevel !== "All Levels") {
      if (expLevel === "0–2 yrs (Junior)"  && f.expYears > 2)  return false;
      if (expLevel === "3–5 yrs (Mid)"     && (f.expYears < 3 || f.expYears > 5)) return false;
      if (expLevel === "6–10 yrs (Senior)" && (f.expYears < 6 || f.expYears > 10)) return false;
      if (expLevel === "10+ yrs (Expert)"  && f.expYears <= 10) return false;
    }
    const q = query.toLowerCase();
    return !q || f.name.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)
              || f.category.toLowerCase().includes(q) || f.skills.some(s => s.toLowerCase().includes(q));
  }), [activeCategory, city, expLevel, query]);

  const submitHire = async () => {
    if (!hireTarget || !hireForm.name || !hireForm.phone) return;
    setHireLoading(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "freelancer_inquiry",
        name: hireForm.name, phone: hireForm.phone, email: hireForm.email,
        message: hireForm.message,
        meta: { freelancer: hireTarget.name, title: hireTarget.title, city: hireTarget.city, rate: hireTarget.rate },
      }),
    });
    setHireLoading(false);
    setHireDone(true);
  };

  const closeModal = () => { setHireTarget(null); setHireForm({ name:"", phone:"", email:"", message:"" }); setHireDone(false); };

  return (
    <PageLayout>
      {/* ── Hire Modal ── */}
      <AnimatePresence>
        {hireTarget && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale:0.95, y:16 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:16 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 relative">
              <button onClick={closeModal} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
              {hireDone ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Inquiry Sent!</h3>
                  <p className="text-sm text-slate-500 mb-4">Our team will connect you with <strong>{hireTarget.name}</strong> within 2 hours on WhatsApp.</p>
                  <button onClick={closeModal} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">Done</button>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-bold text-blue-600 tracking-wider uppercase mb-1">Hiring Request</p>
                    <h3 className="text-xl font-black text-slate-900">{hireTarget.name}</h3>
                    <p className="text-sm text-slate-500">{hireTarget.title} · {hireTarget.city} · ₹{hireTarget.rate.toLocaleString("en-IN")}/{hireTarget.rateUnit}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Your Name *" value={hireForm.name}
                        onChange={e => setHireForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="tel" placeholder="Mobile Number *" value={hireForm.phone}
                        onChange={e => setHireForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"").slice(0,10) }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" placeholder="Email (optional)" value={hireForm.email}
                        onChange={e => setHireForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <textarea rows={3} placeholder="Describe your requirement..." value={hireForm.message}
                      onChange={e => setHireForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 resize-none" />
                    <button onClick={submitHire} disabled={hireLoading || !hireForm.name || !hireForm.phone}
                      className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                      {hireLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send Hiring Request"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#0F2044 0%,#1E3A8A 100%)" }} className="border-b border-blue-900">
        <div className="container py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Coming Soon — Accepting Applications
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Hire Verified<br />
            <span style={{ background:"linear-gradient(90deg,#60A5FA,#93C5FD)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              Freelancers & Experts
            </span>
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-xl">
            CAs, lawyers, developers, designers, teachers, skilled workers & more — all verified, across 16 cities in India.
          </p>
          <div className="flex gap-2 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by skill, name, category or city..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800" />
            </div>
            <button className="h-12 px-6 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ background:"linear-gradient(135deg,#2563EB,#1246C8)" }}>
              <Search className="w-4 h-4" /> Search
            </button>
          </div>
          <div className="flex flex-wrap gap-6 mt-10">
            {[[String(CATEGORIES.length),"Categories"],["16","Cities"],["Free","To List Your Profile"],["Verified","Professionals Only"]].map(([v,l]) => (
              <div key={l}><p className="text-xl font-black text-white">{v}</p><p className="text-blue-300 text-xs">{l}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-10">

        {/* Filters panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-8">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Filter Professionals</p>
          <div className="space-y-5">

            {/* Category */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {["All", ...CATEGORIES.map(c => c.label)].map(cat => {
                  const catDef = CATEGORIES.find(c => c.label === cat);
                  const isActive = activeCategory === cat;
                  return (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border"
                      style={isActive
                        ? { background: catDef?.color ?? "#0F172A", color:"#fff", borderColor: catDef?.color ?? "#0F172A" }
                        : { background:"#fff", color:"#475569", borderColor:"#E2E8F0" }}>
                      {catDef && <catDef.icon className="w-3 h-3" />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">City</p>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => (
                  <button key={c} onClick={() => setCity(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${city===c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Experience Level</p>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_LEVELS.map(e => (
                  <button key={e} onClick={() => setExpLevel(e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${expLevel===e ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500 font-medium">{filtered.length} professional{filtered.length!==1?"s":""} found</p>
          <button onClick={() => { setActiveCategory("All"); setCity("All Cities"); setExpLevel("All Levels"); setQuery(""); }}
            className="text-xs text-blue-600 font-semibold hover:underline">Clear all filters</button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((f, i) => (
            <motion.div key={f.id}
              initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_32px_rgba(15,32,68,0.12)] hover:border-blue-200 transition-all flex flex-col"
            >
              {/* Coloured top strip */}
              <div className="h-1" style={{ background: CATEGORIES.find(c=>c.label===f.category)?.color ?? "#2563EB" }} />

              <div className="p-5 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white border border-slate-100"
                      style={{ background: CATEGORIES.find(c=>c.label===f.category)?.color ?? "#2563EB" }}>
                      {f.name[0]}
                    </div>
                    {f.available && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" title="Available now" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base">{f.name}</h3>
                      {f.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: f.badgeColor }}>{f.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{f.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400" />{f.rating} ({f.reviews})
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" />{f.city}
                      </span>
                    </div>
                  </div>
                </div>

                {/* About */}
                <p className="text-[12px] text-slate-500 mb-3 leading-relaxed line-clamp-2">{f.about}</p>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {f.skills.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] text-slate-600 font-medium">{s}</span>
                  ))}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.experience}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{f.completedJobs.toLocaleString()} jobs</span>
                  <span className={`flex items-center gap-1 font-semibold ${f.available ? "text-emerald-600" : "text-slate-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${f.available ? "bg-emerald-400" : "bg-slate-300"}`} />
                    {f.available ? "Available" : "Busy"}
                  </span>
                </div>

                {/* Rate + CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                  <div>
                    <p className="text-lg font-black text-slate-900">
                      ₹{f.rate.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-slate-400">/{f.rateUnit}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Starting rate</p>
                  </div>
                  <button
                    onClick={() => { setHireTarget({ name:f.name, title:f.title, city:f.city, rate:f.rate, rateUnit:f.rateUnit }); setHireDone(false); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                    style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                    <Phone className="w-3.5 h-3.5" /> Hire Now
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Verified professionals coming soon</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              We are currently onboarding and verifying CAs, lawyers, developers, and other experts.<br />
              All profiles go through manual verification before they go live.
            </p>
            <p className="text-xs text-slate-400 mb-5">Are you a professional? Be among the first to list — free forever for early members.</p>
            <Link href="/dashboard/freelancer/submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
              Apply to List Your Profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Join as freelancer CTA */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg text-slate-900 mb-2">Are you a freelancer or service provider?</h3>
          <p className="text-slate-500 text-sm mb-5">Create your profile on FreWork and get hired by verified businesses across India. Free forever for early members.</p>
          <Link href="/dashboard/freelancer/submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
            Join as a Freelancer — Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
