"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRazorpay } from "@/hooks/use-razorpay";
import { Navbar } from "@/components/layout/navbar";
import { Check, Zap, Rocket, Users, Building2, Crown, ArrowLeft, Loader2, ShieldCheck, CheckCircle } from "lucide-react";
import Link from "next/link";

const PLANS = {
  professional: {
    name: "Professional", icon: Rocket, price: 999, yearly: 649,
    color: "border-[#C9A84C]/40", iconCls: "bg-[#C9A84C]/15 text-[#E8C97A]",
    features: ["Unlimited Applications","Unlimited Projects","Verified Badge","Analytics Dashboard","Priority Search","GST Registration","Monthly GST Filing","24/7 Chat Support"],
  },
  growth: {
    name: "Growth", icon: Users, price: 2999, yearly: 1949,
    color: "border-blue-500/25", iconCls: "bg-blue-500/12 text-blue-400",
    features: ["Everything in Professional","Team of 5 seats","Client Portal","Custom Contracts","Branded Proposals","Revenue Analytics","Bookkeeping"],
  },
  business: {
    name: "Business", icon: Building2, price: 4999, yearly: 3249,
    color: "border-purple-500/25", iconCls: "bg-purple-500/12 text-purple-400",
    features: ["Everything in Growth","Team of 20 seats","Dedicated Account Manager","API Access","White-label Proposals","Internal Audit","Annual Audit"],
  },
  enterprise: {
    name: "Enterprise", icon: Crown, price: 9999, yearly: 6499,
    color: "border-emerald-500/25", iconCls: "bg-emerald-500/12 text-emerald-400",
    features: ["Everything in Business","Unlimited Members","SSO / SAML","Unlimited API","White-label Solution","SLA 99.9%","On-premise Option"],
  },
};

type PlanKey = keyof typeof PLANS;

function SubscribeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { pay } = useRazorpay();

  const planKey = (params.get("plan") ?? "professional") as PlanKey;
  const plan = PLANS[planKey] ?? PLANS.professional;
  const Icon = plan.icon;

  const [yearly, setYearly] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; name: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      const u = session.user;
      const { data } = await supabase.from("fw_users").select("mobile,name").eq("id", u.id).maybeSingle();
      setUser({ id: u.id, email: u.email ?? "", name: data?.name ?? u.user_metadata?.full_name ?? "", phone: data?.mobile ?? "" });
    });
  }, [router]);

  const handlePay = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      await pay({
        plan: planKey,
        amount: yearly ? plan.yearly * 100 : plan.price * 100,
        userId: user.id,
        billing: yearly ? "yearly" : "monthly",
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        onSuccess: async (paymentId, orderId) => {
          await supabase.from("fw_subscriptions").upsert({
            user_id: user.id,
            plan: planKey,
            billing: yearly ? "yearly" : "monthly",
            amount: yearly ? plan.yearly : plan.price,
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            status: "active",
            started_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          setPaid(true);
        },
        onDismiss: () => setLoading(false),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed. Try again.");
      setLoading(false);
    }
  };

  if (paid) return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>
          You&apos;re subscribed!
        </h2>
        <p className="text-white/40 text-sm mb-2">Welcome to FreWork <span className="text-white/70 font-semibold">{plan.name}</span></p>
        <p className="text-white/25 text-xs mb-10">Payment confirmed · Your plan is now active</p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-[#0B1120] text-sm"
          style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );

  const displayPrice = yearly ? plan.yearly : plan.price;

  return (
    <div className="min-h-screen bg-[#060C18]">
      <Navbar />
      <div className="pt-28 pb-20 px-4 max-w-4xl mx-auto">

        <Link href="/pricing" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Pricing
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>
          Upgrade to {plan.name}
        </h1>
        <p className="text-white/35 text-sm mb-10">You&apos;ll get instant access to all {plan.name} features</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Plan summary */}
          <div className={`rounded-3xl border-2 bg-[#070D1A] p-7 ${plan.color}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border ${plan.iconCls} border-white/8`}>
              <Icon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{plan.name} Plan</h2>

            {/* Billing toggle */}
            <div className="flex items-center bg-white/4 border border-white/8 rounded-xl p-1 gap-1 mt-4 mb-5 w-fit">
              <button onClick={() => setYearly(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${!yearly ? "bg-white/10 text-white" : "text-white/35"}`}>
                Monthly
              </button>
              <button onClick={() => setYearly(true)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${yearly ? "bg-white/10 text-white" : "text-white/35"}`}>
                Yearly <span className="text-emerald-400">Save 35%</span>
              </button>
            </div>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-bold text-white">₹{displayPrice.toLocaleString("en-IN")}</span>
              <span className="text-white/30 text-sm">/{yearly ? "mo · billed yearly" : "month"}</span>
            </div>

            <div className="border-t border-white/6 mb-5" />

            <ul className="space-y-2.5">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/12 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-white/60">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment panel */}
          <div className="rounded-3xl border border-white/8 bg-[#070D1A] p-7 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-1">Payment summary</h3>
            <p className="text-xs text-white/30 mb-6">Secured by Razorpay · UPI · Cards · Net Banking</p>

            {/* Order summary */}
            <div className="rounded-2xl bg-white/3 border border-white/6 p-4 mb-6 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">{plan.name} Plan ({yearly ? "yearly" : "monthly"})</span>
                <span className="text-white font-semibold">₹{displayPrice.toLocaleString("en-IN")}</span>
              </div>
              {yearly && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Billed annually</span>
                  <span className="text-white/30">₹{(plan.yearly * 12).toLocaleString("en-IN")}/year</span>
                </div>
              )}
              <div className="border-t border-white/6 pt-2.5 flex justify-between">
                <span className="text-sm font-semibold text-white">Total due today</span>
                <span className="text-lg font-bold text-[#E8C97A]">₹{(yearly ? plan.yearly * 12 : displayPrice).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Account info */}
            {user && (
              <div className="rounded-2xl bg-white/3 border border-white/6 p-4 mb-6">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-2">Subscribing as</p>
                <p className="text-sm font-semibold text-white">{user.name || "—"}</p>
                <p className="text-xs text-white/40">{user.email}</p>
              </div>
            )}

            {error && (
              <div className="border border-red-500/30 bg-red-500/8 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
            )}

            <button onClick={handlePay} disabled={loading || !user}
              className="w-full py-4 rounded-2xl font-bold text-[#0B1120] text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:scale-[1.01] active:scale-[0.99] mt-auto"
              style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8973E)" }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Processing…" : `Pay ₹${(yearly ? plan.yearly * 12 : displayPrice).toLocaleString("en-IN")} with Razorpay`}
            </button>

            <div className="flex items-center justify-center gap-2 mt-4">
              <ShieldCheck className="w-3.5 h-3.5 text-white/20" />
              <p className="text-[10px] text-white/20">256-bit SSL · Cancel anytime · No hidden fees</p>
            </div>

            {/* Payment methods */}
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {["UPI", "Visa", "Mastercard", "RuPay", "Net Banking", "EMI"].map(m => (
                <span key={m} className="px-2.5 py-1 rounded-lg bg-white/4 border border-white/8 text-[10px] text-white/30 font-medium">{m}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-8">
          By subscribing you agree to our{" "}
          <Link href="/terms" className="text-[#C9A84C] hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-[#C9A84C] hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    }>
      <SubscribeInner />
    </Suspense>
  );
}
