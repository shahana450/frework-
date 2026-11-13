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

import { reconcileBank } from "../../src/lib/bankRecon";
test("Bank reconciliation matches by reference, then amount and date, and builds the BRS", () => {
  const bank = [
    { id: "a", date: "2026-10-03", description: "NEFT UTR123456 ACME", debit: 0, credit: 5000 },
    { id: "b", date: "2026-10-05", description: "RENT", debit: 25000, credit: 0 },
    { id: "c", date: "2026-10-30", description: "BANK CHARGES", debit: 118, credit: 0, balance: 49882 },
  ];
  const book = [
    { id: "1", date: "2026-10-02", entryNo: "R1", narration: "Acme", ref: "UTR123456", dr: 5000, cr: 0 },
    { id: "2", date: "2026-10-04", entryNo: "P1", narration: "Rent", ref: null, dr: 0, cr: 25000 },
    { id: "3", date: "2026-10-31", entryNo: "P2", narration: "Cheque 001", ref: "001", dr: 0, cr: 3000 },
  ];
  const r = reconcileBank(bank, book, { openingBook: 70000 });
  assert.equal(r.matched.length, 2);
  assert.equal(r.matched[0].how, "ref");
  assert.deepEqual(r.bankOnly.map(b => b.id), ["c"]);
  assert.deepEqual(r.bookOnly.map(b => b.id), ["3"]);
  assert.equal(r.bookBalance, 47000);
  assert.equal(r.computedBank, 49882);
  assert.equal(r.difference, 0);
});

import { compareGstr1, parse3B, compare3B } from "../../src/lib/gstPortalRecon";
test("GSTR-1 filed vs books flags missing and differing invoices; 3B compares tables", () => {
  const it = (t: number, c: number) => [{ itm_det: { txval: t, camt: c, samt: c } }];
  const books = { b2b: [{ ctin: "32AAAAA0000A1Z5", inv: [{ inum: "INV/001", itms: it(1000, 90) }, { inum: "INV/002", itms: it(500, 45) }] }] };
  const portal = { b2b: [{ ctin: "32AAAAA0000A1Z5", inv: [{ inum: "INV/001", itms: it(1000, 90) }, { inum: "INV/003", itms: it(200, 18) }] }] };
  const r = compareGstr1(books, portal);
  assert.deepEqual(r.invoices.map(i => i.status).sort(), ["match", "onlyBooks", "onlyPortal"]);
  const p3 = parse3B({ sup_details: { osup_det: { txval: 1500, camt: 135, samt: 135 } }, itc_elg: { itc_net: { camt: 50, samt: 50 } } });
  assert.equal(p3.a.taxable, 1500); assert.equal(p3.itc.cgst, 50);
  const Z = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
  const rows = compare3B({ a: { ...Z, taxable: 1500, cgst: 135, sgst: 135 }, b: Z, c: Z, d: Z, e: Z, itc: { ...Z, cgst: 40, sgst: 40 } }, p3);
  assert.equal(rows[0].diff, 0); assert.equal(rows[5].diff, 20);
});

import { featureHelp } from "../../src/lib/featureHelp";
test("FreBook answers feature questions itself and leaves transactions alone", () => {
  assert.ok((featureHelp("what are the features you have") ?? []).length > 5);
  assert.deepEqual(featureHelp("how do I reconcile my bank?")?.map(h => h.title), ["Reconciliation"]);
  assert.equal(featureHelp("paid rent 25000 by bank"), null);
  assert.equal(featureHelp("how much do customers owe?"), null);
  assert.equal(featureHelp("how much gst did I pay this month"), null);
});
