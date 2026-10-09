// Shopify: paid orders (sales + GST + shipping) and refunds. Token from Shopify admin → Settings → Apps → Develop apps → Admin API access token (read_orders).
import { balanced, getJson, isoDay, r2, ConnectorError, type FeedItem } from "./types";

export type ShopifyCreds = { shop: string; token: string };
const VERSION = "2024-10";
const CLEARING = "Shopify Clearing";

export const normShop = (s: string) => (s ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const hdr = (c: ShopifyCreds) => ({ headers: { "X-Shopify-Access-Token": c.token, "Content-Type": "application/json" } });

export async function verifyShopify(c: ShopifyCreds): Promise<string> {
  const shop = normShop(c.shop);
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) || !c.token) throw new ConnectorError("INVALID", "Enter your shop as yourstore.myshopify.com and the Admin API access token.");
  const d = await getJson(`https://${shop}/admin/api/${VERSION}/shop.json`, hdr(c), "Shopify");
  return d.shop?.name ? `${d.shop.name} (${shop})` : shop;
}

export async function fetchShopify(c: ShopifyCreds, since: Date): Promise<FeedItem[]> {
  const shop = normShop(c.shop);
  const items: FeedItem[] = [];
  let url: string | null = `https://${shop}/admin/api/${VERSION}/orders.json?status=any&limit=250&updated_at_min=${since.toISOString()}`;
  for (let page = 0; url && page < 8; page++) {
    const res: Response = await fetch(url, { ...hdr(c), cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (res.status === 401 || res.status === 403) throw new ConnectorError("AUTH", "Shopify rejected the token — it needs the read_orders scope.");
    if (!res.ok) throw new ConnectorError("PROVIDER", `Shopify returned ${res.status}`);
    const d = await res.json();
    for (const o of d.orders ?? []) {
      const party = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") || o.email || null;
      if (["paid", "partially_refunded", "refunded"].includes(o.financial_status)) {
        const total = Number(o.total_price), tax = Number(o.total_tax ?? 0), ship = Number(o.total_shipping_price_set?.shop_money?.amount ?? 0);
        items.push({
          external_id: `order-${o.id}`, kind: "order", date: isoDay(o.processed_at ?? o.created_at), party, amount: total, currency: o.currency,
          description: `Shopify order ${o.name}${party ? ` · ${party}` : ""}`,
          lines: balanced([
            { ledger: CLEARING, head: "current_asset", dr: total, cr: 0 },
            { ledger: "Sales — Shopify", head: "sales", dr: 0, cr: r2(total - tax - ship) },
            { ledger: "Shipping Charges Collected", head: "indirect_income", dr: 0, cr: ship },
            { ledger: "Output GST", head: "duties", dr: 0, cr: tax },
          ]),
        });
      }
      for (const rf of o.refunds ?? []) {
        const amt = r2((rf.transactions ?? []).filter((t: { kind: string; status: string }) => t.kind === "refund" && t.status === "success").reduce((s: number, t: { amount: string }) => s + Number(t.amount), 0));
        if (amt <= 0) continue;
        items.push({ external_id: `refund-${rf.id}`, kind: "refund", date: isoDay(rf.created_at), party, amount: amt, currency: o.currency, description: `Shopify refund on ${o.name}`,
          lines: balanced([{ ledger: "Sales Returns — Shopify", head: "sales", dr: amt, cr: 0 }, { ledger: CLEARING, head: "current_asset", dr: 0, cr: amt }]) });
      }
    }
    const next = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return items;
}
