// Bank transaction alert emails → normalised lines. One template set per bank (SBI, Federal, HDFC, ICICI, South Indian
// Bank, Canara) on top of shared readers for amounts, dates, references and balances. Banks change their wording; when
// no template fits, the generic reader tries, and if that can't find an amount AND a direction the email goes to
// "Needs attention" — it is never guessed.
//
// The patterns follow the banks' published alert formats. Check them against real forwarded emails before launch.

export type AlertLine = { date: string; amount: number; dr_cr: "dr" | "cr"; ref: string | null; narration: string; balance: number | null; last4: string | null };
export type AlertParse = { ok: true; line: AlertLine; parser: string } | { ok: false; reason: string };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const year4 = (y: number) => (y < 100 ? 2000 + y : y);

/** Text of an HTML alert: tags out, entities decoded, whitespace collapsed. */
export function htmlToText(html: string): string {
  return String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#8377;|&#x20b9;/gi, "₹").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** "1,23,456.78" → 123456.78 */
export const num = (s: string) => Number(String(s ?? "").replace(/[,\s]/g, ""));

const AMT = String.raw`(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)`;

/** First money amount after a currency marker. */
export function firstAmount(t: string): number | null {
  const m = t.match(new RegExp(AMT, "i"));
  return m ? num(m[1]) : null;
}

/** Dates as banks write them: 12-10-26, 12/10/2026, 12Oct26, 12-Oct-2026, 12 Oct 2026, 2026-10-12. */
export function findDate(t: string): string | null {
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = t.match(/\b(\d{1,2})[\s-]?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s,-]?(\d{2,4})\b/i);
  if (named) return `${year4(+named[3])}-${pad(MONTHS[named[2].toLowerCase()])}-${pad(+named[1])}`;
  const dmy = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dmy && +dmy[2] >= 1 && +dmy[2] <= 12 && +dmy[1] >= 1 && +dmy[1] <= 31) return `${year4(+dmy[3])}-${pad(+dmy[2])}-${pad(+dmy[1])}`;
  return null;
}

