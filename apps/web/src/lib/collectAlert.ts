// Overdue alerts to the owner on WhatsApp: a daily/weekly nudge, then *LIST* gives one-tap reminders to forward.
// The owner sends every reminder from their own WhatsApp — FreBook never messages customers.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadQueryBooks } from "./intentEngine";
import { computeCollect, reminderText, type Debtor } from "./collect";
import { formatMoney } from "./money";

export type AlertFreq = "off" | "daily" | "weekly";
export const fmtINR = (n: number) => formatMoney(n, { currency: "INR", locale: "en-IN" }, { decimals: false });

/** Is an alert due today? Weekly ones go out on Mondays (IST). */
export function alertDue(freq: AlertFreq, todayIso: string, last: string | null): boolean {
  if (freq === "off" || last === todayIso) return false;
  return freq === "daily" || new Date(todayIso + "T00:00:00Z").getUTCDay() === 1;
}

/** Customers overdue by at least `days`, with their saved phone numbers. */
export async function loadOverdue(sb: SupabaseClient, bizId: string, days: number, today: string): Promise<{ business: string; overdue: Debtor[] } | null> {
  const books = await loadQueryBooks(sb, bizId, today);
  if (books.error) return null;
  const [{ data: contacts }, { data: biz }] = await Promise.all([
    sb.from("fw_fin_contacts").select("name,phone").eq("business_id", bizId),
    sb.from("fw_fin_businesses").select("name").eq("id", bizId).maybeSingle(),
  ]);
  const phone = new Map((contacts ?? []).map(c => [String(c.name).trim().toLowerCase(), c.phone as string | null]));
  const c = computeCollect(books.accounts, books.journals, today);
  const overdue = c.debtors.filter(d => d.oldestDays >= days);
  for (const d of overdue) d.phone = phone.get(d.name.toLowerCase()) ?? null;
  return { business: biz?.name ?? "", overdue };
}

/** The short alert (also the text of the approved template's variables). */
export function alertText(business: string, overdue: Debtor[], days: number): string {
  const total = overdue.reduce((s, d) => s + d.balance, 0);
  return `💰 *${business}* — ${overdue.length} customer${overdue.length > 1 ? "s owe" : " owes"} you ${fmtINR(total)} overdue (over ${days} days).\n\nReply *LIST* for ready-to-send reminders.`;
}

const waMe = (phone: string, text: string) => { const p = phone.replace(/\D/g, ""); return `https://wa.me/${p.length === 10 ? `91${p}` : p}?text=${encodeURIComponent(text)}`; };

/** *LIST*: each overdue customer with a one-tap link that opens WhatsApp with the reminder typed. */
export function listMessage(business: string, overdue: Debtor[], days: number, max = 8): string {
  if (!overdue.length) return `✓ Nobody is overdue by more than ${days} days at *${business}*.`;
  const rows = overdue.slice(0, max).map((d, i) => {
    const head = `${i + 1}. *${d.name}* — ${fmtINR(d.balance)} · ${d.oldestDays} days`;
    const ph = (d.phone ?? "").replace(/\D/g, "");
    return ph.length >= 10 ? `${head}\nTap to send: ${waMe(ph, reminderText(d, business || "Your supplier", d.oldestDays > 60 ? "firm" : "polite", fmtINR))}` : `${head}\n(no phone saved — add it in Customers & Suppliers)`;
  });
  const more = overdue.length > max ? `\n\n…and ${overdue.length - max} more on the Collect payments page.` : "";
  return `Overdue at *${business}*:\n\n${rows.join("\n\n")}${more}\n\nEach link opens WhatsApp with the reminder typed — you press send.`;
}
