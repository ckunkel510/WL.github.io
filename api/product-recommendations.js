"use strict";

const { getAiCatalogProducts } = require("./ai-product-catalog");
const { normalizeText, tokens } = require("./ai-product-search")._test;

const WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";
const ALGORITHM_VERSION = "merchant_category_affinity_v2";
const COMPARE_LIST_ID = "pdp_compare_similar_v2";
const MAX_RESULTS = 8;
const MIN_RESULTS = 3;
const MAX_SECTIONS = 4;
const MAX_EXCLUDED_PRODUCTS = 60;

// Explicit merchandising relationships avoid implying that these products were
// purchased together. Anonymous order-line data can augment them later.
const AFFINITY_RULES = [
  {
    id: "watering",
    when: ["watering", "garden hose", "soaker hose", "hose nozzle", "sprinkler", "irrigation"],
    groups: [
      { id: "hose_accessories", name: "Nozzles & hose connections", match: "leaf", categories: ["hose nozzles", "hose repair parts", "hose carts reels hangers"] },
      { id: "watering_control", name: "Sprinklers & watering control", match: "leaf", categories: ["sprinklers", "watering timers", "drip irrigation rainbird", "underground irrigation orbit", "underground irrigation rainbird", "watering cans", "sprinkling cans watering cans"] },
      { id: "plant_care", name: "Lawn & garden care", categories: ["lawn fertilizer", "specialty fertilizers", "potting soils", "garden soils", "soil conditioners"] }
    ]
  },
  {
    id: "water_heaters",
    when: ["water heater", "pressure relief valve"],
    groups: [
      { id: "installation", name: "Water-heater installation essentials", categories: ["water heater parts", "gas supply lines", "water connectors", "supply lines", "valves"] },
      { id: "pipe_connections", name: "Pipe, fittings & connections", categories: ["pipe fittings", "tubing", "pipe repair", "drain supply"] },
      { id: "plumbing_tools", name: "Plumbing tools & sealants", categories: ["plumbing tools", "solvents sealers", "pipe insulation"] }
    ]
  },
  {
    id: "paint",
    when: ["paint sundries", "paint stains", "interior paint", "exterior paint", "spray paint", "wood stain", "primer", "caulk"],
    groups: [
      { id: "applicators", name: "Brushes, rollers & applicators", categories: ["paint applicators", "applicators", "paint brushes", "paint rollers", "power painting"] },
      { id: "prep", name: "Prep, tape & surface repair", categories: ["painting accessories", "tapes", "sandpaper", "abrasives non power", "patching repair", "knives scrapers", "plastic sheeting"] },
      { id: "seal", name: "Caulk, sealants & adhesives", categories: ["caulk sealants", "caulk", "sealants", "construction adhesives", "expanding foam"] }
    ]
  },
  {
    id: "decking",
    when: ["deck board", "decking"],
    groups: [
      { id: "hardware", name: "Deck fasteners & framing hardware", match: "leaf", categories: ["deck fasteners", "deck screws", "structural screws", "joist hangers", "deck patio construction", "post anchors caps"] },
      { id: "foundation", name: "Posts & structural support", match: "leaf", categories: ["treated posts", "post anchors caps", "bagged products", "building forms", "cut rebar rebar pins"] },
      { id: "finish", name: "Protect & finish the project", categories: ["deck coating", "exterior stains", "wood stains", "waterproofing", "sealants"] }
    ]
  },
  {
    id: "fencing",
    when: ["wood fencing", "chain link fencing", "fence post", "fence panel", "field fence", "barbwire"],
    groups: [
      { id: "hardware", name: "Fence & gate hardware", match: "leaf", categories: ["gate shed hardware", "chain link parts", "fence brackets", "gate openers", "clips tools"] },
      { id: "posts", name: "Fence posts & concrete", match: "leaf", categories: ["fence posts", "treated posts", "steel t posts", "cedar posts", "bagged products"] },
      { id: "tools", name: "Fencing tools & accessories", categories: ["fencing materials", "wire products", "crimping sleeves splices", "electric fence products"] }
    ]
  },
  {
    id: "lumber",
    when: ["lumber", "yellow pine", "plywood", "sheathing", "osb", "hardwood"],
    groups: [
      { id: "fastening", name: "Fasteners & framing hardware", match: "leaf", categories: ["structural screws", "joist hangers", "wood screws", "common", "sinker", "box", "stick framing", "brads finish nails"] },
      { id: "cutting", name: "Wood-cutting & measuring tools", match: "leaf", categories: ["saw blades carbide combo rip", "saw blades plywood", "tape measures tape rules", "squares speed type", "levels torpedo", "hand saws"] },
      { id: "bonding", name: "Adhesives, sealants & finishes", categories: ["construction adhesives", "caulk sealants", "exterior stains", "wood stains", "primers sealers"] }
    ]
  },
  {
    id: "power_tools",
    when: ["power tools", "cordless drill", "electric drill", "impact driver", "circular saw", "reciprocating saw", "grinder"],
    groups: [
      { id: "accessories", name: "Bits, blades & accessories", categories: ["screwdriving bits", "power drilling", "saw blades", "power cutting accessories", "grinding cut off wheels", "power abrasive accessories"] },
      { id: "power", name: "Batteries & jobsite power", match: "leaf", categories: ["power tool batteries", "batteries accessories", "outdoor extension cords", "multi outlet extension cords", "cord storage adapters", "generators accessories"] },
      { id: "safety", name: "Safety & tool organization", categories: ["safety organization", "tool holders", "garage organizers", "storage hooks"] }
    ]
  },
  {
    id: "roofing",
    when: ["roofing", "asphalt shingles", "metal roofing", "roof flashing", "roof ventilation"],
    groups: [
      { id: "weatherproofing", name: "Underlayment, flashing & ventilation", categories: ["roofing underlayments", "roof flashing", "roofing ventilation", "metal edgings"] },
      { id: "fasteners", name: "Roofing fasteners", categories: ["roofing nails", "coil roofing", "roofing screws", "siding roofing fasteners"] },
      { id: "sealants", name: "Roof coatings & sealants", categories: ["roof coatings", "roof driveway", "sealants", "caulk"] }
    ]
  },
  {
    id: "drywall",
    when: ["drywall", "gypsum", "joint compound"],
    groups: [
      { id: "finish", name: "Joint compound & finishing", categories: ["joint compounds", "corner beads", "patching repair"] },
      { id: "fasteners", name: "Drywall fasteners", categories: ["drywall screws", "collated screws", "plasterboard"] },
      { id: "tools", name: "Knives, sanding & application tools", categories: ["knives scrapers", "sandpaper", "abrasives non power", "painting accessories"] }
    ]
  },
  {
    id: "concrete",
    when: ["concrete", "mortar", "masonry", "cement"],
    groups: [
      { id: "reinforcement", name: "Rebar, forms & reinforcement", categories: ["rebar", "building forms", "concrete steps", "blocks"] },
      { id: "anchors", name: "Concrete anchors & fasteners", categories: ["concrete screws", "concrete masonry", "wedge", "hammer drive"] },
      { id: "tools", name: "Masonry tools & finishing supplies", categories: ["masonry tools", "trowels", "concrete mortar sand mixes", "patching repair"] }
    ]
  },
  {
    id: "plumbing",
    when: ["plumbing", "pipe", "faucet", "toilet", "pump", "valve", "drain"],
    groups: [
      { id: "connections", name: "Pipe, fittings & connections", categories: ["pipe fittings", "tubing", "supply lines", "valves"] },
      { id: "repair", name: "Repair parts & sealants", categories: ["pipe repair", "faucet sink repair", "toilet repair", "shower bath repair", "solvents sealers"] },
      { id: "tools", name: "Plumbing tools & maintenance", categories: ["plumbing tools", "drain openers", "pipe insulation"] }
    ]
  },
  {
    id: "electrical",
    when: ["electrical", "light fixture", "light bulb", "extension cord", "switches", "receptacles"],
    groups: [
      { id: "connections", name: "Wire, connectors & fittings", categories: ["electrical wire", "electrical connectors", "electrical fittings", "conduit"] },
      { id: "boxes", name: "Boxes, plates & controls", categories: ["electrical boxes", "cover plates", "switches receptacles", "fuses breakers"] },
      { id: "tools", name: "Electrical tools & testers", categories: ["tools testers", "fire home protection", "portable lighting"] }
    ]
  },
  {
    id: "doors_windows",
    when: ["doors windows", "pre hung", "door hardware", "window hardware", "screen door", "storm door"],
    groups: [
      { id: "hardware", name: "Door & window hardware", categories: ["door accessories", "door knobs", "window hardware", "screen storm door hardware", "hinges"] },
      { id: "weatherproofing", name: "Weatherproofing & sealants", categories: ["weatherstripping", "thresholds floor trim", "caulk sealants", "expanding foam"] },
      { id: "screen_repair", name: "Screen & window repair", categories: ["screen wire repair", "window accessories", "plexiglass"] }
    ]
  },
  {
    id: "garden_care",
    when: ["fertilizer", "potting soil", "garden soil", "planter", "plant supports", "seed plant"],
    groups: [
      { id: "soil", name: "Soil, fertilizer & plant care", categories: ["lawn fertilizer", "specialty fertilizers", "potting soils", "garden soils", "soil conditioners"] },
      { id: "watering", name: "Watering essentials", categories: ["garden hoses", "hose nozzles", "sprinklers", "watering cans", "watering timers"] },
      { id: "tools", name: "Garden tools & planters", categories: ["garden hand tools", "long handle tools", "pots planters", "plant supports"] }
    ]
  },
  {
    id: "outdoor_cooking",
    when: ["grill", "firepit", "deep cooker", "fryer"],
    groups: [
      { id: "accessories", name: "Grill tools & accessories", categories: ["grill accessories", "thermometers gauges", "gadgets"] },
      { id: "fuel", name: "Fuel & fire-starting supplies", categories: ["charcoal wood pellet", "propane", "fireplace accessories"] },
      { id: "serve", name: "Coolers, drinkware & outdoor serving", categories: ["ice chests", "water jugs bottles", "outdoor furniture", "paper plastic products"] }
    ]
  },
  {
    id: "pools",
    when: ["swimming pools", "pool spa", "pool cleaning", "pool vacuum"],
    groups: [
      { id: "chemicals", name: "Pool & spa chemicals", categories: ["pool spa chemicals"] },
      { id: "cleaning", name: "Pool cleaning & maintenance", categories: ["pool cleaning maintenance", "pool vacuuming accessories"] },
      { id: "equipment", name: "Pumps & pool equipment", categories: ["pumps equipment", "swimming pools equipment"] }
    ]
  },
  {
    id: "fasteners",
    when: ["bolts screws nails", "fasteners", "deck screws", "wood screws", "structural screws", "anchors"],
    groups: [
      { id: "driver_bits", name: "Driver bits & drilling accessories", categories: ["screwdriving bits", "power drilling accessories", "electric drills"] },
      { id: "tools", name: "Hand tools for the job", categories: ["mechanics tools", "clamps fastening tools", "measuring marking"] },
      { id: "related_hardware", name: "Related construction hardware", categories: ["joist hangers", "construction hardware", "braces", "hinges"] }
    ]
  }
];

