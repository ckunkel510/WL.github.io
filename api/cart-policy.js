"use strict";

const { getCatalogProducts } = require("./shipping-catalog");

const DEFAULT_ORIGINS = [
  "https://webtrack.woodsonlumber.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const STOCK_URL = "https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=";
const LIVE_STOCK_CACHE_MS = 3 * 60 * 1000;
const MAX_CLEARANCE_STOCK_LOOKUPS = 12;
const stockCache = new Map();

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseCompanyInventory(html) {
  const source = String(html || "");
  const matches = [...source.matchAll(/<td\b[^>]*data-title=["']Available["'][^>]*>([\s\S]*?)<\/td>/gi)];
  if (!matches.length) throw new Error("WebTrack returned no branch inventory rows.");
  return matches.reduce((total, match) => {
    const value = Number.parseInt(decodeHtml(match[1]).replace(/,/g, ""), 10);
    if (!Number.isFinite(value)) throw new Error("WebTrack returned an invalid branch quantity.");
    return total + Math.max(0, value);
  }, 0);
}

async function fetchLiveCompanyInventory(productId, dependencies = {}) {
  const id = String(productId || "").trim();
  if (!/^\d{1,12}$/.test(id)) throw new Error("A WebTrack product ID is required for live inventory.");
  const now = Date.now();
  const cached = stockCache.get(id);
  if (cached && cached.expiresAt > now) return cached.quantity;

  const fetchFn = dependencies.fetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetchFn(`${STOCK_URL}${encodeURIComponent(id)}`, {
      headers: { Accept: "text/html", "User-Agent": "WoodsonLumber-Checkout/1.0" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`WebTrack inventory returned HTTP ${response.status}.`);
    const quantity = parseCompanyInventory(await response.text());
    stockCache.set(id, { quantity, expiresAt: now + LIVE_STOCK_CACHE_MS });
    return quantity;
  } finally {
    clearTimeout(timer);
  }
}

function allowedOrigins() {
  const configured = String(process.env.UPS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (!origin) return process.env.VERCEL_ENV !== "production" || process.env.UPS_ALLOW_NO_ORIGIN === "true";
  if (!allowedOrigins().has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const cart = Array.isArray(body.cart) ? body.cart.slice(0, 50) : [];
    const catalog = await getCatalogProducts(cart);
    if (!catalog.fresh) {
      return sendJson(res, 200, { enforceClearance: false, catalogFresh: false, items: [] });
    }
    const clearanceCount = catalog.products.filter((product) => product?.isClearance === true).length;
    const tooManyClearanceLines = clearanceCount > MAX_CLEARANCE_STOCK_LOOKUPS;
    const items = [];
    for (let index = 0; index < catalog.products.length; index += 1) {
      const product = catalog.products[index];
      const requested = cart[index] || {};
      const item = {
        productId: String(product?.productId || requested.productId || requested.id || ""),
        productCode: String(product?.productCode || requested.productCode || requested.code || ""),
        isClearance: product?.isClearance === true,
        maxQuantity: null,
        inventoryVerified: product?.isClearance !== true
      };
      if (item.isClearance) {
        if (!tooManyClearanceLines) {
          try {
            item.maxQuantity = await fetchLiveCompanyInventory(item.productId);
            item.inventoryVerified = true;
          } catch {
            item.maxQuantity = 0;
            item.inventoryVerified = false;
          }
        } else {
          item.maxQuantity = 0;
          item.inventoryVerified = false;
        }
      }
      if (item.productId || item.productCode) items.push(item);
    }
    return sendJson(res, 200, {
      enforceClearance: true,
      catalogFresh: true,
      inventoryVerified: items.every((item) => item.inventoryVerified !== false),
      items
    });
  } catch {
    return sendJson(res, 200, { enforceClearance: false, catalogFresh: false, items: [] });
  }
}

module.exports = handler;
module.exports._test = { decodeHtml, fetchLiveCompanyInventory, parseCompanyInventory };
