import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";
import { claimTrial, type TrialStore } from "@/lib/claimTrial";

// One free week of FreBook, once per account. The user claims it themselves from the pricing page.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const store: TrialStore = {
  async findAny(userId) {
    // limit(1), not maybeSingle(): a user with several rows (renewals, old plans) must still count as "already used"
    const { data, error } = await supabase.from("fw_fin_subscriptions").select("status,plan,subscription_ends_at").eq("user_id", userId).limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  },
  async insertTrial(row) {
    const { error } = await supabase.from("fw_fin_subscriptions").insert(row);
    return { error: error ? error.message : null };
  },
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const r = await claimTrial(store, user.id);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    return serverError("subscription/claim-trial", e, "Couldn't start your free trial. Please try again.");
  }
}
