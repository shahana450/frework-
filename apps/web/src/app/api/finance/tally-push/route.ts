import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { tallyGroupFor } from "@/lib/ledgerHeads";
import { voucherXml, ledgerMastersXml, openingBalancesXml } from "@/lib/integrations/tally";
import { checkTallyTarget } from "@/lib/tallyTarget";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type JRow = {
  id: string; entry_no: string; date: string; narration: string | null; type: string;
  fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string; type: string; sub_type: string | null } | null }[];
};

// Builds Tally XML for FreWork entries. The browser sends it to Tally through the local bridge,
// because Tally runs on the user's PC and isn't reachable from the server.
export async function POST(req: NextRequest) {
  try {
    const { journal_ids, business_id, company_name } = await req.json();
    const gate = await requireBusiness(req, business_id, { action: "integrate" });
    if (gate instanceof NextResponse) return gate;
    if (!Array.isArray(journal_ids) || !journal_ids.length) return NextResponse.json({ error: "Choose entries to push." }, { status: 400 });

    const { data, error } = await supabase.from("fw_fin_journals")
      .select("id,entry_no,date,narration,type,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type,sub_type))")
      .in("id", journal_ids.slice(0, 200)).eq("business_id", business_id).eq("status", "posted").not("entry_no", "like", "TLY-%").order("date");   // imported from Tally: never sent back
    if (error) return serverError("tally-push", error, "We couldn't prepare these entries for Tally.");
    if (!data?.length) return NextResponse.json({ error: "None of these entries can be pushed (only posted entries can)." }, { status: 404 });

    // B5 — push only into the Tally company linked to THIS business
    let bizRow = await supabase.from("fw_fin_businesses").select("name,legal_name,tally_company").eq("id", business_id).single();
    const hasLink = !bizRow.error;
    if (bizRow.error) bizRow = await supabase.from("fw_fin_businesses").select("name,legal_name").eq("id", business_id).single() as typeof bizRow;
    const b = (bizRow.data ?? {}) as { name?: string; legal_name?: string | null; tally_company?: string | null };
    const target = checkTallyTarget(hasLink ? (b.tally_company ?? null) : undefined, company_name, b.legal_name ?? b.name ?? "This business");
    if (!target.ok) return NextResponse.json({ error: target.error, code: "TALLY_COMPANY_MISMATCH" }, { status: target.status });
    const company = target.company;

    const rows = data as unknown as JRow[];
    // Which of these is the opening-balances entry (looked up separately so it can never block a push)
    const { data: op } = await supabase.from("fw_fin_journals").select("id").eq("business_id", business_id).in("id", rows.map(r => r.id)).eq("source", "opening_balances");
    const openingIds = new Set((op ?? []).map(o => o.id));
    // The opening-balances entry goes to Tally as ledger opening balances, everything else as vouchers
    const vouchers = rows.map(j => openingIds.has(j.id) ? ({
      id: j.id, entry_no: j.entry_no, date: j.date, narration: j.narration, type: j.type, opening: true,
      line_count: (j.fw_fin_journal_lines ?? []).length,
      xml: openingBalancesXml((j.fw_fin_journal_lines ?? []).map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts })), company),
    }) : ({
      id: j.id, entry_no: j.entry_no, date: j.date, narration: j.narration, type: j.type,
      line_count: (j.fw_fin_journal_lines ?? []).length,
      xml: voucherXml({
        id: j.id, entry_no: j.entry_no, date: j.date, narration: j.narration ?? "", type: j.type,
        lines: (j.fw_fin_journal_lines ?? []).map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts })),
      }, company),
    }));

    const ledgers = new Map<string, { type: string; group: string }>();
    for (const j of rows) for (const l of j.fw_fin_journal_lines ?? []) {
      const a = l.fw_fin_chart_of_accounts;
      if (a?.name) ledgers.set(a.name, { type: a.type ?? "expense", group: tallyGroupFor(a.name, a.type ?? "expense", a.sub_type ?? null) });
    }
    const all_ledger_names = [...ledgers].map(([name, v]) => ({ name, type: v.type, group: v.group }));
    return NextResponse.json({ vouchers, all_ledger_names, masters_xml: ledgerMastersXml(all_ledger_names, company) });
  } catch (e) {
    return serverError("tally-push", e, "We couldn't prepare these entries for Tally.");
  }
}
