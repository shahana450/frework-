"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, CheckCircle, Loader2, MessageSquare } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { supabase } from "@/lib/supabase";

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 mb-4">Free Consultation</span>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Talk to an Expert</h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Get a free 30-minute consultation with a CA/CS qualified expert. No obligation, no hidden charges.</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-6 text-white">
                <h2 className="font-bold text-lg mb-4">Contact Information</h2>
                <div className="space-y-4">
                  {[
                    [Phone, "+91 98765 43210", "Call us Mon–Sat, 9am–7pm"],
                    [Mail, "hello@frework.online", "Email us anytime"],
                    [MapPin, "Mumbai, Maharashtra", "Serving businesses across India"],
                  ].map(([Icon, title, sub]) => (
                    <div key={String(title)} className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{String(title)}</p>
                        <p className="text-white/60 text-xs">{String(sub)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare className="w-5 h-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Response Time</h3>
                </div>
                <div className="space-y-3 text-sm">
                  {[["Consultation booking", "Within 2 hours"], ["General enquiry", "Within 24 hours"], ["Emergency (GST notice)", "Same day"]].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium text-violet-600">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Received!</h2>
                  <p className="text-gray-500">Our team will call you within 2 hours to schedule your free consultation.</p>
                  <Button onClick={() => { setSent(false); setForm({ name: "", email: "", mobile: "", service: "", message: "" }); }} variant="outline" className="mt-6 rounded-xl border-2">Submit Another</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Book Free Consultation</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Full name *</label>
                      <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-gray-50 dark:bg-gray-800 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Mobile number *</label>
                      <input required type="tel" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="10-digit number" className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-gray-50 dark:bg-gray-800 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Email address</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-gray-50 dark:bg-gray-800 outline-none focus:border-violet-500 text-sm dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Service needed</label>
                    <select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-gray-50 dark:bg-gray-800 outline-none focus:border-violet-500 text-sm dark:text-white transition-all">
                      <option value="">Select a service…</option>
                      {["GST Registration & Filing", "Income Tax Return", "Company / LLP Registration", "Monthly Accounting", "Audit", "ROC Compliance", "Virtual CFO", "Other"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Message (optional)</label>
                    <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Tell us about your business…" className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-gray-50 dark:bg-gray-800 outline-none focus:border-violet-500 text-sm dark:text-white transition-all resize-none" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-base">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Book Free Consultation"}
                  </Button>
                  <p className="text-xs text-gray-400 text-center">Free · No commitment · Our CA will call you within 2 hours</p>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
