// One way out to WhatsApp, whichever route is switched on:
//  • Meta Cloud API directly (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_ID) — the original setup.
//  • Gupshup (a Meta partner) in Meta / Cloud-API format — when GUPSHUP_APP_ID + GUPSHUP_APP_TOKEN are set.
//    Gupshup's v3 message API takes the same JSON body as Meta's, so every message FreBook sends works unchanged.
//    GUPSHUP_SEND_URL can override the endpoint if Gupshup gives a different one for the account.
const GRAPH = "https://graph.facebook.com/v21.0";

const env = (k: string) => (process.env[k] ?? "").trim();
export const usingGupshup = () => !!(env("GUPSHUP_APP_ID") && env("GUPSHUP_APP_TOKEN"));
export const waConfigured = () => usingGupshup() || !!(env("WHATSAPP_ACCESS_TOKEN") && env("WHATSAPP_PHONE_ID"));

/** POST a Cloud-API message body (text, template, contacts, read receipt…). Returns the raw response or null. */
export async function waPost(body: unknown): Promise<Response | null> {
  if (usingGupshup()) {
    const url = env("GUPSHUP_SEND_URL") || `https://partner.gupshup.io/partner/app/${env("GUPSHUP_APP_ID")}/v3/message`;
    return fetch(url, { method: "POST", headers: { Authorization: env("GUPSHUP_APP_TOKEN"), "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  }
  const token = env("WHATSAPP_ACCESS_TOKEN"), phoneId = env("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) return null;
  return fetch(`${GRAPH}/${phoneId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
}

/** The bytes of a photo or PDF a user sent. Gupshup puts a direct `url` on the media; Meta gives an id to look up. */
export async function waMedia(media: { id?: string; url?: string } | undefined, maxBytes = 15 * 1024 * 1024): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!media) return null;
  let url = media.url ?? "", mime = "";
  // Meta's media links (now also sent inside the webhook) need the access token too, or they answer 401
  let headers: Record<string, string> = usingGupshup() ? {} : { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` };
  if (!url && media.id) {
    if (usingGupshup()) {
      const base = env("GUPSHUP_MEDIA_URL") || `https://partner.gupshup.io/partner/app/${env("GUPSHUP_APP_ID")}/media`;
      url = `${base}/${encodeURIComponent(media.id)}`; headers = { Authorization: env("GUPSHUP_APP_TOKEN") };
    } else {
      headers = { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` };
      const meta = await fetch(`${GRAPH}/${media.id}`, { headers }).then(r => r.json()).catch(() => null);
      if (!meta?.url || (meta.file_size && meta.file_size > maxBytes)) { console.error("waMedia: no media url", JSON.stringify(meta?.error ?? { size: meta?.file_size ?? null }).slice(0, 300)); return null; }
      url = meta.url; mime = meta.mime_type ?? "";
    }
  }
  if (!url) return null;
  const res = await fetch(url, { headers }).catch(() => null);
  if (!res?.ok) { console.error("waMedia: download failed", res?.status ?? "no response"); return null; }
  const bytes = Buffer.from(new Uint8Array(await res.arrayBuffer()));
  if (bytes.length > maxBytes) return null;
  return { bytes, mime: mime || res.headers.get("content-type") || "application/octet-stream" };
}
