import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Virtual CFO | FreWork", description: "Strategic financial planning, cash flow management and investor-ready reporting for growing businesses." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="Virtual CFO"
        subtitle="Senior finance leadership, on demand"
        description="Get a dedicated finance expert to drive strategy, manage cash flow and prepare investor-ready reports — without the cost of a full-time CFO."
        features={["Monthly financial review & strategy","Cash flow forecasting & management","Budget vs actuals analysis","Investor-ready financial models","Fundraising support & due diligence","Board reporting & presentations"]}
        price="₹9,999"
        priceNote="Per month. Senior CA/MBA qualified."
        color="teal"
      />
    </PageLayout>
  );
}
