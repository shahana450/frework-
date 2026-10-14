import type { Metadata } from "next";
import Link from "next/link";
import { FREBOOK_PLAN, FREBOOK_PRICE_LABEL } from "@/lib/plans";
import { FB_CSS, FbHeader, FbFooter, FbRelated, FB_APP, FB_DEMO } from "@/components/frebook/shell";

// Keyword page: "AI accountant", "AI accountant for small business", "AI bookkeeping India".

const PAGE_URL = "https://frework.online/frebook/ai-accountant";
const TITLE = "AI Accountant for Small Business in India – FreBook";
const DESCRIPTION =
  "What an AI accountant does, what it can't do, and how Indian small businesses use FreBook to record entries by chat, handle GST and TDS, and keep books ready for their CA.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  keywords: ["AI accountant", "AI accountant India", "AI accountant for small business", "AI bookkeeping", "AI bookkeeper", "AI accounting software India", "automated bookkeeping India", "FreBook"],
  openGraph: { type: "article", url: PAGE_URL, siteName: "FreWork", locale: "en_IN", title: TITLE, description: DESCRIPTION, images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

const CAN = [
  "Turn a plain-English description into a double-entry journal with the right ledgers",
  "Apply GST (CGST, SGST or IGST) and the relevant TDS section to a transaction",
  "Raise GST invoices and record purchase bills",
  "Import bank statements and help reconcile them",
  "Prepare GSTR-1 and GSTR-3B data from posted entries",
  "Answer questions about your numbers in plain language",
];
const CANNOT = [
  "Sign your financial statements or audit report",
  "Take responsibility for tax positions or filings",
  "Know about transactions nobody tells it about",
  "Replace a CA's judgement on complex or unusual matters",
];

const FAQS = [
  { q: "Is an AI accountant the same as accounting software?",
    a: "Not quite. Traditional accounting software records what you enter, the way you enter it. An AI accountant understands what you describe and works out the accounting entry for you. FreBook is accounting software with an AI accountant built in." },
  { q: "Can an AI accountant replace my CA?",
    a: "No. It replaces the data entry, not the professional. Audits, sign-offs, tax planning and judgement calls stay with your Chartered Accountant — who gets cleaner, more current books to work from." },
  { q: "How accurate is it?",
    a: "FreBook drafts every entry and shows it to you before it posts. You — or your accountant — confirm or correct it. That keeps the speed of AI with a human check on every transaction." },
  { q: "Is it suitable for very small businesses?",
    a: "Yes. Shops, service firms, freelancers and startups that don't have a full-time accountant benefit the most, because recording by chat needs no accounting training." },
  { q: "Does it work with Tally?",
    a: "Yes. FreBook can push entries into Tally Prime and import your Tally ledgers and vouchers." },
  { q: "How much does it cost?",
    a: `FreBook costs ${FREBOOK_PRICE_LABEL} per month plus GST.` },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "AI Accountant for Small Business in India",
      description: DESCRIPTION,
      mainEntityOfPage: PAGE_URL,
      publisher: { "@id": "https://frework.online/#organization" },
      about: { "@type": "SoftwareApplication", name: "FreBook", url: "https://frework.online/frebook" },
    },
    { "@type": "FAQPage", mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "FreWork", item: "https://frework.online" },
        { "@type": "ListItem", position: 2, name: "FreBook", item: "https://frework.online/frebook" },
        { "@type": "ListItem", position: 3, name: "AI Accountant", item: PAGE_URL },
      ],
    },
  ],
};

