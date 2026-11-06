// The invoice for a sale entry, as the invoice page shows it: the saved (edited) invoice if there is one, else a
// draft from the entry, the business and the customer. Server side (service client) — used by WhatsApp's INVOICE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { draftInvoice, type InvoiceDoc, type SourceJournal } from "./invoiceDoc";

export async function loadInvoiceDoc(sb: SupabaseClient, bizId: string, journalId: string): Promise<{ doc: InvoiceDoc; entryNo: string } | null> {
  const { data: j } = await sb.from("fw_fin_journals")
    .select("id,entry_no,date,type,narration,reference_no,party_name,contact_id,metadata,fw_fin_journal_lines(dr_amount,cr_amount,fw_fin_chart_of_accounts(name,type,sub_type))")
    .eq("id", journalId).eq("business_id", bizId).maybeSingle();
  if (!j) return null;
  const row = j as unknown as { id: string; entry_no: string; date: string; type: string; narration: string | null; reference_no: string | null; party_name: string | null; contact_id: string | null; metadata: Record<string, unknown> | null;
    fw_fin_journal_lines: { dr_amount: number; cr_amount: number; fw_fin_chart_of_accounts: { name: string; type: string; sub_type?: string | null } | null }[] };
  const [saved, { data: biz }] = await Promise.all([
    sb.from("fw_fin_invoice_docs").select("data").eq("journal_id", journalId).maybeSingle(),
    sb.from("fw_fin_businesses").select("*").eq("id", bizId).single(),
  ]);
  const b = (biz ?? {}) as Record<string, string | null>;
  if (saved.data?.data && Object.keys(saved.data.data).length) {
    // An edited invoice keeps its details; logo (if it had none) and signature come from the business now
    const d = saved.data.data as InvoiceDoc;
    return { doc: { ...d, seller: { ...d.seller, logo: d.seller?.logo || b.logo_url || null, signature: b.signature_url ?? null } }, entryNo: row.entry_no };
  }

  const src: SourceJournal = {
    id: row.id, entry_no: row.entry_no, date: String(row.date).slice(0, 10), type: row.type, narration: row.narration ?? "", reference_no: row.reference_no, party_name: row.party_name ?? null, metadata: row.metadata ?? null,
    lines: row.fw_fin_journal_lines.map(l => ({ dr: Number(l.dr_amount) || 0, cr: Number(l.cr_amount) || 0, account: l.fw_fin_chart_of_accounts?.name ?? "", accountType: l.fw_fin_chart_of_accounts?.type ?? null, subType: l.fw_fin_chart_of_accounts?.sub_type ?? null })),
  };
  const cq = row.contact_id ? sb.from("fw_fin_contacts").select("name,gstin,phone,email,city,state").eq("id", row.contact_id).maybeSingle()
    : row.party_name ? sb.from("fw_fin_contacts").select("name,gstin,phone,email,city,state").eq("business_id", bizId).ilike("name", row.party_name).limit(1).maybeSingle() : null;
  const c = (cq ? (await cq).data : null) as Record<string, string | null> | null;
  const seller: InvoiceDoc["seller"] = { name: b.legal_name || b.name || "", address: [b.address, b.city, b.pincode].filter(Boolean).join(", "), gstin: b.gstin ?? "", state: b.state ?? "", phone: b.phone ?? "", email: b.email ?? "", logo: b.logo_url ?? null, signature: b.signature_url ?? null, pan: b.pan ?? "" };
  return { doc: draftInvoice(src, seller, { name: c?.name ?? row.party_name ?? "", address: [c?.city].filter(Boolean).join(", "), gstin: c?.gstin ?? "", state: c?.state ?? "", phone: c?.phone ?? "", email: c?.email ?? "" }), entryNo: row.entry_no };
}
