import type { Metadata } from "next";
import Link from "next/link";
import { FREBOOK_PRICE_LABEL } from "@/lib/plans";
import { FB_CSS, FbHeader, FbFooter, FbRelated, FB_APP, FB_DEMO } from "@/components/frebook/shell";

// Keyword page: "connect Tally with AI", "Tally AI", "Tally integration".
// Steps below describe the real flow in /finance/tally (Tally HTTP server + FreWork Tally Bridge).

const PAGE_URL = "https://frework.online/frebook/tally-ai";
const TITLE = "Connect Tally with AI – Chat Bookkeeping for Tally Prime | FreBook";
const DESCRIPTION =
  "Connect Tally Prime with AI using FreBook. Record entries by chat, push them into Tally, and import your Tally ledgers and vouchers for AI-powered bookkeeping — without leaving Tally.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  keywords: ["connect Tally with AI", "Tally AI", "Tally Prime AI", "Tally integration", "AI for Tally", "Tally automation", "Tally bookkeeping software", "FreBook"],
  openGraph: { type: "article", url: PAGE_URL, siteName: "FreWork", locale: "en_IN", title: TITLE, description: DESCRIPTION, images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

const STEPS = [
  { h: "Turn on Tally's HTTP server", p: "In Tally Prime, open F1 → Settings → Connectivity and enable the HTTP server. Note the port number shown there." },
  { h: "Install the FreWork Tally Bridge", p: "A small helper on the same computer as Tally lets FreBook in your browser talk to Tally securely. FreBook offers it from the Tally page." },
  { h: "Connect and pick your company", p: "In FreBook, open Tally, enter the port and press Connect. If several companies are open in Tally, choose the right one from the list." },
  { h: "Import, then work by chat", p: "Bring your Tally ledgers and vouchers into FreBook. From then on, record new entries by chat and push them to Tally." },
];

const FAQS = [
  { q: "Do I have to stop using Tally?",
    a: "No. FreBook works alongside Tally Prime. You can keep Tally as your main books and use FreBook to record entries by chat and push them in." },
  { q: "Which way does data move between FreBook and Tally?",
    a: "Both ways. FreBook imports ledgers and vouchers from Tally, and pushes entries recorded in FreBook into Tally. Entries FreBook has already pushed are skipped on import, so they are not duplicated." },
  { q: "Does Tally need to be open?",
    a: "Yes. Live sync needs Tally Prime running on the computer with the FreWork Tally Bridge. If that's not possible, FreBook can give you an XML file to import through Gateway of Tally → Import → Vouchers." },
  { q: "Will it create ledgers in Tally for me?",
    a: "Yes. When FreBook pushes entries, it creates any ledgers that don't exist in Tally yet, before posting the vouchers." },
  { q: "Can a CA firm use it for many Tally clients?",
    a: "Yes. FreBook supports several businesses in one account, and you choose which Tally company to connect to each time." },
  { q: "What does it cost?",
    a: `Tally sync is included in the FreBook plan at ${FREBOOK_PRICE_LABEL} per month plus GST.` },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "HowTo",
      name: "How to connect Tally Prime with AI using FreBook",
      description: DESCRIPTION,
      step: STEPS.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.h, text: s.p })),
    },
    { "@type": "FAQPage", mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "FreWork", item: "https://frework.online" },
        { "@type": "ListItem", position: 2, name: "FreBook", item: "https://frework.online/frebook" },
        { "@type": "ListItem", position: 3, name: "Connect Tally with AI", item: PAGE_URL },
      ],
    },
  ],
};

