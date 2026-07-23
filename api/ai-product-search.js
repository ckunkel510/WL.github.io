"use strict";

const { getAiCatalogProducts } = require("./ai-product-catalog");

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to", "with"]);
const SENSITIVE_REQUEST = /\b(?:average\s+cost|avg\.?\s+cost|cost\s+basis|dealer\s+cost|invoice\s+cost|landed\s+cost|product\s+cost|purchase\s+cost|wholesale\s+cost|what\s+(?:do|did)\s+(?:you|woodson)\s+pay|margin|markup|profit|supplier\s+price|vendor\s+price)\b/i;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/½/g, " 1 2 ")
    .replace(/¼/g, " 1 4 ")
    .replace(/¾/g, " 3 4 ")
    .replace(/[×✕]/g, " x ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d)\s*[\"”]/g, "$1 inch ")
    .replace(/(\d)\s*[\'’]/g, "$1 foot ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeText(value).split(" ").filter((token) => token && !STOP_WORDS.has(token));
}

function editDistanceAtMostOne(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1 || Math.max(left.length, right.length) < 5) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < left.length || j < right.length) edits += 1;
  return edits <= 1;
}

function tokenMatchScore(queryToken, candidateTokens) {
  if (candidateTokens.has(queryToken)) return 1;
  if (queryToken.length >= 4) {
    for (const candidate of candidateTokens) {
      if (candidate.length >= 4 && (candidate.startsWith(queryToken) || queryToken.startsWith(candidate))) return 0.82;
      if (editDistanceAtMostOne(queryToken, candidate)) return 0.72;
    }
  }
  return 0;
}

function productFields(product) {
  const title = normalizeText(product.title);
  const code = normalizeText(product.productCode);
  const brand = normalizeText(product.brand);
  const category = normalizeText(product.category);
  const identifiers = [product.productCode, product.gtin, product.mpn].map(normalizeText).filter(Boolean);
  const searchable = normalizeText([
    product.productCode,
    product.title,
    product.brand,
    product.category,
    product.description,
    product.gtin,
    product.mpn
  ].join(" "));
  return {
    brand,
    categoryTokens: new Set(tokens(category)),
    code,
    identifiers,
    searchable,
    searchableTokens: new Set(tokens(searchable)),
    title,
    titleTokens: new Set(tokens(title))
  };
}

function requestedBrands(products, normalizedQuery) {
  const matches = new Set();
  for (const product of products) {
    const brand = normalizeText(product.brand);
    if (brand.length >= 3 && (` ${normalizedQuery} `).includes(` ${brand} `)) matches.add(brand);
  }
  return matches;
}

function searchCatalog(products, query, limit = 5) {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokens(normalizedQuery);
  if (!normalizedQuery || !queryTokens.length) return [];
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const brandGuard = requestedBrands(products, normalizedQuery);
  const ranked = [];

  for (const product of products) {
    const fields = productFields(product);
    if (brandGuard.size && !brandGuard.has(fields.brand)) continue;
    const exactIdentifier = fields.identifiers.some((value) => value.replace(/\s+/g, "") === compactQuery);
    const exactPhrase = fields.searchable.includes(normalizedQuery);
    let matched = 0;
    let titleMatched = 0;
    let categoryMatched = 0;
    for (const token of queryTokens) {
      const overall = tokenMatchScore(token, fields.searchableTokens);
      matched += overall;
      titleMatched += tokenMatchScore(token, fields.titleTokens);
      categoryMatched += tokenMatchScore(token, fields.categoryTokens);
    }
    const coverage = matched / queryTokens.length;
    const titleCoverage = titleMatched / queryTokens.length;
    const categoryCoverage = categoryMatched / queryTokens.length;

    if (!exactIdentifier) {
      if (queryTokens.length === 1) {
        if (!exactPhrase && titleCoverage < 0.7 && categoryCoverage < 0.7 && !fields.code.includes(normalizedQuery)) continue;
      } else if (coverage < (queryTokens.length >= 3 ? 0.8 : 0.66) || (!exactPhrase && titleCoverage < 0.45 && categoryCoverage < 0.5)) {
        continue;
      }
    }

    let score = coverage * 100 + titleCoverage * 85 + categoryCoverage * 25;
    if (exactPhrase) score += 70;
    if (fields.title === normalizedQuery) score += 140;
    if (fields.code === normalizedQuery) score += 220;
    if (exactIdentifier) score += 300;
    if (fields.title.startsWith(normalizedQuery)) score += 45;
    if (product.availability === "in_stock") score += 3;
    ranked.push({ product, score, exactIdentifier, exactPhrase });
  }

  return ranked
    .sort((left, right) => right.score - left.score || String(left.product.title).localeCompare(String(right.product.title)))
    .slice(0, Math.max(1, Math.min(8, Number(limit) || 5)));
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : "";
}

