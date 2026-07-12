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
    default: "FreWork – GST Registration, IT Filing & CA Services Online India",
    template: "%s | FreWork India",
  },
  description:
    "FreWork offers GST registration, GST filing, income tax return (ITR) filing, company registration, accounting, audit, and CA services online across India. Start, run and grow your business with expert CAs and CSs.",
  keywords: [
    "GST registration India",
    "GST filing online India",
    "income tax filing India",
    "ITR filing online",
    "company registration India",
    "CA services online India",
    "accounting services India",
    "virtual accountant India",
    "statutory audit India",
    "tax audit India",
    "ROC compliance India",
    "TDS filing India",
    "MSME registration India",
    "business registration India",
    "GST return filing",
    "online CA consultant India",
    "GST consultant India",
    "income tax consultant India",
    "bookkeeping services India",
    "payroll services India",
    "FreWork",
    "frework.online",
  ],
  authors: [{ name: "FreWork" }],
  creator: "FreWork",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://frework.online",
    title: "FreWork – GST Registration, IT Filing & CA Services Online India",
    description:
      "Online GST registration, GST filing, ITR filing, company registration, accounting, audit and CA services across India. Expert CAs & CSs at your fingertips.",
    siteName: "FreWork",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreWork – GST Registration, IT Filing & CA Services India",
    description: "GST registration, income tax filing, accounting and CA services online. India's all-in-one business platform.",
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
        {/* JSON-LD: LocalBusiness + Services structured data for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "AccountingService",
                "@id": "https://frework.online/#organization",
                "name": "FreWork",
                "alternateName": "FreWork India",
                "url": "https://frework.online",
                "logo": "https://frework.online/logo.png",
                "description": "FreWork provides GST registration, GST filing, income tax (ITR) filing, company registration, accounting, virtual accountant, audit, and CA/CS services online across India.",
                "areaServed": { "@type": "Country", "name": "India" },
                "priceRange": "₹₹",
                "currenciesAccepted": "INR",
                "paymentAccepted": "Cash, Credit Card, UPI, Net Banking",
                "telephone": "+918590874681",
                "email": "support@frework.online",
                "sameAs": ["https://frework.online"],
                "hasOfferCatalog": {
                  "@type": "OfferCatalog",
                  "name": "FreWork Services",
                  "itemListElement": [
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "GST Registration", "description": "Online GST registration for businesses across India. Get your GSTIN in 3-5 working days." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "GST Return Filing", "description": "Monthly, quarterly and annual GST return filing — GSTR-1, GSTR-3B, GSTR-9 by expert CAs." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Income Tax Return Filing", "description": "ITR-1 to ITR-6 filing for individuals, salaried, business owners and companies." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Company Registration", "description": "Private Limited, LLP, OPC, Sole Proprietorship and Partnership firm registration in India." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Virtual Accountant", "description": "Dedicated virtual accountant for bookkeeping, invoicing, payroll and financial reporting." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "TDS Filing", "description": "TDS deduction calculation, challan payment and quarterly return filing (24Q, 26Q)." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "ROC / MCA Compliance", "description": "Annual ROC filings, DIR-3 KYC, MGT-7, AOC-4 and MCA compliance for companies." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Statutory Audit", "description": "Statutory audit under Companies Act 2013 by qualified Chartered Accountants." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Tax Audit (44AB)", "description": "Tax audit under Section 44AB of the Income Tax Act for eligible businesses." } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "MSME Registration", "description": "Online Udyam / MSME registration to avail government benefits and subsidies." } }
                  ]
                }
              },
              {
                "@type": "WebSite",
                "@id": "https://frework.online/#website",
                "url": "https://frework.online",
                "name": "FreWork",
                "description": "GST Registration, Income Tax Filing, Accounting & CA Services Online India",
                "publisher": { "@id": "https://frework.online/#organization" },
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": { "@type": "EntryPoint", "urlTemplate": "https://frework.online/services?q={search_term_string}" },
                  "query-input": "required name=search_term_string"
                }
              }
            ]
          }) }}
        />
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
