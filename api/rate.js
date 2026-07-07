"use strict";

const crypto = require("node:crypto");
const { XMLParser } = require("fast-xml-parser");
const zipcodes = require("zipcodes");
const { RequestError, requestRates } = require("./ups-rates")._internal;
const { applyFreeGroundPromotion } = require("./shipping-promotions");

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object" && "#text" in value) return String(value["#text"] || "").trim();
  return String(value).trim();
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function findNode(root, names, depth = 0) {
  if (!root || typeof root !== "object" || depth > 12) return undefined;
  const wanted = new Set(names);
  for (const [key, value] of Object.entries(root)) {
    const localName = key.includes(":") ? key.split(":").pop() : key;
    if (wanted.has(localName)) return value;
  }
  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;
    const found = findNode(value, names, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function collectTextValues(root, depth = 0, result = []) {
  if (root === undefined || root === null || depth > 12) return result;
  if (typeof root !== "object") {
    const value = text(root);
    if (value) result.push(value);
    return result;
  }
  if ("#text" in root) {
    const value = text(root["#text"]);
    if (value) result.push(value);
  }
  for (const value of Object.values(root)) collectTextValues(value, depth + 1, result);
  return result;
}

function parseLegacyXml(raw) {
  const source = String(raw || "").trim();
  if (!source || source.length > 256000) throw new RequestError(400, "UPS XML request is empty or too large.");
  const withoutDeclarations = source.replace(/<\?xml[^>]*\?>/gi, "");
  let parsed;
  try {
    parsed = parser.parse(`<Envelope>${withoutDeclarations}</Envelope>`).Envelope || {};
  } catch {
    throw new RequestError(400, "UPS XML request could not be parsed.");
  }

  const access = findNode(parsed, ["AccessRequest", "UPSSecurity"]) || {};
  const rating = findNode(parsed, ["RatingServiceSelectionRequest", "RateRequest"]) || {};
  if (!Object.keys(rating).length) throw new RequestError(400, "UPS rating request is missing.");
  return { access, rating, isSoap: /<\s*(?:[\w.-]+:)?Envelope\b/i.test(withoutDeclarations) };
}

function authenticate(access) {
  const expectedUser = process.env.PROXY_USERNAME;
  const expectedPassword = process.env.PROXY_PASSWORD;
  const expectedLicense = process.env.PROXY_ACCESS_LICENSE;
  if (!expectedUser || !expectedPassword || !expectedLicense) {
    throw new RequestError(503, "WebTrack UPS proxy credentials are not configured.");
  }

  const requestUser = text(access.UserId || findNode(access, ["Username"]));
  const requestPassword = text(access.Password || findNode(access, ["Password"]));
  const requestLicense = text(access.AccessLicenseNumber || findNode(access, ["AccessLicenseNumber"]));
  const valid = safeEqual(requestUser, expectedUser) &&
    safeEqual(requestPassword, expectedPassword) &&
    safeEqual(requestLicense, expectedLicense);
  if (!valid) throw new RequestError(401, "WebTrack UPS proxy credentials are invalid.");
}

function unitCode(node, fallback) {
  return text(node?.UnitOfMeasurement?.Code || node?.Code || fallback).toUpperCase();
}

function pounds(value, unit) {
  const amount = Number(text(value));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return unit === "KGS" || unit === "KG" ? amount * 2.2046226218 : amount;
}

function inches(value, unit) {
  const amount = Number(text(value));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return unit === "CM" ? amount / 2.54 : amount;
}

function addressFromLegacy(node) {
  const address = node?.Address || node || {};
  const postalCode = text(address.PostalCode);
  const country = text(address.CountryCode || "US");
  const postalPrefix = postalCode.match(/\d{5}/)?.[0] || "";
  const postalMatch = postalPrefix ? zipcodes.lookup(postalPrefix) : null;
  return {
    addressLine: asArray(address.AddressLine).map(text).filter(Boolean),
    city: text(address.City) || postalMatch?.city || "",
    state: text(address.StateProvinceCode) || postalMatch?.state || "",
    postalCode,
    country: postalMatch ? "US" : country,
    residential: address.ResidentialAddressIndicator !== undefined
  };
}

function mergeAddresses(primary, fallback) {
  return {
    addressLine: primary.addressLine.length ? primary.addressLine : fallback.addressLine,
    city: primary.city || fallback.city,
    state: primary.state || fallback.state,
    postalCode: primary.postalCode || fallback.postalCode,
    country: primary.country || fallback.country,
    residential: primary.residential || fallback.residential
  };
}

function packageFromLegacy(node, index) {
  const packageWeight = node?.PackageWeight || {};
  const weight = pounds(packageWeight.Weight, unitCode(packageWeight, "LBS"));
  if (!weight) throw new RequestError(400, `Package ${index + 1} weight is required.`);

  const dimensions = node?.Dimensions || {};
  const dimensionUnit = unitCode(dimensions, "IN");
  const length = inches(dimensions.Length, dimensionUnit);
  const width = inches(dimensions.Width, dimensionUnit);
  const height = inches(dimensions.Height, dimensionUnit);
  const result = { weight };
  if (length && width && height) Object.assign(result, { length, width, height });
  return result;
}

function toOAuthRequest(rating) {
  const shipment = rating.Shipment || {};
  const shipFrom = mergeAddresses(
    addressFromLegacy(shipment.ShipFrom),
    addressFromLegacy(shipment.Shipper)
  );
  if (!shipFrom.state) shipFrom.state = "TX";
  const packages = asArray(shipment.Package).map(packageFromLegacy);
  if (!packages.length && shipment.ShipmentTotalWeight?.Weight) {
    packages.push({
      weight: pounds(
        shipment.ShipmentTotalWeight.Weight,
        unitCode(shipment.ShipmentTotalWeight, "LBS")
      )
    });
  }
  if (!packages.length) throw new RequestError(400, "At least one package is required.");

  return {
    context: text(rating.Request?.TransactionReference?.CustomerContext) || "Woodson WebTrack UPS request",
    body: {
      shipFrom,
      shipTo: addressFromLegacy(shipment.ShipTo),
      packages
    }
  };
}

function legacyPromotionInput(req, rating) {
  let params = null;
  try { params = new URL(req.url || "/", "https://woodson.local").searchParams; } catch {}
  const queryCode = params?.get("promoCode") || params?.get("promo") || params?.get("coupon") || "";
  const queryEligible = /^(1|true|yes|y)$/i.test(params?.get("promoEligible") || params?.get("eligible") || "");
  const nodeCode = text(
    findNode(rating, ["PromotionCode", "PromoCode", "CouponCode", "DiscountCode", "ShippingPromoCode"])
  );
  const textValues = collectTextValues(rating);
  const joined = textValues.join(" ");
  const contextCode = (joined.match(/\bSummerChill26\b/i) || [])[0] || "";
  const eligibleByContext = /\bWL_PROMO_ELIGIBLE\b/i.test(joined) || /\bpromoEligible\s*[:=]\s*(?:1|true|yes)\b/i.test(joined);

  return {
    code: queryCode || nodeCode || contextCode,
    eligible: queryEligible || eligibleByContext
  };
}

function successXml(result, context) {
  const shipments = result.rates.map((rate) => `
  <RatedShipment>
    <Service>
      <Code>${escapeXml(rate.serviceCode)}</Code>
      <Description>${escapeXml(rate.serviceName)}</Description>
    </Service>
    <BillingWeight>
      <UnitOfMeasurement><Code>LBS</Code></UnitOfMeasurement>
      <Weight>${Number(rate.billingWeight || 0).toFixed(1)}</Weight>
    </BillingWeight>
    <TransportationCharges>
      <CurrencyCode>${escapeXml(rate.currency)}</CurrencyCode>
      <MonetaryValue>${Number(rate.amount).toFixed(2)}</MonetaryValue>
    </TransportationCharges>
    <ServiceOptionsCharges>
      <CurrencyCode>${escapeXml(rate.currency)}</CurrencyCode>
      <MonetaryValue>0.00</MonetaryValue>
    </ServiceOptionsCharges>
    <TotalCharges>
      <CurrencyCode>${escapeXml(rate.currency)}</CurrencyCode>
      <MonetaryValue>${Number(rate.amount).toFixed(2)}</MonetaryValue>
    </TotalCharges>
  </RatedShipment>`).join("");

  return `<?xml version="1.0"?>
<RatingServiceSelectionResponse>
  <Response>
    <TransactionReference><CustomerContext>${escapeXml(context)}</CustomerContext></TransactionReference>
    <ResponseStatusCode>1</ResponseStatusCode>
    <ResponseStatusDescription>Success</ResponseStatusDescription>
  </Response>${shipments}
</RatingServiceSelectionResponse>`;
}

function errorXml(error) {
  const status = error instanceof RequestError ? error.status : 500;
  const code = status === 401 ? "250003" : status === 503 ? "250050" : "111057";
  const message = error instanceof Error ? error.message : "UPS rating is temporarily unavailable.";
  return `<?xml version="1.0"?>
<RatingServiceSelectionResponse>
  <Response>
    <ResponseStatusCode>0</ResponseStatusCode>
    <ResponseStatusDescription>Failure</ResponseStatusDescription>
    <Error>
      <ErrorSeverity>Hard</ErrorSeverity>
      <ErrorCode>${code}</ErrorCode>
      <ErrorDescription>${escapeXml(message)}</ErrorDescription>
    </Error>
  </Response>
</RatingServiceSelectionResponse>`;
}

function soapSuccessXml(result, context) {
  const shipments = result.rates.map((rate) => `
      <rate:RatedShipment>
        <rate:Service>
          <rate:Code>${escapeXml(rate.serviceCode)}</rate:Code>
          <rate:Description>${escapeXml(rate.serviceName)}</rate:Description>
        </rate:Service>
        <rate:BillingWeight>
          <rate:UnitOfMeasurement>
            <rate:Code>LBS</rate:Code>
            <rate:Description>Pounds</rate:Description>
          </rate:UnitOfMeasurement>
          <rate:Weight>${Number(rate.billingWeight || 0).toFixed(1)}</rate:Weight>
        </rate:BillingWeight>
        <rate:TransportationCharges>
          <rate:CurrencyCode>${escapeXml(rate.currency)}</rate:CurrencyCode>
          <rate:MonetaryValue>${Number(rate.amount).toFixed(2)}</rate:MonetaryValue>
        </rate:TransportationCharges>
        <rate:ServiceOptionsCharges>
          <rate:CurrencyCode>${escapeXml(rate.currency)}</rate:CurrencyCode>
          <rate:MonetaryValue>0.00</rate:MonetaryValue>
        </rate:ServiceOptionsCharges>
        <rate:TotalCharges>
          <rate:CurrencyCode>${escapeXml(rate.currency)}</rate:CurrencyCode>
          <rate:MonetaryValue>${Number(rate.amount).toFixed(2)}</rate:MonetaryValue>
        </rate:TotalCharges>
      </rate:RatedShipment>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <rate:RateResponse xmlns:rate="http://www.ups.com/XMLSchema/XOLTWS/Rate/v1.1">
      <common:Response xmlns:common="http://www.ups.com/XMLSchema/XOLTWS/Common/v1.0">
        <common:ResponseStatus>
          <common:Code>1</common:Code>
          <common:Description>Success</common:Description>
        </common:ResponseStatus>
        <common:TransactionReference>
          <common:CustomerContext>${escapeXml(context)}</common:CustomerContext>
        </common:TransactionReference>
      </common:Response>${shipments}
    </rate:RateResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function soapErrorXml(error) {
  const message = error instanceof Error ? error.message : "UPS rating is temporarily unavailable.";
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>soapenv:Server</faultcode>
      <faultstring>${escapeXml(message)}</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function sendXml(res, status, xml) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(xml);
}

async function readBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function handler(req, res) {
  if (req.method !== "POST") return sendXml(res, 405, errorXml(new RequestError(405, "POST is required.")));

  let isSoap = false;
  try {
    const raw = await readBody(req);
    isSoap = /<\s*(?:[\w.-]+:)?Envelope\b/i.test(raw) || Boolean(req.headers.soapaction);
    const { access, rating } = parseLegacyXml(raw);
    authenticate(access);
    const translated = toOAuthRequest(rating);
    const rated = await requestRates(translated.body);
    const promoInput = legacyPromotionInput(req, rating);
    const { result } = applyFreeGroundPromotion(rated, promoInput);
    return sendXml(res, 200, isSoap ? soapSuccessXml(result, translated.context) : successXml(result, translated.context));
  } catch (error) {
    return sendXml(res, 200, isSoap ? soapErrorXml(error) : errorXml(error));
  }
}

module.exports = handler;
module.exports._test = { authenticate, errorXml, legacyPromotionInput, parseLegacyXml, soapSuccessXml, successXml, toOAuthRequest };
