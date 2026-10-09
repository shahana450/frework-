// Live bank feeds through an RBI Account Aggregator. The customer approves a consent in their AA app; FreWork (as FIU) then fetches
// transactions. Provider: AA_PROVIDER=setu with SETU_AA_CLIENT_ID / SETU_AA_CLIENT_SECRET / SETU_AA_PRODUCT_ID (+ SETU_AA_BASE for production).
// Without those, Demo mode produces sample transactions so the flow can be tried end to end.
import { groupKeyOf } from "../statementGroups";
import { balanced, getJson, isoDay, r2, ConnectorError, type FeedItem } from "./types";

export type BankFeedCreds = { mode: "demo" | "setu"; mobile: string; bank_ledger: string; consent_id?: string; consent_url?: string; consent_status?: string };
type Txn = { id: string; date: string; narration: string; amount: number; dir: "out" | "in" };

export const bankFeedDemo = () => (process.env.AA_PROVIDER ?? "") !== "setu";
const base = () => process.env.SETU_AA_BASE || "https://fiu-sandbox.setu.co";
const hdr = () => {
  const id = process.env.SETU_AA_CLIENT_ID, secret = process.env.SETU_AA_CLIENT_SECRET, product = process.env.SETU_AA_PRODUCT_ID;
  if (!id || !secret || !product) throw new ConnectorError("NOT_CONFIGURED", "Bank feeds aren't set up on FreWork's server yet (Setu AA keys missing).");
  return { "x-client-id": id, "x-client-secret": secret, "x-product-instance-id": product, "Content-Type": "application/json" };
};

/** Proposes an entry for one bank line: the bank ledger against a purpose ledger (rent, GST, salary …) or Bank Feed Suspense. */
export function toFeedItem(t: Txn, bankLedger: string, prefix: string): FeedItem {
  const rule = groupKeyOf(t.narration);
  const other = (rule.rule ? (t.dir === "out" ? rule.rule[2] : rule.rule[3]) : null) ?? "Bank Feed Suspense";
  const otherHead = other === "Bank Feed Suspense" ? "current_liability" : "";
  const amt = r2(t.amount);
  return {
    external_id: `${prefix}${t.id}`, kind: t.dir === "out" ? "payment" : "receipt", date: t.date, party: rule.rule ? null : rule.label === "Other" ? null : rule.label, amount: amt, currency: "INR",
    description: t.narration.slice(0, 200),
    lines: balanced(t.dir === "out"
      ? [{ ledger: other, head: otherHead, dr: amt, cr: 0 }, { ledger: bankLedger, head: "bank", dr: 0, cr: amt }]
      : [{ ledger: bankLedger, head: "bank", dr: amt, cr: 0 }, { ledger: other, head: otherHead, dr: 0, cr: amt }]),
  };
}

function demoTxns(now: Date): Txn[] {
  const d = (n: number) => isoDay(now.getTime() - n * 86400000);
  return [
    { id: "d1", date: d(1), narration: "UPI/DR/612345678901/AIRTEL BROADBAND/airtel@ybl", amount: 1179, dir: "out" },
    { id: "d2", date: d(2), narration: "NEFT CR-HDFC0000123-ACME TRADERS PVT LTD-INV 1042", amount: 59000, dir: "in" },
    { id: "d3", date: d(3), narration: "CONSOLIDATED CHARGES FOR A/C 1234 SMS ALERT", amount: 17.7, dir: "out" },
    { id: "d4", date: d(5), narration: "GST PMT CPIN 26103200012345", amount: 18450, dir: "out" },
    { id: "d5", date: d(6), narration: "IMPS/P2A/612399887766/RAHUL S/office rent oct", amount: 25000, dir: "out" },
    { id: "d6", date: d(8), narration: "ATM CASH WDL 01OCT KOCHI", amount: 10000, dir: "out" },
    { id: "d7", date: d(10), narration: "UPI/CR/612311112222/MEERA K/consulting", amount: 15000, dir: "in" },
  ];
}

