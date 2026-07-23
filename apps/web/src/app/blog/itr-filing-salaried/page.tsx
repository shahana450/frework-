import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ITR Filing for Salaried Employees India 2025 — Complete Guide | FreWork",
  description:
    "Complete guide to ITR filing for salaried employees in India 2025. Which ITR form to use, documents needed, how to file online, last date and tax saving tips. File from ₹499.",
  keywords: [
    "ITR filing for salaried employees India 2025",
    "income tax return salaried person",
    "ITR-1 filing online",
    "which ITR form for salaried employee",
    "ITR filing last date 2025",
    "how to file income tax return online India",
    "documents required for ITR filing",
    "tax saving for salaried employees India",
    "80C deductions salaried",
    "HRA exemption ITR",
    "FreWork ITR filing",
  ],
  openGraph: {
    title: "ITR Filing for Salaried Employees India 2025 — Complete Guide",
    description: "Which ITR form, documents needed, how to file online, last date 2025 and tax saving tips for salaried employees.",
    url: "https://frework.online/blog/itr-filing-salaried",
    type: "article",
  },
  alternates: { canonical: "https://frework.online/blog/itr-filing-salaried" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "ITR Filing for Salaried Employees India 2025 — Complete Guide",
  "description": "Which ITR form to use, documents needed, how to file online, last date and tax savings for salaried employees.",
  "author": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "publisher": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "datePublished": "2025-07-01",
  "dateModified": "2025-07-23",
  "mainEntityOfPage": "https://frework.online/blog/itr-filing-salaried",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Which ITR form should a salaried employee file?", "acceptedAnswer": { "@type": "Answer", "text": "Most salaried employees should file ITR-1 (Sahaj) if their total income is up to ₹50 lakh and income is from salary, one house property and other sources. If you have capital gains or more than one house property, file ITR-2." } },
    { "@type": "Question", "name": "What is the last date to file ITR for salaried employees in 2025?", "acceptedAnswer": { "@type": "Answer", "text": "The last date to file ITR for salaried employees (AY 2025-26) without penalty is 31st July 2025. After that, you can file a belated return up to 31st December 2025 with a late fee of ₹5,000 (₹1,000 if income is below ₹5 lakh)." } },
    { "@type": "Question", "name": "Is it mandatory to file ITR if my employer deducts TDS?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, ITR filing is mandatory if your gross income exceeds ₹2.5 lakh (₹3 lakh for 60+ years, ₹5 lakh for 80+ years), even if your employer deducts TDS. Filing ITR is also required to claim a TDS refund, apply for a visa or get a bank loan." } },
    { "@type": "Question", "name": "What documents are needed to file ITR for salaried employees?", "acceptedAnswer": { "@type": "Answer", "text": "You need: Form 16 from employer, Form 26AS (tax credit statement), AIS (Annual Information Statement), bank account statements, investment proofs for 80C/80D deductions, home loan certificate (if applicable), and rent receipts for HRA claim." } },
  ]
};

const DEDUCTIONS = [
  { section: "80C", limit: "₹1,50,000", items: "PPF, ELSS, LIC premium, EPF, NSC, home loan principal, tuition fees, 5-year FD" },
  { section: "80D", limit: "₹25,000 (₹50,000 for senior citizens)", items: "Health insurance premium for self, spouse, children and parents" },
  { section: "80E", limit: "No limit", items: "Interest on education loan (for 8 years)" },
  { section: "24(b)", limit: "₹2,00,000", items: "Home loan interest on self-occupied property" },
  { section: "80TTA", limit: "₹10,000", items: "Interest on savings bank account" },
  { section: "HRA", limit: "Actual HRA / 40-50% of salary / Rent paid minus 10% salary", items: "House Rent Allowance exemption (whichever is lowest)" },
  { section: "Standard Deduction", limit: "₹75,000", items: "Flat deduction for all salaried employees (no proof required)" },
];

