"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findFulfillmentClaim,
  resetMemoryClaims,
  selectFulfillmentClaim,
  storeFulfillmentClaim
} = require("../api/fulfillment-sessions");

test.beforeEach(() => resetMemoryClaims());

test("stores the selected fulfillment result for the legacy rate bridge", async () => {
  const stored = await storeFulfillmentClaim({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "77834" },
    totalWeight: 12,
    recommendation: { mode: "delivery", amount: 25 },
    rates: [{ serviceCode: "03", serviceName: "Woodson Local Delivery", amount: 25, currency: "USD" }]
  });
  const found = await findFulfillmentClaim({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "77834" },
    packages: [{ weight: 12 }]
  });
  assert.equal(stored.ok, true);
  assert.equal(found.recommendation.mode, "delivery");
  assert.equal(found.rates[0].amount, 25);
});

test("refuses zero and negative fulfillment claims", async () => {
  const stored = await storeFulfillmentClaim({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "77834" },
    totalWeight: 12,
    recommendation: { mode: "delivery", amount: 0 },
    rates: [{ serviceCode: "03", serviceName: "Woodson Local Delivery", amount: 0 }]
  });
  assert.equal(stored.ok, false);
  assert.equal(stored.reason, "incomplete-claim");
});

test("replaces the recommendation with the customer's valid alternate choice", async () => {
  const route = {
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "77834" },
    totalWeight: 12
  };
  await storeFulfillmentClaim({
    ...route,
    recommendation: { mode: "ship", amount: 28 },
    rates: [{ serviceCode: "03", serviceName: "UPS Ground", amount: 28 }],
    availableRates: {
      ship: [{ serviceCode: "03", serviceName: "UPS Ground", amount: 28 }],
      delivery: [{ serviceCode: "03", serviceName: "Woodson Local Delivery", amount: 25 }]
    }
  });
  const selected = await selectFulfillmentClaim({ ...route, mode: "delivery" });
  const found = await findFulfillmentClaim({ ...route, packages: [{ weight: 12 }] });
  assert.equal(selected.ok, true);
  assert.equal(selected.recommendation.mode, "delivery");
  assert.equal(found.rates[0].serviceName, "Woodson Local Delivery");
  assert.equal(found.rates[0].amount, 25);
});
