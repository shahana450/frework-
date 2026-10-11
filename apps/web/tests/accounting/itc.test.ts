import { test } from "node:test";
import assert from "node:assert/strict";
import { parse2BJson, parse2BGrid, purchaseRegister, matchItc, table4, normDoc, taxOf } from "../../src/lib/itcMatch";

const JSON2B = { data: { docdata: {
  b2b: [
    { ctin: "32AAAAA0000A1Z5", trdnm: "Ravi Suppliers", inv: [
      { inum: "RS/101", dt: "05-04-2026", val: 11800, txval: 10000, igst: 0, cgst: 900, sgst: 900, cess: 0, rev: "N", itcavl: "Y" },
      { inum: "RS/102", dt: "12-04-2026", val: 5900, txval: 5000, igst: 0, cgst: 450, sgst: 450, cess: 0, rev: "N", itcavl: "Y" },
    ] },
    { ctin: "29BBBBB0000B1Z5", trdnm: "Kerala Transport", inv: [{ inum: "KT-9", dt: "20-04-2026", val: 1050, txval: 1000, igst: 50, cgst: 0, sgst: 0, cess: 0, rev: "Y", itcavl: "Y" }] },
    { ctin: "32CCCCC0000C1Z5", trdnm: "Blocked Motors", inv: [{ inum: "BM1", dt: "21-04-2026", val: 2360, txval: 2000, igst: 0, cgst: 180, sgst: 180, cess: 0, rev: "N", itcavl: "N" }] },
  ],
  cdnr: [{ ctin: "32AAAAA0000A1Z5", trdnm: "Ravi Suppliers", nt: [{ ntnum: "CN-1", typ: "C", dt: "25-04-2026", val: 1180, txval: 1000, igst: 0, cgst: 90, sgst: 90, cess: 0 }] }],
} } };

const JOURNALS = [
  { id: "p1", entry_no: "PV-1", date: "2026-04-05", reference_no: "RS-101", lines: [{ name: "Purchase", dr: 10000, cr: 0 }, { name: "Input CGST", dr: 900, cr: 0 }, { name: "Input SGST", dr: 900, cr: 0 }, { name: "Ravi Suppliers", dr: 0, cr: 11800 }] },
  { id: "p2", entry_no: "PV-2", date: "2026-04-12", reference_no: "RS/102", lines: [{ name: "Purchase", dr: 5000, cr: 0 }, { name: "Input CGST", dr: 400, cr: 0 }, { name: "Input SGST", dr: 400, cr: 0 }, { name: "Ravi Suppliers", dr: 0, cr: 5800 }] },
  { id: "p3", entry_no: "PV-3", date: "2026-04-15", reference_no: "AB-7", lines: [{ name: "Stationery", dr: 1000, cr: 0 }, { name: "Input IGST", dr: 180, cr: 0 }, { name: "Abhi Paper Mart", dr: 0, cr: 1180 }] },
  { id: "x", entry_no: "JV-1", date: "2026-04-16", reference_no: null, lines: [{ name: "Rent", dr: 5000, cr: 0 }, { name: "HDFC Bank", dr: 0, cr: 5000 }] },
];

test("2B JSON: invoices, reverse charge, ITC-not-available and credit notes", () => {
  const d = parse2BJson(JSON2B);
  assert.equal(d.length, 5);
  assert.equal(d.find(x => x.docNo === "KT-9")!.rcm, true);
  assert.equal(d.find(x => x.docNo === "BM1")!.itcAvailable, false);
  assert.equal(taxOf(d.find(x => x.docNo === "CN-1")!), -180);
  assert.equal(d[0].date, "2026-04-05");
});

test("invoice numbers compare without punctuation and prefixes", () => {
  assert.equal(normDoc("RS/101"), normDoc("rs-101"));
  assert.equal(normDoc("INV 0042"), normDoc("42"));
});

test("purchase register picks entries with input tax only", () => {
  const b = purchaseRegister(JOURNALS);
  assert.deepEqual(b.map(x => x.entryNo), ["PV-1", "PV-2", "PV-3"]);
  assert.equal(b[0].supplier, "Ravi Suppliers"); assert.equal(taxOf(b[0]), 1800); assert.equal(b[0].taxable, 10000);
});

test("matching: matched, tax mismatch, only in 2B, only in books", () => {
  const rows = matchItc(parse2BJson(JSON2B), purchaseRegister(JOURNALS));
  const by = (s: string) => rows.filter(r => r.status === s);
  assert.equal(by("matched").length, 1);
  assert.equal(by("mismatch")[0].book!.entryNo, "PV-2"); assert.equal(by("mismatch")[0].diff, 100);
  assert.deepEqual(by("only2b").map(r => r.b2b!.docNo).sort(), ["BM1", "CN-1", "KT-9"]);
  assert.equal(by("onlyBooks")[0].book!.entryNo, "PV-3");
});

test("Table 4: 4A(5) net of credit notes, RCM in 4A(3), blocked reversed in 4B(1)", () => {
  const t = table4(parse2BJson(JSON2B), purchaseRegister(JOURNALS), { igst: 0, cgst: 100, sgst: 100, cess: 0 });
  assert.deepEqual(t.a5, { igst: 0, cgst: 1260, sgst: 1260, cess: 0 });          // 900+450-90
  assert.deepEqual(t.a3, { igst: 50, cgst: 0, sgst: 0, cess: 0 });
  assert.deepEqual(t.c, { igst: 50, cgst: 1160, sgst: 1160, cess: 0 });
  assert.equal(taxOf(t.booksItc), 2780);
});

test("2B Excel grid with two header rows", () => {
  const grid = [
    ["Goods and Services Tax - GSTR 2B"], [], [],
    ["GSTIN of supplier", "Trade/Legal name", "Invoice Details", "", "", "", "Place of supply", "Supply Attract Reverse Charge", "Taxable Value (â‚¹)", "Tax Amount", "", "", "", "ITC Availability"],
    ["", "", "Invoice number", "Invoice type", "Invoice Date", "Invoice Value(â‚¹)", "", "", "", "Integrated Tax(â‚¹)", "Central Tax(â‚¹)", "State/UT Tax(â‚¹)", "Cess(â‚¹)", ""],
    ["32AAAAA0000A1Z5", "Ravi Suppliers", "RS/101", "Regular", "05/04/2026", 11800, "Kerala", "No", 10000, 0, 900, 900, 0, "Yes"],
  ];
  const d = parse2BGrid(grid);
  assert.equal(d.length, 1); assert.equal(d[0].docNo, "RS/101"); assert.equal(d[0].cgst, 900); assert.equal(d[0].taxable, 10000); assert.equal(d[0].rcm, false);
});
