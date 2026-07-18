"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, ShieldCheck, Clock, BadgeCheck,
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

function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById("razorpay-sdk")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function OrderForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const serviceKey = searchParams.get("service") ?? "gst-registration";
  const meta = SERVICE_META[serviceKey] ?? SERVICE_META["gst-registration"];

  const [userId, setUserId]         = useState<string | undefined>(undefined);
  const [form, setForm]             = useState({ name: "", phone: "", email: "", business: "", notes: "" });
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [paymentId, setPaymentId]   = useState("");

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
    if (!form.name.trim())                           e.name    = "Name is required";
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Enter valid 10-digit mobile number";
    if (!form.email.includes("@"))                   e.email   = "Enter valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { alert("Could not load payment gateway. Please try again."); setLoading(false); return; }

      const res = await fetch("/api/razorpay/create-service-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service:       serviceKey,
          amount:        meta.price,
          userId,
          customerName:  form.name,
          customerPhone: form.phone,
          customerEmail: form.email,
        }),
      });

      if (!res.ok) throw new Error("Could not create order");
      const { orderId, amount, currency } = await res.json();

      const rzp = new window.Razorpay({
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount,
        currency,
        name:        "FreWork",
        description: meta.name,
        order_id:    orderId,
        prefill:     { name: form.name, email: form.email, contact: `91${form.phone}` },
        theme:       { color: meta.color },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          // Verify + save
          await fetch("/api/razorpay/verify-service", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              service:       serviceKey,
              serviceName:   meta.name,
              amount,
              userId,
              customerName:  form.name,
              customerPhone: form.phone,
              customerEmail: form.email,
              businessName:  form.business,
              notes:         form.notes,
            }),
          });
          setPaymentId(response.razorpay_payment_id);
          setSuccess(true);
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      alert("Payment failed. Please try again or contact us on WhatsApp.");
      setLoading(false);
    }
  };

  if (success) {
    const waMsg = encodeURIComponent(
      `Hi FreWork, I just paid for ${meta.name} (₹${meta.price.toLocaleString("en-IN")}). My payment ID is ${paymentId}. Name: ${form.name}, Phone: ${form.phone}, Business: ${form.business || "N/A"}. Please proceed.`
    );
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Payment Successful!</h1>
          <p className="text-slate-500 text-sm mb-1">
            You paid <span className="font-bold text-slate-800">₹{meta.price.toLocaleString("en-IN")}</span> for <strong>{meta.name}</strong>
          </p>
          <p className="text-xs text-slate-400 mb-6">Payment ID: <span className="font-mono text-slate-600">{paymentId}</span></p>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-left mb-6">
            <p className="text-sm font-bold text-emerald-800 mb-1">What happens next?</p>
            <ol className="text-xs text-emerald-700 space-y-1 list-decimal list-inside">
              <li>Our CA team reviews your details within 2 hours</li>
              <li>You&apos;ll get a WhatsApp message with next steps</li>
              <li>Service delivered in 3–5 business days</li>
            </ol>
          </div>

          <a
            href={`https://wa.me/918590874681?text=${waMsg}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white mb-3"
            style={{ background: "#25D366" }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Message Our CA Team on WhatsApp
          </a>
          <Link href="/dashboard" className="block text-sm text-blue-600 font-semibold hover:underline">
            Go to Dashboard →
          </Link>
        </div>
      </div>
    );
  }

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

            {/* Contact details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="font-bold text-slate-800 text-sm">Your Details</h2>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text" placeholder="Rajesh Kumar"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${errors.name ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-blue-400"}`}
                  />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mobile Number *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">+91</span>
                  <input
                    type="tel" placeholder="9876543210"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    className={`w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${errors.phone ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-blue-400"}`}
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email" placeholder="rajesh@business.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors ${errors.email ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-blue-400"}`}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* Business name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Business / Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text" placeholder="My Business Pvt Ltd (optional)"
                    value={form.business}
                    onChange={e => setForm(f => ({ ...f, business: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Any specific requirement?</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    rows={3} placeholder="E.g. I have a proprietorship, need GST for e-commerce..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 text-sm outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ShieldCheck, text: "Secure Razorpay checkout" },
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

              {/* Service card */}
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

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: meta.grad, boxShadow: `0 4px 20px ${meta.color}40` }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <>Pay ₹{meta.price.toLocaleString("en-IN")} Securely</>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                Powered by Razorpay · UPI · Cards · Net Banking · EMI
              </p>

              {/* Already have query? */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-2">Have a question before paying?</p>
                <a
                  href={`https://wa.me/918590874681?text=${encodeURIComponent(`Hi FreWork, I want to know more about ${meta.name} (₹${meta.price}) before paying.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
                >
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
