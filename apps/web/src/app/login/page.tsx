"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ArrowRight, Phone, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Step = "auth" | "mobile" | "done";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [step, setStep] = useState<Step>("auth");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [userId, setUserId] = useState("");

  // Coming back from Google OAuth callback
  useEffect(() => {
    const stepParam = searchParams.get("step");
    const uid = searchParams.get("uid");
    if (stepParam === "mobile" && uid) {
      setUserId(uid);
      setStep("mobile");
    }
  }, [searchParams]);

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) throw err;
      // Page will redirect — keep loading
    } catch {
      setError("Google sign-in failed. Please try email below.");
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      setUserId(data.user?.id ?? "");
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const saveMobile = async () => {
    if (mobile.length < 10) return;
    setLoading(true);
    setError("");
    try {
      if (userId) {
        await supabase.from("fw_users").update({ mobile }).eq("id", userId);
      }
      setStep("done");
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#060C18]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[#0D1829] to-[#060C18] relative overflow-hidden flex-col items-center justify-center p-12 border-r border-white/6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(201,168,76,0.07),transparent)]" />
        <div className="relative z-10 text-white max-w-xs">
          <div className="flex items-center gap-3 mb-12">
            <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
              <defs>
                <linearGradient id="lp_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#A855F7"/>
                </linearGradient>
              </defs>
              <rect width="38" height="38" rx="10" fill="url(#lp_bg)"/>
              <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="19" y1="19" x2="19" y2="10"/>
                <line x1="19" y1="19" x2="27" y2="24"/>
                <line x1="19" y1="19" x2="11" y2="24"/>
              </g>
              <g fill="white">
                <circle cx="19" cy="19" r="3.2"/>
                <circle cx="19" cy="10" r="2.2"/>
                <circle cx="27" cy="24" r="2.2"/>
                <circle cx="11" cy="24" r="2.2"/>
              </g>
            </svg>
            <span className="text-xl font-bold tracking-[-0.025em]" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            One platform.<br />Two doors.
          </h2>
          <p className="text-white/45 text-sm mb-10 leading-relaxed">Find workspaces, freelancers & jobs — or grow your business with expert CA & CS services.</p>
          <div className="space-y-3">
            {[["500+", "Businesses served"], ["CA & CS", "Qualified experts"], ["₹999", "Starting per month"]].map(([v, l]) => (
              <div key={l} className="flex items-center gap-4 bg-white/4 border border-white/6 rounded-2xl px-4 py-3">
                <span className="text-lg font-bold w-20 text-[#E8C97A]" style={{ fontFamily: "var(--font-cormorant), serif" }}>{v}</span>
                <span className="text-white/50 text-sm">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">

            {step === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="lg:hidden flex items-center gap-2 mb-8">
                  <svg width="30" height="30" viewBox="0 0 38 38" fill="none">
                    <rect width="38" height="38" rx="9" fill="#7C3AED"/>
                    <g stroke="white" strokeWidth="1.8" strokeLinecap="round">
                      <line x1="19" y1="19" x2="19" y2="10"/><line x1="19" y1="19" x2="27" y2="24"/><line x1="19" y1="19" x2="11" y2="24"/>
                    </g>
                    <g fill="white"><circle cx="19" cy="19" r="3.2"/><circle cx="19" cy="10" r="2.2"/><circle cx="27" cy="24" r="2.2"/><circle cx="11" cy="24" r="2.2"/></g>
                  </svg>
                  <span className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
                </div>

                <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>Welcome back</h1>
                <p className="text-white/40 mb-8 text-sm">Sign in to your FreWork account</p>

                {error && (
                  <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>
                )}

                {/* Google */}
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 border border-white/12 rounded-2xl hover:border-white/25 hover:bg-white/4 transition-all font-medium text-white/80 hover:text-white mb-5"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" /> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8" /></div>
                  <div className="relative flex justify-center"><span className="text-xs text-white/30 bg-[#060C18] px-3">or sign in with email</span></div>
                </div>

                <form onSubmit={handleEmail} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-1.5 block">Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                      className="w-full border border-white/10 rounded-2xl px-4 py-3 bg-white/4 text-white outline-none focus:border-[#C9A84C]/50 text-sm transition-all placeholder:text-white/20" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-sm font-medium text-white/60">Password</label>
                      <Link href="/forgot-password" className="text-xs text-[#C9A84C] hover:underline">Forgot?</Link>
                    </div>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                        className="w-full border border-white/10 rounded-2xl px-4 py-3 pr-11 bg-white/4 text-white outline-none focus:border-[#C9A84C]/50 text-sm transition-all" />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full h-12 rounded-2xl text-base font-semibold text-[#0B1120] flex items-center justify-center gap-2 mt-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <p className="text-center text-sm text-white/35 mt-6">
                  New to FreWork?{" "}
                  <Link href="/register" className="text-[#C9A84C] font-semibold hover:underline">Create account</Link>
                </p>
              </motion.div>
            )}

            {step === "mobile" && (
              <motion.div key="mobile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="w-14 h-14 rounded-2xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center mb-6">
                  <Phone className="w-7 h-7 text-[#C9A84C]" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>Add mobile number</h1>
                <p className="text-white/40 text-sm mb-3">Enter your mobile so our CA can reach you.</p>
                <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/15 rounded-2xl px-4 py-3 text-sm text-[#E8C97A]/80 mb-6 flex items-start gap-2">
                  <span className="mt-0.5">📞</span>
                  <span>Our CA will call you within 24 hours for a free consultation.</span>
                </div>
                {error && <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-1.5 block">Mobile number</label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-4 border border-white/10 rounded-2xl text-sm text-white/35 bg-white/4">+91</span>
                      <input type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number"
                        className="flex-1 border border-white/10 rounded-2xl px-4 py-3 bg-white/4 text-white outline-none focus:border-[#C9A84C]/50 text-sm transition-all placeholder:text-white/20" />
                    </div>
                  </div>
                  <button onClick={saveMobile} disabled={loading || mobile.length < 10}
                    className="w-full h-12 rounded-2xl font-semibold text-[#0B1120] flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue"}
                  </button>
                  <button onClick={() => setStep("done")} className="w-full text-center text-xs text-white/25 hover:text-white/50 transition-colors py-2">
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>You&apos;re in!</h1>
                <p className="text-white/40 mb-8 text-sm">Welcome back to FreWork.</p>
                <Link href="/" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-[#0B1120]"
                  style={{ background: "linear-gradient(135deg, #E8C97A, #C9A84C, #B8973E)" }}>
                  Go to Home <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
