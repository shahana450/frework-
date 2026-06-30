"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { motion } from "framer-motion";
import {
  Search, MapPin, Star, BadgeCheck, Heart, ArrowRight,
  Code2, Palette, TrendingUp, Calculator, Scale, Cpu,
  GraduationCap, Wrench, Zap, Droplets, Home, Brush,
  Truck, ChefHat, Scissors, Shield, BookOpen, Users,
} from "lucide-react";
import Link from "next/link";

/* ─── Category definitions ─── */
const CATEGORY_GROUPS = [
  {
    id: "professional",
    label: "Professional",
    color: "blue",
    border: "border-blue-500/20",
    bg: "bg-blue-500/6",
    text: "text-blue-400",
    activeBg: "bg-blue-600",
    cats: [
      { id: "All", icon: Users, label: "All" },
      { id: "Tech", icon: Code2, label: "Tech & Dev" },
      { id: "Design", icon: Palette, label: "Design" },
      { id: "Marketing", icon: TrendingUp, label: "Marketing" },
      { id: "Finance", icon: Calculator, label: "Finance & CA" },
      { id: "Legal", icon: Scale, label: "Legal" },
      { id: "AI", icon: Cpu, label: "AI / ML" },
    ],
  },
  {
    id: "education",
    label: "Education",
    color: "emerald",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/6",
    text: "text-emerald-400",
    activeBg: "bg-emerald-600",
    cats: [
      { id: "Teacher", icon: GraduationCap, label: "Teachers" },
      { id: "Tutor", icon: BookOpen, label: "Tutors" },
    ],
  },
  {
    id: "skilled",
    label: "Skilled Workers",
    color: "amber",
    border: "border-amber-500/20",
    bg: "bg-amber-500/6",
    text: "text-amber-400",
    activeBg: "bg-amber-600",
    cats: [
      { id: "Electrician", icon: Zap, label: "Electrician" },
      { id: "Plumber", icon: Droplets, label: "Plumber" },
      { id: "Housekeeping", icon: Home, label: "Housekeeping" },
      { id: "Painter", icon: Brush, label: "Painter" },
      { id: "Carpenter", icon: Wrench, label: "Carpenter" },
      { id: "Cook", icon: ChefHat, label: "Cook / Chef" },
      { id: "Tailor", icon: Scissors, label: "Tailor" },
      { id: "Driver", icon: Truck, label: "Driver" },
      { id: "Security", icon: Shield, label: "Security" },
    ],
  },
];

const ALL_CATS = CATEGORY_GROUPS.flatMap(g => g.cats);

