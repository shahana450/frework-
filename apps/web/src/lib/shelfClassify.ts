// Reads a document with the AI and says where it belongs on the Shelf: rack, title, financial year, reference,
// reply-by date and demand amount. Used by uploads and by documents fetched from the tax portals.
import { readAttachment } from "./attachments";
import { getAI } from "./ai";
import { RACKS } from "./shelf";

export type Classified = { rack?: string; title?: string; doc_type?: string; fy?: string; period?: string; date?: string; reference?: string; authority?: string; reply_due?: string; amount?: number; summary?: string };

export async function classifyDocument(file: File): Promise<Classified> {
  try {
    const att = await readAttachment(file);
    const ai = getAI();
    const r = await ai.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 700,
      system: `You file Indian business documents onto a shelf. Racks: ${RACKS.map(r => `${r.key} (${r.hint})`).join("; ")}.
Reply JSON only: {"rack","title","doc_type","date","fy","period","reference","authority","reply_due","amount","summary"}.
- title: short and specific, e.g. "GSTR-3B · September 2026", "ITR-V · AY 2026-27", "Notice u/s 143(1) · AY 2025-26", "HDFC statement · Sep 2026".
- date: the document's own date (YYYY-MM-DD). fy: Indian financial year "YYYY-YY" the document relates to. period: month/quarter/AY it covers.
- reference: ARN, DIN, acknowledgement, challan or notice number. authority: issuing office/officer.
- For a NOTICE or order: rack "notices", reply_due = the last date to reply/comply (YYYY-MM-DD) if stated, amount = demand/tax/penalty if stated.
- summary: one or two sentences of what it is and what action, if any, is needed. Never invent facts; use null when not shown.`,
      messages: [{ role: "user", content: [...att.blocks, { type: "text", text: `File: ${file.name}.${att.text ? `\n${att.text.slice(0, 30000)}` : ""}` }] }],
    });
    const raw = r.content[0].type === "text" ? r.content[0].text : "";
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  } catch (e) { console.error("shelf classify", e); return {}; }
}
