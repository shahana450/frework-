"use client";
// Opens FreWork from a WhatsApp sign-in link (or the WhatsApp OTP on the login page): the one-time token becomes a session.
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { setActiveBusiness } from "@/lib/activeBusiness";

function WaSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const ran = useRef(false);   // the token works once: never verify it twice (a second run would report "expired")

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("t");
    if (!token) { setError("This sign-in link is incomplete."); return; }
    // Optional: open a page straight away (only FreWork finance pages) in the business the link was made for
    const next = params.get("next") ?? "", biz = params.get("biz") ?? "";
    supabase.auth.verifyOtp({ type: "magiclink", token_hash: token }).then(async ({ data, error: e }) => {
      let user = data?.user ?? null;
      if (e) {
        // Already used (e.g. tapped twice) but this browser is signed in from it: carry on instead of failing
        user = (await supabase.auth.getUser()).data.user;
        if (!user) { setError("This sign-in link has expired or was already used. Send LOGIN to FreBook on WhatsApp for a new one."); return; }
      }
      if (/^\/finance\/[\w\-/]+(\?[\w=&%\-]*)?$/.test(next)) {
        try { sessionStorage.setItem("fw_from_wa", "1"); } catch { /* */ }
        if (biz && user) setActiveBusiness(user.id, biz);
        router.replace(next);
        return;
      }
      // Came from WhatsApp: entries are recorded there, so the dashboard opens in "Ask your books" mode (this tab only)
      try { sessionStorage.setItem("fw_from_wa", "1"); } catch { /* */ }
      router.replace("/finance/select-business");
    });
  }, [params, router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F5F6FA", color: "#141A3A", padding: 16, fontFamily: "'Manrope',system-ui,sans-serif" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid rgba(20,26,58,0.1)", borderRadius: 18, padding: "28px 24px", maxWidth: 420, width: "100%", textAlign: "center" }}>
        {error ? <>
          <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Couldn&apos;t sign you in</h1>
          <p style={{ margin: "0 0 18px", color: "#5A6080", lineHeight: 1.55 }}>{error}</p>
          <Link href="/login" style={{ display: "inline-block", padding: "10px 18px", borderRadius: 11, background: "#232A63", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Go to sign in</Link>
        </> : <>
          <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Signing you in…</h1>
          <p style={{ margin: 0, color: "#5A6080" }}>Opening your FreBook dashboard.</p>
        </>}
      </div>
    </div>
  );
}

export default function WaSignInPage() {
  return <Suspense fallback={null}><WaSignIn /></Suspense>;
}
