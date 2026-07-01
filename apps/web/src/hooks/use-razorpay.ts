"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface PaymentOptions {
  plan: string;
  amount: number;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSuccess: (paymentId: string, orderId: string) => void;
  onDismiss?: () => void;
}

function loadScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById("razorpay-sdk")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function useRazorpay() {
  const pay = useCallback(async (opts: PaymentOptions): Promise<void> => {
    const loaded = await loadScript();
    if (!loaded) throw new Error("Razorpay SDK failed to load");

    const res = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: opts.plan }),
    });

    if (!res.ok) throw new Error("Could not create payment order");
    const { orderId, amount, currency } = await res.json();

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount,
        currency,
        name: "FreWork",
        description: `${opts.plan.charAt(0).toUpperCase() + opts.plan.slice(1)} Plan — Monthly`,
        order_id: orderId,
        prefill: { name: opts.userName, email: opts.userEmail, contact: opts.userPhone },
        theme: { color: "#C9A84C" },
        handler: (response) => {
          opts.onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
          resolve();
        },
        modal: {
          ondismiss: () => {
            opts.onDismiss?.();
            resolve();
          },
        },
      });
      rzp.open();
    });
  }, []);

  return { pay };
}