function publicProduct(product, rank) {
  return {
    rank,
    productId: product.productId,
    productCode: product.productCode,
    title: product.title,
    description: product.description,
    brand: product.brand,
    price: money(product.price),
    salePrice: money(product.salePrice),
    availability: product.availability,
    productUrl: product.productUrl,
    category: product.category,
    gtin: product.gtin,
    mpn: product.mpn
  };
}

function resultLine(product, index) {
  const code = product.productCode ? `${product.productCode} — ` : "";
  const displayPrice = product.salePrice || product.price;
  const price = displayPrice ? ` — ${displayPrice}` : "";
  const link = product.productUrl ? `\n${product.productUrl}` : "";
  return `${index + 1}. ${code}${product.title}${price}${link}`;
}

function formatSearchResponse(query, ranked) {
  const results = ranked.map((entry, index) => publicProduct(entry.product, index + 1));
  if (!results.length) {
    return {
      success: true,
      hasResults: false,
      matchType: "none",
      query,
      answer: "I couldn't find a reliable match in Woodson Lumber's current online catalog. I can connect you with the team for help.\n[option] Speak to a human",
      results: []
    };
  }
  const matchType = ranked[0].exactIdentifier || ranked[0].exactPhrase ? "exact" : "close";
  const answer = [
    `I found ${results.length === 1 ? "this matching product" : "these matching products"}:`,
    ...results.map(resultLine),
    "Online prices and availability can change; a Woodson team member can confirm before you make the trip."
  ].join("\n");
  return { success: true, hasResults: true, matchType, query, answer, results };
}

function sensitiveResponse(query) {
  return {
    success: true,
    hasResults: false,
    matchType: "none",
    query,
    sensitiveRequest: true,
    answer: "I can help with customer-facing product information, but I can't provide internal cost, margin, markup, profit, supplier, or purchasing information. I'll connect you with Woodson Lumber.\n[option] Speak to a human",
    results: []
  };
}

async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Only POST is allowed." });
  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const query = String(body.query || "").replace(/\s+/g, " ").trim().slice(0, 240);
    if (!query) return sendJson(res, 400, { error: "A non-empty query is required." });
    if (SENSITIVE_REQUEST.test(query)) return sendJson(res, 200, sensitiveResponse(query));

    const catalog = await getAiCatalogProducts();
    if (!catalog.fresh || !catalog.products.length) {
      return sendJson(res, 503, {
        success: false,
        hasResults: false,
        matchType: "none",
        query,
        answer: "The current product catalog is temporarily unavailable. I'll connect you with Woodson Lumber.\n[option] Speak to a human",
        results: []
      });
    }
    return sendJson(res, 200, formatSearchResponse(query, searchCatalog(catalog.products, query, 5)));
  } catch (error) {
    console.error("AI product search failed:", error instanceof Error ? error.message : error);
    return sendJson(res, 500, {
      success: false,
      hasResults: false,
      matchType: "none",
      answer: "Product search is temporarily unavailable. I'll connect you with Woodson Lumber.\n[option] Speak to a human",
      results: []
    });
  }
}

module.exports = handler;
module.exports._test = {
  SENSITIVE_REQUEST,
  formatSearchResponse,
  normalizeText,
  publicProduct,
  searchCatalog,
  sensitiveResponse,
  tokens
};
