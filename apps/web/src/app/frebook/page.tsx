import type { Metadata } from "next";
import Link from "next/link";
import { FREBOOK_PLAN, FREBOOK_PRICE_LABEL, LOWEST_PLAN } from "@/lib/plans";
import { FB_CSS, FbHeader, FbFooter, FbRelated } from "@/components/frebook/shell";

// SEO landing page for FreBook. Targets: AI accountant, AI bookkeeping,
// bookkeeping / accounting software India, Tally + AI.
// The app itself lives at /finance/chat-book — every CTA here points there.

const PAGE_URL = "https://frework.online/frebook";
const APP = "/finance/chat-book";
const DEMO = "https://wa.me/919539028318?text=Hi%20FreWork%2C%20I%20want%20a%20FreBook%20demo";

const TITLE = "FreBook – AI Accountant & Bookkeeping Software with Tally | India";
const DESCRIPTION =
  `FreBook is an AI accountant for Indian businesses. Chat to record entries, raise GST invoices, track TDS and get P&L and Balance Sheet — with Tally push and import. ${FREBOOK_PRICE_LABEL}/month + GST.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  keywords: [
    "AI accountant", "AI accountant India", "AI bookkeeping", "AI bookkeeping software",
    "bookkeeping software India", "accounting software India", "online accounting software",
    "Tally AI", "connect Tally with AI", "Tally integration", "GST accounting software", "FreBook",
  ],
  openGraph: {
    type: "website", url: PAGE_URL, siteName: "FreWork", locale: "en_IN",
    title: "FreBook – AI Accountant & Bookkeeping Software with Tally",
    description: "Chat in. Books out. AI bookkeeping, GST invoicing and Tally for Indian businesses.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreBook – AI Accountant & Bookkeeping Software with Tally",
    description: "AI bookkeeping, GST invoicing and Tally for Indian businesses.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const FAQS: { q: string; a: string }[] = [
  { q: "What is an AI accountant?",
    a: "An AI accountant is software that understands plain-language instructions and turns them into accounting entries, invoices and reports. In FreBook you type something like \"Paid ₹12,000 rent by bank\" — FreBook drafts the journal entry and you confirm it." },
  { q: "Can FreBook connect with Tally?",
    a: "Yes. FreBook can push your entries into Tally and import data from Tally, so you can keep using Tally while recording transactions by chat." },
  { q: "Is FreBook built for GST and TDS?",
    a: "Yes. FreBook handles GST invoicing, purchase bills, GSTR-1 and GSTR-3B preparation, and section-wise TDS tracking." },
  { q: "How much does FreBook cost?",
    a: `FreBook plans: Starter ₹399 (1 business), Basic ₹699 (2), Pro ₹999 (5) and CA Practice ₹2,499 (15) per month plus GST — or pay yearly and get 2 months free. Every plan starts with a 14-day free trial.` },
  { q: "Will FreBook replace my CA or accountant?",
    a: "No. FreBook removes day-to-day data entry so your CA can spend time on review, tax planning and filing. Every AI-drafted entry is confirmed before it posts." },
  { q: "What is FreBook AI?",
    a: "FreBook AI is the assistant built into FreBook. Ask it about GST rates, TDS sections or how to record a transaction, in plain language." },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "FreBook",
      alternateName: "FreBook AI Accountant",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Accounting Software",
      operatingSystem: "Web",
      url: PAGE_URL,
      description: DESCRIPTION,
      featureList: FREBOOK_PLAN.features.join(", "),
      inLanguage: "en-IN",
      offers: {
        "@type": "Offer",
        price: String(LOWEST_PLAN.price),
        priceCurrency: "INR",
        description: "Per month, plus GST",
        url: `${PAGE_URL}#pricing`,
      },
      publisher: { "@id": "https://frework.online/#organization" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "FreWork", item: "https://frework.online" },
        { "@type": "ListItem", position: 2, name: "FreBook – AI Accountant", item: PAGE_URL },
      ],
    },
  ],
};

