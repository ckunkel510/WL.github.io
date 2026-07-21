"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findShippingOffer,
  resetMemoryOffers,
  storeShippingOffer
} = require("../api/shipping-offer-sessions");

test.beforeEach(() => resetMemoryOffers());

function offer(overrides = {}) {
  return {
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "96801" },
    productWeight: 10,
    packages: [
      { weight: 5.5, length: 8, width: 8, height: 8 },
      { weight: 5.5, length: 8, width: 8, height: 8 }
    ],
    basis: { merchandiseRevenue: 100, rawCogs: 50, packageCount: 2 },
    policy: { configured: true, marginFloor: 0.15 },
    decision: { mode: "reduced", customerGroundAmount: 6.95 },
    ...overrides
  };
}

test("finds a short-lived offer by origin, destination, and product weight", async () => {
  const stored = await storeShippingOffer(offer());
  const found = await findShippingOffer({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "96801-0001" },
    packages: [{ weight: 10 }]
  });

  assert.equal(stored.ok, true);
  assert.equal(found.decision.customerGroundAmount, 6.95);
  assert.equal(found.packages.length, 2);
});

test("does not reuse an offer for another destination", async () => {
  await storeShippingOffer(offer());
  const found = await findShippingOffer({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 10 }]
  });

  assert.equal(found, null);
});

test("does not reuse an offer when the cart weight changes materially", async () => {
  await storeShippingOffer(offer());
  const found = await findShippingOffer({
    shipFrom: { postalCode: "77833" },
    shipTo: { postalCode: "96801" },
    packages: [{ weight: 15 }]
  });

  assert.equal(found, null);
});