let catalogIndexCache = { snapshotId: "", source: null, byId: new Map(), byCategory: new Map(), byParent: new Map() };

function cleanProductId(value) {
  const productId = String(value ?? "").trim();
  if (!/^\d{1,20}$/.test(productId)) throw new Error("A numeric WebTrack product ID is required.");
  return productId;
}

function excludedProductIds(value) {
  const excluded = new Set();
  String(value ?? "").split(",").slice(0, MAX_EXCLUDED_PRODUCTS).forEach((candidate) => {
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
  return usableText(value).split(">").map((part) => normalizeText(part)).filter(Boolean);
}

function categoryKey(value) {
  return categoryParts(value).join(" > ");
}

function parentCategoryKey(value) {
  const parts = categoryParts(value);
  return parts.length >= 3 ? parts.slice(0, -1).join(" > ") : "";
}

function categoryLabel(value) {
  const parts = usableText(value).split(">").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1].replace(/^shop all\s+/i, "") : "";
}

function hasCustomerCardData(product) {
  return !!(product && /^\d{1,20}$/.test(String(product.productId || "")) && usableText(product.title) &&
    /^https:\/\//i.test(String(product.productUrl || "")) && /^https:\/\//i.test(String(product.imageUrl || "")) &&
    product.availability === "in_stock");
}

function overlapScore(left, right) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => { if (rightTokens.has(token)) intersection += 1; });
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
  if (catalogIndexCache.snapshotId === snapshotId && catalogIndexCache.source === catalog.products && catalogIndexCache.byId.size) {
    return catalogIndexCache;
  }
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

