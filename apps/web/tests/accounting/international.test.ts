import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntry, questionFor, type Intent } from "../../src/lib/accountingRules";
import { IN_GST, NO_TAX, getTaxModule } from "../../src/lib/tax";
import { formatMoney } from "../../src/lib/money";
import { validateEntry } from "../../src/lib/posting";

const base = (o: Partial<Intent>): Intent => ({ action: "expense_payment", amount: 0, payment_mode: "bank", payment_account: "HDFC Bank", counter_account: null, party_name: null, ...o });
const pick = (r: ReturnType<typeof buildEntry>) => r.lines.map(l => [l.account, l.debit, l.credit]);
const balanced = (r: ReturnType<typeof buildEntry>) => {
  validateEntry(r.lines.map(l => ({ accountId: l.account, dr: l.debit, cr: l.credit })), "2026-10-01");
  return true;
};

test("India module is the default and unchanged", () => {
  const r = buildEntry(base({ action: "purchase", amount: 1180, gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } }));
  assert.deepEqual(pick(r), [["Purchases", 1000, 0], ["Input CGST", 90, 0], ["Input SGST", 90, 0], ["HDFC Bank", 0, 1180]]);
  assert.equal(r.fx, null);
});

test("a business without a tax module records the gross amount and says so", () => {
  const r = buildEntry(base({ action: "purchase", amount: 1050, gst: { applicable: true, rate: 5, inclusive: true, supply: "intra" }, tds: { applicable: true, section: "194C", rate: 1 } }), { tax: NO_TAX, baseCurrency: "AED" });
  assert.deepEqual(pick(r), [["Purchases", 1050, 0], ["HDFC Bank", 0, 1050]]);
  assert.ok(r.warnings.some(w => /no tax module/.test(w)));
  assert.ok(r.warnings.some(w => /no withholding module/.test(w)));
});

test("unknown regimes fall back to no tax instead of guessing", () => {
  assert.equal(getTaxModule("UK_VAT").id, "NONE");
  assert.equal(getTaxModule(undefined).id, "IN_GST");
  assert.equal(IN_GST.split(100, 0, true, "intra").components.length, 0);
});

test("foreign-currency receipt is posted in base currency and keeps the foreign amount", () => {
  const r = buildEntry(base({ action: "receipt_from_customer", amount: 2000, currency: "USD", exchange_rate: 83.25 }), { baseCurrency: "INR" });
  assert.deepEqual(pick(r), [["HDFC Bank", 166500, 0], ["Debtors Control", 0, 166500]]);
  assert.deepEqual(r.lines.map(l => [l.fc_debit, l.fc_credit]), [[2000, 0], [0, 2000]]);
  assert.deepEqual(r.fx, { currency: "USD", rate: 83.25, base_currency: "INR" });
  assert.match(r.rule, /USD at 83.25 = INR/);
});

test("a foreign amount without a rate asks for the rate instead of guessing", () => {
  const intent = base({ amount: 500, counter_account: "Software Subscriptions", currency: "USD" });
  const r = buildEntry(intent, { baseCurrency: "INR" });
  assert.ok(r.missing.includes("exchange_rate"));
  assert.match(questionFor("exchange_rate", intent), /exchange rate.*USD/);
});

test("rounding from conversion never unbalances the entry", () => {
  const r = buildEntry(base({ action: "purchase", amount: 333.33, currency: "USD", exchange_rate: 83.3333, gst: { applicable: true, rate: 18, inclusive: true, supply: "intra" } }), { baseCurrency: "INR" });
  assert.ok(balanced(r));
});

test("an entry in the base currency is not treated as foreign", () => {
  const r = buildEntry(base({ amount: 100, counter_account: "Rent", currency: "inr", exchange_rate: 1 }), { baseCurrency: "INR" });
  assert.equal(r.fx, null);
  assert.deepEqual(pick(r), [["Rent", 100, 0], ["HDFC Bank", 0, 100]]);
});

test("money follows the business currency and locale", () => {
  assert.equal(formatMoney(1234567.5, { currency: "INR", locale: "en-IN" }), "₹12,34,567.50");
  assert.equal(formatMoney(1234567.5, { currency: "USD", locale: "en-US" }), "$1,234,567.50");
  assert.equal(formatMoney(-500, { currency: "INR", locale: "en-IN" }), "−₹500");
  assert.match(formatMoney(2500, { currency: "AED", locale: "en-AE" }), /AED|د\.إ/);
});
