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
  title: "FreWork – Start. Manage. Grow. | India's Business Growth Platform",
  description: "Expert GST, Income Tax, Company Registration, Accounting, Audit and Compliance services for Indian businesses. Book a free consultation today.",
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
