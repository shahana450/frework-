"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Search, TrendingUp, DollarSign, Briefcase, Globe, Star, Users, Building } from "lucide-react";

const INVESTORS = [
  { id: "1", name: "Sequoia Capital India", type: "VC Fund", logo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80", focus: ["FinTech", "SaaS", "EdTech", "HealthTech"], stages: ["Seed", "Series A", "Series B"], checkSize: "$1M - $50M", portfolio: ["BYJU'S", "OYO", "Razorpay", "Unacademy"], totalInvested: "$3B+", deals: 180 },
  { id: "2", name: "Kalaari Capital", type: "VC Fund", logo: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80", focus: ["Consumer Tech", "B2B SaaS", "D2C"], stages: ["Pre-Seed", "Seed", "Series A"], checkSize: "$500K - $10M", portfolio: ["Dream11", "Urban Ladder", "Myntra"], totalInvested: "$750M+", deals: 95 },
  { id: "3", name: "Rohit Anand", type: "Angel Investor", logo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80", focus: ["AgriTech", "CleanTech", "Rural Tech"], stages: ["Pre-Seed", "Seed"], checkSize: "₹25L - ₹2Cr", portfolio: ["AgroStar", "Ati Motors"], totalInvested: "₹45Cr+", deals: 32 },
  { id: "4", name: "Matrix Partners India", type: "VC Fund", logo: "https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=80", focus: ["SaaS", "FinTech", "Consumer"], stages: ["Seed", "Series A", "Series B"], checkSize: "$2M - $30M", portfolio: ["Ola", "Mswipe", "Treebo"], totalInvested: "$1B+", deals: 120 },
  { id: "5", name: "Priya Krishnan", type: "Angel Investor", logo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80", focus: ["EdTech", "Women-led Startups", "HealthTech"], stages: ["Pre-Seed", "Seed"], checkSize: "₹50L - ₹5Cr", portfolio: ["Kidsloop", "HealthifyMe"], totalInvested: "₹30Cr+", deals: 28 },
  { id: "6", name: "Peak XV Partners", type: "Growth Fund", logo: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=80", focus: ["Enterprise SaaS", "Marketplace", "Deep Tech"], stages: ["Series A", "Series B", "Series C"], checkSize: "$10M - $100M", portfolio: ["Khatabook", "Jar", "Zepto"], totalInvested: "$2.5B+", deals: 210 },
];

const TYPES = ["All", "Angel Investor", "VC Fund", "Family Office", "Corporate VC", "Growth Fund"];

export default function InvestorsPage() {
  const [type, setType] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = INVESTORS.filter(inv =>
    (type === "All" || inv.type === type) &&
    (!query || inv.name.toLowerCase().includes(query.toLowerCase()) || inv.focus.some(f => f.toLowerCase().includes(query.toLowerCase())))
  );

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            <h1 className="text-4xl font-bold">Investor Portal</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">Connect with 500+ active VCs, angels, and family offices investing in Indian startups</p>

          <div className="grid grid-cols-4 gap-6 max-w-2xl mb-8">
            {[["500+", "Active Investors"], ["$10B+", "Capital Deployed"], ["2,000+", "Startups Funded"], ["48h", "Avg Response Time"]].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-bold text-blue-500">{v}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by investor name or sector focus..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-blue-500 to-cyan-600 text-white">Search</Button>
            <Button variant="outline" className="h-12 px-4">Get Listed</Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${type === t ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((inv, i) => (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <div className="group bg-card border border-border rounded-2xl p-6 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <img src={inv.logo} alt={inv.name} className="w-14 h-14 rounded-xl object-cover border border-border" />
                  <div>
                    <h3 className="font-bold group-hover:text-blue-500 transition-colors">{inv.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.type === "VC Fund" ? "bg-blue-500/10 text-blue-600" : inv.type === "Angel Investor" ? "bg-purple-500/10 text-purple-600" : "bg-green-500/10 text-green-600"}`}>{inv.type}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-blue-500">{inv.totalInvested}</p>
                    <p className="text-xs text-muted-foreground">Deployed</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold">{inv.deals}</p>
                    <p className="text-xs text-muted-foreground">Deals</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-green-500">{inv.checkSize.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">Min Check</p>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">Investment Focus</p>
                  <div className="flex flex-wrap gap-1">{inv.focus.map(f => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}</div>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">Stages</p>
                  <div className="flex flex-wrap gap-1">{inv.stages.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Notable Portfolio</p>
                  <p className="text-xs font-medium">{inv.portfolio.join(" · ")}</p>
                </div>

                <div className="border-t border-border pt-4 flex gap-2">
                  <Button size="sm" className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs">Connect</Button>
                  <Button size="sm" variant="outline" className="text-xs">View Profile</Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
