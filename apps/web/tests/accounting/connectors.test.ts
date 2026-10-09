import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRazorpay } from "../../src/lib/connectors/razorpay";
import { fetchShopify } from "../../src/lib/connectors/shopify";
import type { FeedItem } from "../../src/lib/connectors/types";

const sum = (i: FeedItem, k: "dr" | "cr") => Math.round(i.lines.reduce((s, l) => s + l[k], 0) * 100) / 100;
const mock = (route: (url: string) => unknown, headers: Record<string, string> = {}) => {
  globalThis.fetch = (async (u: string) => new Response(JSON.stringify(route(String(u))), { status: 200, headers })) as typeof fetch;
};

test("Razorpay: payment splits fee and GST on fee; settlement moves clearing to bank", async () => {
  mock(u => /payments/.test(u) ? { items: [{ id: "pay_1", status: "captured", amount: 1180000, fee: 27848, tax: 4248, currency: "INR", created_at: 1790000000, email: "a@b.in" }, { id: "pay_2", status: "failed", amount: 100, created_at: 1790000000 }] }
    : /settlements/.test(u) ? { items: [{ id: "setl_1", status: "processed", amount: 1152152, created_at: 1790100000, utr: "UTR1" }] } : { items: [] });
  const items = await fetchRazorpay({ key_id: "rzp_test_x", key_secret: "s" }, new Date(0));
  assert.equal(items.length, 2, "failed payment skipped");
  const pay = items.find(i => i.kind === "receipt")!;
  assert.equal(sum(pay, "dr"), 11800); assert.equal(sum(pay, "cr"), 11800);
  assert.deepEqual(pay.lines.map(l => [l.ledger, l.dr, l.cr]), [["Razorpay Clearing", 11521.52, 0], ["Payment Gateway Charges", 236, 0], ["Input GST on Gateway Charges", 42.48, 0], ["Sales — Online", 0, 11800]]);
  const st = items.find(i => i.kind === "settlement")!;
  assert.equal(sum(st, "dr"), sum(st, "cr"));
});

test("Shopify: paid order splits sales, shipping and GST; refunds reverse", async () => {
  mock(() => ({ orders: [{ id: 9, name: "#1001", financial_status: "partially_refunded", total_price: "1298.00", total_tax: "198.00", total_shipping_price_set: { shop_money: { amount: "100.00" } }, currency: "INR", created_at: "2026-10-01T10:00:00Z", customer: { first_name: "Asha" },
    refunds: [{ id: 5, created_at: "2026-10-03T10:00:00Z", transactions: [{ kind: "refund", status: "success", amount: "500.00" }] }] }, { id: 10, name: "#1002", financial_status: "pending", total_price: "50" }] }));
  const items = await fetchShopify({ shop: "x.myshopify.com", token: "t" }, new Date(0));
  assert.equal(items.length, 2, "unpaid order skipped");
  const o = items.find(i => i.kind === "order")!;
  assert.equal(sum(o, "dr"), 1298); assert.equal(sum(o, "cr"), 1298);
  assert.equal(o.lines.find(l => l.ledger === "Sales — Shopify")!.cr, 1000);
  assert.equal(items.find(i => i.kind === "refund")!.amount, 500);
});

import { toFeedItem, fetchBankFeed } from "../../src/lib/connectors/bankfeed";
test("Bank feed: lines go to a purpose ledger or Suspense, always balanced", async () => {
  const gst = toFeedItem({ id: "1", date: "2026-10-01", narration: "GST PMT CPIN 123", amount: 18450, dir: "out" }, "HDFC Bank", "aa-");
  assert.deepEqual(gst.lines.map(l => [l.ledger, l.dr, l.cr]), [["GST Payable", 18450, 0], ["HDFC Bank", 0, 18450]]);
  assert.equal(gst.kind, "payment");
  const inc = toFeedItem({ id: "2", date: "2026-10-01", narration: "NEFT CR ACME TRADERS INV 1042", amount: 59000, dir: "in" }, "HDFC Bank", "aa-");
  assert.deepEqual(inc.lines.map(l => [l.ledger, l.dr, l.cr]), [["HDFC Bank", 59000, 0], ["Bank Feed Suspense", 0, 59000]]);
  assert.equal(inc.kind, "receipt");
  const demo = await fetchBankFeed({ mode: "demo", mobile: "9876543210", bank_ledger: "HDFC Bank" }, new Date(Date.now() - 30 * 86400000));
  assert.ok(demo.items.length >= 5 && demo.items.every(i => i.description.startsWith("[Demo]") && sum(i, "dr") === sum(i, "cr")));
});
