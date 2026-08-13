"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../data/woodson-delivery-rules.json");
const {
  branchCodeForOrigin,
  geocodeAddress,
  pointInPolygon,
  quoteAtCoordinates,
  rateForWeight,
  resetGeocodeCache
} = require("../api/woodson-delivery");

test.beforeEach(() => resetGeocodeCache());

test("ships only the 684 positive Bistrack rules and all 76 delivery polygons", () => {
  const rates = rules.areas.flatMap((area) => area.rates);
  assert.equal(rules.areas.length, 76);
  assert.equal(rates.length, 684);
  assert.ok(rates.every((rate) => rate.amount > 0));
  assert.equal(rules.safeguards.negativeRulesIncluded, false);
  assert.equal(rules.safeguards.zeroRulesIncluded, false);
});

test("identifies the selected Woodson branch from its origin ZIP", () => {
  assert.equal(branchCodeForOrigin({ postalCode: "77833" }), "01");
  assert.equal(branchCodeForOrigin({ postalCode: "76667" }), "06");
  assert.equal(branchCodeForOrigin({ city: "Buffalo" }), "07");
});

test("treats a polygon edge as inside the delivery area", () => {
  const polygon = rules.areas[0].polygons[0];
  assert.equal(pointInPolygon(polygon[0], polygon), true);
  assert.equal(pointInPolygon([-100, 35], polygon), false);
});

test("calculates the positive Brenham charge by cart weight", () => {
  const area = rules.areas.find((item) => item.branchCode === "01" && item.areaCode.endsWith("000-10"));
  const center = [
    area.polygons[0].reduce((sum, point) => sum + point[0], 0) / area.polygons[0].length,
    area.polygons[0].reduce((sum, point) => sum + point[1], 0) / area.polygons[0].length
  ];
  const quote = quoteAtCoordinates({ shipFrom: { postalCode: "77833" }, coordinates: center, totalWeight: 25000.01 });
  assert.equal(quote.available, true);
  assert.equal(quote.amount, 50);
  assert.equal(quote.serviceName, "Woodson Local Delivery");
  assert.equal(quote.area.areaCode, "01/000-10");
});

test("uses the minimum positive tier when delivery weight is unavailable", () => {
  const area = rules.areas.find((item) => item.branchCode === "01" && item.areaCode.endsWith("000-10"));
  const rate = rateForWeight(area, 0);
  assert.equal(rate.amount, 25);
  assert.equal(rate.weightBasis, "minimum-tier");
});

test("requires a complete Texas street address before calling Census", async () => {
  let called = false;
  const result = await geocodeAddress({ city: "Brenham", state: "TX", postalCode: "77833" }, {
    fetch: async () => { called = true; }
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("reads coordinates from a Census geocoder match", async () => {
  const result = await geocodeAddress({
    addressLine: ["123 Main St"],
    city: "Brenham",
    state: "TX",
    postalCode: "77833"
  }, {
    fetch: async () => ({
      ok: true,
      json: async () => ({
        result: { addressMatches: [{ matchedAddress: "123 MAIN ST, BRENHAM, TX, 77833", coordinates: { x: -96.4, y: 30.17 } }] }
      })
    })
  });
  assert.deepEqual(result.coordinates, [-96.4, 30.17]);
  assert.equal(result.source, "census");
});
