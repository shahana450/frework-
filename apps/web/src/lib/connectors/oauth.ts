// Sign-in connections for Zoho Books and QuickBooks Online. FreWork's own app keys live in server settings:
// ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET (+ ZOHO_ACCOUNTS, default accounts.zoho.in) and QBO_CLIENT_ID / QBO_CLIENT_SECRET (+ QBO_ENV=sandbox).
import { createHmac, timingSafeEqual } from "node:crypto";
import { balanced, getJson, ConnectorError, type FeedItem, type ProposedLine } from "./types";

export type OAuthProvider = "zoho_books" | "quickbooks";
export type OAuthCreds = { access_token: string; refresh_token: string; expires_at: number; api_domain?: string; accounts_server?: string; org_id?: string; realm_id?: string };

const ZOHO_ACCOUNTS = () => process.env.ZOHO_ACCOUNTS || "https://accounts.zoho.in";
const QBO_API = () => (process.env.QBO_ENV === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com");
const QBO_TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export const oauthConfigured = (p: OAuthProvider) => p === "zoho_books" ? !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET) : !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET);
export const redirectUri = (origin: string, p: OAuthProvider) => `${origin}/api/finance/connectors/oauth/${p}`;

// The state parameter carries business + user, signed so a callback can't be forged for someone else's business
const stateKey = () => { const k = process.env.PORTAL_TOKEN_KEY; if (!k) throw new ConnectorError("NOT_CONFIGURED", "PORTAL_TOKEN_KEY is not set in server settings."); return k; };
export function signState(v: { b: string; u: string }): string {
  const body = Buffer.from(JSON.stringify({ ...v, t: Date.now() })).toString("base64url");
  return `${body}.${createHmac("sha256", stateKey()).update(body).digest("base64url")}`;
}
export function readState(s: string): { b: string; u: string } {
  const [body, sig] = (s ?? "").split(".");
  const want = createHmac("sha256", stateKey()).update(body ?? "").digest();
  const got = Buffer.from(sig ?? "", "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new ConnectorError("INVALID", "The sign-in link is invalid. Start again from Integrations.");
  const v = JSON.parse(Buffer.from(body, "base64url").toString());
  if (Date.now() - v.t > 15 * 60000) throw new ConnectorError("INVALID", "The sign-in took too long. Start again from Integrations.");
  return v;
}

export function authUrl(p: OAuthProvider, origin: string, state: string): string {
  if (!oauthConfigured(p)) throw new ConnectorError("NOT_CONFIGURED", `${p === "zoho_books" ? "Zoho Books" : "QuickBooks"} isn't set up on FreWork's server yet.`);
  const q = new URLSearchParams({ client_id: p === "zoho_books" ? process.env.ZOHO_CLIENT_ID! : process.env.QBO_CLIENT_ID!, response_type: "code", redirect_uri: redirectUri(origin, p), state });
  if (p === "zoho_books") { q.set("scope", "ZohoBooks.accountants.READ,ZohoBooks.settings.READ"); q.set("access_type", "offline"); q.set("prompt", "consent"); return `${ZOHO_ACCOUNTS()}/oauth/v2/auth?${q}`; }
  q.set("scope", "com.intuit.quickbooks.accounting");
  return `https://appcenter.intuit.com/connect/oauth2?${q}`;
}

async function tokenCall(p: OAuthProvider, form: Record<string, string>, accountsServer?: string) {
  if (p === "zoho_books") {
    const q = new URLSearchParams({ ...form, client_id: process.env.ZOHO_CLIENT_ID!, client_secret: process.env.ZOHO_CLIENT_SECRET! });
    const d = await getJson(`${accountsServer || ZOHO_ACCOUNTS()}/oauth/v2/token?${q}`, { method: "POST" }, "Zoho");
    if (d.error) throw new ConnectorError("AUTH", `Zoho: ${d.error}`);
    return d;
  }
  const basic = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
  return getJson(QBO_TOKEN, { method: "POST", headers: { Authorization: `Basic ${basic}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() }, "QuickBooks");
}

/** Exchanges the sign-in code; returns credentials and a label for the connected company. */
export async function finishOAuth(p: OAuthProvider, origin: string, sp: URLSearchParams): Promise<{ creds: OAuthCreds; label: string }> {
  const code = sp.get("code");
  if (!code) throw new ConnectorError("AUTH", sp.get("error") ? `Access was not granted (${sp.get("error")}).` : "No sign-in code was returned.");
  const accounts_server = sp.get("accounts-server") ?? undefined;
  const t = await tokenCall(p, { grant_type: "authorization_code", code, redirect_uri: redirectUri(origin, p) }, accounts_server);
  const creds: OAuthCreds = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000 - 60000, api_domain: t.api_domain, accounts_server };
  if (p === "zoho_books") {
    const orgs = await getJson(`${creds.api_domain ?? "https://www.zohoapis.in"}/books/v3/organizations`, { headers: { Authorization: `Zoho-oauthtoken ${creds.access_token}` } }, "Zoho Books");
    const org = (orgs.organizations ?? []).find((o: { is_default_org: boolean }) => o.is_default_org) ?? orgs.organizations?.[0];
    if (!org) throw new ConnectorError("PROVIDER", "No Zoho Books organisation found on this account.");
    creds.org_id = String(org.organization_id);
    return { creds, label: org.name };
  }
  const realm = sp.get("realmId");
  if (!realm) throw new ConnectorError("AUTH", "QuickBooks didn't say which company was chosen.");
  creds.realm_id = realm;
  const info = await getJson(`${QBO_API()}/v3/company/${realm}/companyinfo/${realm}?minorversion=73`, { headers: { Authorization: `Bearer ${creds.access_token}`, Accept: "application/json" } }, "QuickBooks").catch(() => null);
  return { creds, label: info?.CompanyInfo?.CompanyName ?? `Company ${realm}` };
}

async function fresh(p: OAuthProvider, c: OAuthCreds): Promise<OAuthCreds> {
  if (Date.now() < c.expires_at) return c;
  const t = await tokenCall(p, { grant_type: "refresh_token", refresh_token: c.refresh_token }, c.accounts_server);
  return { ...c, access_token: t.access_token, refresh_token: t.refresh_token ?? c.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000 - 60000 };
}

/** Journals from the accounting system, proposed with the same ledger names. Returns refreshed credentials to store. */
export async function fetchOAuth(p: OAuthProvider, c0: OAuthCreds, since: Date): Promise<{ items: FeedItem[]; creds: OAuthCreds }> {
  const c = await fresh(p, c0);
  const items: FeedItem[] = [];
  if (p === "zoho_books") {
    const base = `${c.api_domain ?? "https://www.zohoapis.in"}/books/v3`, h = { headers: { Authorization: `Zoho-oauthtoken ${c.access_token}` } };
    const list = await getJson(`${base}/journals?organization_id=${c.org_id}&filter_by=JournalDate.All&per_page=200&sort_column=journal_date&sort_order=D`, h, "Zoho Books");
    const recent = (list.journals ?? []).filter((j: { journal_date: string }) => j.journal_date >= since.toISOString().slice(0, 10)).slice(0, 60);
    for (const j of recent) {
      const d = await getJson(`${base}/journals/${j.journal_id}?organization_id=${c.org_id}`, h, "Zoho Books");
      const jr = d.journal ?? {};
      const lines: ProposedLine[] = (jr.line_items ?? []).map((l: { account_name: string; debit_or_credit: string; amount: number }) => ({ ledger: l.account_name, head: "", dr: l.debit_or_credit === "debit" ? Number(l.amount) : 0, cr: l.debit_or_credit === "credit" ? Number(l.amount) : 0 }));
      items.push({ external_id: `zoho-${j.journal_id}`, kind: "journal", date: jr.journal_date ?? j.journal_date, party: null, amount: Number(jr.total ?? j.total ?? 0), currency: jr.currency_code ?? null,
        description: `Zoho Books journal ${jr.entry_number ?? j.entry_number ?? ""}${jr.notes ? ` · ${jr.notes}` : ""}`.trim(), lines: balanced(lines) });
    }
  } else {
    const q = encodeURIComponent(`select * from JournalEntry where MetaData.LastUpdatedTime > '${since.toISOString()}' MAXRESULTS 200`);
    const d = await getJson(`${QBO_API()}/v3/company/${c.realm_id}/query?query=${q}&minorversion=73`, { headers: { Authorization: `Bearer ${c.access_token}`, Accept: "application/json" } }, "QuickBooks");
    for (const j of d.QueryResponse?.JournalEntry ?? []) {
      const lines: ProposedLine[] = (j.Line ?? []).filter((l: { JournalEntryLineDetail?: unknown }) => l.JournalEntryLineDetail).map((l: { Amount: number; JournalEntryLineDetail: { PostingType: string; AccountRef: { name: string } } }) => ({
        ledger: l.JournalEntryLineDetail.AccountRef.name, head: "", dr: l.JournalEntryLineDetail.PostingType === "Debit" ? Number(l.Amount) : 0, cr: l.JournalEntryLineDetail.PostingType === "Credit" ? Number(l.Amount) : 0,
      }));
      const total = lines.reduce((s, l) => s + l.dr, 0);
      items.push({ external_id: `qbo-${j.Id}`, kind: "journal", date: j.TxnDate, party: null, amount: total, currency: j.CurrencyRef?.value ?? null,
        description: `QuickBooks journal ${j.DocNumber ?? j.Id}${j.PrivateNote ? ` · ${j.PrivateNote}` : ""}`, lines: balanced(lines) });
    }
  }
  return { items, creds: c };
}
