"use strict";

const { getAiCatalogProducts } = require("./ai-product-catalog");
const { departments = [] } = require("../webtrack-departments.json");

const STOP_WORDS = new Set([
  "a", "about", "all", "an", "and", "around", "at", "basic", "browse", "building", "can", "carry",
  "category", "categories", "do", "find", "for", "have", "i", "im", "in", "item",
  "items", "kind", "look", "looking", "me", "need", "of", "on", "or", "please",
  "probably", "product", "products", "shop", "should", "show", "small", "some",
  "something", "the", "to", "want", "what", "with", "x", "you", "your"
]);
const LOW_WEIGHT_TOKENS = new Set(["board", "foot", "long", "lumber", "outdoor", "treated", "wall", "wood"]);
const NUMBER_WORDS = new Map([
  ["one", "1"], ["two", "2"], ["three", "3"], ["four", "4"], ["five", "5"],
  ["six", "6"], ["seven", "7"], ["eight", "8"], ["nine", "9"], ["ten", "10"],
  ["twelve", "12"], ["sixteen", "16"]
]);
const GROUP_INTENT = /\b(?:browse|categories|category|department|group|shop|show\s+(?:me\s+)?all|where\s+can\s+i\s+(?:browse|find|shop))\b/i;
const SENSITIVE_REQUEST = /\b(?:average\s+cost|avg\.?\s+cost|cost\s+basis|dealer\s+cost|invoice\s+cost|landed\s+cost|product\s+cost|purchase\s+cost|wholesale\s+cost|what\s+(?:do|did)\s+(?:you|woodson)\s+pay|margin|markup|profit|supplier\s+price|vendor\s+price)\b/i;
const WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";

