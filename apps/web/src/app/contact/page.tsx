import type { Metadata } from "next";
import ContactClient from "./contact-client";

export const metadata: Metadata = {
  title: "Talk to a CA Expert — Free Consultation | FreWork India",
  description:
    "Get a free consultation with a qualified CA or CS. We handle GST registration, income tax filing, company registration, accounting, audit and all compliance needs. Contact FreWork today.",
  keywords: [
    "talk to CA online India",
    "free CA consultation India",
    "GST registration consultant",
    "income tax consultant India",
    "CA near me online",
    "chartered accountant online India",
    "business compliance consultant India",
    "contact FreWork",
  ],
  openGraph: {
    title: "Talk to a CA Expert — Free Consultation | FreWork India",
    description:
      "Free consultation with expert professionals for GST, income tax, company registration and accounting. Get expert help now.",
    url: "https://frework.online/contact",
  },
};

export default function Page() {
  return <ContactClient />;
}
