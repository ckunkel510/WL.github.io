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

function drillProduct(productId, overrides = {}) {
  return product(productId, {
    productCode: `DRL-${productId}`,
    title: `Cordless Drill Driver Kit ${productId}`,
    brand: "DeWalt",
    category: "Tools & Equipment > Power Tools > Electric Drills",
    ...overrides
  });
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
  assert.equal(payload.matchType, "corrected");
  assert.equal(payload.suggestedTerm, "Valspar");
  assert.equal(payload.effectiveQuery, "valspar");
  assert.equal(payload.listId, "search_recovery_matches_v2");
  assert.equal(payload.suggestions.length, 8);
  assert.equal(payload.suggestions.some((item) => item.productId === "1"), false);
  assert.deepEqual(payload.searchSuggestions[0], { term: "Valspar", label: "Valspar", type: "correction" });
  payload.suggestions.forEach((item) => {
    assert.equal(Object.hasOwn(item, "price"), false);
    assert.equal(Object.hasOwn(item, "salePrice"), false);
  });
});

test("catalog vocabulary corrects a broader typo and offers validated related searches", () => {
  const catalog = {
    products: [
      ...Array.from({ length: 6 }, (_, index) => drillProduct(100 + index)),
      drillProduct(200, { title: "Hammer Drill Kit 200" }),
      drillProduct(201, { title: "Cordless Drill Kit 201" }),
      drillProduct(202, { title: "Drill Driver Combo 202" }),
      drillProduct(203, { title: "Titanium Drill Bits 203", category: "Tools & Equipment > Power Tool Accessories > Power Drilling" })
    ]
  };
  assert.equal(suggestions.boundedDamerauLevenshtein("drlli", "drill", 2), 2);
  const correction = suggestions.correctedQuery(catalog, "drlli");
  assert.equal(correction.normalized, "drill");
  const payload = suggestions.buildSuggestionPayload(catalog, "drlli", 0, new Set());
  assert.equal(payload.matchType, "corrected");
  assert.equal(payload.searchSuggestions[0].term, "drill");
  assert.equal(payload.searchSuggestions[0].type, "correction");
  assert.ok(payload.searchSuggestions.some((entry) => entry.term === "drill driver"));
  assert.ok(payload.searchSuggestions.every((entry) => (
    entry.type === "correction" || search.searchCatalog(catalog.products, entry.term, 1).length > 0
  )));
});

test("project affinities produce related searches beyond the named examples", () => {
  const catalog = {
    products: [
      product(400, { title: "Architectural Roofing Shingle", brand: "TAMKO", category: "Building Materials > Roofing > Asphalt Shingles" }),
      product(401, { title: "Synthetic Roofing Underlayment", brand: "Grip-Rite", category: "Building Materials > Roofing > Roofing Underlayments" }),
      product(402, { title: "Roof Flashing Roll", brand: "Amerimax", category: "Building Materials > Roofing > Roof Flashing" }),
      product(403, { title: "Roofing Vent", brand: "Air Vent", category: "Building Materials > Roofing > Roofing Ventilation" })
    ]
  };
  assert.equal(suggestions.relatedSearchRule("roofing"), null);
  const payload = suggestions.buildSuggestionPayload(catalog, "roofing", 0, new Set());
  assert.ok(payload.searchSuggestions.some((entry) => entry.term === "roofing underlayments"));
  assert.ok(payload.searchSuggestions.every((entry) => search.searchCatalog(catalog.products, entry.term, 1).length > 0));
});

