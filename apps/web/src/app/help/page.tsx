import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import HelpCenter from "@/components/help/HelpCenter";
import { HELP } from "@/lib/helpContent";

export const metadata: Metadata = {
  title: { absolute: "Help & FAQ – FreBook Accounting | FreWork" },
  description: "Answers about FreBook: WhatsApp bookkeeping, GST invoices, CGST/SGST vs IGST, e-invoice files, bank statement import, Schedule III reports, Tally sync, plans and billing.",
  alternates: { canonical: "https://frework.online/help" },
  openGraph: { title: "FreBook Help & FAQ", description: "Simple answers, with pictures, about FreBook accounting.", url: "https://frework.online/help", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
};

// Questions and answers as structured data, so search engines can show them
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HELP.flatMap(t => t.items.map(i => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a.join(" ") } }))),
};

export default function HelpPage() {
  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
      <HelpCenter />
    </>
  );
}
