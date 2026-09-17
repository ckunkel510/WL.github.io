"use strict";

const { CutToShipSelectionError } = require("./cut-to-ship");
const { storeCustomizationApproval } = require("./customization-approvals");

const DEFAULT_ORIGINS = [
  "https://webtrack.woodsonlumber.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const rateBuckets = new Map();

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
  if (allowedOrigins().has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  return allowedOrigins().has(origin);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function requestIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function enforceRateLimit(req) {
  const key = requestIp(req);
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60000 });
    return;
  }
  current.count += 1;
  if (current.count > 20) {
    const error = new Error("Too many approval requests. Please wait a moment and try again.");
    error.status = 429;
    throw error;
  }
}

async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    enforceRateLimit(req);
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const record = await storeCustomizationApproval({
      cart: body.cart,
      webTrackUserId: body.webTrackUserId
    });
    return sendJson(res, 200, {
      ok: true,
      approval: {
        approvalId: record.approvalId,
        approvedAt: record.approvedAt,
        expiresAt: record.expiresAt,
        webTrackUserId: record.webTrackUserId,
        policyVersion: record.policyVersion,
        selectionKey: record.selectionKey,
        selections: record.selections,
        addedCharge: record.addedCharge
      }
    });
  } catch (error) {
    const invalidCuts = error instanceof CutToShipSelectionError;
    const status = invalidCuts ? 400 : Number(error?.status) || 500;
    const message = invalidCuts
      ? error.shippingIssues?.[0]?.message || error.message
      : error instanceof Error ? error.message : "Customization approval could not be recorded.";
    return sendJson(res, status, {
      error: message,
      ...(invalidCuts ? { shippingIssues: error.shippingIssues } : {})
    });
  }
}

module.exports = handler;
