import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusiness, serverError } from "@/lib/apiAuth";
import { loadInvoiceDoc } from "@/lib/invoiceLoad";
import { invoicePdf } from "@/lib/invoicePdf";
import { fileToShelf, fyOfDate } from "@/lib/shelf";
import { waPost, waConfigured } from "@/lib/whatsapp/transport";

// "Send to my WhatsApp": the FreBook bot sends this invoice as a PDF to the WhatsApp number(s) the signed-in user
// linked for this business, ready to forward to the customer. WhatsApp only lets a business send a free-form
// message (a PDF) within 24 hours of the person's last message to it; outside that window the reply explains it.
export const maxDuration = 60;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { business_id?: string; journal_id?: string };
    const gate = await requireBusiness(req, b.business_id);
    if (gate instanceof NextResponse) return gate;
    if (!b.journal_id) return NextResponse.json({ error: "Which invoice?" }, { status: 400 });
    if (!waConfigured()) return NextResponse.json({ error: "FreBook's WhatsApp isn't set up on the server." }, { status: 503 });

    // The user's own linked number(s) for this business
    const { data: links } = await sb.from("fw_fin_wa_links").select("phone").eq("business_id", b.business_id!).eq("user_id", gate.user.id).eq("verified", true);
    const phones = [...new Set((links ?? []).map(l => String(l.phone)).filter(Boolean))];
    if (!phones.length) return NextResponse.json({ code: "not_linked", error: "Your WhatsApp isn't linked to this business yet. Link it in Settings → WhatsApp, then try again." }, { status: 409 });

    const inv = await loadInvoiceDoc(sb, b.business_id!, b.journal_id);
    if (!inv) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    const fileName = `Invoice-${(inv.doc.invoiceNo || inv.entryNo).replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
    const shelf = await fileToShelf(sb, { businessId: b.business_id!, actorId: gate.user.id, rack: "bills", title: `Sales invoice ${inv.doc.invoiceNo || inv.entryNo}`, fileName, mime: "application/pdf",
      bytes: await invoicePdf(inv.doc), source: "upload", fy: fyOfDate(inv.doc.date || new Date().toISOString().slice(0, 10)), docType: "Sales invoice" });
    const { data: it } = shelf ? await sb.from("fw_fin_shelf_items").select("file_path").eq("id", shelf.id).maybeSingle() : { data: null };
    const url = it?.file_path ? (await sb.storage.from("shelf").createSignedUrl(it.file_path, 7 * 86400, { download: fileName })).data?.signedUrl : null;
    if (!url) return NextResponse.json({ error: "Couldn't prepare the PDF. Try again." }, { status: 500 });

    const caption = `${inv.doc.title} ${inv.doc.invoiceNo} · ${inv.doc.buyer.name || "Customer"} — forward it to your customer.`;
    const sent: string[] = [];
    let windowClosed = false, lastErr = "";
    for (const to of phones) {
      const r = await waPost({ messaging_product: "whatsapp", to, type: "document", document: { link: url, filename: fileName, caption } });
      if (r?.ok) { sent.push(to); continue; }
      const body = r ? await r.json().catch(() => ({})) as { error?: { code?: number; message?: string } } : {};
      // 131047: more than 24 hours since this person last messaged FreBook
      if (body.error?.code === 131047 || /24 ?hours|re-?engagement/i.test(body.error?.message ?? "")) windowClosed = true;
      lastErr = body.error?.message ?? (r ? `WhatsApp said ${r.status}` : "WhatsApp didn't answer");
    }
    const mask = (p: string) => `+${p.slice(0, 2)} ••••• ${p.slice(-4)}`;
    if (sent.length) return NextResponse.json({ ok: true, sent: sent.map(mask), message: `✓ Sent to your WhatsApp (${sent.map(mask).join(", ")}). Open FreBook on WhatsApp and forward it to the customer.` });
    if (windowClosed) return NextResponse.json({ code: "window_closed", error: "WhatsApp only lets FreBook send you a PDF within 24 hours of your last message to it. Send “Hi” to FreBook on WhatsApp, then press this again." }, { status: 409 });
    return NextResponse.json({ error: `Couldn't send it: ${lastErr}` }, { status: 502 });
  } catch (e) { return serverError("invoice-whatsapp", e, "Couldn't send the invoice to WhatsApp."); }
}
