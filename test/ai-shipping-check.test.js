"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const shippingCheck = require("../api/ai-shipping-check")._test;
const { ShippingEligibilityError } = require("../api/shipping-quote");

test("uses Caldwell as the fixed AI shipping origin and returns only customer-safe rates", async () => {
  let received = null;
  const response = await shippingCheck.checkProductShipping({
    productCode: "2904-22",
    productId: "221283",
    quantity: 2,
    destinationPostalCode: "43215"
  }, {
    buildAutomaticShippingQuote: async (body, dependencies) => {
      received = { body, dependencies };
      return {
        result: {
          quoteId: "public-quote",
          expiresAt: "2026-09-24T20:15:00.000Z",
          rates: [
            { serviceCode: "02", serviceName: "UPS 2nd Day Air", amount: 42.5, currency: "USD", billingWeight: 99 },
            { serviceCode: "03", serviceName: "UPS Ground", amount: 14.95, currency: "USD", billingWeight: 99 }
          ],
          shippingOffer: { protectedMargin: 0.22 },
          packagePlan: { totalWeight: 99 }
        },
        claim: {
          basis: { rawCogs: 100 },
          packages: [{ weight: 99, length: 10, width: 10, height: 10 }]
        }
      };
    },
    requestRates: async () => ({ rates: [] })
  });

  assert.deepEqual(received.body.shipFrom, {
    name: "Caldwell",
    city: "Caldwell",
    state: "TX",
    postalCode: "77836",
    country: "US"
  });
  assert.deepEqual(received.body.shipTo, { postalCode: "43215", country: "US" });
  assert.deepEqual(received.body.cart, [{
    productId: "221283",
    productCode: "2904-22",
    quantity: 2
  }]);
  assert.equal(typeof received.dependencies.requestRates, "function");
  assert.equal(response.eligible, true);
  assert.equal(response.status, "eligible");
  assert.equal(response.lowestRate.serviceName, "UPS Ground");
  assert.equal(response.lowestRate.amount, 14.95);
  assert.match(response.answer, /UPS shipping from Caldwell/i);
  assert.match(response.answer, /ZIP 43215/);
  assert.doesNotMatch(JSON.stringify(response), /rawCogs|protectedMargin|packagePlan|billingWeight|weight|length|width|height/);
});

test("treats missing or reviewed package data as staff review instead of unshippable", async () => {
  const error = new ShippingEligibilityError([{
    productCode: "HOGRBP636",
    reason: "package-data-review",
    message: "Internal detail that must not be returned."
  }]);
  const response = await shippingCheck.checkProductShipping({
    productCode: "HOGRBP636",
    quantity: 1,
    destinationPostalCode: "78701"
  }, {
    buildAutomaticShippingQuote: async () => { throw error; }
  });

  assert.equal(response.eligible, false);
  assert.equal(response.status, "needs_review");
  assert.deepEqual(response.reasonCodes, ["package-data-review"]);
  assert.match(response.answer, /did not treat that as proof the item cannot be shipped/i);
  assert.doesNotMatch(response.answer, /Internal detail/);
});

test("does not describe a temporary UPS failure as an ineligible product", async () => {
  const response = await shippingCheck.checkProductShipping({
    productCode: "2904-22",
    quantity: 1,
    destinationPostalCode: "78701"
  }, {
    buildAutomaticShippingQuote: async () => { throw new Error("UPS timeout with secret diagnostics"); }
  });

  assert.equal(response.success, false);
  assert.equal(response.eligible, null);
  assert.equal(response.status, "temporarily_unavailable");
  assert.match(response.answer, /not concluded that the item cannot ship/i);
  assert.doesNotMatch(response.answer, /secret diagnostics/);
});

test("distinguishes an unavailable UPS package plan from a temporary service failure", async () => {
  const response = await shippingCheck.checkProductShipping({
    productCode: "BULKY-100",
    quantity: 1,
    destinationPostalCode: "78701"
  }, {
    buildAutomaticShippingQuote: async () => {
      throw new Error("The cart could not be packed for UPS shipping.");
    }
  });

  assert.equal(response.success, true);
  assert.equal(response.eligible, false);
  assert.equal(response.status, "not_eligible");
  assert.match(response.answer, /UPS small-package shipping.*is not available/i);
  assert.match(response.answer, /Woodson delivery, freight/i);
});

test("requires an exact product, bounded quantity, and destination ZIP", () => {
  assert.throws(
    () => shippingCheck.normalizedRequest({ quantity: 1, destinationPostalCode: "78701" }),
    /exact Woodson product code/i
  );
  assert.throws(
    () => shippingCheck.normalizedRequest({ productCode: "2904-22", quantity: 26, destinationPostalCode: "78701" }),
    /between 1 and 25/i
  );
  assert.throws(
    () => shippingCheck.normalizedRequest({ productCode: "2904-22", quantity: 1, destinationPostalCode: "Texas" }),
    /valid destination ZIP/i
  );
});

test("accepts server-to-server calls and only allows Woodson browser origins", () => {
  const headers = {};
  const res = { setHeader(name, value) { headers[name] = value; } };

  assert.equal(shippingCheck.applyCors({ headers: {} }, res), true);
  assert.equal(shippingCheck.applyCors({ headers: { origin: "https://webtrack.woodsonlumber.com" } }, res), true);
  assert.equal(headers["Access-Control-Allow-Origin"], "https://webtrack.woodsonlumber.com");
  assert.equal(shippingCheck.applyCors({ headers: { origin: "https://evil.example" } }, res), false);
});
