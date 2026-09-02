"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MINIMUM_SHIPPING,
  applyShippingMinimumToRates,
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
    minimumGroundAmount: 9.95,
    reducedGroundAmount: 9.95,
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
  assert.equal(enabled.minimumGroundAmount, 9.95);
  assert.equal(DEFAULT_MINIMUM_SHIPPING, 9.95);
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
    customerShipping: 9.95,
    packageCount: 2,
    policy: policy()
  });

  assert.ok(Math.abs(economics.processingFees - 3.2985) < 1e-12);
  assert.equal(economics.fulfillmentCost, 5);
});

test("subsidizes Ground only down to the $9.95 floor", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 100, averageCost: 45 }],
    groundCost: 14,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "reduced");
  assert.equal(decision.customerGroundAmount, 9.95);
  assert.equal(decision.subsidyAmount, 4.05);
});

test("keeps the Turtlebox subsidy above the shipping floor", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 430, averageCost: 305.7768 }],
    groundCost: 17.96,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "reduced");
  assert.equal(decision.customerGroundAmount, 9.95);
  assert.equal(decision.economics.contribution, 88.849164);
  assert.ok(decision.economics.margin > 0.18);
});

test("uses the $9.95 tier when it protects the required margin", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 100, averageCost: 61.1 }],
    groundCost: 15,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "reduced");
  assert.equal(decision.customerGroundAmount, 9.95);
  assert.ok(decision.economics.margin >= 0.15);
});

test("charges the $9.95 minimum when the carrier Ground rate is lower", () => {
  const decision = evaluateShippingOffer({
    lines: [{ quantity: 1, price: 30, averageCost: 25 }],
    groundCost: 4.5,
    packageCount: 1,
    policy: policy()
  });

  assert.equal(decision.mode, "minimum");
  assert.equal(decision.customerGroundAmount, 9.95);
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
    customerGroundAmount: 9.95,
    groundCost: 15,
    subsidyAmount: 5.05
  });

  assert.equal(result.rates[0].amount, 9.95);
  assert.equal(result.rates[1].amount, 45);
  assert.equal(result.shippingOffer.subsidyAmount, 5.05);
});

test("the final rate safeguard raises discounted and sub-floor charges to $9.95", () => {
  const result = applyShippingMinimumToRates({
    rates: [
      { serviceCode: "03", amount: 0, originalAmount: 18 },
      { serviceCode: "02", amount: 7 }
    ]
  });

  assert.deepEqual(result.rates.map((rate) => rate.amount), [9.95, 9.95]);
});
