import { ServicesPage } from "@/components/landing/services-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Registration, IT Filing, Accounting & CA Services Online India",
  description:
    "FreWork offers GST registration, GST return filing, income tax (ITR) filing, company registration, virtual accountant, statutory audit, tax audit, TDS filing, ROC compliance and more. Expert CA/CS services online across India. Starting ₹499.",
  keywords: [
    "GST registration online India",
    "GST filing online",
    "GST return filing India",
    "income tax return filing India",
    "ITR filing online India",
    "company registration India",
    "virtual accountant India",
    "online CA services India",
    "statutory audit India",
    "tax audit 44AB",
    "TDS filing India",
    "ROC compliance India",
    "MSME registration India",
    "bookkeeping services India",
    "payroll services India",
    "GST consultant India",
    "CA consultant online India",
    "accounting services for small business India",
  ],
  openGraph: {
    title: "GST Registration, IT Filing & CA Services Online | FreWork India",
    description:
      "Expert online CA services — GST registration, income tax filing, company registration, audit, accounting. Trusted by 500+ Indian businesses.",
    url: "https://frework.online/services",
  },
};

export default function Page() {
  return <ServicesPage />;
}
