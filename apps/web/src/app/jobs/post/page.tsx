"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ChevronLeft, Briefcase, DollarSign, Users, Sparkles } from "lucide-react";

const STEPS = ["Job Details", "Requirements", "Budget & Timeline", "Review & Post"];

const SKILL_OPTIONS = ["React", "Node.js", "Python", "TypeScript", "AWS", "Figma", "SEO", "Content Writing", "Java", "iOS", "Android", "Machine Learning", "Data Science", "Blockchain", "Solidity", "DevOps", "UI/UX", "Graphic Design", "Video Editing", "Marketing", "Sales", "Customer Support", "IND AS", "GST", "Audit", "Legal"];

export default function PostJobPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ title: "", category: "", description: "", type: "Fixed Price", skills: [] as string[], minBudget: "", maxBudget: "", currency: "USD", timeline: "1 month", experience: "Intermediate", visibility: "Public" });

  const toggleSkill = (s: string) => setForm(f => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s] }));

  return (
    <PageLayout>
      <div className="container max-w-3xl py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Post a Job or Project</h1>
          <p className="text-muted-foreground">Reach 2M+ verified freelancers worldwide in minutes</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <button onClick={() => i < step && setStep(i)} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </button>
                <span className={`text-xs mt-1 whitespace-nowrap font-medium ${i === step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${i < step ? "bg-green-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-card border border-border rounded-2xl p-8">
            {step === 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" /> Job Details</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">Job Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior React Developer for FinTech App" className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                    <option value="">Select a category</option>
                    {["Software Development", "Design & Creative", "Marketing", "Finance & Accounting", "Legal", "Writing & Translation", "Engineering", "Data Science & ML", "DevOps & Cloud", "Sales & Business"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Job Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Fixed Price", "Hourly Rate", "Monthly Retainer", "Equity + Pay"].map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${form.type === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description *</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your project in detail. What do you need, what's the scope, and what are the deliverables?" rows={5} className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none" />
                  <p className="text-xs text-muted-foreground mt-1">{form.description.length}/2000 characters</p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Requirements</h2>
                <div>
                  <label className="block text-sm font-medium mb-3">Required Skills (select all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {SKILL_OPTIONS.map(s => (
                      <button key={s} onClick={() => toggleSkill(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${form.skills.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>{s}</button>
                    ))}
                  </div>
                  {form.skills.length > 0 && <p className="text-xs text-muted-foreground mt-2">{form.skills.length} skills selected</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Experience Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["Entry Level", "Intermediate", "Expert"].map(e => (
                      <button key={e} onClick={() => setForm(f => ({ ...f, experience: e }))} className={`py-3 rounded-xl border text-sm font-medium transition-all ${form.experience === e ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>{e}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Project Visibility</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Public", "Invite Only"].map(v => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, visibility: v }))} className={`py-3 rounded-xl border text-sm font-medium transition-all ${form.visibility === v ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" /> Budget & Timeline</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none text-sm">
                    {["USD", "INR", "EUR", "GBP", "AED", "SGD"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Min Budget ({form.currency})</label>
                    <input type="number" value={form.minBudget} onChange={e => setForm(f => ({ ...f, minBudget: e.target.value }))} placeholder="500" className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Budget ({form.currency})</label>
                    <input type="number" value={form.maxBudget} onChange={e => setForm(f => ({ ...f, maxBudget: e.target.value }))} placeholder="2000" className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Project Timeline</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Less than 1 week", "1-2 weeks", "1 month", "1-3 months", "3-6 months", "Ongoing"].map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, timeline: t }))} className={`py-3 rounded-xl border text-sm font-medium transition-all ${form.timeline === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> Review & Post</h2>
                <div className="bg-muted/40 rounded-xl p-5 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="font-medium">{form.title || "(not set)"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{form.category || "(not set)"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{form.type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Experience</span><span className="font-medium">{form.experience}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium">{form.currency} {form.minBudget || "0"} – {form.maxBudget || "0"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Timeline</span><span className="font-medium">{form.timeline}</span></div>
                  <div><span className="text-muted-foreground block mb-2">Skills ({form.skills.length})</span><div className="flex flex-wrap gap-1">{form.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div></div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
                  ✨ Your job will be visible to FreWork's growing community of verified freelancers. Free to post — FreWork only charges a small fee when you hire.
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="gap-2"><ChevronLeft className="w-4 h-4" /> Back</Button>
              {step < STEPS.length - 1
                ? <Button onClick={() => setStep(s => s + 1)} className="gap-2 bg-gradient-to-r from-brand-500 to-purple-600 text-white">Next <ChevronRight className="w-4 h-4" /></Button>
                : <Button className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8"><Check className="w-4 h-4" /> Post Job Now</Button>
              }
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}
