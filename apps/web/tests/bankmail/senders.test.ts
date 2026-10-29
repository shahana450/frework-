// Bank email import — sender whitelist and DKIM decision
import { test } from "node:test";
import assert from "node:assert/strict";
import { bareAddress, underDomain, matchesPattern, bankForSender, gmailFilterFor, isGmailConfirmSender, type WhitelistRow } from "../../src/lib/bankmail/senders";
import { decide, summarize, type AuthSummary } from "../../src/lib/bankmail/authCheck";

const WL: WhitelistRow[] = [
  { bank_code: "sbi", bank_name: "State Bank of India", sender_domain: "sbi.co.in", sender_patterns: ["*@alerts.sbi.co.in", "cbssbi.cas@alerts.sbi.co.in"], active: true },
  { bank_code: "hdfc", bank_name: "HDFC Bank", sender_domain: "hdfcbank.net", sender_patterns: ["alerts@hdfcbank.net"], active: true },
  { bank_code: "icici", bank_name: "ICICI Bank", sender_domain: "icicibank.com", sender_patterns: [], active: false },
];
const pass = (...d: string[]): AuthSummary => ({ dkim: "pass", dkimDomains: d, spf: "softfail", dmarc: "pass", arc: "pass" });

test("bare address from display names and angle brackets", () => {
  assert.equal(bareAddress("HDFC Bank InstaAlerts <Alerts@HDFCBank.net>"), "alerts@hdfcbank.net");
  assert.equal(bareAddress("alerts@hdfcbank.net"), "alerts@hdfcbank.net");
  assert.equal(bareAddress(""), "");
});

test("subdomain match does not accept look-alike domains", () => {
  assert.ok(underDomain("alerts.sbi.co.in", "sbi.co.in"));
  assert.ok(underDomain("sbi.co.in", "sbi.co.in"));
  assert.ok(!underDomain("evilsbi.co.in", "sbi.co.in"));
  assert.ok(!underDomain("sbi.co.in.attacker.com", "sbi.co.in"));
});

test("sender patterns: wildcard domain and exact address", () => {
  assert.ok(matchesPattern("x@alerts.sbi.co.in", "*@alerts.sbi.co.in"));
  assert.ok(!matchesPattern("x@sbi.co.in", "*@alerts.sbi.co.in"));
  assert.ok(matchesPattern("alerts@hdfcbank.net", "alerts@hdfcbank.net"));
  assert.ok(!matchesPattern("info@hdfcbank.net", "alerts@hdfcbank.net"));
});

test("bank is found only for whitelisted, active senders", () => {
  assert.equal(bankForSender("SBI <cbssbi.cas@alerts.sbi.co.in>", WL)?.bank_code, "sbi");
  assert.equal(bankForSender("alerts@hdfcbank.net", WL)?.bank_code, "hdfc");
  assert.equal(bankForSender("promo@hdfcbank.net", WL), null);        // not an alert sender
  assert.equal(bankForSender("alert@icicibank.com", WL), null);       // bank switched off
  assert.equal(bankForSender("alerts@hdfcbank.net.fake.in", WL), null);
});

test("Gmail forwarding confirmation sender", () => {
  assert.ok(isGmailConfirmSender("Gmail Team <forwarding-noreply@google.com>"));
  assert.ok(!isGmailConfirmSender("noreply@google.com"));
});

test("Gmail filter line for the client's banks", () => {
  assert.equal(gmailFilterFor(WL), "from:(alerts.sbi.co.in OR cbssbi.cas@alerts.sbi.co.in OR alerts@hdfcbank.net)");
});

test("accepts a forward when the bank's own DKIM passes", () => {
  const v = decide("alerts@hdfcbank.net", pass("hdfcbank.net", "gmail.com"), WL);
  assert.equal(v.ok, true);
});

test("accepts DKIM from a subdomain of the bank", () => {
  assert.equal(decide("x@alerts.sbi.co.in", pass("alerts.sbi.co.in"), WL).ok, true);
});

test("quarantines when only the forwarder signed (bank signature lost)", () => {
  const v = decide("alerts@hdfcbank.net", pass("gmail.com"), WL);
  assert.equal(v.ok, false);
  assert.match((v as { reason: string }).reason, /not the bank/);
});

test("quarantines when there is no DKIM at all", () => {
  const v = decide("alerts@hdfcbank.net", { dkim: "none", dkimDomains: [], spf: "pass", dmarc: "none", arc: "none" }, WL);
  assert.equal(v.ok, false);
  assert.match((v as { reason: string }).reason, /No DKIM/);
});

test("quarantines a failed (tampered) bank signature", () => {
  const v = decide("alerts@hdfcbank.net", { dkim: "fail", dkimDomains: [], spf: "pass", dmarc: "fail", arc: "none" }, WL);
  assert.equal(v.ok, false);
  assert.match((v as { reason: string }).reason, /changed after the bank sent it/);
});

test("quarantines senders off the whitelist even with valid DKIM", () => {
  const v = decide("billing@phish-bank.in", pass("phish-bank.in"), WL);
  assert.equal(v.ok, false);
  assert.match((v as { reason: string }).reason, /not on the bank whitelist/);
});

test("summarize reads mailauth's result shape", () => {
  const s = summarize({
    dkim: { results: [{ signingDomain: "HDFCBank.net", status: { result: "pass" } }, { signingDomain: "gmail.com", status: { result: "fail" } }] },
    spf: { status: { result: "softfail" } }, dmarc: { status: { result: "pass" } }, arc: false,
  });
  assert.deepEqual(s, { dkim: "pass", dkimDomains: ["hdfcbank.net"], spf: "softfail", dmarc: "pass", arc: "none" });
});
