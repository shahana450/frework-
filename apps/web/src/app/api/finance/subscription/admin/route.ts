import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyGrant, findUserIdByEmail, type GrantAction } from "@/lib/grants";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!email || !ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: subs }, pending] = await Promise.all([
    supabaseAdmin.from("fw_fin_subscriptions").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("fw_fin_pending_grants").select("*").is("claimed_at", null).order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({ subs: subs ?? [], pending: pending.error ? [] : pending.data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerEmail(req);
  if (!caller || !ADMIN_EMAILS.includes(caller)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, user_id: rawUserId, plan: rawPlan, trial_days } = await req.json().catch(() => ({}));
  const plan = typeof rawPlan === "string" && rawPlan ? rawPlan : "professional";
  const raw = String(rawUserId ?? "").trim();
  if (!raw) return NextResponse.json({ error: "Enter a user ID or email." }, { status: 400 });

  try {
    // Resolve email → account. No account yet? Keep the grant pending until they sign up.
    let user_id: string | null = raw;
    if (raw.includes("@")) {
      if (!EMAIL_RE.test(raw)) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
      user_id = await findUserIdByEmail(supabaseAdmin, raw);
      if (!user_id) {
        const email = raw.toLowerCase();
        if (action === "revoke") {
          await supabaseAdmin.from("fw_fin_pending_grants").delete().eq("email", email);
          return NextResponse.json({ ok: true, message: `Pending access for ${email} removed.` });
        }
        if (action !== "grant_trial" && action !== "activate") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        const days = action === "grant_trial" ? Math.max(1, Math.min(365, Number(trial_days) || 7)) : 30;
        const { error } = await supabaseAdmin.from("fw_fin_pending_grants").upsert({
          email, action, plan, days, granted_by: caller, created_at: new Date().toISOString(), claimed_at: null, claimed_user: null,
        }, { onConflict: "email" });
        if (error) {
          if (/fw_fin_pending_grants|does not exist|schema cache/i.test(error.message)) return NextResponse.json({ error: "To grant access before sign-up, run 2026-10-10_pending_grants.sql in Supabase first." }, { status: 409 });
          return NextResponse.json({ error: "Couldn't save the pending grant." }, { status: 500 });
        }
        return NextResponse.json({ ok: true, pending: true, message: `${email} hasn't signed up yet — ${action === "grant_trial" ? `a ${days}-day trial` : "30 days of access"} will start automatically when they first sign in.` });
      }
    }

    if (action === "grant_trial") {
      const ends_at = await applyGrant(supabaseAdmin, user_id, "grant_trial" as GrantAction, plan, Math.max(1, Math.min(365, Number(trial_days) || 7)));
      return NextResponse.json({ ok: true, ends_at });
    }
    if (action === "activate") {
      const ends_at = await applyGrant(supabaseAdmin, user_id, "activate", plan, 30);
      return NextResponse.json({ ok: true, ends_at });
    }
    if (action === "revoke") {
      await supabaseAdmin.from("fw_fin_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", user_id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("subscription/admin", e);
    return NextResponse.json({ error: "Couldn't update access. Please try again." }, { status: 500 });
  }
}
