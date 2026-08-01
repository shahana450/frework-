import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — FreWork",
  description: "FreWork Privacy Policy — how we collect, use, and protect your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#060C18] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors mb-8 inline-block">Back to FreWork</Link>
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: July 2026</p>
        <div className="space-y-10 text-white/60 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Who We Are</h2>
            <p>FreWork is a business services platform operated at frework.online. We provide company registration, GST filing, compliance, talent hiring, and coworking services to Indian businesses. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2 text-white/50">
              <li>Account data: Name, email, phone number, Google profile.</li>
              <li>Business data: Company name, PAN, GST number, uploaded documents.</li>
              <li>Payment data: Transaction IDs and order amounts. Card/UPI data is handled by PhonePe.</li>
              <li>Usage data: Pages visited, device type, browser info via analytics.</li>
              <li>Communication data: WhatsApp messages, emails, and contact form submissions.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-white/50">
              <li>To deliver purchased services</li>
              <li>To process payments and issue receipts via PhonePe</li>
              <li>To send order updates, compliance reminders, and notifications</li>
              <li>To respond to queries via WhatsApp or email</li>
              <li>To improve the FreWork platform</li>
              <li>To comply with Indian law (GST Act, Income Tax Act, Companies Act)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Sharing Your Information</h2>
            <p className="mb-3">We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc list-inside space-y-2 text-white/50">
              <li>Service professionals (CAs, lawyers) — only data needed for your order</li>
              <li>PhonePe — for payment processing</li>
              <li>Government authorities — for required filings (MCA, GSTN, Income Tax)</li>
              <li>Cloud providers (Supabase, Vercel) — for secure storage and hosting</li>
              <li>Legal authorities — if required by Indian law or court order</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Security</h2>
            <p>We use HTTPS encryption, secure cloud storage, and role-based access controls. Contact us immediately if you suspect unauthorised access.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p>We retain account and order data for a minimum of 7 years as required under Indian law. Non-statutory data can be deleted on request within 30 days.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies</h2>
            <p>frework.online uses essential cookies for authentication and analytics cookies to understand usage. You can disable cookies in your browser settings.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
            <ul className="list-disc list-inside space-y-2 text-white/50">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of non-statutory data</li>
              <li>Opt out of marketing communications</li>
              <li>Withdraw consent for data processing where applicable</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with a revised last-updated date.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact Us</h2>
            <ul className="list-disc list-inside space-y-2 text-white/50">
              <li>WhatsApp: +91 85908 74681</li>
              <li>Email: support@frework.online</li>
              <li>Website: frework.online</li>
            </ul>
          </section>
        </div>
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-xs text-white/25">
          <Link href="/terms" className="hover:text-white/50 transition-colors">Terms of Service</Link>
          <Link href="/refund-policy" className="hover:text-white/50 transition-colors">Refund Policy</Link>
          <Link href="/" className="hover:text-white/50 transition-colors">frework.online</Link>
        </div>
      </div>
    </div>
  );
}
