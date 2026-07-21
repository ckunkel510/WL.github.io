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

test("checkout does not auto-approve a shortage when clearance state is unknown or present", () => {
  const checkout = source("Checkout2.js");
  const preserveIndex = checkout.indexOf("const stockPolicy = preserveStockModal(modal)");
  const autoYesIndex = checkout.indexOf("return triggerStockYes(modal)", preserveIndex);
  assert.ok(preserveIndex >= 0);
  assert.ok(autoYesIndex > preserveIndex);
  assert.match(checkout, /wl-clearance-stock-block/);
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
