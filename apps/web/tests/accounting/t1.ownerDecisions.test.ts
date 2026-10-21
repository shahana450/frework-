// Owner decisions: three FreBook plans by number of businesses (Basic ₹699 · Pro ₹999 · Unlimited ₹1,499), no "FrePilot",
// no platform fee, old plan ids still display.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FREBOOK_PLAN, FREBOOK_PLANS_LIST, FREBOOK_PRICE_LABEL, PLAN_PRICES, LEGACY_PLAN_IDS, planLabel, businessLimit, chargePaise } from "../../src/lib/plans";
import { PLAN_PAISE } from "../../src/lib/phonepeOrder";

const SRC = join(process.cwd(), "src");
const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|md)$/.test(n)) files.push(p);
  }
})(SRC);
const rel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, "/");
const read = (f: string) => readFileSync(f, "utf8");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const PRICES = FREBOOK_PLANS_LIST.map(p => inr(p.price));

test("plans: Basic ₹699 (2 businesses) · Pro ₹999 (5) · Unlimited ₹1,499 (any) — the server sells exactly these", () => {
  // 19 Oct 2026: Starter ₹399 (1) · Basic ₹699 (2) · Pro ₹999 (5) · CA Practice ₹2,499 (15); Unlimited ₹1,499 kept for existing subscribers, not sold
  assert.deepEqual(PLAN_PRICES, { fb_starter: 399, fb_basic: 699, fb_pro: 999, fb_ca: 2499, frebook: 1499 });
  assert.deepEqual(PLAN_PAISE, { fb_starter: 39900, fb_basic: 69900, fb_pro: 99900, fb_ca: 249900 });
  assert.deepEqual(FREBOOK_PLANS_LIST.map(p => [p.name, p.businesses]), [["Starter", 1], ["Basic", 2], ["Pro", 5], ["CA Practice", 15]]);
  assert.equal(FREBOOK_PLAN.id, "fb_ca");
  assert.equal(FREBOOK_PRICE_LABEL, "₹399");         // pages say "from ₹399"
});

test("plans: business limits — trial and earlier paid plans are unlimited", () => {
  assert.equal(businessLimit("fb_basic", "active"), 2);
  assert.equal(businessLimit("fb_pro", "active"), 5);
  assert.equal(businessLimit("frebook", "active"), null);
  assert.equal(businessLimit("fb_basic", "trial"), null);
  assert.equal(businessLimit("professional", "active"), null);
});

test("plans: GST is added at checkout, and a referral halves the price before GST", () => {
  assert.equal(chargePaise("fb_basic"), 82482);        // ₹699 + 18% = ₹824.82
  assert.equal(chargePaise("fb_pro"), 117882);         // ₹999 + 18% = ₹1,178.82
  assert.equal(chargePaise("frebook"), 176882);        // ₹1,499 + 18% = ₹1,768.82 (existing Unlimited renewals)
  assert.equal(chargePaise("fb_basic", 50), 41241);    // ₹349.50 + 18% = ₹412.41
  assert.equal(chargePaise("nope"), null);
});

