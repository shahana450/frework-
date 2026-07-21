import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Company Registration Online India — Pvt Ltd, LLP, OPC | FreWork",
  description:
    "Online company registration in India — Private Limited, LLP, OPC, Sole Proprietorship, Partnership. Expert Professional filing. GST & MSME registration included. Starting ₹1,499. Nationwide service.",
  keywords: [
    "company registration India",
    "private limited company registration India",
    "LLP registration India",
    "OPC registration India",
    "sole proprietorship registration India",
    "online company registration India",
    "startup registration India",
    "how to register a company in India",
    "MSME registration India",
    "Udyam registration India",
    "business registration India",
    "incorporate company India",
  ],
  openGraph: {
    title: "Company Registration Online India — Pvt Ltd, LLP, OPC | FreWork",
    description: "Register your company online in India. Private Limited, LLP, OPC. professional assisted. GST included. From ₹1,499.",
    url: "https://frework.online/services/business-registration",
  },
  alternates: { canonical: "https://frework.online/services/business-registration" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "name": "Company Registration India",
      "provider": { "@type": "AccountingService", "name": "FreWork", "url": "https://frework.online" },
      "areaServed": { "@type": "Country", "name": "India" },
      "description": "Online company registration services — Private Limited, LLP, OPC, Sole Proprietorship and Partnership in India.",
      "offers": [{ "@type": "Offer", "name": "Company Registration", "price": "1499", "priceCurrency": "INR" }],
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How to register a Private Limited company in India?", "acceptedAnswer": { "@type": "Answer", "text": "To register a Pvt Ltd company in India: obtain DSC and DIN for directors, reserve a company name on MCA, file SPICe+ form with MOA and AOA, and get Certificate of Incorporation. FreWork handles all of this in 7–10 working days." } },
        { "@type": "Question", "name": "What is the minimum capital required to register a company in India?", "acceptedAnswer": { "@type": "Answer", "text": "There is no minimum paid-up capital requirement for a Private Limited company in India. You can start with ₹1 as share capital." } },
        { "@type": "Question", "name": "How long does company registration take in India?", "acceptedAnswer": { "@type": "Answer", "text": "Company registration through FreWork typically takes 7–10 working days after document submission, subject to MCA processing time." } },
        { "@type": "Question", "name": "What documents are required for company registration in India?", "acceptedAnswer": { "@type": "Answer", "text": "Required documents: PAN and Aadhaar of all directors, passport-size photos, address proof (bank statement or utility bill), and registered office address proof (rent agreement + NOC from owner)." } },
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
          title="Company Registration"
          subtitle="Start legal. Start fast."
          description="Register your company online in India — Private Limited, LLP, OPC, Sole Proprietorship or Partnership. professional-assisted filing with GST and MSME registration included."
          features={[
            "Private Limited Company registration",
            "LLP (Limited Liability Partnership)",
            "One Person Company (OPC)",
            "Sole Proprietorship registration",
            "Partnership firm registration",
            "GST registration included",
            "MSME / Udyam certificate",
            "PAN, TAN & bank account setup guidance",
          ]}
          price="₹1,499"
          priceNote="All-inclusive. No hidden charges."
          color="purple"
        />
      </PageLayout>
    </>
  );
}
