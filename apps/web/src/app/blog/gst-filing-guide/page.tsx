import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Return Filing Guide India 2025 — GSTR-1, GSTR-3B, GSTR-9 | FreWork",
  description:
    "Complete guide to GST return filing in India 2025. How to file GSTR-1, GSTR-3B, GSTR-9, due dates, late fees and penalties. Expert help from ₹499/month.",
  keywords: [
    "GST return filing India",
    "GSTR-1 filing",
    "GSTR-3B filing",
    "GSTR-9 annual return",
    "GST filing due dates 2025",
    "how to file GST return online",
    "GST late fee penalty India",
    "monthly GST filing India",
    "quarterly GST filing India",
    "GST return filing steps",
    "FreWork GST filing",
  ],
  openGraph: {
    title: "GST Return Filing Guide India 2025 — GSTR-1, GSTR-3B, GSTR-9",
    description: "How to file GST returns online, due dates, late fees, and expert filing help from ₹499/month.",
    url: "https://frework.online/blog/gst-filing-guide",
    type: "article",
  },
  alternates: { canonical: "https://frework.online/blog/gst-filing-guide" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "GST Return Filing Guide India 2025 — GSTR-1, GSTR-3B, GSTR-9",
  "description": "Complete guide to GST return filing — GSTR-1, GSTR-3B, GSTR-9, due dates, late fees and how to file online.",
  "author": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "publisher": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "datePublished": "2025-07-01",
  "dateModified": "2025-07-23",
  "mainEntityOfPage": "https://frework.online/blog/gst-filing-guide",
  "keywords": "GST return filing, GSTR-1, GSTR-3B, GSTR-9, GST due dates India 2025",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What is GSTR-1?", "acceptedAnswer": { "@type": "Answer", "text": "GSTR-1 is a monthly or quarterly return that contains details of all outward supplies (sales) made by a GST-registered business. Monthly filers must submit it by the 11th of the following month." } },
    { "@type": "Question", "name": "What is the due date for GSTR-3B?", "acceptedAnswer": { "@type": "Answer", "text": "GSTR-3B is a monthly summary return. For most taxpayers, it is due by the 20th of the following month. QRMP scheme taxpayers file it quarterly." } },
    { "@type": "Question", "name": "What is the late fee for GST return filing?", "acceptedAnswer": { "@type": "Answer", "text": "The late fee for GSTR-3B is ₹50/day (₹25 CGST + ₹25 SGST) for taxpayers with tax liability, and ₹20/day for nil returns. Maximum late fee is capped at ₹10,000 per return." } },
    { "@type": "Question", "name": "Who needs to file GSTR-9?", "acceptedAnswer": { "@type": "Answer", "text": "GSTR-9 is the annual GST return. It is mandatory for all regular taxpayers registered under GST. Businesses with aggregate turnover up to ₹2 crore are exempt from GSTR-9C (reconciliation statement)." } },
  ]
};

const RETURNS = [
  { name: "GSTR-1", who: "All regular taxpayers", due: "11th of next month (monthly) / 13th of month after quarter (quarterly)", what: "Details of outward supplies (sales invoices)" },
  { name: "GSTR-3B", who: "All regular taxpayers", due: "20th of next month (large) / 22nd–24th (others)", what: "Summary of sales, ITC claims and tax payment" },
  { name: "GSTR-9", who: "Annual return for all regular taxpayers", due: "31st December of next financial year", what: "Consolidated annual summary of all GST returns" },
  { name: "GSTR-9C", who: "Turnover > ₹5 crore", due: "31st December (with GSTR-9)", what: "Reconciliation statement + statutory auditor certification" },
  { name: "GSTR-4", who: "Composition scheme taxpayers", due: "30th April of next financial year", what: "Annual return for composition dealers" },
  { name: "GSTR-7", who: "TDS deductors under GST", due: "10th of next month", what: "TDS deducted on payments to suppliers" },
];

