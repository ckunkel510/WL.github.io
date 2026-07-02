"use strict";

const crypto = require("node:crypto");

const DEFAULT_ORIGINS = [
  "https://webtrack.woodsonlumber.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const SERVICE_NAMES = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early"
};
const rateBuckets = new Map();
let tokenCache = { accessToken: "", expiresAt: 0 };

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
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
  if (origin && allowedOrigins().has(origin)) {
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

function requestIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function enforceRateLimit(req) {
  const key = requestIp(req);
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60000 });
    return;
  }
  current.count += 1;
  if (current.count > 20) throw new RequestError(429, "Too many rate requests. Please try again shortly.");
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeAddress(input, label) {
  const address = input && typeof input === "object" ? input : {};
  const postalCode = cleanText(address.postalCode, 10);
  const state = cleanText(address.state, 2).toUpperCase();
  const city = cleanText(address.city, 30);
  const country = cleanText(address.country || "US", 2).toUpperCase();
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    throw new RequestError(400, `${label} postal code is required.`);
  }
  if (!/^[A-Z]{2}$/.test(state)) throw new RequestError(400, `${label} state is required.`);
  if (!city) throw new RequestError(400, `${label} city is required.`);
  if (country !== "US") throw new RequestError(400, "This UPS checkout currently supports US addresses only.");

  const lines = Array.isArray(address.addressLine) ? address.addressLine : [address.addressLine];
  const normalized = {
    City: city,
    StateProvinceCode: state,
    PostalCode: postalCode,
    CountryCode: country
  };
  const addressLines = lines.map((line) => cleanText(line, 35)).filter(Boolean).slice(0, 3);
  if (addressLines.length) normalized.AddressLine = addressLines;
  if (address.residential) normalized.ResidentialAddressIndicator = "Y";
  return normalized;
}

function boundedNumber(value, label, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new RequestError(400, `${label} must be between ${min} and ${max}.`);
  }
  return numeric;
}

function normalizePackages(input) {
  if (!Array.isArray(input) || !input.length) throw new RequestError(400, "At least one package is required.");
  const expanded = [];

  input.forEach((item, index) => {
    const quantity = Math.floor(boundedNumber(item.quantity || 1, `Package ${index + 1} quantity`, 1, 20));
    const weight = boundedNumber(item.weight, `Package ${index + 1} weight`, 0.1, 150);
    const rawDimensions = [item.length, item.width, item.height];
    const hasAnyDimension = rawDimensions.some((value) => value !== undefined && value !== null && value !== "");
    const hasAllDimensions = rawDimensions.every((value) => value !== undefined && value !== null && value !== "");
    if (hasAnyDimension && !hasAllDimensions) {
      throw new RequestError(400, `Package ${index + 1} requires length, width, and height together.`);
    }

    let dimensions = null;
    if (hasAllDimensions) {
      const length = boundedNumber(item.length, `Package ${index + 1} length`, 0.1, 108);
      const width = boundedNumber(item.width, `Package ${index + 1} width`, 0.1, 108);
      const height = boundedNumber(item.height, `Package ${index + 1} height`, 0.1, 108);
      if (length + (2 * width) + (2 * height) > 165) {
        throw new RequestError(400, `Package ${index + 1} exceeds UPS small-package dimensions.`);
      }
      dimensions = { length, width, height };
    }

    for (let copy = 0; copy < quantity; copy += 1) {
      expanded.push({ weight, ...(dimensions || {}) });
    }
  });

  if (expanded.length > 50) throw new RequestError(400, "A maximum of 50 packages can be rated at once.");
  return expanded;
}

function upsBaseUrl() {
  if (process.env.UPS_BASE_URL) return String(process.env.UPS_BASE_URL).replace(/\/$/, "");
  return process.env.UPS_ENVIRONMENT === "production"
    ? "https://onlinetools.ups.com"
    : "https://wwwcie.ups.com";
}

