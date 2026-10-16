"use client";
// Sends a password-reset link. The link opens /reset-password, where a new password is set.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Forgot() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  useEffect(() => { const e = params.get("email"); if (e) setEmail(e); }, [params]);

  const send = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email.trim()) return;
    setState("sending"); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    if (err) { setState("idle"); setError(/rate|seconds/i.test(err.message) ? "Please wait a minute before asking for another link." : err.message); return; }
    setState("sent");
  };

  return (
    <Shell title="Reset your password" sub="We'll email you a link to set a new one.">
      {state === "sent" ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-200 leading-relaxed">
          If <b className="text-white">{email}</b> has a FreWork account, a reset link is on its way. Open it on this device. Check spam if it isn&apos;t there in a couple of minutes.
          <div className="mt-2 text-emerald-200/70">Signed up with Google or WhatsApp? Those accounts have no password — just use that button on the sign-in page.</div>
        </div>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4">
          {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          <label className="text-sm font-medium text-white/60">Email address
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#C9A84C]/50" />
          </label>
          <button type="submit" disabled={state === "sending"} className="rounded-2xl py-3.5 font-bold text-[#0A0E1A] disabled:opacity-60" style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8963E)" }}>
            {state === "sending" ? "Sending…" : "Email me a reset link"}
          </button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-sm text-white/50 hover:text-white">← Back to sign in</Link>
    </Shell>
  );
}

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-4" style={{ background: "radial-gradient(120% 80% at 20% 0%, #151B2E 0%, #0A0E1A 60%)" }}>
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>{title}</h1>
        <p className="text-white/45 mb-7 text-sm">{sub}</p>
        {children}
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={null}><Forgot /></Suspense>;
}
