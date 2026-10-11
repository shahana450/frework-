import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, serverError } from "@/lib/apiAuth";

// Company switcher: the signed-in user's businesses, real ones and test ones listed separately.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Biz = { id: string; name: string; legal_name: string | null; gstin: string | null; business_type: string | null; is_active: boolean | null; is_test?: boolean | null };

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const first = await supabase.from("fw_fin_businesses").select("id,name,legal_name,gstin,business_type,is_active,is_test").eq("owner_id", user.id).order("created_at");
    let data = first.data as Biz[] | null, error = first.error;
    if (error && /is_test/.test(error.message)) {
      const plain = await supabase.from("fw_fin_businesses").select("id,name,legal_name,gstin,business_type,is_active").eq("owner_id", user.id).order("created_at");
      data = plain.data as Biz[] | null; error = plain.error;
    }
    if (error) return serverError("businesses", error, "Couldn't load your businesses.");
    const all = (data ?? []) as Biz[];
    return NextResponse.json({ businesses: all.filter(b => !b.is_test), test: all.filter(b => !!b.is_test) });
  } catch (e) {
    return serverError("businesses", e, "Couldn't load your businesses.");
  }
}
