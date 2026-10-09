// Security — PhonePe redirect can't be edited to another plan/user, and the paid amount must match the plan
import { test } from "node:test";
import assert from "node:assert/strict";
import { signOrder, verifyOrder, PLAN_PAISE } from "../../src/lib/phonepeOrder";

const KEY = "test-secret";
const claim = { txnId: "FW_frebook_1", userId: "user-a", plan: "frebook", billing: "monthly", amount: PLAN_PAISE.frebook };

test("a genuine, fully paid order is accepted", () => {
  assert.deepEqual(verifyOrder(claim, signOrder(claim, KEY), 149900, KEY), { ok: true });
});

test("editing the plan or the user in the redirect is refused", () => {
  const sig = signOrder(claim, KEY);
  assert.deepEqual(verifyOrder({ ...claim, plan: "professional", amount: 99900 }, sig, 99900, KEY), { ok: false, reason: "tampered" });
  assert.deepEqual(verifyOrder({ ...claim, userId: "victim" }, sig, 149900, KEY), { ok: false, reason: "tampered" });
});

test("paying less than the plan price is refused", () => {
  assert.deepEqual(verifyOrder(claim, signOrder(claim, KEY), 100, KEY), { ok: false, reason: "amount_mismatch" });
});
