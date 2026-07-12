import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to File Income Tax Return (ITR) Online in India 2025 | FreWork",
  description:
    "Complete step-by-step guide to filing income tax return (ITR) online in India 2025. Which ITR form to use, documents needed, last date, how to e-verify, and get refund faster. Expert CA help from ₹799.",
  keywords: [
    "how to file income tax return online India",
    "ITR filing online India 2025",
    "income tax return filing guide India",
    "which ITR form to use",
    "ITR-1 ITR-2 ITR-3 which to file",
    "income tax last date India 2025",
    "documents needed for ITR filing",
    "e-verify income tax return India",
    "income tax refund India",
    "ITR filing for salaried India",
    "online income tax return India",
  ],
  openGraph: {
    title: "How to File Income Tax Return (ITR) Online India 2025 | FreWork",
    description: "Step-by-step ITR filing guide — which form, documents, last date, e-verification and refund. CA help from ₹799.",
    url: "https://frework.online/blog/itr-filing-guide",
    type: "article",
  },
  alternates: { canonical: "https://frework.online/blog/itr-filing-guide" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to File Income Tax Return (ITR) Online in India 2025",
  "description": "Complete guide to ITR filing online — which form, documents, deadline, e-verification and refund.",
  "author": { "@type": "Organization", "name": "FreWork" },
  "publisher": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "datePublished": "2025-07-01",
  "dateModified": "2025-07-12",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What is the last date to file ITR in India 2025?", "acceptedAnswer": { "@type": "Answer", "text": "The due date for filing ITR for individuals (AY 2025-26) is July 31, 2025. For businesses requiring audit, it is October 31, 2025." } },
    { "@type": "Question", "name": "Which ITR form should I use?", "acceptedAnswer": { "@type": "Answer", "text": "ITR-1 (Sahaj): salaried individuals with income up to ₹50L. ITR-2: individuals with capital gains or foreign income. ITR-3: individuals with business/professional income. ITR-4 (Sugam): presumptive tax scheme. ITR-5/6: firms and companies." } },
    { "@type": "Question", "name": "What documents are needed for ITR filing?", "acceptedAnswer": { "@type": "Answer", "text": "Key documents: Form 16 (from employer), Form 26AS, bank statements, investment proofs (80C, 80D, HRA), capital gains statement, and Aadhaar-PAN link confirmation." } },
    { "@type": "Question", "name": "How to e-verify income tax return?", "acceptedAnswer": { "@type": "Answer", "text": "You can e-verify your ITR using Aadhaar OTP, net banking, bank ATM, or demat account. E-verification must be done within 30 days of filing to complete the process." } },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageLayout>
        <article className="max-w-3xl mx-auto px-4 py-16">
          <nav className="text-sm mb-8 text-gray-500">
            <Link href="/" className="hover:text-amber-600">Home</Link> &rsaquo;{" "}
            <Link href="/blog" className="hover:text-amber-600">Blog</Link> &rsaquo;{" "}
            <span>ITR Filing Guide 2025</span>
          </nav>

          <div className="inline-block bg-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-4">Income Tax · Filing Guide</div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4" style={{ color: "#1A1208" }}>
            How to File Income Tax Return (ITR) Online in India 2025
          </h1>
          <p className="text-gray-500 text-sm mb-8">By FreWork CA Team · Updated July 2025 · 10 min read</p>

          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Filing your income tax return (ITR) online in India is now simpler than ever — but choosing the right form, gathering the right documents, and filing before the deadline is crucial. This step-by-step guide explains everything for AY 2025-26.
          </p>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>ITR Filing Last Date 2025</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-amber-50"><th className="text-left p-3 border border-amber-100 font-bold">Category</th><th className="text-left p-3 border border-amber-100 font-bold">Due Date</th></tr></thead>
              <tbody>
                {[
                  ["Individuals / HUF / AOP (no audit)", "31 July 2025"],
                  ["Businesses requiring audit", "31 October 2025"],
                  ["Transfer pricing cases", "30 November 2025"],
                  ["Belated / revised return", "31 December 2025"],
                ].map(([cat, date]) => (
                  <tr key={cat} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 text-gray-700">{cat}</td>
                    <td className="p-3 border border-gray-100 font-semibold text-amber-700">{date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Which ITR Form Should I Use?</h2>
          <ul className="list-none mb-6 space-y-3">
            {[
              ["ITR-1 (Sahaj)", "Salaried individuals with total income up to ₹50 lakhs. Income from salary, one house property and other sources."],
              ["ITR-2", "Individuals with capital gains, more than one house property, or foreign income/assets."],
              ["ITR-3", "Individuals and HUFs with income from business or profession."],
              ["ITR-4 (Sugam)", "Individuals/firms opting for presumptive taxation under Sections 44AD, 44ADA, 44AE."],
              ["ITR-5", "Partnership firms, LLPs, AOPs, BOIs."],
              ["ITR-6", "Companies (other than those claiming exemption under Section 11)."],
            ].map(([form, desc]) => (
              <li key={form as string} className="flex gap-3 p-4 bg-gray-50 rounded-xl">
                <span className="font-black text-amber-600 whitespace-nowrap">{form}</span>
                <span className="text-gray-700">{desc}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Documents Required for ITR Filing</h2>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li><strong>Form 16</strong> — issued by your employer (for salaried)</li>
            <li><strong>Form 26AS</strong> — tax credit statement from Income Tax portal</li>
            <li><strong>AIS / TIS</strong> — Annual Information Statement</li>
            <li>Bank account statements (all accounts)</li>
            <li>Investment proofs: PPF, LIC, ELSS, NPS (for 80C deductions)</li>
            <li>Health insurance premium receipts (80D)</li>
            <li>Home loan interest certificate (for Section 24 deduction)</li>
            <li>Capital gains statement from broker / mutual fund house</li>
            <li>Rental income details with tenant PAN (if applicable)</li>
          </ul>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>How to File ITR Online — Step by Step</h2>
          <ol className="list-decimal pl-6 mb-6 text-gray-700 space-y-3">
            <li>Login to <strong>incometax.gov.in</strong> with your PAN and password</li>
            <li>Go to e-File → File Income Tax Return → Select AY 2025-26</li>
            <li>Choose the correct ITR form based on your income type</li>
            <li>Pre-fill data auto-populates from Form 26AS / AIS — verify carefully</li>
            <li>Enter remaining income, deductions (80C, 80D, HRA, etc.)</li>
            <li>Compute tax payable — pay any balance tax using Challan 280</li>
            <li>Submit the return → e-verify within 30 days</li>
            <li>Download ITR-V acknowledgement</li>
          </ol>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Penalty for Late ITR Filing</h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            Filing ITR after the due date attracts a penalty under <strong>Section 234F</strong>:
          </p>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li><strong>₹5,000</strong> if filed after July 31 but before December 31</li>
            <li><strong>₹1,000</strong> if total income is below ₹5 lakhs</li>
            <li>Interest at <strong>1% per month</strong> on unpaid tax (Section 234A)</li>
          </ul>

          <div className="mt-12 p-6 rounded-2xl border-2 border-green-200 bg-green-50">
            <h3 className="text-xl font-black mb-2" style={{ color: "#1A1208" }}>Let a CA file your ITR — stress-free</h3>
            <p className="text-gray-600 mb-4">Share your documents and our CA team files your return accurately and on time. Starting ₹799 for individuals.</p>
            <Link href="/services/income-tax" className="inline-block bg-green-700 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
              File Your ITR Now — ₹799 →
            </Link>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
