// Bank email import — which client forwarded the email (Gmail, Google Workspace, Outlook / Microsoft 365)
import { test } from "node:test";
import assert from "node:assert/strict";
import { forwardingIdentities, fromCafReturnPath, last4sIn, identify, type Headers, type Source, type Account } from "../../src/lib/bankmail/identify";

const SOURCES: Source[] = [
  { business_id: "biz-a", email: "ravi.traders@gmail.com" },
  { business_id: "biz-b", email: "accounts@sawagold.in" },
  { business_id: "biz-c", email: "owner@outlook.com" },
  // one mailbox, two businesses (a CA's client or an owner with two firms)
  { business_id: "biz-d", email: "family@gmail.com" },
  { business_id: "biz-e", email: "family@gmail.com" },
];
const ACCOUNTS: Account[] = [
  { id: "acc-a", business_id: "biz-a", bank_code: "hdfc", last4: "1234" },
  { id: "acc-b", business_id: "biz-b", bank_code: "sbi", last4: "5678" },
  { id: "acc-c", business_id: "biz-c", bank_code: "icici", last4: "4321" },
  { id: "acc-d", business_id: "biz-d", bank_code: "federal", last4: "1111" },
  { id: "acc-e", business_id: "biz-e", bank_code: "federal", last4: "2222" },
];

// Anonymised header samples
const GMAIL: Headers = {
  "x-forwarded-for": "ravi.traders@gmail.com admin@frework.online",
  "x-forwarded-to": "admin@frework.online",
  "return-path": "<ravi.traders+caf_=admin=frework.online@gmail.com>",
  "delivered-to": "admin@frework.online",
  to: "ravi.traders@gmail.com",
  from: "HDFC Bank <alerts@hdfcbank.net>",
};
const WORKSPACE: Headers = {
  "x-forwarded-for": "accounts@sawagold.in admin@frework.online",
  "return-path": "<accounts+caf_=admin=frework.online@sawagold.in>",
  to: "accounts@sawagold.in",
  from: "SBI <cbssbi.cas@alerts.sbi.co.in>",
};
const OUTLOOK: Headers = {
  "resent-from": "<owner@outlook.com>",
  "x-ms-exchange-inbox-rules-loop": "owner@outlook.com",
  to: "owner@outlook.com",
  "delivered-to": "admin@frework.online",
  from: "ICICI Bank <alert@icicibank.com>",
};

test("Gmail caf return path gives the client mailbox", () => {
  assert.equal(fromCafReturnPath("<ravi.traders+caf_=admin=frework.online@gmail.com>"), "ravi.traders@gmail.com");
  assert.equal(fromCafReturnPath("<bounce@hdfcbank.net>"), null);
});

test("forwarding identities skip our own and the bank's addresses", () => {
  const ids = forwardingIdentities(GMAIL, "hdfcbank.net").map(i => i.email);
  assert.deepEqual(ids, ["ravi.traders@gmail.com"]);
  assert.equal(forwardingIdentities(OUTLOOK, "icicibank.com")[0].email, "owner@outlook.com");
  assert.equal(forwardingIdentities(WORKSPACE, "sbi.co.in")[0].email, "accounts@sawagold.in");
});

test("last 4 digits from the usual bank wordings", () => {
  assert.deepEqual(last4sIn("Rs 500.00 debited from A/c XX1234 on 12-10-26"), ["1234"]);
  assert.deepEqual(last4sIn("your a/c no. ******5678 is credited"), ["5678"]);
  assert.deepEqual(last4sIn("Account ending with 4321"), ["4321"]);
  assert.deepEqual(last4sIn("Acct XX9876 debited; Avl Bal Rs 1,000"), ["9876"]);
  assert.deepEqual(last4sIn("UPI ref 412345678901, no account here"), []);
});

test("Gmail: identified and confirmed by last 4", () => {
  const r = identify(GMAIL, "Rs.500 debited from A/c XX1234", "hdfc", "hdfcbank.net", SOURCES, ACCOUNTS);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.business_id, "biz-a");
  assert.equal(r.ok && r.account.id, "acc-a");
});

test("Google Workspace: identified", () => {
  const r = identify(WORKSPACE, "A/c XX5678 credited", "sbi", "sbi.co.in", SOURCES, ACCOUNTS);
  assert.equal(r.ok && r.business_id, "biz-b");
});

test("Outlook redirect: identified", () => {
  const r = identify(OUTLOOK, "Account ending 4321 debited", "icici", "icicibank.com", SOURCES, ACCOUNTS);
  assert.equal(r.ok && r.business_id, "biz-c");
});

test("one mailbox, two businesses: split by last 4", () => {
  const h: Headers = { "x-forwarded-for": "family@gmail.com admin@frework.online", from: "alerts@federalbank.co.in" };
  assert.equal((identify(h, "A/c XX2222", "federal", "federalbank.co.in", SOURCES, ACCOUNTS) as { business_id: string }).business_id, "biz-e");
  assert.equal((identify(h, "A/c XX1111", "federal", "federalbank.co.in", SOURCES, ACCOUNTS) as { business_id: string }).business_id, "biz-d");
  const none = identify(h, "no account number", "federal", "federalbank.co.in", SOURCES, ACCOUNTS);
  assert.equal(none.ok, false);
});

test("last-4 mismatch goes to Unmatched", () => {
  const r = identify(GMAIL, "A/c XX9999 debited", "hdfc", "hdfcbank.net", SOURCES, ACCOUNTS);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /9999/);
});

test("unregistered mailbox goes to Unmatched", () => {
  const h: Headers = { "x-forwarded-for": "stranger@gmail.com admin@frework.online" };
  const r = identify(h, "A/c XX1234", "hdfc", "hdfcbank.net", SOURCES, ACCOUNTS);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /not a registered/);
});

test("no forwarding headers at all goes to Unmatched", () => {
  const r = identify({ from: "alerts@hdfcbank.net", to: "admin@frework.online" }, "A/c XX1234", "hdfc", "hdfcbank.net", SOURCES, ACCOUNTS);
  assert.equal(r.ok, false);
});

test("a single registered account is used when the mail has no account number", () => {
  const r = identify(GMAIL, "Statement attached", "hdfc", "hdfcbank.net", SOURCES, ACCOUNTS);
  assert.equal(r.ok && r.account.id, "acc-a");
});
