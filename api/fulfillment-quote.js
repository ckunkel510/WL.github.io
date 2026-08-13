"use strict";

const crypto = require("node:crypto");
const { buildAutomaticShippingQuote } = require("./shipping-quote");
const { getCatalogProducts } = require("./shipping-catalog");
const { RequestError, requestRates } = require("./ups-rates")._internal;
const { selectFulfillmentClaim, storeFulfillmentClaim } = require("./fulfillment-sessions");
const { quoteWoodsonDelivery } = require("./woodson-delivery");

const DEFAULT_ORIGINS = [
  "https://webtrack.woodsonlumber.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const rateBuckets = new Map();

function cleanText(value, maxLength = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function money(value) {
  return Math.max(0, Math.round((Number(value) + Number.EPSILON) * 100) / 100);
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
  if (!origin) return process.env.VERCEL_ENV !== "production" || process.env.UPS_ALLOW_NO_ORIGIN === "true";
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

function requestIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
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
  if (current.count > 30) throw new RequestError(429, "Too many fulfillment requests. Please try again shortly.");
}

function quantity(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function packageWeight(packages) {
  return (Array.isArray(packages) ? packages : []).reduce(
    (sum, item) => sum + (positive(item?.weight) * Math.max(1, quantity(item?.quantity) || 1)),
    0
  );
}

function isEasyParcel(packages) {
  return Array.isArray(packages) && packages.length > 0 && packages.every((item) => {
    const weight = positive(item?.weight);
    const dimensions = [positive(item?.length), positive(item?.width), positive(item?.height)];
    return weight > 0 && weight <= 50 && dimensions.every(Boolean) && Math.max(...dimensions) <= 48;
  });
}

async function trustedCartWeight(cart, dependencies = {}) {
  if (!Array.isArray(cart) || !cart.length) return 0;
  const catalog = await (dependencies.getCatalogProducts || getCatalogProducts)(cart);
  if (!catalog?.fresh || !Array.isArray(catalog.products) || catalog.products.length !== cart.length) return 0;
  let total = 0;
  for (let index = 0; index < cart.length; index += 1) {
    const weight = positive(catalog.products[index]?.weight);
    const lineQuantity = quantity(cart[index]?.quantity);
    if (!weight || !lineQuantity) return 0;
    total += weight * lineQuantity;
  }
  return total;
}

function restoreRawRates(automatic) {
  const rates = Array.isArray(automatic?.result?.rates) ? automatic.result.rates : [];
  const rawGround = positive(automatic?.claim?.decision?.groundCost);
  return rates.map((rate) => {
    const original = positive(rate?.originalAmount) || positive(rate?.amount);
    const amount = String(rate?.serviceCode || "") === "03" && rawGround ? rawGround : original;
    return { ...rate, amount: money(amount) };
  }).filter((rate) => rate.amount > 0);
}

function groundRate(rates) {
  return (Array.isArray(rates) ? rates : []).find((rate) => String(rate?.serviceCode || "") === "03") || null;
}

function upsOption(rates) {
  const ground = groundRate(rates);
  if (!ground || positive(ground.amount) <= 0) return null;
  return {
    available: true,
    mode: "ship",
    serviceCode: "03",
    serviceName: "UPS Ground",
    amount: money(ground.amount),
    currency: cleanText(ground.currency || "USD", 3),
    billingWeight: positive(ground.billingWeight),
    rates
  };
}

function preferenceThreshold(env = process.env) {
  const configured = Number(env.FULFILLMENT_UPS_PREFERENCE_DOLLARS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 10;
}

function recommendFulfillment({ ups, delivery, easyParcel, threshold = 10 }) {
  if (ups?.available && !delivery?.available) {
    return { mode: "ship", label: "Ship via UPS", amount: ups.amount, reason: "ups-only" };
  }
  if (delivery?.available && !ups?.available) {
    return { mode: "delivery", label: "Woodson Local Delivery", amount: delivery.amount, reason: "delivery-only" };
  }
  if (!ups?.available && !delivery?.available) {
    return { mode: "manual", label: "Freight quote required", amount: null, reason: "no-automatic-method" };
  }
  if (easyParcel && ups.amount <= delivery.amount + threshold) {
    return {
      mode: "ship",
      label: "Ship via UPS",
      amount: ups.amount,
      reason: ups.amount <= delivery.amount ? "lowest-cost-parcel" : "easy-parcel-within-threshold"
    };
  }
  return {
    mode: "delivery",
    label: "Woodson Local Delivery",
    amount: delivery.amount,
    reason: easyParcel ? "delivery-saves-more-than-threshold" : "bulky-or-unknown-parcel"
  };
}

async function buildFulfillmentQuote(body, dependencies = {}) {
  const cart = Array.isArray(body?.cart) ? body.cart : Array.isArray(body?.items) ? body.items : [];
  const suppliedPackages = Array.isArray(body?.packages) ? body.packages : [];
  const rateRequest = dependencies.requestRates || requestRates;
  let packages = [];
  let rates = [];
  let totalWeight = positive(body?.cartWeight) || positive(body?.totalWeight);
  let upsFailure = "";

  if (cart.length) {
    try {
      const automaticOptions = {
        requestRates: rateRequest,
        ...(dependencies.getCatalogProducts ? { getCatalogProducts: dependencies.getCatalogProducts } : {})
      };
      if (dependencies.shippingPolicy) automaticOptions.policy = dependencies.shippingPolicy;
      const automatic = await (dependencies.buildAutomaticShippingQuote || buildAutomaticShippingQuote)(body, automaticOptions);
      packages = automatic.claim?.packages || [];
      totalWeight = positive(automatic.claim?.productWeight) || totalWeight;
      rates = restoreRawRates(automatic);
    } catch (error) {
      upsFailure = cleanText(error?.message || "UPS automatic packing was unavailable.", 180);
    }
  }

  if (!rates.length && suppliedPackages.length) {
    packages = suppliedPackages;
    totalWeight = totalWeight || packageWeight(suppliedPackages);
    try {
      const rated = await rateRequest({ shipFrom: body.shipFrom, shipTo: body.shipTo, packages: suppliedPackages });
      rates = (Array.isArray(rated?.rates) ? rated.rates : [])
        .map((rate) => ({ ...rate, amount: money(rate.amount) }))
        .filter((rate) => rate.amount > 0);
    } catch (error) {
      upsFailure = cleanText(error?.message || "UPS rating was unavailable.", 180);
    }
  }

  if (!totalWeight && cart.length) {
    try { totalWeight = await trustedCartWeight(cart, dependencies); } catch {}
  }

  const ups = upsOption(rates) || { available: false, reason: upsFailure || "ups-unavailable" };
  const delivery = await (dependencies.quoteWoodsonDelivery || quoteWoodsonDelivery)({
    shipFrom: body.shipFrom,
    shipTo: body.shipTo,
    totalWeight
  }, dependencies);
  const easyParcel = Boolean(ups.available && isEasyParcel(packages));
  const recommendation = recommendFulfillment({
    ups,
    delivery,
    easyParcel,
    threshold: dependencies.threshold ?? preferenceThreshold()
  });

  const selectedRates = recommendation.mode === "ship"
    ? rates
    : recommendation.mode === "delivery"
      ? [{
          serviceCode: delivery.serviceCode,
          serviceName: delivery.serviceName,
          currency: delivery.currency,
          amount: delivery.amount,
          billingWeight: delivery.billingWeight
        }]
      : [];
  const claim = selectedRates.length
    ? await (dependencies.storeFulfillmentClaim || storeFulfillmentClaim)({
        shipFrom: body.shipFrom,
        shipTo: body.shipTo,
        totalWeight,
        packages,
        recommendation,
        rates: selectedRates,
        availableRates: {
          ship: rates,
          delivery: delivery.available ? [{
            serviceCode: delivery.serviceCode,
            serviceName: delivery.serviceName,
            currency: delivery.currency,
            amount: delivery.amount,
            billingWeight: delivery.billingWeight
          }] : []
        }
      })
    : { ok: false, reason: "no-automatic-method" };

  return {
    quoteId: `wl-fulfillment-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    recommendation,
    options: { ups, delivery },
    packageProfile: {
      easyParcel,
      packageCount: packages.length,
      totalWeight: totalWeight || null
    },
    session: claim,
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
    if (body.action === "select") {
      const selected = await selectFulfillmentClaim(body);
      if (!selected.ok) throw new RequestError(409, "That fulfillment method is no longer available. Please refresh the quote.");
      return sendJson(res, 200, selected);
    }
    const result = await buildFulfillmentQuote(body);
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    return sendJson(res, status, { error: error instanceof Error ? error.message : "Fulfillment quoting is temporarily unavailable." });
  }
}

module.exports = handler;
module.exports._test = {
  buildFulfillmentQuote,
  isEasyParcel,
  packageWeight,
  recommendFulfillment,
  restoreRawRates,
  trustedCartWeight
};
