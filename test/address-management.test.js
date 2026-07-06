const test = require("node:test");
const assert = require("node:assert/strict");

const addressManager = require("../AddressManagement.js");

test("recognizes the protected WebTrack default address", () => {
  assert.equal(addressManager.isDefaultAddressMeta("Default Address", "CUSTOM"), true);
  assert.equal(addressManager.isDefaultAddressMeta("Address", "MAIN"), true);
  assert.equal(addressManager.isDefaultAddressMeta("Address", "10005"), false);
});

test("normalizes default address codes conservatively", () => {
  assert.equal(addressManager.isDefaultAddressCode(" main "), true);
  assert.equal(addressManager.isDefaultAddressCode("MAIN OFFICE"), false);
  assert.equal(addressManager.isDefaultAddressCode(""), false);
});

test("extracts an address id from relative WebTrack links", () => {
  assert.equal(addressManager.addressOid("AddressDetails.aspx?oid=4172&action=3"), "4172");
  assert.equal(addressManager.addressOid("AddressDetails.aspx?action=3"), "");
});
