import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ROC Compliance | FreWork", description: "Annual ROC filings, director KYC, board resolutions and MCA compliance for companies and LLPs." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="ROC Compliance"
        subtitle="Never miss an MCA deadline"
        description="Stay compliant with the Ministry of Corporate Affairs. We handle all annual filings, event-based forms, director KYC and board resolutions for your company or LLP."
        features={["Annual return filing (MGT-7/MGT-7A)","Financial statement filing (AOC-4)","Director KYC (DIR-3 KYC)","Board & general meeting resolutions","Change in directors, share capital","LLP annual filing (Form 11 & Form 8)"]}
        price="₹2,999"
        priceNote="Annual package. All filings covered."
        color="pink"
      />
    </PageLayout>
  );
}
