// B5 — Tally push hard-fails when the target company isn't the one linked to the active business
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTallyTarget } from "../../src/lib/tallyTarget";

test("B5: pushing into another business's Tally company is blocked", () => {
  const r = checkTallyTarget("ABC LLC", "SAWA GOLD", "ABC LLC");
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.status, 409); assert.match(r.error, /linked to "ABC LLC"/); }
});

test("B5: the linked company (any case) is allowed; no link yet is refused", () => {
  assert.deepEqual(checkTallyTarget("ABC LLC", "abc llc", "ABC LLC"), { ok: true, company: "ABC LLC" });
  const none = checkTallyTarget(null, "ABC LLC", "ABC LLC");
  assert.equal(none.ok, false);
  if (!none.ok) assert.equal(none.status, 412);
});

test("B5: before the migration (no column) pushes behave as before", () => {
  assert.deepEqual(checkTallyTarget(undefined, "Anything", "Biz"), { ok: true, company: "Anything" });
});
