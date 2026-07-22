"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
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
