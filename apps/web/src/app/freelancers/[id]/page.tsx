"use client";

import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Star, BadgeCheck, MapPin, Clock, Users, MessageCircle, Share2, Heart, ExternalLink, Briefcase, Award, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";

const PROFILES: Record<string, any> = {
  "1": { name: "Sarah Chen", title: "Full-Stack Developer & AI Specialist", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300", cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800", location: "San Francisco, USA", rating: 4.9, reviews: 248, hourlyRate: 120, skills: ["React", "Node.js", "Python", "AWS", "TypeScript", "PostgreSQL", "Redis", "Docker"], verified: true, availability: "Available", badge: "Top Rated", totalEarned: "$250K+", successRate: 98, bio: "Senior full-stack engineer with 8+ years building scalable web applications. Specialized in React/Next.js frontends and Node.js/Python backends. Expert in cloud architecture (AWS, GCP) and AI integrations. I've led teams at startups and Fortune 500 companies.", portfolio: [{ title: "AI-powered CRM Platform", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400", tags: ["React", "Python", "GPT-4"] }, { title: "Real-time Analytics Dashboard", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400", tags: ["Next.js", "D3.js", "WebSocket"] }, { title: "E-commerce Mobile App", img: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400", tags: ["React Native", "Stripe", "Firebase"] }], testimonials: [{ name: "Mike Torres", role: "CTO at TechVenture", text: "Sarah delivered an exceptional AI-powered dashboard. Her technical depth and communication were outstanding.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80", rating: 5 }, { name: "Lisa Park", role: "Product Manager at Airbnb", text: "One of the best developers I've worked with. She transformed our MVP into a production-ready platform in 3 weeks.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80", rating: 5 }], languages: ["English (Native)", "Mandarin (Fluent)"], education: "MS Computer Science, Stanford University", experience: "8 years" },
};

export default function FreelancerProfilePage() {
  const params = useParams();
  const f = PROFILES[params.id as string] ?? PROFILES["1"];
  const [activeTab, setActiveTab] = useState<"overview" | "portfolio" | "reviews">("overview");

  return (
    <PageLayout>
      <div className="container py-8 max-w-6xl">
        <Link href="/freelancers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Freelancers
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Profile */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-brand-500 to-purple-600" />
              <div className="px-6 pb-6">
                <div className="flex items-end gap-4 -mt-12 mb-4">
                  <div className="relative">
                    <img src={f.avatar} alt={f.name} className="w-24 h-24 rounded-2xl border-4 border-card object-cover" />
                    {f.verified && <BadgeCheck className="absolute -bottom-1 -right-1 w-6 h-6 text-brand-500 bg-card rounded-full" />}
                    <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                  </div>
                  <div className="pb-1 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">{f.name}
                          {f.badge && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-white font-semibold">{f.badge}</span>}
                        </h1>
                        <p className="text-muted-foreground">{f.title}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"><Share2 className="w-4 h-4" /></button>
                        <button className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"><Heart className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{f.location}</span>
                  <span className="flex items-center gap-1.5"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />{f.rating} ({f.reviews} reviews)</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" />{f.experience} experience</span>
                  <span className="flex items-center gap-1.5"><Award className="w-4 h-4" />{f.successRate}% success rate</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {f.skills.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-border mb-4">
                  {(["overview", "portfolio", "reviews"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{tab}</button>
                  ))}
                </div>

                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.bio}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/50 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Education</p>
                        <p className="text-sm font-medium">{f.education}</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Languages</p>
                        <p className="text-sm font-medium">{f.languages.join(", ")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "portfolio" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {f.portfolio.map((p: any) => (
                      <div key={p.title} className="border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
                        <img src={p.img} alt={p.title} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="p-3">
                          <p className="font-medium text-sm mb-2">{p.title}</p>
                          <div className="flex flex-wrap gap-1">{p.tags.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "reviews" && (
                  <div className="space-y-4">
                    {f.testimonials.map((t: any, i: number) => (
                      <div key={i} className="bg-muted/40 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                          <div>
                            <p className="font-medium text-sm">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.role}</p>
                          </div>
                          <div className="ml-auto flex">
                            {[...Array(t.rating)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Hire card */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
              <div className="text-center mb-6">
                <p className="text-3xl font-bold">${f.hourlyRate}<span className="text-base font-normal text-muted-foreground">/hr</span></p>
                <p className="text-xs text-muted-foreground mt-1">Total earned: {f.totalEarned}</p>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Availability</span><span className="text-green-600 font-medium">{f.availability}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Response time</span><span className="font-medium">Within 2 hours</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Active clients</span><span className="font-medium">3 currently</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Completed jobs</span><span className="font-medium">312</span></div>
              </div>

              <Button className="w-full mb-3 bg-gradient-to-r from-brand-500 to-purple-600 text-white" size="lg">
                <MessageCircle className="w-4 h-4 mr-2" /> Hire Sarah
              </Button>
              <Button variant="outline" className="w-full" size="lg">Send Message</Button>

              <p className="text-xs text-center text-muted-foreground mt-3">Protected by FreWork Guarantee</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
