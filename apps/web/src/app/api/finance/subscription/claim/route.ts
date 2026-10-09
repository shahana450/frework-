import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/apiAuth";
import { applyGrant, type GrantAction } from "@/lib/grants";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// First sign-in: turn on access an admin granted to this email before the account existed
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const email = (user.email ?? "").toLowerCase();
  if (!email) return NextResponse.json({ claimed: false });

  const { data: g, error } = await supabase.from("fw_fin_pending_grants").select("*").eq("email", email).is("claimed_at", null).maybeSingle();
  if (error || !g) return NextResponse.json({ claimed: false });

  try {
    const ends_at = await applyGrant(supabase, user.id, g.action as GrantAction, g.plan ?? "professional", Number(g.days) || 7);
    await supabase.from("fw_fin_pending_grants").update({ claimed_at: new Date().toISOString(), claimed_user: user.id }).eq("email", email);
    return NextResponse.json({ claimed: true, ends_at });
  } catch (e) {
    console.error("subscription/claim", e);
    return NextResponse.json({ claimed: false }, { status: 500 });
  }
}
