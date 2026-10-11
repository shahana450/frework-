import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";

// Company switcher: businesses the signed-in user owns, plus those they were invited to (team members),
// real ones and test ones listed separately.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Biz = { id: string; name: string; legal_name: string | null; gstin: string | null; business_type: string | null; is_active: boolean | null; is_test?: boolean | null; deleted_at?: string | null; role?: string };

async function select(col: "owner_id" | "id", vals: string[]) {
  if (!vals.length) return [] as Biz[];
  const q = (cols: string) => supabase.from("fw_fin_businesses").select(cols).in(col, vals).order("created_at");
  let { data, error } = await q("*");
  if (error) ({ data, error } = await q("id,name,legal_name,gstin,business_type,is_active"));
  if (error) throw error;
  return ((data ?? []) as unknown as Biz[]).filter(b => !b.deleted_at);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const owned = (await select("owner_id", [user.id])).map(b => ({ ...b, role: "owner" }));

    // Invitations count only for a confirmed email, so nobody can claim one by signing up with someone else's address
    let shared: Biz[] = [];
    if (user.email && user.email_confirmed_at) {
      const email = user.email.replace(/[\\%_]/g, c => `\\${c}`);
      const { data: rows } = await supabase.from("fw_fin_team_members").select("id,business_id,role,status").ilike("invited_email", email).in("status", ["active", "pending"]);
      const mine = (rows ?? []) as { id: string; business_id: string; role: string; status: string }[];
      const pending = mine.filter(r => r.status === "pending").map(r => r.id);
      if (pending.length) await supabase.from("fw_fin_team_members").update({ status: "active" }).in("id", pending);
      const roleBy = new Map(mine.map(r => [r.business_id, r.role]));
      shared = (await select("id", [...roleBy.keys()])).filter(b => !owned.some(o => o.id === b.id)).map(b => ({ ...b, role: roleBy.get(b.id) }));
    }

    const all = [...owned, ...shared].map(({ deleted_at: _d, ...b }) => b);
    return NextResponse.json({ businesses: all.filter(b => !b.is_test), test: all.filter(b => !!b.is_test) });
  } catch (e) {
    return serverError("businesses", e, "Couldn't load your businesses.");
  }
}