export default function GSTFilingGuidePage() {
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
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">GST</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Updated July 2025</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight" style={{ color: "#0F2044" }}>
              GST Return Filing Guide India 2025 — GSTR-1, GSTR-3B &amp; GSTR-9
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Every GST-registered business must file regular returns. Miss a deadline and you pay late fees.
              This guide covers every GST return type, due dates, penalties and exactly how to file online.
            </p>
          </header>

          <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50 mb-10">
            <p className="font-bold text-blue-900 mb-1">Quick Summary</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• GSTR-1: Report all sales (11th monthly / 13th quarterly)</li>
              <li>• GSTR-3B: Pay GST and claim ITC (20th monthly)</li>
              <li>• GSTR-9: Annual consolidated return (31st December)</li>
              <li>• Late fee: ₹50/day for GSTR-3B, max ₹10,000</li>
            </ul>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>Types of GST Returns</h2>
          <p className="text-gray-700 mb-6">There are over 20 types of GST returns, but most regular businesses only need to file GSTR-1, GSTR-3B and GSTR-9. Here is a complete list of the most important ones:</p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left p-3 border border-blue-100 font-bold">Return</th>
                  <th className="text-left p-3 border border-blue-100 font-bold">Who Files</th>
                  <th className="text-left p-3 border border-blue-100 font-bold">Due Date</th>
                  <th className="text-left p-3 border border-blue-100 font-bold">What It Contains</th>
                </tr>
              </thead>
              <tbody>
                {RETURNS.map(r => (
                  <tr key={r.name} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 font-bold text-blue-700">{r.name}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{r.who}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{r.due}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{r.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>How to File GSTR-3B Online (Step by Step)</h2>
          <ol className="list-decimal pl-6 mb-6 text-gray-700 space-y-3">
            <li>Login to <strong>GST Portal</strong> (gst.gov.in) using your GSTIN and password</li>
            <li>Go to <strong>Services → Returns → Returns Dashboard</strong></li>
            <li>Select the financial year and tax period, click <strong>Search</strong></li>
            <li>Click <strong>GSTR-3B</strong> → Prepare Online</li>
            <li>Fill in <strong>Table 3.1</strong>: Outward taxable supplies (from your sales)</li>
            <li>Fill in <strong>Table 4</strong>: Eligible ITC (Input Tax Credit from purchases)</li>
            <li>The system auto-calculates net tax payable</li>
            <li>Pay the tax using <strong>PMT-06</strong> (create challan, pay via net banking/UPI)</li>
            <li>Submit and then <strong>File</strong> using DSC or EVC</li>
          </ol>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>GST Late Fee and Penalty 2025</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-red-50">
                <th className="text-left p-3 border border-red-100 font-bold">Return</th>
                <th className="text-left p-3 border border-red-100 font-bold">Late Fee (with tax liability)</th>
                <th className="text-left p-3 border border-red-100 font-bold">Late Fee (nil return)</th>
                <th className="text-left p-3 border border-red-100 font-bold">Maximum Cap</th>
              </tr></thead>
              <tbody>
                {[
                  ["GSTR-3B", "₹50/day", "₹20/day", "₹10,000"],
                  ["GSTR-1", "₹50/day", "₹20/day", "₹10,000"],
                  ["GSTR-9", "₹200/day (₹100 CGST + ₹100 SGST)", "Same", "0.25% of turnover"],
                ].map(([r, lf, nil, max]) => (
                  <tr key={r as string} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 font-bold text-red-700">{r}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{lf}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{nil}</td>
                    <td className="p-3 border border-gray-100 font-semibold text-red-600">{max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-6" style={{ color: "#0F2044" }}>Frequently Asked Questions</h2>
          <div className="space-y-4 mb-10">
            {faqJsonLd.mainEntity.map(faq => (
              <details key={faq.name} className="border border-gray-200 rounded-xl p-4">
                <summary className="font-bold text-gray-900 cursor-pointer">{faq.name}</summary>
                <p className="mt-3 text-gray-700 text-sm leading-relaxed">{faq.acceptedAnswer.text}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-2xl border-2 border-blue-200 bg-blue-50">
            <h3 className="text-xl font-black mb-2" style={{ color: "#0F2044" }}>Let FreWork handle your GST filing</h3>
            <p className="text-gray-600 mb-4">Never miss a GST due date. FreWork files GSTR-1, GSTR-3B and GSTR-9 for your business every month. Expert professionals, transparent pricing.</p>
            <Link href="/services/compliance" className="inline-block font-bold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #2563EB, #1E40AF)" }}>
              Start GST Filing — ₹499/month →
            </Link>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
