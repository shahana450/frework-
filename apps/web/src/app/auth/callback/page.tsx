"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const user = session.user;

      // Upsert into fw_users
      await supabase.from("fw_users").upsert({
        id: user.id,
        email: user.email ?? "",
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
        method: "google",
      }, { onConflict: "id" });

      // Go to mobile collection step
      router.replace("/login?step=mobile&uid=" + user.id);
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060C18]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
        <p className="text-white/50 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
