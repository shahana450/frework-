// FreBook subscription: price is "+ GST", so checkout charges price + 18%
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargePaise, FREBOOK_PLAN, SUBSCRIPTION_GST_RATE } from "../../src/lib/plans";

test("₹1,499 + 18% GST is charged as ₹1,768.82", () => {
  assert.equal(SUBSCRIPTION_GST_RATE, 18);
  assert.equal(chargePaise(FREBOOK_PLAN.id), 176882);
  assert.equal(chargePaise("enterprise"), null);
});
