"use client";
import Link from "next/link";

const FEATURES = [
  { icon: "🧾", title: "GST-Ready Invoicing", desc: "Raise invoices with auto CGST/SGST/IGST detection. GSTIN, HSN, place of supply — all handled." },
  { icon: "📒", title: "Double-Entry Accounting", desc: "Real books. Dr = Cr enforced. Journal entries, ledger, trial balance — CA-grade accuracy." },
  { icon: "🏛️", title: "GST Return Prep", desc: "GSTR-1 and GSTR-3B data auto-prepared from your posted entries. Export and file in minutes." },
  { icon: "🔖", title: "TDS Tracker", desc: "Section-wise TDS tracking — 194C, 194J, 194I and more. Due dates, calculator, challan reminders." },
  { icon: "📈", title: "Financial Reports", desc: "P&L, Balance Sheet, Cash Flow (indirect method) — Schedule III compliant. Instant, always up to date." },
  { icon: "🤖", title: "AI Document Engine", desc: "Upload any invoice, bill, or bank statement. AI extracts data and creates draft journal entries automatically." },
  { icon: "🛩️", title: "FrePilot AI Chat", desc: "Ask anything — GST rate on a service, TDS section for a payment, how to record a journal. Powered by Claude AI." },
  { icon: "🔄", title: "Tally Export", desc: "Export your books as Tally-compatible XML. Bring your CA up to speed in one click." },
  { icon: "👥", title: "Team Access", desc: "Invite your CA or accountant as a reviewer. Role-based access — Admin, Accountant, CA/Reviewer, Viewer." },
];

const PROBLEMS = [
  { pain: "CA charges ₹8,000/month", fix: "FrePilot AI does it for ₹499/month" },
  { pain: "Part-time accountant misses TDS dates", fix: "Automated due date alerts every month" },
  { pain: "Can't read your own P&L", fix: "Plain-English AI explains every number" },
  { pain: "GST filing is panic every quarter", fix: "GSTR data prepared in real time as you transact" },
  { pain: "Lost invoices, unrecorded expenses", fix: "Upload anything — AI reads and books it" },
];

const PLANS = [
  {
    name: "Starter", price: "₹499", period: "/month", color: "rgba(237,232,220,0.06)",
    border: "rgba(237,232,220,0.12)",
    features: ["1 business", "Invoicing & GST", "P&L & Balance Sheet", "FrePilot AI chat (50 msgs/mo)", "TDS tracker", "Email support"],
    cta: "Start Free Trial",
  },
  {
    name: "Professional", price: "₹1,299", period: "/month", color: "rgba(201,168,76,0.08)",
    border: "rgba(201,168,76,0.3)", badge: "Most Popular",
    features: ["3 businesses", "Everything in Starter", "AI document upload (100 docs/mo)", "Unlimited FrePilot AI", "Team access (3 users)", "Tally export", "GST return prep", "Priority support"],
    cta: "Get Started",
  },
  {
    name: "Business", price: "₹2,999", period: "/month", color: "rgba(201,168,76,0.04)",
    border: "rgba(201,168,76,0.15)",
    features: ["Unlimited businesses", "Everything in Professional", "Unlimited AI docs", "Unlimited team members", "Bank reconciliation", "Dedicated CA reviewer", "API access", "Custom onboarding"],
    cta: "Contact Sales",
  },
];

