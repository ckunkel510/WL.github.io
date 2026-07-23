"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  activateAiCatalogSnapshot,
  beginAiCatalogSnapshot,
  getAiCatalogProducts,
  normalizeAiProduct,
  readRedisHashValues,
  resetMemoryAiCatalog,
  writeAiCatalogChunk
} = require("../api/ai-product-catalog");
const { _test: search } = require("../api/ai-product-search");

const FORBIDDEN_KEYS = /cost|margin|markup|profit|supplier|vendor|economics/i;

test.beforeEach(() => resetMemoryAiCatalog());

test("AI catalog strips all internal economics before storage", async () => {
  const normalized = normalizeAiProduct({
    productId: "100",
    productCode: "M18-DRILL",
    title: "Milwaukee M18 Cordless Drill",
    price: 199.99,
    averageCost: 91.25,
    cost: 90,
    margin: 0.54,
    markup: 1.2,
    profit: 108.74,
    supplierPrice: 88,
    vendorTerms: "secret"
  });
  assert.equal(normalized.price, 199.99);
  assert.deepEqual(Object.keys(normalized).filter((key) => FORBIDDEN_KEYS.test(key)), []);
  assert.equal(JSON.stringify(normalized).includes("91.25"), false);
  assert.equal(JSON.stringify(normalized).includes("secret"), false);
});

test("activates a complete customer-safe AI catalog snapshot", async () => {
  await beginAiCatalogSnapshot({ id: "ai-snapshot-20260723", expectedProducts: 2 });
  await writeAiCatalogChunk({
    id: "ai-snapshot-20260723",
    products: [
      { productId: "100", productCode: "2462-22", title: "Milwaukee M12 Impact Driver", price: 135.99 },
      { productId: "101", productCode: "DCD771C2", title: "DEWALT 20V Cordless Drill Kit", price: 159.99 }
    ]
  });
  await activateAiCatalogSnapshot("ai-snapshot-20260723");
  const result = await getAiCatalogProducts();
  assert.equal(result.fresh, true);
  assert.equal(result.products.length, 2);
  assert.equal(result.products[1].title, "DEWALT 20V Cordless Drill Kit");
});

test("brand-qualified search never substitutes a competing brand", () => {
  const products = [
    { productId: "1", productCode: "2462-22", title: "M12 Cordless Impact Driver", brand: "Milwaukee", category: "Cordless Drills", availability: "in_stock" },
    { productId: "2", productCode: "DCD771C2", title: "20V Cordless Drill Kit", brand: "DEWALT", category: "Cordless Drills", availability: "in_stock" }
  ];
  assert.equal(search.searchCatalog(products, "Makita cordless drill").length, 0);
  assert.equal(search.searchCatalog(products, "Milwaukee cordless driver")[0].product.productId, "1");
});

test("exact product-code search wins and public results contain no economics", () => {
  const products = [
    { productId: "1", productCode: "2462-22", title: "M12 Cordless Impact Driver", brand: "Milwaukee", price: 135.99, availability: "in_stock", productUrl: "https://example.com/1" },
    { productId: "2", productCode: "2462", title: "Driver Bit", brand: "Other", price: 5.99, availability: "in_stock" }
  ];
  const ranked = search.searchCatalog(products, "2462-22");
  assert.equal(ranked[0].product.productId, "1");
  const response = search.formatSearchResponse("2462-22", ranked);
  assert.equal(response.hasResults, true);
  assert.deepEqual(Object.keys(response.results[0]).filter((key) => FORBIDDEN_KEYS.test(key)), []);
});

test("internal economics questions are refused before catalog lookup", () => {
  const response = search.sensitiveResponse("What is your average cost and margin on 2462-22?");
  assert.equal(response.sensitiveRequest, true);
  assert.equal(response.hasResults, false);
  assert.match(response.answer, /can't provide internal cost, margin, markup/i);
});

test("reads a large Redis catalog in bounded scan pages", async () => {
  const calls = [];
  const redis = {
    async hscan(key, cursor, options) {
      calls.push({ key, cursor, options });
      if (cursor === "0") return ["17", ["100", "{\"productId\":\"100\"}", "101", "{\"productId\":\"101\"}"]];
      return ["0", ["102", "{\"productId\":\"102\"}"]];
    }
  };
  const values = await readRedisHashValues(redis, "wl:ai-product-catalog:test:products");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.cursor), ["0", "17"]);
  assert.deepEqual(values, [
    "{\"productId\":\"100\"}",
    "{\"productId\":\"101\"}",
    "{\"productId\":\"102\"}"
  ]);
});