export default function TallyAiPage() {
  return (
    <div className="fb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <style>{FB_CSS}</style>
      <FbHeader />
      <main>
        <div className="fb-wrap fb-crumb"><Link href="/">FreWork</Link> › <Link href="/frebook">FreBook</Link> › Connect Tally with AI</div>

        <section className="fb-hero">
          <div className="fb-wrap">
            <span className="fb-tag">Tally Prime · AI bookkeeping</span>
            <h1>Connect Tally with AI</h1>
            <p className="fb-lead">
              Keep Tally. Add an AI accountant on top. FreBook lets you record entries by chat, push them straight into Tally Prime,
              and bring your Tally ledgers and vouchers back for AI-powered bookkeeping.
            </p>
            <div className="fb-cta">
              <Link className="fb-btn fb-gold" href={FB_APP}>Connect FreBook to Tally</Link>
              <a className="fb-btn fb-ghost" href={FB_DEMO} target="_blank" rel="noopener">See it on a WhatsApp demo</a>
            </div>
            <div className="fb-sync" style={{ marginTop: 44, maxWidth: 560 }}>
              <div className="fb-row"><span className="fb-pill">FreBook AI</span><span className="fb-arrow">⇄</span><span className="fb-pill">Tally Prime</span></div>
              <p>Entries go to Tally. Ledgers and vouchers come back.</p>
            </div>
          </div>
        </section>

        <section>
          <div className="fb-wrap fb-prose">
            <h2 style={{ marginTop: 0 }}>Why add AI to Tally?</h2>
            <p>
              Tally Prime is the backbone of bookkeeping for millions of Indian businesses and CA firms. It is accurate and trusted,
              but every entry still means choosing a voucher type, picking ledgers and applying GST and TDS by hand. That is where
              the time goes, and where mistakes creep in when staff change or volumes rise.
            </p>
            <p>
              FreBook keeps Tally as your books and removes the typing. You describe a transaction in plain English — a sale,
              a purchase bill, a rent payment with TDS — and FreBook drafts the entry with the right ledgers and tax treatment.
              You check it, confirm it, and push it to Tally. Nothing posts without your confirmation.
            </p>

            <h2>What you can do with FreBook and Tally</h2>
            <ul className="fb-list">
              <li><strong>Record by chat, post to Tally.</strong> Draft entries in plain language and push confirmed vouchers into your Tally company.</li>
              <li><strong>Import from Tally.</strong> Bring your chart of accounts (ledgers) and vouchers into FreBook, month by month, so reports and AI answers use your real books.</li>
              <li><strong>Avoid duplicates.</strong> Entries FreBook has already pushed are skipped when you import from Tally.</li>
              <li><strong>Missing ledgers handled.</strong> FreBook creates ledgers that don&apos;t exist in Tally yet before posting vouchers.</li>
              <li><strong>Several companies.</strong> If more than one company is open in Tally, choose which one FreBook should use.</li>
              <li><strong>Offline fallback.</strong> Download an XML file and import it through Gateway of Tally → Import → Vouchers.</li>
            </ul>
          </div>
        </section>

        <section className="fb-alt">
          <div className="fb-wrap">
            <h2>How to connect Tally Prime with AI</h2>
            <p className="fb-sub">Four steps, done once. After that FreBook reconnects when Tally is open.</p>
            <div className="fb-steps">
              {STEPS.map(s => <div className="fb-step" key={s.h}><h3>{s.h}</h3><p>{s.p}</p></div>)}
            </div>
          </div>
        </section>

        <section>
          <div className="fb-wrap fb-prose">
            <h2 style={{ marginTop: 0 }}>Built for businesses and CA firms</h2>
            <p>
              <strong>Business owners</strong> get books that stay current without learning Tally menus — staff can record expenses and
              receipts by chat, and the owner can ask &ldquo;what&apos;s my GST payable this month?&rdquo; instead of running reports.
            </p>
            <p>
              <strong>CA firms and accountants</strong> keep working in Tally for review and finalisation, while clients or junior staff
              capture transactions in FreBook. Every AI-drafted entry is confirmed before it posts, so the audit trail stays clear.
            </p>
          </div>
        </section>

        <section className="fb-alt" id="faq">
          <div className="fb-wrap">
            <h2>Tally + AI: common questions</h2>
            <p className="fb-sub">Straight answers about how FreBook works with Tally Prime.</p>
            {FAQS.map((f, i) => <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </section>

        <FbRelated current="tally-ai" />

        <section className="fb-final">
          <div className="fb-wrap">
            <h2>Keep Tally. Lose the typing.</h2>
            <p>Tally sync is included in FreBook at {FREBOOK_PRICE_LABEL}/month + GST.</p>
            <div className="fb-cta" style={{ justifyContent: "center" }}>
              <Link className="fb-btn fb-gold" href={FB_APP}>Start FreBook</Link>
              <Link className="fb-btn fb-ghost" href="/frebook#pricing">See what&apos;s included</Link>
            </div>
          </div>
        </section>
      </main>
      <FbFooter />
    </div>
  );
}
