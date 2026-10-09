import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { readAttachment } from "@/lib/attachments";
import { getAI } from "@/lib/ai";
import { RACKS, isRack, fyOfDate, fileToShelf, type RackKey } from "@/lib/shelf";
import { logAudit } from "@/lib/audit";

export const maxDuration = 120;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NEEDS_SQL = "The Shelf needs its database setup — run 2026-10-11_shelf.sql in Supabase.";
const missing = (m?: string) => /fw_fin_shelf_items|does not exist|schema cache|Bucket not found/i.test(m ?? "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// GET: list the shelf (filters: rack, fy, q) — or ?download=<id> for a 2-minute private link
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const bizId = sp.get("business_id");
    const gate = await requireBusiness(req, bizId);
    if (gate instanceof NextResponse) return gate;

    const dl = sp.get("download");
    if (dl) {
      const { data: it } = await supabase.from("fw_fin_shelf_items").select("file_path,file_name").eq("id", dl).eq("business_id", bizId!).is("deleted_at", null).maybeSingle();
      if (!it) return NextResponse.json({ error: "File not found." }, { status: 404 });
      const { data, error } = await supabase.storage.from("shelf").createSignedUrl(it.file_path, 120, sp.get("inline") ? undefined : { download: it.file_name ?? true });
      if (error || !data) return serverError("shelf download", error, "Couldn't open the file.");
      return NextResponse.json({ url: data.signedUrl });
    }

    const { data, error } = await supabase.from("fw_fin_shelf_items")
      .select("id,rack,fy,period,title,doc_type,file_name,mime,size_bytes,source,reference,authority,reply_due,amount,status,notes,ai_summary,created_at")
      .eq("business_id", bizId!).is("deleted_at", null).order("created_at", { ascending: false }).limit(2000);
    if (error) return missing(error.message) ? NextResponse.json({ items: [], setup_needed: NEEDS_SQL }) : serverError("shelf list", error, "Couldn't open the shelf.");
    return NextResponse.json({ items: data ?? [], racks: RACKS });
  } catch (e) {
    return serverError("shelf", e, "Couldn't open the shelf.");
  }
}

type Classified = { rack?: string; title?: string; doc_type?: string; fy?: string; period?: string; date?: string; reference?: string; authority?: string; reply_due?: string; amount?: number; summary?: string };

async function classify(file: File): Promise<Classified> {
  try {
    const att = await readAttachment(file);
    const ai = getAI();
    const r = await ai.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 700,
      system: `You file Indian business documents onto a shelf. Racks: ${RACKS.map(r => `${r.key} (${r.hint})`).join("; ")}.
Reply JSON only: {"rack","title","doc_type","date","fy","period","reference","authority","reply_due","amount","summary"}.
- title: short and specific, e.g. "GSTR-3B · September 2026", "ITR-V · AY 2026-27", "Notice u/s 143(1) · AY 2025-26", "HDFC statement · Sep 2026".
- date: the document's own date (YYYY-MM-DD). fy: Indian financial year "YYYY-YY" the document relates to. period: month/quarter/AY it covers.
- reference: ARN, DIN, acknowledgement, challan or notice number. authority: issuing office/officer.
- For a NOTICE or order: rack "notices", reply_due = the last date to reply/comply (YYYY-MM-DD) if stated, amount = demand/tax/penalty if stated.
- summary: one or two sentences of what it is and what action, if any, is needed. Never invent facts; use null when not shown.`,
      messages: [{ role: "user", content: [...att.blocks, { type: "text", text: `File: ${file.name}.${att.text ? `\n${att.text.slice(0, 30000)}` : ""}` }] }],
    });
    const raw = r.content[0].type === "text" ? r.content[0].text : "";
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  } catch (e) { console.error("shelf classify", e); return {}; }
}