const WHY = [
  { h: "No accounting knowledge needed", p: "Owners and staff record sales, purchases, expenses and payments by chat. FreBook works out the ledgers, GST and TDS treatment." },
  { h: "You stay in control", p: "AI drafts every entry; you confirm it before it posts. Your CA can review, correct and finalise." },
  { h: "Books that are always current", p: "Entries post as you go, so cash, receivables and GST liability are visible whenever you ask." },
];

const FEATURE_TEXT: Record<string, string> = {
  "FreBook chat bookkeeping — AI drafts, you confirm": "Describe a transaction in plain English. FreBook drafts the entry and you confirm it.",
  "GST invoicing, purchase bills and journals": "GST-ready sales invoices with CGST, SGST and IGST, plus purchase bills and journal entries.",
  "Ledgers, receivables & payables by party": "Party-wise ledgers with clear receivables and payables at any time.",
  "Bank statement import (CSV / Excel) and reconciliation": "Import CSV or Excel bank statements and reconcile them against your books.",
  "GSTR-1 & GSTR-3B preparation": "Return data prepared from your posted entries, ready for filing.",
  "TDS tracker": "Section-wise TDS with due dates, so nothing slips.",
  "Tally push and import": "Push entries into Tally and import Tally data — no need to switch software.",
  "P&L, Balance Sheet and trial balance": "Live financial statements, ready for your CA, banker or investor.",
};

