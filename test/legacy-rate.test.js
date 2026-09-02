"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const rateHandler = require("../api/rate");
const { fulfillmentResult, legacyPromotionInput, parseLegacyXml, safePositiveRates, soapSuccessXml, successXml, toOAuthRequest } = rateHandler._test;

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
      <UPSSecurity>
        <UsernameToken><Username>woodson</Username><Password>secret</Password></UsernameToken>
        <ServiceAccessToken><AccessLicenseNumber>proxy</AccessLicenseNumber></ServiceAccessToken>
      </UPSSecurity>
    </soap:Header>
    <soap:Body>${requestXml.match(/<RatingServiceSelectionRequest>[\s\S]*<\/RatingServiceSelectionRequest>/)[0]}</soap:Body>
  </soap:Envelope>`;
  const parsed = parseLegacyXml(soapXml);
  assert.equal(parsed.isSoap, true);
  assert.equal(parsed.access.UsernameToken.Username, "woodson");
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

test("recovers omitted US states from postal codes", () => {
  const xmlWithoutStates = requestXml.replace(/<StateProvinceCode>[^<]+<\/StateProvinceCode>/g, "");
  const { rating } = parseLegacyXml(xmlWithoutStates);
  const translated = toOAuthRequest(rating);
  assert.equal(translated.body.shipFrom.state, "TX");
  assert.equal(translated.body.shipTo.state, "TX");
});

test("recovers a state when WebTrack sends a nonstandard US country value", () => {
  const xmlWithLongCountry = requestXml
    .replace(/<StateProvinceCode>[^<]+<\/StateProvinceCode>/g, "")
    .replace(/<CountryCode>US<\/CountryCode>/g, "<CountryCode>USA</CountryCode>");
  const { rating } = parseLegacyXml(xmlWithLongCountry);
  const translated = toOAuthRequest(rating);
  assert.equal(translated.body.shipTo.state, "TX");
  assert.equal(translated.body.shipTo.country, "US");
});

test("falls back to Shipper when WebTrack sends an empty ShipFrom", () => {
  const xmlWithEmptyShipFrom = requestXml.replace("</ShipTo>", "</ShipTo><ShipFrom/>");
  const { rating } = parseLegacyXml(xmlWithEmptyShipFrom);
  const translated = toOAuthRequest(rating);
  assert.equal(translated.body.shipFrom.city, "Brenham");
  assert.equal(translated.body.shipFrom.postalCode, "77833");
});

test("defaults a state-less Woodson origin to Texas", () => {
  const xmlWithoutOriginState = requestXml
    .replace("<StateProvinceCode>TX</StateProvinceCode><PostalCode>77833</PostalCode>", "<PostalCode>00000</PostalCode>")
    .replace("</ShipTo>", "</ShipTo><ShipFrom/>");
  const { rating } = parseLegacyXml(xmlWithoutOriginState);
  const translated = toOAuthRequest(rating);
  assert.equal(translated.body.shipFrom.state, "TX");
});

test("returns legacy rated-shipment XML", () => {
  const xml = successXml({
    rates: [{ serviceCode: "03", serviceName: "UPS Ground", currency: "USD", amount: 12.34, billingWeight: 8 }]
  }, "WebTrack cart 123");
  assert.match(xml, /<ResponseStatusCode>1<\/ResponseStatusCode>/);
  assert.match(xml, /<Code>03<\/Code>/);
  assert.match(xml, /<MonetaryValue>12\.34<\/MonetaryValue>/);
});

test("reads explicit shipping promo context from a legacy rate URL", () => {
  const { rating } = parseLegacyXml(requestXml);
  const promo = legacyPromotionInput({ url: "/api/rate?promoCode=SummerChill26&promoEligible=1" }, rating);

  assert.equal(promo.code, "SummerChill26");
  assert.equal(promo.eligible, true);
});

test("does not infer shipping promo eligibility from a normal legacy request", () => {
  const { rating } = parseLegacyXml(requestXml);
  const promo = legacyPromotionInput({ url: "/api/rate" }, rating);

  assert.equal(promo.code, "");
  assert.equal(promo.eligible, false);
});

test("returns a UPS Rate v1.1 SOAP response", () => {
  const xml = soapSuccessXml({
    rates: [{ serviceCode: "03", serviceName: "UPS Ground", currency: "USD", amount: 12.34, billingWeight: 8 }]
  }, "WebTrack cart 123");
  assert.match(xml, /<soapenv:Envelope/);
  assert.match(xml, /<rate:RateResponse xmlns:rate="http:\/\/www\.ups\.com\/XMLSchema\/XOLTWS\/Rate\/v1\.1">/);
  assert.match(xml, /<common:ResponseStatus>/);
  assert.match(xml, /<rate:Code>03<\/rate:Code>/);
  assert.match(xml, /<rate:MonetaryValue>12\.34<\/rate:MonetaryValue>/);
});

test("converts a Woodson fulfillment claim into a legacy-compatible positive rate", () => {
  const result = fulfillmentResult({
    totalWeight: 1200,
    recommendation: { mode: "delivery" },
    rates: [{ serviceCode: "03", serviceName: "Woodson Local Delivery", amount: 25, currency: "USD" }]
  });
  assert.equal(result.rates[0].serviceName, "Woodson Local Delivery");
  assert.equal(result.rates[0].amount, 25);
});

test("drops zero and negative rates unless an explicit promotion is later applied", () => {
  const result = safePositiveRates({
    rates: [
      { serviceCode: "03", amount: -25 },
      { serviceCode: "02", amount: 0 },
      { serviceCode: "12", amount: 15 }
    ]
  });
  assert.deepEqual(result.rates.map((rate) => rate.amount), [15]);
});

test("the WebTrack rate bridge refuses checkout without a current positive claim", async () => {
  const previous = {
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    license: process.env.PROXY_ACCESS_LICENSE
  };
  process.env.PROXY_USERNAME = "woodson";
  process.env.PROXY_PASSWORD = "secret";
  process.env.PROXY_ACCESS_LICENSE = "proxy";
  const response = {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = String(value || ""); }
  };

  try {
    await rateHandler({ method: "POST", headers: {}, body: requestXml }, response);
  } finally {
    if (previous.username === undefined) delete process.env.PROXY_USERNAME;
    else process.env.PROXY_USERNAME = previous.username;
    if (previous.password === undefined) delete process.env.PROXY_PASSWORD;
    else process.env.PROXY_PASSWORD = previous.password;
    if (previous.license === undefined) delete process.env.PROXY_ACCESS_LICENSE;
    else process.env.PROXY_ACCESS_LICENSE = previous.license;
  }

  assert.equal(response.statusCode, 200, "legacy UPS XML errors stay HTTP-compatible with WebTrack");
  assert.match(response.body, /ResponseStatusCode>0/);
  assert.match(response.body, /current positive fulfillment quote is required/i);
});
