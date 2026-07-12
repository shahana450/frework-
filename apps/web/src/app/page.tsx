import { BusinessOSHomepage } from "@/components/landing/business-os-homepage";
import { TaxNewsSection } from "@/components/landing/tax-news-section";
import { AnnouncementTicker } from "@/components/landing/announcement-ticker";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FreWork – The Operating System for Indian Businesses",
  description: "Start, Run and Grow Your Business — All in One Place. Company registration, GST, income tax, freelancers, coworking, DPR, pitch decks, and startup funding. India's all-in-one business platform.",
};

export default function HomePage() {
  return (
    <>
      <AnnouncementTicker />
      <BusinessOSHomepage />
      <TaxNewsSection />
    </>
  );
}
