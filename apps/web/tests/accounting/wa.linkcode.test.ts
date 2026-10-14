// WhatsApp link by code: the code on the phone differs from the code shown on the page
import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneCode, linkTemplatePayload, linkSendError } from "../../src/lib/whatsapp/linkCode";

test("phone code is 6 digits, stable, and not the on-page code", () => {
  const a = phoneCode("link-1", "123456", "k");
  assert.match(a, /^\d{6}$/);
  assert.equal(phoneCode("link-1", "123456", "k"), a);
  assert.notEqual(phoneCode("link-1", "654321", "k"), a);
  assert.notEqual(phoneCode("link-2", "123456", "k"), a);
  assert.notEqual(phoneCode("link-1", "123456", "other-key"), a);
});

test("template carries the code in the body and the copy-code button", () => {
  const p = linkTemplatePayload("919876543210", "482913");
  assert.equal(p.template.name, "frebook_link_code");
  assert.equal(p.template.components[0].parameters[0].text, "482913");
  assert.equal(p.template.components[1].parameters[0].text, "482913");
});

test("Meta errors become plain words", () => {
  assert.match(linkSendError(404, '{"error":{"code":132001,"message":"Template name does not exist"}}'), /template isn't approved/);
  assert.match(linkSendError(400, '{"error":{"code":131026}}'), /seem to be on WhatsApp/);
  assert.match(linkSendError(401, '{"error":{"type":"OAuthException","code":190}}'), /access token/);
});