export default function FreBookLandingPage() {
  return (
    <div className="fb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <style>{FB_CSS}</style>

      <FbHeader />

      <main>
        <div className="fb-wrap fb-crumb"><Link href="/">FreWork</Link> › FreBook – AI Accountant</div>

        <section className="fb-hero">
          <div className="fb-wrap">
            <span className="fb-tag">AI Accountant · Built for India</span>
            <h1>AI Bookkeeping &amp; Accounting Software for Indian Businesses</h1>
            <p className="fb-lead">
              Chat in. Books out. FreBook is your AI accountant: type a transaction in plain English and it drafts the entry,
              raises the GST invoice and keeps your P&amp;L, Balance Sheet and Tally up to date.
            </p>
            <div className="fb-cta">
              <Link className="fb-btn fb-gold" href={APP}>Start FreBook</Link>
              <a className="fb-btn fb-ghost" href={DEMO} target="_blank" rel="noopener">Book a free demo on WhatsApp</a>
            </div>
            <div className="fb-chat" aria-label="Example conversation with FreBook">
              <div className="fb-msg fb-u">Paid ₹12,000 office rent to Ramesh by bank, TDS 10%</div>
              <div className="fb-msg fb-b">Draft ready: Rent A/c Dr ₹12,000 · To Bank ₹10,800 · To TDS Payable (194-I) ₹1,200. Confirm?</div>
              <div className="fb-msg fb-u">What&apos;s my GST payable this month?</div>
              <div className="fb-msg fb-b">Output GST ₹48,600 − ITC ₹31,250 = <strong>₹17,350 payable</strong>.</div>
            </div>
            <p className="fb-note">Illustrative example.</p>
          </div>
        </section>

        <section>
          <div className="fb-wrap">
            <h2>What is an AI accountant?</h2>
            <p className="fb-sub">
              An AI accountant understands business language and converts it into proper double-entry accounting. Instead of learning
              ledgers, voucher types and menus, you tell FreBook what happened. It applies the right ledger, GST rate and TDS section,
              and your books stay audit-ready every day — not just at year-end.
            </p>
            <div className="fb-grid">
              {WHY.map(w => <div className="fb-card" key={w.h}><h3>{w.h}</h3><p>{w.p}</p></div>)}
            </div>
          </div>
        </section>

        <section className="fb-alt" id="features">
          <div className="fb-wrap">
            <h2>Everything your bookkeeping needs, in one place</h2>
            <p className="fb-sub">Online accounting software made for Indian compliance — GST, TDS and Schedule III-style reports.</p>
            <div className="fb-grid fb-grid3">
              {FREBOOK_PLAN.features.map(f => (
                <div className="fb-card" key={f}><h3>{f}</h3><p>{FEATURE_TEXT[f] ?? ""}</p></div>
              ))}
              <div className="fb-card"><h3>FreBook AI assistant</h3><p>Ask about GST rates, TDS sections or how to record anything — in plain language.</p></div>
            </div>
          </div>
        </section>

        <section id="tally">
          <div className="fb-wrap fb-tally">
            <div>
              <h2>Connect Tally with AI</h2>
              <p className="fb-sub" style={{ marginBottom: 18 }}>
                Millions of Indian businesses run on Tally. FreBook adds an AI layer alongside it, so you get AI bookkeeping
                without switching software.
              </p>
              <ul className="fb-ticks">
                <li>Record entries by chat and push them into Tally</li>
                <li>Import your Tally data into FreBook</li>
                <li>Ask questions about your books in plain language</li>
                <li>Works for businesses and for CA firms managing many Tally clients</li>
              </ul>
            </div>
            <div className="fb-sync">
              <div className="fb-row"><span className="fb-pill">FreBook AI</span><span className="fb-arrow">⇄</span><span className="fb-pill">Tally</span></div>
              <p>Chat entries go to Tally. Tally data comes back to FreBook.</p>
            </div>
          </div>
        </section>

        <section className="fb-alt">
          <div className="fb-wrap">
            <h2>How FreBook works</h2>
            <p className="fb-sub">Go from sign-up to your first AI-recorded entry in minutes.</p>
            <div className="fb-steps">
              <div className="fb-step"><h3>Sign in with Google</h3><p>Create your business, add your GSTIN and opening balances, or import from Tally.</p></div>
              <div className="fb-step"><h3>Chat your transactions</h3><p>Sales, purchases, expenses, receipts — describe them, check the draft, confirm.</p></div>
              <div className="fb-step"><h3>Get reports and filing data</h3><p>P&amp;L, Balance Sheet, GST and TDS summaries whenever you or your CA need them.</p></div>
            </div>
          </div>
        </section>

        <section>
          <div className="fb-wrap">
            <h2>FreBook vs traditional accounting software</h2>
            <p className="fb-sub">Why Indian SMBs are moving from manual bookkeeping to an AI accountant.</p>
            <div className="fb-tablewrap">
              <table className="fb-cmp">
                <thead><tr><th>What you need</th><th>Traditional software</th><th>FreBook</th></tr></thead>
                <tbody>
                  <tr><td>Recording an entry</td><td>Pick voucher, ledgers and tax manually</td><td>Type one sentence, confirm</td></tr>
                  <tr><td>Accounting knowledge</td><td>Required</td><td>Not required</td></tr>
                  <tr><td>Questions about your numbers</td><td>Run and read reports</td><td>Ask in plain English</td></tr>
                  <tr><td>Tally</td><td>Separate system</td><td>Push and import</td></tr>
                  <tr><td>Access</td><td>Often one desktop</td><td>In your browser, anywhere</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="fb-alt" id="pricing">
          <div className="fb-wrap">
            <h2 className="fb-center">Simple pricing</h2>
            <p className="fb-sub fb-center" style={{ margin: "0 auto 36px" }}>One plan with everything included.</p>
            <div className="fb-price">
              <div className="fb-amt"><small>from</small> {FREBOOK_PRICE_LABEL} <small>/ month + GST</small></div>
              <ul className="fb-ticks">{FREBOOK_PLAN.features.map(f => <li key={f}>{f}</li>)}</ul>
              <Link className="fb-btn fb-gold" href={APP}>Get started</Link>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="fb-wrap">
            <h2>Frequently asked questions</h2>
            <p className="fb-sub">About AI bookkeeping, Tally and FreBook.</p>
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </section>

        <FbRelated current="main" />

        <section className="fb-final">
          <div className="fb-wrap">
            <h2>Chat in. Books out.</h2>
            <p>Move your bookkeeping to an AI accountant built for India.</p>
            <div className="fb-cta" style={{ justifyContent: "center" }}>
              <Link className="fb-btn fb-gold" href={APP}>Start FreBook</Link>
              <a className="fb-btn fb-ghost" href={DEMO} target="_blank" rel="noopener">WhatsApp +91 95390 28318</a>
            </div>
          </div>
        </section>
      </main>

      <FbFooter />
    </div>
  );
}
