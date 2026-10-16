"use client";
// Choose a FreBook plan: one free week, then Basic ₹699 (2 businesses) · Pro ₹999 (5) · Unlimited ₹1,499. Referral link below.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { FREBOOK_PLANS_LIST, isLegacyPlan, planLabel, planById, REFERRAL_DISCOUNT_PCT, SUBSCRIPTION_GST_RATE, type FreBookPlan } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/claimTrial";

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

type Referral = { code: string; link: string; pct: number; joined: number; paid: number; credits: number; next_payment_discount: number; next_payment_reason: "referred" | "referrer" | null; setup_needed?: string };
const C = { bg: "#F5F6FA", ink: "#141A3A", muted: "#5A6080", line: "#E1E4EE", navy: "#232A63", gold: "#C9A24A", pos: "#0B7A55", posSoft: "#E3F6EE" };
const fmt = (n: number) => n.toLocaleString("en-IN");

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [currentSub, setCurrentSub] = useState<{ plan: string; status: string; ends_at: string } | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState("");
  const [trialUsed, setTrialUsed] = useState(false);   // any past subscription row means the free week is gone
  const [ref, setRef] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  const canClaim = !currentSub && !trialUsed;
  const disc = ref?.next_payment_discount ?? 0;

  // One free week, once per account: the server refuses a second claim with 409.
  async function claimTrial() {
    setPaying("trial"); setClaimMsg("");
    try {
      const r = await fetch("/api/finance/subscription/claim-trial", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 409) setTrialUsed(true); setClaimMsg(d.error ?? "Couldn't start your free week."); return; }
      setCurrentSub({ plan: "frebook", status: "trial", ends_at: d.ends_at });
      setClaimMsg(`✓ Your free week has started — every feature, any number of businesses, until ${new Date(d.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`);
      setTimeout(() => router.push("/finance/start"), 1800);
    } catch {
      setClaimMsg("Couldn't start your free week. Please try again.");
    } finally { setPaying(null); }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "", name: u.user_metadata?.full_name ?? u.email ?? "" });
      const { data } = await supabase.from("fw_fin_subscriptions").select("plan,status,subscription_ends_at").eq("user_id", u.id)
        .in("status", ["active", "trial"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data && (!data.subscription_ends_at || data.subscription_ends_at > new Date().toISOString())) setCurrentSub({ plan: data.plan, status: data.status, ends_at: data.subscription_ends_at });
      const { count } = await supabase.from("fw_fin_subscriptions").select("user_id", { count: "exact", head: true }).eq("user_id", u.id);
      if ((count ?? 0) > 0) setTrialUsed(true);
      fetch("/api/finance/referral").then(r => r.ok ? r.json() : null).then(j => j && setRef(j)).catch(() => null);
    });
    if (!document.getElementById("rzp-script")) {
      const s = document.createElement("script");
      s.id = "rzp-script"; s.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.head.appendChild(s);
    }
  }, [router]);

  async function handleBuy(plan: FreBookPlan) {
    if (!user) return;
    setPaying(plan.id);
    try {
      const res = await fetch("/api/finance/subscription/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: plan.id }) });
      const started = await res.json();
      if (!res.ok || !(started.order_id || started.subscription_id)) throw new Error(started.error ?? "Couldn't start the payment.");
      const auto = started.mode === "subscription";
      const total = (started.amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      const off = started.discount_pct ? ` · ${started.discount_pct}% referral discount` : "";
      const rzp = new window.Razorpay({
        key: started.key_id, name: "FreWork",
        description: `FreBook ${plan.name} — ₹${total} incl. GST${off}${auto ? " · renews automatically" : " · one month"}`,
        ...(auto ? { subscription_id: started.subscription_id } : { order_id: started.order_id, amount: started.amount_paise, currency: "INR" }),
        prefill: { name: user.name, email: user.email }, theme: { color: C.navy },
        handler: async (response: Record<string, string>) => {
          const v = await fetch("/api/finance/subscription/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response) });
          if (!v.ok) {
            const d = await v.json().catch(() => ({}));
            alert(`${d.error ?? "We couldn't confirm the payment."} If money was deducted, it will be refunded or activated within a day — contact support with payment id ${response.razorpay_payment_id}.`);
            return;
          }
          router.push("/finance?subscribed=1");
        },
      });
      rzp.open();
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : "Payment failed. Please try again.");
    } finally {
      setPaying(null);
    }
  }

  const currentId = currentSub ? (planById(currentSub.plan)?.id ?? (isLegacyPlan(currentSub.plan) ? "frebook" : null)) : null;
  const paidCurrent = currentSub && currentSub.status === "active" ? currentId : null;
  const share = ref ? `Try FreBook — AI bookkeeping on chat & WhatsApp. Use my link for ${ref.pct}% off your first month: ${ref.link}` : "";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <style>{`
        .pr-grid { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0,1fr)); align-items: stretch; }
        @media (max-width: 900px) { .pr-grid { grid-template-columns: minmax(0,1fr); max-width: 440px; margin: 0 auto; } }
        .pr-card { transition: transform .15s, box-shadow .15s; }
        .pr-card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -24px rgba(35,42,99,.45); }
        @media (prefers-reduced-motion: reduce) { .pr-card { transition: none } }
      `}</style>
      <nav style={{ borderBottom: `1px solid ${C.line}`, padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "1rem", height: 56, background: "#FFFFFF" }}>
        <Link href="/finance" style={{ color: C.navy, fontWeight: 900, textDecoration: "none" }}>FreWork</Link>
        <span style={{ color: C.muted }}>›</span>
        <span style={{ fontSize: "0.88rem" }}>FreBook plans</span>
        <div style={{ flex: 1 }} />
        {user && <span style={{ fontSize: "0.78rem", color: C.muted }}>{user.email}</span>}
      </nav>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "2.5rem 1.25rem 4rem", display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(1.7rem,3.4vw,2.4rem)", fontWeight: 900, margin: "0 0 0.4rem", letterSpacing: "-0.03em" }}>
            Every feature on every plan. <span style={{ color: C.pos }}>Pick by number of businesses.</span>
          </h1>
          <p style={{ color: C.muted, margin: 0 }}>Prices + {SUBSCRIPTION_GST_RATE}% GST, billed monthly, cancel anytime.</p>
        </header>

        {currentSub && (
          <div style={{ background: C.posSoft, color: C.pos, borderRadius: 12, padding: "0.8rem 1.2rem", textAlign: "center", fontSize: "0.9rem" }}>
            You&apos;re on <b>{currentSub.status === "trial" ? "the free week" : planLabel(currentSub.plan)}</b>{currentSub.ends_at ? ` until ${new Date(currentSub.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.
            <Link href="/finance" style={{ color: C.navy, marginLeft: 12, fontWeight: 800, textDecoration: "none" }}>Go to FreBook →</Link>
          </div>
        )}

        {/* Free week */}
        {canClaim && (
          <section style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "18px 20px", borderRadius: 18, background: "linear-gradient(120deg,#0F2B25,#1B4237)", color: "#FFFFFF" }}>
            <span aria-hidden="true" style={{ fontSize: 30 }}>🎁</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Try everything free for {TRIAL_DAYS} days</div>
              <div style={{ color: "#C9D3CE", fontSize: 14 }}>All features and any number of businesses. No card needed. Choose a plan when the week ends.</div>
            </div>
            <button onClick={claimTrial} disabled={paying !== null} style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: C.gold, color: "#1B2A22", fontWeight: 900, cursor: "pointer" }}>
              {paying === "trial" ? "Starting…" : `Start free ${TRIAL_DAYS}-day trial`}
            </button>
          </section>
        )}

        {claimMsg && <div role="status" style={{ background: claimMsg.startsWith("✓") ? C.posSoft : "rgba(194,50,31,0.08)", color: claimMsg.startsWith("✓") ? C.pos : "#C2321F", borderRadius: 10, padding: "0.8rem 1.2rem", textAlign: "center", fontWeight: 700 }}>{claimMsg}</div>}

        {disc > 0 && (
          <div style={{ background: "#FFF4DB", color: "#8A5A00", border: "1px solid #F2D29B", borderRadius: 12, padding: "0.8rem 1.2rem", textAlign: "center", fontWeight: 700 }}>
            🎉 {disc}% off your next payment — {ref?.next_payment_reason === "referred" ? "you joined with a referral link" : "a friend you referred has subscribed"}. Applied automatically at checkout.
          </div>
        )}

        {/* Plans */}
        <div className="pr-grid">
          {FREBOOK_PLANS_LIST.map(plan => {
            const isCurrent = paidCurrent === plan.id;
            const popular = !!plan.badge;
            const now = disc ? Math.round(plan.price * (1 - disc / 100)) : null;
            return (
              <div key={plan.id} className="pr-card" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, padding: 22, borderRadius: 20,
                background: popular ? "linear-gradient(170deg,#FFFFFF 0%,#F3F5FF 100%)" : "#FFFFFF", border: `${popular ? 2 : 1}px solid ${popular ? C.navy : C.line}` }}>
                {plan.badge && <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: C.navy, color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>{plan.badge}</span>}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: C.navy }}>{plan.name}</div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6 }}>
                    {now !== null && <span style={{ fontSize: 18, color: C.muted, textDecoration: "line-through" }}>₹{fmt(plan.price)}</span>}
                    <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>₹{fmt(now ?? plan.price)}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>/month + GST</span>
                  </div>
                  {now !== null && <div style={{ fontSize: 12, fontWeight: 700, color: "#8A5A00" }}>first month with referral · then ₹{fmt(plan.price)}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: C.bg }}>
                  <span aria-hidden="true" style={{ fontSize: 20 }}>🏢</span>
                  <span style={{ fontWeight: 900, fontSize: 15 }}>{plan.businesses === null ? "Unlimited businesses" : `Up to ${plan.businesses} businesses`}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>one login</span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                  {plan.features.map(f => <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5 }}><span style={{ color: C.pos, fontWeight: 900 }}>✓</span>{f}</li>)}
                </ul>
                <button onClick={() => handleBuy(plan)} disabled={paying !== null || isCurrent}
                  style={{ height: 46, borderRadius: 12, border: isCurrent ? `1px solid ${C.pos}` : "none", fontWeight: 800, fontSize: 15, cursor: isCurrent ? "default" : "pointer",
                    background: isCurrent ? C.posSoft : popular ? C.navy : "#141A3A", color: isCurrent ? C.pos : "#FFFFFF", opacity: paying && paying !== plan.id ? 0.5 : 1 }}>
                  {isCurrent ? "✓ Your plan" : paying === plan.id ? "Opening payment…" : paidCurrent ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Referral */}
        <section style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 20, padding: 20, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>Refer & save</div>
            <h2 style={{ margin: "4px 0 6px", fontSize: 20 }}>{REFERRAL_DISCOUNT_PCT}% off for your friend — and {REFERRAL_DISCOUNT_PCT}% off for you</h2>
            <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.55 }}>A new account made with your link gets the free week, then half price on its first month. When they pay, your next payment is half price too.</p>
          </div>
          {ref?.setup_needed ? <div style={{ color: "#8A5A00", fontSize: 13 }}>Referrals are being set up — check back soon.</div> : ref ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={ref.link} aria-label="Your referral link" onFocus={e => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 10, border: `1px solid ${C.line}`, padding: "0 12px", fontSize: 13.5, color: C.ink, background: C.bg }} />
                <button onClick={() => { navigator.clipboard?.writeText(ref.link); setCopied(true); setTimeout(() => setCopied(false), 1800); }} style={{ height: 42, padding: "0 14px", borderRadius: 10, border: "none", background: C.navy, color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>{copied ? "Copied ✓" : "Copy"}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" style={{ height: 42, padding: "0 14px", borderRadius: 10, background: "#25D366", color: "#08311E", fontWeight: 800, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Share</a>
              </div>
              <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.muted }}>
                <span><b style={{ color: C.ink }}>{ref.joined}</b> joined</span>
                <span><b style={{ color: C.ink }}>{ref.paid}</b> subscribed</span>
                <span><b style={{ color: C.pos }}>{ref.credits}</b> half-price month{ref.credits === 1 ? "" : "s"} waiting</span>
              </div>
            </div>
          ) : <div style={{ color: C.muted, fontSize: 13 }}>Loading your link…</div>}
        </section>

        <div style={{ textAlign: "center", fontSize: "0.78rem", color: C.muted, lineHeight: 1.8 }}>
          Payments secured by Razorpay · GST invoice for every payment · Cancel anytime · Data stored in India
        </div>
      </div>
    </div>
  );
}
