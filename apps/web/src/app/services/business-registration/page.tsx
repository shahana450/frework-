import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Business Registration | FreWork", description: "Register your Private Limited Company, LLP, OPC or Partnership in India. End-to-end support by CS professionals." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="Business Registration"
        subtitle="Start your business the right way"
        description="We handle the entire incorporation process — from name reservation to certificate of incorporation. Private Limited, LLP, OPC, Partnership and more."
        features={["Name availability search & reservation","MOA/AOA drafting","DIN & DSC for directors","GST registration included","PAN, TAN and bank account guidance","Post-incorporation compliance checklist"]}
        price="₹4,999"
        priceNote="All-inclusive. Govt. fees extra."
        color="violet"
      />
    </PageLayout>
  );
}
