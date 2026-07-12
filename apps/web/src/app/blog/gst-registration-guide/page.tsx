import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Registration in India 2025: Complete Step-by-Step Guide | FreWork",
  description:
    "Complete guide to GST registration in India 2025. Who needs GST registration, documents required, how to apply online, fees, GSTIN process and timeline. Get expert CA help from ₹499.",
  keywords: [
    "how to register for GST in India",
    "GST registration process India",
    "GST registration documents required",
    "who needs GST registration India",
    "GST registration online step by step",
    "GST registration fee India 2025",
    "GSTIN number India",
    "GST registration eligibility India",
    "GST threshold limit India",
    "GST registration for small business India",
  ],
  openGraph: {
    title: "GST Registration in India 2025: Complete Step-by-Step Guide",
    description: "Learn who needs GST, documents required, online process, fees and timeline. Expert CA help from ₹499.",
    url: "https://frework.online/blog/gst-registration-guide",
    type: "article",
  },
  alternates: { canonical: "https://frework.online/blog/gst-registration-guide" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "GST Registration in India 2025: Complete Step-by-Step Guide",
  "description": "Complete guide to GST registration in India — who needs it, documents, process, fees and timeline.",
  "author": { "@type": "Organization", "name": "FreWork" },
  "publisher": { "@type": "Organization", "name": "FreWork", "url": "https://frework.online" },
  "datePublished": "2025-07-01",
  "dateModified": "2025-07-12",
  "mainEntityOfPage": "https://frework.online/blog/gst-registration-guide",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Who needs to register for GST in India?", "acceptedAnswer": { "@type": "Answer", "text": "Any business with annual turnover above ₹40 lakhs (goods) or ₹20 lakhs (services) must register for GST. E-commerce sellers, inter-state suppliers, and reverse charge recipients must register regardless of turnover." } },
    { "@type": "Question", "name": "What documents are required for GST registration?", "acceptedAnswer": { "@type": "Answer", "text": "Documents needed: PAN card, Aadhaar card, business address proof, bank account details, photograph, and for companies — MOA/AOA and Certificate of Incorporation." } },
    { "@type": "Question", "name": "How long does GST registration take?", "acceptedAnswer": { "@type": "Answer", "text": "GST registration is typically completed in 3–7 working days after successful document submission on the GST portal." } },
    { "@type": "Question", "name": "Is GST registration free?", "acceptedAnswer": { "@type": "Answer", "text": "Government GST registration has no government fee. However, professional CA assistance typically costs ₹499 to ₹2,000 depending on the service provider." } },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageLayout>
        <article className="max-w-3xl mx-auto px-4 py-16">
          {/* Breadcrumb */}
          <nav className="text-sm mb-8 text-gray-500">
            <Link href="/" className="hover:text-amber-600">Home</Link> &rsaquo;{" "}
            <Link href="/blog" className="hover:text-amber-600">Blog</Link> &rsaquo;{" "}
            <span>GST Registration Guide</span>
          </nav>

          <div className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full mb-4">GST · Tax & Compliance</div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4" style={{ color: "#1A1208" }}>
            GST Registration in India 2025: Complete Step-by-Step Guide
          </h1>
          <p className="text-gray-500 text-sm mb-8">By FreWork CA Team · Updated July 2025 · 8 min read</p>

          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            GST (Goods and Services Tax) registration is mandatory for every business in India that crosses the turnover threshold. This complete guide covers who needs to register, what documents are required, the exact online process, timeline, and costs — so you can get your GSTIN without confusion.
          </p>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Who Needs GST Registration in India?</h2>
          <p className="text-gray-700 mb-4 leading-relaxed">GST registration is mandatory if your annual turnover exceeds:</p>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li><strong>₹40 lakhs</strong> — for businesses dealing in goods (₹20 lakhs for special category states)</li>
            <li><strong>₹20 lakhs</strong> — for service providers (₹10 lakhs for special category states)</li>
          </ul>
          <p className="text-gray-700 mb-6 leading-relaxed">
            Regardless of turnover, you <em>must</em> register if you: sell on e-commerce platforms (Amazon, Flipkart), make inter-state supplies, are liable to pay tax under reverse charge, or are a non-resident taxable person.
          </p>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>Documents Required for GST Registration</h2>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li>PAN card of the business / proprietor / directors</li>
            <li>Aadhaar card of the authorized signatory</li>
            <li>Business address proof (electricity bill, rent agreement)</li>
            <li>Bank account details (cancelled cheque / bank statement)</li>
            <li>Photograph of the proprietor / directors</li>
            <li>For companies: MOA, AOA, Certificate of Incorporation</li>
            <li>For LLP: LLP agreement and certificate</li>
          </ul>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>GST Registration Process Online — Step by Step</h2>
          <ol className="list-decimal pl-6 mb-6 text-gray-700 space-y-3">
            <li>Visit <strong>gst.gov.in</strong> → New Registration</li>
            <li>Enter PAN, email, mobile number → OTP verification</li>
            <li>Fill Part A of the form → get Temporary Reference Number (TRN)</li>
            <li>Login with TRN → fill Part B (business details, address, bank, HSN codes)</li>
            <li>Upload required documents</li>
            <li>Submit application → Application Reference Number (ARN) generated</li>
            <li>GST officer reviews → may issue notice for clarification</li>
            <li>GSTIN issued within <strong>3–7 working days</strong></li>
          </ol>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>GST Registration Fee in India</h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            The Government does not charge any fee for GST registration. However, most businesses use a CA or tax consultant to avoid errors, which typically costs <strong>₹499 to ₹2,000</strong> depending on the business type and complexity.
          </p>
          <p className="text-gray-700 mb-8 leading-relaxed">
            <Link href="/services/gst" className="text-amber-600 font-bold hover:underline">FreWork offers CA-assisted GST registration from ₹499</Link> — including document review, portal filing, and follow-up with the GST officer.
          </p>

          <h2 className="text-2xl font-black mt-10 mb-4" style={{ color: "#1A1208" }}>After GST Registration — What's Next?</h2>
          <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
            <li>Display your GSTIN on invoices and business premises</li>
            <li>File <strong>GSTR-1</strong> (outward supplies) monthly or quarterly</li>
            <li>File <strong>GSTR-3B</strong> (summary return + tax payment) monthly</li>
            <li>File <strong>GSTR-9</strong> (annual return) once a year</li>
            <li>Maintain records of all purchases, sales, and input tax credits</li>
          </ul>

          {/* CTA */}
          <div className="mt-12 p-6 rounded-2xl border-2 border-amber-200 bg-amber-50">
            <h3 className="text-xl font-black mb-2" style={{ color: "#1A1208" }}>Need help with GST registration?</h3>
            <p className="text-gray-600 mb-4">Our CA experts handle your GST registration end-to-end — documents, portal filing, and GSTIN delivery in 3–5 days.</p>
            <Link href="/services/gst" className="inline-block bg-amber-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-700 transition-colors">
              Get GST Registration — ₹499 →
            </Link>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
