import { PageLayout } from "@/components/layout/page-layout";
import { ServicePage } from "@/components/services/service-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Audit Services | FreWork", description: "Statutory audit, internal audit, tax audit and concurrent audit by CA professionals." };

export default function Page() {
  return (
    <PageLayout>
      <ServicePage
        title="Audit"
        subtitle="Assurance you can rely on"
        description="Statutory audit under Companies Act, tax audit under Income Tax Act, internal audit and concurrent audit — conducted by experienced Chartered Accountants."
        features={["Statutory audit (Companies Act 2013)","Tax audit (Section 44AB)","Internal audit & process review","Concurrent audit for banks & NBFCs","GST audit & reconciliation","Audit report & management letter"]}
        price="₹7,999"
        priceNote="Per audit engagement. Scope-based pricing."
        color="red"
      />
    </PageLayout>
  );
}
