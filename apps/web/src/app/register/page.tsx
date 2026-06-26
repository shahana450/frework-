"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Globe, Check, ArrowRight, ArrowLeft, Briefcase, Building2, Rocket, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

const ROLES = [
  { id: "freelancer", icon: Briefcase, label: "Freelancer / Consultant", desc: "Offer your skills and find projects" },
  { id: "client", icon: Building2, label: "Client / Employer", desc: "Hire top talent for your projects" },
  { id: "coworking", icon: Building2, label: "Coworking Operator", desc: "List and manage your spaces" },
  { id: "startup", icon: Rocket, label: "Startup Founder", desc: "Build your team, raise funding" },
  { id: "investor", icon: TrendingUp, label: "Investor / VC", desc: "Discover and fund startups" },
];

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Globe className="w-7 h-7 text-primary" />
          <span className="text-2xl font-bold">FreWork</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {["Choose Role", "Your Details", "Done!"].map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs ml-1.5 font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              {i < 2 && <div className={`flex-1 h-0.5 mx-2 transition-colors ${i < step ? "bg-green-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-bold mb-2">I want to join as...</h1>
              <p className="text-muted-foreground text-sm mb-6">Select your primary role. You can add more later.</p>
              <div className="space-y-3 mb-6">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  return (
                    <button key={r.id} onClick={() => setRole(r.id)} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${role === r.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${role === r.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Icon className="w-5 h-5" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                      {role === r.id && <Check className="w-5 h-5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => role && setStep(1)} className="w-full h-12 bg-gradient-to-r from-brand-500 to-purple-600 text-white gap-2" disabled={!role}>
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-bold mb-2">Create your account</h1>
              <p className="text-muted-foreground text-sm mb-6">Free forever. No credit card needed.</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[["Google", "🔍"], ["LinkedIn", "💼"], ["GitHub", "🐙"]].map(([name, icon]) => (
                  <button key={name} className="flex items-center justify-center gap-1.5 py-2.5 border border-border rounded-xl hover:bg-accent transition-colors text-sm font-medium">
                    <span>{icon}</span> {name}
                  </button>
                ))}
              </div>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs text-muted-foreground bg-background px-3">or with email</div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">First Name</label>
                    <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Arjun" className="w-full border border-border rounded-xl px-3 py-2.5 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Last Name</label>
                    <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Sharma" className="w-full border border-border rounded-xl px-3 py-2.5 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Email Address</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" className="w-full border border-border rounded-xl px-3 py-2.5 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                    <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button onClick={() => setStep(2)} className="w-full h-12 bg-gradient-to-r from-brand-500 to-purple-600 text-white gap-2 mb-3">
                Create Account <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => setStep(0)} className="w-full text-center text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                By signing up, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-3xl font-bold mb-3">You're all set! 🎉</h1>
              <p className="text-muted-foreground mb-8">Welcome to FreWork. Your account has been created. Check your email to verify your account.</p>
              <Link href="/dashboard/freelancer">
                <Button className="bg-gradient-to-r from-brand-500 to-purple-600 text-white px-8 h-12">Go to Dashboard</Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {step < 2 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account? <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
