"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRateRequest, normalizeAddress, normalizePackages, normalizedRates } = require("../api/ups-rates")._test;

test("fills in a US city and state from the postal code", () => {
  const address = normalizeAddress({ postalCode: "73102" }, "Ship-to");

  assert.equal(address.City, "Oklahoma City");
  assert.equal(address.StateProvinceCode, "OK");
  assert.equal(address.CountryCode, "US");
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
