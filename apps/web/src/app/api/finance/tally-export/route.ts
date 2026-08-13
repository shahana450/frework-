import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JournalRow = {
  id: string;
  entry_no: string;
  date: string;
  narration: string;
  type: string;
  reference_no: string | null;
  fw_fin_journal_lines: {
    dr_amount: number;
    cr_amount: number;
    narration: string | null;
    fw_fin_chart_of_accounts: { name: string } | null;
  }[];
};

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTallyDate(iso: string) {
  // Tally uses YYYYMMDD
  return iso.replace(/-/g, "");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bizId = searchParams.get("business_id");
  const fyId = searchParams.get("fy_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!bizId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  // Get business info
  const { data: biz } = await supabase.from("fw_fin_businesses").select("name,legal_name").eq("id", bizId).single();

  // Get posted journals with lines
  let query = supabase
    .from("fw_fin_journals")
    .select(`
      id, entry_no, date, narration, type, reference_no,
      fw_fin_journal_lines(
        dr_amount, cr_amount, narration,
        fw_fin_chart_of_accounts(name)
      )
    `)
    .eq("business_id", bizId)
    .eq("status", "posted");

  if (fyId) query = query.eq("financial_year_id", fyId);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data: journals, error } = await query.order("date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const companyName = escapeXml(biz?.legal_name ?? biz?.name ?? "Company");
  const rows = (journals as unknown as JournalRow[]) ?? [];

  // Build Tally XML
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>`;

  const TALLY_VOUCHER_TYPE: Record<string, string> = {
    journal: "Journal", payment: "Payment", receipt: "Receipt",
    sales: "Sales", purchase: "Purchase", contra: "Contra",
    debit_note: "Debit Note", credit_note: "Credit Note",
  };

  for (const j of rows) {
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
      const accName = line.fw_fin_chart_of_accounts?.name ?? "Unknown";
      if (line.dr_amount > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(accName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${line.dr_amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }
      if (line.cr_amount > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(accName)}</LEDGERNAME>
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

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="frework-tally-export-${new Date().toISOString().split("T")[0]}.xml"`,
    },
  });
}
