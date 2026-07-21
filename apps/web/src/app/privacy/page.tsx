import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "FreWork Privacy Policy — how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#060C18] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors mb-8 inline-block">← Back to FreWork</Link>
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>Privacy Policy</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: July 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed text-[15px]">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>When you use FreWork or submit an enquiry form, we collect:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/50">
              <li>Full name and mobile number (required for callbacks)</li>
              <li>Email address (optional)</li>
              <li>Service enquiry details</li>
              <li>UTM / advertising parameters (to measure ad effectiveness)</li>
              <li>Device type, browser, and approximate location (analytics)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>To call or WhatsApp you back about your service enquiry</li>
              <li>To send relevant updates about FreWork (you can unsubscribe anytime)</li>
              <li>To improve our platform and services</li>
              <li>To measure advertising performance (Meta Pixel, Google Analytics)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>We <strong className="text-white">never sell your personal data</strong>. We share your data only with:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-white/50">
              <li>Our expert team (to deliver your requested service)</li>
              <li>Supabase (secure cloud database, hosted in the EU)</li>
              <li>Meta / Google (ad measurement only — via Pixel events, no PII sent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Retention</h2>
            <p>We retain your enquiry data for up to 3 years or until you request deletion, whichever comes first.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. Email us at <a href="mailto:privacy@frework.online" className="text-[#C9A84C] hover:underline">privacy@frework.online</a> and we will respond within 72 hours.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Cookies</h2>
            <p>We use essential cookies for session management and the Meta Pixel for ad conversion tracking. We do not use third-party tracking cookies beyond Meta and Google Analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Contact</h2>
            <p>For any privacy concerns, contact us at <a href="mailto:privacy@frework.online" className="text-[#C9A84C] hover:underline">privacy@frework.online</a> or WhatsApp us at {process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+91 99999 99999"}.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
