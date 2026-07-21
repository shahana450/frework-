"use client";

import { useState } from "react";
import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Search, Clock, Eye, ArrowRight } from "lucide-react";

const POSTS = [
  { id: "gst-registration-guide", title: "GST Registration in India 2025: Complete Step-by-Step Guide", excerpt: "Who needs GST, documents required, online process, fees, GSTIN timeline and what to do after registration. CA-assisted from ₹499.", category: "Tax & Compliance", img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600", readTime: "8 min", views: 52000, author: "FreWork CA Team", authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60", date: "Jul 1, 2025", featured: true, href: "/blog/gst-registration-guide" },
  { id: "itr-filing-guide", title: "How to File Income Tax Return (ITR) Online in India 2025", excerpt: "Which ITR form to use, documents needed, last date, step-by-step portal process, e-verification and faster refund tips.", category: "Tax & Compliance", img: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=600", readTime: "10 min", views: 78000, author: "FreWork CA Team", authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60", date: "Jul 1, 2025", featured: false, href: "/blog/itr-filing-guide" },
  { id: "company-registration-india", title: "How to Register a Company in India 2025 — Pvt Ltd, LLP, OPC", excerpt: "Complete guide to company registration — which structure to choose, documents, MCA SPICe+ process, fees and timeline.", category: "Business Setup", img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600", readTime: "9 min", views: 41000, author: "FreWork Expert Team", authorAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60", date: "Jul 1, 2025", featured: false, href: "/blog/company-registration-india" },
  { id: "1", title: "The Ultimate Guide to Freelancing in India in 2025", excerpt: "Everything you need to know about taxes, contracts, international payments, and building a sustainable freelance career in India.", category: "Guide", img: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600", readTime: "12 min", views: 45000, author: "Rohan Mehta", authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60", date: "Jun 20, 2025", featured: false, href: null },
  { id: "2", title: "How to Get Your First International Client as an Indian Developer", excerpt: "A step-by-step playbook to land your first $5K project from US, UK, or European clients — without an agency.", category: "Career", img: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=600", readTime: "8 min", views: 28000, author: "Priya Nair", authorAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60", date: "Jun 18, 2025", featured: false, href: null },
  { id: "3", title: "Top 10 Coworking Spaces in Bangalore — 2025 Edition", excerpt: "Detailed review of Bangalore's best coworking spaces ranked by price, community, amenities, and internet speed.", category: "Coworking", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600", readTime: "6 min", views: 19000, author: "Emma Wilson", authorAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60", date: "Jun 15, 2025", featured: false, href: null },
  { id: "4", title: "AI Tools Every Freelancer Must Use in 2025", excerpt: "From proposal writing to invoicing, these 15 AI tools will save you 10+ hours a week and make you more competitive.", category: "AI & Tools", img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600", readTime: "10 min", views: 67000, author: "Carlos Rodriguez", authorAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60", date: "Jun 12, 2025", featured: false, href: null },
  { id: "5", title: "How to Raise Seed Funding in India in 2025", excerpt: "A founder's guide to the Indian startup funding landscape: angels, VCs, SAFE notes, and how to craft the perfect pitch.", category: "Startups", img: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600", readTime: "11 min", views: 33000, author: "Arjun Patel", authorAvatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=60", date: "Jun 8, 2025", featured: false, href: null },
];

const CATEGORIES = ["All", "Tax & Compliance", "Business Setup", "Guide", "Career", "Coworking", "AI & Tools", "Startups", "Finance"];

export default function BlogPage() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const featured = POSTS.find(p => p.featured);
  const rest = POSTS.filter(p => !p.featured && (category === "All" || p.category === category) && (!query || p.title.toLowerCase().includes(query.toLowerCase())));

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <h1 className="text-4xl font-bold mb-2">FreWork Blog</h1>
          <p className="text-muted-foreground text-lg mb-8">Insights, guides, and success stories for the modern professional</p>
          <div className="flex gap-3 max-w-xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search articles..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button className="h-12 px-6 bg-gradient-to-r from-amber-500 to-yellow-600 text-white">Search</Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Featured */}
        {featured && (
          <Link href={featured.href ?? "#"} className="mb-12 group cursor-pointer block">
            <div className="relative rounded-2xl overflow-hidden">
              <img src={featured.img} alt={featured.title} className="w-full h-80 object-cover group-hover:scale-[1.01] transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <Badge className="mb-3 bg-amber-500 text-white border-0">{featured.category}</Badge>
                <h2 className="text-3xl font-bold text-white mb-2 max-w-3xl">{featured.title}</h2>
                <p className="text-white/80 mb-4 max-w-2xl">{featured.excerpt}</p>
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  <div className="flex items-center gap-2"><img src={featured.authorAvatar} alt="" className="w-7 h-7 rounded-full" />{featured.author}</div>
                  <span>{featured.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{featured.readTime} read</span>
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{featured.views.toLocaleString()} views</span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Categories */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === c ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{c}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((post, i) => (
            <motion.article key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-amber-400/40 hover:shadow-lg transition-all cursor-pointer"
              {...(post.href ? { onClick: () => window.location.href = post.href! } : {})}>
              <div className="overflow-hidden">
                <img src={post.img} alt={post.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-5">
                <Badge variant="secondary" className="mb-3 text-xs">{post.category}</Badge>
                <h3 className="font-bold mb-2 group-hover:text-amber-500 transition-colors line-clamp-2">{post.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <img src={post.authorAvatar} alt="" className="w-6 h-6 rounded-full" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(post.views / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" size="lg" className="gap-2">Load More Articles <ArrowRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </PageLayout>
  );
}