test("successful Valspar search spotlights a line and project accessories without native duplicates", () => {
  const native = Array.from({ length: 8 }, (_, index) => product(index + 1));
  const medallion = Array.from({ length: 4 }, (_, index) => product(20 + index, {
    title: `Valspar Medallion Plus Interior Paint ${index + 1}`
  }));
  const applicators = Array.from({ length: 4 }, (_, index) => product(30 + index, {
    productCode: `BRU-${index + 1}`,
    title: `Professional Paint Brush ${index + 1}`,
    brand: "Purdy",
    category: "Paint & Sundries > Painting Tools > Paint Applicators"
  }));
  const catalog = { products: [...native, ...medallion, ...applicators] };
  const excluded = new Set(native.map((item) => item.productId));
  const payload = suggestions.buildSuggestionPayload(catalog, "Valspar", 48, excluded);
  assert.equal(payload.mode, "merchandising");
  assert.equal(payload.nativeResultCount, 48);
  assert.equal(payload.suggestions.length, 0);
  assert.equal(payload.sections.length, 2);
  assert.equal(payload.sections[0].listName, "Featured: Valspar Medallion Plus");
  assert.equal(payload.sections[0].placementAfter, 8);
  assert.match(payload.sections[1].listId, /^search_project_paint_/);
  assert.equal(payload.sections[1].placementAfter, 24);
  payload.sections.flatMap((section) => section.recommendations).forEach((item) => {
    assert.equal(excluded.has(item.productId), false);
    assert.equal(Object.hasOwn(item, "price"), false);
  });
});

test("successful non-brand searches use general project-affinity merchandising", () => {
  const drills = Array.from({ length: 8 }, (_, index) => drillProduct(100 + index));
  const bits = Array.from({ length: 4 }, (_, index) => drillProduct(200 + index, {
    title: `Titanium Drill Bit Set ${index + 1}`,
    category: "Tools & Equipment > Power Tool Accessories > Power Drilling"
  }));
  const batteries = Array.from({ length: 4 }, (_, index) => drillProduct(300 + index, {
    title: `20V Power Tool Battery ${index + 1}`,
    category: "Tools & Equipment > Power Tool Accessories > Power Tool Batteries"
  }));
  const excluded = new Set(drills.map((item) => item.productId));
  const payload = suggestions.buildSuggestionPayload({ products: [...drills, ...bits, ...batteries] }, "drill", 8, excluded);
  assert.equal(payload.sections.length, 2);
  assert.match(payload.sections[0].listId, /^search_project_power_tools_/);
  assert.match(payload.sections[1].listId, /^search_project_power_tools_/);
  assert.deepEqual(payload.sections.map((section) => section.placementAfter), [8, 24]);
  assert.ok(payload.sections.flatMap((section) => section.recommendations).every((item) => !excluded.has(item.productId)));
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

test("Products.aspx client preserves native order, links corrections, and sparsely inserts merchandising", () => {
  const client = fs.readFileSync(path.join(root, "smart-search.js"), "utf8");
  const header = fs.readFileSync(path.join(root, "headermodern.js"), "utf8");
  const analytics = fs.readFileSync(path.join(root, "wl-site.js"), "utf8");
  const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");

  assert.match(header, /smart-search\.js\?v=20260909-2/);
  assert.match(header, /\/Products\\\.aspx\$/);
  assert.match(client, /#productlistcards a\[href\*='ProductDetail\.aspx'\]/);
  assert.match(client, /We found possible matches/);
  assert.match(client, /Did you mean:/);
  assert.match(client, /searchText=" \+ encodeURIComponent/);
  assert.match(client, /search_suggestion_click/);
  assert.match(client, /suggested_search_term/);
  assert.match(client, /suggestion_type/);
  assert.match(client, /#productlistcards>\.wl-smart-search--in-grid\{grid-column:1\/-1/);
  assert.match(client, /grid\.insertBefore\(section, anchor\.nextSibling\)/);
  assert.match(client, /wlPlacementAfter/);
  assert.match(client, /viewTracked\[payload\.listId\]/);
  assert.match(client, /data-wl-self-tracked-product-list/);
  assert.match(client, /search_results_enhanced/);
  assert.match(client, /view_item_list/);
  assert.match(client, /select_item/);
  assert.match(client, /wl_product_discovery_attribution_v1/);
  assert.doesNotMatch(client, /\.remove\(\)|\.hidden\s*=\s*true|display\s*:\s*["']none["']/);
  assert.match(analytics, /search_results_enhanced: true/);
  assert.match(analytics, /search_refine_click: true/);
  assert.match(analytics, /search_suggestion_click: true/);
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
