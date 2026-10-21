// Files one document fetched from the Income-tax portal onto the Shelf. It is saved straight away (so the portal
// worker gets a quick reply); for notices the AI then fills in the year, reference, demand and reply date.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fileToShelf, fyOfDate } from "./shelf";
import { classifyDocument } from "./shelfClassify";

export type FetchedFile = { kind: string; name: string; data: string };   // data: base64
const DOC_TYPE: Record<string, string> = { notice: "Income-tax notice", "26as": "Form 26AS", ais: "AIS", tis: "TIS", filed_returns: "Filed returns" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Saved = { id: string; enrich: (() => Promise<void>) | null };

export async function fileFetchedDoc(sb: SupabaseClient, bizId: string, userId: string, f: FetchedFile, fy: string | null): Promise<Saved | null> {
  if (f.kind === "notice_text") return null;                  // page text is for diagnosis only, never a document
  const bytes = new Uint8Array(Buffer.from(f.data, "base64"));
  const isText = /\.txt$/i.test(f.name);
  const mime = isText ? "text/plain" : /\.zip$/i.test(f.name) ? "application/zip" : /\.json$/i.test(f.name) ? "application/json" : /\.csv$/i.test(f.name) ? "text/csv" : "application/pdf";
  const rack = f.kind === "notice" ? "notices" : "income_tax";
  const docType = DOC_TYPE[f.kind] ?? "Income-tax document";
  const pwNote = /^(AIS|TIS)$/.test(docType) ? " · PDF password: PAN in small letters + date of birth (ddmmyyyy)" : f.kind === "26as" ? " · if protected, password is date of birth (ddmmyyyy)" : "";
  const saved = await fileToShelf(sb, {
    businessId: bizId, actorId: userId, rack, title: `${docType} · ${f.name.replace(/\.(pdf|txt|zip|json|csv)$/i, "")}`.slice(0, 180),
    fileName: f.name, mime, bytes, source: "system", fy: f.kind === "notice" ? null : fy, docType, notes: "Fetched from the Income-tax portal" + pwNote,
  });
  if (!saved) return null;
  // Notices: read the PDF afterwards for its own year, reference, demand and reply date
  const enrich = f.kind === "notice" && mime === "application/pdf" ? async () => {
    const c = await classifyDocument(new File([bytes], f.name, { type: mime }));
    const docFy = (c.fy && /^\d{4}-\d{2}$/.test(c.fy) ? c.fy : null) || fyOfDate(c.date);
    const upd: Record<string, unknown> = {};
    if (c.title) upd.title = c.title.slice(0, 200);
    if (docFy) upd.fy = docFy;
    if (c.doc_type) upd.doc_type = c.doc_type;
    if (c.period) upd.period = c.period;
    if (c.reference) upd.reference = c.reference;
    if (c.authority) upd.authority = c.authority;
    if (typeof c.amount === "number" && isFinite(c.amount)) upd.amount = c.amount;
    if (c.reply_due && ISO.test(c.reply_due)) upd.reply_due = c.reply_due;
    if (c.summary) upd.ai_summary = c.summary;
    if (Object.keys(upd).length) await sb.from("fw_fin_shelf_items").update(upd).eq("id", saved.id);
  } : null;
  return { id: saved.id, enrich };
}
