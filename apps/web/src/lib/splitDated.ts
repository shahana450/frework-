// "Sales\n30-04-2025 25000\n31-05-2025 35000" → one message per dated line, each keeping the shared words:
// ["Sales on 30-04-2025 25000", "Sales on 31-05-2025 35000"]. Null when it's a single entry.
const DATE = /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{2,4})\b/i;

export function splitDated(text: string): string[] | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const dated = lines.filter(l => DATE.test(l) && /\d{2,}/.test(l.replace(DATE, "")));
  if (dated.length < 2) return null;
  const head = lines.filter(l => !dated.includes(l)).join(" ").trim();
  const dates = new Set(dated.map(l => (l.match(DATE)?.[0] ?? "").toLowerCase()));
  if (dates.size < 2) return null;   // same date on every line: one entry with several lines is fine
  return dated.map(l => { const d = l.match(DATE)![0]; const rest = l.replace(d, "").trim(); return `${head ? head + " " : ""}on ${d} ${rest}`.trim(); });
}
