"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFulfillmentQuote,
  isEasyParcel,
  offeredRates,
  recommendFulfillment
} = require("../api/fulfillment-quote")._test;

const policy = {
  enabled: false,
  marginFloor: 0.15,
  cardFeeRate: 0.03,
  cogsBufferRate: 0.02,
  contingencyRate: 0.01,
  minimumGroundAmount: 9.95,
  reducedGroundAmount: 9.95,
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

test("prefers UPS when it is the lower-cost home fulfillment option", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 20 },
    delivery: { available: true, amount: 25 }
  });
  assert.equal(result.mode, "ship");
  assert.equal(result.reason, "lowest-cost-home-fulfillment");
});

test("prefers Woodson when local delivery is the lower-cost home fulfillment option", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 28 },
    delivery: { available: true, amount: 25 }
  });
  assert.equal(result.mode, "delivery");
  assert.equal(result.reason, "lowest-cost-home-fulfillment");
});

test("uses Woodson delivery as the deterministic equal-price tie-breaker", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 25 },
    delivery: { available: true, amount: 25 }
  });
  assert.equal(result.mode, "delivery");
  assert.equal(result.reason, "equal-cost-local-delivery");
});

test("offers a positive UPS rate when local delivery is unavailable", () => {
  const result = recommendFulfillment({
    ups: { available: true, amount: 308.19 },
    delivery: { available: false, reason: "outside-delivery-area" }
  });
  assert.equal(result.mode, "ship");
  assert.equal(result.reason, "ups-only");
});

test("identifies the conservative easy-parcel threshold", () => {
  assert.equal(isEasyParcel([{ weight: 50, length: 48, width: 12, height: 12 }]), true);
  assert.equal(isEasyParcel([{ weight: 51, length: 12, width: 8, height: 6 }]), false);
  assert.equal(isEasyParcel([{ weight: 8 }]), false);
});

test("stores both rates and recommends the cheaper Woodson delivery option", async () => {
  let stored = null;
  const result = await buildFulfillmentQuote(baseBody(), {
    requestRates: upsRate(28),
    getCatalogProducts: async () => catalog(),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: true, mode: "delivery", amount: 25, currency: "USD", serviceCode: "03", serviceName: "Woodson Local Delivery", billingWeight: 8 }),
    storeFulfillmentClaim: async (claim) => { stored = claim; return { ok: true }; }
  });
  assert.equal(result.recommendation.mode, "delivery");
  assert.equal(result.options.ups.amount, 28);
  assert.equal(stored.recommendation.mode, "delivery");
  assert.ok(stored.rates.every((rate) => rate.amount > 0));
  assert.equal(stored.availableRates.ship[0].amount, 28);
  assert.equal(stored.availableRates.delivery[0].amount, 25);
});

test("offers the carrier-rated 55-pound 30GFU roll alongside local delivery", async () => {
  let ratedPackages = null;
  let stored = null;
  const result = await buildFulfillmentQuote(baseBody(), {
    requestRates: async (input) => {
      ratedPackages = input.packages;
      return upsRate(32)();
    },
    getCatalogProducts: async () => catalog({ weight: 55, length: 30, width: 6, height: 6 }),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: true, mode: "delivery", amount: 25, currency: "USD", serviceCode: "03", serviceName: "Woodson Local Delivery", billingWeight: 55 }),
    storeFulfillmentClaim: async (claim) => { stored = claim; return { ok: true }; }
  });

  assert.deepEqual(ratedPackages, [{ weight: 55.5, length: 31, width: 7, height: 7 }]);
  assert.equal(result.packageProfile.easyParcel, false);
  assert.equal(result.options.ups.available, true);
  assert.equal(result.options.ups.amount, 32);
  assert.equal(result.options.delivery.available, true);
  assert.equal(result.recommendation.mode, "delivery");
  assert.equal(stored.availableRates.ship[0].amount, 32);
  assert.equal(stored.availableRates.delivery[0].amount, 25);
});

