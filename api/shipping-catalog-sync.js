"use strict";

const crypto = require("node:crypto");
const {
  activateCatalogSnapshot,
  beginCatalogSnapshot,
  writeCatalogChunk
} = require("./shipping-catalog");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function authorized(req) {
  const configured = process.env.SHIPPING_CATALOG_SYNC_TOKEN || "";
  const authorization = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const headerToken = String(req.headers["x-shipping-catalog-token"] || "");
  return safeEqual(authorization || headerToken, configured);
}

async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  if (!authorized(req)) return sendJson(res, 401, { error: "Catalog sync authentication failed." });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    let result;
    if (body.action === "begin") {
      result = await beginCatalogSnapshot({
        id: body.snapshotId,
        expectedProducts: body.expectedProducts,
        createdAt: body.createdAt
      });
    } else if (body.action === "chunk") {
      result = await writeCatalogChunk({ id: body.snapshotId, products: body.products });
    } else if (body.action === "activate") {
      result = await activateCatalogSnapshot(body.snapshotId);
    } else {
      return sendJson(res, 400, { error: "Catalog sync action was not recognized." });
    }
    return sendJson(res, 200, { ok: true, result });
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : "Catalog sync failed." });
  }
}

module.exports = handler;
module.exports._test = { authorized, safeEqual };
