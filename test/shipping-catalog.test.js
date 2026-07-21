"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  activateCatalogSnapshot,
  beginCatalogSnapshot,
  getCatalogProducts,
  resetMemoryCatalog,
  writeCatalogChunk
} = require("../api/shipping-catalog");

test.beforeEach(() => resetMemoryCatalog());

test("activates a complete private shipping catalog snapshot", async () => {
  await beginCatalogSnapshot({ id: "snapshot-20260721", expectedProducts: 2 });
  await writeCatalogChunk({
    id: "snapshot-20260721",
    products: [
      {
        productId: "100",
        productCode: "CASE-100",
        price: 79.99,
        averageCost: 40,
        weight: 1.5,
        length: 6,
        width: 2,
        height: 1,
        companyInventory: 3,
        isClearance: true
      },
      {
        productId: "101",
        productCode: "CASE-101",
        price: 89.99,
        averageCost: 45,
        weight: 1.6,
        length: 7,
        width: 2,
        height: 1,
        companyInventory: 20,
        isClearance: false
      }
    ]
  });
  await activateCatalogSnapshot("snapshot-20260721");

  const result = await getCatalogProducts([
    { productId: "100" },
    { productCode: "case-101" }
  ]);

  assert.equal(result.fresh, true);
  assert.equal(result.products[0].averageCost, 40);
  assert.equal(result.products[0].isClearance, true);
  assert.equal(result.products[1].productId, "101");
});

test("does not activate a partial snapshot", async () => {
  await beginCatalogSnapshot({ id: "snapshot-partial", expectedProducts: 2 });
  await writeCatalogChunk({
    id: "snapshot-partial",
    products: [{ productId: "100", price: 10, averageCost: 5 }]
  });

  await assert.rejects(() => activateCatalogSnapshot("snapshot-partial"), /expected 2 products but received 1/);
});

test("returns no product economics when the active snapshot is stale", async () => {
  await beginCatalogSnapshot({ id: "snapshot-stale", expectedProducts: 1, createdAt: "2020-01-01T00:00:00.000Z" });
  await writeCatalogChunk({
    id: "snapshot-stale",
    products: [{ productId: "100", price: 10, averageCost: 5 }]
  });
  await activateCatalogSnapshot("snapshot-stale");

  const result = await getCatalogProducts([{ productId: "100" }]);
  assert.equal(result.fresh, false);
  assert.deepEqual(result.products, []);
});
