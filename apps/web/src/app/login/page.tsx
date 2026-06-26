"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Globe, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-purple-700 to-indigo-900 relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white" style={{ width: `${Math.random() * 200 + 50}px`, height: `${Math.random() * 200 + 50}px`, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, transform: "translate(-50%,-50%)" }} />
          ))}
        </div>
        <div className="relative z-10 text-center text-white max-w-sm">
          <div className="flex items-center gap-3 justify-center mb-8">
            <Globe className="w-10 h-10" />
            <span className="text-3xl font-bold">FreWork</span>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight">Welcome back to India's #1 work platform</h2>
          <p className="text-white/70 text-lg mb-8">Connect with 2M+ professionals, book workspaces, and build your career — all in one place.</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[["2M+", "Freelancers"], ["5K+", "Spaces"], ["$500M+", "Paid Out"]].map(([v, l]) => (
              <div key={l} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-xl font-bold">{v}</p>
                <p className="text-xs text-white/70">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <Globe className="w-7 h-7 text-primary" />
            <span className="text-2xl font-bold">FreWork</span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Sign in</h1>
          <p className="text-muted-foreground mb-8">Welcome back! Enter your credentials to continue.</p>

          {/* OAuth */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[["Google", "🔍"], ["LinkedIn", "💼"], ["GitHub", "🐙"]].map(([name, icon]) => (
              <button key={name} className="flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl hover:bg-accent transition-colors text-sm font-medium">
                <span>{icon}</span> {name}
              </button>
            ))}
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground bg-background px-3">or continue with email</div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-border rounded-xl px-4 py-3 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm transition-all" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="w-full border border-border rounded-xl px-4 py-3 pr-11 bg-background outline-none focus:ring-2 focus:ring-primary/30 text-sm transition-all" />
                <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button className="w-full h-12 bg-gradient-to-r from-brand-500 to-purple-600 text-white text-base mb-4 gap-2">
            Sign In <ArrowRight className="w-4 h-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">Create one free</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
