"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Rocket, Crown, Users, ArrowRight,
  Sparkles, ShieldCheck, Clock, BadgeCheck, Headphones,
  BookOpen, ChevronDown,
  MessageCircle, Landmark, Receipt, Calculator, RefreshCw, BarChart3, FileSpreadsheet, Store,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FREBOOK_PLANS_LIST, FREBOOK_PRICE_LABEL, REFERRAL_DISCOUNT_PCT, type Billing, type FreBookPlan } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/claimTrial";

// One icon and line per plan; the features are the same on every plan, so they're shown once below the cards
const PLAN_LOOK: Record<string, { icon: React.ElementType; line: string }> = {
  fb_starter: { icon: Store, line: "Run one shop or practice from your phone." },
  fb_basic: { icon: Building2, line: "Books, GST and Tally for a small business." },
  fb_pro: { icon: Rocket, line: "Room to grow — or keep a few clients' books." },
  fb_ca: { icon: Crown, line: "For accountants keeping many clients' books." },
};
const INCLUDED = [
  { icon: MessageCircle, title: "Bookkeeping by chat & WhatsApp", text: "Type or send a bill — the AI drafts the entry, you confirm." },
  { icon: Receipt, title: "GST invoices & bills", text: "Sales invoices, purchase bills, e-invoice and e-way bill files." },
  { icon: Landmark, title: "Bank import & reconciliation", text: "Excel, CSV or PDF statements with ledger suggestions." },
  { icon: Calculator, title: "GSTR-1, GSTR-3B & TDS", text: "Returns prepared from your books, TDS tracked." },
  { icon: RefreshCw, title: "Tally push & import", text: "Keep Tally in step, automatically." },
  { icon: BarChart3, title: "Schedule III statements", text: "P&L, Balance Sheet, notes, TB and cash flow." },
  { icon: FileSpreadsheet, title: "Excel exports", text: "Every statement and ledger, formatted." },
  { icon: Users, title: "Receivables & reminders", text: "Who owes you, with WhatsApp reminders." },
];
const MANAGED_PRICE = 3999;   // FreBook Managed — done-for-you service, priced separately


const FAQS = [
  { q: "What's the difference between the plans?", a: "How many businesses one login can keep (Starter 1, Basic 2, Pro 5, CA Practice 15) and how many PDF bank-statement pages the AI reads each month (100, 500, 2,000 and 6,000; Excel/CSV statements are free). Every plan has every FreBook feature — chat bookkeeping, invoicing, ledgers, bank import, GST returns preparation, TDS tracker, Tally push and import, and reports." },
  { q: "Is there a free trial?", a: `Yes — ${TRIAL_DAYS} days with every feature and any number of businesses. No card needed.` },
  { q: "Is there a referral discount?", a: `Yes. Share your link from the Plans page: your friend gets ${REFERRAL_DISCOUNT_PCT}% off their first month, and when they pay, your next month is ${REFERRAL_DISCOUNT_PCT}% off too.` },
  { q: "Are professional services included?", a: "No. GST registration, ITR filing, ROC filings and audits are ordered separately, at the price shown on each service. Audits are performed by an independent Chartered Accountant." },
  { q: "Is GST extra?", a: "Yes. Plan prices are plus 18% GST. Pay monthly, or yearly and get 2 months free." },
  { q: "Can I cancel?", a: "Yes, anytime. Access continues until the end of the period you paid for. See the Refund Policy for the 7-day refund rule." },
  { q: "What payment methods do you accept?", a: "UPI, cards and net banking." },
];

const TRUST = [
  { icon: ShieldCheck, label: "Encrypted connections (HTTPS)" },
  { icon: BadgeCheck, label: "Verified professional experts" },
  { icon: Clock, label: "Cancel anytime" },
  { icon: Headphones, label: "Support on WhatsApp and email" },
];

