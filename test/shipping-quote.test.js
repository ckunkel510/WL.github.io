"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAutomaticShippingQuote, shippingEligibilityIssues } = require("../api/shipping-quote");

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

function catalog(averageCost = 45) {
  return {
    active: { id: "snapshot-20260721" },
    fresh: true,
    products: [{
      productId: "100",
      productCode: "CASE-100",
      brand: "Case",
      price: 100,
      averageCost,
      weight: 2,
      length: 6,
      width: 2,
      height: 1
    }]
  };
}

function rateService(body) {
  const groundAmount = body.shipTo.postalCode === "96801" ? 45 : 10;
  return Promise.resolve({
    quoteId: `quote-${body.shipTo.postalCode}`,
    expiresAt: "2026-07-21T20:00:00.000Z",
    rates: [
      { serviceCode: "03", serviceName: "UPS Ground", amount: groundAmount, currency: "USD" },
      { serviceCode: "02", serviceName: "UPS 2nd Day Air", amount: groundAmount + 30, currency: "USD" }
    ]
  });
}

function quote(postalCode, averageCost = 45) {
  return buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode },
    cart: [{ productId: "100", quantity: 1 }]
  }, {
    requestRates: rateService,
    getCatalogProducts: async () => catalog(averageCost),
    policy: policy()
  });
}

test("uses the true destination-specific UPS Ground cost for the subsidy", async () => {
  const local = await quote("78701");
  const hawaii = await quote("96801");

  assert.equal(local.result.shippingOffer.mode, "reduced");
  assert.equal(local.result.rates[0].amount, 9.95);
  assert.equal(hawaii.result.shippingOffer.mode, "regular");
  assert.equal(hawaii.result.rates[0].amount, 45);
});

test("builds the claim from trusted catalog revenue and cost instead of browser values", async () => {
  const result = await buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "78701" },
    cart: [{ productId: "100", quantity: 2, price: 9999, averageCost: 1 }]
  }, {
    requestRates: rateService,
    getCatalogProducts: async () => catalog(45),
    policy: policy()
  });

  assert.equal(result.claim.basis.merchandiseRevenue, 200);
  assert.equal(result.claim.basis.rawCogs, 90);
  assert.equal(result.claim.productWeight, 4);
  assert.ok(result.claim.packages.length >= 1);
});

test("uses the $9.95 Ground tier only when it restores the protected margin", async () => {
  const result = await quote("78701", 67);

  assert.equal(result.result.shippingOffer.mode, "reduced");
  assert.equal(result.result.rates[0].amount, 9.95);
});

test("marks a full-Ground order for internal product-margin review", async () => {
  const result = await quote("78701", 90);

  assert.equal(result.result.shippingOffer.mode, "regular");
  assert.equal(result.claim.decision.reviewRequired, true);
  assert.equal(result.claim.basis.productRefs[0].productId, "100");
  assert.ok(result.claim.decision.protectedMargin < 0.15);
});

test("fails closed when the trusted catalog is stale", async () => {
  await assert.rejects(() => buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "78701" },
    cart: [{ productId: "100", quantity: 1 }]
  }, {
    requestRates: rateService,
    getCatalogProducts: async () => ({ fresh: false, products: [] }),
    policy: policy()
  }), (error) => {
    assert.equal(error.code, "shipping-items-unavailable");
    assert.equal(error.shippingIssues[0].productId, "100");
    assert.equal(error.shippingIssues[0].reason, "missing-product-data");
    return true;
  });
});

test("identifies the exact item when trusted package data is incomplete", async () => {
  const incomplete = catalog(45);
  incomplete.products[0].length = null;

  await assert.rejects(() => buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "23220" },
    cart: [{ productId: "100", productCode: "CASE-100", quantity: 1 }]
  }, {
    requestRates: rateService,
    getCatalogProducts: async () => incomplete,
    policy: policy()
  }), (error) => {
    assert.equal(error.code, "shipping-items-unavailable");
    assert.equal(error.shippingIssues[0].productCode, "CASE-100");
    assert.deepEqual(error.shippingIssues[0].missingFields, ["length"]);
    return true;
  });
});

