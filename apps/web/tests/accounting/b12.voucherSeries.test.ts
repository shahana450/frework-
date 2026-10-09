// B12 — separate voucher series per type and financial year; an asset bought from the bank is a Payment, not a Purchase
import { test } from "node:test";
import assert from "node:assert/strict";
import { seriesPrefix, formatVoucherNo, voucherKind, fyLabel } from "../../src/lib/voucherSeries";

test("B12: one series per voucher type, per financial year", () => {
  assert.equal(fyLabel("2026-04-01"), "2026-27");
  assert.equal(formatVoucherNo(seriesPrefix("receipt", "2026-04-01"), 1), "RV/2026-27/0001");
  assert.equal(seriesPrefix("payment", "2026-04-01"), "PV/2026-27");
  assert.equal(seriesPrefix("sales", "2026-04-01"), "SV/2026-27");
  assert.equal(seriesPrefix("purchase", "2026-04-01"), "PU/2026-27");
  assert.equal(seriesPrefix("contra", "2026-04-01"), "CV/2026-27");
  assert.equal(seriesPrefix("journal", "2026-04-01"), "JV/2026-27");
  assert.equal(seriesPrefix("receipt", "2027-04-01"), "RV/2027-28", "new year, new series");
  assert.equal(seriesPrefix("receipt", "2026-04-01", { receipt: "rct" }), "RCT/2026-27", "configurable per business");
});

test("B12: computers bought from the bank is a Payment voucher, goods bought is a Purchase", () => {
  assert.equal(voucherKind("purchase", [{ cashBank: false, dr: 55000, cr: 0 }, { cashBank: true, dr: 0, cr: 55000 }]), "payment");
  assert.equal(voucherKind("purchase", [{ cashBank: false, dr: 40000, cr: 0, isGoodsPurchase: true }, { cashBank: false, dr: 0, cr: 40000 }]), "purchase");
  assert.equal(voucherKind("purchase", [{ cashBank: false, dr: 55000, cr: 0 }, { cashBank: false, dr: 0, cr: 55000 }]), "journal", "asset on credit");
  assert.equal(voucherKind("journal", [{ cashBank: true, dr: 5000, cr: 0 }, { cashBank: true, dr: 0, cr: 5000 }]), "contra");
  assert.equal(voucherKind("journal", [{ cashBank: true, dr: 25000, cr: 0 }, { cashBank: false, dr: 0, cr: 25000 }]), "receipt");
});
