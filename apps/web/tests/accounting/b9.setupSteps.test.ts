// B9 — the business is created only from the Review step, and GST status must be chosen first
import { test } from "node:test";
import assert from "node:assert/strict";
import { stepError, canCreate } from "../../src/lib/setupSteps";

const f = { name: "AUDIT TEST TRADERS", country: "IN", gst_registration_type: "", gstin: "" };

test("B9: an Indian business can't pass Tax & GST without choosing a GST status", () => {
  assert.match(stepError(2, f)!, /Choose your GST status/);
  assert.match(stepError(2, { ...f, gst_registration_type: "regular" })!, /GSTIN/);
  assert.equal(stepError(2, { ...f, gst_registration_type: "regular", gstin: "32ABCDE1234F1Z5" }), null);
  assert.equal(stepError(2, { ...f, gst_registration_type: "unregistered" }), null);
  assert.equal(stepError(2, { ...f, country: "AE" }), null, "outside India no GST question");
});

test("B9: nothing is created before the Review step, or with an earlier step incomplete", () => {
  const done = { ...f, gst_registration_type: "unregistered" };
  assert.deepEqual(canCreate(1, done), { ok: false, step: 1, error: "Review your details, then create the business." });
  assert.equal(canCreate(4, f).ok, false, "GST status missing");
  assert.deepEqual(canCreate(4, done), { ok: true });
});
