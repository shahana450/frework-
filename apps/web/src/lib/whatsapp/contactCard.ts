// Sends FreBook as a WhatsApp contact card: one tap saves it, and the chat then shows "FreBook" instead of a number
import { waPost, waConfigured } from "./transport";

export async function sendContactCard(to: string) {
  const num = (process.env.WHATSAPP_BOT_NUMBER ?? "").replace(/\D/g, "");
  if (!num || !waConfigured()) return;
  await waPost({ messaging_product: "whatsapp", to, type: "text", text: { body: "📇 Tap *Save contact* below so this chat shows as *FreBook* instead of a number." } });
  await waPost({ messaging_product: "whatsapp", to, type: "contacts", contacts: [{
    name: { formatted_name: "FreBook", first_name: "FreBook" }, org: { company: "FreWork" },
    phones: [{ phone: `+${num}`, wa_id: num, type: "WORK" }], urls: [{ url: "https://frework.online", type: "WORK" }],
  }] });
}
