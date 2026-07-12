import { ServicesPage } from "@/components/landing/services-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services | FreWork — Business OS for India",
  description: "GST Registration & Filing, Virtual Accountant, Audits, Business Restructuring, Coworking, Freelancers and more — all under one roof.",
};

export default function Page() {
  return <ServicesPage />;
}
