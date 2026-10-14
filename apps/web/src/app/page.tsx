import { BusinessOSHomepage } from "@/components/landing/business-os-homepage";
import { TaxNewsSection } from "@/components/landing/tax-news-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "FreWork — GST, ITR & AI Bookkeeping (FreBook) | Business Platform India" },
  description:
    "FreWork: India's all-in-one business platform. GST registration, ITR filing, company registration, FreBook AI accountant with Tally, coworking spaces and expert professionals — all online.",
  keywords: [
    "FreWork",
    "frework.online",
    "FreWork India",
    "GST registration India",
    "GST filing online",
    "income tax filing India",
    "ITR filing online",
    "business services online India",
    "company registration India",
    "accounting services India",
    "virtual accountant India",
    "AI accountant India",
    "AI bookkeeping software",
    "Tally AI",
    "FreBook",
    "coworking space India",
    "freelance professionals India",
  ],
  alternates: { canonical: "https://frework.online" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How to register for GST online in India?",
      "acceptedAnswer": { "@type": "Answer", "text": "You can register for GST online through FreWork. Our CA experts handle the entire GST registration process — from document collection to GSTIN issuance — in 3–5 working days." }
    },
    {
      "@type": "Question",
      "name": "How to file income tax return (ITR) online in India?",
      "acceptedAnswer": { "@type": "Answer", "text": "FreWork's qualified CAs file your income tax return (ITR) online. We handle ITR-1 to ITR-6 for individuals, salaried employees, and businesses. Share your documents and we'll do the rest." }
    },
    {
      "@type": "Question",
      "name": "What is the cost of GST registration in India?",
      "acceptedAnswer": { "@type": "Answer", "text": "FreWork's CAs handle GST registration end to end. The current price is shown on the GST registration service page before you order." }
    },
    {
      "@type": "Question",
      "name": "Can I get a virtual accountant for my business in India?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. FreWork provides dedicated virtual accountants for bookkeeping, invoicing, payroll, GST filing, and monthly financial reports — all online." }
    },
    {
      "@type": "Question",
      "name": "How to register a company in India online?",
      "acceptedAnswer": { "@type": "Answer", "text": "FreWork helps you register a Private Limited company, LLP, OPC, or Sole Proprietorship online in India. The process takes 7–10 working days with our expert guidance." }
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <BusinessOSHomepage />
      <TaxNewsSection />
    </>
  );
}
