// Overdue alerts to the owner: when they go out, and the LIST reply
import { test } from "node:test";
import assert from "node:assert/strict";
import { alertDue, listMessage } from "../../src/lib/collectAlert";
import type { Debtor } from "../../src/lib/collect";

test("alert schedule: daily once a day, weekly on Mondays, off never", () => {
  assert.equal(alertDue("daily", "2026-10-17", null), true);
  assert.equal(alertDue("daily", "2026-10-17", "2026-10-17"), false);
  assert.equal(alertDue("weekly", "2026-10-19", null), true);   // Monday
  assert.equal(alertDue("weekly", "2026-10-17", null), false);  // Saturday
  assert.equal(alertDue("off", "2026-10-19", null), false);
});

test("LIST: one-tap WhatsApp link when a phone is saved, a hint when not", () => {
  const d = (name: string, phone: string | null): Debtor => ({ name, balance: 12000, oldestDays: 40, open: [{ date: "2026-09-07", ref: "SAL/0007", amount: 12000, days: 40 }], lastPayment: null, bucket: "31-60", phone });
  const msg = listMessage("REVALGI", [d("ABC Traders", "9876543210"), d("XYZ", null)], 30);
  assert.match(msg, /https:\/\/wa\.me\/919876543210\?text=/);
  assert.match(msg, /XYZ\* — ₹12,000 · 40 days\n\(no phone saved/);
  assert.match(listMessage("REVALGI", [], 30), /Nobody is overdue/);
});
