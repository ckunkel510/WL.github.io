"use strict";

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const DEFAULT_SHEET_ID = "1LGW3XkZhUihvwjp2rxUG8UY9MvwZsorq40gxLjfCVE0";
const DEFAULT_CACHE_SECONDS = 15 * 60;
const MAX_CACHE_SECONDS = 24 * 60 * 60;
const memoryCache = new Map();
let redisClient = null;

function cleanText(value, maxLength = 5000) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanProductId(value) {
  const productId = cleanText(value, 20);
  if (!/^\d{1,20}$/.test(productId)) {
    throw new Error("A numeric WebTrack product ID is required.");
  }
  return productId;
}

function cacheSeconds(env = process.env) {
  const configured = Number(env.PRODUCT_CONTENT_CACHE_SECONDS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_CACHE_SECONDS;
  return Math.min(MAX_CACHE_SECONDS, Math.max(60, Math.trunc(configured)));
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < String(csvText || "").length; index += 1) {
    const character = csvText[index];
    if (character === "\"") {
      if (quoted && csvText[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cleanText(field));
      field = "";
    } else if (character === "\n" && !quoted) {
      row.push(cleanText(field));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(cleanText(field));
    rows.push(row);
  }
  return rows;
}

function featureKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[\u2010-\u2015-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueValues(values, keyFunction) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const cleaned = cleanText(value);
    const key = keyFunction ? keyFunction(cleaned) : cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return;
    seen.add(key);
    result.push(cleaned);
  });
  return result;
}

function headerIndex(headers, name) {
  const target = String(name).toLowerCase();
  return headers.findIndex((header) => cleanText(header, 100).toLowerCase() === target);
}

function specificationFromText(value) {
  const text = cleanText(value, 1000);
  if (!text) return null;
  const separator = text.indexOf(":");
  if (separator <= 0 || separator === text.length - 1) {
    return { section: "Specifications", name: "Detail", value: text };
  }
  return {
    section: "Specifications",
    name: cleanText(text.slice(0, separator), 200),
    value: cleanText(text.slice(separator + 1), 800)
  };
}

