// Task 5 — "Export all my data" (members only) and "Delete this business" (owner only, typed confirmation, 30-day purge).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { can, type Role } from "../../src/lib/permissions";
import { toCsv, buildDataExport, deleteConfirmed, isSoftDeleted, EXPORT_FILES, exportZipName } from "../../src/lib/dataExport";
import { crc32 } from "../../src/lib/zip";

const ROLES: Role[] = ["owner", "admin", "accountant", "ca_reviewer", "viewer"];
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("T5: every member can export; the FreWork admin (not a member) can't", () => {
  for (const r of ["owner", "accountant", "ca_reviewer", "viewer"] as Role[]) assert.ok(can(r, "export_data"), r);
  assert.ok(!can("admin", "export_data"));
});

test("T5: only the owner can delete the business", () => {
  assert.deepEqual(ROLES.filter(r => can(r, "delete_business")), ["owner"]);
});

test("T5: the routes ask for those permissions", () => {
  assert.match(src("src/app/api/finance/data-export/route.ts"), /requireBusiness\(req, bizId, \{ action: "export_data" \}\)/);
  const del = src("src/app/api/finance/business/delete/route.ts");
  assert.match(del, /requireBusiness\(req, bizId, \{ action: "delete_business" \}\)/);
  assert.match(del, /biz\.owner_id !== user\.id/, "restore is owner-only too");
  assert.match(del, /deleteConfirmed\(body\.confirm_name, biz\?\.name\)/);
});

test("T5: a deleted business is closed to everyone (API gate and database policies)", () => {
  assert.match(src("src/lib/apiAuth.ts"), /deleted_at\) return null/);
  const sql = src("src/app/finance/migrations/2026-10-20_t5_business_delete.sql");
  assert.equal((sql.match(/not exists \(select 1 from fw_fin_businesses where id = b and deleted_at is not null\)/g) ?? []).length, 2);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /cron\.schedule\('fw-purge-deleted-businesses'/);
  assert.ok(isSoftDeleted({ deleted_at: "2026-10-09T00:00:00Z" }));
  assert.ok(!isSoftDeleted({ deleted_at: null }) && !isSoftDeleted({}) && !isSoftDeleted(null));
});

test("T5: the owner must type the business name", () => {
  assert.ok(deleteConfirmed("Audit Test Traders", "AUDIT TEST TRADERS"));
  assert.ok(deleteConfirmed("  audit  test traders ", "AUDIT TEST TRADERS"));
  assert.ok(!deleteConfirmed("AUDIT TEST", "AUDIT TEST TRADERS"));
  assert.ok(!deleteConfirmed("", "AUDIT TEST TRADERS"));
  assert.ok(!deleteConfirmed("x", ""));
});

test("T5: CSV quotes, escapes and neutralises spreadsheet formulas", () => {
  const csv = toCsv([{ name: 'Rao, "Sons"', amount: -2500, note: "=HYPERLINK(1)", nested: { a: 1 } }]);
  assert.equal(csv, '﻿name,amount,note\r\n"Rao, ""Sons""",-2500,\'=HYPERLINK(1)\r\n');
});

test("T5: the export is a valid ZIP of the promised CSV files", () => {
  const zip = buildDataExport({
    business: { id: "b1", name: "AUDIT TEST TRADERS" },
    ledgers: [{ id: "l1", name: "Bank" }], journals: [{ id: "j1", entry_no: "JV/2026-27/0001" }],
    lines: [{ id: "x1", journal_id: "j1", dr_amount: 100 }], parties: [{ id: "p1", name: "ABC Traders" }], financialYears: [],
  }, new Date("2026-10-09T10:00:00Z"));
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    names.push(new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nlen)));
    const lnlen = dv.getUint16(off + 26, true);
    const data = zip.subarray(off + 30 + lnlen, off + 30 + lnlen + size);
    assert.equal(crc32(data), crc, names[i]);
    p += 46 + nlen;
  }
  assert.deepEqual(names, [...EXPORT_FILES]);
  assert.equal(exportZipName("AUDIT TEST TRADERS", new Date("2026-10-09T10:00:00Z")), "FreWork-data-AUDIT-TEST-TRADERS-2026-10-09.zip");
});

test("T5: crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});
