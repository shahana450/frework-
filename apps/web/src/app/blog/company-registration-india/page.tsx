import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Register a Company in India 2025 — Pvt Ltd, LLP, OPC Guide | FreWork",
  description:
    "Complete guide to company registration in India 2025. How to register Private Limited company, LLP, OPC or Sole Proprietorship online. Documents, process, fees, timeline and CA help from ₹1,499.",
  keywords: [
    "how to register a company in India",
    "company registration process India 2025",
    "private limited company registration India",
    "LLP registration India",
    "OPC registration India",
    "company registration documents India",
    "company registration fee India",
    "MCA SPICe+ registration",
    "start a business India",
    "incorporate company India online",
    "startup registration India",
    "business registration process India",
  ],
  openGraph: {
    title: "How to Register a Company in India 2025 | FreWork",
    description: "Complete guide — Pvt Ltd, LLP, OPC registration process, documents, fees and timeline. CA help from ₹1,499.",
    url: "https://frework.online/blog/company-registration-india",
    type: "article",
  },
  alternates: { canonical: "https://frework.online/blog/company-registration-india" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Register a Company in India 2025 — Pvt Ltd, LLP, OPC Guide",
  "author": { "@type": "Organization", "name": "FreWork" },
  "publisher": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "datePublished": "2025-07-01",
  "dateModified": "2025-07-12",
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageLayout>
        <article className="max-w-3xl mx-auto px-4 py-16">
          <nav className="text-sm mb-8 text-gray-500">
            <Link href="/" className="hover:text-amber-600">Home</Link> &rsaquo;{" "}
            <Link href="/blog" className="hover:text-amber-600">Blog</Link> &rsaquo;{" "}
            <span>Company Registration India</span>
          </nav>

          <div className="inline-block bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1 rounded-full mb-4">Business Setup · Registration</div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4" style={{ color: "#1A1208" }}>
            How to Register a Company in India 2025 — Complete Guide
          </h1>
          <p className="text-gray-500 text-sm mb-8">By FreWork CS/CA Team · Updated July 2025 · 9 min read</p>

          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Starting a business in India requires choosing the right legal structure and completing the registration process. This guide covers every type — Private Limited, LLP, OPC, and Sole Proprietorship — with step-by-step process, documents, fees, and timelines.
          </p>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Which Business Structure Should You Choose?</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-amber-50">
                <th className="text-left p-3 border border-amber-100 font-bold">Structure</th>
                <th className="text-left p-3 border border-amber-100 font-bold">Best For</th>
                <th className="text-left p-3 border border-amber-100 font-bold">Liability</th>
              </tr></thead>
              <tbody>
                {[
                  ["Private Limited (Pvt Ltd)", "Startups, investor-funded businesses", "Limited"],
                  ["LLP", "Professional firms, service businesses", "Limited"],
                  ["OPC", "Solo founders / freelancers going formal", "Limited"],
                  ["Sole Proprietorship", "Small traders, individual consultants", "Unlimited"],
                  ["Partnership", "Family/traditional businesses", "Unlimited"],
                ].map(([s, b, l]) => (
                  <tr key={s as string} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 font-semibold text-purple-700">{s}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{b}</td>
                    <td className="p-3 border border-gray-100 text-gray-700">{l}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>How to Register a Private Limited Company in India</h2>
          <ol className="list-decimal pl-6 mb-6 text-gray-700 space-y-3">
            <li>Obtain <strong>Digital Signature Certificate (DSC)</strong> for all proposed directors</li>
            <li>Apply for <strong>Director Identification Number (DIN)</strong> via MCA portal</li>
            <li>Reserve company name using <strong>RUN (Reserve Unique Name)</strong> on MCA</li>
            <li>Draft <strong>MOA (Memorandum of Association)</strong> and <strong>AOA (Articles of Association)</strong></li>
            <li>File <strong>SPICe+ Form</strong> on MCA — integrates company registration + PAN + TAN + bank account</li>
            <li>Pay <strong>stamp duty and MCA fees</strong> (varies by state and authorized capital)</li>
            <li>Receive <strong>Certificate of Incorporation (COI)</strong> — this is your company's birth certificate</li>
            <li>Open a current bank account in the company name</li>
            <li>Apply for <strong>GST registration</strong> (if applicable)</li>
          </ol>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Documents Required for Company Registration</h2>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li>PAN card of all proposed directors</li>
            <li>Aadhaar card or passport of all directors</li>
            <li>Passport-size photograph of all directors</li>
            <li>Mobile number and email ID (for DSC and DIN)</li>
            <li>Registered office address proof: electricity bill or rent agreement + NOC from owner</li>
            <li>For foreign nationals: passport + apostille</li>
          </ul>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Company Registration Fee in India 2025</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-amber-50">
                <th className="text-left p-3 border border-amber-100 font-bold">Component</th>
                <th className="text-left p-3 border border-amber-100 font-bold">Approx. Cost</th>
              </tr></thead>
              <tbody>
                {[
                  ["DSC (per director)", "₹800 – ₹1,500"],
                  ["DIN (now part of SPICe+)", "Included"],
                  ["MCA filing fees", "₹0 for ≤₹10L capital"],
                  ["State stamp duty", "₹200 – ₹2,000"],
                  ["Professional / CA fee", "₹1,499 – ₹5,000"],
                ].map(([c, f]) => (
                  <tr key={c as string} className="border-b border-gray-100">
                    <td className="p-3 border border-gray-100 text-gray-700">{c}</td>
                    <td className="p-3 border border-gray-100 font-semibold text-amber-700">{f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Timeline for Company Registration</h2>
          <p className="text-gray-700 mb-4">With complete documents, a Pvt Ltd company can be incorporated in <strong>7–10 working days</strong>. LLPs take 5–7 days. Delays usually happen due to name rejection or document defects.</p>

          <div className="mt-12 p-6 rounded-2xl border-2 border-purple-200 bg-purple-50">
            <h3 className="text-xl font-black mb-2" style={{ color: "#1A1208" }}>Register your company with CA/CS experts</h3>
            <p className="text-gray-600 mb-4">FreWork handles the entire company registration process — DSC, name reservation, SPICe+ filing, COI, GST and MSME. All-inclusive from ₹1,499.</p>
            <Link href="/services/business-registration" className="inline-block bg-purple-700 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-800 transition-colors">
              Register Your Company — ₹1,499 →
            </Link>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
