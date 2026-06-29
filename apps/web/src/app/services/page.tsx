import { PageLayout } from "@/components/layout/page-layout";
import { ServicesGrid } from "@/components/landing/services-grid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Services | FreWork",
  description: "GST, Income Tax, Company Registration, Accounting, Audit and Compliance services for Indian businesses.",
};

export default function ServicesPage() {
  return (
    <PageLayout>
      <div className="pt-8 pb-4 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Our Services</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">End-to-end business services by CA & CS professionals</p>
      </div>
      <ServicesGrid />
    </PageLayout>
  );
}
