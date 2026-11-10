import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeGstin, gstinCheckChar, fromGstRecord, typeFromConstitution } from "../../src/lib/gstinInfo";

test("GSTIN: state, PAN, type and check character", () => {
  const d = decodeGstin(" 27aapfu0939f1zv ");
  assert.equal(d.valid, true);
  assert.equal(d.state, "Maharashtra"); assert.equal(d.pan, "AAPFU0939F"); assert.equal(d.businessType, "partnership");
  assert.equal(gstinCheckChar("27AAPFU0939F1Z"), "V");
  assert.equal(decodeGstin("27AAPFU0939F1ZX").valid, false);           // wrong check character
  assert.equal(decodeGstin("99AAPFU0939F1ZV").valid, false);           // no such state
  assert.match(decodeGstin("32ABC").error!, /15 characters/);
});

test("public GST record fills name, address, type and registration", () => {
  const basics = decodeGstin("27AAPFU0939F1ZV");
  const d = fromGstRecord(basics, { data: { data: { lgnm: "SAI IGNITE LLP", tradeNam: "Sai Ignite", ctb: "Limited Liability Partnership", dty: "Regular", sts: "Active",
    pradr: { addr: { bno: "12/4", bnm: "Rose Plaza", st: "MG Road", loc: "Ernakulam", dst: "Ernakulam", pncd: "682016" } } } } });
  assert.equal(d.legalName, "SAI IGNITE LLP"); assert.equal(d.tradeName, "Sai Ignite"); assert.equal(d.businessType, "llp");
  assert.equal(d.address, "12/4, Rose Plaza, MG Road, Ernakulam"); assert.equal(d.pincode, "682016"); assert.equal(d.city, "Ernakulam");
  assert.equal(d.registrationType, "regular");
  assert.equal(typeFromConstitution("Proprietorship"), "proprietorship");
  assert.equal(typeFromConstitution("Private Limited Company"), "pvt_ltd");
  assert.equal(typeFromConstitution("Society/ Club/ Trust/ AOP"), "trust");
});
