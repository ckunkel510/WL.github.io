"use strict";

const crypto = require("node:crypto");

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const CLAIM_TTL_SECONDS = 15 * 60;
const memoryClaims = new Map();
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

function packageWeight(packages) {
  return (Array.isArray(packages) ? packages : []).reduce((sum, item) => sum + positive(item?.weight), 0);
}

function normalizeRoute(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    shipFromPostalCode: postal5(source.shipFrom?.postalCode || source.shipFrom?.PostalCode),
    shipToPostalCode: postal5(source.shipTo?.postalCode || source.shipTo?.PostalCode)
  };
}

function publicOriginBranch(input) {
  // Only public Woodson store labels may appear in diagnostics. Never emit
  // arbitrary postal codes, customer destinations or address fields.
  return ({ '77833': 'brenham', '77801': 'bryan-77801', '77803': 'bryan-77803',
    '77836': 'caldwell', '78947': 'lexington', '75831': 'buffalo',
    '76667': 'mexia', '76642': 'groesbeck' })[normalizeRoute(input).shipFromPostalCode] || 'unmapped';
}

function completeDestination(input) {
  return Boolean(input.shipTo?.state && input.shipTo?.city && input.shipTo?.addressLine?.length);
}

function claimWeight(input) {
  return positive(input?.totalWeight) || positive(input?.productWeight) || packageWeight(input?.packages);
}

function exactKey(route, weight) {
  if (!route.shipFromPostalCode || !route.shipToPostalCode || !positive(weight)) return "";
  const stable = JSON.stringify({ ...route, weight: Number(positive(weight).toFixed(2)) });
  const fingerprint = crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
  return `wl:fulfillment-quote:${fingerprint}`;
}

function bucketKey(route, weight) {
  if (!route.shipFromPostalCode || !route.shipToPostalCode || !positive(weight)) return "";
  return ["wl:fulfillment-quote", route.shipFromPostalCode, route.shipToPostalCode, Math.round(weight)].join(":");
}

function postalKey(route) {
  if (!route.shipFromPostalCode || !route.shipToPostalCode) return "";
  return ["wl:fulfillment-quote", "postal", route.shipFromPostalCode, route.shipToPostalCode].join(":");
}

function claimMatches(candidate, input) {
  if (!candidate?.recommendation || !Array.isArray(candidate.rates) || !candidate.rates.length) return false;
  const route = normalizeRoute(input);
  if (route.shipFromPostalCode !== candidate.route?.shipFromPostalCode) return false;
  if (route.shipToPostalCode !== candidate.route?.shipToPostalCode) return false;
  const requestWeight = claimWeight(input);
  const storedWeight = positive(candidate.totalWeight);
  if (!requestWeight || !storedWeight) return true;
  const tolerance = Math.max(2, storedWeight * 0.35);
  return Math.abs(requestWeight - storedWeight) <= tolerance;
}

function positiveRates(rates) {
  return (Array.isArray(rates) ? rates : [])
    .filter((rate) => Number.isFinite(Number(rate?.amount)) && Number(rate.amount) > 0)
    .slice(0, 8)
    .map((rate) => ({ ...rate, amount: Number(rate.amount) }));
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
  for (const [key, value] of memoryClaims.entries()) {
    if (!value || value.expiresAt <= now) memoryClaims.delete(key);
  }
}

