"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLegacyXml, successXml, toOAuthRequest } = require("../api/rate")._test;

const requestXml = `<?xml version="1.0"?>
<AccessRequest>
  <AccessLicenseNumber>proxy</AccessLicenseNumber>
  <UserId>woodson</UserId>
  <Password>secret</Password>
</AccessRequest>
<?xml version="1.0"?>
<RatingServiceSelectionRequest>
  <Request>
    <TransactionReference><CustomerContext>WebTrack cart 123</CustomerContext></TransactionReference>
    <RequestAction>Rate</RequestAction>
    <RequestOption>Shop</RequestOption>
  </Request>
  <Shipment>
    <Shipper><Address><City>Brenham</City><StateProvinceCode>TX</StateProvinceCode><PostalCode>77833</PostalCode><CountryCode>US</CountryCode></Address></Shipper>
    <ShipTo><Address><City>Austin</City><StateProvinceCode>TX</StateProvinceCode><PostalCode>78701</PostalCode><CountryCode>US</CountryCode><ResidentialAddressIndicator/></Address></ShipTo>
    <Package>
      <Dimensions><UnitOfMeasurement><Code>IN</Code></UnitOfMeasurement><Length>12</Length><Width>8</Width><Height>6</Height></Dimensions>
      <PackageWeight><UnitOfMeasurement><Code>LBS</Code></UnitOfMeasurement><Weight>8</Weight></PackageWeight>
    </Package>
  </Shipment>
</RatingServiceSelectionRequest>`;

test("parses concatenated legacy UPS XML documents", () => {
  const parsed = parseLegacyXml(requestXml);
  assert.equal(parsed.access.UserId, "woodson");
  assert.equal(parsed.rating.Request.RequestOption, "Shop");
});

test("parses a namespaced SOAP-wrapped legacy request", () => {
  const soapXml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
      <AccessRequest><AccessLicenseNumber>proxy</AccessLicenseNumber><UserId>woodson</UserId><Password>secret</Password></AccessRequest>
    </soap:Header>
    <soap:Body>${requestXml.match(/<RatingServiceSelectionRequest>[\s\S]*<\/RatingServiceSelectionRequest>/)[0]}</soap:Body>
  </soap:Envelope>`;
  const parsed = parseLegacyXml(soapXml);
  assert.equal(parsed.access.UserId, "woodson");
  assert.equal(parsed.rating.Request.RequestOption, "Shop");
});

test("translates legacy UPS shipment fields", () => {
  const { rating } = parseLegacyXml(requestXml);
  const translated = toOAuthRequest(rating);
  assert.equal(translated.context, "WebTrack cart 123");
  assert.equal(translated.body.shipFrom.postalCode, "77833");
  assert.equal(translated.body.shipTo.residential, true);
  assert.deepEqual(translated.body.packages[0], { weight: 8, length: 12, width: 8, height: 6 });
});

test("returns legacy rated-shipment XML", () => {
  const xml = successXml({
    rates: [{ serviceCode: "03", serviceName: "UPS Ground", currency: "USD", amount: 12.34, billingWeight: 8 }]
  }, "WebTrack cart 123");
  assert.match(xml, /<ResponseStatusCode>1<\/ResponseStatusCode>/);
  assert.match(xml, /<Code>03<\/Code>/);
  assert.match(xml, /<MonetaryValue>12\.34<\/MonetaryValue>/);
});
