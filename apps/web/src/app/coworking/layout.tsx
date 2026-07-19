import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coworking Spaces India – Hot Desk, Cabin & Virtual Office | FreWork",
  description: "Find verified coworking spaces, hot desks, private cabins and virtual offices across Mumbai, Bangalore, Delhi, Hyderabad, Pune and 8 more cities in India.",
  keywords: ["coworking space India","hot desk Mumbai","coworking Bangalore","virtual office India","private cabin office India","coworking space near me","day pass office India","FreWork coworking"],
  openGraph: {
    title: "Coworking Spaces Across India – FreWork",
    description: "Browse verified coworking spaces, private cabins and virtual offices in 8+ cities. Book by the day, month or hour.",
    url: "https://frework.online/coworking",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://frework.online/coworking" },
};

export default function CoworkingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
