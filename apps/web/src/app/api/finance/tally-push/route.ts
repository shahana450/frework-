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
  return iso.replace(/-/g, "");
}

const TALLY_VOUCHER_TYPE: Record<string, string> = {
  journal: "Journal", payment: "Payment", receipt: "Receipt",
  sales: "Sales", purchase: "Purchase", contra: "Contra",
  expense: "Payment", debit_note: "Debit Note", credit_note: "Credit Note",
};

export async function POST(req: NextRequest) {
  try {
    const { journal_ids, business_id, tally_url, company_name } = await req.json();

    if (!journal_ids?.length || !business_id) {
      return NextResponse.json({ error: "journal_ids and business_id required" }, { status: 400 });
    }

    // Fetch full journal data with lines — runs as service role, bypasses RLS
    const { data: journals, error } = await supabase
      .from("fw_fin_journals")
      .select(`
        id, entry_no, date, narration, type,
        fw_fin_journal_lines(
          dr_amount, cr_amount, narration,
          fw_fin_chart_of_accounts(name)
        )
      `)
      .in("id", journal_ids)
      .eq("business_id", business_id)
      .order("date");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!journals?.length) return NextResponse.json({ error: "No journals found for given IDs" }, { status: 404 });

    const coName = escapeXml(company_name ?? "Company");

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${coName}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>`;

    for (const j of journals as unknown as {
      id: string; entry_no: string; date: string; narration: string; type: string;
      fw_fin_journal_lines: { dr_amount: number; cr_amount: number; narration: string | null; fw_fin_chart_of_accounts: { name: string } | null }[];
    }[]) {
      const vtype = TALLY_VOUCHER_TYPE[j.type] ?? "Journal";
      const lines = j.fw_fin_journal_lines ?? [];
      xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${vtype}" ACTION="Create">
            <DATE>${formatTallyDate(j.date)}</DATE>
            <VOUCHERTYPENAME>${vtype}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(j.entry_no)}</VOUCHERNUMBER>
            <NARRATION>${escapeXml(j.narration ?? "")}</NARRATION>`;
      for (const line of lines) {
        const acc = escapeXml(line.fw_fin_chart_of_accounts?.name ?? "Miscellaneous");
        if (line.dr_amount > 0) {
          xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${acc}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${line.dr_amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
        }
        if (line.cr_amount > 0) {
          xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${acc}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${line.cr_amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
        }
      }
      xml += `
          </VOUCHER>
        </TALLYMESSAGE>`;
    }

    xml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    // Forward to Tally via bridge
    const tallyRes = await fetch(tally_url ?? "http://localhost:7001", {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xml,
      signal: AbortSignal.timeout(30000),
    });

    const tallyText = await tallyRes.text();
    const errors = (tallyText.match(/LINEERROR/gi) ?? []).length;

    return NextResponse.json({
      ok: errors === 0,
      pushed: journals.length,
      errors,
      msg: errors === 0
        ? `${journals.length} vouchers pushed to Tally successfully.`
        : `Pushed ${journals.length} vouchers — ${errors} had errors (check ledger names match Tally).`,
      tally_response: tallyText.slice(0, 500),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
