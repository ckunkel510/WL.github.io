"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyCutToShipCharge,
  applyCutToShipSelections,
  availableCutToShipOptions,
  ruleForItem
} = require("../api/cut-to-ship");

function trustedLine(overrides = {}) {
  return {
    productId: "10496",
    productCode: "HM38V",
    quantity: 1,
    price: 9.19,
    averageCost: 4.5,
    weight: 2.4,
    length: 144,
    width: 1,
    height: 0.375,
    ...overrides
  };
}

function customCuts(cutLengthsIn, overrides = {}) {
  return {
    optionId: "custom-boxable-cuts",
    cutLengthsIn,
    acknowledgedNonRefundable: true,
    ...overrides
  };
}

test("keeps product 10496 in a reusable server-side custom-cut list", () => {
  const rule = ruleForItem({ productId: "10496" });
  assert.equal(rule.productCode, "HM38V");
  assert.equal(rule.optionId, "custom-boxable-cuts");
  assert.equal(rule.stockLengthIn, 144);
  assert.equal(rule.cutAndPackagingFeePerUnit, 10);
  assert.equal(rule.nonRefundable, true);
  assert.equal(availableCutToShipOptions([{ productId: "10496" }])[0].selected, false);
});

test("packs several custom finished lengths and preserves trusted total weight", () => {
  const line = trustedLine({ quantity: 2 });
  const result = applyCutToShipSelections(
    [line],
    [{ productId: "10496", productCode: "HM38V", quantity: 2, cutToShip: customCuts([48, 48, 24, 24]) }]
  );

  assert.equal(result.packingLines.length, 2);
  assert.deepEqual(result.packingLines.map((piece) => [piece.length, piece.quantity]), [[48, 4], [24, 4]]);
  assert.equal(result.packingLines.reduce((sum, piece) => sum + piece.quantity * piece.weight, 0), 4.8);
  assert.equal(result.addedCharge, 20);
  assert.equal(result.selections[0].originalQuantity, 2);
  assert.equal(result.selections[0].cutSummary, "2 × 48 in., 2 × 24 in.");
  assert.equal(result.selections[0].specialOrder, true);
  assert.equal(result.selections[0].nonRefundable, true);
});

test("accepts twelve exact one-foot pieces without assuming cut loss", () => {
  const result = applyCutToShipSelections(
    [trustedLine()],
    [{ productId: "10496", cutToShip: customCuts(Array(12).fill(12)) }]
  );

  assert.equal(result.packingLines[0].quantity, 12);
  assert.equal(result.packingLines[0].length, 12);
  assert.equal(result.packingLines[0].quantity * result.packingLines[0].weight, 2.4);
});

test("rejects custom lengths that do not allocate the full stock length", () => {
  assert.throws(() => applyCutToShipSelections(
    [trustedLine()],
    [{ productId: "10496", cutToShip: customCuts([48, 48, 24]) }]
  ), (error) => {
    assert.equal(error.code, "invalid-cut-to-ship-selection");
    assert.equal(error.shippingIssues[0].reason, "cut-length-total-mismatch");
    assert.match(error.shippingIssues[0].message, /total 144 inches with no cut loss/i);
    return true;
  });
});

test("requires acceptance of non-refundable special-order terms", () => {
  assert.throws(() => applyCutToShipSelections(
    [trustedLine()],
    [{ productId: "10496", cutToShip: customCuts([72, 72], { acknowledgedNonRefundable: false }) }]
  ), (error) => {
    assert.equal(error.shippingIssues[0].reason, "cut-terms-required");
    return true;
  });
});

test("does not trust an ineligible browser custom-cut selection", () => {
  assert.throws(() => applyCutToShipSelections(
    [{ ...trustedLine(), productId: "99999", productCode: "OTHER" }],
    [{ productId: "99999", productCode: "OTHER", quantity: 1, cutToShip: customCuts([72, 72]) }]
  ), (error) => {
    assert.equal(error.code, "invalid-cut-to-ship-selection");
    assert.equal(error.shippingIssues[0].reason, "invalid-cut-option");
    return true;
  });
});

test("requires the trusted catalog weight before rating a custom shipment", () => {
  assert.throws(() => applyCutToShipSelections(
    [trustedLine({ weight: null })],
    [{ productId: "10496", productCode: "HM38V", quantity: 1, cutToShip: customCuts([72, 72]) }]
  ), (error) => {
    assert.equal(error.shippingIssues[0].reason, "cut-option-missing-package-data");
    assert.match(error.shippingIssues[0].message, /trusted weight and dimensions/i);
    return true;
  });
});

test("adds the non-refundable custom-cut fee to every UPS service returned to WebTrack", () => {
  const result = applyCutToShipCharge({
    rates: [
      { serviceCode: "03", serviceName: "UPS Ground", amount: 18.25 },
      { serviceCode: "02", serviceName: "UPS 2nd Day Air", amount: 42.5 }
    ],
    shippingOffer: { customerGroundAmount: 18.25 }
  }, {
    addedCharge: 10,
    customParcelEligible: true,
    selections: [{ productId: "10496" }]
  });

  assert.equal(result.rates[0].amount, 28.25);
  assert.equal(result.rates[1].amount, 52.5);
  assert.equal(result.shippingOffer.customerGroundAmount, 28.25);
  assert.equal(result.shippingOffer.cutAndPackagingCharge, 10);
  assert.equal(result.shippingOffer.cutAndPackagingNonRefundable, true);
  assert.equal(result.cutToShip.addedCharge, 10);
  assert.equal(result.cutToShip.specialOrder, true);
  assert.equal(result.cutToShip.nonRefundable, true);
  assert.equal(result.cutToShip.customParcelEligible, true);
});
