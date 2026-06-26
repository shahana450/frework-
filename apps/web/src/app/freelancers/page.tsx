"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Search, MapPin, Star, BadgeCheck, SlidersHorizontal,
  Clock, Users, Filter, ChevronDown, Heart,
} from "lucide-react";
import Link from "next/link";

const FREELANCERS = [
  { id: "1", name: "Sarah Chen", title: "Full-Stack Developer & AI Specialist", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", location: "San Francisco, USA", rating: 4.9, reviews: 248, hourlyRate: 120, skills: ["React", "Node.js", "Python", "AWS"], verified: true, availability: "Available", badge: "Top Rated", totalEarned: "$250K+", successRate: 98 },
  { id: "2", name: "Arjun Sharma", title: "CA & Financial Consultant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", location: "Mumbai, India", rating: 5.0, reviews: 189, hourlyRate: 85, skills: ["IND AS", "GST", "Tax Planning", "Audit"], verified: true, availability: "Available", badge: "Expert", totalEarned: "$120K+", successRate: 100 },
  { id: "3", name: "Emma Wilson", title: "UI/UX Designer & Brand Strategist", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150", location: "London, UK", rating: 4.8, reviews: 312, hourlyRate: 95, skills: ["Figma", "Branding", "Motion Design", "Webflow"], verified: true, availability: "Busy", badge: "Top Rated", totalEarned: "$180K+", successRate: 96 },
  { id: "4", name: "Carlos Rodriguez", title: "Digital Marketing & SEO Expert", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", location: "Barcelona, Spain", rating: 4.9, reviews: 276, hourlyRate: 75, skills: ["SEO", "Google Ads", "Content Strategy", "Analytics"], verified: true, availability: "Available", badge: "Rising Star", totalEarned: "$90K+", successRate: 97 },
  { id: "5", name: "Yuki Tanaka", title: "Machine Learning Engineer", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150", location: "Tokyo, Japan", rating: 4.9, reviews: 143, hourlyRate: 140, skills: ["PyTorch", "TensorFlow", "NLP", "Computer Vision"], verified: true, availability: "Available", badge: "Expert", totalEarned: "$310K+", successRate: 99 },
  { id: "6", name: "Aisha Okafor", title: "Corporate Lawyer & Legal Consultant", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150", location: "Lagos, Nigeria", rating: 4.8, reviews: 98, hourlyRate: 110, skills: ["Contract Law", "M&A", "IP Rights", "Compliance"], verified: true, availability: "Available", badge: "Expert", totalEarned: "$140K+", successRate: 95 },
  { id: "7", name: "Ravi Patel", title: "DevOps & Cloud Architect", avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150", location: "Bangalore, India", rating: 4.7, reviews: 201, hourlyRate: 100, skills: ["AWS", "Kubernetes", "Docker", "Terraform"], verified: true, availability: "Available", badge: "Top Rated", totalEarned: "$200K+", successRate: 94 },
  { id: "8", name: "Priya Nair", title: "Senior UX Designer", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150", location: "Bangalore, India", rating: 4.9, reviews: 334, hourlyRate: 80, skills: ["UX Research", "Figma", "Prototyping", "Design Systems"], verified: true, availability: "Available", badge: "Top Rated", totalEarned: "$160K+", successRate: 98 },
  { id: "9", name: "David Kim", title: "Blockchain & Web3 Developer", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150", location: "Seoul, South Korea", rating: 4.8, reviews: 87, hourlyRate: 160, skills: ["Solidity", "Ethereum", "DeFi", "Smart Contracts"], verified: true, availability: "Busy", badge: "Expert", totalEarned: "$420K+", successRate: 96 },
  { id: "10", name: "Amara Osei", title: "Marketing Consultant & Growth Hacker", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150", location: "Accra, Ghana", rating: 5.0, reviews: 156, hourlyRate: 90, skills: ["Growth Hacking", "Performance Marketing", "CRO", "Email Marketing"], verified: true, availability: "Available", badge: "Rising Star", totalEarned: "$75K+", successRate: 100 },
  { id: "11", name: "Lucas Mendes", title: "Video Editor & Motion Designer", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", location: "São Paulo, Brazil", rating: 4.7, reviews: 220, hourlyRate: 65, skills: ["After Effects", "Premiere Pro", "Cinema 4D", "DaVinci Resolve"], verified: true, availability: "Available", badge: null, totalEarned: "$55K+", successRate: 93 },
  { id: "12", name: "Fatima Al-Hassan", title: "Arabic & English Translator", avatar: "https://images.unsplash.com/photo-1619473273021-48c5fd38f7d8?w=150", location: "Dubai, UAE", rating: 4.9, reviews: 412, hourlyRate: 55, skills: ["Arabic", "English", "Legal Translation", "Medical Translation"], verified: true, availability: "Available", badge: "Top Rated", totalEarned: "$45K+", successRate: 99 },
];

const CATEGORIES = ["All", "Software", "Design", "Marketing", "Finance", "Legal", "AI/ML", "Video", "Writing"];
const SORT_OPTIONS = ["Best Match", "Highest Rated", "Most Reviews", "Lowest Price", "Highest Price"];

export default function FreelancersPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Best Match");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const filtered = FREELANCERS.filter((f) => {
    const q = query.toLowerCase();
    const matchQuery = !q || f.name.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.skills.some((s) => s.toLowerCase().includes(q));
    const matchCat = category === "All" || f.skills.some((s) => s.toLowerCase().includes(category.toLowerCase()));
    const matchMin = !minRate || f.hourlyRate >= parseInt(minRate);
    const matchMax = !maxRate || f.hourlyRate <= parseInt(maxRate);
    return matchQuery && matchCat && matchMin && matchMax;
  });

  return (
    <PageLayout>
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-500/10 via-purple-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <h1 className="text-4xl font-bold mb-2">Find Expert Freelancers</h1>
          <p className="text-muted-foreground text-lg mb-8">Browse 2M+ verified professionals across 50+ categories</p>
          {/* Search */}
          <div className="flex gap-3 max-w-3xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12 shadow-sm">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by skill, name, or keyword..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button variant="outline" className="h-12 px-4 gap-2" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </Button>
            <Button className="h-12 px-6 bg-gradient-to-r from-brand-500 to-purple-600 text-white">Search</Button>
          </div>
          {/* Filters panel */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 p-4 bg-background border border-border rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
              <div>
                <label className="text-xs font-medium mb-1 block">Min Rate ($/hr)</label>
                <input value={minRate} onChange={(e) => setMinRate(e.target.value)} placeholder="0" className="w-full border border-border rounded-lg px-3 h-9 text-sm bg-background outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Max Rate ($/hr)</label>
                <input value={maxRate} onChange={(e) => setMaxRate(e.target.value)} placeholder="500" className="w-full border border-border rounded-lg px-3 h-9 text-sm bg-background outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Availability</label>
                <select className="w-full border border-border rounded-lg px-3 h-9 text-sm bg-background outline-none">
                  <option>Any</option><option>Available Now</option><option>Within a week</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Experience</label>
                <select className="w-full border border-border rounded-lg px-3 h-9 text-sm bg-background outline-none">
                  <option>Any Level</option><option>Entry Level</option><option>Intermediate</option><option>Expert</option>
                </select>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="container py-8">
        {/* Category tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === cat ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Sort + count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{filtered.length}</span> freelancers found</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background outline-none">
              {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 relative">
                {/* Save */}
                <button onClick={() => setSaved((s) => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-accent transition-colors">
                  <Heart className={`w-4 h-4 ${saved.has(f.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                </button>
                {f.badge && <span className={`absolute top-4 left-4 text-xs px-2 py-0.5 rounded-full font-semibold text-white ${f.badge === "Top Rated" ? "bg-yellow-500" : f.badge === "Expert" ? "bg-brand-500" : "bg-green-500"}`}>{f.badge}</span>}

                <div className="flex flex-col items-center text-center mb-4 pt-4">
                  <div className="relative mb-3">
                    <img src={f.avatar} alt={f.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-border" />
                    {f.verified && <BadgeCheck className="absolute -bottom-1 -right-1 w-5 h-5 text-brand-500 bg-background rounded-full" />}
                    <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-background ${f.availability === "Available" ? "bg-green-500" : "bg-orange-400"}`} />
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{f.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{f.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{f.location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-semibold">{f.rating}</span>
                    <span className="text-xs text-muted-foreground">({f.reviews})</span>
                  </div>
                  <span className="text-xs text-green-600 font-medium">{f.successRate}% success</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {f.skills.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                </div>

                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">From</span>
                    <p className="font-bold text-sm">${f.hourlyRate}<span className="text-xs font-normal text-muted-foreground">/hr</span></p>
                  </div>
                  <Link href={`/freelancers/${f.id}`}>
                    <Button size="sm" variant="outline" className="text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">View Profile</Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Load more */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg" className="px-10">Load more freelancers</Button>
          <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of 2,000,000+ freelancers</p>
        </div>
      </div>
    </PageLayout>
  );
}
