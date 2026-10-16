// Sends FreBook as a WhatsApp contact card: one tap saves it, and the chat then shows "FreBook" instead of a number
const GRAPH = "https://graph.facebook.com/v21.0";

export async function sendContactCard(to: string) {
  const num = (process.env.WHATSAPP_BOT_NUMBER ?? "").replace(/\D/g, "");
  const token = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim(), phoneId = (process.env.WHATSAPP_PHONE_ID ?? "").trim();
  if (!num || !token || !phoneId) return;
  const post = (body: unknown) => fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).catch(() => null);
  await post({ messaging_product: "whatsapp", to, type: "text", text: { body: "📇 Tap *Save contact* below so this chat shows as *FreBook* instead of a number." } });
  await post({ messaging_product: "whatsapp", to, type: "contacts", contacts: [{
    name: { formatted_name: "FreBook", first_name: "FreBook" }, org: { company: "FreWork" },
    phones: [{ phone: `+${num}`, wa_id: num, type: "WORK" }], urls: [{ url: "https://frework.online", type: "WORK" }],
  }] });
}
