import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Categories } from "@/components/landing/categories";
import { FeaturedFreelancers } from "@/components/landing/featured-freelancers";
import { FeaturedWorkspaces } from "@/components/landing/featured-workspaces";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WorkSphere Global – Find Talent. Find Workspace. Build Your Future.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Categories />
        <FeaturedFreelancers />
        <FeaturedWorkspaces />
        <Testimonials />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
