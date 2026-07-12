import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Income Tax Return (ITR) Filing Online India — Starting ₹799 | FreWork",
  description:
    "Online income tax return (ITR) filing for individuals, salaried employees, freelancers, businesses and companies. ITR-1 to ITR-6. Expert CA filing from ₹799. TDS, advance tax, notice handling across India.",
  keywords: [
    "income tax return filing India",
    "ITR filing online India",
    "ITR filing",
    "income tax filing online",
    "ITR-1 filing",
    "ITR-2 filing",
    "ITR-3 filing",
    "salaried income tax return",
    "business income tax return India",
    "online CA for income tax",
    "income tax notice handling India",
    "TDS return filing India",
    "advance tax payment India",
    "income tax consultant online India",
    "tax planning India",
    "income tax refund India",
  ],
  openGraph: {
    title: "Income Tax Return (ITR) Filing Online India | FreWork",
    description: "Expert CA-assisted ITR filing for salaried, freelancers, businesses. ITR-1 to ITR-6. From ₹799. Fast, accurate, online.",
    url: "https://frework.online/services/income-tax",
  },
  alternates: { canonical: "https://frework.online/services/income-tax" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "name": "Income Tax Return (ITR) Filing",
      "provider": { "@type": "AccountingService", "name": "FreWork", "url": "https://frework.online" },
      "areaServed": { "@type": "Country", "name": "India" },
      "description": "Expert online income tax return filing for individuals, salaried employees, freelancers, and businesses across India.",
      "offers": [
        { "@type": "Offer", "name": "ITR Filing (Salaried/Individual)", "price": "799", "priceCurrency": "INR" },
        { "@type": "Offer", "name": "ITR Filing (Business/Profession)", "price": "2999", "priceCurrency": "INR" },
      ],
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "What is the last date to file income tax return in India?", "acceptedAnswer": { "@type": "Answer", "text": "The due date for filing ITR for individuals is July 31 of the assessment year. For businesses requiring audit, it is October 31. Late filing attracts penalty under Section 234F." } },
        { "@type": "Question", "name": "What documents are needed for ITR filing?", "acceptedAnswer": { "@type": "Answer", "text": "You need: PAN card, Form 16 (from employer), bank statements, investment proofs (80C, 80D), Form 26AS, and details of any other income (rent, capital gains, etc.)." } },
        { "@type": "Question", "name": "Can I file ITR online in India?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. FreWork's CAs file your ITR online on the income tax portal. You share your documents and we handle everything — calculation, filing, and sending you the acknowledgement." } },
        { "@type": "Question", "name": "What happens if I don't file ITR?", "acceptedAnswer": { "@type": "Answer", "text": "Not filing ITR can result in penalty up to ₹5,000, interest on tax due, loss of carry-forward of losses, and difficulty in loan or visa applications." } },
        { "@type": "Question", "name": "How long does income tax refund take?", "acceptedAnswer": { "@type": "Answer", "text": "Income tax refunds are typically credited within 30–45 days of filing if the return is e-verified and there are no discrepancies." } },
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
          title="Income Tax Return Filing"
          subtitle="File right. Save more. Get refunds faster."
          description="Expert income tax return filing for salaried individuals, freelancers, businesses and companies. We also handle TDS returns, advance tax, assessments, notices and tax planning."
          features={[
            "ITR-1 to ITR-6 for all categories",
            "Salaried, freelancer & business returns",
            "TDS return filing (24Q, 26Q quarterly)",
            "Advance tax computation & challan",
            "Form 15CA/CB for foreign remittances",
            "Income tax notice & assessment handling",
            "Tax planning & deduction optimisation",
            "Capital gains computation (equity, property)",
          ]}
          price="₹799"
          priceNote="Per return (individual). Businesses from ₹2,999."
          color="green"
        />
      </PageLayout>
    </>
  );
}
