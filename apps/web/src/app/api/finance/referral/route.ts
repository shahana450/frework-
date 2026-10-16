import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { codeFor, discountFor } from "@/lib/referrals";
import { REFERRAL_DISCOUNT_PCT } from "@/lib/plans";

// GET: my referral link and what it has earned.  POST { code }: a new account signed up through someone's link.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const NEEDS_SQL = "Referrals need their database setup — run 2026-10-29_referrals.sql in Supabase.";
const missing = (m?: string) => /fw_referral|does not exist|schema cache/i.test(m ?? "");

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    let code: string;
    try { code = await codeFor(sb, user.id); } catch (e) { return missing((e as Error).message) ? NextResponse.json({ setup_needed: NEEDS_SQL }) : serverError("referral", e); }
    const { data: rows } = await sb.from("fw_referrals").select("referred_paid_at,referrer_credit_used").eq("referrer_id", user.id);
    const list = (rows ?? []) as { referred_paid_at: string | null; referrer_credit_used: boolean }[];
    const discount = await discountFor(sb, user.id);
    return NextResponse.json({
      code, link: `${req.nextUrl.origin}/register?ref=${code}`, pct: REFERRAL_DISCOUNT_PCT,
      joined: list.length, paid: list.filter(r => r.referred_paid_at).length,
      credits: list.filter(r => r.referred_paid_at && !r.referrer_credit_used).length,
      next_payment_discount: discount?.pct ?? 0, next_payment_reason: discount?.kind ?? null,
    });
  } catch (e) {
    return serverError("referral", e, "Couldn't load your referral link.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { code } = await req.json().catch(() => ({}));
    const c = String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!c) return NextResponse.json({ error: "No referral code." }, { status: 400 });
    const { data: owner, error } = await sb.from("fw_referral_codes").select("user_id").eq("code", c).maybeSingle();
    if (error) return missing(error.message) ? NextResponse.json({ setup_needed: NEEDS_SQL }) : serverError("referral/claim", error);
    if (!owner) return NextResponse.json({ error: "That referral code isn't valid." }, { status: 404 });
    if (owner.user_id === user.id) return NextResponse.json({ error: "You can't use your own referral code." }, { status: 400 });
    // Only a fresh account: not someone who has already paid
    const { data: paid } = await sb.from("fw_fin_subscriptions").select("amount").eq("user_id", user.id).gt("amount", 0).limit(1);
    if (paid?.length) return NextResponse.json({ error: "Referral discounts are for new accounts." }, { status: 409 });
    const { error: insErr } = await sb.from("fw_referrals").insert({ referrer_id: owner.user_id, referred_id: user.id, code: c });
    if (insErr && !/duplicate|unique/i.test(insErr.message)) throw insErr;
    return NextResponse.json({ ok: true, pct: REFERRAL_DISCOUNT_PCT });
  } catch (e) {
    return serverError("referral/claim", e, "Couldn't apply the referral.");
  }
}
