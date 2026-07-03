"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/special-order-designer");
const probeV2Handler = require("../api/special-order-probe-v2");
const { renderPage, requestContext, requestTrace } = handler._test;

function mockResponse() {
  const headers = {};
  return {
    headers,
    statusCode: 0,
    body: undefined,
    setHeader(name, value) { headers[name] = value; },
    end(value) { this.body = value; }
  };
}

test("keeps only safe WebTrack product context", () => {
  const context = requestContext({
    method: "GET",
    query: {
      productid: "245809",
      productcode: "WDoor",
      qty: "1",
      email: "customer@example.com"
    }
  });

  assert.equal(context.productId, "245809");
  assert.equal(context.productCode, "WDoor");
  assert.equal(context.quantity, "1");
  assert.deepEqual(context.unknownKeys, ["email"]);
  assert.doesNotMatch(JSON.stringify(context), /customer@example\.com/);
});

test("escapes product values in the configurator page", () => {
  const html = renderPage({
    method: "GET",
    productId: "<script>alert(1)</script>",
    productCode: "WDoor",
    quantity: "1",
    receivedKeys: [],
    unknownKeys: []
  });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("records only safe request transport metadata", () => {
  const context = requestContext({
    method: "GET",
    query: { productid: "245809", productcode: "WDoor", qty: "1" }
  });
  const trace = requestTrace({
    headers: {
      accept: "text/html",
      referer: "https://webtrack.woodsonlumber.com/Catalog/SpecialOrder.aspx?customer=private",
      "sec-fetch-dest": "iframe",
      cookie: "secret-session"
    }
  }, context);

  assert.equal(trace.referrerOrigin, "https://webtrack.woodsonlumber.com");
  assert.equal(trace.fetchDestination, "iframe");
  assert.doesNotMatch(JSON.stringify(trace), /private|secret-session/);
});

test("serves a non-cached frame-compatible configurator", () => {
  const req = {
    method: "GET",
    query: { productid: "245809", productcode: "WDoor", qty: "1" },
    headers: { origin: "https://webtrack.woodsonlumber.com" }
  };
  const res = mockResponse();

  handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://webtrack.woodsonlumber.com");
  assert.match(res.headers["Content-Security-Policy"], /frame-ancestors https:\/\/webtrack\.woodsonlumber\.com/);
  assert.match(res.body, /Configure your item/);
  assert.match(res.body, /woodson-special-order-complete/);
  assert.match(res.body, /sID: serverContext\.productId/);
  assert.match(res.body, /WDoor/);
});

test("serves the same probe from the cache-busting route", () => {
  assert.equal(probeV2Handler, handler);
});
