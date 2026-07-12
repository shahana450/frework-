"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, MapPin, CheckCircle, Loader2, MessageSquare, Clock, ArrowRight, Star, Shield, Zap } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { supabase } from "@/lib/supabase";

const SERVICES = [
  "GST Registration & Filing",
  "Income Tax Return",
  "Company / LLP Registration",
  "Monthly Accounting",
  "Audit",
  "ROC Compliance",
  "Virtual CFO",
  "Other",
];

const TRUST = [
  { icon: Star, label: "4.9/5 Rating", sub: "500+ happy clients" },
  { icon: Shield, label: "CA/CS Qualified", sub: "Verified experts" },
  { icon: Zap, label: "2-Hour Response", sub: "Guaranteed callback" },
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
        name: form.name,
        email: form.email || null,
        mobile: form.mobile,
        service: form.service || null,
        message: form.message || null,
      });
    } catch {}
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF5" }}>
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden pt-28 pb-20 px-4"
        style={{ background: "linear-gradient(135deg, #1A1208 0%, #2C1F0A 50%, #1A1208 100%)" }}>
        {/* Gold shimmer top */}
        <div className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #B8903A, #E8C97A, #B8903A, transparent)" }} />

        {/* Glow orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(184,144,58,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(184,144,58,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black tracking-[0.25em] uppercase mb-6"
              style={{ background: "rgba(184,144,58,0.15)", color: "#E8C97A", border: "1px solid rgba(184,144,58,0.3)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#E8C97A" }} />
              Free Consultation — No Charges
            </span>

            <h1 className="font-black mb-4 leading-tight"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: "#FAFAF5", fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
              Talk to an{" "}
              <span style={{ background: "linear-gradient(135deg, #E8C97A, #B8903A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Expert
              </span>
            </h1>

            <p className="text-base max-w-lg mx-auto mb-10" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
              Get a free 30-minute consultation with a CA/CS qualified expert.<br />
              No obligation. No hidden charges. Just clarity.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4">
              {TRUST.map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2.5 px-4 py-2 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(184,144,58,0.2)" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(184,144,58,0.15)" }}>
                    <Icon size={15} style={{ color: "#E8C97A" }} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold" style={{ color: "#E8C97A" }}>{label}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="py-16 px-4 -mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-6">

            {/* ── Left Panel ── */}
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
                    { Icon: Mail, title: "contact.frework@gmail.com", sub: "Email us anytime", href: "mailto:contact.frework@gmail.com" },
                    { Icon: MapPin, title: "Mumbai, Maharashtra", sub: "Serving businesses across India", href: undefined },
                  ].map(({ Icon, title, sub, href }) => (
                    <a key={title} href={href}
                      className="flex gap-3 group"
                      style={{ textDecoration: "none", cursor: href ? "pointer" : "default" }}>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                        style={{ background: "rgba(184,144,58,0.15)", border: "1px solid rgba(184,144,58,0.25)" }}>
                        <Icon size={16} style={{ color: "#E8C97A" }} />
                      </div>
                      <div>
                        <p className="font-bold text-sm transition-colors" style={{ color: "#FAFAF5" }}>{title}</p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{sub}</p>
                      </div>
                    </a>
                  ))}
                </div>

                {/* WhatsApp CTA */}
                <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20need%20a%20consultation"
                  target="_blank" rel="noopener noreferrer"
                  className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] relative z-10"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#fff", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.123 1.522 5.854L.054 23.267a.75.75 0 0 0 .918.918l5.413-1.468A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.5-5.22-1.37l-.374-.213-3.876 1.052 1.017-3.742-.231-.386A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                  Chat on WhatsApp
                </a>
              </motion.div>

              {/* Response time card */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="rounded-3xl p-6"
                style={{ background: "#fff", border: "1px solid rgba(184,144,58,0.15)", boxShadow: "0 4px 24px rgba(139,108,50,0.08)" }}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(184,144,58,0.1)" }}>
                    <Clock size={15} style={{ color: "#B8903A" }} />
                  </div>
                  <h3 className="font-black text-sm" style={{ color: "#1A1208" }}>Response Time</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Consultation booking", value: "Within 2 hours", color: "#059669" },
                    { label: "General enquiry", value: "Within 24 hours", color: "#B8903A" },
                    { label: "Emergency (GST notice)", value: "Same day", color: "#DC2626" },
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

            {/* ── Form ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="lg:col-span-3 rounded-3xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid rgba(184,144,58,0.18)", boxShadow: "0 20px 60px rgba(139,108,50,0.1)" }}>

              {/* Gold top bar */}
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
                      <p className="mb-8" style={{ color: "#6B5B3E" }}>
                        Our CA will call you within 2 hours to schedule your free consultation.
                      </p>
                      <button
                        onClick={() => { setSent(false); setForm({ name: "", email: "", mobile: "", service: "", message: "" }); }}
                        className="px-6 py-3 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.02]"
                        style={{ borderColor: "rgba(184,144,58,0.3)", color: "#B8903A", background: "rgba(184,144,58,0.05)" }}>
                        Submit Another Request
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                      <div className="mb-6">
                        <h2 className="text-xl font-black mb-1" style={{ color: "#1A1208" }}>Book Free Consultation</h2>
                        <p className="text-xs" style={{ color: "#9C8B70" }}>Fill in the details below — our expert will reach out within 2 hours.</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        {[
                          { label: "Full name *", key: "name", type: "text", placeholder: "Your name", required: true },
                          { label: "Mobile number *", key: "mobile", type: "tel", placeholder: "10-digit number", required: true },
                        ].map(({ label, key, type, placeholder, required }) => (
                          <div key={key}>
                            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>{label}</label>
                            <input
                              required={required} type={type}
                              value={form[key as keyof typeof form]}
                              onChange={e => setForm(f => ({
                                ...f,
                                [key]: key === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value,
                              }))}
                              placeholder={placeholder}
                              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                              style={{
                                border: "2px solid rgba(184,144,58,0.2)",
                                background: "#FAFAF5",
                                color: "#1A1208",
                              }}
                              onFocus={e => { e.target.style.borderColor = "#B8903A"; e.target.style.boxShadow = "0 0 0 3px rgba(184,144,58,0.1)"; }}
                              onBlur={e => { e.target.style.borderColor = "rgba(184,144,58,0.2)"; e.target.style.boxShadow = "none"; }}
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>Email address</label>
                        <input
                          type="email" value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="you@example.com"
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                          style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: "#1A1208" }}
                          onFocus={e => { e.target.style.borderColor = "#B8903A"; e.target.style.boxShadow = "0 0 0 3px rgba(184,144,58,0.1)"; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(184,144,58,0.2)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>Service needed</label>
                        <select
                          value={form.service}
                          onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all appearance-none cursor-pointer"
                          style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: form.service ? "#1A1208" : "#9C8B70" }}
                          onFocus={e => { e.target.style.borderColor = "#B8903A"; e.target.style.boxShadow = "0 0 0 3px rgba(184,144,58,0.1)"; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(184,144,58,0.2)"; e.target.style.boxShadow = "none"; }}
                        >
                          <option value="">Select a service…</option>
                          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "#1A1208" }}>Message (optional)</label>
                        <textarea
                          value={form.message}
                          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                          rows={3} placeholder="Tell us about your business…"
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none"
                          style={{ border: "2px solid rgba(184,144,58,0.2)", background: "#FAFAF5", color: "#1A1208" }}
                          onFocus={e => { e.target.style.borderColor = "#B8903A"; e.target.style.boxShadow = "0 0 0 3px rgba(184,144,58,0.1)"; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(184,144,58,0.2)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>

                      <button
                        type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm transition-all hover:scale-[1.01] hover:opacity-95 disabled:opacity-60"
                        style={{
                          background: "linear-gradient(135deg, #E8C97A, #B8903A)",
                          color: "#1A1208",
                          boxShadow: "0 6px 28px rgba(184,144,58,0.4)",
                        }}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : (
                          <><span>Book Free Consultation</span><ArrowRight size={16} /></>
                        )}
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
