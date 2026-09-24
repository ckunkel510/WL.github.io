"use strict";

const {
  ShippingEligibilityError,
  buildAutomaticShippingQuote
} = require("./shipping-quote");
const { RequestError, enforceRateLimit, requestRates } = require("./ups-rates")._internal;

const CALDWELL_ORIGIN = Object.freeze({
  name: "Caldwell",
  city: "Caldwell",
  state: "TX",
  postalCode: "77836",
  country: "US"
});
const WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";

function cleanText(value, maxLength = 80) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function applyCors(req, res) {
  const origin = cleanText(req.headers?.origin, 180);
  if (!origin) return true;
  if (origin !== WEBTRACK_ORIGIN) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

function normalizedRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const productCode = cleanText(source.productCode || source.code, 80).toUpperCase();
  const productId = cleanText(source.productId || source.id, 40);
  const destinationPostalCode = cleanText(
    source.destinationPostalCode || source.postalCode || source.zip,
    10
  );
  const quantity = Math.trunc(Number(source.quantity || 1));

  if (!productCode && !productId) {
    throw new RequestError(400, "An exact Woodson product code is required before checking shipping.");
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 25) {
    throw new RequestError(400, "Quantity must be between 1 and 25.");
  }
  if (!/^\d{5}(?:-\d{4})?$/.test(destinationPostalCode)) {
    throw new RequestError(400, "A valid destination ZIP code is required to check UPS shipping.");
  }

  return { destinationPostalCode, productCode, productId, quantity };
}

function publicRates(result) {
  return (Array.isArray(result?.rates) ? result.rates : [])
    .map((rate) => ({
      serviceCode: cleanText(rate?.serviceCode, 8),
      serviceName: cleanText(rate?.serviceName, 80),
      amount: Number(rate?.amount),
      currency: cleanText(rate?.currency || "USD", 3).toUpperCase()
    }))
    .filter((rate) => rate.serviceCode && rate.serviceName && Number.isFinite(rate.amount) && rate.amount > 0)
    .sort((left, right) => left.amount - right.amount);
}

function money(rate) {
  const amount = Number(rate?.amount);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "";
}

function safeProductReference(request) {
  return request.productCode || `item ${request.productId}`;
}

function reviewResponse(request, issues = []) {
  const reasonCodes = Array.from(new Set(
    (Array.isArray(issues) ? issues : [])
      .map((issue) => cleanText(issue?.reason, 60))
      .filter(Boolean)
  ));
  const productReference = safeProductReference(request);
  return {
    success: true,
    eligible: false,
    status: "needs_review",
    productId: request.productId,
    productCode: request.productCode,
    quantity: request.quantity,
    destinationPostalCode: request.destinationPostalCode,
    origin: CALDWELL_ORIGIN,
    reasonCodes,
    answer: `I couldn't confirm UPS shipping for ${productReference} because its shipping configuration needs a Woodson team member to review it. I did not treat that as proof the item cannot be shipped. Checkout or the store can confirm the available delivery or freight option.`
  };
}

function unavailableResponse(request) {
  const productReference = safeProductReference(request);
  return {
    success: false,
    eligible: null,
    status: "temporarily_unavailable",
    productId: request.productId,
    productCode: request.productCode,
    quantity: request.quantity,
    destinationPostalCode: request.destinationPostalCode,
    origin: CALDWELL_ORIGIN,
    answer: `I couldn't reach the UPS rating service for ${productReference} right now. I have not concluded that the item cannot ship. Please try the shipping check again or ask a Woodson team member to review it.`
  };
}

function notEligibleResponse(request) {
  const productReference = safeProductReference(request);
  return {
    success: true,
    eligible: false,
    status: "not_eligible",
    productId: request.productId,
    productCode: request.productCode,
    quantity: request.quantity,
    destinationPostalCode: request.destinationPostalCode,
    origin: CALDWELL_ORIGIN,
    answer: `UPS small-package shipping from Caldwell is not available for ${request.quantity} × ${productReference} to ZIP ${request.destinationPostalCode}. That does not rule out Woodson delivery, freight, or another store-arranged option; a Woodson team member can review those choices.`
  };
}

async function checkProductShipping(body, dependencies = {}) {
  const request = normalizedRequest(body);
  const quoteBuilder = dependencies.buildAutomaticShippingQuote || buildAutomaticShippingQuote;
  const rateService = dependencies.requestRates || requestRates;

  try {
    const automatic = await quoteBuilder({
      shipFrom: CALDWELL_ORIGIN,
      shipTo: {
        postalCode: request.destinationPostalCode,
        country: "US"
      },
      cart: [{
        productId: request.productId,
        productCode: request.productCode,
        quantity: request.quantity
      }]
    }, { requestRates: rateService });
    const rates = publicRates(automatic?.result);
    if (!rates.length) throw new Error("UPS returned no eligible customer rates.");
    const lowestRate = rates[0];
    const productReference = safeProductReference(request);
    return {
      success: true,
      eligible: true,
      status: "eligible",
      productId: request.productId,
      productCode: request.productCode,
      quantity: request.quantity,
      destinationPostalCode: request.destinationPostalCode,
      origin: CALDWELL_ORIGIN,
      lowestRate,
      rates,
      quoteExpiresAt: cleanText(automatic?.result?.expiresAt, 40),
      answer: `Yes. UPS shipping from Caldwell is currently available for ${request.quantity} × ${productReference} to ZIP ${request.destinationPostalCode}. The lowest current UPS rate is ${money(lowestRate)} via ${lowestRate.serviceName}. The cart will verify the item and recalculate the rate before checkout.`
    };
  } catch (error) {
    const issues = Array.isArray(error?.shippingIssues) ? error.shippingIssues.slice(0, 25) : [];
    if (error instanceof ShippingEligibilityError || issues.length) {
      return reviewResponse(request, issues);
    }
    if (error instanceof RequestError && error.status >= 400 && error.status < 500) throw error;
    if (/could not be packed for UPS shipping|UPS Ground is unavailable|no eligible shipping services/i.test(String(error?.message || ""))) {
      return notEligibleResponse(request);
    }
    return unavailableResponse(request);
  }
}

async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Only POST is allowed." });

  try {
    enforceRateLimit(req);
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    return sendJson(res, 200, await checkProductShipping(body));
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    const message = error instanceof RequestError
      ? error.message
      : "The shipping check is temporarily unavailable.";
    return sendJson(res, status, { error: message });
  }
}

module.exports = handler;
module.exports._test = {
  CALDWELL_ORIGIN,
  applyCors,
  checkProductShipping,
  normalizedRequest,
  notEligibleResponse,
  publicRates,
  reviewResponse,
  unavailableResponse
};
