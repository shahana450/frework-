// Bank email import — alert parsers. Samples are anonymised and follow each bank's published alert wording;
// replace them with real forwarded emails before launch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAlert, parseGmailConfirm, findDate, findRef, findBalance, findDirection, htmlToText } from "../../src/lib/bankmail/parsers/alerts";

const ok = (r: ReturnType<typeof parseAlert>) => { assert.equal(r.ok, true, (r as { reason?: string }).reason); return (r as { line: { date: string; amount: number; dr_cr: string; ref: string | null; balance: number | null; last4: string | null } }).line; };

test("dates in every bank format", () => {
  assert.equal(findDate("on 12-10-26"), "2026-10-12");
  assert.equal(findDate("on 12/10/2026"), "2026-10-12");
  assert.equal(findDate("on 12Oct26"), "2026-10-12");
  assert.equal(findDate("on 12-Oct-2026"), "2026-10-12");
  assert.equal(findDate("on 2026-10-12"), "2026-10-12");
});

test("references: UPI ref, UTR, RRN", () => {
  assert.equal(findRef("Your UPI transaction reference number is 412345678901."), "412345678901");
  assert.equal(findRef("UTR No: HDFCR52026101200123 for NEFT"), "HDFCR52026101200123");
  assert.equal(findRef("Info: UPI-412345678901-RAVI"), "412345678901");
});

test("balance and direction", () => {
  assert.equal(findBalance("Avl Bal Rs 10,234.50"), 10234.5);
  assert.equal(findBalance("The Available Balance is INR 1,00,000.00."), 100000);
  assert.equal(findDirection("Rs 500 debited from your account **1234 to VPA x@ybl"), "dr");
  assert.equal(findDirection("Rs 500 credited to your account"), "cr");
});

test("HDFC UPI debit", () => {
  const l = ok(parseAlert("hdfc", "You have done a UPI txn. Check details!", "Dear Customer, Rs.500.00 has been debited from account **1234 to VPA ravi.traders@okhdfc RAVI TRADERS on 12-10-26. Your UPI transaction reference number is 412345678901. If you did not authorize this transaction, please report it."));
  assert.deepEqual([l.date, l.amount, l.dr_cr, l.ref, l.last4], ["2026-10-12", 500, "dr", "412345678901", "1234"]);
});

test("HDFC credit with balance", () => {
  const l = ok(parseAlert("hdfc", "Account update", "Dear Customer, Rs. 35,400.00 is successfully credited to your account **1234 by VPA abc@okicici ABC TRADERS on 12-10-26. Your UPI transaction reference number is 528812345678. Avl Bal Rs 1,14,26,653.58"));
  assert.deepEqual([l.amount, l.dr_cr, l.balance], [35400, "cr", 11426653.58]);
});

test("SBI transfer debit", () => {
  const l = ok(parseAlert("sbi", "Transaction alert", "Dear Customer, Your A/C XXXXX5678 has a debit by transfer of Rs 7,257.00 on 14Oct26. Avl Bal Rs 1,10,000.00. -SBI"));
  assert.deepEqual([l.date, l.amount, l.dr_cr, l.last4, l.balance], ["2026-10-14", 7257, "dr", "5678", 110000]);
});

test("ICICI debit", () => {
  const l = ok(parseAlert("icici", "Transaction alert", "Dear Customer, Your account XX4321 is debited with INR 118.00 on 15-Oct-26. Info: BANK CHARGES. The Available Balance is INR 9,882.00."));
  assert.deepEqual([l.date, l.amount, l.dr_cr, l.last4, l.balance], ["2026-10-15", 118, "dr", "4321", 9882]);
});

test("Federal Bank credit", () => {
  const l = ok(parseAlert("federal", "Federal Bank alert", "Rs 18,000.00 credited to your A/c XX1111 on 10-10-2026 by IMPS Ref No 628312345678. Avl bal Rs 50,000.00"));
  assert.deepEqual([l.date, l.amount, l.dr_cr, l.ref, l.last4], ["2026-10-10", 18000, "cr", "628312345678", "1111"]);
});

test("South Indian Bank debit", () => {
  const l = ok(parseAlert("sib", "Transaction Alert", "Your A/c XX2468 debited with Rs.2,500.00 on 13-10-26 towards NEFT UTR SIBLN26286001234. Bal Rs.47,500.00"));
  assert.deepEqual([l.amount, l.dr_cr, l.last4, l.balance], [2500, "dr", "2468", 47500]);
});

test("Canara Bank debit from an HTML email", () => {
  const html = "<html><body><p>Dear Customer,</p><p>An amount of INR 25,000.00 has been DEBITED to your account XXX1357 on 15/10/2026 towards RENT OCTOBER.</p><p>Total Avail.bal INR 75,000.00</p></body></html>";
  const l = ok(parseAlert("canara", "Canara Bank Transaction Alert", html));
  assert.deepEqual([l.date, l.amount, l.dr_cr, l.last4, l.balance], ["2026-10-15", 25000, "dr", "1357", 75000]);
});

test("marketing mail from a bank is not a transaction", () => {
  const r = parseAlert("hdfc", "Pre-approved loan offer", "Get a personal loan of up to Rs 10,00,000 at attractive rates. Apply now!");
  assert.equal(r.ok, false);
});

test("an alert without a date goes to Needs attention", () => {
  const r = parseAlert("sbi", "Alert", "Your A/C XX5678 debited by Rs 500.");
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /date/);
});

test("html to text keeps the sentence", () => {
  assert.equal(htmlToText("<p>Rs&nbsp;500&nbsp;debited</p>"), "Rs 500 debited");
});

test("Gmail forwarding confirmation: code, link and requester", () => {
  const r = parseGmailConfirm("(#123456789) Gmail Forwarding Confirmation - Receive Mail from ravi.traders@gmail.com",
    "ravi.traders@gmail.com has requested to automatically forward mail to your email address admin@frework.online.\nConfirmation code: 123456789\nTo allow ravi.traders@gmail.com to automatically forward mail to your address, please click the link below to confirm the request:\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ_example%5D-abc123\n");
  assert.equal(r.code, "123456789");
  assert.equal(r.requester, "ravi.traders@gmail.com");
  assert.match(r.link ?? "", /^https:\/\/mail-settings\.google\.com\/mail\//);
});
