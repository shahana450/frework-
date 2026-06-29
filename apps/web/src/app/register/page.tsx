"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ArrowRight, Phone, CheckCircle, Loader2, User, Mail, Lock } from "lucide-react";
import Link from "next/link";

type Step = "method" | "details" | "mobile" | "done";

function saveUser(data: Record<string, string>) {
  try {
    const users = JSON.parse(localStorage.getItem("fw_users") || "[]");
    const record = { ...data, createdAt: new Date().toISOString(), id: data.id || `u_${Date.now()}` };
    users.push(record);
    localStorage.setItem("fw_users", JSON.stringify(users));
  } catch {}
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("method");
  const [authMethod, setAuthMethod] = useState<"google" | "email" | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [userData, setUserData] = useState<Record<string, string>>({});

  const handleGoogle = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const gUser = { id: `g_${Date.now()}`, name: "Google User", email: `user_${Date.now()}@gmail.com`, method: "google" };
    setUserData(gUser);
    setAuthMethod("google");
    setLoading(false);
    setStep("mobile");
  };

  const handleEmailDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setUserData({ id: `e_${Date.now()}`, name, email, method: "email" });
    setAuthMethod("email");
    setLoading(false);
    setStep("mobile");
  };

  const sendOtp = async () => {
    if (mobile.length < 10) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setOtpSent(true);
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    saveUser({ ...userData, mobile });
    setLoading(false);
    setStep("done");
  };

  const steps = ["Account", "Mobile", "Done"];
  const currentStepIdx = step === "method" || step === "details" ? 0 : step === "mobile" ? 1 : 2;

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900 relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/5" style={{ width: `${150 + i * 80}px`, height: `${150 + i * 80}px`, left: `${10 + i * 12}%`, top: `${5 + i * 14}%` }} />
          ))}
        </div>
        <div className="relative z-10 text-white max-w-xs">
          <div className="flex items-center gap-3 mb-10">
            <svg width="40" height="40" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="9" fill="white" fillOpacity="0.2"/><circle cx="18" cy="11" r="2.5" fill="white"/><circle cx="11" cy="23" r="2.5" fill="white"/><circle cx="25" cy="23" r="2.5" fill="white"/><line x1="18" y1="13.5" x2="11" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="18" y1="13.5" x2="25" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="11" y1="23" x2="25" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <span className="text-2xl font-bold">FreWork</span>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight">Join 500+ businesses growing with FreWork</h2>
          <p className="text-white/70 text-base mb-10">Expert compliance, accounting & tax — so you can focus on what matters.</p>
          <div className="space-y-4">
            {[
              ["✅", "CA & CS qualified experts"],
              ["⚡", "24-hour turnaround"],
              ["🔒", "100% data privacy"],
              ["📞", "Dedicated account manager"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-white/90 text-sm">
                <span className="text-lg">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Progress */}
          {step !== "method" && (
            <div className="flex items-center gap-2 mb-8">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= currentStepIdx ? "bg-violet-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}>
                    {i < currentStepIdx ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i === currentStepIdx ? "text-violet-600" : "text-gray-400"}`}>{s}</span>
                  {i < steps.length - 1 && <div className={`h-0.5 w-8 rounded ${i < currentStepIdx ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-700"}`} />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === "method" && (
              <motion.div key="method" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="lg:hidden flex items-center gap-2 mb-8">
                  <svg width="32" height="32" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="9" fill="#7C3AED"/><circle cx="18" cy="11" r="2.5" fill="white"/><circle cx="11" cy="23" r="2.5" fill="white"/><circle cx="25" cy="23" r="2.5" fill="white"/><line x1="18" y1="13.5" x2="11" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="18" y1="13.5" x2="25" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="11" y1="23" x2="25" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  <span className="text-xl font-bold">FreWork</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Create your account</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Free to join · No credit card needed</p>

                <button onClick={handleGoogle} disabled={loading} className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all font-medium text-gray-700 dark:text-gray-200 mb-4">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-violet-600" /> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  )}
                  <span>Sign up with Google</span>
                </button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700" /></div>
                  <div className="relative flex justify-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-950 px-3">or create with email</div>
                </div>

                <Button onClick={() => setStep("details")} variant="outline" className="w-full h-12 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium gap-2 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all">
                  <Mail className="w-4 h-4" />
                  Continue with Email
                </Button>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-violet-600 font-semibold hover:underline">Sign in</Link>
                </p>
                <p className="text-center text-xs text-gray-400 mt-4">
                  By signing up you agree to our{" "}
                  <Link href="/terms" className="underline hover:text-violet-600">Terms</Link>
                  {" & "}
                  <Link href="/privacy" className="underline hover:text-violet-600">Privacy Policy</Link>
                </p>
              </motion.div>
            )}

            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Your details</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Create your FreWork account</p>
                <form onSubmit={handleEmailDetails} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Full name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl pl-11 pr-4 py-3 bg-white dark:bg-gray-900 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl pl-11 pr-4 py-3 bg-white dark:bg-gray-900 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" minLength={8} required className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl pl-11 pr-11 py-3 bg-white dark:bg-gray-900 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" onClick={() => setStep("method")} variant="outline" className="flex-1 h-12 rounded-2xl border-2 border-gray-200 dark:border-gray-700">Back</Button>
                    <Button type="submit" disabled={loading} className="flex-1 h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-semibold gap-2">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === "mobile" && (
              <motion.div key="mobile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mb-6">
                  <Phone className="w-7 h-7 text-violet-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Verify mobile</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">We need your mobile number to secure your account and send updates.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Mobile number</label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-4 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 font-medium">+91</span>
                      <input type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" className="flex-1 border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 bg-white dark:bg-gray-900 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                    </div>
                  </div>
                  {!otpSent ? (
                    <Button onClick={sendOtp} disabled={loading || mobile.length < 10} className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-semibold">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send OTP"}
                    </Button>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Enter OTP</label>
                        <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="• • • • • •" className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 bg-white dark:bg-gray-900 outline-none focus:border-violet-500 text-sm dark:text-white transition-all tracking-[0.5em] text-center text-xl font-bold" />
                        <p className="text-xs text-gray-400 mt-1.5 text-center">
                          Sent to +91 {mobile}
                          <button onClick={() => { setOtpSent(false); setOtp(""); }} className="text-violet-600 underline ml-1">Change</button>
                        </p>
                      </div>
                      <Button onClick={verifyOtp} disabled={loading || otp.length < 4} className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-semibold">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Create Account"}
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Account created!</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-2">Welcome to FreWork, {userData.name || "there"}!</p>
                <p className="text-gray-400 text-sm mb-8">Our team will reach out within 24 hours to schedule your free consultation.</p>
                <div className="flex gap-3 justify-center">
                  <Button asChild className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl px-8 h-12">
                    <Link href="/">Go to Home</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-2xl h-12 px-8 border-2">
                    <Link href="/contact">Book Consultation</Link>
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
