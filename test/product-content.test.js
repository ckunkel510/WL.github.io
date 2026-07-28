"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const handler = require("../api/product-content");
const merchantFeed = require("../api/product-content-merchant-feed");
const browserContent = require("../ProductDescription");
const contentAudit = require("../scripts/audit-product-content");

const SAMPLE_CSV = [
  "Productid,Description,Specifications,Features,Resources,Resource Link",
  "128,\"Moves boxes, coolers, and files.\",\"Capacity:600 lb\",\"Powder-coated finish\",\"Manual\",\"https://example.com/manual.pdf\"",
  "128,,\"Color:Black\",\"Pneumatic tires\",\"Unsafe\",\"javascript:alert(1)\"",
  "128,,\"Color:Black\",\"Pneumatic tires\",\"Manual\",\"https://example.com/manual.pdf\"",
  "128,,,\"Powder coated finish\",,",
  "129,\"Another product\",,,,",
  ""
].join("\n");

function mockResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    write(value) {
      this.body += value || "";
    },
    end(value) {
      this.body += value || "";
    }
  };
}

test("server parser returns one safe, deduplicated product payload", () => {
  const content = handler._test.contentFromCsv(SAMPLE_CSV, "128");

  assert.equal(content.productId, "128");
  assert.equal(content.description, "Moves boxes, coolers, and files.");
  assert.deepEqual(content.features, ["Powder-coated finish", "Pneumatic tires"]);
  assert.deepEqual(content.specifications, [
    { section: "Specifications", name: "Capacity", value: "600 lb" },
    { section: "Specifications", name: "Color", value: "Black" }
  ]);
  assert.deepEqual(content.resources, [
    { name: "Manual", url: "https://example.com/manual.pdf" }
  ]);
  assert.deepEqual(content.merchant.productHighlights, content.features);
  assert.equal(content.merchant.productDetails[0].attributeName, "Capacity");
});

test("sheet requests are product-scoped and never use the published full CSV", () => {
  const url = new URL(handler._test.buildSheetQueryUrl("128"));

  assert.equal(url.hostname, "docs.google.com");
  assert.equal(url.pathname.endsWith("/gviz/tq"), true);
  assert.equal(url.searchParams.get("tqx"), "out:csv");
  assert.equal(url.searchParams.get("tq"), "select A, B, C, D, E, F where A = 128");
  assert.equal(url.href.includes("/pub?output=csv"), false);
});

test("API validates IDs and caches successful product responses", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      status: 200,
      text: async () => SAMPLE_CSV
    };
  };
  handler._test.resetProductContentCache();

  try {
    const first = mockResponse();
    await handler({ method: "GET", query: { pid: "128" } }, first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers["X-WL-Content-Cache"], "MISS");
    assert.equal(JSON.parse(first.body).productId, "128");

    const second = mockResponse();
    await handler({ method: "GET", query: { pid: "128" } }, second);
    assert.equal(second.statusCode, 200);
    assert.equal(second.headers["X-WL-Content-Cache"], "HIT");
    assert.equal(fetchCount, 1);

    const invalid = mockResponse();
    await handler({ method: "GET", query: { pid: "128 OR 1=1" } }, invalid);
    assert.equal(invalid.statusCode, 400);
  } finally {
    global.fetch = originalFetch;
    handler._test.resetProductContentCache();
  }
});

test("browser normalizer rejects unsafe resources and schema merge is idempotent", () => {
  const content = browserContent.normalizeContent({
    productId: "128",
    descriptionParagraphs: ["A clear description.", "A clear description."],
    features: ["Feature one", "Feature one"],
    specifications: [
      { name: "Color", value: "Black" },
      { name: "", value: "ignored" }
    ],
    resources: [
      { name: "Manual", url: "https://example.com/manual.pdf" },
      { name: "Bad link", url: "javascript:alert(1)" }
    ]
  }, "128");
  const schema = {
    "@type": "Product",
    name: "Hand Truck",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Color", value: "Black" }
    ]
  };

  assert.deepEqual(content.descriptionParagraphs, ["A clear description."]);
  assert.deepEqual(content.features, ["Feature one"]);
  assert.equal(content.resources.length, 1);

  browserContent.mergeProductSchema(schema, content);
  browserContent.mergeProductSchema(schema, content);
  assert.equal(schema.description, "A clear description.");
  assert.equal(schema.additionalProperty.length, 1);
});

