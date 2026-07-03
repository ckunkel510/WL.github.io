"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const catalog = require("../data/medallion-plus-products.json");

test("normalizes the supplied Medallion Plus catalog", () => {
  assert.equal(catalog.products.length, 69);
  assert.equal(catalog.products.filter((product) => product.tintable).length, 68);
  assert.equal(new Set(catalog.products.map((product) => product.productId)).size, 69);
  assert.equal(new Set(catalog.products.map((product) => product.productCode)).size, 69);
  assert.equal(new Set(catalog.products.map((product) => product.upc)).size, 69);
});

test("keeps white bases tintable and excludes factory black", () => {
  const whiteBases = catalog.products.filter((product) =>
    product.base === "White Base" || product.base === "Ultra White Base 1"
  );
  const factoryColors = catalog.products.filter((product) => product.selectorStatus === "factory-color");

  assert.equal(whiteBases.length, 21);
  assert.ok(whiteBases.every((product) => product.tintable));
  assert.deepEqual(factoryColors.map((product) => product.productCode), ["27005GA"]);
  assert.equal(factoryColors[0].factoryColor, "Black");
});

test("does not enable color selection before formula-to-base mapping", () => {
  const configurableBases = catalog.products.filter((product) => product.tintable);
  assert.ok(configurableBases.every((product) => product.selectorStatus === "awaiting-color-base-map"));
});
