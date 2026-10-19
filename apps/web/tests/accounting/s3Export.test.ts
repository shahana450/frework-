// All-statements Excel: sheet rows match the on-screen figures
import { test } from "node:test";
import assert from "node:assert/strict";
import { tbRows, plS3Rows, notesRows } from "../../src/lib/s3Export";
import { scheduleIIIPL } from "../../src/lib/schedule3";

const meta = { business: "REVALGI", period: "FY 2026-27" };

test("TB sheet: opening split Dr/Cr, movement, closing, grand totals", () => {
  const rows = tbRows([
    { code: "1", name: "Cash", opening: 1000, period_dr: 500, period_cr: 200, dr: 1300, cr: 0 },
    { code: "2", name: "Capital", opening: -1000, period_dr: 0, period_cr: 300, dr: 0, cr: 1300 },
  ], meta);
  assert.deepEqual(rows[5], ["1", "Cash", 1000, null, 500, 200, 1300, null]);
  assert.deepEqual(rows.at(-1), [null, "Grand Total", 1000, 1000, 500, 500, 1300, 1300]);
});

test("P&L sheet and notes carry note numbers and ledger lines", () => {
  const s = (key: string, lines: { id: string; name: string; amount: number }[]) => ({ key, title: key, lines, total: lines.reduce((a, l) => a + l.amount, 0) });
  const pl = scheduleIIIPL({ sections: [s("sales", [{ id: "a", name: "Sales", amount: 1000 }]), s("direct_expense", []), s("indirect_income", []), s("indirect_expense", [{ id: "b", name: "Rent", amount: 300 }])], grossProfit: 1000, netProfit: 700, footed: true, problems: [] });
  const rows = plS3Rows(pl, meta);
  assert.ok(rows.some(r => r[0] === "I. Revenue from operations" && r[1] === 1 && r[2] === 1000));
  assert.deepEqual(rows.at(-1), ["VI. Profit for the year", null, 700]);
  const notes = notesRows(undefined, pl, meta);
  assert.ok(notes.some(r => r[0] === "    Rent" && r[2] === 300));
});
