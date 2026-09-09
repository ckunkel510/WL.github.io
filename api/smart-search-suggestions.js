"use strict";

const { getAiCatalogProducts } = require("./ai-product-catalog");
const {
  editDistanceAtMostOne,
  normalizeText,
  searchCatalog,
  tokens
} = require("./ai-product-search")._test;

const WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";
const ALGORITHM_VERSION = "merchant_typo_search_v1";
const MAX_RESULTS = 8;
const MAX_EXCLUDED_PRODUCTS = 60;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", WEBTRACK_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

function cleanQuery(value) {
  const query = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (query.length < 2 || EMAIL_PATTERN.test(query) || PHONE_PATTERN.test(query)) return "";
  return query;
}

function cleanNativeResultCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(5000, Math.floor(count)));
}

function excludedProductIds(value) {
  const excluded = new Set();
  const candidates = Array.isArray(value) ? value : String(value ?? "").split(",");
  candidates.slice(0, MAX_EXCLUDED_PRODUCTS).forEach((candidate) => {
    const productId = String(candidate || "").trim();
    if (/^\d{1,20}$/.test(productId)) excluded.add(productId);
  });
  return excluded;
}

function usableText(value) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return /^(?:n\/?a|null|none)$/i.test(cleaned) ? "" : cleaned;
}

function safeHttpsUrl(value, allowedHosts) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname)) return "";
    return url.href;
  } catch (error) {
    return "";
  }
}

function categoryLabel(value) {
  const parts = usableText(value).split(">").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1].replace(/^shop all\s+/i, "") : "";
}

function hasCustomerCardData(product) {
  return !!(
    product &&
    /^\d{1,20}$/.test(String(product.productId || "")) &&
    usableText(product.title) &&
    product.availability === "in_stock" &&
    safeHttpsUrl(product.productUrl, ["webtrack.woodsonlumber.com"]) &&
    safeHttpsUrl(product.imageUrl, ["webtrack.woodsonlumber.com", "images-woodsonlumber.sirv.com"])
  );
}

function publicSuggestion(entry, index) {
  const product = entry.product;
  return {
    rank: index + 1,
    productId: String(product.productId),
    productCode: usableText(product.productCode).slice(0, 80),
    title: usableText(product.title).slice(0, 180),
    brand: usableText(product.brand).slice(0, 100),
    category: usableText(product.category).slice(0, 260),
    categoryLabel: categoryLabel(product.category),
    availability: "in_stock",
    productUrl: safeHttpsUrl(product.productUrl, ["webtrack.woodsonlumber.com"]),
    imageUrl: safeHttpsUrl(product.imageUrl, ["webtrack.woodsonlumber.com", "images-woodsonlumber.sirv.com"]),
    match: entry.exactIdentifier || entry.exactPhrase ? "exact" : "close"
  };
}

function suggestedTerm(query, ranked) {
  const queryTokens = tokens(query);
  if (queryTokens.length !== 1 || !ranked.length) return "";
  const queryToken = queryTokens[0];
  const brands = new Map();
  ranked.slice(0, 6).forEach((entry) => {
    const display = usableText(entry.product?.brand);
    const normalized = normalizeText(display);
    if (!display || tokens(normalized).length !== 1 || normalized === queryToken) return;
    if (!editDistanceAtMostOne(queryToken, normalized)) return;
    const key = normalized.toLowerCase();
    const current = brands.get(key) || { display, count: 0 };
    current.count += 1;
    brands.set(key, current);
  });
  const candidates = [...brands.values()].sort((left, right) => right.count - left.count || left.display.localeCompare(right.display));
  if (!candidates.length || candidates[0].count < Math.min(2, ranked.length)) return "";
  return candidates[0].display.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 100);
}

function buildSuggestionPayload(catalog, query, nativeResultCount = 0, excluded = new Set()) {
  const nativeCount = cleanNativeResultCount(nativeResultCount);
  const eligibleProducts = (catalog.products || []).filter((product) => (
    hasCustomerCardData(product) && !excluded.has(String(product.productId))
  ));
  const ranked = searchCatalog(eligibleProducts, query, MAX_RESULTS);
  const suggestions = ranked.map(publicSuggestion);
  const recovery = nativeCount === 0;
  return {
    success: true,
    mode: recovery ? "recovery" : "related",
    hasSuggestions: suggestions.length > 0,
    matchType: ranked.length && (ranked[0].exactIdentifier || ranked[0].exactPhrase) ? "exact" : (ranked.length ? "close" : "none"),
    suggestedTerm: suggestedTerm(query, ranked),
    nativeResultCount: nativeCount,
    listId: recovery ? "search_recovery_matches_v1" : "search_related_results_v1",
    listName: recovery ? "Possible matches" : "Related to your search",
    algorithm: ALGORITHM_VERSION,
    strategy: recovery ? "typo_and_catalog_recovery" : "additional_catalog_matches",
    suggestions
  };
}

async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Only POST is allowed." });
  let body;
  try { body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}"); }
  catch (error) { return sendJson(res, 400, { error: "The request body must be valid JSON." }); }
  const query = cleanQuery(body.query);
  if (!query) return sendJson(res, 400, { error: "A safe, non-empty query is required." });

  try {
    const catalog = await getAiCatalogProducts();
    if (!catalog.fresh || !catalog.products.length) {
      return sendJson(res, 503, { success: false, hasSuggestions: false, suggestions: [] });
    }
    return sendJson(res, 200, buildSuggestionPayload(
      catalog,
      query,
      body.nativeResultCount,
      excludedProductIds(body.excludeProductIds)
    ));
  } catch (error) {
    // Do not log the customer query; it belongs in the sanitized GA4 search event only.
    console.error("Smart search suggestion service failed:", error instanceof Error ? error.message : error);
    return sendJson(res, 500, { success: false, hasSuggestions: false, suggestions: [] });
  }
}

module.exports = handler;
module.exports._test = {
  ALGORITHM_VERSION,
  buildSuggestionPayload,
  categoryLabel,
  cleanNativeResultCount,
  cleanQuery,
  excludedProductIds,
  hasCustomerCardData,
  publicSuggestion,
  setCorsHeaders,
  suggestedTerm
};
