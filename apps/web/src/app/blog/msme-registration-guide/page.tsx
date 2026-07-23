import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MSME / Udyam Registration India 2025 — Benefits, Process & Documents | FreWork",
  description:
    "Complete guide to MSME Udyam registration in India 2025. Who can register, benefits of MSME certificate, documents needed, online process and how to get Udyam certificate free.",
  keywords: [
    "MSME registration India 2025",
    "Udyam registration online",
    "MSME certificate benefits",
    "how to register MSME online",
    "Udyam registration process",
    "MSME registration documents",
    "small business registration India",
    "Udyam registration free",
    "MSME loan benefits India",
    "micro small medium enterprise registration",
    "FreWork MSME registration",
  ],
  openGraph: {
    title: "MSME / Udyam Registration India 2025 — Benefits, Process & Documents",
    description: "Who can register, benefits, documents needed, online process for MSME Udyam registration in India 2025.",
    url: "https://frework.online/blog/msme-registration-guide",
    type: "article",
  },
  alternates: { canonical: "https://frework.online/blog/msme-registration-guide" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "MSME / Udyam Registration India 2025 — Benefits, Process & Documents",
  "description": "Complete guide to MSME Udyam registration — who can register, benefits, documents and the online registration process.",
  "author": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "publisher": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "datePublished": "2025-07-01",
  "dateModified": "2025-07-23",
  "mainEntityOfPage": "https://frework.online/blog/msme-registration-guide",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Is MSME/Udyam registration free?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, Udyam registration on the official portal (udyamregistration.gov.in) is completely free. You only need an Aadhaar number and PAN. There is no government fee. Professional help for the registration process may have a service charge." } },
    { "@type": "Question", "name": "Who is eligible for MSME registration?", "acceptedAnswer": { "@type": "Answer", "text": "Any business engaged in manufacturing or service activities can register as MSME. Micro enterprises have investment up to ₹1 crore and turnover up to ₹5 crore. Small enterprises have investment up to ₹10 crore and turnover up to ₹50 crore. Medium enterprises have investment up to ₹50 crore and turnover up to ₹250 crore." } },
    { "@type": "Question", "name": "What are the benefits of MSME/Udyam registration?", "acceptedAnswer": { "@type": "Answer", "text": "MSME registration gives access to: collateral-free bank loans under CGTMSE scheme, 1-2% interest subvention on loans, priority sector lending, lower electricity charges, 50% discount on trademark and patent filing fees, government tender exemptions, protection against delayed payments under MSMED Act, and various state government subsidies." } },
    { "@type": "Question", "name": "What documents are required for Udyam registration?", "acceptedAnswer": { "@type": "Answer", "text": "For Udyam registration, you need: Aadhaar number of the proprietor/partner/director, PAN card, business bank account details, and NIC code for your business activity. No physical documents are required to be uploaded — it is based on self-declaration." } },
  ]
};

const BENEFITS = [
  { title: "Collateral-Free Loans", desc: "Access CGTMSE scheme loans without pledging assets — up to ₹2 crore for manufacturing, ₹1 crore for services." },
  { title: "Interest Subvention", desc: "1–2% interest rebate on loans under various government schemes, saving lakhs on borrowing costs." },
  { title: "50% Discount on IP Fees", desc: "50% reduction on trademark, patent and industrial design filing fees." },
  { title: "Tender Advantages", desc: "Exemption from Earnest Money Deposit (EMD) in government tenders. Access to GeM portal." },
  { title: "Payment Protection", desc: "Under MSMED Act, buyers must pay within 45 days. Delayed payments attract 3x bank rate as interest." },
  { title: "Tax & Utility Benefits", desc: "Lower electricity tariffs, state-level capital subsidy, GST reimbursement schemes in several states." },
];

