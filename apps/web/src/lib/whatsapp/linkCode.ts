// Sends the account-link code to a WhatsApp number using an approved Authentication template.
// WhatsApp only lets a business message someone first through an approved template, so this is what lets
// a user link without having to find and message the FreBook number themselves.
//   Template: Meta → WhatsApp Manager → Message templates → Authentication, "Copy code" button.
//   Name from WHATSAPP_LINK_TEMPLATE (default "frebook_link_code"), language WHATSAPP_LINK_TEMPLATE_LANG (default "en").
import { createHmac } from "node:crypto";
import { logUsage } from "../usage";
import { waPost, waConfigured } from "./transport";


/**
 * The 6-digit code sent to the phone. It is derived (never stored or shown) from the link row and the
 * on-page LINK code, so seeing the page is not enough — only the phone that received the message knows it.
 */
export function phoneCode(linkId: string, pageCode: string, key: string): string {
  const h = createHmac("sha256", key).update(`wa-link:${linkId}:${pageCode}`).digest();
  return String(h.readUInt32BE(0) % 1000000).padStart(6, "0");
}

export function linkTemplatePayload(to: string, code: string, name = "frebook_link_code", lang = "en") {
  return {
    messaging_product: "whatsapp", to, type: "template",
    template: {
      name, language: { code: lang },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        // The "Copy code" button carries the same code
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };
}

/** Plain-language reason for a failed send, from Meta's error. */
export function linkSendError(status: number, body: string): string {
  if (/132001|template name does not exist|Template name/i.test(body)) return "The WhatsApp code template isn't approved yet — use the LINK message below for now.";
  if (/131026|not a valid WhatsApp|undeliverable/i.test(body)) return "That number doesn't seem to be on WhatsApp. Check the number and country code.";
  if (/131047|re-engagement/i.test(body)) return "WhatsApp didn't accept the message — send the LINK message below instead.";
  if (/131042|payment|billing/i.test(body)) return "The FreBook WhatsApp account needs a payment method before it can send codes.";
  if (status === 401 || /OAuthException|code\":190/.test(body)) return "The FreBook WhatsApp connection needs attention (access token). Use the LINK message below for now.";
  return "Couldn't send the code on WhatsApp — use the LINK message below instead.";
}

export async function sendLinkCode(to: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!waConfigured()) return { ok: false, error: "The FreBook WhatsApp number isn't switched on yet." };
  const name = (process.env.WHATSAPP_LINK_TEMPLATE ?? "frebook_link_code").trim(), lang = (process.env.WHATSAPP_LINK_TEMPLATE_LANG ?? "en").trim();
  const r = await waPost(linkTemplatePayload(to, code, name, lang));
  if (!r) return { ok: false, error: linkSendError(0, "") };
  if (r.ok) { logUsage({ kind: "wa_business", provider: "whatsapp", model: "authentication" }); return { ok: true }; }
  const body = (await r.text()).slice(0, 500);
  console.error("whatsapp link code send failed", r.status, body);
  return { ok: false, error: linkSendError(r.status, body) };
}
