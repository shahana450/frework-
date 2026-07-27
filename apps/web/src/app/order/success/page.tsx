"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";

function SuccessInner() {
  const params  = useSearchParams();
  const service = params.get("service") ?? "";
  const amount  = params.get("amount") ?? "";

  return (
    <div className="min-h-screen bg-[#060C18] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-cormorant), serif" }}>
          Order confirmed!
        </h2>
        {amount && (
          <p className="text-white/40 text-sm mb-1">
            ₹{Number(amount).toLocaleString("en-IN")} paid successfully
          </p>
        )}
        <p className="text-white/25 text-xs mb-10">
          Our team will reach out within 24 hours to get started.
        </p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-[#0B1120] text-sm"
          style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C)" }}>
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060C18] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    }>
      <SuccessInner />
    </Suspense>
  );
}