async function storeFulfillmentClaim(input, selected = false) {
  const route = normalizeRoute(input);
  const totalWeight = claimWeight(input);
  const keys = [exactKey(route, totalWeight), bucketKey(route, totalWeight), postalKey(route)]
    .filter(Boolean).map((key) => selected ? key.replace("wl:fulfillment-quote:", "wl:fulfillment-selected:") : key);
  if (!selected && completeDestination(input)) {
    keys.push(...keys.map((key) => key.replace("wl:fulfillment-quote:", "wl:fulfillment-complete:")));
  }
  if (!keys.length) return { ok: false, reason: "missing-route" };
  const now = Date.now();
  const recommendation = input?.recommendation && typeof input.recommendation === "object"
    ? { ...input.recommendation }
    : null;
  const rates = positiveRates(input?.rates);
  const availableRates = {
    ship: positiveRates(input?.availableRates?.ship),
    delivery: positiveRates(input?.availableRates?.delivery)
  };
  if (!recommendation || !["ship", "delivery"].includes(recommendation.mode) || !rates.length) {
    return { ok: false, reason: "incomplete-claim" };
  }
  const claim = {
    route,
    destinationComplete: completeDestination(input),
    totalWeight,
    recommendation,
    rates,
    availableRates,
    packages: Array.isArray(input.packages) ? input.packages.slice(0, 50) : [],
    createdAt: now,
    expiresAt: now + (CLAIM_TTL_SECONDS * 1000)
  };
  const redis = getRedis();
  if (redis) {
    for (const key of keys) await redis.set(key, claim, { ex: CLAIM_TTL_SECONDS });
  } else {
    sweepMemory();
    keys.forEach((key) => memoryClaims.set(key, claim));
  }
  return { ok: true, expiresAt: new Date(claim.expiresAt).toISOString() };
}

async function selectFulfillmentClaim(input) {
  const mode = cleanText(input?.mode, 12).toLowerCase();
  if (!['ship', 'delivery'].includes(mode)) return { ok: false, reason: "invalid-mode" };
  const candidate = await findFulfillmentClaim(input, false);
  const rates = positiveRates(candidate?.availableRates?.[mode]);
  if (!candidate || !rates.length) return { ok: false, reason: "method-unavailable" };
  const amount = Number(rates.find((rate) => String(rate.serviceCode || "") === "03")?.amount || rates[0].amount);
  const recommendation = {
    mode,
    label: mode === "delivery" ? "Woodson Local Delivery" : "Ship via UPS",
    amount,
    reason: "customer-selected"
  };
  const stored = await storeFulfillmentClaim({
    shipFrom: input.shipFrom,
    shipTo: input.shipTo,
    totalWeight: candidate.totalWeight,
    packages: candidate.packages,
    recommendation,
    rates,
    availableRates: candidate.availableRates
  }, true);
  return { ...stored, recommendation };
}

async function findFulfillmentClaim(input, preferSelected = true) {
  const route = normalizeRoute(input);
  const totalWeight = claimWeight(input);
  const keys = [exactKey(route, totalWeight), bucketKey(route, totalWeight), postalKey(route)].filter(Boolean);
  const redis = getRedis();
  sweepMemory();
  async function readClaim(candidates) {
    for (const key of candidates) {
      const candidate = redis ? await redis.get(key) : memoryClaims.get(key);
      if (claimMatches(candidate, input)) return candidate;
    }
    return null;
  }
  // Postal-only cart estimates share the legacy route keys, but cannot replace
  // checkout's complete-address rates before the customer reserves a mode.
  const automatic = await readClaim(keys.map((key) => key.replace("wl:fulfillment-quote:", "wl:fulfillment-complete:")).concat(keys));
  if (preferSelected) {
    // Quote calculation may finish after a customer reserves an alternate mode.
    // Keep that choice in separate keys so late recommendations cannot replace
    // it. Retain the same route/weight checks and fifteen-minute expiry.
    const selected = await readClaim(keys.map((key) => key.replace("wl:fulfillment-quote:", "wl:fulfillment-selected:")));
    if (selected) {
      // Cart-page estimates can have only a postal code. They must not revoke
      // a delivery reservation made with the complete native checkout address.
      const latest = automatic && automatic.createdAt >= selected.createdAt &&
        (!selected.destinationComplete || automatic.destinationComplete) ? automatic : selected;
      const mode = selected.recommendation.mode;
      const rates = positiveRates(latest.availableRates?.[mode]);
      if (!rates.length) return null;
      const amount = Number(rates.find((rate) => String(rate.serviceCode || "") === "03")?.amount || rates[0].amount);
      return { ...latest, rates, recommendation: { ...selected.recommendation, amount } };
    }
  }
  return automatic;
}

function resetMemoryClaims() {
  memoryClaims.clear();
}

module.exports = {
  CLAIM_TTL_SECONDS,
  claimMatches,
  findFulfillmentClaim,
  normalizeRoute,
  publicOriginBranch,
  packageWeight,
  resetMemoryClaims,
  selectFulfillmentClaim,
  storeFulfillmentClaim
};
