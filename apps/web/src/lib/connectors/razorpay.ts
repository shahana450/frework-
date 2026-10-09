// Razorpay: captured payments (gross, gateway fee, GST on fee) and settlements to the bank. Keys from Razorpay Dashboard → Account & Settings → API Keys.
import { balanced, getJson, isoDay, ConnectorError, type FeedItem } from "./types";

export type RazorpayCreds = { key_id: string; key_secret: string };
const BASE = "https://api.razorpay.com/v1";
const CLEARING = "Razorpay Clearing";

const auth = (c: RazorpayCreds) => ({ headers: { Authorization: "Basic " + Buffer.from(`${c.key_id}:${c.key_secret}`).toString("base64") } });

export async function verifyRazorpay(c: RazorpayCreds): Promise<string> {
  if (!/^rzp_(live|test)_\w+$/.test(c.key_id ?? "") || !c.key_secret) throw new ConnectorError("INVALID", "Enter the Key ID (starts with rzp_live_ or rzp_test_) and Key Secret.");
  await getJson(`${BASE}/payments?count=1`, auth(c), "Razorpay");
  return c.key_id.startsWith("rzp_test_") ? `${c.key_id} (test mode)` : c.key_id;
}

async function pages(c: RazorpayCreds, path: string, from: number): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const d = await getJson(`${BASE}/${path}?from=${from}&count=100&skip=${skip}`, auth(c), "Razorpay");
    out.push(...(d.items ?? []));
    if ((d.items ?? []).length < 100) break;
  }
  return out;
}

export async function fetchRazorpay(c: RazorpayCreds, since: Date): Promise<FeedItem[]> {
  const from = Math.floor(since.getTime() / 1000);
  const [payments, settlements, refunds] = await Promise.all([pages(c, "payments", from), pages(c, "settlements", from), pages(c, "refunds", from)]);
  const items: FeedItem[] = [];
  for (const p of payments) {
    if (p.status !== "captured") continue;
    const gross = p.amount / 100, fee = (p.fee ?? 0) / 100, tax = (p.tax ?? 0) / 100;
    const party = p.email || p.contact || null;
    items.push({
      external_id: p.id, kind: "receipt", date: isoDay(p.created_at * 1000), party, amount: gross, currency: p.currency,
      description: `Razorpay payment ${p.id}${p.description ? ` · ${p.description}` : ""}${party ? ` · ${party}` : ""}`,
      lines: balanced([
        { ledger: CLEARING, head: "current_asset", dr: gross - fee, cr: 0 },
        { ledger: "Payment Gateway Charges", head: "indirect_expense", dr: fee - tax, cr: 0 },
        { ledger: "Input GST on Gateway Charges", head: "duties", dr: tax, cr: 0 },
        { ledger: "Sales — Online", head: "sales", dr: 0, cr: gross },
      ]),
    });
  }
  for (const r of refunds) {
    const amt = r.amount / 100;
    items.push({ external_id: r.id, kind: "refund", date: isoDay(r.created_at * 1000), party: null, amount: amt, currency: r.currency, description: `Razorpay refund ${r.id} for ${r.payment_id}`,
      lines: balanced([{ ledger: "Sales Returns — Online", head: "sales", dr: amt, cr: 0 }, { ledger: CLEARING, head: "current_asset", dr: 0, cr: amt }]) });
  }
  for (const s of settlements) {
    if (s.status !== "processed") continue;
    const amt = s.amount / 100;
    items.push({ external_id: s.id, kind: "settlement", date: isoDay(s.created_at * 1000), party: null, amount: amt, currency: "INR", description: `Razorpay settlement ${s.id}${s.utr ? ` · UTR ${s.utr}` : ""}`,
      lines: balanced([{ ledger: "Bank", head: "bank", dr: amt, cr: 0 }, { ledger: CLEARING, head: "current_asset", dr: 0, cr: amt }]) });
  }
  return items;
}
