// Bulk import of customers and items: loose headings, example row skipped, checks per row
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCustomers, parseItems } from "../../src/lib/bulkImport";

test("customers: headings matched loosely, state from GSTIN, example row and duplicates skipped", () => {
  const r = parseCustomers([
    ["Name", "Type", "GSTIN", "Phone", "Email", "Address", "City", "State", "PAN", "Credit days"],
    ["ABC Traders", "Customer", "32AAACA1234A1Z5", "9876543210", "", "", "", "", "", ""],   // template example
    ["Revalgi Stores", "", "32ABKFR0760P1ZU", "+91 98765 43210", "", "", "Kochi", "", "", "30"],
    ["Mehta Supplies", "Supplier", "BADGSTIN", "123", "", "", "", "Gujarat", "", ""],
    ["revalgi stores", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", ""],
  ]);
  assert.equal(r.rows.length, 2);
  assert.deepEqual({ ...r.rows[0] }, { name: "Revalgi Stores", type: "customer", gstin: "32ABKFR0760P1ZU", phone: "9876543210", email: null, address: null, city: "Kochi", state: "Kerala", pan: "ABKFR0760P", credit_days: 30 });
  assert.equal(r.rows[1].type, "vendor");
  assert.equal(r.rows[1].gstin, null);
  assert.equal(r.rows[1].state, "Gujarat");
  assert.equal(r.warnings.length, 3);   // bad GSTIN, short phone, duplicate
});

test("customers: no Name column is an error", () => {
  assert.equal(parseCustomers([["Party GST", "Mobile"], ["x", "y"]]).errors.length, 1);
});

test("items: GST as % or fraction, services from SAC 99, defaults", () => {
  const r = parseItems([
    ["Item name", "HSN/SAC", "Unit", "Price", "GST %", "Service?"],
    ["Cement 50kg", "2523", "BAG", 380, 28, "No"],                 // template example
    ["Consulting", "998311", "", "₹2,500", "18%", ""],
    ["Rice 25kg", "1006", "bag", "1200", "0.05", ""],
    ["Mystery", "", "", "", "", ""],
  ]);
  assert.equal(r.rows.length, 3);
  assert.deepEqual({ ...r.rows[0] }, { name: "Consulting", hsn: "998311", unit: "NOS", rate: 2500, gst_rate: 18, is_service: true });
  assert.equal(r.rows[1].gst_rate, 5);
  assert.equal(r.rows[1].unit, "BAG");
  assert.deepEqual({ ...r.rows[2] }, { name: "Mystery", hsn: null, unit: "NOS", rate: 0, gst_rate: 18, is_service: false });
});
