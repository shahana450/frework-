import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — FreWork",
  description: "FreWork refund and cancellation policy for services, subscriptions, and payments processed via PhonePe.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#060C18] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors mb-8 inline-block">← Back to FreWork</Link>
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant), serif" }}>Refund &amp; Cancellation Policy</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: July 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed text-[15px]">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Overview</h2>
            <p>
              FreWork (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is operated by FreWork Business Solutions. All payments on frework.online are processed securely via PhonePe Payment Gateway. This policy governs refunds and cancellations for all services and subscription plans purchased through our platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Service Orders (One-Time Payments)</h2>
            <ul className="list-disc list-inside space-y-2.5 text-white/50">
              <li><span className="text-white/70 font-medium">Before work begins:</span> Full refund within 48 hours of payment if work has not yet been initiated by our team.</li>
              <li><span className="text-white/70 font-medium">After work begins:</span> No refund once the professional has started work on your order. You may request a revision instead.</li>
              <li><span className="text-white/70 font-medium">Government filing fees:</span> Non-refundable once paid to the government authority (e.g., MCA, GST portal, Income Tax portal).</li>
              <li><span className="text-white/70 font-medium">Duplicate payments:</span> If you are charged more than once for the same order, the extra amount will be refunded within 5–7 business days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Subscription Plans</h2>
            <ul className="list-disc list-inside space-y-2.5 text-white/50">
              <li><span className="text-white/70 font-medium">Monthly plans:</span> Cancel any time. Access continues until the end of the current billing period. No partial refunds for unused days.</li>
              <li><span className="text-white/70 font-medium">Annual plans:</span> Refundable (pro-rated) within 7 days of purchase if no services have been consumed. After 7 days or after services are used, no refund.</li>
              <li><span className="text-white/70 font-medium">Trial periods:</span> If a free trial is offered, you will not be charged during the trial. Cancel before the trial ends to avoid any charge.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Coworking &amp; Workspace Bookings</h2>
            <ul className="list-disc list-inside space-y-2.5 text-white/50">
              <li>Cancellations made <span className="text-white/70 font-medium">48+ hours</span> before the booking: Full refund.</li>
              <li>Cancellations made <span className="text-white/70 font-medium">24–48 hours</span> before the booking: 50% refund.</li>
              <li>Cancellations made <span className="text-white/70 font-medium">less than 24 hours</span> before the booking or no-shows: No refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. How to Request a Refund</h2>
            <p className="mb-3">To request a refund, contact us via any of the following within the eligible window:</p>
            <ul className="list-disc list-inside space-y-2.5 text-white/50">
              <li>
                <span className="text-white/70 font-medium">WhatsApp:</span>{" "}
                <a href="https://wa.me/918590874681?text=Hi%20FreWork%2C%20I%20want%20to%20request%20a%20refund." className="text-emerald-400 hover:text-emerald-300 transition-colors" target="_blank" rel="noopener noreferrer">+91 85908 74681</a>
              </li>
              <li>
                <span className="text-white/70 font-medium">Email:</span>{" "}
                <a href="mailto:support@frework.online" className="text-blue-400 hover:text-blue-300 transition-colors">support@frework.online</a>
              </li>
              <li><span className="text-white/70 font-medium">Include:</span> Your name, order/transaction ID, payment date, and reason for refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Refund Processing Timeline</h2>
            <p>
              Approved refunds are processed within <span className="text-white/80 font-medium">5–7 business days</span>. The refunded amount will be credited back to the original payment source (UPI, bank account, or card) via PhonePe. Processing times may vary depending on your bank or payment provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Non-Refundable Items</h2>
            <ul className="list-disc list-inside space-y-2.5 text-white/50">
              <li>Government fees, stamp duty, or statutory charges paid on your behalf</li>
              <li>Convenience fees or platform charges (if any)</li>
              <li>Services already delivered and accepted by the customer</li>
              <li>Orders where government filing has been initiated</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Disputes &amp; Chargebacks</h2>
            <p>
              We encourage you to contact us directly before raising a dispute or chargeback with your bank. Most issues can be resolved within 24–48 hours through our support team. Unwarranted chargebacks may result in suspension of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact Us</h2>
            <p>
              For any refund queries, reach us on WhatsApp at{" "}
              <a href="https://wa.me/918590874681" className="text-emerald-400 hover:text-emerald-300 transition-colors" target="_blank" rel="noopener noreferrer">+91 85908 74681</a>{" "}
              or email{" "}
              <a href="mailto:support@frework.online" className="text-blue-400 hover:text-blue-300 transition-colors">support@frework.online</a>.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-xs text-white/25">
          <Link href="/terms" className="hover:text-white/50 transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-white/50 transition-colors">frework.online</Link>
        </div>
      </div>
    </div>
  );
}
