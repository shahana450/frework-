// Invoice PDF for WhatsApp: a real PDF, with the rupee sign and other non-standard characters handled
import { test } from "node:test";
import assert from "node:assert/strict";
import { invoicePdf } from "../../src/lib/invoicePdf";
import type { InvoiceDoc } from "../../src/lib/invoiceDoc";

const doc: InvoiceDoc = {
  invoiceNo: "INV/2026-27/0001", date: "2026-11-02", dueDate: "2026-11-17", placeOfSupply: "32-Kerala", title: "Tax Invoice",
  seller: { name: "Demo Traders", address: "MG Road, Kochi", gstin: "32ABCDE1234F1Z5", state: "Kerala", phone: "9999999999", email: "", logo: null, pan: "" },
  buyer: { name: "ABC Company — Kochi", address: "Market Rd", gstin: "", state: "Kerala", phone: "", email: "" },
  items: [{ desc: "Consulting “retainer” ₹ fees", hsn: "998311", qty: 1, unit: "NOS", rate: 63559.32, gstRate: 18, taxable: 63559.32, igst: 0, cgst: 5720.34, sgst: 5720.34 }],
  notes: "Thank you", terms: "Pay within 15 days", bankDetails: "HDFC Bank\nA/c 0000",
};

test("an invoice renders to a PDF", async () => {
  const bytes = await invoicePdf(doc);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.length > 1500);
});
