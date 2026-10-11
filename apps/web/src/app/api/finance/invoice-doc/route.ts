import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { draftInvoice, isIncomeEntry, type InvoiceDoc, type SourceJournal } from "@/lib/invoiceDoc";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "Run 2026-10-08_invoices_logo.sql in Supabase to save invoice edits.";
const missingTable = (m?: string) => /fw_fin_invoice_docs|logo_url|does not exist|schema cache/i.test(m ?? "");

// GET: the saved invoice for an entry, or a fresh draft from the entry + business + customer details
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const bizId = sp.get("business_id"), journalId = sp.get("journal_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;
    if (!journalId) return NextResponse.json({ error: "Choose an entry." }, { status: 400 });

    // Older databases may lack some optional columns — fall back step by step instead of failing
    const attempts = [
      "id,entry_no,date,type,narration,reference_no,party_name,contact_id,metadata,status,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type,sub_type))",
      "id,entry_no,date,type,narration,reference_no,party_name,metadata,status,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type,sub_type))",
      "id,entry_no,date,type,narration,reference_no,status,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type))",
    ];
    let j: unknown = null, lastErr: { message: string } | null = null;
    for (const cols of attempts) {
      const r = await supabase.from("fw_fin_journals").select(cols).eq("id", journalId).eq("business_id", bizId!).maybeSingle();
      if (!r.error) { j = r.data; lastErr = null; break; }
      lastErr = r.error;
    }
    if (lastErr) return serverError("invoice-doc load", lastErr, "We couldn't read this entry.");
    if (!j) {
      // Not in this business — most often the entry belongs to another business selected in a different tab
      const { data: other } = await supabase.from("fw_fin_journals").select("business_id").eq("id", journalId).maybeSingle();
      return NextResponse.json({ error: other ? "This entry belongs to a different business. Switch to that business and try again." : "Entry not found." }, { status: 404 });
    }
    const row = j as unknown as { id: string; entry_no: string; date: string; type: string; narration: string | null; reference_no: string | null; party_name: string | null; contact_id: string | null; metadata: Record<string, unknown> | null; status: string; fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string; type: string; sub_type?: string | null } | null }[] };
    const src: SourceJournal = {
      id: row.id, entry_no: row.entry_no, date: String(row.date).slice(0, 10), type: row.type, narration: row.narration ?? "", reference_no: row.reference_no, party_name: row.party_name ?? null, metadata: row.metadata ?? null,
      lines: row.fw_fin_journal_lines.map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "", accountType: l.fw_fin_chart_of_accounts?.type, subType: l.fw_fin_chart_of_accounts?.sub_type ?? null })),
    };

    const saved = await supabase.from("fw_fin_invoice_docs").select("data,updated_at").eq("journal_id", journalId).maybeSingle();
    const canSave = !saved.error || !missingTable(saved.error.message);
    if (saved.data?.data && Object.keys(saved.data.data).length) return NextResponse.json({ doc: saved.data.data, saved_at: saved.data.updated_at, can_save: canSave, entry_no: row.entry_no, income: isIncomeEntry(src.lines) });

    const { data: biz } = await supabase.from("fw_fin_businesses").select("*").eq("id", bizId!).single();
    const b = (biz ?? {}) as Record<string, string | null>;
    const contactQ = row.contact_id
      ? supabase.from("fw_fin_contacts").select("name,gstin,phone,email,city,state").eq("id", row.contact_id).maybeSingle()
      : row.party_name ? supabase.from("fw_fin_contacts").select("name,gstin,phone,email,city,state").eq("business_id", bizId!).ilike("name", row.party_name).limit(1).maybeSingle() : null;
    const c = (contactQ ? (await contactQ).data : null) as Record<string, string | null> | null;

    const seller: InvoiceDoc["seller"] = {
      name: b.legal_name || b.name || "", address: [b.address, b.city, b.pincode].filter(Boolean).join(", "), gstin: b.gstin ?? "", state: b.state ?? "",
      phone: b.phone ?? "", email: b.email ?? "", logo: b.logo_url ?? null, pan: b.pan ?? "",
    };
    const doc = draftInvoice(src, seller, { name: c?.name ?? row.party_name ?? "", address: [c?.city].filter(Boolean).join(", "), gstin: c?.gstin ?? "", state: c?.state ?? "", phone: c?.phone ?? "", email: c?.email ?? "" });
    return NextResponse.json({ doc, saved_at: null, can_save: canSave, entry_no: row.entry_no, income: isIncomeEntry(src.lines) });
  } catch (e) {
    return serverError("invoice-doc", e, "We couldn't prepare the invoice.");
  }
}

// POST: save edits made on the invoice (the posted entry itself is never changed here)
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { business_id?: string; journal_id?: string; doc?: InvoiceDoc };
    const gate = await requireBusiness(req, b.business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    if (!b.journal_id || !b.doc || !Array.isArray(b.doc.items)) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    const size = JSON.stringify(b.doc).length;
    if (size > 400_000) return NextResponse.json({ error: "The invoice is too large to save — use a smaller logo." }, { status: 413 });

    const { data: j } = await supabase.from("fw_fin_journals").select("id,contact_id").eq("id", b.journal_id).eq("business_id", b.business_id!).maybeSingle();
    if (!j) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

    // Same invoice number on another entry? Ask before saving.
    if (req.headers.get("x-confirm-duplicate") !== "1" && b.doc.invoiceNo) {
      const { data: same } = await supabase.from("fw_fin_invoice_docs").select("journal_id").eq("business_id", b.business_id!).eq("invoice_no", b.doc.invoiceNo).neq("journal_id", b.journal_id).limit(1);
      if (same?.length) return NextResponse.json({ code: "POSSIBLE_DUPLICATE", error: `Invoice number ${b.doc.invoiceNo} is already used on another invoice.` }, { status: 409 });
    }

    const { error } = await supabase.from("fw_fin_invoice_docs").upsert({
      business_id: b.business_id, journal_id: b.journal_id, invoice_no: b.doc.invoiceNo?.slice(0, 40) ?? null, data: b.doc, updated_by: gate.user.id, updated_at: new Date().toISOString(),
      ...((j as { contact_id?: string | null } | null)?.contact_id ? { party_id: (j as { contact_id: string }).contact_id } : {}),
    }, { onConflict: "journal_id" });
    if (error) {
      if (missingTable(error.message)) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
      return serverError("invoice-doc save", error, "We couldn't save the invoice.");
    }
    return NextResponse.json({ ok: true, saved_at: new Date().toISOString() });
  } catch (e) {
    return serverError("invoice-doc save", e, "We couldn't save the invoice.");
  }
}