function rankCandidates(current, candidates, exactCategory, excluded, scoreBoost) {
  const currentCategory = categoryKey(current.category);
  const currentBrand = normalizeText(current.brand);
  const seen = new Set();
  return candidates.filter((candidate) => {
    const productId = String(candidate.productId || "");
    if (!hasCustomerCardData(candidate) || productId === current.productId || excluded.has(productId) || seen.has(productId)) return false;
    seen.add(productId);
    return true;
  }).map((candidate) => {
    const sameCategory = categoryKey(candidate.category) === currentCategory;
    const sameBrand = currentBrand && normalizeText(candidate.brand) === currentBrand;
    const extra = typeof scoreBoost === "function" ? Number(scoreBoost(candidate)) || 0 : 0;
    return {
      product: candidate,
      score: (sameCategory ? 200 : exactCategory ? 120 : 90) + overlapScore(current.title, candidate.title) * 55 +
        priceSimilarity(current.salePrice || current.price, candidate.salePrice || candidate.price) * 20 + (sameBrand ? 6 : 0) + extra,
      match: sameCategory ? "same_category" : "related_category"
    };
  }).sort((left, right) => right.score - left.score || String(left.product.title).localeCompare(String(right.product.title)));
}

function diversify(ranked, limit = MAX_RESULTS) {
  const selected = [];
  const deferred = [];
  const brandCounts = new Map();
  ranked.forEach((entry) => {
    const brand = normalizeText(entry.product.brand);
    const count = brand ? brandCounts.get(brand) || 0 : 0;
    if (brand && count >= 2) deferred.push(entry);
    else if (selected.length < limit) {
      selected.push(entry);
      if (brand) brandCounts.set(brand, count + 1);
    }
  });
  deferred.forEach((entry) => { if (selected.length < limit) selected.push(entry); });
  return selected.slice(0, limit);
}