/** Starts the consent. Returns the link where the customer approves it in their AA app. */
export async function startConsent(c: BankFeedCreds, redirectUrl: string): Promise<BankFeedCreds> {
  if (!/^[6-9]\d{9}$/.test(c.mobile)) throw new ConnectorError("INVALID", "Enter the 10-digit mobile number linked to the bank account.");
  if (!c.bank_ledger.trim()) throw new ConnectorError("INVALID", "Choose which bank ledger these transactions belong to.");
  if (c.mode === "demo") return { ...c, consent_id: "demo", consent_status: "ACTIVE" };
  const now = new Date(), from = new Date(now.getTime() - 365 * 86400000);
  const d = await getJson(`${base()}/v2/consents`, { method: "POST", headers: hdr(), body: JSON.stringify({
    consentDuration: { unit: "MONTH", value: "12" }, vua: c.mobile, dataRange: { from: from.toISOString(), to: new Date(now.getTime() + 365 * 86400000).toISOString() }, context: [], redirectUrl,
  }) }, "Account Aggregator");
  if (!d.id || !d.url) throw new ConnectorError("PROVIDER", "The Account Aggregator didn't return an approval link.");
  return { ...c, consent_id: d.id, consent_url: d.url, consent_status: d.status ?? "PENDING" };
}

export async function fetchBankFeed(c: BankFeedCreds, since: Date): Promise<{ items: FeedItem[]; creds: BankFeedCreds }> {
  if (c.mode === "demo") return { items: demoTxns(new Date()).filter(t => t.date >= isoDay(since)).map(t => toFeedItem({ ...t, narration: `[Demo] ${t.narration}` }, c.bank_ledger, "demo-")), creds: c };
  const consent = await getJson(`${base()}/v2/consents/${c.consent_id}`, { headers: hdr() }, "Account Aggregator");
  const status = String(consent.status ?? "PENDING").toUpperCase();
  const creds = { ...c, consent_status: status };
  if (status !== "ACTIVE") {
    if (["REJECTED", "REVOKED", "EXPIRED", "PAUSED"].includes(status)) throw new ConnectorError("AUTH", `The bank consent is ${status.toLowerCase()}. Connect again to approve a new one.`);
    return { items: [], creds };
  }
  const s = await getJson(`${base()}/v2/sessions`, { method: "POST", headers: hdr(), body: JSON.stringify({ consentId: c.consent_id, dataRange: { from: since.toISOString(), to: new Date().toISOString() }, format: "json" }) }, "Account Aggregator");
  let sess: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < 8; i++) {
    sess = await getJson(`${base()}/v2/sessions/${s.id}`, { headers: hdr() }, "Account Aggregator");
    if (["COMPLETED", "PARTIAL", "FAILED", "EXPIRED"].includes(String(sess.status).toUpperCase())) break;
    await new Promise(r => setTimeout(r, 2500));
  }
  if (!sess || !["COMPLETED", "PARTIAL"].includes(String(sess.status).toUpperCase())) throw new ConnectorError("PROVIDER", "The bank is still preparing your data — try Fetch now again in a minute.");
  const items: FeedItem[] = [];
  for (const fip of sess.fips ?? []) for (const acc of fip.accounts ?? []) {
    for (const t of acc.data?.account?.transactions?.transaction ?? []) {
      const date = String(t.valueDate ?? t.transactionTimestamp ?? "").slice(0, 10);
      if (!date) continue;
      items.push(toFeedItem({ id: `${acc.linkRefNumber ?? acc.maskedAccNumber}-${t.txnId ?? t.reference ?? date + t.amount}`, date, narration: String(t.narration ?? t.reference ?? "Bank transaction"), amount: Number(t.amount), dir: String(t.type).toUpperCase() === "DEBIT" ? "out" : "in" }, c.bank_ledger, "aa-"));
    }
  }
  return { items, creds };
}
