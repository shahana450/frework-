import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hire Verified CAs, Lawyers & Freelancers Online India | FreWork",
  description: "Find and hire verified Chartered Accountants, Company Secretaries, lawyers, developers, designers and skilled professionals across India. All profiles manually verified.",
  keywords: ["hire CA online India","freelance CA India","hire chartered accountant","hire lawyer India","find professionals online","verified freelancers India","hire developer India","FreWork freelancers"],
  openGraph: {
    title: "Hire Verified CAs, Lawyers & Freelancers – FreWork India",
    description: "Browse verified Chartered Accountants, lawyers, developers, designers and 1000+ professionals across 16 cities in India.",
    url: "https://frework.online/freelancers",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://frework.online/freelancers" },
};

export default function FreelancersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
