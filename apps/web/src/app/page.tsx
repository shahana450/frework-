import { HorizontalHomepage } from "@/components/landing/horizontal-homepage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FreWork – Find. Grow. Launch. | India's Professional Platform",
  description: "FIND coworking spaces, freelancers and jobs — GROW with expert CA & CS services — LAUNCH your startup to investors. India's all-in-one professional growth platform.",
};

export default function HomePage() {
  return <HorizontalHomepage />;
}
