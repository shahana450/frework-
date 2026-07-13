"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Phone, CheckCircle, Loader2, User, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Step = "role" | "method" | "details" | "mobile" | "done";
type UserRole = "client" | "freelancer" | "space_owner";

const ROLES: { key: UserRole; emoji: string; label: string; desc: string; color: string }[] = [
  { key: "client",      emoji: "💼", label: "I need services",    desc: "GST, ITR, Accounting, CA support", color: "#1E40AF" },
  { key: "freelancer",  emoji: "🧑‍💻", label: "I'm a Freelancer",   desc: "Offer skills, get hired by businesses", color: "#059669" },
  { key: "space_owner", emoji: "🏢", label: "I own a Space",      desc: "List coworking spaces for free", color: "#7C3AED" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<UserRole>("client");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Google OAuth — real Supabase flow, goes to /auth/callback → /dashboard
  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) throw err;
      // Page redirects to Google — keep loading spinner
    } catch {
      setError("Google sign-up failed. Please try email below.");
      setLoading(false);
    }
  };

  // Email signup — real Supabase Auth
  const handleEmailDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (err) throw err;
      if (!data.user) throw new Error("Sign-up failed. Please try again.");

      // Also save to fw_users table with role
      await supabase.from("fw_users").upsert({
        id: data.user.id,
        email,
        name,
        method: "email",
        role,
      }, { onConflict: "id" });

      setDisplayName(name);
      setStep("mobile");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const saveMobile = async () => {
    if (mobile.length < 10) return;
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("fw_users").update({ mobile }).eq("id", session.user.id);
      }
      setStep("done");
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Role", "Account", "Mobile", "Done"];
  const currentStepIdx = step === "role" ? 0 : (step === "method" || step === "details") ? 1 : step === "mobile" ? 2 : 3;

  return (
    <div className="min-h-screen flex bg-[#060C18]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[#0D1829] to-[#060C18] relative overflow-hidden flex-col items-center justify-center p-12 border-r border-white/6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(201,168,76,0.07),transparent)]" />
        <div className="relative z-10 text-white max-w-xs">
          <div className="flex items-center gap-3 mb-10">
            <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
              <defs><linearGradient id="reg_bg" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#A855F7"/></linearGradient></defs>
              <rect width="38" height="38" rx="10" fill="url(#reg_bg)"/>
              <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="19" y1="19" x2="19" y2="10"/><line x1="19" y1="19" x2="27" y2="24"/><line x1="19" y1="19" x2="11" y2="24"/>
              </g>
              <g fill="white"><circle cx="19" cy="19" r="3.2"/><circle cx="19" cy="10" r="2.2"/><circle cx="27" cy="24" r="2.2"/><circle cx="11" cy="24" r="2.2"/></g>
            </svg>
            <span className="text-xl font-bold tracking-[-0.025em]" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: "var(--font-cormorant), serif" }}>
            Join 500+<br />growing businesses
          </h2>
          <p className="text-white/45 text-sm mb-10 leading-relaxed">Expert CA & CS services, coworking spaces, and freelancers — all in one place.</p>
          <div className="space-y-3">
            {[["✅", "CA & CS qualified experts"], ["⚡", "24-hour turnaround"], ["🔒", "100% data privacy"], ["📞", "Dedicated account manager"]].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-white/70 text-sm">
                <span>{icon}</span><span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Progress */}
          {step !== "role" && (
            <div className="flex items-center gap-2 mb-8">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= currentStepIdx ? "bg-[#C9A84C] text-[#0B1120]" : "bg-white/8 text-white/30"}`}>
                    {i < currentStepIdx ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i === currentStepIdx ? "text-[#C9A84C]" : "text-white/30"}`}>{s}</span>
                  {i < steps.length - 1 && <div className={`h-0.5 w-8 rounded ${i < currentStepIdx ? "bg-[#C9A84C]" : "bg-white/10"}`} />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">

            {step === "role" && (
              <motion.div key="role" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="lg:hidden flex items-center gap-2 mb-8">
                  <svg width="30" height="30" viewBox="0 0 38 38" fill="none"><rect width="38" height="38" rx="9" fill="#1246C8"/><g stroke="white" strokeWidth="1.8" strokeLinecap="round"><line x1="19" y1="19" x2="19" y2="10"/><line x1="19" y1="19" x2="27" y2="24"/><line x1="19" y1="19" x2="11" y2="24"/></g><g fill="white"><circle cx="19" cy="19" r="3.2"/><circle cx="19" cy="10" r="2.2"/><circle cx="27" cy="24" r="2.2"/><circle cx="11" cy="24" r="2.2"/></g></svg>
                  <span className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>I want to…</h1>
                <p className="text-white/40 mb-8 text-sm">Choose your account type. You can change this later.</p>
                <div className="space-y-3 mb-8">
                  {ROLES.map(r => (
                    <button key={r.key} onClick={() => setRole(r.key)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all"
                      style={role === r.key
                        ? { borderColor: r.color, background: `${r.color}14`, boxShadow: `0 0 0 2px ${r.color}30` }
                        : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                      <span className="text-2xl">{r.emoji}</span>
                      <div className="flex-1">
                        <p className="font-bold text-white text-sm">{r.label}</p>
                        <p className="text-white/40 text-xs mt-0.5">{r.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all`}
                        style={role === r.key ? { borderColor: r.color, background: r.color } : { borderColor: "rgba(255,255,255,0.2)" }}>
                        {role === r.key && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Paid note for clients */}
                {role === "client" && (
                  <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3 text-xs text-amber-400/80 mb-6 flex items-start gap-2">
                    <span>💡</span>
                    <span>GST, ITR, and Accounting services are <strong className="text-amber-400">paid plans</strong>. Browsing freelancers and coworking spaces is always free.</span>
                  </div>
                )}
                {role === "freelancer" && (
                  <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl px-4 py-3 text-xs text-emerald-400/80 mb-6 flex items-start gap-2">
                    <span>✅</span>
                    <span>Creating a freelancer profile and getting hired is <strong className="text-emerald-400">completely free</strong> on FreWork.</span>
                  </div>
                )}
                {role === "space_owner" && (
                  <div className="bg-violet-500/8 border border-violet-500/20 rounded-2xl px-4 py-3 text-xs text-violet-400/80 mb-6 flex items-start gap-2">
                    <span>🏢</span>
                    <span>Listing your coworking space is <strong className="text-violet-400">free</strong>. We'll help you reach thousands of professionals.</span>
                  </div>
                )}

                <button onClick={() => setStep("method")}
                  className="w-full h-12 rounded-2xl font-semibold text-[#0B1120] flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                  style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
                  Continue <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-center text-sm text-white/35 mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#C9A84C] font-semibold hover:underline">Sign in</Link>
                </p>
              </motion.div>
            )}

            {step === "method" && (
              <motion.div key="method" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="lg:hidden flex items-center gap-2 mb-8">
                  <svg width="30" height="30" viewBox="0 0 38 38" fill="none"><rect width="38" height="38" rx="9" fill="#7C3AED"/><g stroke="white" strokeWidth="1.8" strokeLinecap="round"><line x1="19" y1="19" x2="19" y2="10"/><line x1="19" y1="19" x2="27" y2="24"/><line x1="19" y1="19" x2="11" y2="24"/></g><g fill="white"><circle cx="19" cy="19" r="3.2"/><circle cx="19" cy="10" r="2.2"/><circle cx="27" cy="24" r="2.2"/><circle cx="11" cy="24" r="2.2"/></g></svg>
                  <span className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>FreWork</span>
                </div>

                <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>Create your account</h1>
                <p className="text-white/40 mb-8 text-sm">Free to join · No credit card needed</p>

                {error && <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>}

                <button onClick={handleGoogle} disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 border border-white/12 rounded-2xl hover:border-white/25 hover:bg-white/4 transition-all font-medium text-white/80 hover:text-white mb-5">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" /> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span>Sign up with Google</span>
                </button>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8" /></div>
                  <div className="relative flex justify-center"><span className="text-xs text-white/30 bg-[#060C18] px-3">or create with email</span></div>
                </div>

                <button onClick={() => setStep("details")}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-white/12 text-white/70 hover:text-white hover:border-white/25 hover:bg-white/4 transition-all font-medium text-sm">
                  <Mail className="w-4 h-4" /> Continue with Email
                </button>

                <p className="text-center text-sm text-white/35 mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#C9A84C] font-semibold hover:underline">Sign in</Link>
                </p>
              </motion.div>
            )}

            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>Your details</h1>
                <p className="text-white/40 mb-8 text-sm">Create your FreWork account</p>
                {error && <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}
                <form onSubmit={handleEmailDetails} className="space-y-4">
                  {[
                    { label: "Full name", value: name, set: setName, type: "text", icon: User, placeholder: "Your full name" },
                    { label: "Email address", value: email, set: setEmail, type: "email", icon: Mail, placeholder: "you@example.com" },
                  ].map(({ label, value, set, type, icon: Icon, placeholder }) => (
                    <div key={label}>
                      <label className="text-sm font-medium text-white/60 mb-1.5 block">{label}</label>
                      <div className="relative">
                        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} required
                          className="w-full border border-white/10 rounded-2xl pl-11 pr-4 py-3 bg-white/4 text-white outline-none focus:border-[#C9A84C]/50 text-sm transition-all placeholder:text-white/20" />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required
                        className="w-full border border-white/10 rounded-2xl pl-11 pr-11 py-3 bg-white/4 text-white outline-none focus:border-[#C9A84C]/50 text-sm transition-all placeholder:text-white/20" />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep("method")}
                      className="flex-1 h-12 rounded-2xl border border-white/12 text-white/60 hover:text-white hover:border-white/25 transition-all text-sm font-medium">
                      Back
                    </button>
                    <button type="submit" disabled={loading}
                      className="flex-1 h-12 rounded-2xl font-semibold text-[#0B1120] flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                      style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === "mobile" && (
              <motion.div key="mobile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="w-14 h-14 rounded-2xl bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center mb-6">
                  <Phone className="w-7 h-7 text-[#C9A84C]" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>Add mobile number</h1>
                <p className="text-white/40 text-sm mb-3">Our CA expert will call you for a free consultation.</p>
                <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/15 rounded-2xl px-4 py-3 text-sm text-[#E8C97A]/80 mb-6 flex items-start gap-2">
                  <span className="mt-0.5">📞</span>
                  <span>We call every new client within 24 hours to understand your requirements.</span>
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
                    className="w-full h-12 rounded-2xl font-semibold text-[#0B1120] flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Registration"}
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
                <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>Account created!</h1>
                <p className="text-white/40 mb-2 text-sm">Welcome to FreWork, {displayName || "there"}!</p>
                <p className="text-white/25 text-xs mb-8">Our team will reach out within 24 hours for your free consultation.</p>
                <div className="flex flex-col gap-3 items-center">
                  {role === "freelancer" && (
                    <button onClick={() => router.push("/dashboard/freelancer/submit")}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-[#0B1120]"
                      style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
                      Add My Skills & Profile <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {role === "space_owner" && (
                    <button onClick={() => router.push("/dashboard/workspace/submit")}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-[#0B1120]"
                      style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
                      List My Space <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {role === "client" && (
                    <button onClick={() => router.push("/services")}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-[#0B1120]"
                      style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
                      View Services <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => router.push("/dashboard")} className="text-sm text-white/35 hover:text-white/60 transition-colors">
                    Go to Dashboard
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