export default function FrePilotLanding() {
  return (
    <div style={{ minHeight: "100vh", background: "#070C1A", color: "#EDE8DC", fontFamily: "system-ui,sans-serif" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(201,168,76,0.1)", padding: "0 2rem", display: "flex", alignItems: "center", gap: "2rem", height: 60, position: "sticky", top: 0, background: "rgba(7,12,26,0.95)", backdropFilter: "blur(8px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.3rem" }}>🛩️</span>
          <span style={{ fontWeight: 900, fontSize: "1.1rem", color: "#C9A84C", letterSpacing: "-0.02em" }}>FrePilot</span>
          <span style={{ fontSize: "0.6rem", color: "rgba(201,168,76,0.4)", fontWeight: 500, marginLeft: 2, letterSpacing: "0.05em" }}>by FreWork</span>
        </div>
        <div style={{ flex: 1 }} />
        <a href="#features" style={{ color: "rgba(237,232,220,0.55)", fontSize: "0.85rem", textDecoration: "none" }}>Features</a>
        <a href="#pricing" style={{ color: "rgba(237,232,220,0.55)", fontSize: "0.85rem", textDecoration: "none" }}>Pricing</a>
        <Link href="/login" style={{ color: "rgba(237,232,220,0.55)", fontSize: "0.85rem", textDecoration: "none" }}>Sign In</Link>
        <Link href="/finance/setup" style={{ background: "#C9A84C", color: "#070C1A", padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
          Start Free →
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 880, margin: "0 auto", padding: "6rem 2rem 5rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 20, padding: "5px 14px", marginBottom: "2rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#C9A84C", fontWeight: 600 }}>🛩️ Powered by Claude AI</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 3.8rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 1.5rem", letterSpacing: "-0.03em" }}>
          Your AI Accountant.<br />
          <span style={{ color: "#C9A84C" }}>₹499/month.</span>
        </h1>
        <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", color: "rgba(237,232,220,0.6)", lineHeight: 1.6, maxWidth: 580, margin: "0 auto 2.5rem" }}>
          FrePilot handles GST, TDS, invoicing, journals, and financial reports — so you can focus on building your business, not wrestling with your books.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/finance/setup" style={{ background: "#C9A84C", color: "#070C1A", padding: "14px 36px", borderRadius: 10, fontWeight: 800, fontSize: "1rem", textDecoration: "none", letterSpacing: "0.01em" }}>
            Start Free Trial →
          </Link>
          <Link href="/finance/virtual-ca" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C", padding: "14px 28px", borderRadius: 10, fontWeight: 600, fontSize: "1rem", textDecoration: "none" }}>
            Try FrePilot AI
          </Link>
        </div>
        <div style={{ marginTop: "2.5rem", display: "flex", gap: "2rem", justifyContent: "center", flexWrap: "wrap", color: "rgba(237,232,220,0.35)", fontSize: "0.78rem" }}>
          {["No credit card required", "14-day free trial", "Cancel anytime", "Indian accounting standards"].map(f => (
            <span key={f}>✓ {f}</span>
          ))}
        </div>
      </section>

      {/* Problem → Solution */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "0.65rem", color: "rgba(201,168,76,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.75rem" }}>The Problem</div>
          <h2 style={{ fontSize: "clamp(1.5rem, 4vw, 2.2rem)", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            63 million Indian SMBs.<br />Most keep books on <span style={{ color: "#f87171" }}>WhatsApp and gut feel.</span>
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {PROBLEMS.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 12, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "0.85rem", color: "rgba(237,232,220,0.45)", textDecoration: "line-through" }}>{p.pain}</div>
              <div style={{ color: "rgba(201,168,76,0.4)", fontSize: "1.2rem" }}>→</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#4ade80" }}>{p.fix}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1060, margin: "0 auto", padding: "4rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.65rem", color: "rgba(201,168,76,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.75rem" }}>Everything a CA does</div>
          <h2 style={{ fontSize: "clamp(1.5rem, 4vw, 2.2rem)", fontWeight: 800, margin: 0 }}>Full-stack accounting. Zero jargon.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(237,232,220,0.07)", borderRadius: 14, padding: "1.5rem" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem", color: "#EDE8DC" }}>{f.title}</div>
              <div style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.45)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FrePilot AI callout */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "2rem" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.03) 100%)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 20, padding: "2.5rem 3rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ fontSize: "3rem" }}>🛩️</div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "#C9A84C", marginBottom: "0.5rem" }}>FrePilot AI — Ask Anything</div>
            <div style={{ color: "rgba(237,232,220,0.55)", fontSize: "0.88rem", lineHeight: 1.65 }}>
              "What's the GST rate on software services?" · "How do I record a TDS deduction under 194J?" · "Walk me through GSTR-3B filing" — FrePilot answers like a CA who's always available.
            </div>
          </div>
          <Link href="/finance/virtual-ca" style={{ background: "#C9A84C", color: "#070C1A", padding: "12px 28px", borderRadius: 10, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem", whiteSpace: "nowrap", flexShrink: 0 }}>
            Try FrePilot AI →
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1000, margin: "0 auto", padding: "5rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.65rem", color: "rgba(201,168,76,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: "0.75rem" }}>Pricing</div>
          <h2 style={{ fontSize: "clamp(1.5rem, 4vw, 2.2rem)", fontWeight: 800, margin: "0 0 0.75rem" }}>Less than a chai bill per day.</h2>
          <p style={{ color: "rgba(237,232,220,0.45)", fontSize: "0.9rem", margin: 0 }}>14-day free trial. No credit card required.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{ background: plan.color, border: `1px solid ${plan.border}`, borderRadius: 16, padding: "2rem", display: "flex", flexDirection: "column", position: "relative" }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#C9A84C", color: "#070C1A", padding: "3px 14px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>{plan.badge}</div>
              )}
              <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.5rem", color: plan.name === "Professional" ? "#C9A84C" : "#EDE8DC" }}>{plan.name}</div>
              <div style={{ marginBottom: "1.5rem" }}>
                <span style={{ fontSize: "2rem", fontWeight: 900, color: "#EDE8DC" }}>{plan.price}</span>
                <span style={{ fontSize: "0.8rem", color: "rgba(237,232,220,0.4)" }}>{plan.period}</span>
              </div>
              <div style={{ flex: 1, marginBottom: "1.5rem" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem", fontSize: "0.82rem", color: "rgba(237,232,220,0.65)" }}>
                    <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <Link href="/finance/setup" style={{ background: plan.name === "Professional" ? "#C9A84C" : "rgba(237,232,220,0.08)", color: plan.name === "Professional" ? "#070C1A" : "#EDE8DC", padding: "11px", borderRadius: 9, fontWeight: 700, textDecoration: "none", textAlign: "center", fontSize: "0.88rem" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(237,232,220,0.07)", padding: "2rem", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: "0.75rem" }}>
          <span>🛩️</span>
          <span style={{ fontWeight: 900, color: "#C9A84C" }}>FrePilot</span>
          <span style={{ color: "rgba(237,232,220,0.3)", fontSize: "0.75rem" }}>by FreWork</span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "rgba(237,232,220,0.25)" }}>
          GST · TDS · Invoicing · Accounting · Reports · Powered by Claude AI
        </div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", justifyContent: "center", fontSize: "0.78rem" }}>
          <Link href="/finance" style={{ color: "rgba(237,232,220,0.4)", textDecoration: "none" }}>App</Link>
          <Link href="/finance/virtual-ca" style={{ color: "rgba(237,232,220,0.4)", textDecoration: "none" }}>FrePilot AI</Link>
          <Link href="/finance/setup" style={{ color: "rgba(237,232,220,0.4)", textDecoration: "none" }}>Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