test("keeps the protected $9.95 customer offer instead of restoring the raw UPS rate", () => {
  const rates = offeredRates({
    result: {
      rates: [
        { serviceCode: "03", serviceName: "UPS Ground", amount: 9.95, originalAmount: 28, currency: "USD" },
        { serviceCode: "02", serviceName: "UPS 2nd Day Air", amount: 48, currency: "USD" }
      ]
    },
    claim: { decision: { groundCost: 28 } }
  });

  assert.equal(rates[0].amount, 9.95);
  assert.equal(rates[0].originalAmount, 28);
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

test("offers a carrier-rated 8-foot board when UPS returns a positive rate", async () => {
  const result = await buildFulfillmentQuote(baseBody(), {
    requestRates: upsRate(308.19),
    getCatalogProducts: async () => catalog({ weight: 10.67, length: 96, width: 4, height: 2 }),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-delivery-area" }),
    storeFulfillmentClaim: async () => ({ ok: true })
  });
  assert.equal(result.options.ups.available, true);
  assert.equal(result.options.ups.amount, 308.19);
  assert.equal(result.packageProfile.easyParcel, false);
  assert.equal(result.recommendation.mode, "ship");
  assert.equal(result.recommendation.amount, 308.19);
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

test("does not let browser package guesses bypass missing trusted item dimensions", async () => {
  const body = baseBody();
  body.shipTo = { city: "Richmond", state: "VA", postalCode: "23220" };
  body.packages = [{ weight: 8, length: 12, width: 8, height: 6 }];
  const incomplete = catalog();
  incomplete.products[0].width = null;
  let rateCalls = 0;

  const result = await buildFulfillmentQuote(body, {
    getCatalogProducts: async () => incomplete,
    requestRates: async () => {
      rateCalls += 1;
      return upsRate(20)();
    },
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-texas" }),
    storeFulfillmentClaim: async () => ({ ok: false })
  });

  assert.equal(rateCalls, 0);
  assert.equal(result.options.ups.available, false);
  assert.equal(result.options.ups.reason, "shipping-items-unavailable");
  assert.equal(result.options.ups.issues[0].productCode, "ITEM-100");
  assert.deepEqual(result.options.ups.issues[0].missingFields, ["width"]);
  assert.equal(result.recommendation.mode, "manual");
});

test("holds HOGRBP636 out of a Virginia UPS checkout until its dimensions are verified", async () => {
  const body = baseBody();
  body.shipTo = { city: "Richmond", state: "VA", postalCode: "23220" };
  body.cart = [{ productId: "187017", productCode: "HOGRBP636", quantity: 1 }];
  const hogr = catalog();
  Object.assign(hogr.products[0], {
    productId: "187017",
    productCode: "HOGRBP636",
    weight: 1.15,
    length: 5.16,
    width: 23.19,
    height: 13.46
  });
  let rateCalls = 0;

  const result = await buildFulfillmentQuote(body, {
    getCatalogProducts: async () => hogr,
    requestRates: async () => { rateCalls += 1; return upsRate(25.86)(); },
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-texas" }),
    storeFulfillmentClaim: async () => ({ ok: false })
  });

  assert.equal(rateCalls, 0);
  assert.equal(result.options.ups.available, false);
  assert.equal(result.options.ups.reason, "shipping-items-unavailable");
  assert.equal(result.options.ups.issues[0].productCode, "HOGRBP636");
  assert.equal(result.options.ups.issues[0].reason, "package-data-review");
  assert.equal(result.recommendation.mode, "manual");
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

test("offers the configured custom-cut option when product 10496 is otherwise too long for UPS", async () => {
  const body = baseBody();
  body.shipTo = { city: "Chicago", state: "IL", postalCode: "60601" };
  body.cart = [{ productId: "10496", productCode: "HM38V", quantity: 1 }];
  const longItem = catalog({ weight: 2.4, length: 144, width: 1, height: 0.375 });
  longItem.products[0].productId = "10496";
  longItem.products[0].productCode = "HM38V";

  const result = await buildFulfillmentQuote(body, {
    getCatalogProducts: async () => longItem,
    requestRates: upsRate(20),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-texas" }),
    storeFulfillmentClaim: async () => ({ ok: false })
  });

  assert.equal(result.options.ups.available, false);
  assert.equal(result.shippingIssues[0].reason, "cut-option-available");
  assert.equal(result.cutToShip.availableOptions[0].selected, false);
});

test("returns an easy UPS parcel and non-refundable fee after product 10496 receives valid custom cuts", async () => {
  const body = baseBody();
  body.shipTo = { city: "Chicago", state: "IL", postalCode: "60601" };
  body.cart = [{
    productId: "10496",
    productCode: "HM38V",
    quantity: 1,
    cutToShip: {
      optionId: "custom-boxable-cuts",
      cutLengthsIn: [48, 48, 24, 24],
      acknowledgedNonRefundable: true
    }
  }];
  const longItem = catalog({ weight: 2.4, length: 144, width: 1, height: 0.375 });
  longItem.products[0].productId = "10496";
  longItem.products[0].productCode = "HM38V";
  let stored = null;

  const result = await buildFulfillmentQuote(body, {
    getCatalogProducts: async () => longItem,
    requestRates: upsRate(20),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-texas" }),
    storeFulfillmentClaim: async (claim) => { stored = claim; return { ok: true }; }
  });

  assert.equal(result.options.ups.available, true);
  assert.equal(result.options.ups.amount, 30);
  assert.equal(result.packageProfile.easyParcel, false);
  assert.equal(result.packageProfile.customCutParcel, true);
  assert.equal(result.cutToShip.applied, true);
  assert.equal(result.cutToShip.addedCharge, 10);
  assert.equal(result.cutToShip.specialOrder, true);
  assert.equal(result.cutToShip.nonRefundable, true);
  assert.equal(stored.rates[0].amount, 30);
  assert.equal(stored.cutToShip.selections[0].cutSummary, "2 × 48 in., 2 × 24 in.");
});

test("offers a carrier-rated mixed custom-cut cart without using profile labels as a veto", async () => {
  const body = baseBody();
  body.shipTo = { city: "Chicago", state: "IL", postalCode: "60601" };
  body.cart = [{
    productId: "10496",
    productCode: "HM38V",
    quantity: 1,
    cutToShip: {
      optionId: "custom-boxable-cuts",
      cutLengthsIn: [72, 72],
      acknowledgedNonRefundable: true
    }
  }, {
    productId: "200",
    productCode: "UNCUT-96",
    quantity: 1
  }];
  const mixedCatalog = {
    active: { id: "catalog-test" },
    fresh: true,
    products: [{
      productId: "10496",
      productCode: "HM38V",
      price: 9.19,
      averageCost: 4.5,
      weight: 2.4,
      length: 144,
      width: 1,
      height: 0.375
    }, {
      productId: "200",
      productCode: "UNCUT-96",
      price: 20,
      averageCost: 10,
      weight: 8,
      length: 96,
      width: 2,
      height: 2
    }]
  };

  const result = await buildFulfillmentQuote(body, {
    getCatalogProducts: async () => mixedCatalog,
    requestRates: upsRate(30),
    shippingPolicy: policy,
    quoteWoodsonDelivery: async () => ({ available: false, reason: "outside-texas" }),
    storeFulfillmentClaim: async () => ({ ok: false })
  });

  assert.equal(result.cutToShip.applied, true);
  assert.equal(result.cutToShip.customParcelEligible, false);
  assert.equal(result.options.ups.available, true);
  assert.equal(result.packageProfile.easyParcel, false);
  assert.equal(result.recommendation.mode, "ship");
});
