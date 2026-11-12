'use strict';
const rules = require('../SubstitutionRules');
const approved = require('../data/approved-substitutions.json');
const families = require('../data/substitution-families.json');
const blocked = new Set(require('../blocked-products.json').blockedProductIds.map(String));
const { getAiCatalogProducts } = require('./ai-product-catalog');
const history = require('./substitution-history');
const STORES = require('../PickupAvailability').stores;
const ORIGIN = 'https://webtrack.woodsonlumber.com';
const buckets = new Map();
function limited(req) {
  const key = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  const bucket = buckets.get(key) || { count: 0, until: now + 60000 };
  bucket.count++; buckets.set(key, bucket);
  return bucket.count > 30 || buckets.size > 10000;
}
function send(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}
function createHandler(deps = {}) {
  return async function handler(req, res) {
    const origin = String(req.headers.origin || '');
    if (origin === ORIGIN || (process.env.NODE_ENV === 'test' && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    } else if (origin || req.method !== 'GET') return send(res, 403, { success: false });
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { success: false });
    if (limited(req)) return send(res, 429, { success: false });
    try {
      const catalog = await (deps.catalog || getAiCatalogProducts)();
      if (!catalog.fresh || !catalog.products.length) return send(res, 503, { success: false, suggestions: [] });
      if (req.method === 'GET') {
        const pid = rules.id(req.query?.pid);
        if (!pid) return send(res, 400, { success: false });
        const source = catalog.products.find(p => p.productId === pid);
        if (!source) return send(res, 200, { success: true, source: null, suggestions: [] });
        const counts = await history.counts(pid).catch(() => ({}));
        const matches = blocked.has(pid) ? [] : rules.candidates(catalog.products.filter(p => !blocked.has(p.productId)), pid, approved, counts, deps.families || families);
        const suggestions = await Promise.all(matches.map(async row => ({
          productId: row.product.productId, title: row.product.title, category: row.product.category, brand: row.product.brand,
          productCode: row.product.productCode, reason: row.match.reason, differences: row.match.differences,
          kind: row.match.kind, rule: row.match.rule,
          receipt: await history.offer(pid, row.product.productId, row.match.rule).catch(() => null)
        })));
        return send(res, 200, { success: true, version: rules.version, source: { productId: pid, title: source.title, category: source.category, brand: source.brand }, suggestions });
      }
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, { success: false });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 1500) return send(res, 413, { success: false });
      let body;
      try { body = JSON.parse(raw); } catch (_) { return send(res, 400, { success: false }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { success: false });
      if (!['whole', 'shortage'].includes(body.scope) || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 9999 || !STORES.includes(body.store)) return send(res, 400, { success: false });
      const offer = await history.readOffer(body.receipt);
      if (!offer) return send(res, 200, { success: true, recorded: false });
      const from = catalog.products.find(p => p.productId === offer.from), to = catalog.products.find(p => p.productId === offer.to);
      const match = rules.eligibility(from, to, approved, deps.families || families);
      if (blocked.has(offer.from) || blocked.has(offer.to) || !match || match.rule !== offer.rule) return send(res, 409, { success: false, recorded: false });
      const recorded = await history.accept(body.receipt, { scope: body.scope, quantity: body.quantity, store: body.store });
      return send(res, 200, { success: true, recorded });
    } catch (_) { return send(res, 503, { success: false, suggestions: [] }); }
  };
}
module.exports = createHandler();
module.exports._test = { createHandler, reset: () => buckets.clear() };
