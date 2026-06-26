"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Search, MapPin, Clock, Briefcase, IndianRupee, Star, Filter, Plus, Building2 } from "lucide-react";
import Link from "next/link";

const JOBS = [
  { id: "1", title: "Senior React Developer for FinTech Platform", company: "PayEdge India", logo: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=80", type: "Full-time Contract", location: "Remote (India)", budget: "₹1,50,000 - ₹2,50,000/mo", skills: ["React", "TypeScript", "GraphQL", "Node.js"], posted: "2h ago", proposals: 12, urgent: true, description: "We're building India's next-gen B2B payments platform. Looking for an expert React developer with strong TypeScript skills..." },
  { id: "2", title: "CA for GST Audit & IND AS Compliance", company: "MegaManufacture Ltd", logo: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=80", type: "Short-term Project", location: "Mumbai / Remote", budget: "₹80,000 - ₹1,20,000", skills: ["IND AS", "GST", "Tax Audit", "ICAI"], posted: "5h ago", proposals: 8, urgent: false, description: "Seeking a qualified CA for annual GST audit and IND AS financial statement preparation for a manufacturing company..." },
  { id: "3", title: "UI/UX Designer for Mobile Banking App", company: "Groww FinTech", logo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=80", type: "Part-time", location: "Bangalore (Hybrid)", budget: "$3,000 - $5,000", skills: ["Figma", "Mobile UI", "Design Systems", "Prototyping"], posted: "1d ago", proposals: 34, urgent: false, description: "Design a clean, intuitive mobile banking experience. Must have experience with financial product UX..." },
  { id: "4", title: "ML Engineer for NLP & Document Processing", company: "LegalTech Startup", logo: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=80", type: "Full-time Contract", location: "Remote (Worldwide)", budget: "$8,000 - $12,000/mo", skills: ["Python", "NLP", "Transformers", "LangChain"], posted: "3d ago", proposals: 27, urgent: true, description: "Build AI-powered document extraction and analysis system for legal contracts. Experience with LLMs required..." },
  { id: "5", title: "DevOps Engineer — AWS & Kubernetes", company: "SaaS Scale-up", logo: "https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=80", type: "Full-time Remote", location: "Remote (US Preferred)", budget: "$120 - $150/hr", skills: ["AWS", "Kubernetes", "Terraform", "CI/CD"], posted: "1d ago", proposals: 19, urgent: false, description: "Own our entire cloud infrastructure. We're scaling from 10K to 1M users. Must have EKS, RDS, and multi-region experience..." },
  { id: "6", title: "Content Writer — Tech & SaaS Blog Articles", company: "Growth Agency", logo: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=80", type: "Ongoing", location: "Remote (Worldwide)", budget: "$50 - $100/article", skills: ["SEO Writing", "SaaS", "Technical Content", "English"], posted: "6h ago", proposals: 41, urgent: false, description: "Write 4-8 long-form blog posts per month on SaaS, productivity, and B2B tech topics. SEO knowledge required..." },
  { id: "7", name: "Blockchain Developer for DeFi Protocol", company: "DeFi Labs", logo: "https://images.unsplash.com/photo-1639762681057-408e52192e55?w=80", type: "Project-based", location: "Remote", budget: "$15,000 - $25,000", skills: ["Solidity", "Ethereum", "DeFi", "Smart Contracts"], posted: "2d ago", proposals: 15, urgent: true, description: "Develop and audit smart contracts for a new lending protocol. Deep experience with DeFi architecture required..." },
  { id: "8", title: "Video Editor & Social Media Content Creator", company: "EdTech Startup", logo: "https://images.unsplash.com/photo-1567593810070-7a3d471af022?w=80", type: "Part-time", location: "Remote (India)", budget: "₹40,000 - ₹60,000/mo", skills: ["Premiere Pro", "After Effects", "Shorts/Reels", "Motion Graphics"], posted: "4h ago", proposals: 56, urgent: false, description: "Create engaging educational video content for YouTube and Instagram. Strong storytelling skills required..." },
].map(j => ({ ...j, title: (j as any).title || (j as any).name }));

const TYPES = ["All", "Full-time", "Part-time", "Project-based", "Ongoing", "Remote"];

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");

  const filtered = JOBS.filter(j => {
    const q = query.toLowerCase();
    return (!q || j.title.toLowerCase().includes(q) || j.skills.some(s => s.toLowerCase().includes(q))) &&
      (type === "All" || j.type.toLowerCase().includes(type.toLowerCase()));
  });

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Browse Jobs & Projects</h1>
              <p className="text-muted-foreground text-lg">10,000+ active opportunities from verified companies</p>
            </div>
            <Link href="/jobs/post">
              <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <Plus className="w-4 h-4" /> Post a Job
              </Button>
            </Link>
          </div>
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs by skill or keyword..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">Search</Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${type === t ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{filtered.length}</span> jobs found</p>
        </div>

        <div className="space-y-4">
          {filtered.map((job, i) => (
            <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/jobs/${job.id}`}>
                <div className="bg-card border border-border rounded-2xl p-6 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group">
                  <div className="flex items-start gap-4">
                    <img src={job.logo} alt={job.company} className="w-12 h-12 rounded-xl object-cover border border-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h3 className="font-semibold group-hover:text-emerald-600 transition-colors">{job.title}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {job.urgent && <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full font-medium">Urgent</span>}
                          <Button size="sm" variant="outline" className="text-xs">Apply Now</Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                        <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.type}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.posted}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="font-semibold text-sm text-emerald-600">{job.budget}</p>
                          <p className="text-xs text-muted-foreground">{job.proposals} proposals</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" size="lg">Load More Jobs</Button>
          <p className="text-xs text-muted-foreground mt-2">Showing {filtered.length} of 10,000+ jobs</p>
        </div>
      </div>
    </PageLayout>
  );
}
