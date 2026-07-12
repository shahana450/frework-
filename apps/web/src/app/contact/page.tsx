"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, MapPin, CheckCircle, Loader2, Clock, ArrowRight, Star, Shield, Zap, MessageCircle } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { supabase } from "@/lib/supabase";

const SERVICES = [
  "GST Registration & Filing", "Income Tax Return", "Company / LLP Registration",
  "Monthly Accounting", "Audit", "ROC Compliance", "Virtual CFO", "Other",
];

/* Floating dot positions — static to avoid hydration mismatch */
const DOTS = [
  { w: 3, h: 3, top: "12%", left: "8%",  delay: 0,    dur: 3.2 },
  { w: 2, h: 2, top: "28%", left: "18%", delay: 0.8,  dur: 4.1 },
  { w: 4, h: 4, top: "55%", left: "5%",  delay: 1.4,  dur: 2.9 },
  { w: 2, h: 2, top: "75%", left: "14%", delay: 0.3,  dur: 3.7 },
  { w: 3, h: 3, top: "10%", left: "88%", delay: 1.1,  dur: 4.0 },
  { w: 2, h: 2, top: "40%", left: "92%", delay: 0.5,  dur: 3.3 },
  { w: 4, h: 4, top: "68%", left: "85%", delay: 1.7,  dur: 2.8 },
  { w: 2, h: 2, top: "85%", left: "78%", delay: 0.2,  dur: 4.5 },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", service: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.from("fw_enquiries").insert({
        name: form.name, email: form.email || null,
        mobile: form.mobile, service: form.service || null, message: form.message || null,
      });
    } catch {}
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF5" }}>
      <Navbar />

      {/* ══ HERO ══ */}
      <div className="relative overflow-hidden px-4"
        style={{ background: "linear-gradient(160deg, #0D0A04 0%, #1A1208 40%, #2C1F0A 70%, #1A1208 100%)", paddingTop: "9rem", paddingBottom: "5rem" }}>

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(rgba(184,144,58,1) 1px, transparent 1px), linear-gradient(90deg,rgba(184,144,58,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

        {/* Glow orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(184,144,58,0.18) 0%, transparent 65%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(5,150,105,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />

        {/* Shimmer lines */}
        <div className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, #B8903A 30%, #E8C97A 50%, #B8903A 70%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-px opacity-30"
          style={{ background: "linear-gradient(90deg, transparent, #B8903A, transparent)" }} />

        {/* Floating dots */}
        {DOTS.map((d, i) => (
          <motion.div key={i}
            className="absolute rounded-full pointer-events-none"
            style={{ width: d.w, height: d.h, top: d.top, left: d.left, background: "#B8903A", opacity: 0.4 }}
            animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

            {/* Eyebrow */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12" style={{ background: "linear-gradient(90deg, transparent, #B8903A)" }} />
              <span className="text-[11px] font-black tracking-[0.35em] uppercase" style={{ color: "#B8903A" }}>
                Free Consultation
              </span>
              <div className="h-px w-12" style={{ background: "linear-gradient(90deg, #B8903A, transparent)" }} />
            </div>

            {/* Headline */}
            <h1 className="font-black mb-6 leading-[1.0]"
              style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              <span style={{ color: "#FAFAF5" }}>Talk to an </span>
              <span className="relative inline-block">
                <span style={{ background: "linear-gradient(135deg, #F5E09A 0%, #E8C97A 40%, #B8903A 80%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Expert
                </span>
                {/* Underline accent */}
                <svg className="absolute -bottom-2 left-0 w-full" height="6" viewBox="0 0 200 6" preserveAspectRatio="none">
                  <path d="M0,5 Q50,0 100,3 Q150,6 200,2" stroke="url(#uline)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="uline" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#E8C97A" stopOpacity="0"/>
                      <stop offset="40%" stopColor="#E8C97A"/>
                      <stop offset="100%" stopColor="#B8903A" stopOpacity="0.4"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              30-minute session with a CA/CS qualified professional —{" "}
              <span style={{ color: "rgba(232,201,122,0.85)" }}>completely free</span>, no obligation, no hidden charges.
            </p>

            {/* CA Avatars row */}
            <div className="flex items-center justify-center gap-3 mb-10">
              <div className="flex -space-x-3">
                {["CA", "CS", "CPA", "CA"].map((t, i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-black"
                    style={{ borderColor: "#B8903A", background: `hsl(${260 + i * 15},60%,${35 + i * 5}%)`, color: "#E8C97A", zIndex: 4 - i }}>
                    {t}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: "#E8C97A" }}>Our expert team</p>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} size={10} fill="#B8903A" style={{ color: "#B8903A" }} />)}
                  <span className="text-[11px] ml-1" style={{ color: "rgba(255,255,255,0.45)" }}>4.9 · 500+ clients</span>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { icon: Shield, label: "CA/CS Qualified",  sub: "Verified experts",      color: "#7C3AED" },
                { icon: Zap,    label: "2-Hour Response",  sub: "Guaranteed callback",   color: "#059669" },
                { icon: Star,   label: "4.9/5 Rating",     sub: "500+ happy clients",    color: "#B8903A" },
              ].map(({ icon: Icon, label, sub, color }) => (
                <motion.div key={label}
                  whileHover={{ scale: 1.04, y: -2 }}
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl cursor-default"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(184,144,58,0.18)", backdropFilter: "blur(8px)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20`, border: `1px solid ${color}35` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black" style={{ color: "#E8C97A" }}>{label}</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

          </motion.div>
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <main className="py-16 px-4 -mt-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-6">

            {/* LEFT PANEL */}
            <div className="lg:col-span-2 space-y-5">

              {/* Contact card */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                className="rounded-3xl p-6 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #1A1208 0%, #2C1F0A 60%, #1A1208 100%)", border: "1px solid rgba(184,144,58,0.25)", boxShadow: "0 20px 60px rgba(26,18,8,0.25)" }}>

                <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(184,144,58,0.12) 0%, transparent 70%)", filter: "blur(20px)" }} />
                <div className="absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl"
                  style={{ background: "linear-gradient(90deg, transparent, #B8903A, #E8C97A, #B8903A, transparent)" }} />

                <h2 className="font-black text-base mb-5 relative z-10" style={{ color: "#E8C97A", letterSpacing: "0.05em" }}>
                  Contact Information
                </h2>

                <div className="space-y-4 relative z-10">
                  {[
                    { Icon: Phone, title: "+91 8590874681", sub: "Call us Mon–Sat, 9am–7pm", href: "tel:+918590874681" },
                    { Icon: Mail,  title: "contact.frework@gmail.com", sub: "Email us anytime", href: "mailto:contact.frework@gmail.com" },
                    { Icon: MapPin,title: "Mumbai, Maharashtra", sub: "Serving businesses across India", href: undefined },
                  ].map(({ Icon, title, sub, href }) => (
                    <a key={title} href={href} className="flex gap-3 group" style={{ textDecoration: "none", cursor: href ? "pointer" : "default" }}>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                        style={{ background: "rgba(184,144,58,0.15)", border: "1px solid rgba(184,144,58,0.25)" }}>
                        <Icon size={16} style={{ color: "#E8C97A" }} />
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: "#FAFAF5" }}>{title}</p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</p>
                      </div>
                    </a>
                  ))}
                </div>

                {/* WhatsApp */}
                <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20need%20a%20consultation"
                  target="_blank" rel="noopener noreferrer"
                  className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] relative z-10"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#fff", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}>
                  <MessageCircle size={15} /> Chat on WhatsApp
                </a>
              </motion.div>

              {/* Response time */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="rounded-3xl p-6"
                style={{ background: "#fff", border: "1px solid rgba(184,144,58,0.15)", boxShadow: "0 4px 24px rgba(139,108,50,0.08)" }}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(184,144,58,0.1)" }}>
                    <Clock size={15} style={{ color: "#B8903A" }} />
                  </div>
                  <h3 className="font-black text-sm" style={{ color: "#1A1208" }}>Response Time</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Consultation booking", value: "Within 2 hours", color: "#059669" },
                    { label: "General enquiry",       value: "Within 24 hours", color: "#B8903A" },
                    { label: "Emergency (GST notice)",value: "Same day",        color: "#DC2626" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2.5 border-b last:border-0"
                      style={{ borderColor: "rgba(184,144,58,0.1)" }}>
                      <span className="text-xs" style={{ color: "#6B5B3E" }}>{label}</span>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full"
                        style={{ background: `${color}12`, color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* FORM */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="lg:col-span-3 rounded-3xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid rgba(184,144,58,0.18)", boxShadow: "0 20px 60px rgba(139,108,50,0.1)" }}>

              <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #E8C97A, #B8903A, #E8C97A)" }} />

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {sent ? (
                    <motion.div key="success"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12">
                      <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.15), rgba(5,150,105,0.05))", border: "2px solid rgba(5,150,105,0.3)" }}>
                        <CheckCircle size={36} style={{ color: "#059669" }} />
                      </div>
                      <h2 className="text-2xl font-black mb-2" style={{ color: "#1A1208" }}>Request Received!</h2>
                      <p className="mb-8" style={{ color: "#6B5B3E" }}>Our CA will call you within 2 hours to schedule your free consultation.</p>
                      <button onClick={() => { setSent(false); setForm({ name: "", email: "", mobile: "", service: "", message: "" }); }}
                        className="px-6 py-3 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.02]"
                        style={{ borderColor: "rgba(184,144,58,0.3)", color: "#B8903A", background: "rgba(184,144,58,0.05)" }}>
                        Submit Another Request
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                      <div className="mb-6">
                        <h2 className="text-xl font-black mb-1" style={{ color: "#1A1208" }}>Book Free Consultation</h2>
                        <p className="text-xs" style={{ color: "#9C8B70" }}>Fill in the details — our expert will reach out within 2 hours.</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        {[
                          { label: "Full name *",      key: "name",   type: "text", placeholder: "Your name",       required: true },
                          { label: "Mobile number *",  key: "mobile", type: "tel",  placeholder: "10-digit number", required: true },
                        ].map(({ label, key, type, placeholder, required }) => (
                          <div key={key}>
                            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>{label}</label>
                            <input required={required} type={type}
                              value={form[key as keyof typeof form]}
                              onChange={e => setForm(f => ({ ...f, [key]: key === "mobile" ? e.target.value.replace(/\D/g,"").slice(0,10) : e.target.value }))}
                              placeholder={placeholder}
                              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                              style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: "#1A1208" }}
                              onFocus={e => { e.target.style.borderColor="#B8903A"; e.target.style.boxShadow="0 0 0 3px rgba(184,144,58,0.1)"; }}
                              onBlur={e =>  { e.target.style.borderColor="rgba(184,144,58,0.2)"; e.target.style.boxShadow="none"; }}
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>Email address</label>
                        <input type="email" value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="you@example.com"
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                          style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: "#1A1208" }}
                          onFocus={e => { e.target.style.borderColor="#B8903A"; e.target.style.boxShadow="0 0 0 3px rgba(184,144,58,0.1)"; }}
                          onBlur={e =>  { e.target.style.borderColor="rgba(184,144,58,0.2)"; e.target.style.boxShadow="none"; }}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>Service needed</label>
                        <select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all appearance-none cursor-pointer"
                          style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: form.service ? "#1A1208" : "#9C8B70" }}
                          onFocus={e => { e.target.style.borderColor="#B8903A"; e.target.style.boxShadow="0 0 0 3px rgba(184,144,58,0.1)"; }}
                          onBlur={e =>  { e.target.style.borderColor="rgba(184,144,58,0.2)"; e.target.style.boxShadow="none"; }}>
                          <option value="">Select a service…</option>
                          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>Message (optional)</label>
                        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                          rows={3} placeholder="Tell us about your business…"
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none"
                          style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: "#1A1208" }}
                          onFocus={e => { e.target.style.borderColor="#B8903A"; e.target.style.boxShadow="0 0 0 3px rgba(184,144,58,0.1)"; }}
                          onBlur={e =>  { e.target.style.borderColor="rgba(184,144,58,0.2)"; e.target.style.boxShadow="none"; }}
                        />
                      </div>

                      <button type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all hover:scale-[1.01] hover:opacity-95 disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, #E8C97A, #B8903A)", color: "#1A1208", boxShadow: "0 6px 28px rgba(184,144,58,0.4)" }}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <><span>Book Free Consultation</span><ArrowRight size={16} /></>}
                      </button>

                      <p className="text-[11px] text-center" style={{ color: "#9C8B70" }}>
                        Free · No commitment · Our CA will call you within 2 hours
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
