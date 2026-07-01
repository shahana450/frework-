"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");

      if (code) {
        // PKCE flow — exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Auth exchange error:", error.message);
          router.replace("/login?error=auth_failed");
          return;
        }
      }

      // Session is now established — get it and upsert user
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const user = session.user;

      await supabase.from("fw_users").upsert({
        id: user.id,
        email: user.email ?? "",
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
        method: "google",
      }, { onConflict: "id" });

      router.replace("/dashboard");
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060C18]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
        <p className="text-white/50 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#060C18]">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
