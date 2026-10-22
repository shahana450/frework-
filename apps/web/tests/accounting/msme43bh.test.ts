// Section 43B(h): payments to micro / small suppliers due within 15 days (no agreement) or the agreed period, max 45
import { test } from "node:test";
import assert from "node:assert/strict";
import { msmeReport, allowedDays, fyEndOf, type MsmeSupplier, type MsmeLine } from "../../src/lib/msme43bh";

test("allowed days: 15 without agreement, agreed period capped at 45", () => {
  assert.equal(allowedDays(null), 15);
  assert.equal(allowedDays(30), 30);
  assert.equal(allowedDays(90), 45);
});

test("financial year end", () => {
  assert.equal(fyEndOf("2026-10-22"), "2027-03-31");
  assert.equal(fyEndOf("2027-02-10"), "2027-03-31");
});

const sup: MsmeSupplier[] = [
  { accountId: "a", name: "Micro Parts", type: "micro", creditDays: null },
  { accountId: "b", name: "Small Co", type: "small", creditDays: 60 },
  { accountId: "c", name: "Medium Ltd", type: "medium", creditDays: null },
];
const lines: MsmeLine[] = [
  { account_id: "a", dr: 0, cr: 10000, date: "2026-10-01" },   // due 16 Oct → overdue
  { account_id: "a", dr: 0, cr: 5000, date: "2026-10-15" },    // due 30 Oct → due soon
  { account_id: "a", dr: 10000, cr: 0, date: "2026-10-20" },   // pays the first bill
  { account_id: "b", dr: 0, cr: 20000, date: "2026-10-10" },   // agreed 60 → 45 days: due 24 Nov
  { account_id: "c", dr: 0, cr: 99999, date: "2026-01-01" },   // medium: outside 43B(h)
];

test("payments settle the oldest bills; medium suppliers are left out", () => {
  const r = msmeReport(sup, lines, "2026-10-25");
  assert.deepEqual(r.bills.map(b => [b.supplier, b.unpaid, b.dueDate, b.status]), [
    ["Micro Parts", 5000, "2026-10-30", "due_soon"],
    ["Small Co", 20000, "2026-11-24", "ok"],
  ]);
  assert.equal(r.overdue, 0);
  assert.equal(r.dueSoon, 5000);
  assert.equal(r.atRiskAtFyEnd, 25000);
});

test("an unpaid bill past its date is overdue", () => {
  const r = msmeReport(sup, lines.filter(l => l.dr === 0), "2026-10-25");
  assert.equal(r.bills.find(b => b.billDate === "2026-10-01")?.status, "overdue");
  assert.equal(r.overdue, 10000);
});
