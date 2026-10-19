// New pricing: monthly / yearly charge, referral on yearly, upgrade path, page allowances
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargePaise, upgradeFor, pageAllowance, businessLimit, FREBOOK_PLANS_LIST, planById } from "../../src/lib/plans";

test("plans on sale, cheapest first; Unlimited kept for existing subscribers only", () => {
  assert.deepEqual(FREBOOK_PLANS_LIST.map(p => p.id), ["fb_starter", "fb_basic", "fb_pro", "fb_ca"]);
  assert.equal(planById("frebook")?.sold, false);
  assert.equal(businessLimit("frebook", "active"), null);
  assert.equal(businessLimit("fb_starter", "active"), 1);
  assert.equal(businessLimit("fb_ca", "active"), 15);
});

test("charge: monthly and yearly + 18% GST; referral takes half a month off either", () => {
  assert.equal(chargePaise("fb_basic"), 82482);                       // 699 × 1.18
  assert.equal(chargePaise("fb_basic", 0, "yearly"), 825882);         // 6,999 × 1.18
  assert.equal(chargePaise("fb_basic", 50), 41241);                   // 349.5 × 1.18
  assert.equal(chargePaise("fb_basic", 50, "yearly"), 784641);        // (6,999 − 349.5) × 1.18
  assert.equal(chargePaise("frebook", 0, "yearly"), null);            // retired plan can't be bought yearly
});

test("upgrade: cheapest plan above the current one that fits", () => {
  assert.equal(upgradeFor(2, "fb_starter")?.id, "fb_basic");
  assert.equal(upgradeFor(3, "fb_basic")?.id, "fb_pro");
  assert.equal(upgradeFor(6, "fb_pro")?.id, "fb_ca");
  assert.equal(upgradeFor(16, "fb_ca"), null);
  assert.equal(upgradeFor(2, null)?.id, "fb_basic");
});

test("statement pages per month", () => {
  assert.equal(pageAllowance("fb_starter", "active"), 100);
  assert.equal(pageAllowance("fb_pro", "active"), 2000);
  assert.equal(pageAllowance("frebook", "trial"), 6000);
});
