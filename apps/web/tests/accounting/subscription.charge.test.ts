// FreBook subscription: price is "+ GST", so checkout charges price + 18%
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargePaise, FREBOOK_PLAN, SUBSCRIPTION_GST_RATE } from "../../src/lib/plans";

test("₹2,499 + 18% GST is charged as ₹2,948.82; yearly ₹24,999 as ₹29,498.82", () => {
  assert.equal(SUBSCRIPTION_GST_RATE, 18);
  assert.equal(chargePaise(FREBOOK_PLAN.id), 294882);
  assert.equal(chargePaise(FREBOOK_PLAN.id, 0, "yearly"), 2949882);
  assert.equal(chargePaise("enterprise"), null);
});