/* ─── Freelancer data ─── */
const FREELANCERS = [
  // Professional
  { id: "1", name: "Arjun Sharma", title: "CA & GST Consultant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", location: "Mumbai", rating: 5.0, reviews: 189, rate: "₹1,500/hr", skills: ["GST", "Income Tax", "Audit", "IND AS"], verified: true, avail: true, badge: "Expert", cat: "Finance", rateNum: 1500 },
  { id: "2", name: "Priya Nair", title: "UI/UX Designer", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150", location: "Bangalore", rating: 4.9, reviews: 334, rate: "₹1,200/hr", skills: ["Figma", "UX Research", "Prototyping", "Design Systems"], verified: true, avail: true, badge: "Top Rated", cat: "Design", rateNum: 1200 },
  { id: "3", name: "Ravi Patel", title: "Full-Stack Developer", avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150", location: "Bangalore", rating: 4.7, reviews: 201, rate: "₹2,000/hr", skills: ["React", "Node.js", "AWS", "Docker"], verified: true, avail: true, badge: "Top Rated", cat: "Tech", rateNum: 2000 },
  { id: "4", name: "Sneha Kulkarni", title: "Digital Marketing Expert", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150", location: "Pune", rating: 4.8, reviews: 112, rate: "₹900/hr", skills: ["SEO", "Google Ads", "Meta Ads", "Content"], verified: true, avail: true, badge: null, cat: "Marketing", rateNum: 900 },
  { id: "5", name: "Vikram Mehta", title: "Corporate Lawyer", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", location: "Delhi", rating: 4.9, reviews: 87, rate: "₹3,500/hr", skills: ["Contract Law", "M&A", "IP Rights", "NCLT"], verified: true, avail: false, badge: "Expert", cat: "Legal", rateNum: 3500 },
  { id: "6", name: "Ananya Iyer", title: "ML & AI Engineer", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150", location: "Chennai", rating: 4.9, reviews: 143, rate: "₹2,800/hr", skills: ["PyTorch", "NLP", "LLMs", "Python"], verified: true, avail: true, badge: "Expert", cat: "AI", rateNum: 2800 },

  // Teachers
  { id: "7", name: "Deepa Menon", title: "CBSE Maths & Science Teacher", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", location: "Kochi", rating: 4.9, reviews: 220, rate: "₹500/hr", skills: ["Maths", "Physics", "Chemistry", "CBSE", "ICSE"], verified: true, avail: true, badge: "Top Rated", cat: "Teacher", rateNum: 500 },
  { id: "8", name: "Rahul Joshi", title: "English Language & Communication Coach", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150", location: "Mumbai", rating: 5.0, reviews: 305, rate: "₹600/hr", skills: ["Spoken English", "IELTS", "Business Communication", "Grammar"], verified: true, avail: true, badge: "Expert", cat: "Teacher", rateNum: 600 },
  { id: "9", name: "Kavitha Rajan", title: "Bharatanatyam & Music Teacher", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150", location: "Chennai", rating: 4.8, reviews: 178, rate: "₹400/hr", skills: ["Bharatanatyam", "Carnatic Music", "Veena", "Dance"], verified: true, avail: true, badge: null, cat: "Teacher", rateNum: 400 },
  { id: "10", name: "Amit Verma", title: "JEE / NEET Online Tutor", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", location: "Jaipur", rating: 4.9, reviews: 412, rate: "₹700/hr", skills: ["JEE Maths", "Physics", "NEET Biology", "IIT Prep"], verified: true, avail: false, badge: "Top Rated", cat: "Tutor", rateNum: 700 },
  { id: "11", name: "Sunita Pillai", title: "Yoga & Wellness Instructor", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150", location: "Trivandrum", rating: 5.0, reviews: 267, rate: "₹350/hr", skills: ["Hatha Yoga", "Meditation", "Pranayama", "Ayurveda"], verified: true, avail: true, badge: "Expert", cat: "Teacher", rateNum: 350 },

  // Skilled Workers
  { id: "12", name: "Suresh Electricals", title: "Licensed Electrician", avatar: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=150", location: "Mumbai", rating: 4.8, reviews: 543, rate: "₹300/hr", skills: ["Wiring", "Panel Repair", "AC Installation", "Safety Audit"], verified: true, avail: true, badge: "Top Rated", cat: "Electrician", rateNum: 300 },
  { id: "13", name: "Mohan Plumbing Co.", title: "Plumber & Sanitation Expert", avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150", location: "Pune", rating: 4.7, reviews: 389, rate: "₹250/hr", skills: ["Pipe Fitting", "Drainage", "Bathroom Fitting", "Leak Repair"], verified: true, avail: true, badge: null, cat: "Plumber", rateNum: 250 },
  { id: "14", name: "Lakshmi Services", title: "Professional Housekeeping", avatar: "https://images.unsplash.com/photo-1619473273021-48c5fd38f7d8?w=150", location: "Bangalore", rating: 4.9, reviews: 701, rate: "₹200/hr", skills: ["Deep Cleaning", "Kitchen Cleaning", "Post-Party Cleanup", "Office Housekeeping"], verified: true, avail: true, badge: "Top Rated", cat: "Housekeeping", rateNum: 200 },
  { id: "15", name: "Rajesh Painters", title: "Interior & Exterior Painter", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", location: "Delhi", rating: 4.6, reviews: 234, rate: "₹280/hr", skills: ["Asian Paints", "Texture Work", "Waterproofing", "Wallpaper"], verified: true, avail: true, badge: null, cat: "Painter", rateNum: 280 },
  { id: "16", name: "Kiran Carpentry", title: "Furniture & Woodwork Specialist", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", location: "Hyderabad", rating: 4.8, reviews: 198, rate: "₹350/hr", skills: ["Modular Furniture", "Wood Repair", "Doors & Windows", "Custom Designs"], verified: true, avail: false, badge: "Expert", cat: "Carpenter", rateNum: 350 },
  { id: "17", name: "Chef Rajan Kumar", title: "Home & Event Cook", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150", location: "Chennai", rating: 5.0, reviews: 487, rate: "₹400/hr", skills: ["South Indian", "North Indian", "Continental", "Party Catering"], verified: true, avail: true, badge: "Top Rated", cat: "Cook", rateNum: 400 },
  { id: "18", name: "Meera Tailors", title: "Ladies Tailor & Boutique Designer", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150", location: "Jaipur", rating: 4.9, reviews: 623, rate: "₹180/hr", skills: ["Salwar Kameez", "Blouse", "Alterations", "Bridal Wear"], verified: true, avail: true, badge: "Top Rated", cat: "Tailor", rateNum: 180 },
  { id: "19", name: "Ramesh Driver Services", title: "Personal & Corporate Driver", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150", location: "Mumbai", rating: 4.7, reviews: 312, rate: "₹150/hr", skills: ["City Driving", "Outstation", "Night Duty", "Licence: Heavy Vehicle"], verified: true, avail: true, badge: null, cat: "Driver", rateNum: 150 },
  { id: "20", name: "SecureGuard Agency", title: "Licensed Security Guard", avatar: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=150", location: "Delhi", rating: 4.8, reviews: 145, rate: "₹200/hr", skills: ["CCTV Monitoring", "Gated Community", "Event Security", "Night Patrol"], verified: true, avail: true, badge: "Verified", cat: "Security", rateNum: 200 },
];

const SORT_OPTIONS = ["Best Match", "Highest Rated", "Most Reviews", "Lowest Price", "Highest Price"];

const catColor = (cat: string) => {
  if (["Tech","Design","Marketing","Finance","Legal","AI"].includes(cat)) return { dot: "bg-blue-400", badge: "bg-blue-500/15 text-blue-300 border-blue-500/20" };
  if (["Teacher","Tutor"].includes(cat)) return { dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" };
  return { dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-300 border-amber-500/20" };
};

const badgeCls = (b: string | null) =>
  b === "Top Rated" ? "bg-[#C9A84C] text-[#0B1120]" :
  b === "Expert" ? "bg-blue-600 text-white" :
  b === "Verified" ? "bg-emerald-600 text-white" :
  "bg-purple-600 text-white";

export default function FreelancersPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [sort, setSort] = useState("Best Match");
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const toggleSave = (id: string) =>
    setSaved(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  let filtered = FREELANCERS.filter(f => {
    const q = query.toLowerCase();
    const matchQ = !q || f.name.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.skills.some(s => s.toLowerCase().includes(q));
    const matchC = activeCat === "All" || f.cat === activeCat;
    return matchQ && matchC;
  });

  if (sort === "Highest Rated") filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  else if (sort === "Most Reviews") filtered = [...filtered].sort((a, b) => b.reviews - a.reviews);
  else if (sort === "Lowest Price") filtered = [...filtered].sort((a, b) => a.rateNum - b.rateNum);
  else if (sort === "Highest Price") filtered = [...filtered].sort((a, b) => b.rateNum - a.rateNum);

  const currentGroup = CATEGORY_GROUPS.find(g => g.cats.some(c => c.id === activeCat));

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-[#060C18] pt-28 pb-10 overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(59,130,246,0.08),transparent)]" />
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/6 text-blue-400 text-xs font-semibold tracking-widest uppercase mb-6">
              FIND · Professionals & Skilled Workers
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              Hire anyone.<br /><span className="text-white/30">Professional to plumber.</span>
            </h1>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Verified professionals, teachers, and skilled workers — all in one place.
            </p>
          </div>

          {/* Search */}
          <div className="max-w-2xl mx-auto flex gap-3 mb-8">
            <div className="flex-1 flex items-center gap-3 bg-[#070D1A] border border-white/8 rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-white/25 flex-shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by skill, name or keyword…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/20" />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="px-4 rounded-xl bg-[#070D1A] border border-white/8 text-white/50 text-sm focus:outline-none focus:border-blue-500/40">
              {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Category group headers */}
          <div className="space-y-3">
            {CATEGORY_GROUPS.map(group => (
              <div key={group.id}>
                <p className={`text-[10px] font-bold tracking-widest uppercase ${group.text} mb-2 px-1`}>{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.cats.map(cat => {
                    const Icon = cat.icon;
                    const isActive = activeCat === cat.id;
                    return (
                      <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all border ${
                          isActive
                            ? `${group.activeBg} text-white border-transparent`
                            : `${group.border} ${group.bg} ${group.text} hover:opacity-90`
                        }`}>
                        <Icon className="w-3.5 h-3.5" />{cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="bg-[#060C18] py-10">
        <div className="container mx-auto px-4 max-w-6xl">

          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-white/40">
              <span className="font-semibold text-white">{filtered.length}</span> results
              {activeCat !== "All" && <span> in <span className="text-white">{ALL_CATS.find(c => c.id === activeCat)?.label}</span></span>}
            </p>
          </div>

          {/* Skilled workers feature banner */}
          {currentGroup?.id === "skilled" && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Skilled Workers on FreWork</p>
                <p className="text-xs text-white/40">All verified · Background checked · Rated by real customers · Book in minutes</p>
              </div>
            </div>
          )}

          {currentGroup?.id === "education" && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Teachers & Tutors on FreWork</p>
                <p className="text-xs text-white/40">Verified educators · Home tuition & online classes · CBSE / ICSE / IIT / NEET prep</p>
              </div>
            </div>
          )}

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((f, i) => {
              const cc = catColor(f.cat);
              return (
                <motion.div key={f.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="group relative rounded-2xl border border-white/6 bg-[#070D1A] p-5 hover:border-white/15 hover:bg-[#080F20] transition-all duration-300 overflow-hidden h-full flex flex-col">
                    {/* Subtle glow on hover */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(59,130,246,0.05),transparent)] opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Badge */}
                    {f.badge && (
                      <span className={`absolute top-4 left-4 text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeCls(f.badge)}`}>{f.badge}</span>
                    )}

                    {/* Save button */}
                    <button onClick={() => toggleSave(f.id)}
                      className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                      <Heart className={`w-3.5 h-3.5 ${saved.has(f.id) ? "fill-red-400 text-red-400" : "text-white/30"}`} />
                    </button>

                    {/* Avatar */}
                    <div className="flex flex-col items-center text-center mb-4 pt-4 relative z-10">
                      <div className="relative mb-3">
                        <div className={`absolute inset-0 rounded-full ${cc.dot} blur-md opacity-30`} />
                        <img src={f.avatar} alt={f.name} className="relative w-16 h-16 rounded-full object-cover border-2 border-white/10" />
                        {f.verified && (
                          <BadgeCheck className="absolute -bottom-1 -right-1 w-5 h-5 text-blue-400 bg-[#070D1A] rounded-full" />
                        )}
                        <span className={`absolute top-0 left-0 w-3 h-3 rounded-full border-2 border-[#070D1A] ${f.avail ? "bg-emerald-400" : "bg-orange-400"}`} />
                      </div>
                      <h3 className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors">{f.name}</h3>
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{f.title}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <MapPin className="w-3 h-3 text-white/25" />
                        <span className="text-xs text-white/30">{f.location}</span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-[#C9A84C] text-[#C9A84C]" />
                        <span className="text-xs font-bold text-white">{f.rating}</span>
                        <span className="text-xs text-white/30">({f.reviews})</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cc.badge}`}>{f.cat}</span>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1 mb-4 relative z-10">
                      {f.skills.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/40">{s}</span>
                      ))}
                    </div>

                    {/* Rate + CTA */}
                    <div className="mt-auto border-t border-white/6 pt-3 flex items-center justify-between relative z-10">
                      <div>
                        <p className="text-[10px] text-white/25">From</p>
                        <p className="font-bold text-sm text-white">{f.rate}</p>
                      </div>
                      <Link href={`/freelancers/${f.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:border-blue-500/40 hover:text-blue-300 hover:bg-blue-500/6 transition-all group/btn">
                        View <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-10 h-10 text-white/15 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No results found. Try a different search or category.</p>
            </div>
          )}

          <div className="text-center mt-10">
            <button className="px-8 py-3 rounded-xl border border-white/10 text-white/50 hover:border-white/20 hover:text-white text-sm transition-colors">
              Load more professionals
            </button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
