// B7/B8 — unverified claims and CA-reserved services must not come back into the site's copy
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|md)$/.test(n)) files.push(p);
  }
})(SRC);
const hits = (re: RegExp) => files.filter(f => re.test(readFileSync(f, "utf8"))).map(f => f.slice(SRC.length + 1));

test("B7: no unverified compliance/support/uptime claims", () => {
  assert.deepEqual(hits(/SOC ?2 compliant|99\.9% uptime|SLA 99\.9|24\/7 (dedicated|premium|chat) support|Lowest in India/i), []);
});

test("B7: no unverified client counts or ratings", () => {
  assert.deepEqual(hits(/500\+ (businesses|clients|happy clients|Indian businesses)|Businesses Served"\]|4\.9\/5 Rating|200\+ (Verified Spaces|investors)/i), []);
});

test("B7: forbidden firm description never appears", () => {
  assert.deepEqual(hits(new RegExp(["Chartered Accountants", "Tax Consultants"].join(" & "), "i")), []);
});

test("B8: CA-reserved audits are not bundled in software tiers; the accounting app is FreBook", () => {
  const pricing = readFileSync(join(SRC, "app/pricing/page.tsx"), "utf8");
  assert.ok(!/\{ text: "(Tax audit \(Form 3CA|Statutory \/ annual audit|Internal audit \(quarterly)/.test(pricing));
  assert.ok(!/FrePilot Accounting/.test(pricing));
});