function diversifyCategories(ranked, limit = MAX_RESULTS) {
  const selected = [];
  const deferred = [];
  const categoryCounts = new Map();
  ranked.forEach((entry) => {
    const key = categoryKey(entry.product.category);
    const count = categoryCounts.get(key) || 0;
    if (count >= 2) deferred.push(entry);
    else {
      selected.push(entry);
      categoryCounts.set(key, count + 1);
    }
  });
  return diversify(selected.concat(deferred), limit);
}

function publicRecommendation(entry, index) {
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
    productUrl: String(product.productUrl).slice(0, 500),
    imageUrl: String(product.imageUrl).slice(0, 500),
    match: entry.match
  };
}

function comparisonEntries(index, current, excluded, limit) {
  const exact = index.byCategory.get(categoryKey(current.category)) || [];
  const parentKey = parentCategoryKey(current.category);
  const siblings = parentKey ? index.byParent.get(parentKey) || [] : [];
  const exactRanked = rankCandidates(current, exact, true, excluded);
  if (exactRanked.length >= MIN_RESULTS) return diversify(exactRanked, limit);
  const exactIds = new Set(exactRanked.map((entry) => String(entry.product.productId)));
  const siblingRanked = rankCandidates(current, siblings.filter((candidate) => !exactIds.has(String(candidate.productId))), false, excluded);
  return diversify(exactRanked.concat(siblingRanked), limit);
}

