import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// geist fonts provide CSS variables --font-geist-sans and --font-geist-mono
import { ThemeProvider } from "@/components/shared/theme-provider";
import { QueryProvider } from "@/components/shared/query-provider";
import { Toaster } from "sonner";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online"),
  title: {
    default: "FreWork – India's Platform for Freelancers, Coworking & Startups",
    template: "%s | FreWork",
  },
  description:
    "FreWork is India's fastest-growing platform connecting freelancers, coworking spaces, startups, and investors. Find talent, book workspaces, raise funding — all in one place.",
  keywords: [
    "freelancers India",
    "coworking spaces India",
    "hire freelancers",
    "startup hub India",
    "investors India",
    "remote work India",
    "workspace booking",
    "freelance jobs India",
    "FreWork",
  ],
  authors: [{ name: "FreWork" }],
  creator: "FreWork",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://frework.online",
    title: "FreWork – Find Talent. Find Workspace. Build Your Future.",
    description:
      "India's most complete professional ecosystem. Connect with top freelancers, book premium coworking spaces, and grow your startup.",
    siteName: "FreWork",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreWork",
    description: "India's Platform for Freelancers, Coworking & Startups.",
    creator: "@frework",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large" },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
            <Toaster richColors position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
