"use strict";

const productContent = require("./product-content");

const { contentsFromCsv, parseCsv } = productContent._test;

const DEFAULT_DESCRIPTION_FEED_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv";
const FEED_CACHE_SECONDS = 6 * 60 * 60;
const FEED_PARTS = 2;

function merchantProductIds(csvText) {
  const rows = parseCsv(csvText);
  const headers = rows.shift() || [];
  const idIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === "id");
  if (idIndex < 0) throw new Error("The Merchant primary feed is missing its id column.");

  return new Set(
    rows
      .map((row) => String(row[idIndex] || "").trim())
      .filter((productId) => /^\d{1,20}$/.test(productId))
  );
}

function cleanMerchantDescription(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 5000);
}

function csvField(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function feedPart(productId) {
  return Number(BigInt(productId) % BigInt(FEED_PARTS)) + 1;
}

function merchantDescriptionRows(descriptionCsv, merchantCsv, part) {
  const activeProductIds = merchantProductIds(merchantCsv);
  return contentsFromCsv(descriptionCsv, activeProductIds)
    .map((content) => ({
      id: content.productId,
      description: cleanMerchantDescription(content.description)
    }))
    .filter((content) => content.description && feedPart(content.id) === part);
}

function writeMerchantCsv(res, contents) {
  let buffer = "id,description\r\n";
  contents.forEach((content) => {
    buffer += `${csvField(content.id)},${csvField(content.description)}\r\n`;
    if (Buffer.byteLength(buffer, "utf8") >= 64 * 1024) {
      res.write(buffer);
      buffer = "";
    }
  });
  res.end(buffer);
}

async function fetchCsv(url, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/csv" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Feed source returned ${response.status}.`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function requestedPart(req) {
  const value = String(req.query?.part || "");
  if (!/^[12]$/.test(value)) {
    throw new Error(`A feed part from 1 to ${FEED_PARTS} is required.`);
  }
  return Number(value);
}

function merchantFeedUrl(env = process.env) {
  const value = String(env.MERCHANT_PRIMARY_FEED_URL || "").trim();
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(value)) {
    throw new Error("MERCHANT_PRIMARY_FEED_URL must be configured.");
  }
  return value;
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.setHeader("Cache-Control", "no-store");
    return res.end("Method not allowed.\n");
  }

  let part;
  try {
    part = requestedPart(req);
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(`${error.message}\n`);
  }

  try {
    const descriptionUrl =
      process.env.PRODUCT_DESCRIPTION_FULL_FEED_URL || DEFAULT_DESCRIPTION_FEED_URL;
    const merchantUrl = merchantFeedUrl();
    const [descriptionCsv, merchantCsv] = await Promise.all([
      fetchCsv(descriptionUrl),
      fetchCsv(merchantUrl)
    ]);
    const contents = merchantDescriptionRows(descriptionCsv, merchantCsv, part);

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${FEED_CACHE_SECONDS}, stale-while-revalidate=86400`
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="woodson-product-descriptions-${part}-of-${FEED_PARTS}.csv"`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-WL-Feed-Part", `${part}/${FEED_PARTS}`);
    res.setHeader("X-WL-Feed-Products", String(contents.length));
    return writeMerchantCsv(res, contents);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end("Product content feed is temporarily unavailable.\n");
  }
}

module.exports = handler;
module.exports._test = {
  cleanMerchantDescription,
  csvField,
  feedPart,
  merchantFeedUrl,
  merchantDescriptionRows,
  merchantProductIds,
  requestedPart,
  writeMerchantCsv
};
