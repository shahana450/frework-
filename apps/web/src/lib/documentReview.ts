// Document intake: extraction add-on for the AI and deterministic duplicate checks.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const DOCUMENT_ADDENDUM = `

DOCUMENT MODE: the user uploaded a document to be reviewed before posting. Fill the transaction fields as above
("kind":"record") AND add an "extracted" object with what is printed on the document (null when not shown):
"extracted": {"doc_type":"invoice|bill|receipt|credit_note|debit_note|salary_slip|bank_statement|other",
 "supplier":null,"customer":null,"gstin_supplier":null,"gstin_buyer":null,"invoice_no":null,"date":"YYYY-MM-DD",
 "taxable_value":0,"cgst":0,"sgst":0,"igst":0,"total":0,"hsn_sac":null,
 "items":[{"description":"","qty":0,"rate":0,"amount":0}]}
Copy numbers exactly as printed. Do not compute missing figures.`;

export type Extracted = {
  doc_type?: string | null; supplier?: string | null; customer?: string | null; gstin_supplier?: string | null; gstin_buyer?: string | null;
  invoice_no?: string | null; date?: string | null; taxable_value?: number | null; cgst?: number | null; sgst?: number | null; igst?: number | null;
  total?: number | null; hsn_sac?: string | null; items?: { description: string; qty: number; rate: number; amount: number }[] | null;
};

export type DuplicateHit = { kind: "same_file" | "posted_invoice" | "posted_amount" | "pending_invoice"; message: string; ref?: string };

export const fileHash = (base64: string) => createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Checks for an identical file, an already-posted invoice number, or a same-day same-amount entry. */
export async function findDuplicates(sb: SupabaseClient, businessId: string, opts: {
  docId: string; hash?: string | null; invoiceNo?: string | null; party?: string | null; date?: string | null; total?: number | null;
}): Promise<DuplicateHit[]> {
  const hits: DuplicateHit[] = [];
  const [docs, inv, sameDay, pending] = await Promise.all([
    opts.hash
      ? sb.from("fw_fin_documents").select("id,file_name,created_at,ai_summary").eq("business_id", businessId).neq("id", opts.docId).contains("ai_summary", { hash: opts.hash }).limit(3)
      : Promise.resolve({ data: [] as { id: string; file_name: string; created_at: string }[] }),
    opts.invoiceNo
      ? sb.from("fw_fin_journals").select("id,entry_no,date,reference_no,narration").eq("business_id", businessId).eq("status", "posted")
          .or(`reference_no.ilike.%${opts.invoiceNo.replace(/[%,()]/g, "")}%,narration.ilike.%${opts.invoiceNo.replace(/[%,()]/g, "")}%`).limit(5)
      : Promise.resolve({ data: [] as { id: string; entry_no: string; date: string; reference_no: string | null; narration: string | null }[] }),
    opts.date && opts.total
      ? sb.from("fw_fin_journals").select("id,entry_no,date,narration,total_debit").eq("business_id", businessId).eq("status", "posted").eq("date", opts.date).eq("total_debit", opts.total).limit(5)
      : Promise.resolve({ data: [] as { id: string; entry_no: string; date: string; narration: string | null; total_debit: number }[] }),
    opts.invoiceNo
      ? sb.from("fw_fin_documents").select("id,file_name,ai_summary,status").eq("business_id", businessId).neq("id", opts.docId).in("status", ["reviewed", "processing"]).contains("ai_summary", { invoice_no: opts.invoiceNo }).limit(3)
      : Promise.resolve({ data: [] as { id: string; file_name: string }[] }),
  ]);

  for (const d of docs.data ?? []) hits.push({ kind: "same_file", message: `The same file was already uploaded as "${d.file_name}".`, ref: d.id });
  const invNorm = opts.invoiceNo ? norm(opts.invoiceNo) : "";
  for (const j of inv.data ?? []) {
    // Only count it when the invoice number appears as a whole token, not inside a longer number
    const text = `${j.reference_no ?? ""} ${j.narration ?? ""}`;
    if (invNorm && text.split(/[\s,/#:()-]+/).some(t => norm(t) === invNorm) || norm(j.reference_no ?? "") === invNorm) {
      hits.push({ kind: "posted_invoice", message: `Invoice ${opts.invoiceNo} looks already posted as ${j.entry_no} on ${String(j.date).slice(0, 10)}.`, ref: j.id });
    }
  }
  for (const j of sameDay.data ?? []) {
    if (hits.some(h => h.ref === j.id)) continue;
    const partyMatch = opts.party && (j.narration ?? "").toLowerCase().includes(opts.party.toLowerCase());
    hits.push({ kind: "posted_amount", message: `${j.entry_no} on the same date has the same amount${partyMatch ? ` and mentions ${opts.party}` : ""}.`, ref: j.id });
  }
  for (const d of pending.data ?? []) hits.push({ kind: "pending_invoice", message: `"${d.file_name}" with the same invoice number is also waiting in the review queue.`, ref: d.id });
  return hits;
}
