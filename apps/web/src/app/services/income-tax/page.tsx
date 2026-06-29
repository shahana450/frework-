import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Income Tax Services | FreWork", description: "ITR filing for individuals, businesses and companies. Expert CA support for tax planning and compliance." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="Income Tax"
        subtitle="File right. Save more."
        description="Expert income tax return filing for salaried individuals, freelancers, businesses and companies. We also handle assessments, notices and tax planning."
        features={["ITR filing for all categories","Advance tax computation","TDS return filing (quarterly)","Form 15CA/CB for foreign remittances","Income tax notice handling","Tax planning & optimisation"]}
        price="₹799"
        priceNote="Per return. Businesses from ₹2,999."
        color="green"
      />
    </PageLayout>
  );
}
