"use strict";

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const ACTIVE_KEY = "wl:shipping-catalog:active";
const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_CHUNK_PRODUCTS = 500;
const memory = {
  active: null,
  snapshots: new Map()
};
let redisClient = null;

function cleanText(value, maxLength = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value) {
  const number = finite(value);
  return number !== null && number > 0 ? number : null;
}

function nonNegativeInteger(value) {
  const number = finite(value);
  return number !== null && number >= 0 ? Math.trunc(number) : 0;
}

function snapshotId(value) {
  const cleaned = cleanText(value, 80);
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(cleaned)) throw new Error("A valid catalog snapshot ID is required.");
  return cleaned;
}

function productHashKey(id) {
  return `wl:shipping-catalog:${snapshotId(id)}:products`;
}

function codeHashKey(id) {
  return `wl:shipping-catalog:${snapshotId(id)}:codes`;
}

function metaKey(id) {
  return `wl:shipping-catalog:${snapshotId(id)}:meta`;
}

function normalizeProduct(input) {
  const source = input && typeof input === "object" ? input : {};
  const productId = cleanText(source.productId || source.id, 40);
  if (!productId) throw new Error("Catalog products require productId.");
  return {
    productId,
    productCode: cleanText(source.productCode || source.code, 80).toUpperCase(),
    brand: cleanText(source.brand, 80),
    price: positive(source.price),
    averageCost: positive(source.averageCost ?? source.cost),
    weight: positive(source.weight),
    length: positive(source.length),
    width: positive(source.width),
    height: positive(source.height),
    companyInventory: nonNegativeInteger(source.companyInventory ?? source.inventory),
    isClearance: source.isClearance === true,
    updatedAt: cleanText(source.updatedAt, 40)
  };
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

function allowMemoryStorage() {
  return process.env.NODE_ENV === "test" || process.env.VERCEL_ENV !== "production";
}

async function beginCatalogSnapshot({ id, expectedProducts = 0, createdAt = new Date().toISOString() }) {
  const normalizedId = snapshotId(id);
  const meta = {
    id: normalizedId,
    expectedProducts: nonNegativeInteger(expectedProducts),
    createdAt: cleanText(createdAt, 40) || new Date().toISOString()
  };
  const redis = getRedis();
  if (redis) {
    await redis.set(metaKey(normalizedId), meta, { ex: SNAPSHOT_TTL_SECONDS });
    return meta;
  }
  if (!allowMemoryStorage()) throw new Error("Catalog storage is not configured.");
  memory.snapshots.set(normalizedId, { meta, products: new Map(), codes: new Map() });
  return meta;
}

async function writeCatalogChunk({ id, products }) {
  const normalizedId = snapshotId(id);
  if (!Array.isArray(products) || !products.length || products.length > MAX_CHUNK_PRODUCTS) {
    throw new Error(`Catalog chunks require between 1 and ${MAX_CHUNK_PRODUCTS} products.`);
  }
  const normalized = products.map(normalizeProduct);
  const redis = getRedis();
  if (redis) {
    const productFields = {};
    const codeFields = {};
    normalized.forEach((product) => {
      productFields[product.productId] = JSON.stringify(product);
      if (product.productCode) codeFields[product.productCode] = product.productId;
    });
    await redis.hset(productHashKey(normalizedId), productFields);
    if (Object.keys(codeFields).length) await redis.hset(codeHashKey(normalizedId), codeFields);
    await redis.expire(productHashKey(normalizedId), SNAPSHOT_TTL_SECONDS);
    await redis.expire(codeHashKey(normalizedId), SNAPSHOT_TTL_SECONDS);
    return { id: normalizedId, stored: normalized.length };
  }
  if (!allowMemoryStorage()) throw new Error("Catalog storage is not configured.");
  const snapshot = memory.snapshots.get(normalizedId);
  if (!snapshot) throw new Error("Catalog snapshot must be initialized first.");
  normalized.forEach((product) => {
    snapshot.products.set(product.productId, product);
    if (product.productCode) snapshot.codes.set(product.productCode, product.productId);
  });
  return { id: normalizedId, stored: normalized.length };
}

async function activateCatalogSnapshot(id) {
  const normalizedId = snapshotId(id);
  const redis = getRedis();
  if (redis) {
    const meta = await redis.get(metaKey(normalizedId));
    if (!meta) throw new Error("Catalog snapshot metadata was not found.");
    const storedProducts = Number(await redis.hlen(productHashKey(normalizedId))) || 0;
    if (meta.expectedProducts && storedProducts !== Number(meta.expectedProducts)) {
      throw new Error(`Catalog snapshot expected ${meta.expectedProducts} products but received ${storedProducts}.`);
    }
    const active = { ...meta, storedProducts, activatedAt: new Date().toISOString() };
    await redis.set(ACTIVE_KEY, active);
    return active;
  }
  if (!allowMemoryStorage()) throw new Error("Catalog storage is not configured.");
  const snapshot = memory.snapshots.get(normalizedId);
  if (!snapshot) throw new Error("Catalog snapshot was not found.");
  const storedProducts = snapshot.products.size;
  if (snapshot.meta.expectedProducts && storedProducts !== snapshot.meta.expectedProducts) {
    throw new Error(`Catalog snapshot expected ${snapshot.meta.expectedProducts} products but received ${storedProducts}.`);
  }
  memory.active = { ...snapshot.meta, storedProducts, activatedAt: new Date().toISOString() };
  return memory.active;
}

async function activeCatalog() {
  const redis = getRedis();
  if (redis) return redis.get(ACTIVE_KEY);
  return allowMemoryStorage() ? memory.active : null;
}

function catalogIsFresh(active, env = process.env) {
  if (!active) return false;
  const created = Date.parse(active.createdAt || active.activatedAt || "");
  const maxAgeMinutes = positive(env.SHIPPING_CATALOG_MAX_AGE_MINUTES) || (36 * 60);
  return Number.isFinite(created) && (Date.now() - created) <= maxAgeMinutes * 60 * 1000;
}

async function readProductFromRedis(redis, activeId, ref) {
  let id = cleanText(ref.productId || ref.id, 40);
  const code = cleanText(ref.productCode || ref.code, 80).toUpperCase();
  if (!id && code) id = cleanText(await redis.hget(codeHashKey(activeId), code), 40);
  if (!id) return null;
  const raw = await redis.hget(productHashKey(activeId), id);
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

async function getCatalogProducts(refs) {
  const requested = Array.isArray(refs) ? refs.slice(0, 50) : [];
  const active = await activeCatalog();
  if (!active || !catalogIsFresh(active)) return { active, fresh: false, products: [] };
  const redis = getRedis();
  if (redis) {
    const products = await Promise.all(requested.map((ref) => readProductFromRedis(redis, active.id, ref || {})));
    return { active, fresh: true, products };
  }
  const snapshot = memory.snapshots.get(active.id);
  const products = requested.map((ref) => {
    const source = ref && typeof ref === "object" ? ref : {};
    let id = cleanText(source.productId || source.id, 40);
    const code = cleanText(source.productCode || source.code, 80).toUpperCase();
    if (!id && code) id = snapshot?.codes.get(code) || "";
    return id ? snapshot?.products.get(id) || null : null;
  });
  return { active, fresh: true, products };
}

function resetMemoryCatalog() {
  memory.active = null;
  memory.snapshots.clear();
}

module.exports = {
  MAX_CHUNK_PRODUCTS,
  SNAPSHOT_TTL_SECONDS,
  activateCatalogSnapshot,
  activeCatalog,
  beginCatalogSnapshot,
  catalogIsFresh,
  getCatalogProducts,
  normalizeProduct,
  resetMemoryCatalog,
  writeCatalogChunk
};