export default function ITRFilingSalariedPage() {
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
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Income Tax</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">AY 2025-26</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight" style={{ color: "#0F2044" }}>
              ITR Filing for Salaried Employees India 2025 — Complete Guide
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Which ITR form to use, documents you need, step-by-step online filing, last date and how to save maximum tax.
              Everything a salaried employee needs to know about income tax return filing.
            </p>
          </header>

          <div className="p-5 rounded-2xl border border-green-200 bg-green-50 mb-10">
            <p className="font-bold text-green-900 mb-1">Key Dates — AY 2025-26</p>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Last date without penalty: <strong>31st July 2025</strong></li>
              <li>• Belated return deadline: 31st December 2025</li>
              <li>• Late fee: ₹5,000 (₹1,000 if income below ₹5 lakh)</li>
              <li>• Standard deduction: ₹75,000 (new tax regime)</li>
            </ul>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>Which ITR Form Should Salaried Employees Use?</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-blue-50">
                <th className="text-left p-3 border border-blue-100 font-bold">ITR Form</th>
                <th className="text-left p-3 border border-blue-100 font-bold">Who Should Use It</th>
              </tr></thead>
              <tbody>
                {[
                  ["ITR-1 (Sahaj)", "Salaried employees with income up to ₹50 lakh from salary + 1 house property + other sources (FD interest, etc.). No capital gains."],
                  ["ITR-2", "Salaried employees with capital gains (stocks, mutual funds, property), more than 1 house property, or income from foreign assets."],
                  ["ITR-3", "Salaried employees who also have business/professional income or are partners in a firm."],
                  ["ITR-4 (Sugam)", "Salaried + presumptive business income (44AD/44ADA) up to ₹50 lakh total."],
                ].map(([f, w]) => (
                  <tr key={f as string} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 font-bold text-blue-700">{f}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{w}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>Documents Required for ITR Filing</h2>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li><strong>Form 16</strong> — Provided by your employer. Contains salary details and TDS deducted.</li>
            <li><strong>Form 26AS</strong> — Tax credit statement. Download from income tax portal.</li>
            <li><strong>AIS (Annual Information Statement)</strong> — Shows all financial transactions. Download from IT portal.</li>
            <li><strong>Bank statements</strong> — For interest income and to verify transactions in AIS.</li>
            <li><strong>Investment proofs</strong> — PPF passbook, ELSS statements, LIC premium receipts (for 80C).</li>
            <li><strong>Health insurance premium receipt</strong> — For 80D deduction.</li>
            <li><strong>Home loan certificate</strong> — From bank, showing interest and principal breakup (if applicable).</li>
            <li><strong>Rent receipts + landlord PAN</strong> — For HRA exemption (if rent paid &gt; ₹1 lakh/year).</li>
          </ul>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>How to File ITR Online (Step by Step)</h2>
          <ol className="list-decimal pl-6 mb-6 text-gray-700 space-y-3">
            <li>Go to <strong>incometax.gov.in</strong> and login with PAN and password</li>
            <li>Go to <strong>e-File → Income Tax Returns → File Income Tax Return</strong></li>
            <li>Select <strong>Assessment Year 2025-26</strong>, Mode: Online, Status: Individual</li>
            <li>Select the correct ITR form (ITR-1 for most salaried employees)</li>
            <li>Most salary and TDS data will be <strong>pre-filled</strong> from Form 26AS — verify it</li>
            <li>Add any additional income (FD interest, rental income, capital gains)</li>
            <li>Claim all eligible deductions under 80C, 80D, HRA, etc.</li>
            <li>Compare <strong>old vs new tax regime</strong> — the portal shows both</li>
            <li>Review the computed tax. If tax payable, pay via Challan 280</li>
            <li>Submit and verify using <strong>Aadhaar OTP, net banking, or DSC</strong></li>
          </ol>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#0F2044" }}>Tax Saving Deductions for Salaried Employees</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-green-50">
                <th className="text-left p-3 border border-green-100 font-bold">Section</th>
                <th className="text-left p-3 border border-green-100 font-bold">Deduction Limit</th>
                <th className="text-left p-3 border border-green-100 font-bold">What Qualifies</th>
              </tr></thead>
              <tbody>
                {DEDUCTIONS.map(d => (
                  <tr key={d.section} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 font-bold text-green-700">{d.section}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{d.limit}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{d.items}</td>
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

          <div className="mt-12 p-6 rounded-2xl border-2 border-green-200 bg-green-50">
            <h3 className="text-xl font-black mb-2" style={{ color: "#0F2044" }}>File your ITR with expert help</h3>
            <p className="text-gray-600 mb-4">FreWork&apos;s expert tax professionals file your ITR accurately and on time. ITR-1 for salaried employees from ₹499. We handle Form 16 review, deduction optimization and e-verification.</p>
            <Link href="/services/compliance" className="inline-block font-bold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #059669, #065F46)" }}>
              File My ITR — ₹499 →
            </Link>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
