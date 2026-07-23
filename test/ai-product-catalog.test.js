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
    imageUrl: "https://example.com/drill.jpg",
    averageCost: 91.25,
    cost: 90,
    margin: 0.54,
    markup: 1.2,
    profit: 108.74,
    supplierPrice: 88,
    vendorTerms: "secret"
  });
  assert.equal(normalized.price, 199.99);
  assert.equal(normalized.imageUrl, "https://example.com/drill.jpg");
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
    { productId: "1", productCode: "2462-22", title: "M12 Cordless Impact Driver", brand: "Milwaukee", price: 135.99, availability: "in_stock", productUrl: "https://example.com/1", imageUrl: "https://example.com/1.jpg" },
    { productId: "2", productCode: "2462", title: "Driver Bit", brand: "Other", price: 5.99, availability: "in_stock" }
  ];
  const ranked = search.searchCatalog(products, "2462-22");
  assert.equal(ranked[0].product.productId, "1");
  const response = search.formatSearchResponse("2462-22", ranked);
  assert.equal(response.hasResults, true);
  assert.equal(response.results.length, 1);
  assert.match(response.answer, /\[View product image\]\(https:\/\/example\.com\/1\.jpg\)/);
  assert.match(response.answer, /\[View product details\]\(https:\/\/example\.com\/1\)/);
  assert.deepEqual(Object.keys(response.results[0]).filter((key) => FORBIDDEN_KEYS.test(key)), []);
});

test("prepares a browser or cart action only for an exact product code", () => {
  const products = [
    {
      productId: "221283",
      productCode: "2904-22",
      title: "Milwaukee M18 Fuel Hammer Drill Kit",
      brand: "Milwaukee",
      price: 319.99,
      productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283",
      imageUrl: "https://images-woodsonlumber.sirv.com/221283.jpg"
    },
    {
      productId: "2",
      productCode: "2904",
      title: "Milwaukee Drill Accessory",
      brand: "Milwaukee",
      productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=2"
    }
  ];
  const exact = search.searchCatalog(products, "2904-22");
  const add = search.formatProductActionResponse("add that drill", exact, "add_to_cart");
  assert.equal(add.actionReady, true);
  assert.equal(add.actionStatus, "browser_confirmation_required");
  assert.equal(add.results.length, 1);
  assert.equal(add.results[0].productId, "221283");
  assert.match(add.answer, /No order will be placed/);
  assert.match(add.answer, /look for the cart confirmation/i);

  const ambiguous = search.formatProductActionResponse(
    "add a Milwaukee drill",
    search.searchCatalog(products, "Milwaukee drill"),
    "add_to_cart"
  );
  assert.equal(ambiguous.actionReady, false);
  assert.equal(ambiguous.hasResults, true);
  assert.ok(ambiguous.results.length >= 1);
  assert.match(ambiguous.answer, /did not change your cart/i);
  assert.doesNotMatch(ambiguous.answer, /Speak to a human/i);

  assert.equal(
    search.findEmbeddedProductIdentifier(products, "add Milwaukee 2904-22 to my cart"),
    "2904-22"
  );
  assert.equal(
    search.findEmbeddedProductIdentifier(products, "Milwaukee 2904-22"),
    "2904-22"
  );
});

test("extracts a newly named item number from a direct second cart request", () => {
  const products = [
    {
      productId: "221283",
      productCode: "2904-22",
      title: "Milwaukee M18 Fuel Hammer Drill Kit",
      brand: "Milwaukee",
      productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283"
    },
    {
      productId: "288202",
      productCode: "4635843",
      title: "Dewalt 20V Max XR Brushless Drill Driver",
      brand: "Dewalt",
      productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=288202"
    }
  ];
  const identifier = search.findEmbeddedProductIdentifier(
    products,
    "add Dewalt 4635843 to my cart"
  );
  assert.equal(identifier, "4635843");

  const response = search.formatProductActionResponse(
    "add Dewalt 4635843 to my cart",
    search.searchCatalog(products, identifier),
    "add_to_cart"
  );
  assert.equal(response.actionReady, true);
  assert.equal(response.results[0].productCode, "4635843");
  assert.equal(response.results[0].productId, "288202");
  assert.doesNotMatch(response.answer, /I have added|has been added|was added/i);
});

