// Records what costs money — AI calls (tokens) and WhatsApp messages — for the admin costs panel.
import { after } from "next/server";

// Fire-and-forget through Supabase REST with the service key (works in any runtime); never blocks or breaks a request.
export type UsageRow = {
  kind: "ai" | "wa_reply" | "wa_business";
  provider?: string; model?: string;
  input_tokens?: number; output_tokens?: number; units?: number;
};

export function logUsage(row: UsageRow) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const p = fetch(`${url}/rest/v1/fw_usage_log`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ units: 1, ...row }),
  }).catch(() => null);   // table missing or network blip: just not counted
  try { after(p); } catch { /* outside a request: the fetch still runs */ }
}

/** USD per million tokens [input, output]. Approximate list prices — update when providers change them. */
export const MODEL_PRICES: [RegExp, number, number][] = [
  [/flash-lite/i, 0.10, 0.40],
  [/gemini.*flash|flash-latest/i, 0.30, 2.50],
  [/gemini.*pro/i, 1.25, 10],
  [/haiku/i, 1, 5],
  [/sonnet/i, 3, 15],
  [/opus/i, 5, 25],
];
export function aiCostUsd(model: string, inTok: number, outTok: number): number {
  const p = MODEL_PRICES.find(([re]) => re.test(model));
  return p ? (inTok * p[1] + outTok * p[2]) / 1e6 : (inTok * 3 + outTok * 15) / 1e6;
}
/** ₹ per business-initiated WhatsApp message (authentication/utility, India). Replies inside 24 h are free. */
export const WA_BUSINESS_INR = 0.13;
