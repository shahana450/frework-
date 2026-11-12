import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCfo } from "../../src/lib/cfo";

const A = [
  { id: "bank", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "sales", name: "Sales", type: "income", sub_type: "revenue" },
  { id: "pur", name: "Purchases", type: "expense", sub_type: "direct_expense" },
  { id: "rent", name: "Office Rent", type: "expense", sub_type: "indirect_expense" },
  { id: "pen", name: "GST Late Fee Penalty", type: "expense", sub_type: "indirect_expense" },
  { id: "cust", name: "Acme Ltd", type: "asset", sub_type: "trade_receivables" },
];
let n = 0;
const J = (date: string, lines: [string, number, number][]) => ({ id: `j${++n}`, entry_no: `E${n}`, date, type: "journal", narration: "", party_name: null, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });

test("CFO view: margins, break-even from fixed vs variable costs, avoidable expenses, customer share", () => {
  const js = [
    J("2026-04-05", [["cust", 100000, 0], ["sales", 0, 100000]]),
    J("2026-04-06", [["pur", 40000, 0], ["bank", 0, 40000]]),
    J("2026-04-07", [["rent", 30000, 0], ["bank", 0, 30000]]),
    J("2026-04-08", [["pen", 2000, 0], ["bank", 0, 2000]]),
    J("2026-04-20", [["bank", 100000, 0], ["cust", 0, 100000]]),
  ];
  const c = computeCfo(A as never, js as never, "2026-04-01", "2026-04-30", "2026-04-30");
  assert.equal(c.revenue, 100000); assert.equal(c.gross, 60000); assert.equal(c.net, 28000);
  assert.equal(c.grossMargin, 60); assert.equal(c.netMargin, 28);
  // fixed = rent 30,000; variable = purchases 40,000 + penalty 2,000 → contribution 58%
  assert.equal(c.fixedCosts, 30000); assert.equal(c.contributionRatio, 58);
  assert.equal(Math.round(c.breakEvenYear!), 51724);
  assert.equal(c.heads.find(h => h.name === "GST Late Fee Penalty")?.flag, "avoidable");
  assert.equal(c.topCustomers[0].name, "Acme Ltd"); assert.equal(c.topCustomers[0].share, 100);
  assert.equal(c.cash.operating, 28000);
});

import { gstReturnLink } from "../../src/lib/gstIntent";
test("GST return requests open the GST page on the right return and month", () => {
  const now = new Date("2026-11-12T10:00:00");
  assert.equal(gstReturnLink("prepare GSTR1 Oct 2026", now), "/finance/gst?tab=gstr1&month=2026-10");
  assert.equal(gstReturnLink("file 3B for September", now), "/finance/gst?tab=gstr3b&month=2026-09");
  assert.equal(gstReturnLink("GSTR-1", now), "/finance/gst?tab=gstr1&month=2026-10");
  assert.equal(gstReturnLink("prepare GSTR1 December", now), "/finance/gst?tab=gstr1&month=2025-12");
  assert.equal(gstReturnLink("paid rent 25000 by bank", now), null);
});
