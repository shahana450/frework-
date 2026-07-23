import { PageLayout } from "@/components/layout/page-layout";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About FreWork — India's All-in-One Business Platform",
  description:
    "FreWork is India's all-in-one business operating system — GST registration, ITR filing, company registration, coworking spaces, freelance professionals and accounting services, all in one place.",
  keywords: [
    "FreWork",
    "FreWork India",
    "about FreWork",
    "FreWork frework.online",
    "FreWork business platform India",
    "FreWork GST registration",
    "FreWork ITR filing",
    "FreWork company registration",
    "FreWork coworking",
    "India business platform",
    "online business services India",
  ],
  openGraph: {
    title: "About FreWork — India's All-in-One Business Platform",
    description: "FreWork is India's all-in-one platform for GST, ITR, company registration, coworking and expert professionals.",
    url: "https://frework.online/about",
    type: "website",
  },
  alternates: { canonical: "https://frework.online/about" },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About FreWork",
  "url": "https://frework.online/about",
  "description": "FreWork is India's all-in-one business operating system.",
  "mainEntity": {
    "@type": ["ProfessionalService", "AccountingService"],
    "name": "FreWork",
    "alternateName": ["FreWork India", "frework", "frework.online"],
    "url": "https://frework.online",
    "foundingDate": "2024",
    "foundingLocation": "India",
    "description": "FreWork is India's all-in-one business platform for GST registration, ITR filing, company registration, coworking spaces and freelance professionals.",
    "areaServed": { "@type": "Country", "name": "India" },
    "serviceArea": {
      "@type": "GeoCircle",
      "geoMidpoint": { "@type": "GeoCoordinates", "latitude": 20.5937, "longitude": 78.9629 },
      "geoRadius": "5000000"
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "FreWork Services",
      "itemListElement": [
        { "@type": "Offer", "name": "GST Registration", "price": "499", "priceCurrency": "INR" },
        { "@type": "Offer", "name": "ITR Filing", "price": "499", "priceCurrency": "INR" },
        { "@type": "Offer", "name": "Company Registration", "price": "1499", "priceCurrency": "INR" },
        { "@type": "Offer", "name": "Coworking Space", "price": "350", "priceCurrency": "INR" },
      ]
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-85908-74681",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["English", "Hindi"]
    },
    "sameAs": [
      "https://frework.online",
      "https://linkedin.com/company/frework"
    ]
  }
};

const STATS = [
  { n: "8+", l: "Cities" },
  { n: "200+", l: "Verified Spaces" },
  { n: "500+", l: "Businesses Served" },
  { n: "₹499", l: "Services From" },
];

const SERVICES = [
  { title: "GST Registration", desc: "Get your GSTIN in 3–5 working days. Online process, expert-guided.", href: "/services/compliance", price: "₹499" },
  { title: "ITR Filing", desc: "Income tax return filing for individuals, salaried, business owners.", href: "/services/compliance", price: "₹499" },
  { title: "Company Registration", desc: "Pvt Ltd, LLP, OPC, Partnership — end-to-end incorporation.", href: "/services/business-registration", price: "₹1,499" },
  { title: "Virtual Accountant", desc: "Dedicated accountant for bookkeeping, invoicing, payroll.", href: "/services/accounting", price: "₹1,999/mo" },
  { title: "Coworking Spaces", desc: "Hot desks, private cabins, meeting rooms across 8 Indian cities.", href: "/coworking", price: "₹350/day" },
  { title: "Expert Professionals", desc: "Verified tax consultants, accountants and business advisors.", href: "/freelancers", price: "Varies" },
];

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <PageLayout>
        <div className="max-w-4xl mx-auto px-4 py-16">

          {/* Hero */}
          <div className="text-center mb-16">
            <p className="text-xs font-black tracking-[0.3em] uppercase text-blue-600 mb-4">About FreWork</p>
            <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight" style={{ color: "#0F2044" }}>
              India&apos;s Operating System<br />
              <span className="text-blue-600">for Business</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              FreWork (frework.online) is India&apos;s all-in-one business platform — combining GST and tax compliance,
              company formation, coworking spaces and expert professionals in a single place.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {STATS.map(s => (
              <div key={s.l} className="text-center p-6 rounded-2xl border border-blue-100 bg-blue-50">
                <p className="text-3xl font-black text-blue-600 mb-1">{s.n}</p>
                <p className="text-sm text-gray-600 font-semibold">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Mission */}
          <div className="mb-16 p-8 rounded-3xl border border-blue-100" style={{ background: "linear-gradient(135deg, #F0F4FF, #FFFFFF)" }}>
            <h2 className="text-2xl font-black mb-4" style={{ color: "#0F2044" }}>Our Mission</h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              Starting and running a business in India is hard. GST registrations, income tax filings, ROC compliance,
              finding a good accountant, getting a workspace — these are all separate problems that take weeks to solve.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg mt-4">
              <strong>FreWork</strong> solves all of them in one place. We are building the operating system for Indian businesses —
              so entrepreneurs can focus on building, not paperwork.
            </p>
          </div>

          {/* What we do */}
          <h2 className="text-2xl font-black mb-8" style={{ color: "#0F2044" }}>What FreWork Does</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-16">
            {SERVICES.map(s => (
              <Link key={s.title} href={s.href}
                className="block p-6 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all bg-white">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900">{s.title}</h3>
                  <span className="text-blue-600 font-black text-sm">{s.price}</span>
                </div>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </Link>
            ))}
          </div>

          {/* Why FreWork */}
          <h2 className="text-2xl font-black mb-6" style={{ color: "#0F2044" }}>Why FreWork?</h2>
          <div className="space-y-4 mb-16">
            {[
              { t: "Everything in one place", d: "GST, ITR, accounting, coworking — stop switching between 10 different services." },
              { t: "Verified professionals", d: "Every tax consultant and accountant on FreWork is manually verified before listing." },
              { t: "Transparent pricing", d: "No hidden fees. GST registration from ₹499. Company registration from ₹1,499." },
              { t: "Online and fast", d: "All services available 100% online. GST registration in 3–5 days, ITR filing in 24 hours." },
              { t: "Pan-India coverage", d: "Service across all Indian states. Coworking spaces in 8 major cities." },
            ].map(item => (
              <div key={item.t} className="flex gap-4 p-4 rounded-xl border border-gray-100">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex-shrink-0 mt-0.5 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{item.t}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center p-10 rounded-3xl border-2 border-blue-200 bg-blue-50">
            <h2 className="text-2xl font-black mb-3" style={{ color: "#0F2044" }}>Start with FreWork today</h2>
            <p className="text-gray-600 mb-6">Join 500+ businesses who use FreWork to handle their compliance, accounting and workspace needs.</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/register"
                className="px-8 py-3 rounded-2xl font-bold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #2563EB, #1E40AF)" }}>
                Get Started Free
              </Link>
              <Link href="/contact"
                className="px-8 py-3 rounded-2xl font-bold border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 transition-all">
                Talk to Us
              </Link>
            </div>
          </div>

        </div>
      </PageLayout>
    </>
  );
}
