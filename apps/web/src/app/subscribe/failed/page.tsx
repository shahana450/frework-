"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, Loader2 } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  payment_failed: "Payment was not completed.",
  server_error:   "Something went wrong on our end.",
};

function FailedInner() {
  const params = useSearchParams();
  const reason = params.get("reason") ?? "payment_failed";
  const plan   = params.get("plan") ?? "";
  const label  = REASON_LABELS[reason] ?? "Payment could not be processed.";

  return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-red-500/12 border border-red-500/25 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-400" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>
          Payment failed
        </h2>
        <p className="text-white/40 text-sm mb-2">{label}</p>
        <p className="text-white/25 text-xs mb-10">No amount was charged. Please try again.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/subscribe${plan ? `?plan=${plan}` : ""}`}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-[#0B1120] text-sm"
            style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>
            Try Again
          </Link>
          <Link href="/pricing"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-2xl font-semibold text-white/60 text-sm border border-white/10 hover:border-white/20 transition-colors">
            Back to Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SubscribeFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    }>
      <FailedInner />
    </Suspense>
  );
}
