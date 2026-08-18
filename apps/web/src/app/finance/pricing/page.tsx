"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 2999,
    badge: null,
    color: "#8A9BB8",
    features: [
      "GST Invoicing & Purchase Bills",
      "Journal Entries (Double Entry)",
      "Account Ledger & Chart of Accounts",
      "Receivables & Payables",
      "Bank Reconciliation (CSV import)",
      "Basic Financial Reports",
      "1 Business",
    ],
    excluded: ["GST Returns (GSTR-1, 3B)", "TDS Tracker", "AI FrePilot (Claude)", "Team Access", "Tally Export"],
  },
  {
    id: "professional",
    name: "Professional",
    price: 3999,
    badge: "Most Popular",
    color: "#C9A84C",
    features: [
      "Everything in Starter",
      "GST Returns — GSTR-1 & GSTR-3B auto-prep",
      "TDS Tracker (section-wise)",
      "Tally XML Export",
      "Contacts with opening balances",
      "Financial Year management",
      "3 Businesses",
    ],
    excluded: ["AI FrePilot (Claude)", "Team Access & roles"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 4999,
    badge: "AI Powered",
    color: "#a78bfa",
    features: [
      "Everything in Professional",
      "AI FrePilot — ask anything about your books",
      "AI document analysis (invoices, bills)",
      "AI Insights & cash flow predictions",
      "Team Access with role-based permissions",
      "Unlimited Businesses",
      "Priority Support",
    ],
    excluded: [],
  },
];

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
    setPaying(plan.id);
    try {
      // Create order on backend
      const res = await fetch("/api/finance/subscription/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id, amount: plan.price, user_id: user.id, email: user.email }),
      });
      const { order_id, key_id } = await res.json();
      if (!order_id) throw new Error("Order creation failed");

      const rzp = new window.Razorpay({
        key: key_id,
        amount: plan.price * 100,
        currency: "INR",
        name: "FrePilot",
        description: `${plan.name} Plan — ₹${plan.price.toLocaleString("en-IN")}/month`,
        order_id,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#C9A84C" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await fetch("/api/finance/subscription/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, plan: plan.id, user_id: user.id, amount: plan.price }),
          });
          router.push("/finance?subscribed=1");
        },
      });
      rzp.open();
    } catch (e) {
      alert("Payment failed. Please try again.");
    } finally {
      setPaying(null);
    }
  }

  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "1rem", height: 56 }}>
        <Link href="/" style={{ color: "#C9A84C", fontWeight: 900, textDecoration: "none", fontSize: "0.95rem" }}>FreWork</Link>
        <span style={{ color: "rgba(237,232,220,0.3)" }}>›</span>
        <span style={{ color: "rgba(237,232,220,0.6)", fontSize: "0.85rem" }}>FrePilot Pricing</span>
        <div style={{ flex: 1 }} />
        {user && <span style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>{user.email}</span>}
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 2rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🛩️</div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 900, margin: "0 0 0.5rem", letterSpacing: "-0.03em" }}>
            Choose your <span style={{ color: "#C9A84C" }}>FrePilot</span> plan
          </h1>
          <p style={{ color: "rgba(237,232,220,0.5)", fontSize: "1rem", margin: 0 }}>
            Full-stack accounting for Indian SMBs. GST, TDS, Journals, AI — all in one.
          </p>
        </div>

        {/* Current subscription banner */}
        {currentSub && (
          <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, padding: "0.85rem 1.5rem", marginBottom: "2rem", textAlign: "center", fontSize: "0.88rem", color: "#4ade80" }}>
            You are on the <strong>{currentSub.plan}</strong> plan ({currentSub.status}).
            {currentSub.ends_at && ` Renews/expires: ${new Date(currentSub.ends_at).toLocaleDateString("en-IN")}.`}
            <Link href="/finance" style={{ color: "#C9A84C", marginLeft: "1rem", fontWeight: 700, textDecoration: "none" }}>Go to Dashboard →</Link>
          </div>
        )}

        {/* Plans grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.5rem", marginBottom: "3rem" }}>
          {PLANS.map(plan => {
            const isCurrent = currentSub?.plan === plan.id;
            const isPopular = !!plan.badge;
            return (
              <div key={plan.id} style={{
                background: isPopular ? "linear-gradient(160deg,#1a1400 0%,#0f0c00 100%)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isPopular ? "rgba(201,168,76,0.5)" : "rgba(237,232,220,0.08)"}`,
                borderRadius: 16, padding: "1.75rem", position: "relative", display: "flex", flexDirection: "column",
              }}>
                {plan.badge && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#C9A84C", color: "#070C1A", fontSize: "0.68rem", fontWeight: 800, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: plan.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{plan.name}</div>
                <div style={{ marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "rgba(237,232,220,0.5)" }}>₹</span>
                  <span style={{ fontSize: "2.6rem", fontWeight: 900, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{fmt(plan.price)}</span>
                  <span style={{ fontSize: "0.78rem", color: "rgba(237,232,220,0.4)" }}>/month</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(237,232,220,0.3)", marginBottom: "1.5rem" }}>+ GST · billed monthly · cancel anytime</div>

                <div style={{ flex: 1 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.55rem", alignItems: "flex-start" }}>
                      <span style={{ color: "#4ade80", fontSize: "0.75rem", marginTop: "0.1rem", flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: "0.82rem", color: "rgba(237,232,220,0.8)" }}>{f}</span>
                    </div>
                  ))}
                  {plan.excluded.map(f => (
                    <div key={f} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.45rem", alignItems: "flex-start", opacity: 0.35 }}>
                      <span style={{ color: "#f87171", fontSize: "0.75rem", marginTop: "0.1rem", flexShrink: 0 }}>✕</span>
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
                    background: isCurrent ? "rgba(74,222,128,0.15)" : isPopular ? "#C9A84C" : `rgba(${plan.id === "enterprise" ? "167,139,250" : "201,168,76"},0.15)`,
                    color: isCurrent ? "#4ade80" : isPopular ? "#070C1A" : plan.color,
                    opacity: paying && paying !== plan.id ? 0.5 : 1,
                    border: isCurrent ? "1px solid rgba(74,222,128,0.3)" : isPopular ? "none" : `1px solid ${plan.color}40`,
                  }}
                >
                  {isCurrent ? "✓ Current Plan" : paying === plan.id ? "Opening payment…" : `Subscribe · ₹${fmt(plan.price)}/mo`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust line */}
        <div style={{ textAlign: "center", fontSize: "0.78rem", color: "rgba(237,232,220,0.25)", lineHeight: 1.8 }}>
          Payments secured by Razorpay · Indian GST compliant · Cancel anytime · Data stored in India
        </div>
      </div>
    </div>
  );
}