function phraseIndex(value, phrases) {
  const normalized = normalizeText(value);
  for (let index = 0; index < phrases.length; index += 1) {
    const phrase = normalizeText(phrases[index]);
    if (phrase && normalized.includes(phrase)) return index;
  }
  return -1;
}

function affinityRule(current) {
  const searchable = `${usableText(current.category)} ${usableText(current.title)}`;
  return AFFINITY_RULES.find((rule) => phraseIndex(searchable, rule.when) >= 0) || null;
}

function affinityCategoryIndex(category, group) {
  return phraseIndex(group.match === "leaf" ? categoryLabel(category) : category, group.categories);
}

function recommendationsForAffinityGroup(index, current, group, excluded, limit) {
  const currentKey = categoryKey(current.category);
  const candidates = [];
  index.byCategory.forEach((products, key) => {
    if (key !== currentKey && affinityCategoryIndex(products[0]?.category || key, group) >= 0) candidates.push(...products);
  });
  const ranked = rankCandidates(current, candidates, false, excluded, (candidate) => {
    const matchedAt = affinityCategoryIndex(candidate.category, group);
    return matchedAt < 0 ? 0 : Math.max(0, group.categories.length - matchedAt) * 8;
  });
  return diversifyCategories(ranked, limit);
}

function commonPrefixLength(left, right) {
  const length = Math.min(left.length, right.length);
  let result = 0;
  while (result < length && left[result] === right[result]) result += 1;
  return result;
}

function isPromotionalCategory(key) {
  return /^(?:deals|clearance|gift zone|new product zone|sales tax holiday|holiday decorations)(?: >|$)/.test(key);
}

function fallbackCategoryKeys(index, current, excludedCategories, excludedProducts) {
  const currentParts = categoryParts(current.category);
  const currentKey = categoryKey(current.category);
  if (currentParts.length < 3) return [];
  const immediatePrefix = currentParts.slice(0, -1).join(" > ");
  const widerPrefix = currentParts.length >= 4 ? currentParts.slice(0, -2).join(" > ") : "";
  const choices = [];
  index.byCategory.forEach((products, key) => {
    if (key === currentKey || excludedCategories.has(key) || isPromotionalCategory(key)) return;
    const eligible = products.filter((product) => !excludedProducts.has(String(product.productId)));
    if (eligible.length < MIN_RESULTS) return;
    const parts = categoryParts(key);
    const parent = parts.slice(0, -1).join(" > ");
    const wider = currentParts.length >= 4 ? parts.slice(0, -2).join(" > ") : "";
    if (parent !== immediatePrefix && (!widerPrefix || wider !== widerPrefix)) return;
    const titleSample = eligible.slice(0, 6).map((product) => product.title).join(" ");
    const score = commonPrefixLength(currentParts, parts) * 100 + overlapScore(current.title, titleSample) * 55 + Math.min(eligible.length, 20) / 20;
    choices.push({ key, products: eligible, score });
  });
  return choices.sort((left, right) => right.score - left.score || left.key.localeCompare(right.key));
}

function sectionPayload({ listId, listName, eyebrow, strategy, entries }) {
  return {
    listId,
    listName: usableText(listName).slice(0, 100),
    eyebrow,
    strategy,
    recommendations: entries.map(publicRecommendation)
  };
}

