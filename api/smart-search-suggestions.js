"use strict";

const { getAiCatalogProducts } = require("./ai-product-catalog");
const {
  editDistanceAtMostOne,
  normalizeText,
  searchCatalog,
  tokens
} = require("./ai-product-search")._test;
const {
  affinityCategoryIndex,
  affinityRule
} = require("./product-recommendations")._test;

const WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";
const ALGORITHM_VERSION = "merchant_search_discovery_v2";
const MAX_RESULTS = 8;
const MAX_MERCHANDISING_RESULTS = 4;
const MAX_MERCHANDISING_SECTIONS = 2;
const MAX_SEARCH_SUGGESTIONS = 5;
const MAX_EXCLUDED_PRODUCTS = 60;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

const RELATED_SEARCH_RULES = [
  { when: ["valspar"], terms: ["Valspar Medallion Plus", "Valspar interior paint", "Valspar exterior paint"] },
  { when: ["drill"], terms: ["drill driver", "cordless drill", "hammer drill", "drill bits"] },
  { when: ["garden hose", "hose"], terms: ["garden hose", "hose nozzle", "lawn sprinkler", "hose repair"] },
  { when: ["paint"], terms: ["interior paint", "exterior paint", "paint brushes", "paint rollers"] },
  { when: ["circular saw", "saw"], terms: ["circular saw", "reciprocating saw", "saw blades", "cordless saw"] },
  { when: ["deck screw", "screw"], terms: ["deck screws", "wood screws", "structural screws", "driver bits"] },
  { when: ["faucet"], terms: ["kitchen faucet", "bathroom faucet", "faucet repair", "supply lines"] }
];

// Optional brand-line spotlights are additive. The project-affinity engine below
// remains the general merchandising path for every catalog search it recognizes.
const FEATURED_LINE_RULES = [
  {
    when: ["valspar"],
    term: "Valspar Medallion Plus",
    listName: "Featured: Valspar Medallion Plus",
    strategy: "featured_line_valspar_medallion_plus"
  }
];

let correctionIndexCache = { snapshotId: "", source: null, words: new Map() };

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
    match: entry.match || (entry.exactIdentifier || entry.exactPhrase ? "exact" : "close")
  };
}

function diversifyRanked(ranked, limit = MAX_RESULTS) {
  const selected = [];
  const deferred = [];
  const categoryCounts = new Map();
  ranked.forEach((entry) => {
    const key = normalizeText(entry.product?.category || "") || "uncategorized";
    const count = categoryCounts.get(key) || 0;
    if (count >= 2) deferred.push(entry);
    else {
      selected.push(entry);
      categoryCounts.set(key, count + 1);
    }
  });
  return selected.concat(deferred).slice(0, Math.max(1, Math.min(MAX_RESULTS, Number(limit) || MAX_RESULTS)));
}

function boundedDamerauLevenshtein(left, right, maximum = 2) {
  const first = String(left || "");
  const second = String(right || "");
  if (first === second) return 0;
  if (Math.abs(first.length - second.length) > maximum) return maximum + 1;
  const matrix = Array.from({ length: first.length + 1 }, () => Array(second.length + 1).fill(0));
  for (let row = 0; row <= first.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= second.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= first.length; row += 1) {
    let rowMinimum = maximum + 1;
    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
      if (
        row > 1 && column > 1 && first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + 1);
      }
      rowMinimum = Math.min(rowMinimum, matrix[row][column]);
    }
    if (rowMinimum > maximum && row > second.length + maximum) return maximum + 1;
  }
  return matrix[first.length][second.length];
}

function correctionIndex(catalog) {
  const snapshotId = String(catalog?.active?.id || "memory");
  if (
    correctionIndexCache.snapshotId === snapshotId &&
    correctionIndexCache.source === catalog.products &&
    correctionIndexCache.words.size
  ) return correctionIndexCache.words;

  const words = new Map();
  (catalog.products || []).filter(hasCustomerCardData).forEach((product) => {
    const brand = usableText(product.brand);
    const normalizedBrand = normalizeText(brand);
    const oneWordBrand = tokens(normalizedBrand).length === 1 ? tokens(normalizedBrand)[0] : "";
    const productWords = new Set(tokens(`${product.title} ${product.brand} ${product.category}`));
    productWords.forEach((word) => {
      if (!/^[a-z]{4,24}$/.test(word)) return;
      const current = words.get(word) || { word, display: word, count: 0, brandCount: 0 };
      current.count += 1;
      if (word === oneWordBrand) {
        current.brandCount += 1;
        current.display = brand;
      }
      words.set(word, current);
    });
  });
  correctionIndexCache = { snapshotId, source: catalog.products, words };
  return words;
}

