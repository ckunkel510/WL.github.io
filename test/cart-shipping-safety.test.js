"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function extractedFunction(fileSource, name, dependencies) {
  const start = fileSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const bodyStart = fileSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < fileSource.length; index += 1) {
    if (fileSource[index] === "{") depth += 1;
    if (fileSource[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) {
      const fnSource = fileSource.slice(start, index + 1);
      const names = Object.keys(dependencies || {});
      const values = names.map((key) => dependencies[key]);
      return Function(...names, `return (${fnSource});`)(...values);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

test("cart quantity controls load the trusted companywide clearance limit", () => {
  const cart = source("ShoppingCartRow.js");
  assert.match(cart, /api\/cart-policy/);
  assert.match(cart, /companyClearanceQty/);
  assert.match(cart, /Clearance item:.*available companywide/);
  assert.match(cart, /inventory could not be confirmed/i);
});

test("cart preserves its clearance policy when the shared script runs on checkout", () => {
  const cart = source("ShoppingCartRow.js");
  const loaderIndex = cart.indexOf("async function wlLoadCartPolicy");
  const noRowsIndex = cart.indexOf("if (!refs.length)", loaderIndex);
  const clearIndex = cart.indexOf("sessionStorage.removeItem(WL_CLEARANCE_POLICY_KEY)", loaderIndex);
  assert.ok(loaderIndex >= 0);
  assert.ok(noRowsIndex > loaderIndex);
  assert.ok(clearIndex > noRowsIndex);
});

test("checkout resolves branch shortages against companywide stock before continuing", () => {
  const checkout = source("Checkout2.js");
  const lookupIndex = checkout.indexOf("fetchCompanyAvailability(refs)");
  const autoYesIndex = checkout.indexOf("triggerStockYes(modal, message)", lookupIndex);
  assert.ok(lookupIndex >= 0);
  assert.ok(autoYesIndex > lookupIndex);
  assert.match(checkout, /checkAvailability:\s*true/);
  assert.match(checkout, /7 days or longer/);
  assert.match(checkout, /pickup, Woodson delivery, or UPS shipment/);
  assert.match(checkout, /wl-clearance-stock-block/);
  assert.match(checkout, /Update a clearance quantity/);
});

test("checkout hides local delivery for an address outside Texas", () => {
  const checkout = source("Checkout2.js");
  const outsideStart = checkout.indexOf('if (region === "outside")');
  const texasStart = checkout.indexOf('} else if (region === "texas")', outsideStart);
  const outsideBranch = checkout.slice(outsideStart, texasStart);

  assert.ok(outsideStart >= 0);
  assert.ok(texasStart > outsideStart);
  assert.match(checkout, /if \(!option\) values\.push\(el\.textContent\)/);
  assert.match(checkout, /tokens\.some\(function \(token\) \{ return WL_STATE_NAMES\.has\(token\); \}\)/);
  assert.match(checkout, /collectAddressZipCandidates\("delivery"\)/);
  assert.match(checkout, /zip >= 73301 && zip <= 73399/);
  assert.match(checkout, /zip >= 75001 && zip <= 79999/);
  assert.match(checkout, /zip >= 88510 && zip <= 88595/);
  assert.match(outsideBranch, /\$delivery\.hide\(\)/);
  assert.match(outsideBranch, /Ship via UPS is selected/);
  assert.match(outsideBranch, /Pickup from a Woodson store is also available/);
  assert.match(outsideBranch, /setFulfillmentIntent\("ship"\)/);
  assert.match(outsideBranch, /updateShippingStyles\("ship", \{ silent: !!\(ups && ups\.checked\), reason: "outside-address" \}\)/);
  assert.match(checkout, /button type="button" id="btnPickup"/);
  assert.doesNotMatch(checkout, /outside-address-click/);
});

test("checkout classifies selected states and saved ZIPs for Texas-only delivery", () => {
  const checkout = source("Checkout2.js");
  const cleanStateValue = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const normalizeStateRegion = extractedFunction(checkout, "normalizeStateRegion", {
    cleanStateValue,
    WL_STATE_NAMES: new Set(["colorado", "newmexico", "newyork"]),
    WL_STATE_ABBRS: new Set(["co", "nm", "ny"])
  });
  const normalizeZipRegion = extractedFunction(checkout, "normalizeZipRegion", { cleanStateValue });

  assert.equal(normalizeStateRegion("6 Colorado Colorado 6"), "outside");
  assert.equal(normalizeStateRegion("30 New Mexico New Mexico 30"), "outside");
  assert.equal(normalizeStateRegion("TX Texas"), "texas");
  assert.equal(normalizeStateRegion("Canada"), "outside");
  assert.equal(normalizeStateRegion("[Select State]"), "");
  assert.equal(normalizeZipRegion("80219"), "outside");
  assert.equal(normalizeZipRegion("77836"), "texas");
  assert.equal(normalizeZipRegion("73301"), "texas");
  assert.equal(normalizeZipRegion("88510"), "texas");
  assert.equal(normalizeZipRegion(""), "");
});

test("delivery options display the server-returned rate without a browser-side free override", () => {
  const delivery = source("DeliveryOptions.js");
  assert.doesNotMatch(delivery, /WLShippingPromo/);
  assert.doesNotMatch(delivery, /promoApplied\s*\?/);
  assert.match(delivery, /cost = rawCost/);
});

test("cart UPS requests no longer send browser-controlled promotion eligibility", () => {
  const cart = source("WoodsonShoppingCart.js");
  assert.doesNotMatch(cart, /promo:\s*promo/);
  assert.match(cart, /shippingOffer/);
  assert.match(cart, /UpsShippingOffer\.js/);
});

test("the advertised SummerChill26 bridge remains separate from automatic offers", () => {
  const promo = source("UpsShippingPromo.js");
  const offer = source("UpsShippingOffer.js");
  assert.match(promo, /SUMMERCHILL26/);
  assert.match(promo, /promoSession=1/);
  assert.match(promo, /UpsShippingOffer\.js/);
  assert.match(offer, /WLShippingOffer/);
  assert.match(offer, /Checkout\|PlaceOrder/);
});
