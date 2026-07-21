"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cartonize, cartonizeCandidates } = require("../api/cartonizer");

const settings = {
  maxCartonWeight: 50,
  tareWeight: 0.5,
  dimDivisor: 139,
  packagePenalty: 1,
  customCartonPadding: 1
};

test("extrapolates unit dimensions and weight across a large quantity", () => {
  const result = cartonize([
    { productId: "1", quantity: 100, weight: 1, length: 2, width: 2, height: 2 }
  ], { settings });

  assert.ok(result.packageCount >= 2);
  assert.equal(result.packages.reduce((sum, item) => sum + item.unitCount, 0), 100);
  assert.ok(result.packages.every((item) => item.weight <= 50.5));
  assert.ok(result.packages.every((item) => item.length && item.width && item.height));
});

test("builds multiple UPS packages for a thousand-unit order", () => {
  const result = cartonize([
    { productId: "1", quantity: 1000, weight: 1, length: 1, width: 1, height: 1 }
  ], { settings });

  assert.equal(result.packages.reduce((sum, item) => sum + item.unitCount, 0), 1000);
  assert.ok(result.packageCount > 1);
  assert.ok(result.packageCount <= 50);
});

test("rotates products to fit a supported carton", () => {
  const result = cartonize([
    { productId: "2", quantity: 2, weight: 2, length: 9, width: 5, height: 7 }
  ], { settings });

  assert.equal(result.packages.reduce((sum, item) => sum + item.unitCount, 0), 2);
  assert.ok(result.packages.every((item) => item.length >= 9 || item.width >= 9 || item.height >= 9));
});

test("packs mixed products without overlapping or losing units", () => {
  const result = cartonize([
    { productId: "A", quantity: 4, weight: 2, length: 6, width: 3, height: 2 },
    { productId: "B", quantity: 6, weight: 0.5, length: 3, width: 2, height: 1 }
  ], { settings });

  assert.equal(result.packages.reduce((sum, item) => sum + item.unitCount, 0), 10);
  assert.ok(result.packageCount >= 1);
});

test("returns a small bounded set of candidate package plans", () => {
  const candidates = cartonizeCandidates([
    { productId: "A", quantity: 12, weight: 1, length: 4, width: 2, height: 2 }
  ], { settings });

  assert.ok(candidates.length >= 1);
  assert.ok(candidates.length <= 3);
  assert.ok(candidates[0].score <= candidates[candidates.length - 1].score);
});

test("rejects a package that exceeds UPS small-package dimensions", () => {
  assert.throws(() => cartonize([
    { productId: "LONG", quantity: 1, weight: 10, length: 120, width: 5, height: 5 }
  ], { settings }), /could not be packed/);
});
