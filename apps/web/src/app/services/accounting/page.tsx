import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Accounting & Bookkeeping Services India — ₹1,499/mo | FreWork",
  description:
    "Monthly bookkeeping, accounting, payroll, invoicing and MIS reports for Indian businesses. Virtual accountant service by qualified CAs. Works with Tally, Zoho Books, QuickBooks. Starting ₹1,499/month.",
  keywords: [
    "online accounting services India",
    "bookkeeping services India",
    "virtual accountant India",
    "monthly bookkeeping India",
    "accounting services for small business India",
    "payroll services India",
    "online accountant India",
    "Tally accounting services India",
    "Zoho Books accountant India",
    "MIS reports India",
    "P&L statement India",
    "balance sheet preparation India",
    "accounts outsourcing India",
    "GST accounting India",
    "CA for small business India",
  ],
  openGraph: {
    title: "Online Accounting & Bookkeeping Services India | FreWork",
    description: "Virtual accountant for bookkeeping, payroll, invoicing and MIS. Expert CAs. Tally, Zoho, QuickBooks. From ₹1,499/month.",
    url: "https://frework.online/services/accounting",
  },
  alternates: { canonical: "https://frework.online/services/accounting" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "name": "Online Accounting & Bookkeeping",
      "provider": { "@type": "AccountingService", "name": "FreWork", "url": "https://frework.online" },
      "areaServed": { "@type": "Country", "name": "India" },
      "description": "Monthly bookkeeping, accounting, payroll and MIS reporting services for Indian businesses by qualified CAs.",
      "offers": [{ "@type": "Offer", "name": "Monthly Accounting Package", "price": "1499", "priceCurrency": "INR" }],
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "What is a virtual accountant?", "acceptedAnswer": { "@type": "Answer", "text": "A virtual accountant is a qualified CA or accountant who manages your bookkeeping, GST, payroll and financial reporting remotely — without you needing to hire a full-time in-house accountant." } },
        { "@type": "Question", "name": "What accounting software does FreWork use?", "acceptedAnswer": { "@type": "Answer", "text": "FreWork works with Tally Prime, Zoho Books, QuickBooks, and other cloud-based accounting platforms. We adapt to your existing software or recommend the best one for your business size." } },
        { "@type": "Question", "name": "How much does accounting outsourcing cost in India?", "acceptedAnswer": { "@type": "Answer", "text": "FreWork's monthly accounting package starts at ₹1,499/month for small businesses, covering bookkeeping, bank reconciliation, GST entries and monthly P&L. Volume discounts for larger businesses." } },
        { "@type": "Question", "name": "Does FreWork handle payroll processing?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. FreWork handles complete payroll processing including salary computation, PF/ESI deductions, payslip generation, and monthly payroll filings." } },
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
          title="Accounting & Bookkeeping"
          subtitle="Clean books, clear decisions"
          description="Monthly bookkeeping, financial statements and MIS reports that give you a real-time picture of your business. Dedicated virtual accountant by qualified CAs. Works with Tally, Zoho Books and QuickBooks."
          features={[
            "Monthly bookkeeping & ledger maintenance",
            "Profit & loss statement",
            "Balance sheet preparation",
            "Bank reconciliation",
            "MIS reports & dashboards",
            "Accounts payable & receivable management",
            "Payroll processing (PF, ESI, payslips)",
            "GST-ready invoicing & expense tracking",
          ]}
          price="₹1,499"
          priceNote="Per month. Volume discounts available."
          color="orange"
          isPaid
        />
      </PageLayout>
    </>
  );
}
