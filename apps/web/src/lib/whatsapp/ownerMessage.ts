// Sends a scheduled message to the owner. WhatsApp only lets a business send free text within 24 hours of the person's
// last message; after that only an approved template gets through. So: inside the window the full message goes as
// text; outside it the template carries a one-line version ("reply SUMMARY for details").
// Template: WHATSAPP_REMINDER_TEMPLATE (default "frebook_daily_update", Utility, language WHATSAPP_REMINDER_TEMPLATE_LANG
// or "en"), body with {{1}} = business name and {{2}} = the one-line update.
import type { SupabaseClient } from "@supabase/supabase-js";
import { waPost } from "./transport";

const env = (k: string) => (process.env[k] ?? "").trim();

export async function windowOpen(sb: SupabaseClient, phone: string): Promise<boolean> {
  const { data } = await sb.from("fw_fin_wa_seen").select("seen_at").eq("phone", phone).order("seen_at", { ascending: false }).limit(1);
  const at = data?.[0]?.seen_at ? Date.parse(data[0].seen_at) : 0;
  return Date.now() - at < 23 * 3600 * 1000;
}

export async function sendOwner(sb: SupabaseClient, phone: string, business: string, full: string, oneLine: string): Promise<{ ok: boolean; via: "text" | "template" | "none"; error?: string }> {
  const text = async () => waPost({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: full.slice(0, 4000) } });
  if (await windowOpen(sb, phone)) {
    const r = await text();
    if (r?.ok) return { ok: true, via: "text" };
  }
  const name = env("WHATSAPP_REMINDER_TEMPLATE") || "frebook_daily_update", lang = env("WHATSAPP_REMINDER_TEMPLATE_LANG") || "en";
  const clean = (s: string) => s.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").slice(0, 1000);
  const t = await waPost({ messaging_product: "whatsapp", to: phone, type: "template",
    template: { name, language: { code: lang }, components: [{ type: "body", parameters: [clean(business || "your business"), clean(oneLine || "updates are ready")].map(x => ({ type: "text", text: x })) }] } });
  if (t?.ok) return { ok: true, via: "template" };
  const err = t ? (await t.text().catch(() => "")).slice(0, 300) : "WhatsApp not reachable";
  // Last try: plain text (delivered only if the owner wrote in the last 24 hours)
  const r = await text();
  return r?.ok ? { ok: true, via: "text" } : { ok: false, via: "none", error: err };
}
