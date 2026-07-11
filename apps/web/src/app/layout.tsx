import type { Metadata, Viewport } from "next";
import { Poppins, Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { QueryProvider } from "@/components/shared/query-provider";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL((process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online").replace(/^﻿/, "")),
  title: {
    default: "FreWork – The Operating System for Indian Businesses",
    template: "%s | FreWork",
  },
  description:
    "Start, Run and Grow Your Business — All in One Place. Company registration, GST filing, income tax, hire professionals, coworking spaces, DPR, pitch decks, and startup funding. India's all-in-one business platform.",
  keywords: [
    "company registration India",
    "GST registration India",
    "income tax filing India",
    "CA services online India",
    "business registration India",
    "coworking spaces India",
    "hire freelancer India",
    "startup funding India",
    "business plan India",
    "ROC compliance",
    "MSME registration",
    "FreWork",
  ],
  authors: [{ name: "FreWork" }],
  creator: "FreWork",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://frework.online",
    title: "FreWork – The Operating System for Indian Businesses",
    description:
      "Start, Run and Grow Your Business — All in One Place. Company registration, GST, income tax, hire professionals, coworking, DPR, pitch decks and startup funding.",
    siteName: "FreWork",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreWork – The Operating System for Indian Businesses",
    description: "Start, Run and Grow Your Business — All in One Place. India's all-in-one business platform.",
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
  themeColor: "#B8903A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${plusJakartaSans.variable} ${cormorant.variable}`}>
      <head>
        {META_PIXEL_ID && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">{`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}</Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img height="1" width="1" style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </head>
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