test("holds HOGRBP636 for manual review until its contradictory package data is corrected", () => {
  const product = catalog(45).products[0];
  product.productId = "187017";
  product.productCode = "HOGRBP636";
  product.weight = 1.15;
  product.length = 5.16;
  product.width = 23.19;
  product.height = 13.46;

  const issues = shippingEligibilityIssues(
    [{ productId: "187017", productCode: "HOGRBP636", quantity: 1 }],
    [product],
    {}
  );
  assert.equal(issues[0].reason, "package-data-review");
  assert.match(issues[0].message, /HOGRBP636 cannot be shipped/);
});

test("includes non-Case brands in the automatic all-products scope", async () => {
  const nonCase = catalog(45);
  nonCase.products[0].brand = "Other Brand";
  const result = await buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "78701" },
    cart: [{ productId: "100", quantity: 1 }]
  }, {
    requestRates: rateService,
    getCatalogProducts: async () => nonCase,
    policy: policy({ offerMode: "case-pilot" })
  });

  assert.equal(result.result.shippingOffer.mode, "reduced");
  assert.equal(result.claim.policy.offerMode, "all");
});

test("builds a trusted package plan while customer offers are disabled", async () => {
  const seenPackages = [];
  const result = await buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "78701" },
    cart: [{ productId: "100", quantity: 1 }]
  }, {
    requestRates: async (body) => {
      seenPackages.push(...body.packages);
      return rateService(body);
    },
    getCatalogProducts: async () => catalog(45),
    policy: policy({ configured: false, enabled: false })
  });

  assert.ok(seenPackages.length >= 1);
  assert.equal(result.result.rates[0].amount, 10);
  assert.equal(result.result.shippingOffer.applied, false);
  assert.equal(result.result.shippingOffer.mode, "regular");
});

test("rates product 10496 after valid custom cuts and adds the non-refundable packaging charge", async () => {
  const cutCatalog = catalog(4.5);
  Object.assign(cutCatalog.products[0], {
    productId: "10496",
    productCode: "HM38V",
    price: 9.19,
    averageCost: 4.5,
    weight: 2.4,
    length: 144,
    width: 1,
    height: 0.375
  });
  const seenPackages = [];
  const result = await buildAutomaticShippingQuote({
    shipFrom: { postalCode: "77836" },
    shipTo: { postalCode: "60601" },
    cart: [{
      productId: "10496",
      productCode: "HM38V",
      quantity: 1,
      cutToShip: {
        optionId: "custom-boxable-cuts",
        cutLengthsIn: [48, 48, 24, 24],
        acknowledgedNonRefundable: true
      }
    }]
  }, {
    requestRates: async (body) => {
      seenPackages.push(...body.packages);
      return {
        rates: [
          { serviceCode: "03", serviceName: "UPS Ground", amount: 20, currency: "USD" },
          { serviceCode: "02", serviceName: "UPS 2nd Day Air", amount: 40, currency: "USD" }
        ]
      };
    },
    getCatalogProducts: async () => cutCatalog,
    policy: policy({ configured: false, enabled: false })
  });

  assert.ok(seenPackages.length >= 1);
  assert.ok(seenPackages.every((item) => {
    const dimensions = [item.length, item.width, item.height].sort((left, right) => right - left);
    return dimensions[0] <= 108 && dimensions[0] + (2 * dimensions[1]) + (2 * dimensions[2]) <= 165;
  }));
  assert.equal(result.claim.productWeight, 2.4);
  assert.equal(result.result.rates[0].amount, 30);
  assert.equal(result.result.cutToShip.addedCharge, 10);
  assert.equal(result.result.cutToShip.nonRefundable, true);
  assert.equal(result.result.cutToShip.customParcelEligible, true);
  assert.equal(result.claim.cutToShip.selections[0].productId, "10496");
  assert.equal(result.claim.cutToShip.selections[0].cutSummary, "2 × 48 in., 2 × 24 in.");
});
