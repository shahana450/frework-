"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SubscriptionPaymentOptions {
  plan: string;
  billing: string;
  userId?: string;
}

interface ServicePaymentOptions {
  service: string;
  serviceName?: string;
  amount?: number;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  businessName?: string;
  notes?: string;
}

export function usePhonePe() {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const router = useRouter();

  async function initiateSubscriptionPayment(options: SubscriptionPaymentOptions) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/phonepe/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) throw new Error(data.error ?? "Payment initiation failed");
      window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setError(msg);
      setLoading(false);
    }
  }

  async function initiateServicePayment(options: ServicePaymentOptions) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/phonepe/create-service-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) throw new Error(data.error ?? "Payment initiation failed");
      window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setError(msg);
      setLoading(false);
    }
  }

  return { loading, error, initiateSubscriptionPayment, initiateServicePayment };
}