export default function AiAccountantPage() {
  return (
    <div className="fb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <style>{FB_CSS}</style>
      <FbHeader />
      <main>
        <div className="fb-wrap fb-crumb"><Link href="/">FreWork</Link> › <Link href="/frebook">FreBook</Link> › AI Accountant</div>

        <section className="fb-hero">
          <div className="fb-wrap">
            <span className="fb-tag">Guide · Small business India</span>
            <h1>AI Accountant for Small Business in India</h1>
            <p className="fb-lead">
              What an AI accountant actually does, where it stops, and how Indian businesses use FreBook to keep GST-ready books
              by simply describing what happened.
            </p>
            <div className="fb-cta">
              <Link className="fb-btn fb-gold" href={FB_APP}>Try FreBook</Link>
              <a className="fb-btn fb-ghost" href={FB_DEMO} target="_blank" rel="noopener">Ask a question on WhatsApp</a>
            </div>
          </div>
        </section>

        <section>
          <div className="fb-wrap fb-prose">
            <h2 style={{ marginTop: 0 }}>What is an AI accountant?</h2>
            <p>
              An AI accountant is software that understands business language and turns it into proper accounting. Instead of
              choosing voucher types and ledgers yourself, you write something like &ldquo;Paid ₹12,000 office rent to Ramesh by bank,
              TDS 10%&rdquo;. The AI works out the entry — rent debited, bank and TDS payable credited under the right section — and
              shows it to you before anything is posted.
            </p>
            <p>
              For a small business this changes who can keep the books. The owner, a front-desk staffer or a family member can record
              sales, purchases and expenses the moment they happen, without accounting training. The books stay current all month
              instead of being reconstructed from a box of bills at quarter-end.
            </p>

            <h2>What an AI accountant can do</h2>
            <ul className="fb-ticks">{CAN.map(c => <li key={c}>{c}</li>)}</ul>

            <h2>What it can&apos;t do</h2>
            <p>An AI accountant is a bookkeeper, not a Chartered Accountant. It cannot:</p>
            <ul className="fb-list">{CANNOT.map(c => <li key={c}>{c}</li>)}</ul>
            <p>
              The best results come from both together: the AI keeps day-to-day books accurate and current, and your CA reviews,
              files and advises using records that are already in order.
            </p>

            <h2>Why Indian businesses need one built for India</h2>
            <p>
              Generic AI bookkeeping tools are built around foreign tax systems. Indian books need GST split correctly between CGST,
              SGST and IGST by place of supply, HSN and SAC codes on invoices, section-wise TDS, GSTR-1 and GSTR-3B data, and very
              often a link to Tally, which most accountants still use. FreBook is designed around exactly these.
            </p>
          </div>
        </section>

        <section className="fb-alt">
          <div className="fb-wrap">
            <h2>FreBook: the AI accountant from FreWork</h2>
            <p className="fb-sub">Everything below is included in one plan at {FREBOOK_PRICE_LABEL}/month + GST.</p>
            <div className="fb-price" style={{ maxWidth: 620 }}>
              <ul className="fb-ticks" style={{ margin: "0 0 26px" }}>{FREBOOK_PLAN.features.map(f => <li key={f}>{f}</li>)}</ul>
              <Link className="fb-btn fb-gold" href={FB_APP}>Start FreBook</Link>
            </div>
          </div>
        </section>

        <section>
          <div className="fb-wrap fb-prose">
            <h2 style={{ marginTop: 0 }}>How to start with an AI accountant</h2>
            <ol>
              <li><strong>Set up your business</strong> — name, GSTIN and opening balances, or import them from Tally.</li>
              <li><strong>Record this week&apos;s transactions by chat</strong> and check each draft before confirming.</li>
              <li><strong>Invite your CA or accountant</strong> as a reviewer so they can see and correct entries.</li>
              <li><strong>Use the reports</strong> — P&amp;L, Balance Sheet, GST and TDS summaries — for decisions and filings.</li>
            </ol>
          </div>
        </section>

        <section className="fb-alt" id="faq">
          <div className="fb-wrap">
            <h2>AI accountant: common questions</h2>
            <p className="fb-sub">What small business owners usually ask before they start.</p>
            {FAQS.map((f, i) => <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </section>

        <FbRelated current="ai-accountant" />

        <section className="fb-final">
          <div className="fb-wrap">
            <h2>Chat in. Books out.</h2>
            <p>Let FreBook handle the data entry. Keep your CA for what matters.</p>
            <div className="fb-cta" style={{ justifyContent: "center" }}>
              <Link className="fb-btn fb-gold" href={FB_APP}>Start FreBook</Link>
              <Link className="fb-btn fb-ghost" href="/frebook">See all features</Link>
            </div>
          </div>
        </section>
      </main>
      <FbFooter />
    </div>
  );
}
