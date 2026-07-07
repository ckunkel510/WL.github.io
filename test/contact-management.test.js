const test = require("node:test");
const assert = require("node:assert/strict");

const contactManager = require("../ContactManagement.js");

test("extracts a contact id from WebTrack contact links", () => {
  assert.equal(contactManager.contactOid("ContactDetails_r.aspx?oid=18118&action=3"), "18118");
  assert.equal(contactManager.contactOid("ContactDetails_r.aspx?action=3"), "");
});

test("recognizes default contact values conservatively", () => {
  assert.equal(contactManager.isDefaultContactValue("yes"), true);
  assert.equal(contactManager.isDefaultContactValue(" true "), true);
  assert.equal(contactManager.isDefaultContactValue("no"), false);
  assert.equal(contactManager.isDefaultContactMeta("Default Contact", ""), true);
  assert.equal(contactManager.isDefaultContactMeta("Contact", "no"), false);
});

test("splits display names without losing compound first names", () => {
  assert.deepEqual(contactManager.splitDisplayName("Portal"), { first: "Portal", last: "" });
  assert.deepEqual(contactManager.splitDisplayName("Cody Kunkel"), { first: "Cody", last: "Kunkel" });
  assert.deepEqual(contactManager.splitDisplayName("Mary Beth Smith"), { first: "Mary Beth", last: "Smith" });
});
