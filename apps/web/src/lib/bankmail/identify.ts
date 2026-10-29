// Which client forwarded this email? Clients auto-forward bank mail from their own mailbox to admin@frework.online
// (and a Microsoft 365 rule redirects it on to FreBook). The client's mailbox survives in the headers:
//   Gmail auto-forward      X-Forwarded-For: client@gmail.com admin@frework.online, X-Forwarded-To, and Return-Path
//                           rewritten to client+caf_=admin=frework.online@gmail.com
//   Google Workspace        same as Gmail, on the client's own domain
//   Outlook / Microsoft 365 redirect keeps the bank From:, sets Resent-From / X-MS-Exchange-Inbox-Rules-Loop
//                           or X-MS-Exchange-Generated-Message-Source; original To: / Delivered-To: is the client
// Then the account's last 4 digits in the body confirm the business. Anything unsure goes to the Unmatched queue.

export type Headers = Record<string, string | string[] | undefined>;
export type Source = { business_id: string; email: string };
export type Account = { id: string; business_id: string; bank_code: string; last4: string };

export type Identity =
  | { ok: true; business_id: string; account: Account; forwarder: string }
  | { ok: false; reason: string; forwarder: string | null; candidates: string[] };

const OURS = /(^|\.)frework\.online$/i;
const lc = (s: string) => String(s ?? "").trim().toLowerCase();
const all = (h: Headers, name: string): string[] => {
  const v = h[name.toLowerCase()];
  return v == null ? [] : (Array.isArray(v) ? v : [v]).map(String);
};
const emailsIn = (s: string) => [...String(s ?? "").matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => lc(m[0]));
const notOurs = (e: string) => !OURS.test(e.split("@")[1] ?? "");

/** Gmail "caf" return path: client+caf_=admin=frework.online@gmail.com → client@gmail.com */
export function fromCafReturnPath(rp: string): string | null {
  const m = lc(rp).match(/<?([^<>\s+]+)\+caf_=[^@]+@([^>\s]+)>?/);
  return m ? `${m[1]}@${m[2]}` : null;
}

/** Candidate client mailboxes, strongest signal first, never our own addresses or the bank's. */
export function forwardingIdentities(h: Headers, bankDomain?: string): { email: string; via: string }[] {
  const out: { email: string; via: string }[] = [];
  const push = (email: string | null, via: string) => {
    const e = lc(email ?? "");
    if (!e || !notOurs(e) || (bankDomain && e.endsWith(`@${bankDomain}`)) || out.some(x => x.email === e)) return;
    out.push({ email: e, via });
  };
  // Gmail / Workspace auto-forward: "X-Forwarded-For: client@gmail.com admin@frework.online"
  for (const v of all(h, "x-forwarded-for")) emailsIn(v).forEach(e => push(e, "x-forwarded-for"));
  for (const v of all(h, "return-path")) push(fromCafReturnPath(v), "return-path");
  // Outlook / Microsoft 365 redirect
  for (const v of all(h, "resent-from")) emailsIn(v).forEach(e => push(e, "resent-from"));
  for (const v of all(h, "resent-sender")) emailsIn(v).forEach(e => push(e, "resent-sender"));
  for (const v of all(h, "x-ms-exchange-inbox-rules-loop")) emailsIn(v).forEach(e => push(e, "x-ms-exchange-inbox-rules-loop"));
  // The mailbox the bank originally wrote to
  for (const v of all(h, "delivered-to")) emailsIn(v).forEach(e => push(e, "delivered-to"));
  for (const v of all(h, "x-original-to")) emailsIn(v).forEach(e => push(e, "x-original-to"));
  for (const v of all(h, "to")) emailsIn(v).forEach(e => push(e, "to"));
  for (const v of all(h, "x-forwarded-to")) emailsIn(v).forEach(e => push(e, "x-forwarded-to"));
  return out;
}

/** Last-4 digits of account numbers written in an email or statement: "A/c XX1234", "a/c no. ******5678", "ending 4321". */
export function last4sIn(text: string): string[] {
  const t = String(text ?? "");
  const found = new Set<string>();
  const re = /\b(?:a\/?c|acct|account)(?:\s*(?:no\.?|number|ending(?:\s+with)?))?\s*[:.-]?\s*[X*x•.]*\s*(\d{4,})\b|\bending\s+(?:with\s+)?[X*x]*(\d{4})\b|\b[X*x]{2,}(\d{4})\b/gi;
  for (const m of t.matchAll(re)) { const d = m[1] ?? m[2] ?? m[3]; if (d) found.add(d.slice(-4)); }
  return [...found];
}

/** Decide the business and account. Never guesses: anything ambiguous is returned as not ok with the reason. */
export function identify(h: Headers, bodyText: string, bankCode: string, bankDomain: string, sources: Source[], accounts: Account[]): Identity {
  const ids = forwardingIdentities(h, bankDomain);
  const forwarder = ids[0]?.email ?? null;
  const registered = new Map<string, Set<string>>();
  for (const s of sources) { const e = lc(s.email); if (!registered.has(e)) registered.set(e, new Set()); registered.get(e)!.add(s.business_id); }
  const hit = ids.find(i => registered.has(i.email));
  if (!hit) return { ok: false, forwarder, candidates: [], reason: ids.length ? `Forwarded from ${ids.map(i => i.email).join(", ")} — not a registered bank email ID` : "No forwarding address in the headers" };

  const businesses = [...registered.get(hit.email)!];
  const last4 = last4sIn(bodyText);
  const pool = accounts.filter(a => businesses.includes(a.business_id) && a.bank_code === bankCode);
  if (!last4.length) {
    // No account number in the mail: only safe when exactly one account of this bank is registered for one business
    if (businesses.length === 1 && pool.length === 1) return { ok: true, business_id: businesses[0], account: pool[0], forwarder: hit.email };
    return { ok: false, forwarder: hit.email, candidates: businesses, reason: "No account number (last 4 digits) in the email to choose the account" };
  }
  const matches = pool.filter(a => last4.includes(a.last4));
  if (matches.length === 1) return { ok: true, business_id: matches[0].business_id, account: matches[0], forwarder: hit.email };
  if (!matches.length) return { ok: false, forwarder: hit.email, candidates: businesses, reason: `Account ending ${last4.join("/")} is not registered for ${bankCode.toUpperCase()} under ${hit.email}` };
  return { ok: false, forwarder: hit.email, candidates: [...new Set(matches.map(m => m.business_id))], reason: `Account ending ${last4.join("/")} is registered more than once` };
}
