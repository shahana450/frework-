"use client";

import { useState, useMemo } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { motion } from "framer-motion";
import {
  Search, Star, MapPin, CheckCircle, ArrowRight, Phone,
  Code2, Palette, TrendingUp, Calculator, GraduationCap,
  Wrench, Zap, ChefHat, Shield, Clock, Briefcase,
} from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { icon: Calculator, label: "CA & CS", color: "#1E40AF", bg: "rgba(30,64,175,0.08)" },
  { icon: Code2,      label: "Tech & Dev", color: "#0891B2", bg: "rgba(8,145,178,0.08)" },
  { icon: Palette,    label: "Design",    color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  { icon: TrendingUp, label: "Marketing", color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { icon: GraduationCap, label: "Teachers", color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  { icon: Zap,        label: "Electrician", color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  { icon: Wrench,     label: "Plumber & Carpenter", color: "#B45309", bg: "rgba(180,83,9,0.08)" },
  { icon: ChefHat,    label: "Cook & Chef", color: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  { icon: Shield,     label: "Security",  color: "#374151", bg: "rgba(55,65,81,0.08)" },
];

const FREELANCERS = [
  {
    id: "1", name: "Priya Sharma", title: "Chartered Accountant (CA)", category: "CA & CS",
    city: "Mumbai", rating: 4.9, reviews: 87, rate: 1500, rateUnit: "hr",
    experience: "8 yrs", skills: ["GST Filing", "ITR", "Tax Planning", "Audit"],
    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&q=80",
    badge: "Top CA", badgeColor: "#1E40AF", available: true, completedJobs: 340,
    phone: "918590874681",
  },
  {
    id: "2", name: "Rahul Verma", title: "Full-Stack Developer", category: "Tech & Dev",
    city: "Bangalore", rating: 4.8, reviews: 124, rate: 2000, rateUnit: "hr",
    experience: "6 yrs", skills: ["React", "Node.js", "Next.js", "AWS"],
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80",
    badge: "Top Rated", badgeColor: "#0891B2", available: true, completedJobs: 218,
    phone: "918590874681",
  },
  {
    id: "3", name: "Ananya Krishnan", title: "UI/UX Designer", category: "Design",
    city: "Hyderabad", rating: 4.9, reviews: 96, rate: 1800, rateUnit: "hr",
    experience: "5 yrs", skills: ["Figma", "Branding", "Web Design", "Mobile UI"],
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&q=80",
    badge: "Designer Pro", badgeColor: "#7C3AED", available: true, completedJobs: 175,
    phone: "918590874681",
  },
  {
    id: "4", name: "Arjun Mehta", title: "Digital Marketing Expert", category: "Marketing",
    city: "Delhi", rating: 4.7, reviews: 63, rate: 1200, rateUnit: "hr",
    experience: "7 yrs", skills: ["SEO", "Google Ads", "Meta Ads", "Content"],
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&q=80",
    badge: null, badgeColor: "", available: true, completedJobs: 142,
    phone: "918590874681",
  },
  {
    id: "5", name: "Deepa Nair", title: "CBSE Maths & Science Tutor", category: "Teachers",
    city: "Pune", rating: 4.9, reviews: 211, rate: 600, rateUnit: "hr",
    experience: "10 yrs", skills: ["Class 9-12", "JEE Prep", "CBSE", "ICSE"],
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80",
    badge: "⭐ Expert Tutor", badgeColor: "#D97706", available: true, completedJobs: 890,
    phone: "918590874681",
  },
  {
    id: "6", name: "Suresh Electricals", title: "Licensed Electrician", category: "Electrician",
    city: "Chennai", rating: 4.8, reviews: 178, rate: 400, rateUnit: "visit",
    experience: "12 yrs", skills: ["Wiring", "AC Install", "Solar Panel", "CCTV"],
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&q=80",
    badge: "Govt. Licensed", badgeColor: "#DC2626", available: true, completedJobs: 630,
    phone: "918590874681",
  },
  {
    id: "7", name: "Vikram CS Associates", title: "Company Secretary (CS)", category: "CA & CS",
    city: "Gurgaon", rating: 4.7, reviews: 54, rate: 2500, rateUnit: "hr",
    experience: "9 yrs", skills: ["Company Reg.", "ROC Filing", "MCA", "FEMA"],
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80",
    badge: null, badgeColor: "", available: false, completedJobs: 98,
    phone: "918590874681",
  },
  {
    id: "8", name: "Meena Homefoods", title: "Home Cook & Catering", category: "Cook & Chef",
    city: "Bangalore", rating: 4.9, reviews: 302, rate: 800, rateUnit: "day",
    experience: "8 yrs", skills: ["South Indian", "North Indian", "Event Catering", "Tiffin"],
    avatar: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=120&q=80",
    badge: "Popular", badgeColor: "#BE185D", available: true, completedJobs: 1200,
    phone: "918590874681",
  },
  {
    id: "9", name: "Ravi Plumbing Works", title: "Plumber & Sanitation Expert", category: "Plumber & Carpenter",
    city: "Mumbai", rating: 4.6, reviews: 147, rate: 350, rateUnit: "visit",
    experience: "15 yrs", skills: ["Leakage Fix", "Bathroom Fitting", "Pipe Work", "Water Tank"],
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&q=80",
    badge: null, badgeColor: "", available: true, completedJobs: 560,
    phone: "918590874681",
  },
];

const CITIES = ["All Cities", "Mumbai", "Bangalore", "Delhi", "Gurgaon", "Hyderabad", "Pune", "Chennai"];

export default function FreelancersPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [city, setCity] = useState("All Cities");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => FREELANCERS.filter(f => {
    const catMatch = activeCategory === "All" || f.category === activeCategory;
    const cityMatch = city === "All Cities" || f.city === city;
    const q = query.toLowerCase();
    const queryMatch = !q || f.name.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.skills.some(s => s.toLowerCase().includes(q));
    return catMatch && cityMatch && queryMatch;
  }), [activeCategory, city, query]);

  return (
    <PageLayout>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0F2044 0%, #1E3A8A 100%)" }} className="border-b border-blue-900">
        <div className="container py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified Professionals
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Hire Verified<br />
            <span style={{ background: "linear-gradient(90deg,#60A5FA,#93C5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Freelancers & Experts
            </span>
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-xl">
            CAs, developers, designers, teachers, skilled workers — all verified, all in one place. Across India.
          </p>

          {/* Search */}
          <div className="flex gap-2 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by skill, name or service..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800"
              />
            </div>
            <button className="h-12 px-6 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#2563EB,#1246C8)" }}>
              <Search className="w-4 h-4" /> Search
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-10">
            {[["9+", "Verified Experts"], ["9", "Categories"], ["4.8★", "Avg Rating"], ["Free", "To Post a Job"]].map(([v, l]) => (
              <div key={l}>
                <p className="text-xl font-black text-white">{v}</p>
                <p className="text-blue-300 text-xs">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-10">

        {/* Category pills */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 mb-2 ml-1">Category</p>
          <div className="flex flex-wrap gap-2">
            {["All", ...CATEGORIES.map(c => c.label)].map(cat => {
              const catDef = CATEGORIES.find(c => c.label === cat);
              const isActive = activeCategory === cat;
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border"
                  style={isActive
                    ? { background: catDef?.color ?? "#0F172A", color: "#fff", borderColor: catDef?.color ?? "#0F172A" }
                    : { background: "#fff", color: "#475569", borderColor: "#E2E8F0" }}>
                  {catDef && <catDef.icon className="w-3.5 h-3.5" />}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* City filter */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-500 mb-2 ml-1">City</p>
          <div className="flex flex-wrap gap-2">
            {CITIES.map(c => (
              <button key={c} onClick={() => setCity(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${city === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-slate-500 mb-6 font-medium">
          {filtered.length} professional{filtered.length !== 1 ? "s" : ""} found
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((f, i) => (
            <motion.div key={f.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-[0_8px_32px_rgba(15,32,68,0.12)] hover:border-blue-200 transition-all"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative flex-shrink-0">
                  <img src={f.avatar} alt={f.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-100" />
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
                  <p className="text-sm text-slate-500 truncate">{f.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                      <Star className="w-3 h-3 fill-amber-400" />{f.rating} ({f.reviews})
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="w-3 h-3" />{f.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {f.skills.map(s => (
                  <span key={s} className="px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] text-slate-600 font-medium">{s}</span>
                ))}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.experience} exp</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{f.completedJobs} jobs</span>
                <span className={`flex items-center gap-1 font-medium ${f.available ? "text-emerald-600" : "text-slate-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${f.available ? "bg-emerald-400" : "bg-slate-300"}`} />
                  {f.available ? "Available" : "Busy"}
                </span>
              </div>

              {/* Rate + CTA */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <p className="text-lg font-black text-slate-900">
                    ₹{f.rate.toLocaleString("en-IN")}
                    <span className="text-xs font-normal text-slate-400">/{f.rateUnit}</span>
                  </p>
                </div>
                <a href={`https://wa.me/${f.phone}?text=Hi%20FreWork%2C%20I%27d%20like%20to%20hire%20${encodeURIComponent(f.name)}%20for%20${encodeURIComponent(f.title)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>
                  <Phone className="w-3.5 h-3.5" /> Hire Now
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500 font-medium">No professionals found for your filters.</p>
            <button onClick={() => { setActiveCategory("All"); setCity("All Cities"); setQuery(""); }}
              className="mt-3 text-blue-600 text-sm font-semibold hover:underline">Clear filters</button>
          </div>
        )}

        {/* Join as freelancer CTA */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg text-slate-900 mb-2">Are you a freelancer or service provider?</h3>
          <p className="text-slate-500 text-sm mb-5">
            Create your profile on FreWork and get hired by verified businesses across India. Free forever for early members.
          </p>
          <Link href="/dashboard/freelancer/submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>
            Join as a Freelancer — Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
