"use strict";

const crypto = require("node:crypto");
const { normalizeCutApprovalCart } = require("./cut-to-ship");

let Redis = null;
try {
  ({ Redis } = require("@upstash/redis"));
} catch {}

const APPROVAL_TTL_SECONDS = 365 * 24 * 60 * 60;
const memoryApprovals = new Map();
let redisClient = null;

function cleanText(value, maxLength = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeUserId(value) {
  const supplied = cleanText(value, 120);
  return supplied || "guest";
}

function approvalKey(approvalId) {
  const id = cleanText(approvalId, 80).toUpperCase();
  return /^CTA-[A-Z0-9-]{12,70}$/.test(id) ? `wl:customization-approval:${id}` : "";
}

function selectionKey(selections) {
  return (Array.isArray(selections) ? selections : []).map((selection) => [
    cleanText(selection?.productId, 40),
    cleanText(selection?.productCode, 80).toUpperCase(),
    Math.max(1, Math.trunc(Number(selection?.originalQuantity) || 1)),
    cleanText(selection?.optionId, 80),
    Array.isArray(selection?.cutLengthsIn) ? selection.cutLengthsIn.join(",") : ""
  ].join(":" )).sort().join("|");
}

function getRedis() {
  if (!Redis) return null;
  if (redisClient) return redisClient;
  const hasUpstashEnv = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasVercelKvEnv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasUpstashEnv && !hasVercelKvEnv) return null;
  redisClient = Redis.fromEnv();
  return redisClient;
}

function sweepMemory() {
  const now = Date.now();
  for (const [key, value] of memoryApprovals.entries()) {
    if (!value || Date.parse(value.expiresAt) <= now) memoryApprovals.delete(key);
  }
}

async function storeCustomizationApproval(input) {
  const plan = normalizeCutApprovalCart(input?.cart);
  const now = new Date();
  const approvalId = `CTA-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(now.getTime() + (APPROVAL_TTL_SECONDS * 1000));
  const webTrackUserId = normalizeUserId(input?.webTrackUserId);
  const record = {
    approvalId,
    approvedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    webTrackUserId,
    identitySource: webTrackUserId === "guest" ? "guest-checkout" : "webtrack-account-page",
    source: "webtrack-checkout",
    policyVersion: plan.policyVersion,
    selectionKey: selectionKey(plan.selections),
    selections: plan.selections,
    addedCharge: plan.addedCharge,
    customerAffirmation: {
      acknowledgedNonRefundable: true,
      customizedMerchandiseIsSpecialOrder: true,
      merchandiseAndAddedFeesNonRefundable: true
    }
  };
  const key = approvalKey(approvalId);
  const redis = getRedis();
  if (redis) await redis.set(key, record, { ex: APPROVAL_TTL_SECONDS });
  else {
    sweepMemory();
    memoryApprovals.set(key, record);
  }
  return record;
}

async function findCustomizationApproval(approvalId) {
  const key = approvalKey(approvalId);
  if (!key) return null;
  const redis = getRedis();
  if (redis) return await redis.get(key);
  sweepMemory();
  return memoryApprovals.get(key) || null;
}

function resetMemoryApprovals() {
  memoryApprovals.clear();
}

module.exports = {
  APPROVAL_TTL_SECONDS,
  findCustomizationApproval,
  normalizeUserId,
  resetMemoryApprovals,
  selectionKey,
  storeCustomizationApproval
};
