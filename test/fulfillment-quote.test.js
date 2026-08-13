"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFulfillmentQuote,
  isEasyParcel,
  recommendFulfillment
} = require("../api/fulfillment-quote")._test;

const policy = {
  enabled: false,
  marginFloor: 0.15,
  cardFeeRate: 0.03,
  cogsBufferRate: 0.02,
  contingencyRate: 0.01,
  reducedGroundAmount: 6.95,
  packagingCostPerPackage: 0,
  handlingCostPerOrder: 0,
  configured: false
};

function catalog(dimensions = {}) {
  return {
    active: { id: "catalog-test" },
    fresh: true,
    products: [{
      productId: "100",
      productCode: "ITEM-100",
      price: 25,
      averageCost: 10,
      weight: dimensions.weight ?? 8,
      length: dimensions.length ?? 12,
      width: dimensions.width ?? 8,
      height: dimensions.height ?? 6
    }]
  };
}

function upsRate(amount = 28) {
  return async () => ({
    rates: [
      { serviceCode: "03", serviceName: "UPS Ground", currency: "USD", amount, billingWeight: 8 },
      { serviceCode: "02", serviceName: "UPS 2nd Day Air", currency: "USD", amount: amount + 20, billingWeight: 8 }
    ]
  });
}

function baseBody() {
  return {
    shipFrom: { postalCode: "77833" },
    shipTo: { addressLine: ["123 Main St"], city: "Brenham", state: "TX", postalCode: "77834" },
    cart: [{ productId: "100", quantity: 1 }]
  };
}

test("prefers UPS for an easy parcel when it is within $10 of delivery", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 33 },
    delivery: { available: true, amount: 25 },
    easyParcel: true,
    threshold: 10
  });
  assert.equal(result.mode, "ship");
  assert.equal(result.reason, "easy-parcel-within-threshold");
});

test("prefers Woodson when delivery saves more than $10", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 36 },
    delivery: { available: true, amount: 25 },
    easyParcel: true,
    threshold: 10
  });
  assert.equal(result.mode, "delivery");
});

test("prefers Woodson for bulky or unknown packages inside a delivery area", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 20 },
    delivery: { available: true, amount: 25 },
    easyParcel: false,
    threshold: 10
  });
  assert.equal(result.mode, "delivery");
  assert.equal(result.reason, "bulky-or-unknown-parcel");
});

test("identifies the conservative easy-parcel threshold", () => {
  assert.equal(isEasyParcel([{ weight: 50, length: 48, width: 12, height: 12 }]), true);
  assert.equal(isEasyParcel([{ weight: 51, length: 12, width: 8, height: 6 }]), false);
  assert.equal(isEasyParcel([{ weight: 8 }]), false);
});

test("builds a unified UPS recommendation and stores only positive raw rates", async () => {
  let stored = null;
  const result = await buildFulfillmentQuote(baseBody(), {
    requestRates: upsRate(28),
    getCatalogProducts: async () => catalog(),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: true, mode: "delivery", amount: 25, currency: "USD", serviceCode: "03", serviceName: "Woodson Local Delivery", billingWeight: 8 }),
    storeFulfillmentClaim: async (claim) => { stored = claim; return { ok: true }; }
  });
  assert.equal(result.recommendation.mode, "ship");
  assert.equal(result.options.ups.amount, 28);
  assert.equal(stored.recommendation.mode, "ship");
  assert.ok(stored.rates.every((rate) => rate.amount > 0));
});

test("falls back to Woodson when UPS packing cannot handle a lumber-size item", async () => {
  const result = await buildFulfillmentQuote(baseBody(), {
    requestRates: upsRate(20),
    getCatalogProducts: async () => catalog({ weight: 60, length: 144, width: 6, height: 2 }),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: true, mode: "delivery", amount: 25, currency: "USD", serviceCode: "03", serviceName: "Woodson Local Delivery", billingWeight: 60 }),
    storeFulfillmentClaim: async () => ({ ok: true })
  });
  assert.equal(result.options.ups.available, false);
  assert.equal(result.recommendation.mode, "delivery");
  assert.equal(result.recommendation.amount, 25);
});

test("returns a manual freight result when neither automatic method is possible", async () => {
  const body = baseBody();
  body.shipTo = { city: "Denver", state: "CO", postalCode: "80219" };
  const result = await buildFulfillmentQuote(body, {
    getCatalogProducts: async () => catalog({ weight: 60, length: 144, width: 6, height: 2 }),
    requestRates: upsRate(20),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-texas" }),
    storeFulfillmentClaim: async () => ({ ok: false })
  });
  assert.equal(result.recommendation.mode, "manual");
  assert.equal(result.recommendation.amount, null);
});

test("keeps supplied cart weight for Woodson delivery when UPS is unavailable", async () => {
  const body = baseBody();
  delete body.cart;
  body.packages = [{ weight: 25000.01, length: 48, width: 12, height: 12 }];
  let deliveryWeight = 0;
  const result = await buildFulfillmentQuote(body, {
    requestRates: async () => { throw new Error("UPS unavailable"); },
    quoteWoodsonDelivery: async (input) => {
      deliveryWeight = input.totalWeight;
      return { available: true, mode: "delivery", amount: 50, currency: "USD", serviceCode: "03", serviceName: "Woodson Local Delivery", billingWeight: input.totalWeight };
    },
    storeFulfillmentClaim: async () => ({ ok: true })
  });
  assert.equal(deliveryWeight, 25000.01);
  assert.equal(result.packageProfile.totalWeight, 25000.01);
  assert.equal(result.recommendation.mode, "delivery");
  assert.equal(result.recommendation.amount, 50);
});
