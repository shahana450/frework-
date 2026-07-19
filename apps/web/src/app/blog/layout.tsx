import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST, Income Tax & Business Compliance Blog India | FreWork",
  description: "Expert guides on GST registration, ITR filing, company registration, ROC compliance and business taxation in India. Written by qualified CAs.",
  keywords: ["GST registration guide India","ITR filing guide","company registration process India","GST return filing steps","income tax guide India","CA blog India","FreWork blog"],
  openGraph: {
    title: "FreWork Blog – GST, Tax & Business Compliance Guides",
    description: "Practical guides and updates on GST, income tax, company law and business compliance in India. Written by expert CAs.",
    url: "https://frework.online/blog",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://frework.online/blog" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
