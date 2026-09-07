"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeUsState,
  normalizeUsStateForPostal,
  stateForPostalCode
} = require("../api/us-state");

const STATE_CASES = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA",
  Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY"
};

test("normalizes every WebTrack US state name to its USPS code", () => {
  Object.entries(STATE_CASES).forEach(([name, code]) => {
    assert.equal(normalizeUsState(name), code, name);
    assert.equal(normalizeUsState(code), code, code);
  });
});

test("normalizes noisy WebTrack state labels without guessing Canadian provinces", () => {
  assert.equal(normalizeUsState("58 Virginia Virginia 58"), "VA");
  assert.equal(normalizeUsState("New York (NY)"), "NY");
  assert.equal(normalizeUsState("Alberta"), "");
  assert.equal(normalizeUsState("[Select State]"), "");
});

test("uses the ZIP-derived state as the authoritative UPS routing value", () => {
  assert.equal(stateForPostalCode("23220"), "VA");
  assert.equal(normalizeUsStateForPostal("Virginia", "23220"), "VA");
  assert.equal(normalizeUsStateForPostal("CA", "23220"), "VA");
  assert.equal(normalizeUsStateForPostal("Georgia", "30303"), "GA");
});