export default function MSMERegistrationGuidePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageLayout>
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="mb-8">
            <Link href="/blog" className="text-sm text-blue-600 hover:underline">← Back to Blog</Link>
          </div>

          <header className="mb-10">
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">MSME</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Updated July 2025</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight" style={{ color: "#0F2044" }}>
              MSME / Udyam Registration India 2025 — Benefits, Process &amp; Documents
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              MSME (Micro, Small and Medium Enterprise) registration — now called Udyam registration — unlocks
              government loans, subsidies and legal protections for your business. It is free and takes under 30 minutes.
            </p>
          </header>

          <div className="p-5 rounded-2xl border border-orange-200 bg-orange-50 mb-10">
            <p className="font-bold text-orange-900 mb-1">Key Facts</p>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• Registration is <strong>100% free</strong> on the government portal</li>
              <li>• Only Aadhaar + PAN required (no other documents)</li>
              <li>• Certificate issued immediately after registration</li>
              <li>• Available to all businesses — proprietorship to Pvt Ltd</li>
            </ul>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>MSME Classification 2025</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-orange-50">
                <th className="text-left p-3 border border-orange-100 font-bold">Category</th>
                <th className="text-left p-3 border border-orange-100 font-bold">Investment in Plant &amp; Machinery</th>
                <th className="text-left p-3 border border-orange-100 font-bold">Annual Turnover</th>
              </tr></thead>
              <tbody>
                {[
                  ["Micro Enterprise", "Up to ₹1 crore", "Up to ₹5 crore"],
                  ["Small Enterprise", "Up to ₹10 crore", "Up to ₹50 crore"],
                  ["Medium Enterprise", "Up to ₹50 crore", "Up to ₹250 crore"],
                ].map(([cat, inv, turn]) => (
                  <tr key={cat as string} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 font-bold text-orange-700">{cat}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{inv}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{turn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>Benefits of MSME Registration</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {BENEFITS.map(b => (
              <div key={b.title} className="p-4 rounded-xl border border-orange-100 bg-white">
                <p className="font-bold text-gray-900 mb-1">{b.title}</p>
                <p className="text-sm text-gray-600">{b.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>How to Register for Udyam Online (Step by Step)</h2>
          <ol className="list-decimal pl-6 mb-6 text-gray-700 space-y-3">
            <li>Go to <strong>udyamregistration.gov.in</strong> (official government portal)</li>
            <li>Click <strong>"For New Entrepreneurs who are not Registered yet as MSME"</strong></li>
            <li>Enter your <strong>Aadhaar number</strong> and validate with OTP</li>
            <li>Enter your <strong>PAN number</strong> — it auto-fills business details from GST/IT records</li>
            <li>Select your <strong>enterprise type</strong> (proprietorship, partnership, LLP, Pvt Ltd, etc.)</li>
            <li>Enter <strong>business address</strong>, bank account details, NIC code for activity</li>
            <li>Declare your investment in plant/machinery and annual turnover (estimated for new businesses)</li>
            <li>Submit — your <strong>Udyam Registration Certificate</strong> is issued immediately with a unique Udyam number</li>
          </ol>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>Documents Required</h2>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li><strong>Aadhaar card</strong> of proprietor / managing partner / authorized director</li>
            <li><strong>PAN card</strong> of the business entity</li>
            <li>Bank account number and IFSC code</li>
            <li>NIC (National Industrial Classification) code for your business activity</li>
            <li><em>No physical documents need to be uploaded</em> — it is self-declaration based</li>
          </ul>

          <h2 className="text-2xl font-black mt-10 mb-6" style={{ color: "#0F2044" }}>Frequently Asked Questions</h2>
          <div className="space-y-4 mb-10">
            {faqJsonLd.mainEntity.map(faq => (
              <details key={faq.name} className="border border-gray-200 rounded-xl p-4">
                <summary className="font-bold text-gray-900 cursor-pointer">{faq.name}</summary>
                <p className="mt-3 text-gray-700 text-sm leading-relaxed">{faq.acceptedAnswer.text}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-2xl border-2 border-orange-200 bg-orange-50">
            <h3 className="text-xl font-black mb-2" style={{ color: "#0F2044" }}>Get your MSME certificate with expert help</h3>
            <p className="text-gray-600 mb-4">FreWork handles your Udyam registration end-to-end — Aadhaar verification, NIC code selection, portal submission and certificate download. Done in 1 working day.</p>
            <Link href="/services/business-registration" className="inline-block font-bold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #EA580C, #C2410C)" }}>
              Register MSME — ₹499 →
            </Link>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
