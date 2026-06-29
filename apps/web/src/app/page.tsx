import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HomepageHero } from "@/components/landing/homepage-hero";
import { ServicesGrid } from "@/components/landing/services-grid";
import { PromoOffer } from "@/components/landing/promo-offer";
import { ReferralSection } from "@/components/landing/referral-section";
import { TrustBadges } from "@/components/landing/trust-badges";
import { HomepageFAQ } from "@/components/landing/homepage-faq";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FreWork – Find. Grow. | India's Professional Platform",
  description: "FIND coworking spaces, freelancers and jobs — or GROW your business with expert compliance, DPR, pitch decks and restructuring services from CA & CS qualified professionals.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HomepageHero />
        <TrustBadges />
        <ServicesGrid />
        <PromoOffer />
        <ReferralSection />
        <HomepageFAQ />
      </main>
      <Footer />
    </div>
  );
}
