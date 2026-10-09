import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Per-provider sync summary for the Integrations page
export async function GET(req: NextRequest) {
  try {
    const bizId = new URL(req.url).searchParams.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const [pushed, failed, last, imported] = await Promise.all([
      supabase.from("fw_fin_integration_sync").select("journal_id", { count: "exact", head: true }).eq("business_id", bizId!).eq("provider", "tally").eq("status", "pushed"),
      supabase.from("fw_fin_integration_sync").select("journal_id", { count: "exact", head: true }).eq("business_id", bizId!).eq("provider", "tally").eq("status", "failed"),
      supabase.from("fw_fin_integration_sync").select("synced_at,target").eq("business_id", bizId!).eq("provider", "tally").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("fw_fin_journals").select("id", { count: "exact", head: true }).eq("business_id", bizId!).like("entry_no", "TLY-%"),
    ]);
    return NextResponse.json({
      tally: { pushed: pushed.count ?? 0, failed: failed.count ?? 0, imported: imported.count ?? 0, last_sync: last.data?.synced_at ?? null, company: last.data?.target ?? null, setup_needed: !!pushed.error },
    });
  } catch (e) {
    return serverError("integrations/status", e, "We couldn't load integration status.");
  }
}
