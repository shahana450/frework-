// Phase 5 — due wording and per-route page titles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueText, dueChip, financeTitle } from "../../src/lib/dueText";

test("due text: today, tomorrow, in N days, overdue by N days", () => {
  assert.equal(dueText(0), "due today");
  assert.equal(dueText(1), "due tomorrow");
  assert.equal(dueText(9), "due in 9 days");
  assert.equal(dueText(-1), "overdue by 1 day");
  assert.equal(dueText(-4), "overdue by 4 days");
  assert.equal(dueChip(0), "Today"); assert.equal(dueChip(-3), "Overdue 3d"); assert.equal(dueChip(5), "5d");
});

test("page titles name the page and the company", () => {
  assert.equal(financeTitle("/finance/reports", "?tab=balance_sheet", "AUDIT TEST TRADERS"), "Balance Sheet · AUDIT TEST TRADERS | FreWork");
  assert.equal(financeTitle("/finance/reports", "?tab=trial_balance", "X"), "Trial Balance · X | FreWork");
  assert.equal(financeTitle("/finance/receivables", "", "X"), "Receivables · X | FreWork");
  assert.equal(financeTitle("/finance", "", ""), "Home | FreWork");
  assert.notEqual(financeTitle("/finance/gst/3b", "", "X"), financeTitle("/finance/gst", "", "X"));
});
