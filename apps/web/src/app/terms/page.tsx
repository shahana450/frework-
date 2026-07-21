import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "FreWork Terms of Service — the rules governing use of the FreWork platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#060C18] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors mb-8 inline-block">← Back to FreWork</Link>
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>Terms of Service</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: July 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed text-[15px]">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance</h2>
            <p>By accessing FreWork (frework.online) or submitting any enquiry form, you agree to these Terms of Service. If you do not agree, please do not use our platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Services Provided</h2>
            <p>FreWork is a professional services marketplace that connects individuals and businesses with:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/50">
              <li>ICAI-registered qualified expert professionals</li>
              <li>Verified freelancers and skilled professionals</li>
              <li>Coworking and workspace listings</li>
              <li>Startup and investor networking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Responsibilities</h2>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>You must provide accurate information when submitting enquiries or creating a profile</li>
              <li>You must not misuse or abuse the platform or its professionals</li>
              <li>Freelancers and service providers are responsible for the quality and legality of their work</li>
              <li>You must be 18 years or older to use FreWork</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Payments and Subscriptions</h2>
            <p>Subscription payments are processed securely via Razorpay. Plans are billed monthly or annually as selected. Refunds are available within 7 days of purchase if no services have been consumed. Contact <a href="mailto:billing@frework.online" className="text-[#C9A84C] hover:underline">billing@frework.online</a> for billing disputes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Professional Advice Disclaimer</h2>
            <p>expert professionals on FreWork are independent practitioners. FreWork provides a platform to connect you with them. FreWork is not responsible for specific professional advice given by CAs or CSs on the platform. Always verify credentials and obtain independent advice for major financial or legal decisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Intellectual Property</h2>
            <p>All content on frework.online including the FreWork brand, logo, and platform design is the property of FreWork. You may not reproduce or distribute any part of the platform without written permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p>FreWork is not liable for any indirect, incidental, or consequential damages arising from use of the platform. Our total liability is limited to the amount you paid in subscription fees in the preceding 3 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>For any questions about these Terms, email <a href="mailto:legal@frework.online" className="text-[#C9A84C] hover:underline">legal@frework.online</a>.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
