import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { buildDataExport, exportZipName } from "@/lib/dataExport";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
type Row = Record<string, unknown>;

async function all(table: string, select: string, businessId: string, filterCol = "business_id"): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).eq(filterCol, businessId).order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// GET /api/finance/data-export?business_id=… → ZIP of CSVs (ledgers, journals, lines, parties) for one business. Members only.
export async function GET(req: NextRequest) {
  const bizId = new URL(req.url).searchParams.get("business_id");
  const gate = await requireBusiness(req, bizId, { action: "export_data" });
  if (gate instanceof NextResponse) return gate;
  try {
    const { data: business } = await supabase.from("fw_fin_businesses").select("*").eq("id", bizId!).single();
    const [ledgers, journals, parties, financialYears] = await Promise.all([
      all("fw_fin_chart_of_accounts", "*", bizId!),
      all("fw_fin_journals", "*", bizId!),
      all("fw_fin_contacts", "*", bizId!),
      all("fw_fin_financial_years", "*", bizId!),
    ]);
    // Lines belong to journals; read them through the journal so only this business's lines come back
    const lines = (await all("fw_fin_journal_lines", "*, fw_fin_journals!inner(business_id)", bizId!, "fw_fin_journals.business_id"))
      .map(({ fw_fin_journals: _j, ...l }) => l);
    // Never export secrets kept on the business row
    const safeBusiness = Object.fromEntries(Object.entries(business ?? {}).filter(([k]) => !/password|secret|token|api_key/i.test(k)));
    const zip = buildDataExport({ business: safeBusiness, ledgers, journals, lines, parties, financialYears });
    await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "data_export", source: "settings", detail: { ledgers: ledgers.length, journals: journals.length, lines: lines.length, parties: parties.length } });
    const name = exportZipName(String(safeBusiness.name ?? "business"));
    return new NextResponse(zip as unknown as BodyInit, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return serverError("data-export", e, "We couldn't prepare your export. Please try again.");
  }
}