function correctedQuery(catalog, query) {
  const queryTokens = tokens(query);
  if (queryTokens.length !== 1 || !/^[a-z]{4,24}$/.test(queryTokens[0])) return null;
  const queryWord = queryTokens[0];
  const words = correctionIndex(catalog);
  if (words.has(queryWord)) return null;
  const candidates = [];
  words.forEach((candidate) => {
    if (Math.abs(candidate.word.length - queryWord.length) > 2 || candidate.word[0] !== queryWord[0]) return;
    const distance = editDistanceAtMostOne(queryWord, candidate.word)
      ? 1
      : boundedDamerauLevenshtein(queryWord, candidate.word, 2);
    if (distance > 2) return;
    if (distance === 2 && (queryWord.length < 5 || candidate.word.length < 5 || queryWord.slice(0, 2) !== candidate.word.slice(0, 2))) return;
    const minimumCount = distance === 1 ? 2 : 3;
    if (candidate.count < minimumCount) return;
    candidates.push({
      ...candidate,
      distance,
      score: distance * 1000 - Math.min(candidate.count, 200) - Math.min(candidate.brandCount, 50) * 3
    });
  });
  candidates.sort((left, right) => left.score - right.score || left.word.localeCompare(right.word));
  if (!candidates.length) return null;
  return {
    normalized: candidates[0].word,
    display: usableText(candidates[0].display).slice(0, 100) || candidates[0].word,
    distance: candidates[0].distance
  };
}

function relatedSearchRule(query) {
  const normalized = normalizeText(query);
  return RELATED_SEARCH_RULES.find((rule) => rule.when.some((phrase) => {
    const candidate = normalizeText(phrase);
    return (` ${normalized} `).includes(` ${candidate} `) || (` ${candidate} `).includes(` ${normalized} `);
  })) || null;
}

function searchSuggestionCandidates(products, query, ranked) {
  const candidates = [];
  const rule = relatedSearchRule(query);
  if (rule) candidates.push(...rule.terms);
  const reference = ranked[0]?.product;
  const projectRule = reference ? affinityRule({
    category: reference.category,
    title: `${query} ${reference.title}`
  }) : null;
  if (projectRule) {
    projectRule.groups.forEach((group) => candidates.push(...group.categories.slice(0, 2)));
  }
  ranked.slice(0, 12).forEach((entry) => {
    const brand = usableText(entry.product?.brand);
    const leaf = categoryLabel(entry.product?.category);
    if (leaf) candidates.push(leaf);
    if (brand && !normalizeText(query).includes(normalizeText(brand))) candidates.push(`${brand} ${query}`);
  });
  const seen = new Set([normalizeText(query)]);
  const validated = [];
  for (const term of candidates) {
    if (validated.length >= MAX_SEARCH_SUGGESTIONS) break;
    const normalized = normalizeText(term);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    if (searchCatalog(products, term, 1).length > 0) validated.push(term);
  }
  return validated;
}

function buildSearchSuggestions(products, originalQuery, effectiveQuery, correction, ranked) {
  const result = [];
  if (correction) result.push({ term: correction.display, label: correction.display, type: "correction" });
  searchSuggestionCandidates(products, effectiveQuery, ranked).forEach((term) => {
    if (result.length >= MAX_SEARCH_SUGGESTIONS) return;
    if (normalizeText(term) === normalizeText(originalQuery)) return;
    result.push({ term: usableText(term).slice(0, 100), label: usableText(term).slice(0, 100), type: "related" });
  });
  return result.slice(0, MAX_SEARCH_SUGGESTIONS);
}

function diversifyMerchandising(entries, limit = MAX_MERCHANDISING_RESULTS) {
  const selected = [];
  const deferred = [];
  const categoryCounts = new Map();
  entries.forEach((entry) => {
    const key = normalizeText(entry.product?.category || "") || "uncategorized";
    const count = categoryCounts.get(key) || 0;
    if (count >= 2) deferred.push(entry);
    else {
      selected.push(entry);
      categoryCounts.set(key, count + 1);
    }
  });
  return selected.concat(deferred).slice(0, limit);
}

function sectionPayload({ listId, listName, eyebrow, strategy, placementAfter, entries }) {
  return {
    listId,
    listName,
    eyebrow,
    strategy,
    placementAfter,
    recommendations: entries.map(publicSuggestion)
  };
}