test("T1: no page shows a monthly price other than FreBook's, except the listed professional services", () => {
  // Monthly prices that are NOT the FreBook plan (services, examples, tax thresholds). Anything else per month must be FreBook's price.
  const allowed = new Set([
    "about/page.tsx|₹1,999",            // Virtual Accountant service
    "blog/gst-filing-guide/page.tsx|₹499", // GST filing service
    "community/page.tsx|₹30K",          // sample post text
    "finance/audit/page.tsx|₹50k",      // TDS 194-I rent threshold
    "finance/payroll/page.tsx|₹200",    // Kerala professional tax
    "services/compliance/page.tsx|₹999", // compliance service
    "components/landing/business-os-homepage.tsx|₹3,999", // FreBook Managed — done-for-you service, not the FreBook plan
    "services/accounting/page.tsx|₹3,999",                // the accounting service page sells FreBook Managed
    "dashboard/docs-upload/page.tsx|₹1,499",          // Accounting & Bookkeeping service
    "dashboard/service-requests/page.tsx|₹1,499",     // Accounting & Bookkeeping service
    "dashboard/services/page.tsx|₹1,499",             // Accounting & Bookkeeping service
    "services/accounting/page.tsx|₹1,499",            // Accounting & Bookkeeping service
  ]);
  const monthly = /₹\s?([\d,]+[kKL]?)"?\s*,?\s*["']?\s*(?:\/\s*mo(?:nth)?\b|per month|Per Month|Starting per month|\/ month|Starting \/ month)/g;
  const bad: string[] = [];
  for (const f of files) {
    for (const m of read(f).matchAll(monthly)) {
      const amount = `₹${m[1]}`;
      if (PRICES.includes(amount)) continue;
      const key = `${rel(f).replace(/^app\//, "")}|${amount}`;
      if (!allowed.has(key)) bad.push(key);
    }
  }
  assert.deepEqual(bad, []);
});

test("T1: no page sells FreBook at another price", () => {
  const bad: string[] = [];
  for (const f of files) {
    read(f).split(/\r?\n/).forEach((line, i) => {
      if (!/(month|\/mo\b|plan)/i.test(line)) return;
      // a ₹ amount within a few words of "FreBook" is a FreBook price
      for (const m of line.matchAll(/FreBook[^₹\n]{0,60}₹\s?([\d,]+)|₹\s?([\d,]+)[^₹\n]{0,40}FreBook/g)) {
        const amount = `₹${m[1] ?? m[2]}`;
        if (amount === "₹3,999" && /business-os-homepage.tsx$|services[\/]accounting[\/]page.tsx$/.test(rel(f))) continue; // FreBook Managed service, priced separately
        if (!PRICES.includes(amount)) bad.push(`${rel(f)}:${i + 1} ${amount}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});

test("T1: the homepage, hero and login show the starting price", () => {
  for (const f of ["components/landing/business-os-homepage.tsx", "components/landing/homepage-hero.tsx", "app/login/page.tsx"]) {
    assert.ok(read(join(SRC, f)).includes(FREBOOK_PRICE_LABEL), f);
  }
});

test("T1: no page mentions FrePilot, its tagline, or a platform fee", () => {
  const hits = (re: RegExp) => files.filter(f => re.test(read(f))).map(rel);
  assert.deepEqual(hits(/FrePilot/i), []);
  assert.deepEqual(hits(/You Build,? We Pilot/i), []);
  assert.deepEqual(hits(/platform[ -]fees?|platform charges?|convenience fees?/i), []);
});

test("T1: pricing pages offer monthly or yearly (2 months free), and no enterprise / contact-sales tier", () => {
  // 19 Oct 2026: the owner chose yearly billing with 2 months free (replaces "monthly only")
  const s = read(join(SRC, "app/finance/pricing/page.tsx"));
  assert.ok(/2 months free/.test(s) && /billing: Billing|useState<Billing>/.test(s));
  for (const f of ["app/pricing/page.tsx", "app/finance/pricing/page.tsx"]) assert.ok(!/Contact Sales|"enterprise"/i.test(read(join(SRC, f))), f);
});

test("T1: subscription rows with old plan ids display without errors", () => {
  for (const id of [...LEGACY_PLAN_IDS, "Professional", "ENTERPRISE"]) {
    const label = planLabel(id);
    assert.match(label, /^FreBook \(earlier plan: \w+\)$/, id);
  }
  assert.equal(planLabel("frebook"), "FreBook Unlimited");      // existing Unlimited subscribers
  assert.equal(planLabel(FREBOOK_PLAN.id), "FreBook CA Practice");
  assert.equal(planLabel("fb_basic"), "FreBook Basic");
  assert.equal(planLabel("fb_pro"), "FreBook Pro");
  assert.equal(planLabel(null), "Free");
  assert.equal(planLabel(undefined), "Free");
  assert.equal(planLabel("something-new"), "FreBook (something-new)");
});
