"use strict";

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const ACTIVE_KEY = "wl:ai-product-catalog:active";
const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_CHUNK_PRODUCTS = 500;
const HOT_CACHE_MILLISECONDS = 5 * 60 * 1000;
const memory = {
  active: null,
  snapshots: new Map()
};
let redisClient = null;
let hotCache = { id: "", expiresAt: 0, products: [] };

function cleanText(value, maxLength = 160) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function snapshotId(value) {
  const cleaned = cleanText(value, 80);
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(cleaned)) throw new Error("A valid AI catalog snapshot ID is required.");
  return cleaned;
}

function productHashKey(id) {
  return `wl:ai-product-catalog:${snapshotId(id)}:products`;
}

function metaKey(id) {
  return `wl:ai-product-catalog:${snapshotId(id)}:meta`;
}

// This is the security boundary for data exposed to the chat agent. Add only
// customer-facing fields here. Unknown input fields (including costs, margins,
// supplier terms, and ad economics) are discarded before storage.
function normalizeAiProduct(input) {
  const source = input && typeof input === "object" ? input : {};
  const productId = cleanText(source.productId || source.id, 40);
  if (!productId) throw new Error("AI catalog products require productId.");
  return {
    productId,
    productCode: cleanText(source.productCode || source.code, 80).toUpperCase(),
    title: cleanText(source.title || source.name, 180),
    description: cleanText(source.description, 700),
    brand: cleanText(source.brand, 100),
    price: finitePositive(source.price),
    salePrice: finitePositive(source.salePrice),
    availability: cleanText(source.availability, 40).toLowerCase(),
    productUrl: cleanText(source.productUrl || source.link, 500),
    category: cleanText(source.category || source.productType, 260),
    gtin: cleanText(source.gtin, 32),
    mpn: cleanText(source.mpn, 100),
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

async function beginAiCatalogSnapshot({ id, expectedProducts = 0, createdAt = new Date().toISOString() }) {
  const normalizedId = snapshotId(id);
  const meta = {
    id: normalizedId,
    expectedProducts: Math.max(0, Math.trunc(Number(expectedProducts) || 0)),
    createdAt: cleanText(createdAt, 40) || new Date().toISOString()
  };
  const redis = getRedis();
  if (redis) {
    await redis.set(metaKey(normalizedId), meta, { ex: SNAPSHOT_TTL_SECONDS });
    return meta;
  }
  if (!allowMemoryStorage()) throw new Error("AI catalog storage is not configured.");
  memory.snapshots.set(normalizedId, { meta, products: new Map() });
  return meta;
}

async function writeAiCatalogChunk({ id, products }) {
  const normalizedId = snapshotId(id);
  if (!Array.isArray(products) || !products.length || products.length > MAX_CHUNK_PRODUCTS) {
    throw new Error(`AI catalog chunks require between 1 and ${MAX_CHUNK_PRODUCTS} products.`);
  }
  const normalized = products.map(normalizeAiProduct);
  const redis = getRedis();
  if (redis) {
    const fields = {};
    normalized.forEach((product) => {
      fields[product.productId] = JSON.stringify(product);
    });
    await redis.hset(productHashKey(normalizedId), fields);
    await redis.expire(productHashKey(normalizedId), SNAPSHOT_TTL_SECONDS);
    return { id: normalizedId, stored: normalized.length };
  }
  if (!allowMemoryStorage()) throw new Error("AI catalog storage is not configured.");
  const snapshot = memory.snapshots.get(normalizedId);
  if (!snapshot) throw new Error("AI catalog snapshot must be initialized first.");
  normalized.forEach((product) => snapshot.products.set(product.productId, product));
  return { id: normalizedId, stored: normalized.length };
}

async function activateAiCatalogSnapshot(id) {
  const normalizedId = snapshotId(id);
  const redis = getRedis();
  if (redis) {
    const meta = await redis.get(metaKey(normalizedId));
    if (!meta) throw new Error("AI catalog snapshot metadata was not found.");
    const storedProducts = Number(await redis.hlen(productHashKey(normalizedId))) || 0;
    if (meta.expectedProducts && storedProducts !== Number(meta.expectedProducts)) {
      throw new Error(`AI catalog snapshot expected ${meta.expectedProducts} products but received ${storedProducts}.`);
    }
    const active = { ...meta, storedProducts, activatedAt: new Date().toISOString() };
    await redis.set(ACTIVE_KEY, active);
    hotCache = { id: "", expiresAt: 0, products: [] };
    return active;
  }
  if (!allowMemoryStorage()) throw new Error("AI catalog storage is not configured.");
  const snapshot = memory.snapshots.get(normalizedId);
  if (!snapshot) throw new Error("AI catalog snapshot was not found.");
  const storedProducts = snapshot.products.size;
  if (snapshot.meta.expectedProducts && storedProducts !== snapshot.meta.expectedProducts) {
    throw new Error(`AI catalog snapshot expected ${snapshot.meta.expectedProducts} products but received ${storedProducts}.`);
  }
  memory.active = { ...snapshot.meta, storedProducts, activatedAt: new Date().toISOString() };
  hotCache = { id: "", expiresAt: 0, products: [] };
  return memory.active;
}

async function activeAiCatalog() {
  const redis = getRedis();
  if (redis) return redis.get(ACTIVE_KEY);
  return allowMemoryStorage() ? memory.active : null;
}

function aiCatalogIsFresh(active, env = process.env) {
  if (!active) return false;
  const created = Date.parse(active.createdAt || active.activatedAt || "");
  const configuredMinutes = Number(env.AI_PRODUCT_CATALOG_MAX_AGE_MINUTES);
  const maxAgeMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : 36 * 60;
  return Number.isFinite(created) && (Date.now() - created) <= maxAgeMinutes * 60 * 1000;
}

function parseStoredProduct(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return normalizeAiProduct(raw);
  try {
    return normalizeAiProduct(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function getAiCatalogProducts() {
  const active = await activeAiCatalog();
  if (!active || !aiCatalogIsFresh(active)) return { active, fresh: false, products: [] };
  if (hotCache.id === active.id && hotCache.expiresAt > Date.now()) {
    return { active, fresh: true, products: hotCache.products };
  }
  const redis = getRedis();
  let products;
  if (redis) {
    const rows = await redis.hvals(productHashKey(active.id));
    products = (Array.isArray(rows) ? rows : []).map(parseStoredProduct).filter(Boolean);
  } else {
    products = Array.from(memory.snapshots.get(active.id)?.products.values() || []);
  }
  hotCache = { id: active.id, expiresAt: Date.now() + HOT_CACHE_MILLISECONDS, products };
  return { active, fresh: true, products };
}

function resetMemoryAiCatalog() {
  memory.active = null;
  memory.snapshots.clear();
  hotCache = { id: "", expiresAt: 0, products: [] };
}

module.exports = {
  MAX_CHUNK_PRODUCTS,
  SNAPSHOT_TTL_SECONDS,
  activateAiCatalogSnapshot,
  activeAiCatalog,
  aiCatalogIsFresh,
  beginAiCatalogSnapshot,
  getAiCatalogProducts,
  normalizeAiProduct,
  resetMemoryAiCatalog,
  writeAiCatalogChunk
};