function safeResourceUrl(value) {
  try {
    const url = new URL(cleanText(value, 1000));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function contentFromRows(headers, productRows, requestedProductId) {
  const productId = cleanProductId(requestedProductId);
  const productIndex = headerIndex(headers, "Productid");
  const descriptionIndex = headerIndex(headers, "Description");
  const specificationIndex = headerIndex(headers, "Specifications");
  const featureIndex = headerIndex(headers, "Features");
  const resourceIndex = headerIndex(headers, "Resources");
  const resourceLinkIndex = headerIndex(headers, "Resource Link");

  if (productIndex < 0) throw new Error("The product content sheet is missing its Productid column.");
  if (!productRows.length) return null;

  const descriptionParagraphs = descriptionIndex >= 0
    ? uniqueValues(productRows.map((row) => row[descriptionIndex]))
    : [];
  const features = featureIndex >= 0
    ? uniqueValues(productRows.map((row) => row[featureIndex]), featureKey).slice(0, 100)
    : [];

  const specificationKeys = new Set();
  const specifications = [];
  if (specificationIndex >= 0) {
    productRows.forEach((row) => {
      const specification = specificationFromText(row[specificationIndex]);
      if (!specification) return;
      const key = `${specification.name.toLowerCase()}\u0000${specification.value.toLowerCase()}`;
      if (specificationKeys.has(key)) return;
      specificationKeys.add(key);
      specifications.push(specification);
    });
  }

  const resourceKeys = new Set();
  const resources = [];
  if (resourceIndex >= 0 && resourceLinkIndex >= 0) {
    productRows.forEach((row) => {
      const name = cleanText(row[resourceIndex], 200);
      const url = safeResourceUrl(row[resourceLinkIndex]);
      if (!name || !url) return;
      const key = `${name.toLowerCase()}\u0000${url}`;
      if (resourceKeys.has(key)) return;
      resourceKeys.add(key);
      resources.push({ name, url });
    });
  }

  const description = descriptionParagraphs.join("\n\n");
  return {
    productId,
    description,
    descriptionParagraphs,
    features,
    specifications,
    resources,
    merchant: {
      description,
      productHighlights: features,
      productDetails: specifications.map((specification) => ({
        sectionName: specification.section,
        attributeName: specification.name,
        attributeValue: specification.value
      }))
    },
    source: "google-sheet"
  };
}

function contentsFromCsv(csvText, allowedProductIds) {
  const rows = parseCsv(csvText);
  const headers = rows.shift() || [];
  const productIndex = headerIndex(headers, "Productid");
  if (productIndex < 0) throw new Error("The product content sheet is missing its Productid column.");

  const allowed = allowedProductIds == null
    ? null
    : new Set([...allowedProductIds].map((value) => cleanProductId(value)));
  const productRows = new Map();

  rows.forEach((row) => {
    const productId = cleanText(row[productIndex], 20);
    if (!/^\d{1,20}$/.test(productId) || (allowed && !allowed.has(productId))) return;
    if (!productRows.has(productId)) productRows.set(productId, []);
    productRows.get(productId).push(row);
  });

  return [...productRows].map(([productId, matchingRows]) =>
    contentFromRows(headers, matchingRows, productId)
  );
}

function contentFromCsv(csvText, requestedProductId) {
  const productId = cleanProductId(requestedProductId);
  return contentsFromCsv(csvText, [productId])[0] || null;
}

function buildSheetQueryUrl(productId, env = process.env) {
  const normalizedId = cleanProductId(productId);
  const sheetId = cleanText(env.PRODUCT_DESCRIPTION_SHEET_ID || DEFAULT_SHEET_ID, 100);
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(sheetId)) {
    throw new Error("The product description sheet ID is invalid.");
  }
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.searchParams.set("gid", cleanText(env.PRODUCT_DESCRIPTION_SHEET_GID || "0", 20));
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("tq", `select A, B, C, D, E, F where A = ${normalizedId}`);
  return url.toString();
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

function cacheKey(productId) {
  return `wl:product-content:${cleanProductId(productId)}`;
}

async function readCachedContent(productId) {
  const key = cacheKey(productId);
  const redis = getRedis();
  if (redis) {
    try {
      const stored = await redis.get(key);
      if (!stored) return null;
      if (typeof stored === "object") return stored;
      return JSON.parse(stored);
    } catch {
      // A cache outage must not make public product content unavailable.
    }
  }
  const stored = memoryCache.get(key);
  if (!stored || stored.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return stored.content;
}

async function writeCachedContent(productId, content, ttlSeconds = cacheSeconds()) {
  const key = cacheKey(productId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, content, { ex: ttlSeconds });
      return;
    } catch {
      // Fall through to the per-instance cache when Redis is unavailable.
    }
  }
  memoryCache.set(key, {
    content,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

async function fetchSheetContent(productId, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(buildSheetQueryUrl(productId), {
      headers: { Accept: "text/csv" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
    const content = contentFromCsv(await response.text(), productId);
    return content ? { ...content, fetchedAt: new Date().toISOString() } : null;
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.end(JSON.stringify(payload));
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.end();
  }
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." }, { "Cache-Control": "no-store" });
  }

  let productId;
  try {
    productId = cleanProductId(req.query?.pid);
  } catch (error) {
    return sendJson(res, 400, { error: error.message }, { "Cache-Control": "no-store" });
  }

  try {
    const cached = await readCachedContent(productId);
    if (cached) {
      return sendJson(res, 200, cached, {
        "Cache-Control": `public, s-maxage=${cacheSeconds()}, stale-while-revalidate=86400`,
        "X-WL-Content-Cache": "HIT"
      });
    }

    const content = await fetchSheetContent(productId);
    if (!content) {
      return sendJson(res, 404, { error: "No published product content was found.", productId }, {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "X-WL-Content-Cache": "MISS"
      });
    }
    await writeCachedContent(productId, content);
    return sendJson(res, 200, content, {
      "Cache-Control": `public, s-maxage=${cacheSeconds()}, stale-while-revalidate=86400`,
      "X-WL-Content-Cache": "MISS"
    });
  } catch (error) {
    return sendJson(res, 502, {
      error: "Product content is temporarily unavailable.",
      productId
    }, { "Cache-Control": "no-store" });
  }
}

function resetProductContentCache() {
  memoryCache.clear();
  redisClient = null;
}

module.exports = handler;
module.exports._test = {
  buildSheetQueryUrl,
  cacheSeconds,
  cleanProductId,
  contentFromCsv,
  contentFromRows,
  contentsFromCsv,
  fetchSheetContent,
  featureKey,
  parseCsv,
  resetProductContentCache,
  safeResourceUrl,
  specificationFromText
};
