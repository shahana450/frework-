"use client";

import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { DollarSign, Briefcase, Star, TrendingUp, Clock, Bell, MessageCircle, Eye, ArrowRight, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

const STATS = [
  { label: "Total Earned", value: "$8,420", change: "+12.4%", icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
  { label: "Active Projects", value: "3", change: "+1 this week", icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Profile Views", value: "1,240", change: "+34% this month", icon: Eye, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "Avg Rating", value: "4.9", change: "248 reviews", icon: Star, color: "text-yellow-500", bg: "bg-yellow-500/10" },
];

const PROJECTS = [
  { id: "1", title: "FinTech Dashboard — React & Node.js", client: "Groww FinTech", status: "In Progress", progress: 65, budget: "₹2,50,000", due: "Jul 15, 2026", milestone: "API Integration" },
  { id: "2", title: "E-commerce Mobile App", client: "StyleHub India", status: "Review", progress: 90, budget: "$4,200", due: "Jun 30, 2026", milestone: "Final Testing" },
  { id: "3", title: "SEO & Content Strategy", client: "MedTech Startup", status: "Planning", progress: 20, budget: "₹80,000", due: "Aug 1, 2026", milestone: "Keyword Research" },
];

const INVITATIONS = [
  { company: "PayEdge", role: "Senior React Developer", budget: "₹1.8L/mo", time: "2h ago" },
  { company: "LegalGPT", role: "Frontend Lead", budget: "$95/hr", time: "5h ago" },
];

export default function FreelancerDashboard() {
  return (
    <PageLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Good afternoon, Sarah! 👋</h1>
            <p className="text-muted-foreground">You have 2 new project invitations and 1 pending payment.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/messages"><Button variant="outline" className="gap-2"><MessageCircle className="w-4 h-4" />Messages <span className="w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">3</span></Button></Link>
            <Button className="gap-2 bg-gradient-to-r from-brand-500 to-purple-600 text-white"><Plus className="w-4 h-4" />Edit Profile</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                <span className="text-xs text-green-500 font-medium">{s.change}</span>
              </div>
              <p className="text-2xl font-bold mb-0.5">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Projects */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-lg">Active Projects</h2>
                <Link href="/dashboard/projects"><Button variant="outline" size="sm" className="gap-1.5 text-xs">View All <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
              </div>
              <div className="space-y-5">
                {PROJECTS.map(p => (
                  <div key={p.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-sm mb-0.5">{p.title}</h3>
                        <p className="text-xs text-muted-foreground">Client: {p.client}</p>
                      </div>
                      <Badge variant={p.status === "In Progress" ? "default" : p.status === "Review" ? "secondary" : "outline"} className="text-xs">{p.status}</Badge>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress — {p.milestone}</span>
                        <span className="font-medium">{p.progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-600 transition-all`} style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due {p.due}</span>
                      <span className="font-semibold text-foreground">{p.budget}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-6">
            {/* Earnings Chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" />Earnings This Month</h2>
              <div className="flex items-end gap-1.5 h-28 mb-3">
                {[40, 65, 45, 80, 60, 90, 75, 55, 85, 70, 95, 62].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-brand-500 to-purple-600 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Jun 1</span><span>Jun 15</span><span>Jun 26</span>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between">
                <div><p className="text-xs text-muted-foreground">This Month</p><p className="font-bold text-lg text-green-500">$3,240</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">Last Month</p><p className="font-bold text-lg">$2,890</p></div>
              </div>
            </div>

            {/* Invitations */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-yellow-500" />New Invitations</h2>
              <div className="space-y-3">
                {INVITATIONS.map((inv, i) => (
                  <div key={i} className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{inv.company}</span>
                      <span className="text-xs text-muted-foreground">{inv.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{inv.role}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-green-600">{inv.budget}</span>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="text-xs h-6 px-2 bg-gradient-to-r from-brand-500 to-purple-600 text-white">Accept</Button>
                        <Button size="sm" variant="outline" className="text-xs h-6 px-2">Decline</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/jobs"><Button variant="outline" className="w-full justify-start gap-2 text-sm"><Briefcase className="w-4 h-4" />Browse New Jobs</Button></Link>
                <Link href="/messages"><Button variant="outline" className="w-full justify-start gap-2 text-sm"><MessageCircle className="w-4 h-4" />View Messages</Button></Link>
                <Button variant="outline" className="w-full justify-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4" />Request Withdrawal</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
