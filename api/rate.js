"use strict";

const crypto = require("node:crypto");
const { XMLParser } = require("fast-xml-parser");
const zipcodes = require("zipcodes");
const { RequestError, requestRates } = require("./ups-rates")._internal;
const { applyFreeGroundPromotion, cartHasEligibleProduct, promoCodeMatches } = require("./shipping-promotions");
const { findPromoClaim, storePromoClaim } = require("./shipping-promo-sessions");

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true
});

const DEFAULT_ORIGINS = [
  "https://webtrack.woodsonlumber.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

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

function allowedOrigins() {
  const configured = String(process.env.UPS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (!origin) {
    return process.env.VERCEL_ENV !== "production" || process.env.UPS_ALLOW_NO_ORIGIN === "true";
  }
  if (allowedOrigins().has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  return allowedOrigins().has(origin);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function isPromoSessionRequest(req) {
  let params = null;
  try { params = new URL(req.url || "/", "https://woodson.local").searchParams; } catch {}
  const contentType = String(req.headers["content-type"] || "");
  return params?.get("promoSession") === "1" || /\bapplication\/json\b/i.test(contentType);
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

async function handlePromoSession(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(await readBody(req) || "{}");
    const cart = Array.isArray(body.cart) ? body.cart : [];
    if (!promoCodeMatches(body.code)) throw new RequestError(400, "Promo code was not recognized.");
    if (!cartHasEligibleProduct(cart)) throw new RequestError(400, "This promo is not available for the current cart.");
    const stored = await storePromoClaim({
      code: body.code,
      eligible: true,
      cart,
      cartSignature: body.cartSignature,
      shipTo: body.shipTo,
      packages: body.packages
    });
    if (!stored.ok) throw new RequestError(400, "Promo can be saved after a shipping address is available.");
    return sendJson(res, 200, { ok: true, ...stored });
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Shipping promo could not be saved.";
    return sendJson(res, status, { error: message });
  }
}

async function handler(req, res) {
  if (isPromoSessionRequest(req)) return handlePromoSession(req, res);
  if (req.method !== "POST") return sendXml(res, 405, errorXml(new RequestError(405, "POST is required.")));

  let isSoap = false;
  try {
    const raw = await readBody(req);
    isSoap = /<\s*(?:[\w.-]+:)?Envelope\b/i.test(raw) || Boolean(req.headers.soapaction);
    const { access, rating } = parseLegacyXml(raw);
    authenticate(access);
    const translated = toOAuthRequest(rating);
    const rated = await requestRates(translated.body);
    const explicitPromo = legacyPromotionInput(req, rating);
    const storedPromo = await findPromoClaim(translated.body);
    const promoInput = storedPromo && storedPromo.eligible ? storedPromo : explicitPromo;
    const { result } = applyFreeGroundPromotion(rated, promoInput);
    return sendXml(res, 200, isSoap ? soapSuccessXml(result, translated.context) : successXml(result, translated.context));
  } catch (error) {
    return sendXml(res, 200, isSoap ? soapErrorXml(error) : errorXml(error));
  }
}

module.exports = handler;
module.exports._test = { authenticate, errorXml, legacyPromotionInput, parseLegacyXml, soapSuccessXml, successXml, toOAuthRequest };
