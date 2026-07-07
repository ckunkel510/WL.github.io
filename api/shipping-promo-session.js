"use strict";

const {
  cartHasEligibleProduct,
  promoCodeMatches
} = require("./shipping-promotions");
const { storePromoClaim } = require("./shipping-promo-sessions");
const { RequestError } = require("./ups-rates")._internal;

const DEFAULT_ORIGINS = [
  "https://webtrack.woodsonlumber.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

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

async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
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

module.exports = handler;
