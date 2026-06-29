import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accounting Services | FreWork", description: "Monthly bookkeeping, P&L, balance sheets and MIS reports for Indian businesses. Tally & cloud-based." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="Accounting"
        subtitle="Clean books, clear decisions"
        description="Monthly bookkeeping, financial statements and MIS reports that give you a real-time picture of your business. We work with Tally, Zoho Books and QuickBooks."
        features={["Monthly bookkeeping & ledger maintenance","Profit & loss statement","Balance sheet preparation","Bank reconciliation","MIS reports & dashboards","Accounts payable & receivable management"]}
        price="₹1,499"
        priceNote="Per month. Volume discounts available."
        color="orange"
      />
    </PageLayout>
  );
}
