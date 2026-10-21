// Voice notes (WhatsApp sends OGG/Opus): Gemini listens and returns the words in English, ready for the bot to
// read like a typed message. Hindi, Malayalam, Tamil and Hinglish are translated; numbers and names kept exactly.
import { logUsage } from "./usage";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

export async function transcribeVoice(bytes: Buffer, mime: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY || !bytes.length) return null;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { inline_data: { mime_type: (mime || "audio/ogg").split(";")[0], data: bytes.toString("base64") } },
        { text: "This is a voice note to a bookkeeping assistant from a small business owner in India. Write down what they said as one short message in English (translate Hindi, Malayalam, Tamil, Hinglish etc.). Keep every number, amount, name, bank and date exactly; write amounts as digits (\"25 thousand\" → 25000). Output only the message — no quotes, no notes. If there is no speech, output NOTHING." },
      ] }],
      generationConfig: { temperature: 0, maxOutputTokens: 400 },
    }),
  }).catch(() => null);
  if (!res?.ok) { console.error("transcribe failed", res?.status ?? "no response"); return null; }
  const data = await res.json().catch(() => null);
  logUsage({ kind: "ai", provider: "gemini", model: data?.modelVersion ?? MODEL, input_tokens: data?.usageMetadata?.promptTokenCount ?? 0, output_tokens: data?.usageMetadata?.candidatesTokenCount ?? 0 });
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  return text && text !== "NOTHING" ? text.slice(0, 1000) : null;
}
