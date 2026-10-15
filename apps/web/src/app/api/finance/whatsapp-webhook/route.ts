import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { handleWhatsApp, type Incoming } from "@/lib/whatsapp/bot";

export const maxDuration = 120;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const GRAPH = "https://graph.facebook.com/v21.0";
const token = () => (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();

async function send(to: string, body: string) {
  const r: Response = await fetch(`${GRAPH}/${(process.env.WHATSAPP_PHONE_ID ?? "").trim()}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: false } }),
  });
  if (!r.ok) console.error("whatsapp send failed", r.status, (await r.text()).slice(0, 300));
}

async function markRead(id: string) {
  await fetch(`${GRAPH}/${(process.env.WHATSAPP_PHONE_ID ?? "").trim()}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    // Blue ticks + "typing…" until the reply arrives (or 25 s)
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: id, typing_indicator: { type: "text" } }),
  }).catch(() => null);
}

async function downloadMedia(id: string, fallbackName: string): Promise<Incoming["media"]> {
  const meta = await fetch(`${GRAPH}/${id}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json());
  if (!meta?.url) return undefined;
  if (meta.file_size && meta.file_size > 15 * 1024 * 1024) return undefined;
  const res: Response = await fetch(meta.url, { headers: { Authorization: `Bearer ${token()}` } });
  const bytes = Buffer.from(new Uint8Array(await res.arrayBuffer()));
  return { bytes, mime: meta.mime_type ?? "application/octet-stream", name: fallbackName };
}

// GET: Meta's webhook verification
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const verify = process.env.WHATSAPP_VERIFY_TOKEN;
  if (verify && sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === verify) return new NextResponse(sp.get("hub.challenge"), { status: 200 });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: incoming messages. Only requests signed by Meta with our app secret are accepted.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();   // a pasted secret often carries a trailing space or newline
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = secret ? "sha256=" + createHmac("sha256", secret).update(raw).digest("hex") : "";
  if (!secret || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    console.error("whatsapp-webhook: rejected unsigned or mis-signed request", { hasSecret: !!secret });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ status: "ignored" }); }
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg?.id || !msg.from) return NextResponse.json({ status: "ignored" }); // delivery receipts etc.

  // Reply to Meta at once; the work happens after, so Meta doesn't re-send while the AI thinks
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
      else if (msg.type === "image") { text = msg.image?.caption ?? ""; media = await downloadMedia(msg.image.id, `whatsapp-${msg.id.slice(-8)}.jpg`); }
      else if (msg.type === "document") { text = msg.document?.caption ?? ""; media = await downloadMedia(msg.document.id, msg.document.filename ?? `whatsapp-${msg.id.slice(-8)}.pdf`); }
      else { await send(msg.from, "I can read text, photos and PDFs. Voice notes aren't supported yet — please type it."); return; }
      if (!text && !media) return;
      const reply = await handleWhatsApp(supabase, { from: msg.from, id: msg.id, text, media });
      await send(msg.from, reply);
    } catch (e) {
      console.error("whatsapp-webhook", e instanceof Error ? e.message : e);
      const busy = /Gemini (429|503)|high demand|overloaded/i.test(e instanceof Error ? e.message : "");
      await send(msg.from, busy ? "⏳ The AI is busy right now. Please send it again in a minute." : "⚠️ Something went wrong. Nothing was posted — please try again.");
    }
  });
  return NextResponse.json({ status: "received" });
}
