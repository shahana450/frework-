// WhatsApp sign-in: the LOGIN command words
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, helpText } from "../../src/lib/whatsapp/format";

test("LOGIN, dashboard and sign in all ask for a sign-in link", () => {
  for (const w of ["LOGIN", "login", "Log in", "dashboard", "Open app", "sign in!"]) assert.deepEqual(parseCommand(w), { type: "login" }, w);
  assert.equal(parseCommand("login to tally please").type, "text");
});

test("HELP mentions LOGIN", () => {
  assert.match(helpText("Acme"), /\*LOGIN\*/);
});
