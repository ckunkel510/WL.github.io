"use strict";

const crypto = require("node:crypto");

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const CLAIM_TTL_SECONDS = 30 * 60;
const memoryClaims = new Map();
let redisClient = null;

function cleanText(value, maxLength = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function postal5(value) {
  return cleanText(value, 12).match(/\d{5}/)?.[0] || "";
}

function roundedWeight(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(2)) : 0;
}

function packagesSummary(packages) {
  const items = Array.isArray(packages) ? packages : [];
  const totalWeight = items.reduce((sum, item) => sum + roundedWeight(item && item.weight), 0);
  const roundedTotal = roundedWeight(totalWeight);
  return {
    count: items.length || 1,
    totalWeight: roundedTotal
  };
}

function normalizePromoClaimInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const shipTo = source.shipTo && typeof source.shipTo === "object" ? source.shipTo : {};
  const summary = packagesSummary(source.packages);
  return {
    shipToPostalCode: postal5(shipTo.postalCode || shipTo.PostalCode || source.postalCode),
    packageCount: summary.count,
    totalWeight: summary.totalWeight
  };
}

function promoFingerprint(input) {
  const normalized = normalizePromoClaimInput(input);
  if (!normalized.shipToPostalCode || !normalized.totalWeight) return "";
  const stable = JSON.stringify({
    shipToPostalCode: normalized.shipToPostalCode,
    totalWeight: normalized.totalWeight
  });
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

function promoPostalKey(input) {
  const normalized = normalizePromoClaimInput(input);
  return normalized.shipToPostalCode ? "wl:shipping-promo-postal:" + normalized.shipToPostalCode : "";
}

function claimMatchesRequest(candidate, requestInput) {
  if (!candidate || candidate.eligible !== true) return false;
  const request = normalizePromoClaimInput(requestInput);
  const claim = candidate.normalized || normalizePromoClaimInput(candidate);
  if (!request.shipToPostalCode || request.shipToPostalCode !== claim.shipToPostalCode) return false;
  if (!request.totalWeight || !claim.totalWeight) return true;
  const tolerance = Math.max(2, Number(claim.totalWeight) * 0.35);
  return Math.abs(Number(request.totalWeight) - Number(claim.totalWeight)) <= tolerance;
}

function getRedis() {
  if (!Redis) return null;
  if (redisClient) return redisClient;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  redisClient = Redis.fromEnv();
  return redisClient;
}

function memorySweep() {
  const now = Date.now();
  for (const [key, value] of memoryClaims.entries()) {
    if (!value || value.expiresAt <= now) memoryClaims.delete(key);
  }
}

async function storePromoClaim(input) {
  const fingerprint = promoFingerprint(input);
  if (!fingerprint) return { ok: false, reason: "missing-fingerprint" };

  const claim = {
    code: cleanText(input.code, 40),
    eligible: input.eligible === true,
    cartSignature: cleanText(input.cartSignature, 512),
    cart: Array.isArray(input.cart) ? input.cart.slice(0, 40) : [],
    fingerprint,
    normalized: normalizePromoClaimInput(input),
    createdAt: Date.now(),
    expiresAt: Date.now() + (CLAIM_TTL_SECONDS * 1000)
  };
  const key = "wl:shipping-promo:" + fingerprint;

  const redis = getRedis();
  if (redis) {
    await redis.set(key, claim, { ex: CLAIM_TTL_SECONDS });
    const postalKey = promoPostalKey(input);
    if (postalKey) await redis.set(postalKey, claim, { ex: CLAIM_TTL_SECONDS });
    return { ok: true, storage: "redis", fingerprint, expiresAt: new Date(claim.expiresAt).toISOString() };
  }

  memorySweep();
  memoryClaims.set(key, claim);
  const postalKey = promoPostalKey(input);
  if (postalKey) memoryClaims.set(postalKey, claim);
  return { ok: true, storage: "memory", fingerprint, expiresAt: new Date(claim.expiresAt).toISOString() };
}

async function findPromoClaim(input) {
  const fingerprint = promoFingerprint(input);
  const key = fingerprint ? "wl:shipping-promo:" + fingerprint : "";
  const postalKey = promoPostalKey(input);

  const redis = getRedis();
  if (redis) {
    const exact = key ? await redis.get(key) : null;
    if (exact) return exact;
    const fallback = postalKey ? await redis.get(postalKey) : null;
    return claimMatchesRequest(fallback, input) ? fallback : null;
  }

  memorySweep();
  const exact = key ? memoryClaims.get(key) : null;
  if (exact) return exact;
  const fallback = postalKey ? memoryClaims.get(postalKey) : null;
  return claimMatchesRequest(fallback, input) ? fallback : null;
}

module.exports = {
  CLAIM_TTL_SECONDS,
  findPromoClaim,
  claimMatchesRequest,
  normalizePromoClaimInput,
  packagesSummary,
  promoPostalKey,
  promoFingerprint,
  storePromoClaim
};
