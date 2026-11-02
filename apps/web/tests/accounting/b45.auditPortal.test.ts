// 360° audit — books against GSTR-1, GSTR-3B, GSTR-2B, 26AS, and TDS deposited on time
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGstr1, parseGstr3b, parseGstr2b, parse26asRows, portalChecks, invKey, partyKey } from "../../src/lib/auditPortal";
import type { AuditAccount } from "../../src/lib/audit360";
import type { QJournal } from "../../src/lib/bookQueries";

const A: AuditAccount[] = [
  { id: "bank", name: "HDFC Bank", type: "asset", sub_type: "bank" },
  { id: "sales", name: "Sales", type: "income", sub_type: "revenue" },
  { id: "deb", name: "Acme Traders", type: "asset", sub_type: "trade_receivables" },
  { id: "cr", name: "Supplier One Pvt Ltd", type: "liability", sub_type: "trade_payables" },
  { id: "pur", name: "Purchases", type: "expense", sub_type: "direct_expense" },
  { id: "ocgst", name: "Output CGST", type: "liability", sub_type: null },
  { id: "osgst", name: "Output SGST", type: "liability", sub_type: null },
  { id: "icgst", name: "Input CGST", type: "asset", sub_type: null },
  { id: "isgst", name: "Input SGST", type: "asset", sub_type: null },
  { id: "tdsr", name: "TDS Receivable", type: "asset", sub_type: null },
  { id: "tdsp", name: "TDS Payable", type: "liability", sub_type: null },
  { id: "rent", name: "Rent", type: "expense", sub_type: "indirect_expense" },
];
const J = (id: string, date: string, lines: [string, number, number][], ref?: string, party?: string): QJournal =>
  ({ id, date, entry_no: id, narration: "", type: "journal", party_name: party ?? null, reference_no: ref ?? null, lines: lines.map(([account_id, dr, cr]) => ({ account_id, dr, cr })) });
const period = { from: "2025-04-01", to: "2026-03-31" };
const books = [
  J("S1", "2025-04-10", [["deb", 11800, 0], ["sales", 0, 10000], ["ocgst", 0, 900], ["osgst", 0, 900]], "INV/001", "Acme Traders"),
  J("P1", "2025-04-12", [["pur", 5000, 0], ["icgst", 450, 0], ["isgst", 450, 0], ["cr", 0, 5900]], "B-9", "Supplier One Pvt Ltd"),
  J("R1", "2025-05-05", [["bank", 11600, 0], ["tdsr", 200, 0], ["deb", 0, 11800]], null as never, "Acme Traders"),
  J("T1", "2025-04-20", [["rent", 50000, 0], ["tdsp", 0, 5000], ["bank", 0, 45000]]),
  J("T2", "2025-05-10", [["tdsp", 5000, 0], ["bank", 0, 5000]]),   // April TDS paid on 10 May — 3 days late
];
const g1 = { fp: "042025", b2b: [{ ctin: "32ABCDE1234F1Z5", inv: [{ inum: "INV-001", idt: "10-04-2025", itms: [{ itm_det: { txval: 10000, camt: 900, samt: 900 } }] }, { inum: "INV-002", idt: "15-04-2025", itms: [{ itm_det: { txval: 2000, camt: 180, samt: 180 } }] }] }] };
const g3 = { ret_period: "042025", sup_details: { osup_det: { txval: 10000, camt: 900, samt: 900 } }, itc_elg: { itc_net: { camt: 450, samt: 450 } } };
const g2 = { data: { rtnprd: "042025", docdata: { b2b: [{ ctin: "32XYZ", trdnm: "SUPPLIER ONE PRIVATE LIMITED", inv: [{ inum: "B-9", items: [{ txval: 5000, cgst: 450, sgst: 450 }] }] }] } } };

test("keys ignore punctuation and company words", () => {
  assert.equal(invKey("INV/001"), invKey("INV-001"));
  assert.equal(partyKey("Supplier One Pvt Ltd"), partyKey("SUPPLIER ONE PRIVATE LIMITED"));
});

test("GSTR-1: month totals, and the invoice missing from the books", () => {
  const p = parseGstr1(g1);
  assert.deepEqual(p.months["2025-04"], { taxable: 12000, igst: 0, cgst: 1080, sgst: 1080, cess: 0 });
  const r = portalChecks(A, books, period, { gstr1: p });
  assert.equal(r.find(c => c.id === "g1_taxable")!.diff, -2000);
  assert.deepEqual(r.find(c => c.id === "g1_invoices")!.items.map(i => i.note.slice(0, 15)), ["Invoice INV-002"]);
});

test("GSTR-3B and GSTR-2B match the books", () => {
  const r = portalChecks(A, books, period, { gstr3b: parseGstr3b(g3), gstr2b: parseGstr2b(g2) });
  for (const id of ["g3b_output", "g3b_itc", "g2b_itc", "g2b_suppliers"]) assert.equal(r.find(c => c.id === id)!.status, "ok", id);
});

test("3B declaring less tax than GSTR-1 is a problem", () => {
  const r = portalChecks(A, books, period, { gstr1: parseGstr1(g1), gstr3b: parseGstr3b(g3) });
  assert.equal(r.find(c => c.id === "g3b_vs_g1")!.status, "fail");
});

test("26AS from a sheet: deductor-wise TDS against the books", () => {
  const t = parse26asRows([["Sr", "Name of Deductor", "TAN of Deductor", "Total Amount Paid / Credited", "Total Tax Deducted"], [1, "ACME TRADERS", "TVDA01234A", 11800, 236]]);
  const r = portalChecks(A, books, period, { tds26as: t });
  assert.equal(r.find(c => c.id === "tds_26as_total")!.diff, -36);
  assert.equal(r.find(c => c.id === "tds_26as_parties")!.items.length, 1);
});

test("TDS deducted in April and deposited on 10 May is late", () => {
  const r = portalChecks(A, books, period, {});
  const c = r.find(x => x.id === "tds_deposit")!;
  assert.equal(c.status, "warn");
  assert.match(c.items[0].note, /after the due date 2025-05-07/);
});
