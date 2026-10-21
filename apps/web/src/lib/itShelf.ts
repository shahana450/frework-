// Files one document fetched from the Income-tax portal onto the Shelf. Notices are read by the AI for their own
// year, reference, demand and reply date; 26AS / AIS / TIS (password-protected PDFs) take the year asked for.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fileToShelf, fyOfDate } from "./shelf";
import { classifyDocument } from "./shelfClassify";

export type FetchedFile = { kind: string; name: string; data: string };   // data: base64
const DOC_TYPE: Record<string, string> = { notice: "Income-tax notice", "26as": "Form 26AS", ais: "AIS", tis: "TIS", filed_returns: "Filed returns" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function fileFetchedDoc(sb: SupabaseClient, bizId: string, userId: string, f: FetchedFile, fy: string | null): Promise<boolean> {
  if (f.kind === "notice_text") return false;                 // page text is for diagnosis only, never a document
  const bytes = new Uint8Array(Buffer.from(f.data, "base64"));
  const isText = /\.txt$/i.test(f.name);
  const mime = isText ? "text/plain" : /\.zip$/i.test(f.name) ? "application/zip" : /\.json$/i.test(f.name) ? "application/json" : "application/pdf";
  const rack = f.kind === "notice" ? "notices" : "income_tax";
  const docType = DOC_TYPE[f.kind] ?? "Income-tax document";
  const c = f.kind === "notice" && mime === "application/pdf" ? await classifyDocument(new File([bytes], f.name, { type: mime })) : {};
  const docFy = (c.fy && /^\d{4}-\d{2}$/.test(c.fy) ? c.fy : null) || fyOfDate(c.date) || (f.kind === "notice" ? null : fy);
  const pwNote = /^(AIS|TIS)$/.test(docType) ? " · PDF password: PAN in small letters + date of birth (ddmmyyyy)" : f.kind === "26as" ? " · if protected, password is date of birth (ddmmyyyy)" : "";
  const saved = await fileToShelf(sb, {
    businessId: bizId, actorId: userId, rack, title: (c.title || `${docType} · ${f.name.replace(/\.(pdf|txt|zip|json)$/i, "")}`).slice(0, 180),
    fileName: f.name, mime, bytes, source: "system", fy: docFy, docType: c.doc_type || docType, period: c.period ?? null,
    reference: c.reference ?? null, authority: c.authority ?? null, amount: typeof c.amount === "number" && isFinite(c.amount) ? c.amount : null,
    replyDue: c.reply_due && ISO.test(c.reply_due) ? c.reply_due : null, aiSummary: c.summary ?? null, notes: "Fetched from the Income-tax portal" + pwNote,
  });
  return !!saved;
}
