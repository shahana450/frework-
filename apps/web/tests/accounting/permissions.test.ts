import { test } from "node:test";
import assert from "node:assert/strict";
import { can, type Role, type Action } from "../../src/lib/permissions";

const allow: [Role, Action][] = [
  ["owner", "lock"], ["owner", "manage_team"], ["admin", "lock"], ["accountant", "post"], ["accountant", "reverse"],
  ["accountant", "integrate"], ["accountant", "view_audit"], ["ca_reviewer", "view"], ["ca_reviewer", "view_audit"], ["viewer", "view"],
];
const deny: [Role, Action][] = [
  ["accountant", "lock"], ["accountant", "manage_team"], ["ca_reviewer", "post"], ["ca_reviewer", "reverse"], ["ca_reviewer", "upload"],
  ["viewer", "post"], ["viewer", "upload"], ["viewer", "view_audit"], ["viewer", "integrate"], ["viewer", "lock"],
];

test("roles can do what their job needs", () => { for (const [r, a] of allow) assert.ok(can(r, a), `${r} → ${a}`); });
test("roles can't do more than their job needs", () => { for (const [r, a] of deny) assert.ok(!can(r, a), `${r} ✗ ${a}`); });
test("unknown roles get nothing", () => { assert.ok(!can("intern" as Role, "view")); });
