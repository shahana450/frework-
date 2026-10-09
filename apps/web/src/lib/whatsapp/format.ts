// Pure helpers for FreBook on WhatsApp: reading commands and writing replies. No database or network.
import type { ParsedTransaction } from "../intentEngine";

export type Command =
  | { type: "link"; code: string } | { type: "yes" } | { type: "post_anyway" } | { type: "no" } | { type: "help" }
  | { type: "switch" } | { type: "pick"; n: number } | { type: "text"; text: string };

export function parseCommand(raw: string): Command {
  const t = raw.trim(), up = t.toUpperCase().replace(/[.!]+$/, "");
  const link = up.match(/^LINK\s*(\d{6})$/);
  if (link) return { type: "link", code: link[1] };
  if (["YES", "Y", "OK", "POST", "HAN", "HA", "HAAN", "CONFIRM", "👍"].includes(up)) return { type: "yes" };
  if (up === "POST ANYWAY") return { type: "post_anyway" };
  if (["NO", "N", "CANCEL", "NAHI", "NAI", "VENDA"].includes(up)) return { type: "no" };
  if (["HELP", "HI", "HELLO", "MENU", "START", "?"].includes(up)) return { type: "help" };
  if (["SWITCH", "BUSINESS", "CHANGE BUSINESS"].includes(up)) return { type: "switch" };
  if (/^[1-9]$/.test(up)) return { type: "pick", n: Number(up) };
  return { type: "text", text: t };
}

/** International digits only; Indian 10-digit numbers get 91. */
export function normPhone(p: string): string {
  const d = (p ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

export const money = (n: number, cur = "INR") => (cur === "INR" ? "₹" : cur + " ") + Number(n).toLocaleString(cur === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 2 });

export function helpText(bizName: string): string {
  return [
    `📒 *FreBook* · ${bizName}`,
    "",
    "*Record* — just type it:",
    "• Paid rent 25000 from bank",
    "• Sold goods to Asha 11800 incl GST, on credit",
    "• 200 ka petrol cash mein",
    "• Send a photo/PDF of a bill",
    "",
    "*Ask* —",
    "• Profit this month",
    "• Who owes me?",
    "• Cash and bank balance",
    "• GST collected last month",
    "",
    "Reply *YES* to post a draft, *NO* to drop it. *SWITCH* to change business.",
  ].join("\n");
}

/** The draft as a WhatsApp message, with any compliance problems first. */
export function draftText(p: ParsedTransaction, bad: { title: string; detail: string }[], cur = "INR"): string {
  const out: string[] = [];
  if (bad.length) {
    out.push("⚠️ *Compliance — check before posting*");
    for (const b of bad) out.push(`• *${b.title}.* ${b.detail}`);
    out.push("");
  }
  out.push(`📝 *Draft* · ${p.transaction_date}`, p.narrative ? `_${p.narrative.slice(0, 160)}_` : "", "");
  for (const l of p.lines) {
    if (l.debit) out.push(`Dr  ${l.account}  ${money(l.debit, cur)}`);
  }
  for (const l of p.lines) {
    if (l.credit) out.push(`   Cr  ${l.account}  ${money(l.credit, cur)}`);
  }
  const notes = p.warnings.filter(w => !/locked/i.test(w)).slice(0, 3);
  if (notes.length) out.push("", ...notes.map(w => `ℹ️ ${w}`));
  if (p.warnings.some(w => /locked/i.test(w))) out.push("", "🔒 This period is locked — post it from the app (owner/admin).");
  else out.push("", "Reply *YES* to post · *NO* to cancel");
  return out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

/** A book answer (from bookQueries) as a short WhatsApp message. */
export function answerText(a: { title: string; summary: string; table?: { columns: string[]; rows: (string | number)[][] } }, cur = "INR"): string {
  const out = [`📊 *${a.title}*`, a.summary];
  if (a.table?.rows.length) {
    out.push("");
    for (const r of a.table.rows.slice(0, 8)) out.push("• " + r.map(c => (typeof c === "number" ? money(c, cur) : String(c))).join(" · "));
    if (a.table.rows.length > 8) out.push(`…and ${a.table.rows.length - 8} more in the app.`);
  }
  return out.join("\n");
}
