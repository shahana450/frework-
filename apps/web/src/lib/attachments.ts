// Turns an uploaded file into something the AI can read: images/PDFs as document blocks,
// Word/Excel/CSV/text as plain text. Shared by the Copilot and document upload.
import type Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import zlib from "zlib";
// ── Attachments ────────────────────────────────────────────────────────────────
export type Attachment = { blocks: Anthropic.ContentBlockParam[]; text: string; name: string };

// Minimal zip reader — pulls one entry out of a .docx without extra dependencies
function readZipEntry(buf: Buffer, entryName: string): Buffer | null {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let n = 0; n < count && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === entryName) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compSize);
      return method === 8 ? zlib.inflateRawSync(data) : data;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

export async function readAttachment(file: File): Promise<Attachment> {
  return readAttachmentBuffer(Buffer.from(await file.arrayBuffer()), file.name, file.type);
}

/** Same as readAttachment, for files that arrive as bytes (e.g. base64 uploads). */
export function readAttachmentBuffer(buf: Buffer, name: string, mime: string): Attachment {
  const lower = name.toLowerCase();
  if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
    return { name, text: "", blocks: [{ type: "image", source: { type: "base64", media_type: mime as "image/png", data: buf.toString("base64") } }] };
  }
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    return { name, text: "", blocks: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } }] };
  }
  if (lower.endsWith(".docx")) {
    const xml = readZipEntry(buf, "word/document.xml")?.toString("utf8") ?? "";
    const text = xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    return { name, blocks: [], text: text.trim().slice(0, 20000) || "(empty Word document)" };
  }
  if (/\.(xlsx|xls|csv)$/.test(lower)) {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const text = wb.SheetNames.slice(0, 3).map(s => `Sheet "${s}":\n${XLSX.utils.sheet_to_csv(wb.Sheets[s], { blankrows: false })}`).join("\n\n");
    return { name, blocks: [], text: text.slice(0, 20000) };
  }
  if (lower.endsWith(".doc")) {
    return { name, blocks: [], text: "(Old .doc format can't be read — ask the user to save it as .docx or PDF.)" };
  }
  return { name, blocks: [], text: buf.toString("utf8").slice(0, 20000) };
}

