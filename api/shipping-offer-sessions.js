"use strict";

const crypto = require("node:crypto");

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const OFFER_TTL_SECONDS = 15 * 60;
const memoryOffers = new Map();
let redisClient = null;

function cleanText(value, maxLength = 80) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function postal5(value) {
  return cleanText(value, 12).match(/\d{5}/)?.[0] || "";
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function totalPackageWeight(packages) {
  return (Array.isArray(packages) ? packages : []).reduce((sum, item) => sum + positive(item?.weight), 0);
}

function normalizeRoute(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    shipFromPostalCode: postal5(source.shipFrom?.postalCode || source.shipFrom?.PostalCode),
    shipToPostalCode: postal5(source.shipTo?.postalCode || source.shipTo?.PostalCode)
  };
}

function exactFingerprint(route, weight) {
  if (!route.shipFromPostalCode || !route.shipToPostalCode || !positive(weight)) return "";
  const stable = JSON.stringify({ ...route, productWeight: Number(positive(weight).toFixed(2)) });
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

function bucketKey(route, weight) {
  if (!route.shipFromPostalCode || !route.shipToPostalCode || !positive(weight)) return "";
  return ["wl:shipping-offer", route.shipFromPostalCode, route.shipToPostalCode, Math.round(weight)].join(":");
}

function exactKey(route, weight) {
  const fingerprint = exactFingerprint(route, weight);
  return fingerprint ? `wl:shipping-offer:${fingerprint}` : "";
}

function getRedis() {
  if (!Redis) return null;
  if (redisClient) return redisClient;
  const hasUpstashEnv = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasVercelKvEnv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasUpstashEnv && !hasVercelKvEnv) return null;
  redisClient = Redis.fromEnv();
  return redisClient;
}

function sweepMemory() {
  const now = Date.now();
  for (const [key, value] of memoryOffers.entries()) {
    if (!value || value.expiresAt <= now) memoryOffers.delete(key);
  }
}

function claimMatches(claim, input) {
  if (!claim || !Array.isArray(claim.packages) || !claim.packages.length) return false;
  const route = normalizeRoute(input);
  if (route.shipFromPostalCode !== claim.route?.shipFromPostalCode) return false;
  if (route.shipToPostalCode !== claim.route?.shipToPostalCode) return false;
  const requestWeight = totalPackageWeight(input?.packages);
  const claimWeight = positive(claim.productWeight);
  if (!requestWeight || !claimWeight) return false;
  const tolerance = Math.max(0.75, claimWeight * 0.05);
  return Math.abs(requestWeight - claimWeight) <= tolerance;
}

async function storeShippingOffer(input) {
  const route = normalizeRoute(input);
  const productWeight = positive(input?.productWeight);
  const preciseKey = exactKey(route, productWeight);
  const roundedKey = bucketKey(route, productWeight);
  if (!preciseKey || !roundedKey) return { ok: false, reason: "missing-fingerprint" };
  const now = Date.now();
  const claim = {
    route,
    productWeight,
    catalogId: cleanText(input.catalogId, 80),
    packages: Array.isArray(input.packages) ? input.packages.slice(0, 50) : [],
    basis: input.basis && typeof input.basis === "object" ? input.basis : null,
    policy: input.policy && typeof input.policy === "object" ? input.policy : null,
    decision: input.decision && typeof input.decision === "object" ? input.decision : null,
    createdAt: now,
    expiresAt: now + (OFFER_TTL_SECONDS * 1000)
  };
  if (!claim.packages.length || !claim.basis || !claim.policy) return { ok: false, reason: "incomplete-claim" };

  const redis = getRedis();
  if (redis) {
    await redis.set(preciseKey, claim, { ex: OFFER_TTL_SECONDS });
    await redis.set(roundedKey, claim, { ex: OFFER_TTL_SECONDS });
  } else {
    sweepMemory();
    memoryOffers.set(preciseKey, claim);
    memoryOffers.set(roundedKey, claim);
  }
  return { ok: true, expiresAt: new Date(claim.expiresAt).toISOString() };
}

async function findShippingOffer(input) {
  const route = normalizeRoute(input);
  const requestWeight = totalPackageWeight(input?.packages);
  const keys = [exactKey(route, requestWeight), bucketKey(route, requestWeight)].filter(Boolean);
  const redis = getRedis();
  if (redis) {
    for (const key of keys) {
      const candidate = await redis.get(key);
      if (claimMatches(candidate, input)) return candidate;
    }
    return null;
  }
  sweepMemory();
  for (const key of keys) {
    const candidate = memoryOffers.get(key);
    if (claimMatches(candidate, input)) return candidate;
  }
  return null;
}

function resetMemoryOffers() {
  memoryOffers.clear();
}

module.exports = {
  OFFER_TTL_SECONDS,
  claimMatches,
  findShippingOffer,
  normalizeRoute,
  resetMemoryOffers,
  storeShippingOffer,
  totalPackageWeight
};