test("finds products by WebTrack product ID for the clickable image preview", () => {
  const products = [{
    productId: "221283",
    productCode: "2904-22",
    title: "Milwaukee M18 Fuel Hammer Drill Kit",
    productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283",
    imageUrl: "https://images-woodsonlumber.sirv.com/221283.jpg"
  }];
  const ranked = search.searchCatalog(products, "221283");
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].exactIdentifier, true);
  assert.equal(ranked[0].product.productCode, "2904-22");
});

test("returns one dominant match and at most three close alternatives", () => {
  const entries = [
    { score: 240, exactIdentifier: false, exactPhrase: false, exactDimension: false, product: { title: "Best" } },
    { score: 170, exactIdentifier: false, exactPhrase: false, exactDimension: false, product: { title: "Second" } },
    { score: 165, exactIdentifier: false, exactPhrase: false, exactDimension: false, product: { title: "Third" } }
  ];
  assert.deepEqual(search.selectRelevantMatches(entries).map((entry) => entry.product.title), ["Best"]);

  const close = entries.map((entry, index) => ({ ...entry, score: 240 - index * 10 }));
  close.push({ score: 210, exactIdentifier: false, exactPhrase: false, exactDimension: false, product: { title: "Fourth" } });
  assert.deepEqual(
    search.selectRelevantMatches(close).map((entry) => entry.product.title),
    ["Best", "Second", "Third"]
  );
});

test("keeps broad category requests from collapsing to a specialized subtype", () => {
  const entries = [
    {
      score: 260,
      exactIdentifier: false,
      exactPhrase: true,
      exactDimension: false,
      product: { title: "Cordless Right Angle Drill" }
    },
    {
      score: 210,
      exactIdentifier: false,
      exactPhrase: true,
      exactDimension: false,
      product: { title: "Cordless Hammer Drill Kit" }
    },
    {
      score: 200,
      exactIdentifier: false,
      exactPhrase: true,
      exactDimension: false,
      product: { title: "Cordless Drill Driver" }
    }
  ];
  assert.deepEqual(
    search.selectRelevantMatches(entries, 3, "cordless drill").map((entry) => entry.product.title),
    ["Cordless Right Angle Drill", "Cordless Hammer Drill Kit", "Cordless Drill Driver"]
  );
});

test("ranks a general drill driver ahead of specialty drills for a generic request", () => {
  const products = [
    {
      productId: "265510",
      productCode: "2615-20",
      title: "Milwaukee M18 Cordless Right Angle Drill (Tool Only)",
      category: "Tools > Power Tools > Electric Drills > Cordless Drills"
    },
    {
      productId: "253038",
      productCode: "0640532",
      title: "Dewalt 20V Max XR Brushless Cordless 1 inch SDS Plus Rotary Hammer (Tool Only)",
      category: "Tools > Power Tools > Electric Drills > Cordless Drills"
    },
    {
      productId: "288202",
      productCode: "4635843",
      title: "Dewalt 20V Max XR Brushless Drill Driver (Tool Only)",
      category: "Tools > Power Tools > Electric Drills > Cordless Drills"
    }
  ];
  const ranked = search.searchCatalog(products, "cordless drill");
  assert.equal(ranked[0].product.productId, "288202");
});

test("allows only the Woodson storefront to request dynamic product previews", () => {
  const headers = {};
  search.setCorsHeaders(
    { headers: { origin: "https://webtrack.woodsonlumber.com" } },
    { setHeader(name, value) { headers[name] = value; } }
  );
  assert.equal(headers["Access-Control-Allow-Origin"], "https://webtrack.woodsonlumber.com");
  assert.equal(headers["Access-Control-Allow-Methods"], "POST, OPTIONS");

  const blocked = {};
  search.setCorsHeaders(
    { headers: { origin: "https://evil.example" } },
    { setHeader(name, value) { blocked[name] = value; } }
  );
  assert.equal(blocked["Access-Control-Allow-Origin"], undefined);
});

