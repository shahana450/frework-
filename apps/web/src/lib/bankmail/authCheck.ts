// Is this forwarded email really from the bank? The forwarder (Gmail, Outlook, Microsoft 365) changes the envelope,
// so SPF on arrival describes the forwarder, not the bank. What survives a forward is the bank's own DKIM signature
// over the original message: we require a passing DKIM signature whose domain is the whitelisted bank domain, and
// record SPF / DMARC / ARC for the log. Anything else is quarantined with the reason.
import { underDomain, bankForSender, bareAddress, type WhitelistRow } from "./senders";

export type AuthSummary = {
  dkim: "pass" | "fail" | "none";
  dkimDomains: string[];        // domains of signatures that passed
  spf: string;                  // as seen on arrival (usually the forwarder)
  dmarc: string;
  arc: string;
};

export type AuthVerdict =
  | { ok: true; bank: WhitelistRow; auth: AuthSummary }
  | { ok: false; reason: string; auth: AuthSummary; bank: WhitelistRow | null };

type MailauthResult = {
  dkim?: { results?: { signingDomain?: string; status?: { result?: string } }[] };
  spf?: { status?: { result?: string } } | false;
  dmarc?: { status?: { result?: string } } | false;
  arc?: { status?: { result?: string } } | false;
};

/** Boil mailauth's output down to what we store and decide on. */
export function summarize(r: MailauthResult): AuthSummary {
  const results = r.dkim?.results ?? [];
  const passed = results.filter(x => x.status?.result === "pass").map(x => String(x.signingDomain ?? "").toLowerCase()).filter(Boolean);
  return {
    dkim: passed.length ? "pass" : results.length ? "fail" : "none",
    dkimDomains: passed,
    spf: (r.spf && r.spf.status?.result) || "none",
    dmarc: (r.dmarc && r.dmarc.status?.result) || "none",
    arc: (r.arc && r.arc.status?.result) || "none",
  };
}

/** The decision, separate from DNS so it can be tested. `from` is the original bank From: header. */
export function decide(from: string, auth: AuthSummary, whitelist: WhitelistRow[]): AuthVerdict {
  const bank = bankForSender(from, whitelist);
  if (!bank) return { ok: false, bank: null, auth, reason: `Sender ${bareAddress(from) || "(none)"} is not on the bank whitelist` };
  if (auth.dkim === "none") return { ok: false, bank, auth, reason: "No DKIM signature — can't prove the bank sent it (an Outlook 'Forward' instead of 'Redirect' strips it)" };
  const aligned = auth.dkimDomains.some(d => underDomain(d, bank.sender_domain));
  if (!aligned) return { ok: false, bank, auth, reason: auth.dkim === "pass" ? `DKIM passed only for ${auth.dkimDomains.join(", ")}, not the bank (${bank.sender_domain})` : "Bank DKIM signature failed — the email was changed after the bank sent it" };
  if (auth.dmarc === "fail" && auth.dkim !== "pass") return { ok: false, bank, auth, reason: "DMARC failed for the bank domain" };
  return { ok: true, bank, auth };
}

/** Run DKIM / SPF / DMARC / ARC on the raw email, then decide. */
export async function checkBankEmail(raw: Buffer, from: string, whitelist: WhitelistRow[]): Promise<AuthVerdict> {
  const { authenticate } = await import("mailauth");
  let summary: AuthSummary;
  try {
    const r = (await authenticate(raw, { trustReceived: true, disableBimi: true, mta: "frework.online" })) as unknown as MailauthResult;
    summary = summarize(r);
  } catch {
    summary = { dkim: "none", dkimDomains: [], spf: "temperror", dmarc: "temperror", arc: "none" };
  }
  return decide(from, summary, whitelist);
}
