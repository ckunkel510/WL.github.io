"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const upsRatesHandler = require("../api/ups-rates");
const { buildRateRequest, normalizeAddress, normalizePackages, normalizedRates } = upsRatesHandler._test;

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = String(value || ""); }
  };
}

test("fills in a US city and state from the postal code", () => {
  const address = normalizeAddress({ postalCode: "73102" }, "Ship-to");

  assert.equal(address.City, "Oklahoma City");
  assert.equal(address.StateProvinceCode, "OK");
  assert.equal(address.CountryCode, "US");
});

test("accepts WebTrack's full state names and verifies them from the ZIP", () => {
  const virginia = normalizeAddress({ city: "Richmond", state: "Virginia", postalCode: "23220" }, "Ship-to");
  const mismatched = normalizeAddress({ city: "Richmond", state: "CA", postalCode: "23220" }, "Ship-to");

  assert.equal(virginia.StateProvinceCode, "VA");
  assert.equal(mismatched.StateProvinceCode, "VA");
});

test("builds a UPS multi-package shop request", () => {
  process.env.UPS_ACCOUNT_NUMBER = "ABC123";
  const result = buildRateRequest({
    shipFrom: { city: "Brenham", state: "TX", postalCode: "77833" },
    shipTo: { city: "Austin", state: "TX", postalCode: "78701", residential: true },
    packages: [{ weight: 8, length: 12, width: 8, height: 6, quantity: 2 }]
  });

  assert.equal(result.packages.length, 2);
  assert.equal(result.payload.RateRequest.Shipment.NumOfPieces, "2");
  assert.equal(result.payload.RateRequest.Shipment.Shipper.ShipperNumber, "ABC123");
  assert.equal(result.payload.RateRequest.Request.RequestOption, "Shoptimeintransit");
  assert.deepEqual(result.payload.RateRequest.Shipment.DeliveryTimeInformation, { PackageBillType: "03" });
});

test("preserves carrier arrival and pickup basis separately for each service", () => {
  const rates = normalizedRates({ RateResponse: { RatedShipment: [
    { Service: { Code: "03" }, TotalCharges: { MonetaryValue: "18.50" }, TimeInTransit: { ServiceSummary: { EstimatedArrival: {
      BusinessDaysInTransit: "4", Pickup: { Date: "20261106" }, Arrival: { Date: "20261112" }
    } } } },
    { Service: { Code: "02" }, TotalCharges: { MonetaryValue: "42.00" }, GuaranteedDelivery: { BusinessDaysInTransit: "2" } }
  ] } });
  assert.deepEqual(rates[0].transit, { businessDays: 4, pickupDate: "2026-11-06", arrivalDate: "2026-11-12" });
  assert.deepEqual(rates[1].transit, { businessDays: 2 });
});

test("omits missing or malformed carrier dates without losing a usable shipping rate", () => {
  for (const estimate of [{}, { BusinessDaysInTransit: "", Pickup: { Date: "20260230" }, Arrival: { Date: "20260303" } },
    { BusinessDaysInTransit: "-1", Pickup: { Date: "20261106" }, Arrival: { Date: "20261105" } }]) {
    const [rate] = normalizedRates({ RateResponse: { RatedShipment: {
      Service: { Code: "03" }, TotalCharges: { MonetaryValue: "18.50" }, TimeInTransit: { ServiceSummary: { EstimatedArrival: estimate } }
    } } });
    assert.equal(rate.amount, 18.5); assert.equal(rate.transit, undefined);
  }
});

test("requests rates and transit in one carrier call and retains rates when transit is absent", async () => {
  const previousFetch = global.fetch;
  const before = Object.fromEntries(["UPS_CLIENT_ID", "UPS_CLIENT_SECRET", "UPS_ACCOUNT_NUMBER"].map(key => [key, process.env[key]]));
  const calls = [];
  Object.assign(process.env, { UPS_CLIENT_ID: "test-client", UPS_CLIENT_SECRET: "test-secret", UPS_ACCOUNT_NUMBER: "test-account" });
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => String(url).includes("oauth/token") ? { access_token: "test-token", expires_in: 3600 } :
      { RateResponse: { RatedShipment: { Service: { Code: "03" }, TotalCharges: { MonetaryValue: "18.50" } } } } };
  };
  try {
    const result = await upsRatesHandler._internal.requestRates({ shipFrom: { postalCode: "77833" }, shipTo: { postalCode: "10520" }, packages: [{ weight: 2 }] });
    assert.equal(result.rates[0].amount, 18.5);
    assert.equal(calls.filter(call => /\/rating\//.test(call.url)).length, 1);
    assert.match(calls.at(-1).url, /\/rating\/v2409\/Shoptimeintransit$/);
    assert.equal(JSON.parse(calls.at(-1).options.body).RateRequest.Request.RequestOption, "Shoptimeintransit");
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("rejects packages beyond UPS small-package dimensions", () => {
  assert.throws(
    () => normalizePackages([{ weight: 10, length: 108, width: 30, height: 10 }]),
    /exceeds UPS small-package dimensions/
  );
});

test("prefers negotiated charges and sorts rates by amount", () => {
  const rates = normalizedRates({
    RateResponse: {
      RatedShipment: [
        { Service: { Code: "02" }, TotalCharges: { CurrencyCode: "USD", MonetaryValue: "42.00" } },
        {
          Service: { Code: "03" },
          TotalCharges: { CurrencyCode: "USD", MonetaryValue: "24.00" },
          NegotiatedRateCharges: { TotalCharge: { CurrencyCode: "USD", MonetaryValue: "18.50" } }
        }
      ]
    }
  });

  assert.deepEqual(rates.map((rate) => rate.amount), [18.5, 42]);
  assert.equal(rates[0].serviceName, "UPS Ground");
});

test("a cart cannot bypass trusted dimensions with browser-supplied packages", async () => {
  const response = responseCapture();
  await upsRatesHandler({
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.42" },
    body: {
      shipFrom: { postalCode: "77833" },
      shipTo: { postalCode: "23220" },
      cart: [{ productId: "187017", productCode: "HOGRBP636", quantity: 1 }],
      packages: [{ weight: 1.15, length: 5.16, width: 23.19, height: 13.46 }]
    }
  }, response);

  assert.equal(response.statusCode, 422);
  const payload = JSON.parse(response.body);
  assert.equal(payload.shippingIssues[0].productCode, "HOGRBP636");
  assert.match(payload.error, /cannot be shipped/i);
});
