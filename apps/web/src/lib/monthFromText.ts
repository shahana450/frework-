// "August 2026", "aug 26", "08/2026", "last month", "this month" → YYYY-MM (India time).
// A month named without a year is the latest such month that isn't in the future.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function monthFromText(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  const ist = new Date(now.getTime() + 5.5 * 3600000);
  const y0 = ist.getUTCFullYear(), m0 = ist.getUTCMonth() + 1;
  const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  if (/\b(last|previous) month\b/.test(t)) return m0 === 1 ? ym(y0 - 1, 12) : ym(y0, m0 - 1);
  if (/\b(this|current) month\b/.test(t)) return ym(y0, m0);
  const num = t.match(/\b(0?[1-9]|1[0-2])\s*[/\-.]\s*(20\d{2})\b/);
  if (num) return ym(+num[2], +num[1]);
  const name = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*[,-]?\s*('?\d{2}\b|20\d{2})?/);
  if (!name) return null;
  const m = MONTHS.indexOf(name[1]) + 1;
  let y = name[2] ? Number(name[2].replace("'", "")) : NaN;
  if (y && y < 100) y += 2000;
  if (!y) y = m > m0 ? y0 - 1 : y0;
  return ym(y, m);
}