export default function PricingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);   // any subscription row (paid, trial or expired) means the free trial is gone
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");
  const [billing, setBilling] = useState<Billing>("yearly");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setLoggedIn(!!session);
      if (!session) return;
      const { count } = await supabase.from("fw_fin_subscriptions").select("user_id", { count: "exact", head: true }).eq("user_id", session.user.id);
      if ((count ?? 0) > 0) setTrialUsed(true);
    });
  }, []);

  // One free trial, once per account. The server refuses a second claim with 409.
  async function claimFreeMonth() {
    setClaiming(true); setClaimMsg("");
    try {
      const r = await fetch("/api/finance/subscription/claim-trial", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setClaimMsg(d.error ?? "Couldn't start your free trial. Please try again.");
        if (r.status === 409) { setTrialUsed(true); setTimeout(() => router.push("/finance/pricing"), 1800); }
        return;
      }
      setClaimMsg(`✓ Your free trial has started — FreBook is yours until ${new Date(d.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`);
      setTimeout(() => router.push("/finance/start"), 1800);
    } catch {
      setClaimMsg("Couldn't start your free trial. Please try again.");
    } finally { setClaiming(false); }
  }

  const handlePlanClick = (plan: FreBookPlan) => {
    const key = plan.id;
    if (!loggedIn) router.push(`/register?plan=${key}`);
    else if (trialUsed) router.push(`/finance/pricing`);
    else claimFreeMonth();
  };

  const ctaLabel = () => {
    if (loggedIn && trialUsed) return "Subscribe Now";
    return claiming ? "Starting your free trial…" : `🎁 Start ${TRIAL_DAYS} days free`;
  };

  return (
    <div className="min-h-screen bg-[#060C18]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-32 pb-16 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-semibold tracking-widest uppercase mb-6">
            <Sparkles className="w-3 h-3" /> Transparent Pricing · No Hidden Fees
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold text-white leading-[1.05] mb-5"
            style={{ fontFamily: "var(--font-cormorant), serif" }}>
            CA Compliance +<br />
            <span style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              FreBook Accounting
            </span>
          </h1>
          <p className="text-white/45 text-lg mb-10 leading-relaxed">
            Start with {TRIAL_DAYS} days free. Then FreBook from {FREBOOK_PRICE_LABEL}/month + GST — Starter, Basic, Pro or CA Practice by number of businesses. Yearly plans get 2 months free.<br className="hidden sm:block" /> Professional services are ordered separately when you need them.
          </p>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/8 text-white/50 text-xs">
                <Icon className="w-3.5 h-3.5 text-[#C9A84C]/70" /> {label}
              </div>
            ))}
          </div>
          <div role="radiogroup" aria-label="Billing" className="inline-flex p-1 rounded-full border border-[#C9A84C]/25 bg-white/[0.03]">
            {(["monthly", "yearly"] as const).map(b => (
              <button key={b} role="radio" aria-checked={billing === b} onClick={() => setBilling(b)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${billing === b ? "text-[#0B1120]" : "text-white/55 hover:text-white"}`}
                style={billing === b ? { background: "linear-gradient(135deg,#F0D78A,#C9A84C)" } : undefined}>
                {b === "monthly" ? "Monthly" : <>Yearly <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full ${billing === b ? "bg-[#0B1120]/15" : "bg-emerald-500/15 text-emerald-300"}`}>2 months free</span></>}
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Plan Cards ── */}
      <section className="px-4 pb-16">
        {claimMsg && (
          <div role="status" className={`max-w-xl mx-auto mb-6 rounded-xl px-4 py-3 text-sm font-semibold text-center ${claimMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{claimMsg}</div>
        )}
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          {FREBOOK_PLANS_LIST.map((plan, i) => {
            const look = PLAN_LOOK[plan.id] ?? { icon: BookOpen, line: plan.audience };
            const Icon = look.icon;
            const isPopular = !!plan.badge;
            const shown = billing === "yearly" ? plan.yearly : plan.price;
            const perMonth = Math.round(plan.yearly / 12);
            const saving = plan.price * 12 - plan.yearly;
            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={`relative flex flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 ${isPopular ? "xl:-mt-3 xl:mb-3" : ""}`}
                style={{
                  background: isPopular ? "linear-gradient(165deg,#221A06 0%,#120F05 45%,#0A0B10 100%)" : "linear-gradient(165deg,#0C1426 0%,#070D1A 100%)",
                  border: isPopular ? "1.5px solid rgba(232,201,122,0.65)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isPopular ? "0 0 0 1px rgba(201,168,76,0.15), 0 30px 80px -30px rgba(201,168,76,0.45)" : "0 20px 60px -35px rgba(0,0,0,0.8)",
                }}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase text-[#0B1120] whitespace-nowrap"
                    style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)" }}>{plan.badge}</div>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${isPopular ? "bg-[#C9A84C]/15 border-[#C9A84C]/35" : "bg-white/[0.04] border-white/10"}`}>
                    <Icon className={`w-5 h-5 ${isPopular ? "text-[#E8C97A]" : "text-[#C9A84C]"}`} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white leading-none" style={{ fontFamily: "var(--font-cormorant), serif" }}>{plan.name}</h3>
                    <p className="text-[11px] text-white/40 mt-1">{plan.audience}</p>
                  </div>
                </div>
                <p className="text-sm text-white/55 leading-relaxed mb-5 min-h-[40px]">{look.line}</p>

                <div className="mb-1 flex items-end gap-1.5">
                  <span className="text-[44px] leading-none font-black text-white tabular-nums" style={{ fontFamily: "var(--font-plus-jakarta), sans-serif", letterSpacing: "-0.03em" }}>
                    ₹{shown.toLocaleString("en-IN")}
                  </span>
                  <span className="pb-1.5 text-xs text-white/35">/{billing === "yearly" ? "year" : "month"} + GST</span>
                </div>
                <p className={`text-xs font-semibold mb-5 min-h-[16px] ${billing === "yearly" ? "text-emerald-300/90" : "text-white/35"}`}>
                  {billing === "yearly" ? `₹${perMonth.toLocaleString("en-IN")}/month · you save ₹${saving.toLocaleString("en-IN")}` : `or ₹${plan.yearly.toLocaleString("en-IN")} a year — 2 months free`}
                </p>

                <div className="grid grid-cols-2 gap-2 mb-6">
                  <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                    <p className="text-lg font-black text-white leading-none tabular-nums">{plan.businesses ?? "∞"}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{plan.businesses === 1 ? "business" : "businesses"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                    <p className="text-lg font-black text-white leading-none tabular-nums">{plan.pages.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">PDF pages / month</p>
                  </div>
                </div>

                <button onClick={() => handlePlanClick(plan)} disabled={claiming}
                  className={`mt-auto w-full py-3.5 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer transition-all active:scale-[0.98] ${isPopular ? "text-[#0B1120]" : "text-white border border-white/15 hover:border-[#C9A84C]/60 hover:bg-white/[0.03]"}`}
                  style={isPopular ? { background: "linear-gradient(135deg,#F0D78A,#C9A84C,#A8883A)" } : undefined}>
                  {ctaLabel()}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
                {!trialUsed && <p className="text-center text-[11px] text-white/35 mt-2.5">No card needed · ₹0 for {TRIAL_DAYS} days</p>}
              </motion.div>
            );
          })}
        </div>
        <p className="text-center text-xs text-white/35 mt-6">Excel and CSV bank statements are read free — they don&apos;t use your PDF pages. Prices are in ₹, plus 18% GST.</p>
      </section>

      {/* ── Every plan includes ── */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]/70 mb-3">Same features on every plan</p>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>Everything a small business needs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INCLUDED.map(({ icon: I, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 hover:border-[#C9A84C]/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center mb-3">
                  <I className="w-4 h-4 text-[#E8C97A]" />
                </div>
                <p className="text-sm font-semibold text-white/90 mb-1">{title}</p>
                <p className="text-xs text-white/45 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compare ── */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto rounded-3xl border border-white/[0.08] bg-[#070D1A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-white/[0.08]">
                  <th className="px-5 py-4 font-semibold">Plan</th>
                  <th className="px-5 py-4 font-semibold text-right">Businesses</th>
                  <th className="px-5 py-4 font-semibold text-right">PDF pages / month</th>
                  <th className="px-5 py-4 font-semibold text-right">Monthly</th>
                  <th className="px-5 py-4 font-semibold text-right">Yearly</th>
                </tr>
              </thead>
              <tbody>
                {FREBOOK_PLANS_LIST.map(p => (
                  <tr key={p.id} className={`border-b border-white/[0.05] last:border-0 ${p.badge ? "bg-[#C9A84C]/[0.06]" : ""}`}>
                    <td className="px-5 py-3.5 font-semibold text-white">{p.name}{p.badge && <span className="ml-2 text-[10px] text-[#E8C97A]">★</span>}</td>
                    <td className="px-5 py-3.5 text-right text-white/70 tabular-nums">{p.businesses ?? "Any"}</td>
                    <td className="px-5 py-3.5 text-right text-white/70 tabular-nums">{p.pages.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-right text-white/70 tabular-nums">₹{p.price.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-right text-[#E8C97A] font-semibold tabular-nums">₹{p.yearly.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Done for you ── */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto rounded-3xl p-8 md:p-10 grid md:grid-cols-[1fr_auto] gap-6 items-center border border-[#C9A84C]/25"
          style={{ background: "radial-gradient(ellipse 80% 120% at 0% 0%, rgba(201,168,76,0.14), transparent 60%), #0A0F1C" }}>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] mb-2">Rather not do it yourself?</p>
            <h3 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>FreBook Managed</h3>
            <p className="text-sm text-white/55 max-w-xl leading-relaxed">Our accounting team keeps your books in FreBook every month — entries, bank reconciliation, GST working and statements — and you see everything live.</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-4xl font-black text-white tabular-nums">₹{MANAGED_PRICE.toLocaleString("en-IN")}<span className="text-sm font-medium text-white/40"> /month + GST</span></p>
            <Link href="/contact" className="inline-flex mt-3 items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0B1120]" style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)" }}>
              Talk to us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="px-4 pb-20">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl border border-white/6 overflow-hidden"
          style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.06),rgba(201,168,76,0.02))" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/6">
            {[
              { val: FREBOOK_PRICE_LABEL, label: "From, per month + GST", sub: "Starter · Basic · Pro · CA Practice" },
              { val: "7 days", label: "Refund window", sub: "See Refund Policy" },
              { val: "< 4 hrs", label: "Avg. support response", sub: "For paid plans" },
              { val: "Zero", label: "Lock-in or exit fees", sub: "Cancel anytime" },
            ].map(({ val, label, sub }) => (
              <div key={label} className="py-7 px-6 text-center">
                <p className="text-3xl font-black mb-1"
                  style={{ fontFamily: "var(--font-cormorant), serif", background: "linear-gradient(135deg,#F0D78A,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {val}
                </p>
                <p className="text-xs font-semibold text-white/60 mb-0.5">{label}</p>
                <p className="text-[10px] text-white/25">{sub}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]/60 mb-3">Got questions?</p>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "var(--font-cormorant), serif" }}>
              Frequently asked
            </h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="rounded-2xl border border-white/8 overflow-hidden bg-[#070D1A]">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className="text-sm font-semibold text-white/80 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#C9A84C] flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <p className="px-6 pb-5 text-sm text-white/40 leading-relaxed border-t border-white/6 pt-4">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center rounded-3xl border border-white/6 bg-white/[0.02] p-8">
            <p className="text-white/50 text-sm mb-2">Need something custom?</p>
            <p className="text-white font-semibold mb-5">Our team will build a plan around your requirements.</p>
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[#0B1120] transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#F0D78A,#C9A84C)" }}>
              Talk to us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