function recommendSections(catalog, productId, excluded = new Set(), limit = MAX_RESULTS) {
  const index = buildCatalogIndex(catalog);
  const current = index.byId.get(cleanProductId(productId));
  if (!current || !categoryKey(current.category)) return [];
  const boundedLimit = Math.min(MAX_RESULTS, Math.max(1, Number(limit) || MAX_RESULTS));
  const usedProducts = new Set(excluded);
  usedProducts.add(String(current.productId));
  const usedCategories = new Set([categoryKey(current.category)]);
  const sections = [];

  const comparisons = comparisonEntries(index, current, usedProducts, boundedLimit);
  if (comparisons.length >= MIN_RESULTS) {
    sections.push(sectionPayload({ listId: COMPARE_LIST_ID, listName: "Compare similar products", eyebrow: "More choices", strategy: "same_or_sibling_category", entries: comparisons }));
    comparisons.forEach((entry) => {
      usedProducts.add(String(entry.product.productId));
      usedCategories.add(categoryKey(entry.product.category));
    });
  }

  const rule = affinityRule(current);
  if (rule) {
    rule.groups.forEach((group) => {
      if (sections.length >= MAX_SECTIONS) return;
      const entries = recommendationsForAffinityGroup(index, current, group, usedProducts, boundedLimit);
      if (entries.length < MIN_RESULTS) return;
      const slot = sections.filter((section) => section.eyebrow === "You may also like").length + 1;
      sections.push(sectionPayload({ listId: `pdp_you_may_also_like_${slot}_v2`, listName: group.name, eyebrow: "You may also like", strategy: `curated_${rule.id}_${group.id}`, entries }));
      entries.forEach((entry) => {
        usedProducts.add(String(entry.product.productId));
        usedCategories.add(categoryKey(entry.product.category));
      });
    });
  }

  const fallbacks = fallbackCategoryKeys(index, current, usedCategories, usedProducts);
  for (const fallback of fallbacks) {
    if (sections.length >= MAX_SECTIONS) break;
    const entries = diversify(rankCandidates(current, fallback.products, false, usedProducts), boundedLimit);
    if (entries.length < MIN_RESULTS) continue;
    const slot = sections.filter((section) => section.eyebrow === "You may also like").length + 1;
    sections.push(sectionPayload({ listId: `pdp_you_may_also_like_${slot}_v2`, listName: categoryLabel(entries[0].product.category) || "More project ideas", eyebrow: "You may also like", strategy: "adjacent_catalog_category", entries }));
    entries.forEach((entry) => usedProducts.add(String(entry.product.productId)));
    usedCategories.add(fallback.key);
  }
  return sections;
}

function recommendProducts(catalog, productId, excluded = new Set(), limit = MAX_RESULTS) {
  const comparison = recommendSections(catalog, productId, excluded, limit).find((section) => section.listId === COMPARE_LIST_ID);
  return comparison ? comparison.recommendations : [];
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
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "GET") return sendJson(res, 405, { error: "Only GET is allowed." });
  let productId;
  try { productId = cleanProductId(req.query?.pid); }
  catch (error) { return sendJson(res, 400, { error: error.message }); }
  try {
    const catalog = await getAiCatalogProducts();
    if (!catalog.fresh || !catalog.products.length) return sendJson(res, 503, { success: false, sections: [], recommendations: [] });
    const sections = recommendSections(catalog, productId, excludedProductIds(req.query?.exclude), MAX_RESULTS);
    const comparison = sections.find((section) => section.listId === COMPARE_LIST_ID);
    return sendJson(res, 200, {
      success: true,
      productId,
      listId: comparison?.listId || COMPARE_LIST_ID,
      listName: comparison?.listName || "Compare similar products",
      algorithm: ALGORITHM_VERSION,
      currentCategory: usableText(catalogIndexCache.byId.get(productId)?.category).slice(0, 260),
      sections,
      // Kept while older cached storefront code expires.
      recommendations: comparison?.recommendations || []
    }, "public, s-maxage=900, stale-while-revalidate=3600");
  } catch (error) {
    console.error("Product recommendations failed:", error instanceof Error ? error.message : error);
    return sendJson(res, 500, { success: false, sections: [], recommendations: [] });
  }
}

module.exports = handler;
module.exports._test = {
  AFFINITY_RULES,
  ALGORITHM_VERSION,
  COMPARE_LIST_ID,
  affinityRule,
  buildCatalogIndex,
  categoryKey,
  categoryParts,
  cleanProductId,
  excludedProductIds,
  overlapScore,
  parentCategoryKey,
  recommendProducts,
  recommendSections,
  setCorsHeaders
};
