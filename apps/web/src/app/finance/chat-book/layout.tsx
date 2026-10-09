import type { Metadata, Viewport } from "next";

// Makes FreBook installable as its own phone app (Add to Home Screen / Install app)
export const metadata: Metadata = {
  title: "FreBook",
  manifest: "/frebook.webmanifest",
  appleWebApp: { capable: true, title: "FreBook", statusBarStyle: "black-translucent" },
  icons: { apple: "/frebook-icon/180?v=2" },
};

export const viewport: Viewport = { themeColor: "#1E2457", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function FreBookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
