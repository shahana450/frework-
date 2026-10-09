import type Anthropic from "@anthropic-ai/sdk";

type Block =
  | { type: "text"; text: string }
  | { type: "image" | "document"; source: { type: "base64"; media_type: string; data: string } };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
type CreateParams = { model?: string; max_tokens?: number; temperature?: number; system?: string | { text: string }[]; messages: Msg[] };

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_FALLBACK = "gemini-flash-latest";
// Remembers which thinking option the model accepted so later requests skip the rejected tries
let thinkingPref: Record<string, unknown> | null | undefined = { thinkingLevel: "minimal" };

function toParts(content: Msg["content"]) {
  if (typeof content === "string") return [{ text: content }];
  return content.map(b => b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } });
}

async function geminiCreate(params: CreateParams) {
  const system = typeof params.system === "string" ? params.system : params.system?.map(s => s.text).join("\n");
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.max(params.max_tokens ?? 2048, 2048),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    // Thinking adds several seconds; journal-entry parsing doesn't need it
    ...(thinkingPref ? { thinkingConfig: thinkingPref } : {}),
  };
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: params.messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) })),
    generationConfig,
  };
  // Free tier returns 503/429 under load: retry once, then fall back to Flash
  const attempts = [GEMINI_MODEL, GEMINI_MODEL, GEMINI_FALLBACK];
  let res: Response | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = {};
  for (let i = 0; i < attempts.length; i++) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${attempts[i]}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
    });
    data = await res.json();
    // Large output budgets can exceed the model's limit — shrink before touching thinking settings
    if (res.status === 400 && (generationConfig.maxOutputTokens as number) > 8192) {
      generationConfig.maxOutputTokens = (generationConfig.maxOutputTokens as number) > 16384 ? 16384 : 8192;
      i--; continue;
    }
    // Older models take thinkingBudget, newer ones thinkingLevel; step down until accepted
    if (res.status === 400 && generationConfig.thinkingConfig) {
      const tc = generationConfig.thinkingConfig as Record<string, unknown>;
      if (tc.thinkingLevel === "minimal") generationConfig.thinkingConfig = { thinkingBudget: 0 };
      else if ("thinkingBudget" in tc) generationConfig.thinkingConfig = { thinkingLevel: "low" };
      else delete generationConfig.thinkingConfig;
      thinkingPref = generationConfig.thinkingConfig as Record<string, unknown> | undefined;
      i--; continue;
    }
    if (res.ok || ![429, 500, 503].includes(res.status)) break;
    await new Promise(r => setTimeout(r, 400));
  }
  if (!res!.ok) throw new Error(`Gemini ${res!.status}: ${data?.error?.message ?? JSON.stringify(data).slice(0, 300)}`);
  const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  return {
    id: data.responseId ?? "gemini",
    type: "message",
    role: "assistant",
    model: GEMINI_MODEL,
    content: [{ type: "text", text }],
    stop_reason: data.candidates?.[0]?.finishReason === "MAX_TOKENS" ? "max_tokens" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: data.usageMetadata?.promptTokenCount ?? 0, output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0 },
  };
}

// Uses Gemini when GEMINI_API_KEY is set, otherwise the Anthropic API.
export function getAI(): Anthropic {
  if (process.env.GEMINI_API_KEY) {
    return { messages: { create: geminiCreate } } as unknown as Anthropic;
  }
  // Plain request to the Messages API (the SDK reads files at load time, which the edge runtime can't)
  const create = async (params: Record<string, unknown>) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${data?.error?.message ?? "request failed"}`);
    return data;
  };
  return { messages: { create } } as unknown as Anthropic;
}

export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
