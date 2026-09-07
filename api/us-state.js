"use strict";

const zipcodes = require("zipcodes");

const US_STATE_CODES_BY_NAME = Object.freeze({
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  districtofcolumbia: "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  newhampshire: "NH",
  newjersey: "NJ",
  newmexico: "NM",
  newyork: "NY",
  northcarolina: "NC",
  northdakota: "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  rhodeisland: "RI",
  southcarolina: "SC",
  southdakota: "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  westvirginia: "WV",
  wisconsin: "WI",
  wyoming: "WY"
});
const US_STATE_CODES = new Set(Object.values(US_STATE_CODES_BY_NAME));

function normalizeUsState(value) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (US_STATE_CODES.has(upper)) return upper;

  const tokens = upper.split(/[^A-Z]+/).filter(Boolean);
  const suppliedCode = tokens.find((token) => US_STATE_CODES.has(token));
  if (suppliedCode) return suppliedCode;

  const compact = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (US_STATE_CODES_BY_NAME[compact]) return US_STATE_CODES_BY_NAME[compact];
  const embeddedName = Object.keys(US_STATE_CODES_BY_NAME).find((name) => compact.includes(name));
  return embeddedName ? US_STATE_CODES_BY_NAME[embeddedName] : "";
}

function stateForPostalCode(value) {
  const postalCode = String(value ?? "").match(/\d{5}/)?.[0] || "";
  if (!postalCode) return "";
  return normalizeUsState(zipcodes.lookup(postalCode)?.state);
}

function normalizeUsStateForPostal(value, postalCode) {
  // The ZIP is authoritative for UPS routing. This also prevents a transient
  // state/ZIP mismatch while WebTrack is updating an address form.
  return stateForPostalCode(postalCode) || normalizeUsState(value);
}

module.exports = {
  US_STATE_CODES_BY_NAME,
  normalizeUsState,
  normalizeUsStateForPostal,
  stateForPostalCode
};
