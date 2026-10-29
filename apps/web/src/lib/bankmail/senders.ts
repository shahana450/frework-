// Which bank sent a forwarded email, from the bank sender whitelist (fw_bank_sender_whitelist).
// A sender only counts when its domain is whitelisted AND the bank's own DKIM signature verifies (see authCheck.ts).

export type WhitelistRow = { bank_code: string; bank_name: string; sender_domain: string; sender_patterns: string[]; active: boolean };

const lc = (s: string) => String(s ?? "").trim().toLowerCase();

/** The bare address from a From: value: "HDFC Bank <alerts@hdfcbank.net>" → "alerts@hdfcbank.net". */
export function bareAddress(from: string): string {
  const m = String(from ?? "").match(/<([^<>\s]+@[^<>\s]+)>/) ?? String(from ?? "").match(/([^\s<>"']+@[^\s<>"']+)/);
  return lc(m?.[1] ?? "");
}

export const domainOf = (addr: string) => lc(addr).split("@")[1] ?? "";

/** True when `domain` is `base` or a subdomain of it (alerts.sbi.co.in is under sbi.co.in; evilsbi.co.in is not). */
export function underDomain(domain: string, base: string): boolean {
  const d = lc(domain), b = lc(base);
  return !!d && !!b && (d === b || d.endsWith(`.${b}`));
}

/** "*@alerts.sbi.co.in" or an exact address. */
export function matchesPattern(addr: string, pattern: string): boolean {
  const a = lc(addr), p = lc(pattern);
  if (!a || !p) return false;
  if (p.startsWith("*@")) return domainOf(a) === p.slice(2);
  return a === p;
}

/** The whitelist rows a From: address belongs to (domain under sender_domain and matching a sender pattern). */
export function bankForSender(from: string, rows: WhitelistRow[]): WhitelistRow | null {
  const addr = bareAddress(from), dom = domainOf(addr);
  if (!addr) return null;
  return rows.find(r => r.active && underDomain(dom, r.sender_domain) && (r.sender_patterns.length === 0 || r.sender_patterns.some(p => matchesPattern(addr, p)))) ?? null;
}

/** Gmail's forwarding confirmation mail ("(#123456789) Gmail Forwarding Confirmation"). */
export const isGmailConfirmSender = (from: string) => bareAddress(from) === "forwarding-noreply@google.com";

/** Gmail filter text for the client's banks: from:(alerts@hdfcbank.net OR *@alerts.sbi.co.in) — wildcards become domains. */
export function gmailFilterFor(rows: WhitelistRow[]): string {
  const parts = [...new Set(rows.filter(r => r.active).flatMap(r => r.sender_patterns.length ? r.sender_patterns : [`*@${r.sender_domain}`]).map(p => p.startsWith("*@") ? p.slice(2) : p))];
  return parts.length ? `from:(${parts.join(" OR ")})` : "";
}