function setCorsHeaders(req, res) {
  const origin = String(req.headers?.origin || "");
  if (origin === WEBTRACK_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\btutle\s*box\b/gi, "turtlebox")
    .replace(/\bturtle\s+box\b/gi, "turtlebox")
    .replace(/\bturtlebox\s+speakers?\b/gi, "turtlebox")
    .replace(/½/g, " 1 2 ")
    .replace(/¼/g, " 1 4 ")
    .replace(/¾/g, " 3 4 ")
    .replace(/[×✕]/g, " x ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|sixteen)\b/g, (word) => NUMBER_WORDS.get(word))
    .replace(/\b(\d+)\s+by\s+(\d+)\b/g, "$1 x $2")
    .replace(/\b(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\b/g, "$1 x $2 x $3")
    .replace(/\b(\d+)\s*x\s*(\d+)s\b/g, "$1 x $2")
    .replace(/\b(\d+)\s*x\s*(\d+)\b/g, "$1 x $2")
    .replace(/(\d)\s*[\"”]/g, "$1 inch ")
    .replace(/(\d)\s*[\'’]/g, "$1 foot ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalToken(token) {
  if (/^\d+$/.test(token)) return String(Number(token));
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokens(value) {
  return Array.from(new Set(
    normalizeText(value)
      .split(" ")
      .map(canonicalToken)
      .filter((token) => token && !STOP_WORDS.has(token))
  ));
}

function tokenWeight(token) {
  if (/^\d+$/.test(token)) return 1.3;
  return LOW_WEIGHT_TOKENS.has(token) ? 0.25 : 1;
}

function dimensionalSignature(value) {
  const normalized = normalizeText(value);
  const direct = normalized.match(/\b(\d{1,2})\s+x\s+(\d{1,2})(?:\s+(?:x\s+)?0?(\d{1,2}))?\b/);
  if (!direct) return "";
  const parts = [direct[1], direct[2]].map((part) => String(Number(part)));
  if (direct[3]) parts.push(String(Number(direct[3])));
  if (parts.length === 2) {
    const after = normalized.slice((direct.index || 0) + direct[0].length);
    const length = after.match(/\b0?(\d{1,2})\s+(?:feet|foot|ft)\b/);
    if (length) parts.push(String(Number(length[1])));
  }
  return parts.join("x");
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
  const identifiers = [product.productId, product.productCode, product.gtin, product.mpn].map(normalizeText).filter(Boolean);
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
    dimension: dimensionalSignature(product.title),
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
  const queryDimension = dimensionalSignature(query);
  const ranked = [];

  for (const product of products) {
    const fields = productFields(product);
    if (brandGuard.size && !brandGuard.has(fields.brand)) continue;
    const exactIdentifier = fields.identifiers.some((value) => value.replace(/\s+/g, "") === compactQuery);
    const exactPhrase = fields.searchable.includes(normalizedQuery);
    const exactDimension = !!queryDimension && (
      fields.dimension === queryDimension || fields.dimension.startsWith(`${queryDimension}x`)
    );
    let matched = 0;
    let titleMatched = 0;
    let categoryMatched = 0;
    let totalWeight = 0;
    for (const token of queryTokens) {
      const weight = tokenWeight(token);
      const overall = tokenMatchScore(token, fields.searchableTokens);
      totalWeight += weight;
      matched += overall * weight;
      titleMatched += tokenMatchScore(token, fields.titleTokens) * weight;
      categoryMatched += tokenMatchScore(token, fields.categoryTokens) * weight;
    }
    const coverage = matched / totalWeight;
    const titleCoverage = titleMatched / totalWeight;
    const categoryCoverage = categoryMatched / totalWeight;

    if (!exactIdentifier) {
      if (queryTokens.length === 1) {
        if (!exactPhrase && titleCoverage < 0.7 && categoryCoverage < 0.7 && !fields.code.includes(normalizedQuery)) continue;
      } else if (!exactDimension && (coverage < (queryTokens.length >= 3 ? 0.8 : 0.66) || (!exactPhrase && titleCoverage < 0.45 && categoryCoverage < 0.5))) {
        continue;
      }
    }

    let score = coverage * 100 + titleCoverage * 85 + categoryCoverage * 25;
    if (exactPhrase) score += 70;
    if (fields.title === normalizedQuery) score += 140;
    if (fields.code === normalizedQuery) score += 220;
    if (exactIdentifier) score += 300;
    if (exactDimension) score += 260;
    if (queryDimension && fields.dimension && fields.dimension !== queryDimension) score -= 120;
    if (queryDimension && fields.title.startsWith(queryDimension.split("x").join(" x "))) score += 90;
    if (queryDimension && fields.categoryTokens.has("lumber")) score += 35;
    if (fields.title.startsWith(normalizedQuery)) score += 45;
    if (product.availability === "in_stock") score += 3;
    ranked.push({ product, score, exactIdentifier, exactPhrase, exactDimension });
  }

  const eligible = queryDimension && ranked.some((entry) => entry.exactDimension)
    ? ranked.filter((entry) => entry.exactDimension)
    : ranked;
  return eligible
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
    imageUrl: product.imageUrl,
    category: product.category,
    gtin: product.gtin,
    mpn: product.mpn
  };
}

function selectRelevantMatches(ranked, limit = 3, query = "") {
  if (!Array.isArray(ranked) || !ranked.length) return [];
  const top = ranked[0];
  if (top.exactIdentifier || ranked.length === 1) return [top];

  const second = ranked[1];
  const scoreGap = top.score - second.score;
  const normalizedQuery = normalizeText(query);
  const broadCategoryRequest = !!normalizedQuery &&
    !/\d/.test(normalizedQuery) &&
    tokens(normalizedQuery).length <= 2 &&
    normalizeText(top.product?.title) !== normalizedQuery;
  if (
    !broadCategoryRequest &&
    (
      scoreGap >= 60 ||
      (top.exactPhrase && scoreGap >= 35) ||
      (top.exactDimension && scoreGap >= 30)
    )
  ) {
    return [top];
  }

  return ranked
    .filter((entry) => top.score - entry.score <= 75)
    .slice(0, Math.max(1, Math.min(3, Number(limit) || 3)));
}

function resultLine(product, index) {
  const code = product.productCode ? `${product.productCode} — ` : "";
  const displayPrice = product.salePrice || product.price;
  const price = displayPrice ? ` — ${displayPrice}` : "";
  const image = product.imageUrl ? `\n[View product image](${product.imageUrl})` : "";
  const link = product.productUrl ? `\n[View product details](${product.productUrl})` : "";
  return `${index + 1}. ${code}${product.title}${price}${image}${link}`;
}

function formatSearchResponse(query, ranked) {
  const selected = selectRelevantMatches(ranked, 3, query);
  const results = selected.map((entry, index) => publicProduct(entry.product, index + 1));
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
  const matchType = selected[0].exactIdentifier || selected[0].exactPhrase ? "exact" : "close";
  const answer = [
    results.length === 1
      ? "This is the best match I found:"
      : "These are the closest matches I found, with the most relevant first:",
    ...results.map(resultLine),
    "Online prices and availability can change; a Woodson team member can confirm before you make the trip."
  ].join("\n");
  return { success: true, hasResults: true, matchType, query, answer, results };
}

function formatProductActionResponse(query, ranked, action) {
  const exact = ranked.find((entry) => entry.exactIdentifier && entry.product && entry.product.productUrl);
  if (!exact) {
    const alternatives = selectRelevantMatches(ranked, 3, query);
    const results = alternatives.map((entry, index) => publicProduct(entry.product, index + 1));
    if (results.length) {
      return {
        success: true,
        hasResults: true,
        matchType: "close",
        query,
        requestedAction: action,
        actionReady: false,
        answer: [
          results.length === 1
            ? "I found this likely match, but I need you to confirm the exact item before I change your cart:"
            : "I found these likely matches, but I need you to choose the exact item before I change your cart:",
          ...results.map(resultLine),
          "I did not change your cart. Reply with the exact item number you want."
        ].join("\n"),
        results
      };
    }
    return {
      success: true,
      hasResults: false,
      matchType: "none",
      query,
      requestedAction: action,
      actionReady: false,
      answer: "I couldn't verify the exact product, so I did not open a page or change your cart. Please send the item number or a more specific product name.",
      results: []
    };
  }

  const result = publicProduct(exact.product, 1);
  const introduction = action === "add_to_cart"
    ? "I'm sending this item to your WebTrack cart now. Please look for the cart confirmation on this page; do not rely on this message alone. No order will be placed:"
    : "Opening this product in WebTrack:";
  const answer = [
    introduction,
    resultLine(result, 0),
    "Online prices and availability can change; a Woodson team member can confirm before you make the trip."
  ].join("\n");

  return {
    success: true,
    hasResults: true,
    matchType: "exact",
    query,
    requestedAction: action,
    actionReady: true,
    actionStatus: action === "add_to_cart" ? "browser_confirmation_required" : "browser_navigation_requested",
    answer,
    results: [result]
  };
}

function groupRows() {
  const rows = [];
  for (const department of departments) {
    rows.push({
      groupName: department.name,
      groupUrl: department.href,
      parentGroup: "",
      normalizedName: normalizeText(department.name),
      nameTokens: new Set(tokens(department.name))
    });
    for (const subcategory of department.subcategories || []) {
      rows.push({
        groupName: subcategory.name,
        groupUrl: subcategory.href,
        parentGroup: department.name,
        normalizedName: normalizeText(subcategory.name),
        nameTokens: new Set(tokens(subcategory.name))
      });
    }
  }
  return rows;
}

function searchProductGroups(query, limit = 5) {
  if (!GROUP_INTENT.test(query)) return [];
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokens(normalizedQuery);
  if (!queryTokens.length) return [];
  const ranked = [];
  for (const row of groupRows()) {
    const phraseMatch = (` ${normalizedQuery} `).includes(` ${row.normalizedName} `);
    let matched = 0;
    for (const token of queryTokens) matched += tokenMatchScore(token, row.nameTokens);
    const coverage = matched / queryTokens.length;
    if (!phraseMatch && coverage < 0.75) continue;
    let score = coverage * 100;
    if (phraseMatch) score += 180;
    if (row.normalizedName === normalizedQuery) score += 100;
    if (!row.parentGroup) score += 12;
    ranked.push({ ...row, score });
  }
  return ranked
    .sort((left, right) => right.score - left.score || left.groupName.localeCompare(right.groupName))
    .slice(0, Math.max(1, Math.min(5, Number(limit) || 5)));
}

function formatGroupResponse(query, groups) {
  const results = groups.map((group, index) => ({
    rank: index + 1,
    groupName: group.groupName,
    parentGroup: group.parentGroup,
    groupUrl: group.groupUrl
  }));
  const answer = results.length === 1
    ? `Browse Woodson Lumber's ${results[0].groupName} selection:\n[Open ${results[0].groupName}](${results[0].groupUrl})`
    : [
        "Here are the closest Woodson Lumber product groups:",
        ...results.map((group, index) => `${index + 1}. [${group.parentGroup ? `${group.parentGroup} — ` : ""}${group.groupName}](${group.groupUrl})`)
      ].join("\n");
  return {
    success: true,
    hasResults: true,
    matchType: "group",
    resultType: "groups",
    query,
    answer,
    results
  };
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
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Only POST is allowed." });
  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const query = String(body.query || "").replace(/\s+/g, " ").trim().slice(0, 240);
    const requestedAction = ["view_product", "add_to_cart"].includes(body.action) ? body.action : "search";
    const productCode = String(body.productCode || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!query) return sendJson(res, 400, { error: "A non-empty query is required." });
    if (SENSITIVE_REQUEST.test(query)) return sendJson(res, 200, sensitiveResponse(query));
    const groupMatches = requestedAction === "search" ? searchProductGroups(query, 5) : [];
    if (groupMatches.length) return sendJson(res, 200, formatGroupResponse(query, groupMatches));

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
    if (requestedAction !== "search") {
      const actionQuery = productCode || query;
      return sendJson(
        res,
        200,
        formatProductActionResponse(query, searchCatalog(catalog.products, actionQuery, 5), requestedAction)
      );
    }
    return sendJson(res, 200, formatSearchResponse(query, searchCatalog(catalog.products, query, 8)));
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
  dimensionalSignature,
  formatGroupResponse,
  formatProductActionResponse,
  formatSearchResponse,
  normalizeText,
  publicProduct,
  searchCatalog,
  searchProductGroups,
  selectRelevantMatches,
  setCorsHeaders,
  sensitiveResponse,
  tokens
};
