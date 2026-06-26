"use client";

import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { DollarSign, Briefcase, Star, Users, Clock, MessageCircle, Plus, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";

const STATS = [
  { label: "Total Spent", value: "$24,800", change: "This year", icon: DollarSign, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Active Contracts", value: "4", change: "2 ending soon", icon: Briefcase, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "Freelancers Hired", value: "18", change: "Lifetime", icon: Users, color: "text-green-500", bg: "bg-green-500/10" },
  { label: "Avg Rating Given", value: "4.8", change: "As a client", icon: Star, color: "text-yellow-500", bg: "bg-yellow-500/10" },
];

const CONTRACTS = [
  { title: "FinTech Dashboard Development", freelancer: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60", status: "Active", spent: "$3,600", total: "$8,000", due: "Jul 15" },
  { title: "Brand Identity Design", freelancer: "Emma Wilson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60", status: "Review", spent: "$2,200", total: "$2,500", due: "Jun 30" },
  { title: "SEO Audit & Optimization", freelancer: "Carlos Rodriguez", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60", status: "Active", spent: "$1,200", total: "$3,000", due: "Aug 5" },
];

export default function ClientDashboard() {
  return (
    <PageLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Hello, Michael! 👋</h1>
            <p className="text-muted-foreground">2 contracts need your review. 1 invoice pending payment.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/jobs/post"><Button className="gap-2 bg-gradient-to-r from-brand-500 to-purple-600 text-white"><Plus className="w-4 h-4" />Post a Job</Button></Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-card border border-border rounded-2xl p-5">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              <p className="text-2xl font-bold mb-0.5">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.change}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Active Contracts</h2>
              <Link href="/freelancers"><Button variant="outline" size="sm" className="gap-1.5 text-xs">Find Freelancers <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
            </div>
            <div className="space-y-4">
              {CONTRACTS.map(c => (
                <div key={c.title} className="border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <img src={c.avatar} alt={c.freelancer} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-sm">{c.title}</h3>
                          <p className="text-xs text-muted-foreground">{c.freelancer}</p>
                        </div>
                        <Badge variant={c.status === "Active" ? "default" : "secondary"} className="text-xs">{c.status}</Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Budget used</span>
                          <span>{c.spent} / {c.total}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-gradient-to-r from-brand-500 to-purple-600 rounded-full" style={{ width: `${(parseInt(c.spent.replace(/[^0-9]/g, "")) / parseInt(c.total.replace(/[^0-9]/g, ""))) * 100}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Clock className="w-3 h-3" />Due {c.due}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/freelancers"><Button variant="outline" className="w-full justify-start gap-2 text-sm"><Users className="w-4 h-4" />Browse Freelancers</Button></Link>
                <Link href="/jobs/post"><Button variant="outline" className="w-full justify-start gap-2 text-sm"><Briefcase className="w-4 h-4" />Post New Job</Button></Link>
                <Link href="/coworking"><Button variant="outline" className="w-full justify-start gap-2 text-sm"><TrendingUp className="w-4 h-4" />Book Workspace</Button></Link>
                <Link href="/messages"><Button variant="outline" className="w-full justify-start gap-2 text-sm"><MessageCircle className="w-4 h-4" />Messages</Button></Link>
              </div>
            </div>

            <div className="bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/20 rounded-2xl p-5">
              <h3 className="font-semibold mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-muted-foreground">Use AI matching to find the perfect freelancer for your next project in under 60 seconds.</p>
              <Button size="sm" className="mt-3 bg-gradient-to-r from-brand-500 to-purple-600 text-white text-xs">Try AI Match</Button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
