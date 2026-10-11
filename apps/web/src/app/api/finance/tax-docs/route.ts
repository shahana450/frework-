import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { accessToken, BASE } from "@/lib/portals/sandbox";
import { PortalError } from "@/lib/portals/types";
import { summarize26AS, summarizeForm16, compareTds } from "@/lib/taxDocs";

// Reads a Form 26AS or Form 16 PDF through Sandbox OCR and, for 26AS, compares TDS with the books.
// The PDF goes only to Sandbox; nothing is posted.
export const maxDuration = 60;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** TDS deducted by customers, recorded in the books (TDS receivable side) for a financial year like "2025-26". */
async function booksTds(bizId: string, fy: string) {
  const y = Number((fy.match(/(\d{4})/) ?? [])[1]);
  if (!y) return null;
  const { data: accs } = await supabase.from("fw_fin_chart_of_accounts").select("id,name").eq("business_id", bizId);
  const ids = (accs ?? []).filter(a => /tds|tax deducted/i.test(a.name) && !/payable|deducted at source payable|to be deposited/i.test(a.name) && /receivable|deducted by|advance|credit|asset|recoverable|tds\s*$/i.test(a.name)).map(a => a.id);
  if (!ids.length) return 0;
  let sum = 0;
  for (let i = 0; i < ids.length; i += 50) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("fw_fin_journal_lines").select("dr_amount,cr_amount,fw_fin_journals!inner(business_id,status,date)")
        .in("account_id", ids.slice(i, i + 50)).eq("fw_fin_journals.business_id", bizId).eq("fw_fin_journals.status", "posted")
        .gte("fw_fin_journals.date", `${y}-04-01`).lte("fw_fin_journals.date", `${y + 1}-03-31`).range(from, from + 999);
      for (const l of (data ?? []) as { dr_amount: number; cr_amount: number }[]) sum += (Number(l.dr_amount) || 0) - (Number(l.cr_amount) || 0);
      if (!data || data.length < 1000) break;
    }
  }
  return Math.round(sum * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const bizId = String(form.get("business_id") ?? "");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    const file = form.get("file");
    if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: "Choose a PDF." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "The PDF is larger than 10 MB." }, { status: 400 });
    const kind = String(form.get("kind") ?? "26as") === "form16" ? "form16" : "26as";
    const password = String(form.get("password") ?? "").trim();

    const token = await accessToken();
    const fd = new FormData(); fd.append("file", file, (file as File).name || `${kind}.pdf`);
    const path = kind === "26as" ? "/it/ocr/form-26as/pdf" : `/it/ocr/form-16/pdf${password ? `?password=${encodeURIComponent(password)}` : ""}`;
    const r = await fetch(`${BASE()}${path}`, { method: "POST", headers: { authorization: token, "x-api-key": process.env.SANDBOX_API_KEY!, "x-api-version": "1.0.0" }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(d?.message ?? "");
      if (/password/i.test(msg)) return NextResponse.json({ error: "This PDF is password protected — enter its password (usually PAN in lowercase + date of birth DDMMYYYY).", needsPassword: true }, { status: 400 });
      if (r.status === 401 || r.status === 403) return NextResponse.json({ error: "Sandbox refused the request — check that the Income Tax OCR API is enabled on your Sandbox plan." }, { status: 502 });
      return NextResponse.json({ error: msg || `Couldn't read this ${kind === "26as" ? "Form 26AS" : "Form 16"} (Sandbox error ${r.status}).` }, { status: 502 });
    }
    if (kind === "form16") return NextResponse.json({ kind, form16: summarizeForm16(d) });
    const s = summarize26AS(d);
    const inBooks = await booksTds(bizId, s.fy).catch(() => null);
    return NextResponse.json({ kind, form26as: s, compare: inBooks == null ? null : compareTds(s, inBooks) });
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message }, { status: e.code === "NOT_CONFIGURED" ? 503 : 502 });
    return serverError("tax-docs", e, "Couldn't read this document. Please try again.");
  }
}
