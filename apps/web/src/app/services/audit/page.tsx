import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statutory Audit, Tax Audit & Internal Audit Services India | FreWork",
  description:
    "Statutory audit under Companies Act, tax audit under Section 44AB, internal audit, GST audit and stock audit services by qualified Chartered Accountants across India. Get audit reports on time.",
  keywords: [
    "statutory audit India",
    "tax audit India",
    "tax audit 44AB",
    "internal audit services India",
    "GST audit India",
    "stock audit India",
    "CA audit services India",
    "company audit India",
    "audit firm India",
    "chartered accountant audit India",
    "audit report India",
    "concurrent audit India",
  ],
  openGraph: {
    title: "Statutory, Tax & Internal Audit Services India | FreWork",
    description: "Qualified CA audit services — statutory, tax (44AB), internal, GST and stock audit across India. Timely and accurate reports.",
    url: "https://frework.online/services/audit",
  },
  alternates: { canonical: "https://frework.online/services/audit" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Audit & Assurance Services",
  "provider": { "@type": "AccountingService", "name": "FreWork", "url": "https://frework.online" },
  "areaServed": { "@type": "Country", "name": "India" },
  "description": "Statutory audit, tax audit (44AB), internal audit, GST audit and stock audit by qualified Chartered Accountants across India.",
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageLayout>
        <ServicePage
          title="Audit & Assurance"
          subtitle="Credibility your business can stand on"
          description="Statutory, tax, internal and GST audits by qualified Chartered Accountants. We ensure your audit reports are accurate, compliant and delivered on time — every time."
          features={[
            "Statutory audit (Companies Act 2013)",
            "Tax audit under Section 44AB",
            "Internal audit & process review",
            "GST audit & reconciliation",
            "Stock / inventory audit",
            "Concurrent audit for banks & NBFCs",
            "Transfer pricing documentation",
            "Audit report & management letter",
          ]}
          price="₹4,999"
          priceNote="Starting price. Depends on business size."
          color="purple"
        />
      </PageLayout>
    </>
  );
}
