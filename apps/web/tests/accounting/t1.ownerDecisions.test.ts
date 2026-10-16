// Task 1 — owner decisions: one FreBook plan at FREBOOK_PLAN.price, no "FrePilot", no platform fee, old plan ids still display.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FREBOOK_PLAN, FREBOOK_PRICE_LABEL, PLAN_PRICES, LEGACY_PLAN_IDS, planLabel } from "../../src/lib/plans";
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

test("T1: the server sells exactly one plan, FreBook, at FREBOOK_PLAN.price", () => {
  assert.deepEqual(PLAN_PRICES, { [FREBOOK_PLAN.id]: FREBOOK_PLAN.price });
  assert.deepEqual(PLAN_PAISE, { [FREBOOK_PLAN.id]: FREBOOK_PLAN.price * 100 });
  assert.equal(FREBOOK_PRICE_LABEL, inr(FREBOOK_PLAN.price));
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
  ]);
  const monthly = /₹\s?([\d,]+[kKL]?)"?\s*,?\s*["']?\s*(?:\/\s*mo(?:nth)?\b|per month|Per Month|Starting per month|\/ month|Starting \/ month)/g;
  const bad: string[] = [];
  for (const f of files) {
    for (const m of read(f).matchAll(monthly)) {
      const amount = `₹${m[1]}`;
      if (amount === inr(FREBOOK_PLAN.price)) continue;
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
        if (amount === "₹3,999" && rel(f).endsWith("business-os-homepage.tsx")) continue; // FreBook Managed service, priced separately
        if (amount !== inr(FREBOOK_PLAN.price)) bad.push(`${rel(f)}:${i + 1} ${amount}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});

test("T1: the homepage, hero and login show the FreBook price", () => {
  for (const f of ["components/landing/business-os-homepage.tsx", "components/landing/homepage-hero.tsx", "app/login/page.tsx"]) {
    assert.ok(read(join(SRC, f)).includes(inr(FREBOOK_PLAN.price)), f);
  }
});

test("T1: no page mentions FrePilot, its tagline, or a platform fee", () => {
  const hits = (re: RegExp) => files.filter(f => re.test(read(f))).map(rel);
  assert.deepEqual(hits(/FrePilot/i), []);
  assert.deepEqual(hits(/You Build,? We Pilot/i), []);
  assert.deepEqual(hits(/platform[ -]fees?|platform charges?|convenience fees?/i), []);
});

test("T1: no yearly toggle or extra tiers on the pricing pages", () => {
  for (const f of ["app/pricing/page.tsx", "app/finance/pricing/page.tsx"]) {
    const s = read(join(SRC, f));
    assert.ok(!/setYearly|billed yearly|Contact Sales|"enterprise"/i.test(s), f);
  }
});

test("T1: subscription rows with old plan ids display without errors", () => {
  for (const id of [...LEGACY_PLAN_IDS, "Professional", "ENTERPRISE"]) {
    const label = planLabel(id);
    assert.match(label, /^FreBook \(earlier plan: \w+\)$/, id);
  }
  assert.equal(planLabel(FREBOOK_PLAN.id), "FreBook");
  assert.equal(planLabel(null), "Free");
  assert.equal(planLabel(undefined), "Free");
  assert.equal(planLabel("something-new"), "FreBook (something-new)");
});