async function fetchWithTimeout(url, options, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken() {
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.accessToken;

  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const accountNumber = process.env.UPS_ACCOUNT_NUMBER;
  if (!clientId || !clientSecret || !accountNumber) {
    throw new RequestError(503, "UPS rating is not configured yet.");
  }

  const response = await fetchWithTimeout(`${upsBaseUrl()}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "x-merchant-id": accountNumber
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new RequestError(502, "UPS authentication failed. Please verify the UPS application credentials.");
  }

  const lifetimeSeconds = Math.max(120, Number(data.expires_in) || 3600);
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (lifetimeSeconds * 1000)
  };
  return tokenCache.accessToken;
}

function packagePayload(item) {
  const payload = {
    PackagingType: { Code: "02", Description: "Package" },
    PackageWeight: {
      UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
      Weight: String(item.weight)
    }
  };
  if (item.length && item.width && item.height) {
    payload.Dimensions = {
      UnitOfMeasurement: { Code: "IN", Description: "Inches" },
      Length: String(item.length),
      Width: String(item.width),
      Height: String(item.height)
    };
  }
  return payload;
}

function buildRateRequest(body) {
  const accountNumber = process.env.UPS_ACCOUNT_NUMBER || "";
  const shipFrom = normalizeAddress(body.shipFrom, "Ship-from");
  const shipTo = normalizeAddress(body.shipTo, "Ship-to");
  const packages = normalizePackages(body.packages);
  const totalWeight = packages.reduce((sum, item) => sum + item.weight, 0);

  return {
    packages,
    payload: {
      RateRequest: {
        Request: {
          RequestOption: "Shop",
          TransactionReference: { CustomerContext: "Woodson WebTrack checkout" }
        },
        Shipment: {
          Shipper: {
            Name: "Woodson Lumber",
            ShipperNumber: accountNumber,
            Address: shipFrom
          },
          ShipTo: { Name: "Customer", Address: shipTo },
          ShipFrom: { Name: "Woodson Lumber", Address: shipFrom },
          PaymentDetails: {
            ShipmentCharge: [{ Type: "01", BillShipper: { AccountNumber: accountNumber } }]
          },
          NumOfPieces: String(packages.length),
          ShipmentTotalWeight: {
            UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
            Weight: String(totalWeight)
          },
          Package: packages.map(packagePayload),
          ShipmentRatingOptions: { NegotiatedRatesIndicator: "Y" }
        }
      }
    }
  };
}

function normalizedRates(data) {
  const rated = data?.RateResponse?.RatedShipment;
  const shipments = Array.isArray(rated) ? rated : (rated ? [rated] : []);
  return shipments.map((shipment) => {
    const serviceCode = cleanText(shipment?.Service?.Code, 4);
    const charge = shipment?.NegotiatedRateCharges?.TotalCharge || shipment?.TotalCharges || {};
    return {
      serviceCode,
      serviceName: SERVICE_NAMES[serviceCode] || `UPS service ${serviceCode}`,
      currency: cleanText(charge.CurrencyCode || "USD", 3),
      amount: Number(charge.MonetaryValue),
      billingWeight: Number(shipment?.BillingWeight?.Weight || 0)
    };
  }).filter((rate) => rate.serviceCode && Number.isFinite(rate.amount))
    .sort((left, right) => left.amount - right.amount);
}

async function requestRates(body) {
  const accessToken = await getAccessToken();
  const { payload } = buildRateRequest(body);
  const transactionId = `wl-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`.slice(0, 32);
  const response = await fetchWithTimeout(`${upsBaseUrl()}/api/rating/v2409/Shop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      transId: transactionId,
      transactionSrc: "woodson-webtrack"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const upstreamMessage = data?.response?.errors?.[0]?.message || "UPS could not rate this shipment.";
    throw new RequestError(502, cleanText(upstreamMessage, 180));
  }

  const rates = normalizedRates(data);
  if (!rates.length) throw new RequestError(502, "UPS returned no eligible shipping services.");
  return {
    quoteId: transactionId,
    rates,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };
}

async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    enforceRateLimit(req);
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const result = await requestRates(body);
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    const message = error instanceof RequestError ? error.message : "UPS rating is temporarily unavailable.";
    return sendJson(res, status, { error: message });
  }
}

module.exports = handler;
module.exports._test = { buildRateRequest, normalizeAddress, normalizePackages, normalizedRates };
module.exports._internal = { RequestError, requestRates };
