// "prepare GSTR1 Oct 2026", "file 3B for September", "GSTR-1 last month" → the GST page on that return and month.
// Pure; returns null when the text isn't about preparing a GST return.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function gstReturnLink(text: string, today = new Date()): string | null {
  const t = text.toLowerCase();
  const form = /\bgstr\s*-?\s*3\s*b\b|\b3b\b/.test(t) ? "gstr3b" : /\bgstr\s*-?\s*1\b|\bgst\s*r\s*1\b/.test(t) ? "gstr1" : null;
  if (!form) return null;
  // Questions about figures ("GSTR1 sales total?") still go to the chat; prepare / file / download / show open the page
  if (!/\b(prepare|file|filing|make|create|download|json|show|open|view|generate|return)\b/.test(t) && !/^\s*gstr/.test(t)) return null;
  let y = today.getFullYear(), m = today.getMonth() - 1;           // default: last month
  const mi = MONTHS.findIndex(x => new RegExp(`\\b${x}[a-z]*\\b`).test(t));
  if (/\bthis month\b/.test(t)) m = today.getMonth();
  if (mi >= 0) { m = mi; const yr = t.match(/\b(20\d{2})\b/); y = yr ? +yr[1] : (mi > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear()); }
  if (m < 0) { m += 12; y -= 1; }
  return `/finance/gst?tab=${form}&month=${y}-${String(m + 1).padStart(2, "0")}`;
}
