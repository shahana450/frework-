import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGstr1, inferRate, stateCode } from "../../src/lib/gstr1";
import { docsFromJournals, type SrcJournal } from "../../src/lib/gstr1Source";

const GSTIN = "32ABCDE1234F1Z5";       // Kerala business
const CUST = "29AAACB1234C1Z2";        // Karnataka customer
const LOCAL = "32AAACL9999K1Z8";       // Kerala customer
const contacts = [
  { id: "c1", name: "Bengaluru Traders", gstin: CUST, state: "Karnataka" },
  { id: "c2", name: "Calicut Stores", gstin: LOCAL, state: "Kerala" },
  { id: "c3", name: "Walk-in Chennai", gstin: null, state: "Tamil Nadu" },
];
let n = 0;
const J = (date: string, type: string, party: string | null, ref: string, lines: [string, number, number][], metadata: Record<string, unknown> | null = null): SrcJournal => ({
  id: `j${++n}`, entry_no: `JV-${n}`, date, type, reference_no: ref, party_name: party, contact_id: null, metadata,
  total: lines.reduce((s, l) => s + l[1], 0), lines: lines.map(([account, dr, cr]) => ({ account, dr, cr })),
});

test("rates and state codes", () => {
  assert.equal(inferRate(1000, 180), 18);
  assert.equal(inferRate(1000, 50), 5);
  assert.equal(inferRate(1000, 130), null, "13% is not a GST rate");
  assert.equal(stateCode("Kerala"), "32");
  assert.equal(stateCode("29"), "29");
});

test("GSTR-1 sections: B2B, B2CS, B2CL, credit notes and HSN", () => {
  const journals = [
    // B2B inter-state with saved item detail
    J("2026-09-03", "sales", "Bengaluru Traders", "INV-101", [["Debtors Control", 118000, 0], ["Sales", 0, 100000], ["Output IGST", 0, 18000]],
      { gst_invoice: { customer_gstin: CUST, items: [{ hsn: "998314", desc: "IT services", uqc: "NOS", qty: 1, gst_rate: 18, taxable: 100000, igst: 18000, cgst: 0, sgst: 0 }] } }),
    // B2B intra-state, derived from ledgers
    J("2026-09-05", "sales", "Calicut Stores", "INV-102", [["Debtors Control", 11800, 0], ["Sales", 0, 10000], ["Output CGST", 0, 900], ["Output SGST", 0, 900]]),
    // B2C small intra-state cash sales at 5%
    J("2026-09-06", "sales", null, "INV-103", [["Cash", 2100, 0], ["Sales", 0, 2000], ["Output CGST", 0, 50], ["Output SGST", 0, 50]]),
    // B2C large inter-state (> ₹1 lakh, unregistered)
    J("2026-09-08", "sales", "Walk-in Chennai", "INV-104", [["HDFC Bank", 236000, 0], ["Sales", 0, 200000], ["Output IGST", 0, 36000]]),
    // Credit note to the registered local customer
    J("2026-09-20", "credit_note", "Calicut Stores", "CN-1", [["Sales Returns", 1000, 0], ["Output CGST", 90, 0], ["Output SGST", 90, 0], ["Debtors Control", 0, 1180]]),
    // Other month — ignored
    J("2026-10-01", "sales", null, "INV-200", [["Cash", 1180, 0], ["Sales", 0, 1000], ["Output CGST", 0, 90], ["Output SGST", 0, 90]]),
  ];
  const docs = docsFromJournals(journals, contacts);
  const r = buildGstr1(GSTIN, "Kerala", "2026-09", docs);
  const j = r.json as Record<string, any>;

  assert.equal(j.fp, "092026");
  assert.equal(j.b2b.length, 2);
  const blr = j.b2b.find((x: any) => x.ctin === CUST).inv[0];
  assert.deepEqual([blr.inum, blr.idt, blr.val, blr.pos], ["INV-101", "03-09-2026", 118000, "29"]);
  assert.deepEqual(blr.itms[0].itm_det, { txval: 100000, rt: 18, iamt: 18000, csamt: 0 });
  const local = j.b2b.find((x: any) => x.ctin === LOCAL).inv[0];
  assert.deepEqual(local.itms[0].itm_det, { txval: 10000, rt: 18, camt: 900, samt: 900, csamt: 0 });

  assert.deepEqual(j.b2cs, [{ sply_ty: "INTRA", rt: 5, typ: "OE", pos: "32", txval: 2000, camt: 50, samt: 50, csamt: 0 }]);
  assert.equal(j.b2cl[0].pos, "33");
  assert.equal(j.b2cl[0].inv[0].itms[0].itm_det.iamt, 36000);

  assert.equal(j.cdnr[0].ctin, LOCAL);
  assert.deepEqual([j.cdnr[0].nt[0].ntty, j.cdnr[0].nt[0].nt_num, j.cdnr[0].nt[0].val], ["C", "CN-1", 1180]);

  const svc = j.hsn.hsn_b2b.find((h: any) => h.hsn_sc === "998314");
  assert.equal(svc.txval, 100000);
  assert.ok(r.issues.some(i => i.doc === "INV-102" && /no item detail/.test(i.text)), "derived invoices are flagged");
  assert.ok(!r.issues.some(i => i.level === "error"), JSON.stringify(r.issues.filter(i => i.level === "error")));
});

