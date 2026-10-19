"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Rocket, Crown, Users, ArrowRight,
  ShieldCheck, Clock, BadgeCheck, Headphones,
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

  // Site palette (same as the homepage): soft grey ground, navy, ink, orange highlight, green for savings
  const NAVY = "#232A63", INK = "#141A3A", MUTED = "#5A6080", LINE = "#E1E4EE", ORANGE = "#F0662B", GREEN = "#0B7A55";

  return (
    <div className="min-h-screen" style={{ background: "#F4F5FA", color: INK, fontFamily: "var(--font-plus-jakarta),var(--font-inter),system-ui,sans-serif" }}>
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-32 pb-12 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(35,42,99,0.08), transparent 70%)" }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 text-[12px] font-bold rounded-full mb-6" style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, color: NAVY }}>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-wide" style={{ background: ORANGE, color: "#FFFFFF" }}>{TRIAL_DAYS} DAYS FREE</span>
            Simple pricing · no hidden fees
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.08] mb-5" style={{ color: INK, letterSpacing: "-0.03em", textWrap: "balance" }}>
            Bookkeeping that runs itself, <span style={{ color: NAVY }}>priced for Indian businesses</span>
          </h1>
          <p className="text-lg mb-8 leading-relaxed" style={{ color: MUTED }}>
            Every FreBook feature on every plan — choose by how many businesses you keep. From {FREBOOK_PRICE_LABEL}/month + GST, and yearly plans get 2 months free.
          </p>

          <div role="radiogroup" aria-label="Billing" className="inline-flex p-1 rounded-full mb-8" style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, boxShadow: "0 6px 20px -12px rgba(20,26,58,0.25)" }}>
            {(["monthly", "yearly"] as const).map(b => (
              <button key={b} role="radio" aria-checked={billing === b} onClick={() => setBilling(b)}
                className="px-5 py-2 rounded-full text-sm font-bold transition-all"
                style={billing === b ? { background: NAVY, color: "#FFFFFF" } : { color: MUTED }}>
                {b === "monthly" ? "Monthly" : <>Yearly <span className="ml-1.5 text-[10.5px] px-2 py-0.5 rounded-full font-extrabold" style={billing === b ? { background: ORANGE, color: "#FFFFFF" } : { background: "#E3F6EE", color: GREEN }}>2 months free</span></>}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium" style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, color: MUTED }}>
                <Icon className="w-3.5 h-3.5" style={{ color: NAVY }} /> {label}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Plan Cards ── */}
      <section className="px-4 pb-14">
        {claimMsg && (
          <div role="status" className="max-w-xl mx-auto mb-6 rounded-xl px-4 py-3 text-sm font-semibold text-center"
            style={claimMsg.startsWith("✓") ? { background: "#E3F6EE", color: GREEN } : { background: "#FDECEA", color: "#C2321F" }}>{claimMsg}</div>
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
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={`relative flex flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 ${isPopular ? "xl:-mt-3 xl:mb-3" : ""}`}
                style={{
                  background: isPopular ? NAVY : "#FFFFFF",
                  color: isPopular ? "#FFFFFF" : INK,
                  border: isPopular ? `1px solid ${NAVY}` : `1px solid ${LINE}`,
                  boxShadow: isPopular ? "0 30px 70px -30px rgba(35,42,99,0.6)" : "0 18px 50px -34px rgba(20,26,58,0.35)",
                }}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10.5px] font-extrabold tracking-[0.12em] uppercase whitespace-nowrap" style={{ background: ORANGE, color: "#FFFFFF" }}>{plan.badge}</div>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: isPopular ? "rgba(255,255,255,0.12)" : "#EEF0FA" }}>
                    <Icon className="w-5 h-5" style={{ color: isPopular ? "#FFFFFF" : NAVY }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold leading-none" style={{ letterSpacing: "-0.01em" }}>{plan.name}</h3>
                    <p className="text-[12px] mt-1" style={{ color: isPopular ? "rgba(255,255,255,0.65)" : MUTED }}>{plan.audience}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-5 min-h-[40px]" style={{ color: isPopular ? "rgba(255,255,255,0.8)" : MUTED }}>{look.line}</p>

                <div className="mb-1 flex items-end gap-1.5">
                  <span className="text-[42px] leading-none font-extrabold tabular-nums" style={{ letterSpacing: "-0.03em" }}>₹{shown.toLocaleString("en-IN")}</span>
                  <span className="pb-1.5 text-xs" style={{ color: isPopular ? "rgba(255,255,255,0.6)" : MUTED }}>/{billing === "yearly" ? "year" : "month"} + GST</span>
                </div>
                <p className="text-xs font-semibold mb-5 min-h-[16px]" style={{ color: billing === "yearly" ? (isPopular ? "#9FE3C4" : GREEN) : (isPopular ? "rgba(255,255,255,0.6)" : MUTED) }}>
                  {billing === "yearly" ? `₹${perMonth.toLocaleString("en-IN")}/month · you save ₹${saving.toLocaleString("en-IN")}` : `or ₹${plan.yearly.toLocaleString("en-IN")} a year — 2 months free`}
                </p>

                <div className="grid grid-cols-2 gap-2 mb-6">
                  {[[plan.businesses ?? "∞", plan.businesses === 1 ? "business" : "businesses"], [plan.pages.toLocaleString("en-IN"), "PDF pages / month"]].map(([v, l]) => (
                    <div key={String(l)} className="rounded-2xl px-3 py-2.5" style={{ background: isPopular ? "rgba(255,255,255,0.08)" : "#F4F5FA" }}>
                      <p className="text-lg font-extrabold leading-none tabular-nums">{v}</p>
                      <p className="text-[10px] uppercase tracking-wider mt-1 font-semibold" style={{ color: isPopular ? "rgba(255,255,255,0.6)" : MUTED }}>{l}</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => handlePlanClick(plan)} disabled={claiming}
                  className="mt-auto w-full py-3.5 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                  style={isPopular ? { background: ORANGE, color: "#FFFFFF", boxShadow: "0 8px 22px -10px rgba(240,102,43,0.7)" } : { background: NAVY, color: "#FFFFFF" }}>
                  {ctaLabel()}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
                {!trialUsed && <p className="text-center text-[11px] mt-2.5" style={{ color: isPopular ? "rgba(255,255,255,0.6)" : MUTED }}>No card needed · ₹0 for {TRIAL_DAYS} days</p>}
              </motion.div>
            );
          })}
        </div>
        <p className="text-center text-xs mt-6" style={{ color: MUTED }}>Excel and CSV bank statements are read free — they don&apos;t use your PDF pages. Prices are in ₹, plus 18% GST.</p>
      </section>

      {/* ── Every plan includes ── */}
      <section className="px-4 py-16" style={{ background: "#FFFFFF", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: ORANGE }}>Same features on every plan</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: INK, letterSpacing: "-0.02em" }}>Everything a small business needs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INCLUDED.map(({ icon: I, title, text }) => (
              <div key={title} className="rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={{ background: "#F7F8FC", border: `1px solid ${LINE}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#EEF0FA" }}>
                  <I className="w-4 h-4" style={{ color: NAVY }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: INK }}>{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compare ── */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-extrabold text-center mb-6" style={{ color: INK }}>Compare plans</h2>
          <div className="rounded-3xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: MUTED, background: "#F7F8FC", borderBottom: `1px solid ${LINE}` }}>
                    <th className="px-5 py-4 font-bold">Plan</th>
                    <th className="px-5 py-4 font-bold text-right">Businesses</th>
                    <th className="px-5 py-4 font-bold text-right">PDF pages / month</th>
                    <th className="px-5 py-4 font-bold text-right">Monthly</th>
                    <th className="px-5 py-4 font-bold text-right">Yearly</th>
                  </tr>
                </thead>
                <tbody>
                  {FREBOOK_PLANS_LIST.map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${LINE}`, background: p.badge ? "#EEF0FA" : undefined }}>
                      <td className="px-5 py-3.5 font-bold" style={{ color: INK }}>{p.name}{p.badge && <span className="ml-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: ORANGE, color: "#FFFFFF" }}>POPULAR</span>}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: MUTED }}>{p.businesses ?? "Any"}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: MUTED }}>{p.pages.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: INK }}>₹{p.price.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-bold" style={{ color: NAVY }}>₹{p.yearly.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Done for you ── */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto rounded-3xl p-8 md:p-10 grid md:grid-cols-[1fr_auto] gap-6 items-center" style={{ background: INK, color: "#FFFFFF" }}>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#FFB08A" }}>Rather not do it yourself?</p>
            <h3 className="text-3xl font-extrabold mb-2" style={{ letterSpacing: "-0.02em" }}>FreBook Managed</h3>
            <p className="text-sm max-w-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>Our accounting team keeps your books in FreBook every month — entries, bank reconciliation, GST working and statements — and you see everything live.</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-4xl font-extrabold tabular-nums">₹{MANAGED_PRICE.toLocaleString("en-IN")}<span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}> /month + GST</span></p>
            <Link href="/contact" className="inline-flex mt-3 items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: ORANGE, color: "#FFFFFF" }}>
              Talk to us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden grid grid-cols-2 md:grid-cols-4" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
          {[
            { val: FREBOOK_PRICE_LABEL, label: "From, per month + GST", sub: "Starter · Basic · Pro · CA Practice" },
            { val: "7 days", label: "Refund window", sub: "See Refund Policy" },
            { val: "< 4 hrs", label: "Avg. support response", sub: "For paid plans" },
            { val: "Zero", label: "Lock-in or exit fees", sub: "Cancel anytime" },
          ].map(({ val, label, sub }, i) => (
            <div key={label} className="py-7 px-6 text-center" style={{ borderLeft: i % 2 ? `1px solid ${LINE}` : undefined }}>
              <p className="text-3xl font-extrabold mb-1" style={{ color: NAVY }}>{val}</p>
              <p className="text-xs font-bold mb-0.5" style={{ color: INK }}>{label}</p>
              <p className="text-[11px]" style={{ color: MUTED }}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: ORANGE }}>Got questions?</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: INK, letterSpacing: "-0.02em" }}>Frequently asked</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className="text-sm font-bold pr-4" style={{ color: INK }}>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: NAVY }} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <p className="px-6 pb-5 pt-4 text-sm leading-relaxed" style={{ color: MUTED, borderTop: `1px solid ${LINE}` }}>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center rounded-3xl p-8" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
            <p className="text-sm mb-2" style={{ color: MUTED }}>Need something custom?</p>
            <p className="font-bold mb-5" style={{ color: INK }}>Our team will build a plan around your requirements.</p>
            <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5" style={{ background: NAVY, color: "#FFFFFF" }}>
              Talk to us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