// POST: upload a file; rack "auto" (default) lets the AI file it and read notice details
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const bizId = form.get("business_id") as string;
    const gate = await requireBusiness(req, bizId, { write: true });
    if (gate instanceof NextResponse) return gate;
    const file = form.get("file") as File | null;
    if (!file?.size) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 413 });

    const rackIn = String(form.get("rack") ?? "auto");
    const c = rackIn === "auto" ? await classify(file) : {};
    const rack: RackKey = isRack(rackIn) ? rackIn : isRack(c.rack) ? c.rack : "others";
    const fy = (form.get("fy") as string) || (c.fy && /^\d{4}-\d{2}$/.test(c.fy) ? c.fy : null) || fyOfDate(c.date) || fyOfDate(new Date().toISOString().slice(0, 10));
    const saved = await fileToShelf(supabase, {
      businessId: bizId, actorId: gate.user.id, rack, fy, period: (form.get("period") as string) || c.period || null,
      title: (form.get("title") as string) || c.title || file.name, fileName: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()),
      source: "upload", docType: c.doc_type ?? null, reference: c.reference ?? null, authority: c.authority ?? null,
      replyDue: c.reply_due && ISO.test(c.reply_due) ? c.reply_due : null, amount: typeof c.amount === "number" && isFinite(c.amount) ? c.amount : null,
      aiSummary: c.summary ?? null, notes: (form.get("notes") as string) || null,
    });
    if (!saved) {
      const probe = await supabase.from("fw_fin_shelf_items").select("id").limit(1);
      return NextResponse.json({ error: probe.error && missing(probe.error.message) ? NEEDS_SQL : "Couldn't save the file. If this is the first upload, run 2026-10-11_shelf.sql in Supabase." }, { status: 409 });
    }
    await logAudit(supabase, { businessId: bizId, actor: gate.user.id, action: "shelf_upload", source: "shelf", detail: { id: saved.id, rack, file: file.name } });
    return NextResponse.json({ ok: true, id: saved.id, rack, fy, title: (form.get("title") as string) || c.title || file.name, reply_due: c.reply_due ?? null });
  } catch (e) {
    return serverError("shelf upload", e, "Couldn't save the file.");
  }
}

// PATCH: move to another rack, rename, change year/period, mark a notice replied/closed, set reply date
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { business_id?: string; id?: string; rack?: string; title?: string; fy?: string; period?: string; status?: string; reply_due?: string | null; notes?: string };
    const gate = await requireBusiness(req, b.business_id, { write: true });
    if (gate instanceof NextResponse) return gate;
    const upd: Record<string, unknown> = {};
    if (b.rack !== undefined) { if (!isRack(b.rack)) return NextResponse.json({ error: "Unknown rack." }, { status: 400 }); upd.rack = b.rack; }
    if (b.title !== undefined) upd.title = String(b.title).slice(0, 200) || "Untitled";
    if (b.fy !== undefined) upd.fy = b.fy || null;
    if (b.period !== undefined) upd.period = b.period || null;
    if (b.notes !== undefined) upd.notes = b.notes || null;
    if (b.status !== undefined) { if (!["open", "replied", "closed"].includes(b.status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 }); upd.status = b.status; }
    if (b.reply_due !== undefined) upd.reply_due = b.reply_due && ISO.test(b.reply_due) ? b.reply_due : null;
    const { error } = await supabase.from("fw_fin_shelf_items").update(upd).eq("id", b.id ?? "").eq("business_id", b.business_id!);
    if (error) return serverError("shelf update", error, "Couldn't save the change.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("shelf update", e, "Couldn't save the change.");
  }
}

// DELETE: takes the record off the shelf; the record and file are kept (deleted_at set) for the audit trail
export async function DELETE(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const bizId = sp.get("business_id"), id = sp.get("id");
  const gate = await requireBusiness(req, bizId, { write: true });
  if (gate instanceof NextResponse) return gate;
  const { error } = await supabase.from("fw_fin_shelf_items").update({ deleted_at: new Date().toISOString() }).eq("id", id ?? "").eq("business_id", bizId!);
  if (error) return serverError("shelf delete", error, "Couldn't remove the file.");
  await logAudit(supabase, { businessId: bizId!, actor: gate.user.id, action: "shelf_remove", source: "shelf", detail: { id } });
  return NextResponse.json({ ok: true });
}
