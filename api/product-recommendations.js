"use strict";

const { getAiCatalogProducts } = require("./ai-product-catalog");
const { normalizeText, tokens } = require("./ai-product-search")._test;

const WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";
const ALGORITHM_VERSION = "merchant_category_v1";
const LIST_ID = "pdp_similar_products_v1";
const MAX_RESULTS = 8;
const MIN_RESULTS = 3;
const MAX_EXCLUDED_PRODUCTS = 60;
let catalogIndexCache = { snapshotId: "", source: null, byId: new Map(), byCategory: new Map(), byParent: new Map() };

function cleanProductId(value) {
  const productId = String(value ?? "").trim();
  if (!/^\d{1,20}$/.test(productId)) throw new Error("A numeric WebTrack product ID is required.");
  return productId;
}

function excludedProductIds(value) {
  const excluded = new Set();
  String(value ?? "")
    .split(",")
    .slice(0, MAX_EXCLUDED_PRODUCTS)
    .forEach((candidate) => {
      const productId = String(candidate || "").trim();
      if (/^\d{1,20}$/.test(productId)) excluded.add(productId);
    });
  return excluded;
}

function usableText(value) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return /^(?:n\/?a|null|none)$/i.test(cleaned) ? "" : cleaned;
}

function categoryParts(value) {
  return usableText(value)
    .split(">")
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function categoryKey(value) {
  return categoryParts(value).join(" > ");
}

function parentCategoryKey(value) {
  const parts = categoryParts(value);
  return parts.length >= 3 ? parts.slice(0, -1).join(" > ") : "";
}

function hasCustomerCardData(product) {
  return !!(
    product &&
    /^\d{1,20}$/.test(String(product.productId || "")) &&
    usableText(product.title) &&
    /^https:\/\//i.test(String(product.productUrl || "")) &&
    /^https:\/\//i.test(String(product.imageUrl || "")) &&
    product.availability === "in_stock"
  );
}

function overlapScore(left, right) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function priceSimilarity(left, right) {
  const first = Number(left);
  const second = Number(right);
  if (!(first > 0) || !(second > 0)) return 0;
  return 1 / (1 + Math.abs(Math.log(first / second)));
}

function buildCatalogIndex(catalog) {
  const snapshotId = String(catalog?.active?.id || "memory");
  if (
    catalogIndexCache.snapshotId === snapshotId &&
    catalogIndexCache.source === catalog.products &&
    catalogIndexCache.byId.size
  ) return catalogIndexCache;

  const byId = new Map();
  const byCategory = new Map();
  const byParent = new Map();
  (catalog.products || []).forEach((product) => {
    const productId = String(product?.productId || "");
    if (!productId) return;
    byId.set(productId, product);
    if (!hasCustomerCardData(product)) return;

    const exactKey = categoryKey(product.category);
    if (exactKey) {
      if (!byCategory.has(exactKey)) byCategory.set(exactKey, []);
      byCategory.get(exactKey).push(product);
    }

    const parentKey = parentCategoryKey(product.category);
    if (parentKey) {
      if (!byParent.has(parentKey)) byParent.set(parentKey, []);
      byParent.get(parentKey).push(product);
    }
  });

  catalogIndexCache = { snapshotId, source: catalog.products, byId, byCategory, byParent };
  return catalogIndexCache;
}

function rankCandidates(current, candidates, exactCategory, excluded) {
  const currentCategory = categoryKey(current.category);
  const currentBrand = normalizeText(current.brand);
  const seen = new Set();
  return candidates
    .filter((candidate) => {
      const productId = String(candidate.productId || "");
      if (!hasCustomerCardData(candidate) || productId === current.productId || excluded.has(productId) || seen.has(productId)) {
        return false;
      }
      seen.add(productId);
      return true;
    })
    .map((candidate) => {
      const sameCategory = categoryKey(candidate.category) === currentCategory;
      const sameBrand = currentBrand && normalizeText(candidate.brand) === currentBrand;
      const score =
        (sameCategory ? 200 : exactCategory ? 120 : 90) +
        overlapScore(current.title, candidate.title) * 55 +
        priceSimilarity(current.salePrice || current.price, candidate.salePrice || candidate.price) * 20 +
        (sameBrand ? 6 : 0);
      return {
        product: candidate,
        score,
        match: sameCategory ? "same_category" : "related_category"
      };
    })
    .sort((left, right) =>
      right.score - left.score || String(left.product.title).localeCompare(String(right.product.title))
    );
}

function diversify(ranked, limit = MAX_RESULTS) {
  const selected = [];
  const deferred = [];
  const brandCounts = new Map();
  ranked.forEach((entry) => {
    const brand = normalizeText(entry.product.brand);
    const count = brand ? brandCounts.get(brand) || 0 : 0;
    if (brand && count >= 2) {
      deferred.push(entry);
      return;
    }
    if (selected.length >= limit) return;
    selected.push(entry);
    if (brand) brandCounts.set(brand, count + 1);
  });
  deferred.forEach((entry) => {
    if (selected.length < limit) selected.push(entry);
  });
  return selected.slice(0, limit);
}

function publicRecommendation(entry, index) {
  const product = entry.product;
  const category = usableText(product.category).split(">").map((part) => part.trim()).filter(Boolean);
  return {
    rank: index + 1,
    productId: String(product.productId),
    productCode: usableText(product.productCode).slice(0, 80),
    title: usableText(product.title).slice(0, 180),
    brand: usableText(product.brand).slice(0, 100),
    category: usableText(product.category).slice(0, 260),
    categoryLabel: category.length ? category[category.length - 1] : "",
    availability: "in_stock",
    productUrl: String(product.productUrl).slice(0, 500),
    imageUrl: String(product.imageUrl).slice(0, 500),
    match: entry.match
  };
}

function recommendProducts(catalog, productId, excluded = new Set(), limit = MAX_RESULTS) {
  const index = buildCatalogIndex(catalog);
  const current = index.byId.get(cleanProductId(productId));
  if (!current || !categoryKey(current.category)) return [];

  const exact = index.byCategory.get(categoryKey(current.category)) || [];
  const parentKey = parentCategoryKey(current.category);
  const siblings = parentKey ? index.byParent.get(parentKey) || [] : [];
  const exactRanked = rankCandidates(current, exact, true, excluded);
  const exactIds = new Set(exactRanked.map((entry) => entry.product.productId));
  const siblingRanked = rankCandidates(
    current,
    siblings.filter((candidate) => !exactIds.has(candidate.productId)),
    false,
    excluded
  );
  const selected = diversify(exactRanked.concat(siblingRanked), Math.min(MAX_RESULTS, Math.max(1, Number(limit) || MAX_RESULTS)));
  return selected.length >= MIN_RESULTS ? selected.map(publicRecommendation) : [];
}

function setCorsHeaders(req, res) {
  res.setHeader("Access-Control-Allow-Origin", WEBTRACK_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function sendJson(res, status, payload, cacheControl = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") return sendJson(res, 405, { error: "Only GET is allowed." });

  let productId;
  try {
    productId = cleanProductId(req.query?.pid);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  try {
    const catalog = await getAiCatalogProducts();
    if (!catalog.fresh || !catalog.products.length) {
      return sendJson(res, 503, { success: false, recommendations: [] });
    }
    const recommendations = recommendProducts(
      catalog,
      productId,
      excludedProductIds(req.query?.exclude),
      MAX_RESULTS
    );
    return sendJson(res, 200, {
      success: true,
      productId,
      listId: LIST_ID,
      listName: "Compare similar products",
      algorithm: ALGORITHM_VERSION,
      currentCategory: usableText(catalogIndexCache.byId.get(productId)?.category).slice(0, 260),
      recommendations
    }, "public, s-maxage=900, stale-while-revalidate=3600");
  } catch (error) {
    console.error("Product recommendations failed:", error instanceof Error ? error.message : error);
    return sendJson(res, 500, { success: false, recommendations: [] });
  }
}

module.exports = handler;
module.exports._test = {
  ALGORITHM_VERSION,
  LIST_ID,
  buildCatalogIndex,
  categoryKey,
  categoryParts,
  cleanProductId,
  excludedProductIds,
  overlapScore,
  parentCategoryKey,
  recommendProducts,
  setCorsHeaders
};
