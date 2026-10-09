import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PROVIDERS = ["tally"];
const missingTable = (m: string) => /fw_fin_integration_sync|does not exist|schema cache/i.test(m);

// Sync status per entry and provider, shared across devices (replaces browser-only storage)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const bizId = sp.get("business_id"), provider = sp.get("provider") ?? "tally";
  const gate = await requireBusiness(req, bizId);
  if (gate instanceof NextResponse) return gate;
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("fw_fin_integration_sync").select("journal_id,status,external_ref,target,error,synced_at")
      .eq("business_id", bizId!).eq("provider", provider).range(from, from + 999);
    if (error) return missingTable(error.message) ? NextResponse.json({ rows: [], setup_needed: true }) : serverError("integrations/sync", error);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  try {
    const { business_id, provider = "tally", target, results } = await req.json() as {
      business_id: string; provider?: string; target?: string;
      results: { journal_id: string; status: "pushed" | "failed" | "found"; external_ref?: string | null; error?: string | null }[];
    };
    const gate = await requireBusiness(req, business_id, { action: "integrate" });
    if (gate instanceof NextResponse) return gate;
    if (!PROVIDERS.includes(provider) || !Array.isArray(results) || !results.length) return NextResponse.json({ error: "Nothing to record." }, { status: 400 });

    // Only this business's entries
    const ids = [...new Set(results.map(r => r.journal_id))];
    const { data: own } = await supabase.from("fw_fin_journals").select("id").eq("business_id", business_id).in("id", ids);
    const ok = new Set((own ?? []).map(j => j.id));
    const rows = results.filter(r => ok.has(r.journal_id) && ["pushed", "failed", "found"].includes(r.status)).map(r => ({
      business_id, journal_id: r.journal_id, provider, status: r.status, external_ref: r.external_ref ?? null,
      target: target ?? null, error: r.error?.slice(0, 500) ?? null, synced_by: gate.user.id, synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("fw_fin_integration_sync").upsert(rows, { onConflict: "journal_id,provider" });
    if (error) return missingTable(error.message) ? NextResponse.json({ ok: false, setup_needed: true }) : serverError("integrations/sync", error);

    const pushed = rows.filter(r => r.status === "pushed").length;
    if (pushed) await logAudit(supabase, { businessId: business_id, actor: gate.user.id, action: "tally_push", source: "integration", detail: { pushed, failed: rows.filter(r => r.status === "failed").length, target } });
    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (e) {
    return serverError("integrations/sync", e, "We couldn't save the sync status.");
  }
}
