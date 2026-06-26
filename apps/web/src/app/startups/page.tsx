"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Search, MapPin, TrendingUp, Users, DollarSign, Rocket, Globe, Star, ArrowUpRight } from "lucide-react";

const STARTUPS = [
  { id: "1", name: "AgroAI", tagline: "AI-powered crop disease detection for Indian farmers", sector: "AgriTech", stage: "Series A", raised: "₹12 Cr", team: 18, location: "Pune", logo: "🌱", founded: 2022, traction: "50,000+ farmers served", looking: "Product Designer, Backend Dev", highlight: "YC W24" },
  { id: "2", name: "MediChain", tagline: "Blockchain-based medical records for 1.4B Indians", sector: "HealthTech", stage: "Seed", raised: "$2.1M", team: 9, location: "Hyderabad", logo: "🏥", founded: 2023, traction: "12 hospitals onboarded", looking: "Solidity Dev, BD Lead", highlight: null },
  { id: "3", name: "SkoolOS", tagline: "Full-stack operating system for Indian K-12 schools", sector: "EdTech", stage: "Pre-Series A", raised: "₹6 Cr", team: 24, location: "Bangalore", logo: "📚", founded: 2021, traction: "800+ schools, 2L+ students", looking: "Sales Head, Data Scientist", highlight: "Sequoia Scout" },
  { id: "4", name: "ClimateCreds", tagline: "Carbon credit marketplace for SMEs in Southeast Asia", sector: "CleanTech", stage: "Seed", raised: "$1.8M", team: 7, location: "Singapore / Remote", logo: "🌍", founded: 2023, traction: "250+ SMEs registered", looking: "Frontend Dev, Growth Lead", highlight: null },
  { id: "5", name: "LegalGPT", tagline: "AI legal assistant for Indian law firms and individuals", sector: "LegalTech", stage: "Angel", raised: "₹2.5 Cr", team: 6, location: "Delhi", logo: "⚖️", founded: 2024, traction: "3,000+ active users", looking: "Full-Stack Dev, Sales Dev", highlight: "AWS Activate" },
  { id: "6", name: "FinBridge", tagline: "Neo-bank for India's 450M unbanked rural population", sector: "FinTech", stage: "Pre-Seed", raised: "₹1.2 Cr", team: 5, location: "Jaipur", logo: "🏦", founded: 2023, traction: "Pilot in 10 villages", looking: "React Native Dev, Operations Lead", highlight: null },
];

const SECTORS = ["All", "FinTech", "HealthTech", "EdTech", "AgriTech", "CleanTech", "LegalTech", "SaaS", "D2C"];
const STAGES = ["All Stages", "Pre-Seed", "Seed", "Angel", "Pre-Series A", "Series A", "Series B+"];

export default function StartupsPage() {
  const [sector, setSector] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = STARTUPS.filter(s =>
    (sector === "All" || s.sector === sector) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase()) || s.tagline.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="flex items-center gap-3 mb-3">
            <Rocket className="w-8 h-8 text-violet-500" />
            <h1 className="text-4xl font-bold">Startup Hub</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">Discover funded startups, join as co-founder or early employee, or get your startup listed</p>

          <div className="grid grid-cols-3 gap-6 max-w-lg mb-8">
            {[["1,200+", "Startups Listed"], ["$180M+", "Total Funding"], ["8,500+", "Jobs Available"]].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-bold text-violet-500">{v}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search startups by name or sector..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-violet-500 to-indigo-600 text-white">Search</Button>
            <Button variant="outline" className="h-12 px-4">List Your Startup</Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {SECTORS.map(s => (
            <button key={s} onClick={() => setSector(s)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${sector === s ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((startup, i) => (
            <motion.div key={startup.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <div className="group bg-card border border-border rounded-2xl p-6 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-500/5 transition-all h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center text-2xl">{startup.logo}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold group-hover:text-violet-500 transition-colors">{startup.name}</h3>
                        {startup.highlight && <span className="text-xs px-2 py-0.5 bg-violet-500/10 text-violet-500 rounded-full font-medium">{startup.highlight}</span>}
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full">{startup.sector}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${startup.stage === "Series A" ? "bg-green-500/10 text-green-600" : startup.stage === "Seed" ? "bg-blue-500/10 text-blue-600" : "bg-orange-500/10 text-orange-600"}`}>{startup.stage}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-4 flex-1">{startup.tagline}</p>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-xs font-bold text-violet-500">{startup.raised}</p>
                    <p className="text-xs text-muted-foreground">Raised</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-xs font-bold">{startup.team}</p>
                    <p className="text-xs text-muted-foreground">Team</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-xs font-bold">{startup.founded}</p>
                    <p className="text-xs text-muted-foreground">Founded</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Traction</p>
                  <p className="text-xs font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-500" />{startup.traction}</p>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Hiring for</p>
                  <p className="text-xs font-medium text-violet-600 mb-3">{startup.looking}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs">View Startup</Button>
                    <Button size="sm" variant="outline" className="text-xs">Apply</Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