function featuredLineSection(products, query, excluded) {
  const normalized = normalizeText(query);
  const rule = FEATURED_LINE_RULES.find((candidate) => candidate.when.some((term) => (` ${normalized} `).includes(` ${normalizeText(term)} `)));
  if (!rule) return null;
  const entries = searchCatalog(products.filter((product) => !excluded.has(String(product.productId))), rule.term, 24)
    .filter((entry) => normalizeText(entry.product?.title).includes(normalizeText(rule.term)))
    .slice(0, MAX_MERCHANDISING_RESULTS)
    .map((entry) => ({ ...entry, match: "featured_line" }));
  if (entries.length < 3) return null;
  return sectionPayload({
    listId: `search_featured_${normalizeText(rule.term).replace(/\s+/g, "_")}_v2`,
    listName: rule.listName,
    eyebrow: "Featured product line",
    strategy: rule.strategy,
    placementAfter: 8,
    entries
  });
}

function affinityEntries(products, reference, group, excluded) {
  const ranked = products.filter((product) => {
    const productId = String(product.productId || "");
    return !excluded.has(productId) && affinityCategoryIndex(product.category, group) >= 0;
  }).map((product) => ({
    product,
    match: "project_affinity",
    categoryRank: affinityCategoryIndex(product.category, group)
  })).sort((left, right) => (
    left.categoryRank - right.categoryRank || String(left.product.title).localeCompare(String(right.product.title))
  ));
  return diversifyMerchandising(ranked, MAX_MERCHANDISING_RESULTS);
}

function merchandisingSections(products, query, excluded, ranked) {
  const sections = [];
  const used = new Set(excluded);
  const featured = featuredLineSection(products, query, used);
  if (featured) {
    sections.push(featured);
    featured.recommendations.forEach((item) => used.add(String(item.productId)));
  }
  const reference = ranked[0]?.product;
  const rule = reference ? affinityRule({
    category: reference.category,
    title: `${query} ${reference.title}`
  }) : null;
  if (rule) {
    rule.groups.forEach((group) => {
      if (sections.length >= MAX_MERCHANDISING_SECTIONS) return;
      const entries = affinityEntries(products, reference, group, used);
      if (entries.length < 3) return;
      const placementAfter = sections.length === 0 ? 8 : 24;
      const section = sectionPayload({
        listId: `search_project_${rule.id}_${group.id}_v2`,
        listName: group.name,
        eyebrow: "Complete the project",
        strategy: `curated_search_${rule.id}_${group.id}`,
        placementAfter,
        entries
      });
      sections.push(section);
      section.recommendations.forEach((item) => used.add(String(item.productId)));
    });
  }
  return sections.slice(0, MAX_MERCHANDISING_SECTIONS).map((section, index) => ({
    ...section,
    placementAfter: index === 0 ? 8 : 24
  }));
}

function buildSuggestionPayload(catalog, query, nativeResultCount = 0, excluded = new Set()) {
  const nativeCount = cleanNativeResultCount(nativeResultCount);
  const safeProducts = (catalog.products || []).filter(hasCustomerCardData);
  const correction = nativeCount === 0 ? correctedQuery(catalog, query) : null;
  const effectiveQuery = correction?.normalized || query;
  const rankedAll = searchCatalog(safeProducts, effectiveQuery, 32);
  const searchSuggestions = buildSearchSuggestions(safeProducts, query, effectiveQuery, correction, rankedAll);
  const recovery = nativeCount === 0;
  const ranked = recovery
    ? diversifyRanked(rankedAll.filter((entry) => !excluded.has(String(entry.product?.productId))), MAX_RESULTS)
    : [];
  const suggestions = ranked.map(publicSuggestion);
  const sections = recovery ? [] : merchandisingSections(safeProducts, effectiveQuery, excluded, rankedAll);
  return {
    success: true,
    mode: recovery ? "recovery" : "merchandising",
    hasSuggestions: suggestions.length > 0 || sections.length > 0 || searchSuggestions.length > 0,
    matchType: correction
      ? "corrected"
      : (rankedAll.length && (rankedAll[0].exactIdentifier || rankedAll[0].exactPhrase) ? "exact" : (rankedAll.length ? "close" : "none")),
    suggestedTerm: correction?.display || "",
    nativeResultCount: nativeCount,
    listId: "search_recovery_matches_v2",
    listName: "Possible matches",
    algorithm: ALGORITHM_VERSION,
    strategy: "catalog_correction_and_recovery",
    effectiveQuery: usableText(effectiveQuery).slice(0, 100),
    searchSuggestions,
    suggestions,
    sections
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
  boundedDamerauLevenshtein,
  buildSearchSuggestions,
  buildSuggestionPayload,
  categoryLabel,
  cleanNativeResultCount,
  cleanQuery,
  correctedQuery,
  correctionIndex,
  diversifyRanked,
  excludedProductIds,
  hasCustomerCardData,
  publicSuggestion,
  merchandisingSections,
  relatedSearchRule,
  setCorsHeaders
};