/** UPI ref / UTR / RRN / IMPS ref / cheque number. */
export function findRef(t: string): string | null {
  const tries = [
    /transaction\s*reference\s*number\s*(?:is)?\s*[:#-]?\s*([A-Z0-9]{8,22})\b/i,
    /\b(?:utr|rrn|upi\s*ref|imps\s*ref|neft\s*ref|ref(?:erence)?|txn\s*(?:id|no))(?:\s*(?:no\.?|number|id))?\s*[:#-]?\s*([A-Z0-9]{8,22})\b/i,
    /\bUPI[-/](\d{12})\b/i,
    /\b(\d{12})\b(?=[^\n]*\b(?:upi|imps|rrn)\b)/i,
  ];
  for (const re of tries) { const m = t.match(re); if (m && /\d{4,}/.test(m[1])) return m[1].toUpperCase(); }
  return null;
}

/** Balance after the transaction: "Avl Bal Rs 10,000.00", "Available Balance is INR 10,000", "Total Avail.bal INR …". */
export function findBalance(t: string): number | null {
  const m = t.match(new RegExp(String.raw`(?:avl\.?\s*bal(?:ance)?|available\s*bal(?:ance)?|avail\.?\s*bal(?:ance)?|clear\s*bal(?:ance)?|\bbal(?:ance)?)\b.{0,25}?` + AMT, "i"));
  return m ? num(m[1]) : null;
}

/** Debit or credit from the bank's wording; null when it says both or neither. */
export function findDirection(t: string): "dr" | "cr" | null {
  const dr = /\b(debited|debit(?:ed)?\s+(?:by|from|with)|withdrawn|has\s+a\s+debit|spent|paid|sent|transferred\s+from|purchase)\b/i.test(t);
  const cr = /\b(credited|credit(?:ed)?\s+(?:by|to|with)|deposited|has\s+a\s+credit|received)\b/i.test(t);
  if (dr && !cr) return "dr";
  if (cr && !dr) return "cr";
  if (dr && cr) {
    // "debited from your account … credited to VPA x" — the part about *your* account decides
    const mine = t.match(/\b(debited|credited)\b[^.]{0,40}\b(?:your|ur)\s+(?:a\/?c|account)|\b(?:your|ur)\s+(?:a\/?c|account)[^.]{0,40}\b(debited|credited)\b/i);
    const w = (mine?.[1] ?? mine?.[2] ?? "").toLowerCase();
    return w === "debited" ? "dr" : w === "credited" ? "cr" : null;
  }
  return null;
}

/** Last 4 of the account in the alert. */
export function findLast4(t: string): string | null {
  const m = t.match(/\b(?:a\/?c|acct|account)(?:\s*(?:no\.?|number|ending(?:\s+with)?))?\s*[:.-]?\s*[X*x•.]*\s*(\d{4,})\b/i) ?? t.match(/\*\*(\d{4})\b/) ?? t.match(/\b[X]{2,}(\d{4})\b/i);
  return m ? m[1].slice(-4) : null;
}

/** Short narration: counterparty / channel, without the boilerplate. */
export function narrationOf(t: string): string {
  const to = t.match(/\b(?:to|from|by)\s+(?:vpa\s+)?([A-Za-z0-9._@&' -]{3,60}?)(?:\s+on\b|\s+ref|\s*\.|,|\s+upi|\s+avl|$)/i);
  const info = t.match(/\binfo[:\s]+([^\n.]{3,80})/i);
  const via = t.match(/\b(UPI|NEFT|RTGS|IMPS|ATM|POS|CHEQUE|CHQ|ECS|NACH)\b/i);
  return [via?.[1]?.toUpperCase(), (info?.[1] ?? to?.[1] ?? "").trim()].filter(Boolean).join(" · ").slice(0, 140) || "Bank alert";
}

type Template = { name: string; test: RegExp };
// Each bank's wording, used to choose the template and to reject marketing mail from the same sender
const TEMPLATES: Record<string, Template[]> = {
  sbi: [{ name: "sbi-transfer", test: /\b(?:a\/c|account)\b[\s\S]{0,40}\b(?:debited|credited|has a (?:debit|credit))\b/i }],
  federal: [{ name: "federal-alert", test: /\b(?:debited|credited)\b[\s\S]{0,60}\b(?:a\/c|account)\b/i }],
  hdfc: [
    { name: "hdfc-upi", test: /\b(?:debited|credited)\s+(?:from|to)\s+(?:your\s+)?account\s+\*\*\d{4}/i },
    { name: "hdfc-generic", test: /\b(?:debited|credited)\b[\s\S]{0,80}\b(?:a\/c|account)\b/i },
  ],
  icici: [{ name: "icici-alert", test: /\b(?:account|acct)\s+XX\d{4}\s+(?:is|has been)\s+(?:debited|credited)\b/i }],
  sib: [{ name: "sib-alert", test: /\b(?:a\/c|account)\b[\s\S]{0,40}\b(?:debited|credited)\b/i }],
  canara: [{ name: "canara-alert", test: /\b(?:amount\s+of\s+)?(?:inr|rs\.?)\s*[\d,.]+\s+has\s+been\s+(?:debited|credited)\b/i }],
};

/** Parse one alert. `bankCode` picks the template set; the shared readers then pull the fields. */
export function parseAlert(bankCode: string, subject: string, body: string): AlertParse {
  const text = `${subject}\n${/<[a-z][\s\S]*>/i.test(body) ? htmlToText(body) : body}`.replace(/\s+/g, " ");
  const tpl = (TEMPLATES[bankCode] ?? []).find(x => x.test.test(text));
  const parser = tpl?.name ?? "generic";
  const amount = (() => {
    // the transaction amount sits next to debited/credited; the balance amount is read separately
    const near = text.match(new RegExp(String.raw`(?:debited|credited|debit|credit|withdrawn|deposited|spent|paid|received)\b[^.]{0,40}?` + AMT, "i"))
      ?? text.match(new RegExp(AMT + String.raw`[^.]{0,40}?\b(?:debited|credited|withdrawn|deposited|spent|paid|received)\b`, "i"));
    return near ? num(near[1]) : firstAmount(text);
  })();
  const dr_cr = findDirection(text);
  const date = findDate(text);
  if (!amount || amount <= 0) return { ok: false, reason: "No transaction amount found" };
  if (!dr_cr) return { ok: false, reason: "Couldn't tell if it was a debit or a credit" };
  if (!date) return { ok: false, reason: "No transaction date found" };
  if (!tpl && !/\b(a\/?c|account|acct)\b/i.test(text)) return { ok: false, reason: "Doesn't look like a transaction alert" };
  return { ok: true, parser, line: { date, amount, dr_cr, ref: findRef(text), narration: narrationOf(text), balance: findBalance(text), last4: findLast4(text) } };
}

/** Google's "Gmail Forwarding Confirmation": the code, the confirm link and the address asking to forward. */
export function parseGmailConfirm(subject: string, body: string): { code: string | null; link: string | null; requester: string | null } {
  const t = `${subject}\n${/<[a-z][\s\S]*>/i.test(body) ? htmlToText(body) : body}`;
  const code = (t.match(/\(#(\d{6,12})\)/) ?? t.match(/confirmation code:\s*(\d{6,12})/i))?.[1] ?? null;
  const link = body.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"'<>]+/i)?.[0]?.replace(/&amp;/g, "&") ?? null;
  const requester = (t.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s+has requested to automatically forward/i)?.[1] ?? null)?.toLowerCase() ?? null;
  return { code, link, requester };
}
