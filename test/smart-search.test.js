"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const search = require("../api/ai-product-search")._test;
const suggestions = require("../api/smart-search-suggestions")._test;

const root = path.resolve(__dirname, "..");

function product(productId, overrides = {}) {
  return {
    productId: String(productId),
    productCode: `VAL-${productId}`,
    title: `Valspar Interior Paint ${productId}`,
    brand: "Valspar",
    category: "Paint & Sundries > Paint & Stains > Valspar Paint",
    availability: "in_stock",
    price: 29.99,
    salePrice: 24.99,
    productUrl: `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${productId}`,
    imageUrl: `https://images-woodsonlumber.sirv.com/merchant-feed/products/${productId}/main.jpg`,
    ...overrides
  };
}

test("catalog search corrects one adjacent-letter transposition", () => {
  assert.equal(search.editDistanceAtMostOne("vaslpar", "valspar"), true);
  assert.equal(search.editDistanceAtMostOne("vaslpar", "varslap"), false);
  const ranked = search.searchCatalog([product(1), product(2)], "Vaslpar", 8);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].product.brand, "Valspar");
});

test("empty native search returns safe, price-free recovery matches", () => {
  const catalog = { products: Array.from({ length: 9 }, (_, index) => product(index + 1)) };
  const payload = suggestions.buildSuggestionPayload(catalog, "Vaslpar", 0, new Set(["1"]));
  assert.equal(payload.mode, "recovery");
  assert.equal(payload.matchType, "close");
  assert.equal(payload.suggestedTerm, "Valspar");
  assert.equal(payload.listId, "search_recovery_matches_v1");
  assert.equal(payload.suggestions.length, 8);
  assert.equal(payload.suggestions.some((item) => item.productId === "1"), false);
  payload.suggestions.forEach((item) => {
    assert.equal(Object.hasOwn(item, "price"), false);
    assert.equal(Object.hasOwn(item, "salePrice"), false);
  });
});

test("native result augmentation excludes visible items and labels the related shelf", () => {
  const catalog = { products: Array.from({ length: 6 }, (_, index) => product(index + 1)) };
  const payload = suggestions.buildSuggestionPayload(catalog, "Valspar", 48, new Set(["1", "2"]));
  assert.equal(payload.mode, "related");
  assert.equal(payload.nativeResultCount, 48);
  assert.equal(payload.listName, "Related to your search");
  assert.deepEqual(payload.suggestions.map((item) => item.productId), ["3", "4", "5", "6"]);
});

test("broad typo recovery diversifies equally relevant product categories", () => {
  const catalog = {
    products: [
      product(1), product(2), product(3), product(4),
      product(5, { category: "Paint & Sundries > Paint & Stains > Valspar Paint > Cabinet Paint" }),
      product(6, { category: "Paint & Sundries > Paint & Stains > Valspar Paint > Cabinet Paint" }),
      product(7, { category: "Paint & Sundries > Paint & Stains > Valspar Paint > Floor Paint" }),
      product(8, { category: "Paint & Sundries > Paint & Stains > Valspar Paint > Floor Paint" })
    ]
  };
  const payload = suggestions.buildSuggestionPayload(catalog, "Vaslpar", 0, new Set());
  assert.deepEqual(
    payload.suggestions.slice(0, 6).map((item) => item.categoryLabel),
    ["Valspar Paint", "Valspar Paint", "Cabinet Paint", "Cabinet Paint", "Floor Paint", "Floor Paint"]
  );
});

test("smart search rejects personal-data-shaped queries and unsafe cards", () => {
  assert.equal(suggestions.cleanQuery("person@example.com"), "");
  assert.equal(suggestions.cleanQuery("979-555-1212"), "");
  assert.equal(suggestions.hasCustomerCardData(product(1, { productUrl: "https://example.com/product" })), false);
  assert.equal(suggestions.hasCustomerCardData(product(2, { availability: "out_of_stock" })), false);
});

test("Products.aspx client preserves native results and wires tracking and recovery UI", () => {
  const client = fs.readFileSync(path.join(root, "smart-search.js"), "utf8");
  const header = fs.readFileSync(path.join(root, "headermodern.js"), "utf8");
  const analytics = fs.readFileSync(path.join(root, "wl-site.js"), "utf8");
  const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");

  assert.match(header, /smart-search\.js\?v=20260909-1/);
  assert.match(header, /\/Products\\\.aspx\$/);
  assert.match(client, /#productlistcards a\[href\*='ProductDetail\.aspx'\]/);
  assert.match(client, /We found possible matches/);
  assert.match(client, /Related to your search/);
  assert.match(client, /data-wl-self-tracked-product-list/);
  assert.match(client, /search_results_enhanced/);
  assert.match(client, /view_item_list/);
  assert.match(client, /select_item/);
  assert.match(client, /wl_product_discovery_attribution_v1/);
  assert.doesNotMatch(client, /\.remove\(\)|\.hidden\s*=\s*true|display\s*:\s*["']none["']/);
  assert.match(analytics, /search_results_enhanced: true/);
  assert.match(analytics, /search_refine_click: true/);
  assert.match(analytics, /productLink\.closest\("\[data-wl-self-tracked-product-list='true'\]"\)/);
  assert.match(vercel, /api\/smart-search-suggestions\.js/);
});

test("suggestion endpoint exposes the fixed WebTrack CORS contract", () => {
  const headers = {};
  suggestions.setCorsHeaders({ setHeader(name, value) { headers[name] = value; } });
  assert.equal(headers["Access-Control-Allow-Origin"], "https://webtrack.woodsonlumber.com");
  assert.equal(headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(headers["Access-Control-Allow-Headers"], "Content-Type");
});
