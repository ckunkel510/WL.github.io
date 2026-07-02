"use strict";

const crypto = require("node:crypto");
const { XMLParser } = require("fast-xml-parser");
const { RequestError, requestRates } = require("./ups-rates")._internal;

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

  const access = findNode(parsed, ["AccessRequest"]) || {};
  const rating = findNode(parsed, ["RatingServiceSelectionRequest", "RateRequest"]) || {};
  if (!Object.keys(rating).length) throw new RequestError(400, "UPS rating request is missing.");
  return { access, rating };
}

function authenticate(access) {
  const expectedUser = process.env.PROXY_USERNAME;
  const expectedPassword = process.env.PROXY_PASSWORD;
  const expectedLicense = process.env.PROXY_ACCESS_LICENSE;
  if (!expectedUser || !expectedPassword || !expectedLicense) {
    throw new RequestError(503, "WebTrack UPS proxy credentials are not configured.");
  }

  const valid = safeEqual(text(access.UserId), expectedUser) &&
    safeEqual(text(access.Password), expectedPassword) &&
    safeEqual(text(access.AccessLicenseNumber), expectedLicense);
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
  return {
    addressLine: asArray(address.AddressLine).map(text).filter(Boolean),
    city: text(address.City),
    state: text(address.StateProvinceCode),
    postalCode: text(address.PostalCode),
    country: text(address.CountryCode || "US"),
    residential: address.ResidentialAddressIndicator !== undefined
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
  const shipFromNode = shipment.ShipFrom || shipment.Shipper;
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
      shipFrom: addressFromLegacy(shipFromNode),
      shipTo: addressFromLegacy(shipment.ShipTo),
      packages
    }
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

  try {
    const { access, rating } = parseLegacyXml(await readBody(req));
    authenticate(access);
    const translated = toOAuthRequest(rating);
    const result = await requestRates(translated.body);
    return sendXml(res, 200, successXml(result, translated.context));
  } catch (error) {
    return sendXml(res, 200, errorXml(error));
  }
}

module.exports = handler;
module.exports._test = { authenticate, errorXml, parseLegacyXml, successXml, toOAuthRequest };
