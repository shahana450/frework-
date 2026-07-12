import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Registration & Filing Online India — Starting ₹499 | FreWork",
  description:
    "Online GST registration and GST return filing (GSTR-1, GSTR-3B, GSTR-9) by expert CAs across India. Get your GSTIN in 3–5 days. Monthly GST filing from ₹999. Trusted by 500+ businesses.",
  keywords: [
    "GST registration online India",
    "GST registration",
    "online GST registration",
    "GST number registration India",
    "GSTIN registration",
    "GST filing online India",
    "GSTR-1 filing",
    "GSTR-3B filing",
    "GST return filing",
    "GST consultant India",
    "GST registration fee India",
    "GST registration documents required",
    "monthly GST filing",
    "GST annual return GSTR-9",
    "GST audit",
  ],
  openGraph: {
    title: "GST Registration & Filing Online India | FreWork",
    description: "Expert CA-assisted GST registration in 3–5 days. Monthly GSTR-1, GSTR-3B filing from ₹999. 500+ businesses trust FreWork.",
    url: "https://frework.online/services/gst",
  },
  alternates: { canonical: "https://frework.online/services/gst" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "name": "GST Registration & Filing",
      "provider": { "@type": "AccountingService", "name": "FreWork", "url": "https://frework.online" },
      "areaServed": { "@type": "Country", "name": "India" },
      "description": "Online GST registration and GST return filing services by qualified Chartered Accountants across India.",
      "offers": [
        { "@type": "Offer", "name": "GST Registration", "price": "499", "priceCurrency": "INR" },
        { "@type": "Offer", "name": "Monthly GST Filing", "price": "999", "priceCurrency": "INR" },
      ],
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "What documents are required for GST registration in India?", "acceptedAnswer": { "@type": "Answer", "text": "You need: PAN card, Aadhaar card, business address proof, bank account details, and a photograph of the proprietor/director. For companies, MOA/AOA is also required." } },
        { "@type": "Question", "name": "How long does GST registration take?", "acceptedAnswer": { "@type": "Answer", "text": "GST registration through FreWork is completed in 3–5 working days after document submission. In some states it may take up to 7 days." } },
        { "@type": "Question", "name": "What is the GST registration fee?", "acceptedAnswer": { "@type": "Answer", "text": "Government GST registration is free. FreWork charges a service fee starting ₹499 for CA-assisted filing and follow-up." } },
        { "@type": "Question", "name": "Who needs to register for GST?", "acceptedAnswer": { "@type": "Answer", "text": "Any business with annual turnover above ₹40 lakhs (goods) or ₹20 lakhs (services) must register. E-commerce sellers and inter-state suppliers must register regardless of turnover." } },
        { "@type": "Question", "name": "What is GSTR-1 and GSTR-3B?", "acceptedAnswer": { "@type": "Answer", "text": "GSTR-1 is the monthly/quarterly return of outward supplies (sales). GSTR-3B is the monthly summary return where you pay GST liability. Both must be filed to stay GST compliant." } },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageLayout>
        <ServicePage
          title="GST Registration & Filing"
          subtitle="Stay compliant, avoid penalties"
          description="From GST registration to monthly GSTR-1 & GSTR-3B filing, annual GSTR-9 returns and GST audit — we manage it all so you can focus on your business. Expert CA support across India."
          features={[
            "GST registration — GSTIN in 3–5 days",
            "Monthly GSTR-1 & GSTR-3B filing",
            "Quarterly returns for small businesses",
            "GSTR-9 & GSTR-9C annual returns",
            "GST audit & reconciliation",
            "Notice handling & departmental queries",
            "Composition scheme registration",
            "GST cancellation & amendments",
          ]}
          price="₹499"
          priceNote="Registration. Monthly filing from ₹999."
          color="blue"
        />
      </PageLayout>
    </>
  );
}
