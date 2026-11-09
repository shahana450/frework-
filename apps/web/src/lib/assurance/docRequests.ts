// Missing-document finder and client follow-up: request wording, validation of what was uploaded, and grouped
// reminder drafts. Pure. Sending happens elsewhere, only through the business's own WhatsApp/email setup and only
// when a person presses Send.
import type { Finding } from "./detective";
import { inr } from "./detective";

export type DocRequest = {
  id?: string; exceptionId?: string | null; journalId: string | null; party: string | null; date: string | null; amount: number | null;
  docKind: "purchase_invoice" | "bill" | "credit_note" | "payment_proof" | "gstin" | "clarification";
  message: string; status: "open" | "received" | "fulfilled" | "insufficient" | "cancelled"; remindCount?: number; lastRemindedAt?: string | null; dueOn?: string | null;
};

const longDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

export function requestFor(f: Finding & { id?: string }): DocRequest | null {
  if (!f.needsDocument) return null;
  const when = f.date ? ` on ${longDate(f.date)}` : "";
  const amt = f.amount != null ? inr(f.amount) : "";
  const jid = f.journalIds[0] ?? null;
  const base = { exceptionId: f.id ?? null, journalId: jid, party: f.party, date: f.date, amount: f.amount, status: "open" as const };
  switch (f.ruleId) {
    case "D.PAYMENT_NO_BILL": return { ...base, docKind: "purchase_invoice", message: `Payment of ${amt} to ${f.party}${when} has no linked invoice. Please upload the supporting purchase invoice.` };
    case "D.NO_DOCUMENT": return { ...base, docKind: "bill", message: `${f.ledger ?? "Expense"} of ${amt}${f.party ? ` to ${f.party}` : ""}${when} has no supporting bill. Please upload it.` };
    case "D.UNADJUSTED_ADVANCE": return { ...base, docKind: "purchase_invoice", message: `${amt} paid to ${f.party} is still shown as an advance. Please upload their invoice, or proof of refund.` };
    case "GST.MISSING_GSTIN": return { ...base, docKind: "gstin", message: `Input GST was taken on a purchase from ${f.party}${when} (${amt}), but their GSTIN isn't on record. Please share the invoice showing their GSTIN.` };
    default: return { ...base, docKind: "clarification", message: `${f.title}. Please share the supporting document or a short explanation.` };
  }
}

export type Extract = { amount?: number | null; date?: string | null; party?: string | null; gstin?: string | null; invoiceNo?: string | null };
export type Validation = { ok: boolean; checks: { label: string; ok: boolean; detail: string }[] };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(m s|ms|pvt|private|ltd|limited|the)\b/g, " ").replace(/\s+/g, " ").trim();
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Is the uploaded document good enough to close the request? Amount within 1% (or ₹10), date within 45 days, party name overlaps, GSTIN well-formed when asked. */
export function validateDocument(req: Pick<DocRequest, "amount" | "date" | "party" | "docKind">, x: Extract): Validation {
  const checks: Validation["checks"] = [];
  if (req.amount != null) {
    const ok = x.amount != null && Math.abs(x.amount - req.amount) <= Math.max(10, req.amount * 0.01);
    checks.push({ label: "Amount", ok, detail: x.amount == null ? "No amount found on the document" : ok ? `${inr(x.amount)} agrees` : `Document says ${inr(x.amount)}, books say ${inr(req.amount)}` });
  }
  if (req.date) {
    const gap = x.date ? Math.abs(Date.parse(x.date) - Date.parse(req.date)) / 86400000 : Infinity;
    checks.push({ label: "Date", ok: gap <= 45, detail: x.date ? `${x.date} (${Math.round(gap)} days from the entry)` : "No date found" });
  }
  if (req.party) {
    const a = new Set(norm(req.party).split(" ").filter(w => w.length > 2)); const b = norm(x.party ?? "").split(" ").filter(w => w.length > 2);
    const ok = b.some(w => a.has(w));
    checks.push({ label: "Supplier", ok, detail: x.party ? (ok ? `${x.party} agrees` : `Document is from ${x.party}`) : "No supplier name found" });
  }
  if (req.docKind === "gstin") checks.push({ label: "GSTIN", ok: !!x.gstin && GSTIN.test(x.gstin.toUpperCase()), detail: x.gstin ? x.gstin : "No GSTIN found" });
  return { ok: checks.length > 0 && checks.every(c => c.ok), checks };
}

/** Requests that are due for a reminder: open, and not reminded within `everyDays`. */
export function dueForReminder(reqs: DocRequest[], today: string, everyDays = 3): DocRequest[] {
  return reqs.filter(r => (r.status === "open" || r.status === "insufficient") && (!r.lastRemindedAt || (Date.parse(today) - Date.parse(r.lastRemindedAt.slice(0, 10))) / 86400000 >= everyDays));
}
/** Open requests older than `days` (counted from the first reminder or the entry date) go to the assigned staff. */
export function overdue(reqs: (DocRequest & { createdAt?: string })[], today: string, days = 10) {
  return reqs.filter(r => (r.status === "open" || r.status === "insufficient") && r.createdAt && (Date.parse(today) - Date.parse(r.createdAt.slice(0, 10))) / 86400000 > days);
}

/** One message per client listing everything still needed — never asking again for what was received. */
export function followUpDraft(business: string, reqs: DocRequest[], channel: "whatsapp" | "email"): { subject: string; body: string } | null {
  const open = reqs.filter(r => r.status === "open" || r.status === "insufficient");
  if (!open.length) return null;
  const list = open.map((r, i) => `${i + 1}. ${r.message}${r.status === "insufficient" ? " (the earlier upload didn't match — please check)" : ""}`).join("\n");
  const subject = `${business}: ${open.length} document${open.length > 1 ? "s" : ""} needed for your books`;
  const body = channel === "whatsapp"
    ? `Hello, for *${business}* we still need:\n\n${list}\n\nPlease reply here with a photo or PDF of each. Thank you.`
    : `Dear Sir/Madam,\n\nTo complete the books of ${business}, we need the following:\n\n${list}\n\nYou can reply to this email with the documents attached, or upload them in FreBook (Smart Inbox).\n\nThank you.`;
  return { subject, body };
}
