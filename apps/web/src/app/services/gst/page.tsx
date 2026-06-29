import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "GST Services | FreWork", description: "GST registration, monthly filing, annual returns and audit. Expert CA support for all GST compliance needs." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="GST Services"
        subtitle="Stay compliant, avoid penalties"
        description="From GST registration to monthly GSTR-1 & GSTR-3B filing, annual GSTR-9 returns and GST audit — we manage it all so you can focus on your business."
        features={["GST registration (regular & composition)","Monthly GSTR-1 & GSTR-3B filing","Quarterly returns for small businesses","GSTR-9 & GSTR-9C annual returns","GST audit & reconciliation","Notice handling & departmental queries"]}
        price="₹999"
        priceNote="Per month, all filings included."
        color="blue"
      />
    </PageLayout>
  );
}
