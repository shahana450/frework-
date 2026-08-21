import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["admin.frework@gmail.com"];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCallerEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.email ?? null;
}

export async function GET(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!email || !ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: subs } = await supabaseAdmin
    .from("fw_fin_subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ subs: subs ?? [] });
}

export async function POST(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!email || !ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, user_id: rawUserId, plan, trial_days } = await req.json();

  // Resolve email → UUID if needed
  let user_id = rawUserId;
  if (rawUserId && rawUserId.includes("@")) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const match = users.find((u) => u.email === rawUserId);
    if (!match) return NextResponse.json({ error: `No user found with email ${rawUserId}` }, { status: 404 });
    user_id = match.id;
  }

  if (action === "grant_trial") {
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + (trial_days ?? 7));
    await supabaseAdmin.from("fw_fin_subscriptions").upsert({
      user_id,
      plan: plan ?? "professional",
      amount: 0,
      status: "trial",
      trial_ends_at: endsAt.toISOString(),
      subscription_ends_at: endsAt.toISOString(),
      granted_by_admin: true,
      payment_id: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return NextResponse.json({ ok: true, ends_at: endsAt.toISOString() });
  }

  if (action === "revoke") {
    await supabaseAdmin.from("fw_fin_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", user_id);
    return NextResponse.json({ ok: true });
  }

  if (action === "activate") {
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 30);
    await supabaseAdmin.from("fw_fin_subscriptions").upsert({
      user_id, plan: plan ?? "professional", amount: 0,
      status: "active", subscription_ends_at: endsAt.toISOString(),
      granted_by_admin: true, payment_id: "admin_grant",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

