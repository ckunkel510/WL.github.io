"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "..", "product-sidebar.js"), "utf8");

test("Watts and deer corn prices are hidden until sign-in", () => {
  assert.match(source, /loginPriceProducts = new Set\(\["6821", "22984"\]\)/);
  assert.match(source, /WL_LOGIN_PRICE_PIDS = new Set\(\["6821", "22984"\]\)/);
  assert.match(source, /Sign in to choose your store and see its local price\./);
});

test("deer corn alone receives the regional store price selector", () => {
  assert.match(source, /WL_STORE_PRICE_PIDS = new Set\(\["22984"\]\)/);
  assert.match(source, /buildRegionalStorePicker/);
  assert.match(source, /Deer corn pricing varies by location/);
});

test("store changes use the signed-in WebTrack form in the background", () => {
  assert.match(source, /fetch\(ACCOUNT_SETTINGS_URL, \{[\s\S]*credentials: "same-origin"/);
  assert.match(source, /method: "POST"[\s\S]*Content-Type": "application\/x-www-form-urlencoded/);
  assert.match(source, /WebForm_PostBackOptions/);
  assert.match(source, /store_update_not_verified/);
  assert.match(source, /window\.location\.reload\(\)/);
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*ACCOUNT_SETTINGS_URL/);
});
