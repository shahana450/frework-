import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans – GST, ITR & CA Services | FreWork India",
  description: "Simple, transparent pricing for GST registration, GST filing, income tax return, accounting and CA services. Start free. Upgrade anytime. No hidden charges.",
  keywords: ["GST registration price India","ITR filing charges","CA service fees India","accounting service cost","FreWork pricing","online CA fees"],
  openGraph: {
    title: "FreWork Pricing – GST, ITR & CA Services Plans",
    description: "Transparent pricing for all compliance services. GST registration, ITR filing, accounting and more. Start free forever.",
    url: "https://frework.online/pricing",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://frework.online/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
