// Virtual Shelf: racks, financial-year helper, and filing a file onto the shelf from any server route.
import type { SupabaseClient } from "@supabase/supabase-js";

export const RACKS = [
  { key: "gst", label: "GST", hint: "GSTR-1, 3B, 9, 2B, challans, e-way bills" },
  { key: "income_tax", label: "Income Tax", hint: "ITR, ITR-V, 26AS, AIS, advance tax challans" },
  { key: "tds", label: "TDS", hint: "TDS returns, Form 16/16A, challans" },
  { key: "notices", label: "Notices", hint: "GST, income tax and other department notices" },
  { key: "bank", label: "Bank", hint: "Statements, FD receipts, loan letters" },
  { key: "bills", label: "Bills & Invoices", hint: "Sales invoices, purchase bills, vouchers" },
  { key: "payroll", label: "Payroll", hint: "Salary sheets, PF / ESI challans and returns" },
  { key: "registrations", label: "Registrations", hint: "GST, PAN, TAN, Udyam, licences, deeds" },
  { key: "others", label: "Others", hint: "Anything else" },
] as const;
export type RackKey = typeof RACKS[number]["key"];
export const isRack = (k: unknown): k is RackKey => RACKS.some(r => r.key === k);

/** "2026-10-04" → "2026-27" (Indian financial year, April–March). */
export function fyOfDate(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return null;
  const y = +date.slice(0, 4), m = +date.slice(5, 7);
  const s = m >= 4 ? y : y - 1;
  return `${s}-${String(s + 1).slice(2)}`;
}

export type ShelfFile = {
  businessId: string; actorId: string | null; rack: RackKey; title: string; fileName: string; mime: string; bytes: Uint8Array;
  source: "upload" | "frebook" | "statement" | "gstr1" | "system"; fy?: string | null; period?: string | null; docType?: string | null;
  reference?: string | null; authority?: string | null; replyDue?: string | null; amount?: number | null; aiSummary?: string | null; notes?: string | null;
};

const safeName = (s: string) => s.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "file";

/** Stores the file in the private bucket and records it. Never throws — filing must not break the caller. */
export async function fileToShelf(sb: SupabaseClient, f: ShelfFile): Promise<{ id: string } | null> {
  try {
    const path = `${f.businessId}/${f.rack}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName(f.fileName)}`;
    const up = await sb.storage.from("shelf").upload(path, f.bytes, { contentType: f.mime || "application/octet-stream", upsert: false });
    if (up.error) { console.error("shelf upload", up.error.message); return null; }
    const { data, error } = await sb.from("fw_fin_shelf_items").insert({
      business_id: f.businessId, rack: f.rack, fy: f.fy ?? null, period: f.period ?? null, title: f.title.slice(0, 200), doc_type: f.docType ?? null,
      file_path: path, file_name: f.fileName.slice(0, 200), mime: f.mime, size_bytes: f.bytes.byteLength, source: f.source,
      reference: f.reference ?? null, authority: f.authority ?? null, reply_due: f.replyDue ?? null, amount: f.amount ?? null,
      ai_summary: f.aiSummary ?? null, notes: f.notes ?? null, created_by: f.actorId,
    }).select("id").single();
    if (error) { console.error("shelf record", error.message); await sb.storage.from("shelf").remove([path]); return null; }
    return data;
  } catch (e) { console.error("shelf", e); return null; }
}
