"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const recommendations = require("../api/product-recommendations")._test;

function product(productId, title, category, overrides = {}) {
  return {
    productId,
    productCode: `CODE-${productId}`,
    title,
    category,
    brand: "Woodson Test",
    price: 10,
    salePrice: null,
    availability: "in_stock",
    productUrl: `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${productId}`,
    imageUrl: `https://images-woodsonlumber.sirv.com/Products/${productId}.jpg`,
    ...overrides
  };
}

const LUMBER_PARENT = "Lumber > Yellow Pine > 2x #2 Yellow Pine";

test("recommendations prefer exact category matches and exclude visible product options", () => {
  const catalog = {
    active: { id: "recommendation-fixture-1" },
    products: [
      product("6698", "2 X 4 - 08 #2 Yellow Pine", `${LUMBER_PARENT} > 2x4 #2 Yellow Pine`),
      product("6708", "2 X 4 - 10 #2 Yellow Pine", `${LUMBER_PARENT} > 2x4 #2 Yellow Pine`),
      product("89691", "2 X 4 - 18 #2 Yellow Pine", `${LUMBER_PARENT} > 2x4 #2 Yellow Pine`),
      product("7101", "2 X 6 - 08 #2 Yellow Pine", `${LUMBER_PARENT} > 2x6 #2 Yellow Pine`),
      product("7102", "2 X 6 - 10 #2 Yellow Pine", `${LUMBER_PARENT} > 2x6 #2 Yellow Pine`),
      product("7103", "2 X 8 - 08 #2 Yellow Pine", `${LUMBER_PARENT} > 2x8 #2 Yellow Pine`)
    ]
  };

  const results = recommendations.recommendProducts(catalog, "6698", new Set(["6708"]));
  assert.ok(results.length >= 3);
  assert.equal(results.some((entry) => entry.productId === "6698"), false);
  assert.equal(results.some((entry) => entry.productId === "6708"), false);
  assert.equal(results[0].productId, "89691");
  assert.equal(results[0].match, "same_category");
  assert.equal(results[1].match, "related_category");
});

test("recommendations fail closed when fewer than three customer-ready matches remain", () => {
  const category = "Plumbing > Valves > Pressure Relief Valves";
  const catalog = {
    active: { id: "recommendation-fixture-2" },
    products: [
      product("6821", "Pressure Relief Valve 150 PSI", category),
      product("6822", "Pressure Relief Valve 125 PSI", category),
      product("6823", "Pressure Relief Valve 100 PSI", category, { availability: "out_of_stock" }),
      product("6824", "Pressure Relief Valve 175 PSI", category, { imageUrl: "" })
    ]
  };

  assert.deepEqual(recommendations.recommendProducts(catalog, "6821"), []);
});

test("public recommendation payload excludes price until store-aware pricing is available", () => {
  const category = "Tools > Accessories > Driver Bits > Bulk Bits";
  const catalog = {
    active: { id: "recommendation-fixture-3" },
    products: [
      product("22648", "1 inch T25 Torx Bit", category, { price: 0.99 }),
      product("22649", "1 inch T20 Torx Bit", category, { price: 1.09 }),
      product("22650", "1 inch T30 Torx Bit", category, { price: 1.19 }),
      product("22651", "2 inch T25 Torx Bit", category, { price: 2.49 })
    ]
  };

  const results = recommendations.recommendProducts(catalog, "22648");
  assert.equal(results.length, 3);
  results.forEach((entry) => {
    assert.equal(Object.hasOwn(entry, "price"), false);
    assert.equal(Object.hasOwn(entry, "salePrice"), false);
  });
});

test("recommendation request inputs are bounded and validated", () => {
  assert.equal(recommendations.cleanProductId(" 6698 "), "6698");
  assert.throws(() => recommendations.cleanProductId("6698<script>"), /numeric WebTrack product ID/);
  const excluded = recommendations.excludedProductIds("6708, 6723, bad, 6708");
  assert.deepEqual([...excluded], ["6708", "6723"]);
});

test("PDP client mounts a tracked, accessible rail after reviews", () => {
  const root = path.join(__dirname, "..");
  const sidebar = fs.readFileSync(path.join(root, "product-sidebar.js"), "utf8");
  const analytics = fs.readFileSync(path.join(root, "wl-site.js"), "utf8");
  const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");

  assert.match(sidebar, /id: "pdp-similar-products-slot"/);
  assert.match(sidebar, /\$similarSlot\.insertAfter\(\$reviews\)/);
  assert.match(sidebar, /item_list_id: payload\.listId/);
  assert.match(sidebar, /wlTrack\("view_item_list"/);
  assert.match(sidebar, /wlTrack\("select_item"/);
  assert.match(sidebar, /data-option-target-id/);
  assert.match(sidebar, /items\.length < 3/);
  assert.match(sidebar, /View price & availability/);
  assert.match(sidebar, /aria-labelledby/);
  assert.match(sidebar, /product-recommendations\?v=20260909-1/);
  assert.match(analytics, /wl_pdp_recommendation_attribution_v1/);
  assert.match(analytics, /recommendationContext\(name, parameters\)/);
  assert.match(vercel, /api\/product-recommendations\.js/);
});

test("recommendation API always emits the storefront CORS contract before CDN caching", () => {
  const headers = {};
  recommendations.setCorsHeaders(
    { headers: {} },
    { setHeader(name, value) { headers[name] = value; } }
  );
  assert.equal(headers["Access-Control-Allow-Origin"], "https://webtrack.woodsonlumber.com");
  assert.equal(headers["Access-Control-Allow-Methods"], "GET, OPTIONS");
});
