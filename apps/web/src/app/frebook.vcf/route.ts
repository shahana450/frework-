import { NextRequest } from "next/server";

// FreBook as a phone contact: opening this file on a phone offers "Save contact", so WhatsApp shows "FreBook" by name
export async function GET(req: NextRequest) {
  const num = (process.env.WHATSAPP_BOT_NUMBER ?? "").replace(/\D/g, "");
  if (!num) return new Response("FreBook's WhatsApp number isn't set up yet.", { status: 404 });
  let photo = "";
  try {
    const r = await fetch(new URL("/frebook-logo.png", req.nextUrl.origin));
    if (r.ok) photo = Buffer.from(await r.arrayBuffer()).toString("base64");
  } catch { /* contact works without the picture */ }
  const card = [
    "BEGIN:VCARD", "VERSION:3.0",
    "N:;FreBook;;;", "FN:FreBook", "ORG:FreWork",
    "TITLE:AI accountant on WhatsApp",
    `TEL;TYPE=CELL;waid=${num}:+${num}`,
    "URL:https://frework.online",
    "NOTE:Send entries\\, bills and questions about your books. Reply YES to post.",
    ...(photo ? [`PHOTO;ENCODING=b;TYPE=PNG:${photo}`] : []),
    "END:VCARD",
  ].join("\r\n");
  return new Response(card + "\r\n", {
    headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": 'attachment; filename="FreBook.vcf"', "Cache-Control": "public, max-age=3600" },
  });
}
