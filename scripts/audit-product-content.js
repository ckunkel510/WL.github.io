"use strict";

const { parseCsv } = require("../api/product-content")._test;

const DEFAULT_SHEET_ID = "1LGW3XkZhUihvwjp2rxUG8UY9MvwZsorq40gxLjfCVE0";

function sheetCsvUrl(sheetId, sheetName, query) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.searchParams.set("sheet", sheetName);
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("tq", query);
  return url.toString();
}

function productIds(csvText) {
  const rows = parseCsv(csvText);
  rows.shift();
  return rows
    .map((row) => String(row[0] || "").trim())
    .filter((value) => /^\d{1,20}$/.test(value));
}

function merchantProductIds(csvText) {
  const rows = parseCsv(csvText);
  const headers = rows.shift() || [];
  const idIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === "id");
  if (idIndex < 0) throw new Error("The Merchant primary feed is missing its id column.");

  return rows
    .map((row) => String(row[idIndex] || "").trim())
    .filter((value) => /^\d{1,20}$/.test(value));
}

function summarize(sourceCsv, merchantCsv) {
  const sourceProductIds = productIds(sourceCsv);
  const merchantIds = merchantProductIds(merchantCsv);
  const sourceSet = new Set(sourceProductIds);
  const merchantSet = new Set(merchantIds);
  const missingContentIds = [...merchantSet].filter((productId) => !sourceSet.has(productId));
  const staleContentIds = [...sourceSet].filter((productId) => !merchantSet.has(productId));

  return {
    sourceRows: sourceProductIds.length,
    sourceProductCount: sourceSet.size,
    merchantRows: merchantIds.length,
    merchantProductCount: merchantSet.size,
    productsWithContent: [...merchantSet].filter((productId) => sourceSet.has(productId)).length,
    missingContentProductCount: missingContentIds.length,
    staleContentProductCount: staleContentIds.length,
    missingContentSample: missingContentIds.slice(0, 25),
    staleContentSample: staleContentIds.slice(0, 25)
  };
}

function merchantFeedUrl(env = process.env) {
  const value = String(env.MERCHANT_PRIMARY_FEED_URL || "").trim();
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(value)) {
    throw new Error("MERCHANT_PRIMARY_FEED_URL must be configured.");
  }
  return value;
}

async function fetchCsv(url, fetchImpl = global.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/csv" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const sheetId = process.env.PRODUCT_DESCRIPTION_SHEET_ID || DEFAULT_SHEET_ID;
  const primaryFeedUrl = merchantFeedUrl();
  const [sourceCsv, merchantCsv] = await Promise.all([
    fetchCsv(sheetCsvUrl(sheetId, "Sheet1", "select A where A is not null")),
    fetchCsv(primaryFeedUrl)
  ]);
  const result = summarize(sourceCsv, merchantCsv);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`Product content audit failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  merchantFeedUrl,
  merchantProductIds,
  productIds,
  sheetCsvUrl,
  summarize
};
