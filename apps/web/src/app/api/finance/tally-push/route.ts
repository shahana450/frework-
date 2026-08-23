import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function escapeXml(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTallyDate(iso: string) {
  if (!iso) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  // Take only the date part (strip time component if present e.g. "2026-08-04T00:00:00")
  return iso.slice(0, 10).replace(/-/g, "");
}

const TALLY_VOUCHER_TYPE: Record<string, string> = {
  journal: "Journal",
  payment: "Payment",
  receipt: "Receipt",
  contra: "Contra",
  // Sales/Purchase require PARTYLEDGERNAME in Tally — use Journal to avoid rejection
  sales: "Journal",
  purchase: "Journal",
  expense: "Payment",
  debit_note: "Journal",
  credit_note: "Journal",
};

type JLine = { dr_amount: number; cr_amount: number; narration: string | null; fw_fin_chart_of_accounts: { name: string; type: string } | null };
type JRow  = { id: string; entry_no: string; date: string; narration: string; type: string; fw_fin_journal_lines: JLine[] };

const CASH_BANK_TYPES = new Set(["bank", "cash"]);

function buildVoucherXML(j: JRow, coName: string): string {
  const lines = j.fw_fin_journal_lines ?? [];
  // Payment/Receipt require a cash/bank ledger — fall back to Journal if none present
  let vtype = TALLY_VOUCHER_TYPE[j.type] ?? "Journal";
  if (vtype === "Payment" || vtype === "Receipt") {
    const hasCashBank = lines.some(l => CASH_BANK_TYPES.has(l.fw_fin_chart_of_accounts?.type ?? ""));
    if (!hasCashBank) vtype = "Journal";
  }
  let ledgerEntries = "";
  for (const line of lines) {
    const acc = escapeXml(line.fw_fin_chart_of_accounts?.name ?? "Miscellaneous");
    if (line.dr_amount > 0) {
      ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${acc}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>-${Number(line.dr_amount).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
    }
    if (line.cr_amount > 0) {
      ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${acc}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>${Number(line.cr_amount).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
    }
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        ${coName ? `<STATICVARIABLES><SVCURRENTCOMPANY>${coName}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${vtype}" ACTION="Create">
            <DATE>${formatTallyDate(j.date)}</DATE>
            <VOUCHERTYPENAME>${vtype}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(j.entry_no)}</VOUCHERNUMBER>
            <NARRATION>${escapeXml((j.narration ?? "").slice(0, 100))}</NARRATION>${ledgerEntries}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export async function POST(req: NextRequest) {
  try {
    const { journal_ids, business_id, company_name } = await req.json();

    if (!journal_ids?.length || !business_id) {
      return NextResponse.json({ error: "journal_ids and business_id required" }, { status: 400 });
    }

    const { data: journals, error } = await supabase
      .from("fw_fin_journals")
      .select(`
        id, entry_no, date, narration, type,
        fw_fin_journal_lines(
          dr_amount, cr_amount, narration,
          fw_fin_chart_of_accounts(name, type)
        )
      `)
      .in("id", journal_ids)
      .eq("business_id", business_id)
      .order("date");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!journals?.length) return NextResponse.json({ error: "No journals found for given IDs" }, { status: 404 });

    // Use provided company name, or fall back to business legal name, or omit (Tally uses active company)
    let coName = (company_name ?? "").trim();
    if (!coName) {
      const { data: biz } = await supabase.from("fw_fin_businesses").select("name,legal_name").eq("id", business_id).single();
      coName = escapeXml(biz?.legal_name ?? biz?.name ?? "");
    } else {
      coName = escapeXml(coName);
    }

    // Return one XML envelope per journal so the browser can push individually and track per-entry results
    const rows = journals as unknown as JRow[];
    const vouchers = rows.map(j => ({
      id: j.id,
      entry_no: j.entry_no,
      date: j.date,
      narration: j.narration,
      type: j.type,
      line_count: (j.fw_fin_journal_lines ?? []).length,
      xml: buildVoucherXML(j, coName),
    }));

    // Also return all unique ledger names + their account types so the browser can create missing ones
    const ledgerMap = new Map<string, string>();
    for (const j of rows) {
      for (const l of (j.fw_fin_journal_lines ?? [])) {
        const coa = l.fw_fin_chart_of_accounts;
        if (coa?.name) ledgerMap.set(coa.name, coa.type ?? "expense");
      }
    }
    const all_ledger_names = Array.from(ledgerMap.entries()).map(([name, type]) => ({ name, type }));

    return NextResponse.json({ vouchers, all_ledger_names });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
