import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { handleWhatsApp, type Incoming } from "@/lib/whatsapp/bot";
import { sendContactCard } from "@/lib/whatsapp/contactCard";
import { waPost, waMedia } from "@/lib/whatsapp/transport";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function send(to: string, body: string) {
  const r = await waPost({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: false } });
  if (!r?.ok) console.error("whatsapp send failed", r?.status, r ? (await r.text()).slice(0, 300) : "no response");
  else logUsage({ kind: "wa_reply", provider: "whatsapp", model: "service" });   // replies within 24 h: free
}

// Blue ticks + "typing…" until the reply arrives (or 25 s)
const markRead = (id: string) => waPost({ messaging_product: "whatsapp", status: "read", message_id: id, typing_indicator: { type: "text" } });

async function downloadMedia(m: { id?: string; url?: string }, fallbackName: string): Promise<Incoming["media"]> {
  const got = await waMedia(m);
  return got ? { bytes: got.bytes, mime: got.mime, name: fallbackName } : undefined;
}

const sameSecret = (a: string, b: string) => !!a && !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// GET: Meta's webhook verification
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const verify = process.env.WHATSAPP_VERIFY_TOKEN;
  if (verify && sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === verify) return new NextResponse(sp.get("hub.challenge"), { status: 200 });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: incoming messages. Accepted only when signed by Meta with our app secret, or — on the Gupshup route —
// when the callback URL carries our own secret (?key=GUPSHUP_WEBHOOK_SECRET), which only Gupshup knows.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();   // a pasted secret often carries a trailing space or newline
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = secret ? "sha256=" + createHmac("sha256", secret).update(raw).digest("hex") : "";
  const metaOk = !!secret && sameSecret(sig, expected);
  const gupshupOk = sameSecret(new URL(req.url).searchParams.get("key") ?? "", (process.env.GUPSHUP_WEBHOOK_SECRET ?? "").trim());
  if (!metaOk && !gupshupOk) {
    console.error("whatsapp-webhook: rejected unsigned or mis-signed request", { hasSecret: !!secret });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ status: "ignored" }); }
  // Meta / Cloud-API format (Gupshup's v3 webhooks forward the same shape)
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg?.id || !msg.from) return NextResponse.json({ status: "ignored" }); // delivery receipts etc.

  // Reply at once; the work happens after, so the sender doesn't re-send while the AI thinks
  after(async () => {
    const { error: dup } = await supabase.from("fw_fin_wa_seen").insert({ message_id: msg.id, phone: msg.from });
    if (dup) return; // already handled
    try {
      const { count } = await supabase.from("fw_fin_wa_seen").select("message_id", { count: "exact", head: true }).eq("phone", msg.from).gte("seen_at", new Date(Date.now() - 3600000).toISOString());
      if ((count ?? 0) > 60) { await send(msg.from, "⏳ Limit reached: 60 messages an hour. Please try again a little later."); return; }
      void markRead(msg.id);
      let text = "", media: Incoming["media"];
      if (msg.type === "text") text = msg.text?.body ?? "";
      else if (msg.type === "button") text = msg.button?.text ?? "";
      else if (msg.type === "interactive") text = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
      else if (msg.type === "image") { text = msg.image?.caption ?? ""; media = await downloadMedia(msg.image ?? {}, `whatsapp-${msg.id.slice(-8)}.jpg`); }
      else if (msg.type === "document") { text = msg.document?.caption ?? ""; media = await downloadMedia(msg.document ?? {}, msg.document?.filename ?? `whatsapp-${msg.id.slice(-8)}.pdf`); }
      else { await send(msg.from, "I can read text, photos and PDFs. Voice notes aren't supported yet — please type it."); return; }
      if (!text && !media) return;
      const reply = await handleWhatsApp(supabase, { from: msg.from, id: msg.id, text, media });
      await send(msg.from, reply);
      // Just linked: send FreBook as a contact card, so one tap saves it and the chat shows "FreBook" by name
      if (reply.startsWith("✅ Linked")) await sendContactCard(msg.from);
    } catch (e) {
      console.error("whatsapp-webhook", e instanceof Error ? e.message : e);
      const busy = /Gemini (429|503)|high demand|overloaded/i.test(e instanceof Error ? e.message : "");
      await send(msg.from, busy ? "⏳ The AI is busy right now. Please send it again in a minute." : "⚠️ Something went wrong. Nothing was posted — please try again.");
    }
  });
  return NextResponse.json({ status: "received" });
}
