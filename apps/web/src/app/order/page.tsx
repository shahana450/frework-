"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usePhonePe } from "@/hooks/use-phonepe";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, Clock, BadgeCheck,
  Phone, Mail, User, Building2, MessageSquare, Loader2, ChevronRight,
} from "lucide-react";

const SERVICE_META: Record<string, { name: string; price: number; color: string; grad: string; desc: string }> = {
  "gst-registration":  { name: "GST Registration & Filing",   price: 999,   color: "#2563EB", grad: "linear-gradient(135deg,#1D4ED8,#2563EB)", desc: "GSTIN in 3–5 days · Monthly GSTR-1 & 3B filing by expert CA" },
  "income-tax":        { name: "Income Tax Return (ITR)",      price: 799,   color: "#059669", grad: "linear-gradient(135deg,#047857,#059669)", desc: "ITR-1 to ITR-6 · Tax planning & maximum refunds" },
  "accounting":        { name: "Accounting & Bookkeeping",     price: 1499,  color: "#D97706", grad: "linear-gradient(135deg,#B45309,#D97706)", desc: "Monthly books · P&L · Balance sheet by qualified CA" },
  "company-reg":       { name: "Company Registration",         price: 999,   color: "#7C3AED", grad: "linear-gradient(135deg,#6D28D9,#7C3AED)", desc: "Pvt Ltd · LLP · OPC · Proprietorship — fully online" },
  "gst-audit":         { name: "GST Audit & Reconciliation",   price: 4999,  color: "#DC2626", grad: "linear-gradient(135deg,#B91C1C,#DC2626)", desc: "GSTR-9C · ITC reconciliation · Notice handling" },
  "roc-compliance":    { name: "ROC & Compliance",             price: 1999,  color: "#0891B2", grad: "linear-gradient(135deg,#0E7490,#0891B2)", desc: "Annual filing · MCA · Director KYC" },
};

function OrderForm() {
  const searchParams = useSearchParams();
  const serviceKey = searchParams.get("service") ?? "gst-registration";
  const meta = SERVICE_META[serviceKey] ?? SERVICE_META["gst-registration"];

  const { loading, error: ppError, initiateServicePayment } = usePhonePe();

  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [form, setForm]     = useState({ name: "", phone: "", email: "", business: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setForm(f => ({
          ...f,
          name:  f.name  || session.user.user_metadata?.full_name || "",
          email: f.email || session.user.email || "",
        }));
      }
    });
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())                                    e.name  = "Name is required";
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, "")))     e.phone = "Enter valid 10-digit mobile number";
    if (!form.email.includes("@"))                            e.email = "Enter valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = () => {
    if (!validate()) return;
    initiateServicePayment({
      service:       serviceKey,
      serviceName:   meta.name,
      amount:        meta.price,
      userId,
      customerName:  form.name,
      customerPhone: form.phone,
      customerEmail: form.email,
      businessName:  form.business,
      notes:         form.notes,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-px h-5 bg-slate-200" />
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-black text-xs"
            style={{ background: "linear-gradient(135deg,#1246C8,#2563EB)" }}>F</div>
          <span className="font-black text-slate-900">FreWork</span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <span className="text-sm text-slate-500 font-medium">Checkout</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left: Form ── */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 mb-1">Complete your order</h1>
              <p className="text-sm text-slate-500">Fill in your details — our CA team will contact you within 2 hours of payment.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="font-bold text-slate-800 text-sm">Your Details</h2>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Rajesh Kumar" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${errors.name ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-blue-400"}`} />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mobile Number *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">+91</span>
                  <input type="tel" placeholder="9876543210" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    className={`w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${errors.phone ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-blue-400"}`} />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" placeholder="rajesh@business.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${errors.email ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-blue-400"}`} />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Business / Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="My Business Pvt Ltd (optional)" value={form.business}
                    onChange={e => setForm(f => ({ ...f, business: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 text-sm outline-none transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Any specific requirement?</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea rows={3} placeholder="E.g. I have a proprietorship, need GST for e-commerce..." value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 text-sm outline-none transition-colors resize-none" />
                </div>
              </div>
            </div>

            {ppError && (
              <div className="border border-red-300 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{ppError}</div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ShieldCheck, text: "Secure PhonePe checkout" },
                { icon: BadgeCheck,  text: "Expert CA assigned in 2 hrs" },
                { icon: Clock,       text: "Delivered in 3–5 days" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col items-center text-center gap-1.5">
                  <Icon className="w-4 h-4 text-blue-600" />
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Order summary ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="h-1.5" style={{ background: meta.grad }} />
                <div className="p-5">
                  <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: meta.color }}>
                    Service Selected
                  </p>
                  <h3 className="font-black text-slate-900 text-base leading-snug mb-1">{meta.name}</h3>
                  <p className="text-xs text-slate-500 mb-4">{meta.desc}</p>

                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Service fee</span>
                      <span className="font-semibold text-slate-800">₹{meta.price.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">GST (18%)</span>
                      <span className="font-semibold text-slate-800">Included</span>
                    </div>
                    <div className="h-px bg-slate-100 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-black" style={{ color: meta.color }}>
                        ₹{meta.price.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handlePay} disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: meta.grad, boxShadow: `0 4px 20px ${meta.color}40` }}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to PhonePe…</>
                ) : (
                  <>Pay ₹{meta.price.toLocaleString("en-IN")} via PhonePe</>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                Powered by PhonePe · UPI · Cards · Net Banking · EMI
              </p>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-2">Have a question before paying?</p>
                <a
                  href={`https://wa.me/918590874681?text=${encodeURIComponent(`Hi FreWork, I want to know more about ${meta.name} (₹${meta.price}) before paying.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline">
                  <Phone className="w-3 h-3" /> Ask on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OrderForm />
    </Suspense>
  );
}