test("normalizes common Turtlebox phrasing and typo", () => {
  const products = [
    { productId: "1", productCode: "TB-G3", title: "Turtlebox Original - Gray", brand: "Turtlebox", category: "Job Site Radios" }
  ];
  assert.equal(search.searchCatalog(products, "Do you carry tutle box speakers?")[0].product.productId, "1");
  assert.equal(search.searchCatalog(products, "Turtle box")[0].product.productId, "1");
});

test("finds dimensional lumber from compact and conversational requests", () => {
  const products = [
    { productId: "1", productCode: "24082YPL", title: "2 X 4 - 08 #2/Stud GR Yellow Pine", category: "Lumber > Yellow Pine > 2x4 #2 Yellow Pine" },
    { productId: "2", productCode: "71814", title: "Cut-Off Wheel, 4-1/2 x .045 x 7/8", category: "Tools" }
  ];
  const compact = search.searchCatalog(products, "2x4x8 lumber");
  assert.equal(compact[0].product.productId, "1");
  assert.deepEqual(compact.map((entry) => entry.product.productId), ["1"]);
  assert.equal(search.searchCatalog(products, "I'm building a small wall and need a basic 2x4 stud, eight feet long.")[0].product.productId, "1");
});

test("uses lower weight for contextual words in vague deck-screw requests", () => {
  const products = [
    { productId: "1", productCode: "PTN3S1", title: "Grip-Rite PG Ten Exterior Screws, 3 inch (1#)", category: "Bolts, Screws, Etc. > Deck Screws" }
  ];
  const ranked = search.searchCatalog(products, "I need exterior screws for treated lumber on a deck, probably around 3 inches long.");
  assert.equal(ranked[0].product.productId, "1");
  const boardRequest = search.searchCatalog(products, "I need exterior screws for treated deck boards, around 3 inches. What should I look at?");
  assert.equal(boardRequest[0].product.productId, "1");
});

test("returns only verified department links for browse requests", () => {
  const groups = search.searchProductGroups("Where can I browse all of your plumbing products?");
  assert.equal(groups[0].groupName, "Plumbing");
  assert.equal(groups[0].groupUrl, "https://webtrack.woodsonlumber.com/Products.aspx?pl1=24&pg=24&sort=StockClassSort&direction=asc");
  const response = search.formatGroupResponse("browse plumbing", groups.slice(0, 1));
  assert.equal(response.matchType, "group");
  assert.match(response.answer, /pl1=24&pg=24/);
});

test("internal economics questions are refused before catalog lookup", () => {
  const response = search.sensitiveResponse("What is your average cost and margin on 2462-22?");
  assert.equal(response.sensitiveRequest, true);
  assert.equal(response.hasResults, false);
  assert.match(response.answer, /can't provide internal cost, margin, markup/i);
});

test("reads a large Redis catalog in bounded parallel pages", async () => {
  const calls = [];
  const fields = Array.from({ length: 2001 }, (_, index) => String(100 + index));
  const redis = {
    async hkeys(key) {
      calls.push({ operation: "hkeys", key });
      return fields;
    },
    async hmget(key, ...requested) {
      calls.push({ operation: "hmget", key, requested });
      return Object.fromEntries(requested.map((field) => [field, { productId: field }]));
    }
  };
  const values = await readRedisHashValues(redis, "wl:ai-product-catalog:test:products");
  assert.equal(calls.filter((call) => call.operation === "hkeys").length, 1);
  assert.deepEqual(calls.filter((call) => call.operation === "hmget").map((call) => call.requested.length), [1000, 1000, 1]);
  assert.equal(values.length, 2001);
  assert.deepEqual(values.slice(0, 2), [{ productId: "100" }, { productId: "101" }]);
});