test("browser implementation avoids full-sheet downloads and HTML injection", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "ProductDescription.js"), "utf8");

  assert.doesNotMatch(source, /\/pub\?output=csv/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.match(source, /textContent\s*=/);
  assert.match(source, /google-sheet-fallback/);
});

test("content audit uses Merchant item IDs as the active-product authority", () => {
  const sourceCsv = [
    "Productid",
    "100",
    "100",
    "200",
    "400",
    ""
  ].join("\n");
  const merchantCsv = [
    "title,id,description",
    "First,100,First product",
    "Second,200,Second product",
    "Third,300,Third product",
    ""
  ].join("\n");

  assert.deepEqual(contentAudit.summarize(sourceCsv, merchantCsv), {
    sourceRows: 4,
    sourceProductCount: 3,
    merchantRows: 3,
    merchantProductCount: 3,
    productsWithContent: 2,
    missingContentProductCount: 1,
    staleContentProductCount: 1,
    missingContentSample: ["300"],
    staleContentSample: ["400"]
  });
});

test("content audit fails closed when the Merchant feed has no id column", () => {
  assert.throws(
    () => contentAudit.merchantProductIds("title,description\nProduct,Copy\n"),
    /missing its id column/
  );
  assert.throws(
    () => contentAudit.merchantFeedUrl({}),
    /MERCHANT_PRIMARY_FEED_URL must be configured/
  );
});

test("supplemental Merchant feed joins on id and emits customer content for product 128", () => {
  const merchantCsv = [
    "title,id,description",
    "Hand Truck,128,Primary feed copy",
    "Another product,130,Primary feed copy",
    ""
  ].join("\n");
  const contents = merchantFeed._test.merchantDescriptionRows(SAMPLE_CSV, merchantCsv, 1);
  const response = mockResponse();

  merchantFeed._test.writeMerchantCsv(response, contents);

  assert.deepEqual(contents.map((content) => content.id), ["128"]);
  assert.match(response.body, /^id,description\r\n/);
  assert.match(response.body, /"128","Moves boxes, coolers, and files\."/);
  assert.doesNotMatch(response.body, /"129",/);
  assert.doesNotMatch(response.body, /"130",/);
  assert.doesNotMatch(response.body, /javascript:/);
});

test("supplemental Merchant feed has stable two-part routing and safe CSV quoting", () => {
  assert.equal(merchantFeed._test.feedPart("128"), 1);
  assert.equal(merchantFeed._test.feedPart("129"), 2);
  assert.equal(merchantFeed._test.csvField('5" wide'), '"5"" wide"');
  assert.equal(
    merchantFeed._test.cleanMerchantDescription(`  ${"x".repeat(5001)}  `).length,
    5000
  );
  assert.throws(
    () => merchantFeed._test.requestedPart({ query: { part: "3" } }),
    /feed part from 1 to 2/
  );
});

test("supplemental Merchant endpoint validates its part and serves CSV", async () => {
  const originalFetch = global.fetch;
  const originalMerchantFeedUrl = process.env.MERCHANT_PRIMARY_FEED_URL;
  process.env.MERCHANT_PRIMARY_FEED_URL =
    "https://docs.google.com/spreadsheets/d/example/pub?gid=1216065562&output=csv";
  global.fetch = async (url) => ({
    ok: true,
    status: 200,
    text: async () => String(url).includes("gid=1216065562")
      ? "id,title\n128,Hand Truck\n"
      : SAMPLE_CSV
  });

  try {
    const valid = mockResponse();
    await merchantFeed({ method: "GET", query: { part: "1" } }, valid);
    assert.equal(valid.statusCode, 200);
    assert.equal(valid.headers["Content-Type"], "text/csv; charset=utf-8");
    assert.equal(valid.headers["X-WL-Feed-Part"], "1/2");
    assert.match(valid.body, /"128","Moves boxes, coolers, and files\."/);

    const invalid = mockResponse();
    await merchantFeed({ method: "GET", query: { part: "3" } }, invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.headers["Cache-Control"], "no-store");
  } finally {
    global.fetch = originalFetch;
    if (originalMerchantFeedUrl == null) {
      delete process.env.MERCHANT_PRIMARY_FEED_URL;
    } else {
      process.env.MERCHANT_PRIMARY_FEED_URL = originalMerchantFeedUrl;
    }
  }
});
