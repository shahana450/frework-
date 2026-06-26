"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Search, MessageCircle, Heart, Share2, TrendingUp, Users, Plus, Pin, Eye, ArrowUp } from "lucide-react";

const POSTS = [
  { id: "1", author: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60", title: "How I went from ₹30K/month to $8K/month as a freelancer in 18 months", category: "Success Stories", upvotes: 847, comments: 124, views: 12400, time: "2h ago", pinned: true, tags: ["Freelancing", "Career Growth", "Income"] },
  { id: "2", author: "Arjun Sharma", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60", title: "GST vs Direct Tax: What every Indian freelancer must know in FY 2025-26", category: "Finance & Tax", upvotes: 612, comments: 89, views: 8900, time: "5h ago", pinned: false, tags: ["GST", "Income Tax", "Freelancer Finance"] },
  { id: "3", author: "Emma Wilson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60", title: "My honest review of coworking spaces in Bangalore — ranked", category: "Coworking", upvotes: 429, comments: 67, views: 6200, time: "1d ago", pinned: false, tags: ["Coworking", "Bangalore", "Review"] },
  { id: "4", author: "Carlos Rodriguez", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60", title: "ChatGPT vs Claude vs Gemini for writing client proposals — tested with real results", category: "AI Tools", upvotes: 1243, comments: 201, views: 22000, time: "3h ago", pinned: false, tags: ["AI", "Productivity", "Freelancing"] },
  { id: "5", author: "Priya Nair", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60", title: "I raised ₹8 crore for my startup in 60 days — AMA", category: "Startups & Funding", upvotes: 2104, comments: 387, views: 45000, time: "6h ago", pinned: true, tags: ["Startup", "Fundraising", "AMA"] },
  { id: "6", author: "Ravi Patel", avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=60", title: "AWS vs Azure vs GCP for Indian startups — a cost breakdown", category: "Tech Talk", upvotes: 531, comments: 73, views: 7800, time: "2d ago", pinned: false, tags: ["AWS", "Cloud", "DevOps", "Startup"] },
  { id: "7", author: "Yuki Tanaka", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60", title: "Getting my first $10K international client as a developer from Japan", category: "Success Stories", upvotes: 934, comments: 143, views: 18200, time: "1d ago", pinned: false, tags: ["Freelancing", "International Clients", "Developer"] },
  { id: "8", author: "Amara Osei", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=60", title: "Marketing tactics that doubled my client's MRR in 3 months — breakdown", category: "Marketing", upvotes: 782, comments: 112, views: 11300, time: "8h ago", pinned: false, tags: ["Marketing", "Growth", "MRR"] },
];

const CATEGORIES = ["All", "Success Stories", "Finance & Tax", "AI Tools", "Startups & Funding", "Coworking", "Tech Talk", "Marketing"];

export default function CommunityPage() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());

  const filtered = POSTS.filter(p =>
    (category === "All" || p.category === category) &&
    (!query || p.title.toLowerCase().includes(query.toLowerCase()))
  );

  const toggleUpvote = (id: string) => setUpvoted(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent border-b border-border">
        <div className="container py-12">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-8 h-8 text-pink-500" />
            <h1 className="text-4xl font-bold">Community</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">The go-to place for freelancers, founders, and professionals to share, learn, and grow</p>

          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-background border border-border rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search discussions..." className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <Button className="h-12 gap-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white"><Plus className="w-4 h-4" /> New Post</Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-pink-500" />Categories</h3>
              <div className="space-y-1">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${category === c ? "bg-pink-500/10 text-pink-600 font-medium" : "text-muted-foreground hover:bg-accent"}`}>{c}</button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-2">🌟 Community Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Members</span><span className="font-medium">48,200</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Posts Today</span><span className="font-medium">347</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Online Now</span><span className="font-medium text-green-500">1,243</span></div>
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="lg:col-span-3 space-y-4">
            {filtered.map((post, i) => (
              <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="group bg-card border border-border rounded-2xl p-5 hover:border-pink-400/40 hover:shadow-md transition-all">
                  {post.pinned && <div className="flex items-center gap-1.5 text-xs text-orange-500 font-medium mb-3"><Pin className="w-3.5 h-3.5" />Pinned Post</div>}
                  <div className="flex gap-4">
                    {/* Upvote */}
                    <button onClick={() => toggleUpvote(post.id)} className="flex flex-col items-center gap-1 shrink-0">
                      <div className={`p-1.5 rounded-lg transition-all ${upvoted.has(post.id) ? "bg-pink-500 text-white" : "bg-muted hover:bg-pink-500/10 hover:text-pink-500"}`}><ArrowUp className="w-4 h-4" /></div>
                      <span className="text-xs font-bold">{post.upvotes + (upvoted.has(post.id) ? 1 : 0)}</span>
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <img src={post.avatar} alt={post.author} className="w-7 h-7 rounded-full object-cover" />
                        <span className="text-sm font-medium">{post.author}</span>
                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{post.category}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{post.time}</span>
                      </div>
                      <h3 className="font-semibold mb-2 group-hover:text-pink-500 transition-colors cursor-pointer">{post.title}</h3>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {post.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{post.comments} comments</span>
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.views.toLocaleString()} views</span>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors"><Share2 className="w-3.5 h-3.5" />Share</button>
                        <button className="flex items-center gap-1 hover:text-red-500 transition-colors"><Heart className="w-3.5 h-3.5" />Save</button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
