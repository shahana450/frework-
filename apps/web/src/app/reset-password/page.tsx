"use client";
// Opened from the reset email: the link signs the user in for recovery, then they choose a new password.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Reset() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code).catch(() => null);   // PKCE links
      const { data } = await supabase.auth.getSession();                                 // links with #access_token are read automatically
      setReady(data.session ? "yes" : "no");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY" || s) setReady("yes"); });
    return () => sub.subscription.unsubscribe();
  }, [params]);

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (pw.length < 8) { setError("Use at least 8 characters."); return; }
    if (pw !== pw2) { setError("The two passwords don't match."); return; }
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.replace("/finance/select-business");
  };

  const input = "mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#C9A84C]/50";
  return (
    <main className="min-h-screen grid place-items-center px-4" style={{ background: "radial-gradient(120% 80% at 20% 0%, #151B2E 0%, #0A0E1A 60%)" }}>
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-cormorant), serif" }}>Set a new password</h1>
        <p className="text-white/45 mb-7 text-sm">Choose a password you don&apos;t use anywhere else.</p>
        {ready === "checking" ? <p className="text-white/50 text-sm">Checking your link…</p>
          : ready === "no" ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-200">
              This reset link has expired or was already used. <Link href="/forgot-password" className="font-bold text-[#C9A84C] underline">Get a new link</Link>.
            </div>
          ) : (
            <form onSubmit={save} className="flex flex-col gap-4">
              {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
              <label className="text-sm font-medium text-white/60">New password
                <input type="password" autoComplete="new-password" required autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" className={input} />
              </label>
              <label className="text-sm font-medium text-white/60">Type it again
                <input type="password" autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} className={input} />
              </label>
              <button type="submit" disabled={busy} className="rounded-2xl py-3.5 font-bold text-[#0A0E1A] disabled:opacity-60" style={{ background: "linear-gradient(135deg,#E8C97A,#C9A84C,#B8963E)" }}>
                {busy ? "Saving…" : "Save password and sign in"}
              </button>
            </form>
          )}
        <Link href="/login" className="mt-6 inline-block text-sm text-white/50 hover:text-white">← Back to sign in</Link>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><Reset /></Suspense>;
}
