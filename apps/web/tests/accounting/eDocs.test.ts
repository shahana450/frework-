// e-Invoice and e-way bill upload files built from an invoice
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEInvoice, buildEwayBill, splitAddress } from "../../src/lib/eDocs";
import type { InvoiceDoc } from "../../src/lib/invoiceDoc";

const doc: InvoiceDoc = {
  invoiceNo: "INV/26-27/0012", date: "2026-10-16", dueDate: "2026-10-31", placeOfSupply: "Kerala",
  seller: { name: "REVALGI", address: "12 MG Road, Kochi 682011", gstin: "32ABKFR0760P1ZU", state: "Kerala", phone: "9876543210", email: "a@b.in", logo: null, pan: "" },
  buyer: { name: "ABC Traders", address: "5 Market St, Thrissur 680001", gstin: "32AAACA1234A1Z5", state: "Kerala", phone: "", email: "" },
  items: [{ desc: "Cement", hsn: "2523", qty: 100, unit: "BAGS", rate: 500, gstRate: 28, taxable: 50000, igst: 0, cgst: 7000, sgst: 7000 }],
  notes: "", terms: "", bankDetails: "", title: "Tax Invoice",
};

test("address split finds pincode and town", () => {
  assert.deepEqual(splitAddress("12 MG Road, Kochi 682011"), { line1: "12 MG Road", place: "Kochi", pin: 682011 });
});

test("e-invoice: schema 1.1 B2B with totals and dd/mm/yyyy date", () => {
  const { json, issues } = buildEInvoice(doc) as { json: Record<string, any>; issues: unknown[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.deepEqual(issues, []);
  assert.equal(json.Version, "1.1");
  assert.equal(json.DocDtls.Dt, "16/10/2026");
  assert.equal(json.SellerDtls.Stcd, "32");
  assert.equal(json.BuyerDtls.Pos, "32");
  assert.equal(json.ItemList[0].IsServc, "N");
  assert.equal(json.ItemList[0].Unit, "BAG");
  assert.deepEqual(json.ValDtls, { AssVal: 50000, CgstVal: 7000, SgstVal: 7000, IgstVal: 0, TotInvVal: 64000 });
});

test("e-invoice refuses an unregistered buyer and a missing HSN", () => {
  const { issues } = buildEInvoice({ ...doc, buyer: { ...doc.buyer, gstin: "" }, items: [{ ...doc.items[0], hsn: "" }] });
  assert.equal(issues.filter(i => i.level === "error").length, 2);
});

test("e-way bill: intra-state splits CGST/SGST rates, vehicle cleaned", () => {
  const { json, issues } = buildEwayBill(doc, { vehicleNo: "kl-07 ab 1234", distanceKm: 75 }) as { json: Record<string, any>; issues: { level: string }[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(issues.filter(i => i.level === "error").length, 0);
  const b = json.billLists[0];
  assert.equal(b.vehicleNo, "KL07AB1234");
  assert.equal(b.toGstin, "32AAACA1234A1Z5");
  assert.equal(b.itemList[0].cgstRate, 14);
  assert.equal(b.itemList[0].igstRate, 0);
  assert.equal(b.totInvValue, 64000);
  assert.equal(b.transDistance, "75");
});
