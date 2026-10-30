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

const route = { shipFrom: { postalCode: '77833' }, shipTo: { postalCode: '77834' }, totalWeight: 12 };
function quote(deliveryAmount = 25) {
  const ship = [{ serviceCode: '03', serviceName: 'UPS Ground', amount: 11.33 }];
  const delivery = deliveryAmount ? [{ serviceCode: '03', serviceName: 'Woodson Local Delivery', amount: deliveryAmount }] : [];
  return { ...route, recommendation: { mode: 'ship', amount: 11.33 }, rates: ship, availableRates: { ship, delivery } };
}

test('a late automatic recommendation cannot replace the reserved delivery or UPS choice', async () => {
  for (const mode of ['delivery', 'ship']) {
    resetMemoryClaims();
    await storeFulfillmentClaim(quote());
    await selectFulfillmentClaim({ ...route, mode });
    // Models an older cart/iframe request completing after selection.
    const late = quote();
    if (mode === 'ship') { late.recommendation = { mode: 'delivery', amount: 25 }; late.rates = late.availableRates.delivery; }
    await storeFulfillmentClaim(late);
    const native = await findFulfillmentClaim(route);
    assert.equal(native.recommendation.mode, mode);
    assert.equal(native.rates[0].amount, mode === 'ship' ? 11.33 : 25);
  }
});

test('a refreshed quote updates the selected mode price and cannot restore an unavailable mode', async () => {
  await storeFulfillmentClaim(quote());
  await selectFulfillmentClaim({ ...route, mode: 'delivery' });
  await storeFulfillmentClaim(quote(30));
  assert.equal((await findFulfillmentClaim(route)).rates[0].amount, 30);
  await storeFulfillmentClaim(quote(0));
  assert.equal(await findFulfillmentClaim(route), null);
  assert.equal((await selectFulfillmentClaim({ ...route, mode: 'ship' })).ok, true);
  assert.equal((await findFulfillmentClaim(route)).recommendation.mode, 'ship');
});

test('reserved choices retain route, weight and expiry boundaries', async () => {
  const clock = Date.now; let now = clock(); Date.now = () => now;
  try {
    await storeFulfillmentClaim(quote());
    await selectFulfillmentClaim({ ...route, mode: 'delivery' });
    assert.equal(await findFulfillmentClaim({ ...route, shipTo: { postalCode: '77836' } }), null);
    assert.equal(await findFulfillmentClaim({ ...route, totalWeight: 120 }), null);
    now += 15 * 60 * 1000 + 1;
    assert.equal(await findFulfillmentClaim(route), null);
  } finally { Date.now = clock; }
});

test('a postal-only cart estimate cannot revoke a complete-address delivery reservation', async () => {
  const complete = { ...route, shipTo: { postalCode: '77834', state: 'TX', city: 'Brenham', addressLine: ['123 Test St'] } };
  await storeFulfillmentClaim({ ...quote(), ...complete });
  await selectFulfillmentClaim({ ...complete, mode: 'delivery' });
  await storeFulfillmentClaim(quote(0));
  assert.equal((await findFulfillmentClaim(route)).recommendation.mode, 'delivery');
  assert.equal((await findFulfillmentClaim(route)).rates[0].amount, 25);
});

test('handoff diagnostics expose only recognized public origin store labels', () => {
  const { publicOriginBranch } = require('../api/fulfillment-sessions');
  assert.equal(publicOriginBranch({shipFrom:{postalCode:'77801'}}),'bryan');
  assert.equal(publicOriginBranch({shipFrom:{postalCode:'77833'}}),'brenham');
  assert.equal(publicOriginBranch({shipFrom:{postalCode:'90210',addressLine:['private customer address']}}),'unmapped');
  assert.equal(publicOriginBranch({shipTo:{postalCode:'77833'}}),'unmapped');
});