test("problems are reported instead of guessed", () => {
  const docs = docsFromJournals([
    J("2026-09-10", "sales", "Unknown Co", "INV-9", [["Debtors Control", 1130, 0], ["Sales", 0, 1000], ["Output IGST", 0, 130]]),
  ], contacts);
  const r = buildGstr1(GSTIN, "Kerala", "2026-09", docs);
  assert.ok(r.issues.some(i => i.level === "error" && /single GST rate/.test(i.text)));
  assert.ok(r.issues.some(i => i.level === "error" && /place of supply unknown/.test(i.text)));
  const bad = buildGstr1("BADGSTIN", null, "2026-09", []);
  assert.ok(bad.issues.some(i => /GSTIN is missing or invalid/.test(i.text)));
});

import { draftInvoice, isIncomeEntry, amountInWords, invoiceTotals, recalcItem } from "../../src/lib/invoiceDoc";
test("invoice from an income entry", () => {
  const lines = [{ dr: 26500, cr: 0, account: "HDFC Bank" }, { dr: 0, cr: 26500, account: "Service Income", accountType: "income" }];
  assert.equal(isIncomeEntry(lines), true);
  assert.equal(isIncomeEntry([{ dr: 100000, cr: 0, account: "Cash" }, { dr: 0, cr: 100000, account: "Capital Account", accountType: "equity" }]), false, "capital is not income");
  const seller = { name: "Frework", address: "Calicut", gstin: GSTIN, state: "Kerala", phone: "", email: "", logo: null, pan: "ABCDE1234F" };
  const inv = draftInvoice({ id: "j", entry_no: "JV-2026-0003", date: "2026-10-03", type: "receipt", narration: "Consulting", reference_no: null, party_name: "Calicut Stores", metadata: null,
    lines: [{ dr: 11800, cr: 0, account: "HDFC Bank" }, { dr: 0, cr: 10000, account: "Sales" }, { dr: 0, cr: 900, account: "Output CGST" }, { dr: 0, cr: 900, account: "Output SGST" }] }, seller, { name: "Calicut Stores", gstin: LOCAL, state: "Kerala" });
  assert.equal(inv.invoiceNo, "INV-2026-0003");
  assert.deepEqual([inv.items[0].taxable, inv.items[0].gstRate, inv.items[0].cgst], [10000, 18, 900]);
  assert.equal(invoiceTotals(inv.items).total, 11800);
  assert.deepEqual(recalcItem({ ...inv.items[0], qty: 2, rate: 5000 }, true), { ...inv.items[0], qty: 2, rate: 5000, taxable: 10000, igst: 1800, cgst: 0, sgst: 0 });
  assert.equal(amountInWords(118000.5), "Rupees One Lakh Eighteen Thousand and Fifty Paise Only");
  assert.equal(amountInWords(26500), "Rupees Twenty Six Thousand Five Hundred Only");
  assert.equal(amountInWords(12345678), "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only");
});
