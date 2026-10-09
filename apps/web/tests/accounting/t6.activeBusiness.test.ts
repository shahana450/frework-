// Task 6 — one active business: pages read the header's business, switching updates everyone, nothing reads localStorage directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readActiveBusiness, setActiveBusiness, clearActiveBusiness, getActiveBusiness, subscribeActiveBusiness, _resetActiveBusiness } from "../../src/lib/activeBusinessStore";

const SRC = join(process.cwd(), "src");
const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) files.push(p); }
})(SRC);
const rel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, "/");

test("T6: no page reads or writes the active business in localStorage directly", () => {
  const offenders = files.filter(f => !/lib\/activeBusinessStore\.ts$/.test(rel(f)) && /fw_fin_biz_/.test(readFileSync(f, "utf8"))).map(rel);
  assert.deepEqual(offenders, []);
});

test("T6: the finance layout provides the business and remounts pages when it changes", () => {
  const layout = readFileSync(join(SRC, "app/finance/layout.tsx"), "utf8");
  assert.match(layout, /<main key=\{active\.businessId \?\? "none"\}/);
  assert.match(layout, /<ActiveBusinessProvider>\{children\}<\/ActiveBusinessProvider>/);
  assert.ok(layout.indexOf("setActiveBusiness(user.id, pick.id") < layout.indexOf("setSubChecked(true)"), "business is resolved before pages mount");
});

test("T6: pages get the header's business, and a switch reaches every listener", () => {
  _resetActiveBusiness();
  const seen: (string | null)[] = [];
  const off = subscribeActiveBusiness(a => seen.push(a.businessId));
  setActiveBusiness("u1", "biz-A", "Alpha Traders");
  assert.equal(readActiveBusiness("u1"), "biz-A");
  assert.equal(getActiveBusiness().businessName, "Alpha Traders");
  setActiveBusiness("u1", "biz-B", "Beta Stores");
  assert.equal(readActiveBusiness("u1"), "biz-B");
  assert.equal(readActiveBusiness("someone-else"), null, "another user never gets this user's business");
  clearActiveBusiness("u1");
  assert.equal(readActiveBusiness("u1"), null);
  off();
  assert.deepEqual(seen, ["biz-A", "biz-B", null]);
});
