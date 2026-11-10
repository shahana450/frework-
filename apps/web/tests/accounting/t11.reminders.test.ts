import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentDue, nextDue, everyDue, complianceDueNow, summaryText, digestText, type PayReminder } from "../../src/lib/reminders";
import type { DueItem } from "../../src/lib/compliance";

const R = (p: Partial<PayReminder>): PayReminder => ({ id: "r", title: "Rent", party: null, amount: 25000, due_date: "2026-11-15", repeat: "monthly", remind_before: 3, every_days: 2, kind: "payment", status: "active", last_sent: null, ...p });

test("payment reminder starts N days before, repeats every N days, daily once overdue", () => {
  assert.equal(paymentDue(R({}), "2026-11-11"), false);              // 4 days before
  assert.equal(paymentDue(R({}), "2026-11-12"), true);               // 3 days before
  assert.equal(paymentDue(R({ last_sent: "2026-11-12" }), "2026-11-13"), false);
  assert.equal(paymentDue(R({ last_sent: "2026-11-12" }), "2026-11-14"), true);
  assert.equal(paymentDue(R({ last_sent: "2026-11-16" }), "2026-11-17"), true);   // overdue → every day
  assert.equal(paymentDue(R({ last_sent: "2026-11-17" }), "2026-11-17"), false);  // never twice a day
  assert.equal(paymentDue(R({ status: "paid" }), "2026-11-15"), false);
});

test("next due date keeps the day of month, clamped to short months", () => {
  assert.equal(nextDue("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextDue("2026-11-15", "quarterly"), "2027-02-15");
  assert.equal(nextDue("2026-11-15", "weekly"), "2026-11-22");
  assert.equal(nextDue("2024-02-29", "yearly"), "2025-02-28");
  assert.equal(nextDue("2026-11-15", "once"), null);
});

test("customer reminder frequencies", () => {
  assert.equal(everyDue("every3", "2026-11-10", "2026-11-08"), false);
  assert.equal(everyDue("every3", "2026-11-11", "2026-11-08"), true);
  assert.equal(everyDue("daily", "2026-11-10", "2026-11-10"), false);
  assert.equal(everyDue("off", "2026-11-10", null), false);
});

test("compliance: unfiled items within the window or overdue", () => {
  const it = (k: string, daysLeft: number, filed = false) => ({ key: k, kind: "gst", title: k, period: "Oct", due: "2026-11-20", daysLeft, amount: null, href: "", ...(filed ? { filed: { on: null, arn: null, demo: false } } : {}) }) as DueItem;
  assert.deepEqual(complianceDueNow([it("a", 2), it("b", 5), it("c", -3), it("d", 1, true)], 3).map(i => i.key), ["a", "c"]);
});

test("summary and digest text", () => {
  const t = summaryText({ business: "Sai", today: "2026-11-10", salesToday: 12000, salesMonth: 90000, receiptsToday: 5000, paymentsToday: 2000, cash: [{ name: "Cash", balance: 4000 }], bank: [{ name: "HDFC", balance: 150000 }, { name: "SBI", balance: -2000 }], loans: [{ name: "YES Bank Loan", balance: 500000 }], receivables: 80000, payables: -100, emiSoon: [R({ kind: "emi", title: "Car loan", due_date: "2026-11-12" })] });
  assert.match(t, /Sales today: \*₹12,000\*/); assert.match(t, /Bank: \*₹1,48,000\*/); assert.match(t, /Loans outstanding: \*₹5,00,000\*/); assert.match(t, /EMI — Car loan/); assert.match(t, /You owe suppliers: ₹0/);
  assert.equal(digestText("Sai", { payments: [], compliance: [] }), "");
  assert.match(digestText("Sai", { payments: ["• Rent"], compliance: [] }), /Payments to make/);
});
