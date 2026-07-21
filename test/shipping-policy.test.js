"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyShippingOfferToRates,
  evaluateShippingOffer,
  orderEconomics,
  policyFromEnv
} = require("../api/shipping-policy");

function policy(overrides = {}) {
  return {
    marginFloor: 0.15,
    cardFeeRate: 0.03,
    cogsBufferRate: 0.02,
    contingencyRate: 0.01,
    reducedGroundAmount: 6.95,
    packagingCostPerPackage: 1.25,
    handlingCostPerOrder: 2.5,
    configured: true,
    ...overrides
  };
}

test("requires explicit packaging and handling costs before granting a subsidy", () => {
  const settings = policyFromEnv({});
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 100, averageCost: 40 }],
    groundCost: 15,
    packageCount: 1,
    policy: settings
  });

  assert.equal(settings.configured, false);
  assert.equal(decision.mode, "regular");
  assert.equal(decision.customerGroundAmount, 15);
});

test("requires an explicit live activation flag even when operating costs are configured", () => {
  const disabled = policyFromEnv({
    SHIPPING_PACKAGING_COST_PER_PACKAGE: "1.25",
    SHIPPING_HANDLING_COST_PER_ORDER: "2.50"
  });
  const enabled = policyFromEnv({
    SHIPPING_OFFER_ENABLED: "true",
    SHIPPING_PACKAGING_COST_PER_PACKAGE: "1.25",
    SHIPPING_HANDLING_COST_PER_ORDER: "2.50"
  });

  assert.equal(disabled.configured, false);
  assert.equal(enabled.configured, true);
});

test("keeps every qualified product in the all-products offer scope", () => {
  const settings = policyFromEnv({
    SHIPPING_OFFER_MODE: "case-pilot",
    SHIPPING_OFFER_ENABLED: "true",
    SHIPPING_PACKAGING_COST_PER_PACKAGE: "1.25",
    SHIPPING_HANDLING_COST_PER_ORDER: "2.50"
  });

  assert.equal(settings.offerMode, "all");
});

test("includes the card fee on customer-paid shipping", () => {
  const economics = orderEconomics({
    lines: [{ quantity: 1, price: 100, averageCost: 60 }],
    groundCost: 20,
    customerShipping: 6.95,
    packageCount: 2,
    policy: policy()
  });

  assert.equal(economics.processingFees, 3.2085);
  assert.equal(economics.fulfillmentCost, 5);
});

test("grants free Ground when the protected margin remains at least fifteen percent", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 100, averageCost: 45 }],
    groundCost: 14,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "free");
  assert.equal(decision.customerGroundAmount, 0);
  assert.equal(decision.subsidyAmount, 14);
});

test("grants the Turtlebox cart free Ground under the protected-margin rules", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 430, averageCost: 305.7768 }],
    groundCost: 17.96,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "free");
  assert.equal(decision.customerGroundAmount, 0);
  assert.equal(decision.economics.contribution, 79.197664);
  assert.ok(decision.economics.margin > 0.18);
});

test("uses the $6.95 tier when free Ground misses the protected margin", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 100, averageCost: 61.1 }],
    groundCost: 15,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "reduced");
  assert.equal(decision.customerGroundAmount, 6.95);
  assert.ok(decision.economics.margin >= 0.15);
});

test("never charges $6.95 when the real Ground rate is lower", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 30, averageCost: 25 }],
    groundCost: 4.5,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "regular");
  assert.equal(decision.customerGroundAmount, 4.5);
});

test("charges regular Ground and flags review when even full Ground is below the floor", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 100, averageCost: 90 }],
    groundCost: 18,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "regular");
  assert.equal(decision.customerGroundAmount, 18);
  assert.equal(decision.reviewRequired, true);
});

test("keeps the automatic offer limited to Ground", () => {
  const result = applyShippingOfferToRates({
    rates: [
      { serviceCode: "03", serviceName: "UPS Ground", amount: 15 },
      { serviceCode: "02", serviceName: "UPS 2nd Day Air", amount: 45 }
    ]
  }, {
    mode: "reduced",
    customerGroundAmount: 6.95,
    groundCost: 15,
    subsidyAmount: 8.05
  });

  assert.equal(result.rates[0].amount, 6.95);
  assert.equal(result.rates[1].amount, 45);
  assert.equal(result.shippingOffer.subsidyAmount, 8.05);
});
