"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { FREBOOK_PLAN, FREBOOK_PRICE_LABEL, isLegacyPlan, planLabel } from "@/lib/plans";

const PLANS = [{ ...FREBOOK_PLAN, badge: null as string | null, color: "#232A63", features: [...FREBOOK_PLAN.features], excluded: [] as string[] }];

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [currentSub, setCurrentSub] = useState<{ plan: string; status: string; ends_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState("");
  const [trialUsed, setTrialUsed] = useState(false);   // any past subscription row means the free month is gone
  const canClaim = !currentSub && !trialUsed;

  // One free month, once per account: the server refuses a second claim with 409.
  async function claimFreeMonth() {
    setPaying(FREBOOK_PLAN.id); setClaimMsg("");
    try {
      const r = await fetch("/api/finance/subscription/claim-trial", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 409) setTrialUsed(true); setClaimMsg(d.error ?? "Couldn't start your free month."); return; }
      setCurrentSub({ plan: FREBOOK_PLAN.id, status: "trial", ends_at: d.ends_at });
      setClaimMsg(`✓ Your free month has started — FreBook is yours until ${new Date(d.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`);
      setTimeout(() => router.push("/finance/start"), 1800);
    } catch {
      setClaimMsg("Couldn't start your free month. Please try again.");
    } finally { setPaying(null); }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser({ id: u.id, email: u.email ?? "", name: u.user_metadata?.full_name ?? u.email ?? "" });
      const { data } = await supabase
        .from("fw_fin_subscriptions")
        .select("plan,status,subscription_ends_at")
        .eq("user_id", u.id)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data) setCurrentSub({ plan: data.plan, status: data.status, ends_at: data.subscription_ends_at });
      const { count } = await supabase.from("fw_fin_subscriptions").select("user_id", { count: "exact", head: true }).eq("user_id", u.id);
      if ((count ?? 0) > 0) setTrialUsed(true);
      setLoading(false);
    });
    // Load Razorpay script
    if (!document.getElementById("rzp-script")) {
      const s = document.createElement("script");
      s.id = "rzp-script";
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.head.appendChild(s);
    }
  }, []);

  async function handleBuy(plan: typeof PLANS[0]) {
    if (!user) return;
    if (plan.id === FREBOOK_PLAN.id && canClaim) { await claimFreeMonth(); return; }
    setPaying(plan.id);
    try {
      // Create order on backend
      const res = await fetch("/api/finance/subscription/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id, amount: plan.price, user_id: user.id, email: user.email }),
      });
      const started = await res.json();
      if (!res.ok || !(started.order_id || started.subscription_id)) throw new Error(started.error ?? "Couldn't start the payment.");
      const auto = started.mode === "subscription";
      const total = (started.amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });

      const rzp = new window.Razorpay({
        key: started.key_id,
        name: "FreWork",
        description: `${plan.name} — ₹${plan.price.toLocaleString("en-IN")} + 18% GST = ₹${total}/month${auto ? " · renews automatically" : ""}`,
        ...(auto ? { subscription_id: started.subscription_id } : { order_id: started.order_id, amount: started.amount_paise, currency: "INR" }),
        prefill: { name: user.name, email: user.email },
        theme: { color: "#232A63" },
        handler: async (response: Record<string, string>) => {
          const v = await fetch("/api/finance/subscription/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
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

  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", color: "#141A3A", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(35,42,99,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/" style={{ color: "#232A63", fontWeight: 900, textDecoration: "none", fontSize: "0.95rem" }}>FreWork</Link>
        <span style={{ color: "rgba(20,26,58,0.55)" }}>›</span>
        <span style={{ color: "rgba(20,26,58,0.85)", fontSize: "0.85rem" }}>FreBook Plan</span>
        <div style={{ flex: 1 }} />
        {user && <span style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>{user.email}</span>}
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 2rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🛩️</div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 900, margin: "0 0 0.5rem", letterSpacing: "-0.03em" }}>
            Start with <span style={{ color: "#0B7A55" }}>one month free</span>
          </h1>
          <p style={{ color: "rgba(20,26,58,0.75)", fontSize: "1rem", margin: 0 }}>
            FreBook is {FREBOOK_PRICE_LABEL}/month + GST — your first month is on us. No card needed to claim it.
          </p>
        </div>

        {/* Current subscription banner */}
        {currentSub && (
          <div style={{ background: "rgba(11,122,85,0.08)", border: "1px solid rgba(11,122,85,0.25)", borderRadius: 10, padding: "0.85rem 1.5rem", marginBottom: "2rem", textAlign: "center", fontSize: "0.88rem", color: "#0B7A55" }}>
            You are on the <strong>{planLabel(currentSub.plan)}</strong> plan ({currentSub.status}).
            {currentSub.ends_at && ` Renews/expires: ${new Date(currentSub.ends_at).toLocaleDateString("en-IN")}.`}
            <Link href="/finance" style={{ color: "#232A63", marginLeft: "1rem", fontWeight: 700, textDecoration: "none" }}>Go to Dashboard →</Link>
          </div>
        )}

        {claimMsg && <div role="status" style={{ background: claimMsg.startsWith("✓") ? "rgba(11,122,85,0.1)" : "rgba(194,50,31,0.08)", color: claimMsg.startsWith("✓") ? "#0B7A55" : "#C2321F", borderRadius: 10, padding: "0.85rem 1.25rem", marginBottom: "1.5rem", textAlign: "center", fontWeight: 700 }}>{claimMsg}</div>}

        {/* Plans grid */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,440px)", justifyContent: "center", gap: "1.5rem", marginBottom: "3rem" }}>
          {PLANS.map(plan => {
            const isCurrent = currentSub?.plan === plan.id || isLegacyPlan(currentSub?.plan);
            const isPopular = !!plan.badge;
            return (
              <div key={plan.id} style={{
                background: isPopular ? "linear-gradient(160deg,#FFF4DB 0%,#FFF4DB 100%)" : "#FFFFFF",
                border: `1px solid ${isPopular ? "rgba(20,26,58,0.5)" : "rgba(20,26,58,0.11)"}`,
                borderRadius: 16, padding: "1.75rem", position: "relative", display: "flex", flexDirection: "column",
              }}>
                {plan.badge && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#232A63", color: "#F5F6FA", fontSize: "0.68rem", fontWeight: 800, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: plan.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{plan.name}</div>
                <div style={{ marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "rgba(20,26,58,0.75)" }}>₹</span>
                  <span style={{ fontSize: "2.6rem", fontWeight: 900, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{fmt(plan.price)}</span>
                  <span style={{ fontSize: "0.78rem", color: "rgba(20,26,58,0.65)" }}>/month</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(20,26,58,0.55)", marginBottom: "1.5rem" }}>{canClaim ? <b style={{ color: "#0B7A55" }}>₹0 for the first month · then {FREBOOK_PRICE_LABEL} + GST/month</b> : "+ GST · billed monthly · cancel anytime"}</div>

                <div style={{ flex: 1 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.55rem", alignItems: "flex-start" }}>
                      <span style={{ color: "#0B7A55", fontSize: "0.75rem", marginTop: "0.1rem", flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: "0.82rem", color: "rgba(20,26,58,1.00)" }}>{f}</span>
                    </div>
                  ))}
                  {plan.excluded.map(f => (
                    <div key={f} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.45rem", alignItems: "flex-start", opacity: 0.35 }}>
                      <span style={{ color: "#C2321F", fontSize: "0.75rem", marginTop: "0.1rem", flexShrink: 0 }}>✕</span>
                      <span style={{ fontSize: "0.78rem" }}>{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleBuy(plan)}
                  disabled={paying !== null || isCurrent}
                  style={{
                    marginTop: "1.5rem", width: "100%", padding: "12px", borderRadius: 10, cursor: "pointer",
                    fontWeight: 700, fontSize: "0.9rem",
                    background: isCurrent ? "rgba(11,122,85,0.15)" : "#232A63",
                    color: isCurrent ? "#0B7A55" : "#F5F6FA",
                    opacity: paying && paying !== plan.id ? 0.5 : 1,
                    border: isCurrent ? "1px solid rgba(11,122,85,0.3)" : "none",
                  }}
                >
                  {isCurrent ? "✓ Current Plan" : canClaim ? (paying === plan.id ? "Starting your free month…" : "🎁 Claim 1 month free") : paying === plan.id ? "Opening payment…" : `Subscribe · ₹${fmt(plan.price)}/mo`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust line */}
        <div style={{ textAlign: "center", fontSize: "0.78rem", color: "rgba(20,26,58,0.35)", lineHeight: 1.8 }}>
          Payments secured by Razorpay · Indian GST compliant · Cancel anytime · Data stored in India
        </div>
      </div>
    </div>
  );
}
