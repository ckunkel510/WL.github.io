"use strict";

const SAFE_QUERY_KEYS = [
  "productid",
  "productId",
  "productcode",
  "productCode",
  "qty",
  "quantity"
];

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value, maxLength = 120) {
  return String(first(value) || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function queryFromRequest(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url || "/", "https://probe.local").searchParams.entries());
  } catch {
    return {};
  }
}

function requestContext(req) {
  const query = queryFromRequest(req);
  const safe = {};
  for (const key of SAFE_QUERY_KEYS) {
    const value = cleanText(query[key]);
    if (value) safe[key] = value;
  }

  const unknownKeys = Object.keys(query)
    .filter((key) => !SAFE_QUERY_KEYS.includes(key))
    .map((key) => cleanText(key, 60))
    .filter(Boolean)
    .slice(0, 20);

  return {
    method: cleanText(req.method || "GET", 12),
    productId: safe.productid || safe.productId || "Not forwarded yet",
    productCode: safe.productcode || safe.productCode || "Not forwarded yet",
    quantity: safe.qty || safe.quantity || "Not forwarded yet",
    receivedKeys: Object.keys(safe),
    unknownKeys
  };
}

function originOnly(value) {
  try {
    return new URL(cleanText(value, 500)).origin;
  } catch {
    return "";
  }
}

function requestTrace(req, context) {
  return {
    event: "special-order-probe-request",
    method: context.method,
    productId: context.productId,
    productCode: context.productCode,
    accept: cleanText(req.headers?.accept, 160),
    contentType: cleanText(req.headers?.["content-type"], 100),
    referrerOrigin: originOnly(req.headers?.referer || req.headers?.referrer),
    fetchDestination: cleanText(req.headers?.["sec-fetch-dest"], 40),
    fetchMode: cleanText(req.headers?.["sec-fetch-mode"], 40),
    fetchSite: cleanText(req.headers?.["sec-fetch-site"], 40)
  };
}

function renderPage(context) {
  const safeContext = JSON.stringify(context).replace(/</g, "\\u003c");
  const initialQuantity = Math.max(1, Math.min(99, parseInt(context.quantity, 10) || 1));
  const productId = context.productId === "Not forwarded yet" ? "" : context.productId;
  const productCode = context.productCode === "Not forwarded yet" ? "" : context.productCode;
  const defaultDescription = productCode === "WDoor" ? "Custom Woodson Door" : productCode;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Configure Special Order</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #171717; background: #f4f5f6; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { width: min(680px, 100%); margin: 0 auto; background: #fff; border: 1px solid #d7d9dc; border-radius: 8px; overflow: hidden; }
    header { padding: 20px 22px; border-bottom: 4px solid #6b0016; }
    h1 { margin: 0; font-size: 22px; line-height: 1.25; }
    .eyebrow { margin: 0 0 7px; color: #6b0016; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    section { padding: 18px 22px 22px; }
    p { margin: 0 0 18px; line-height: 1.5; }
    .product { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; padding: 12px 14px; background: #f4f5f6; border-radius: 6px; }
    .product strong, .product span { overflow-wrap: anywhere; }
    label { display: block; margin-bottom: 7px; font-weight: 700; }
    textarea, input { width: 100%; border: 1px solid #aeb3b8; border-radius: 5px; padding: 11px 12px; font: inherit; color: inherit; background: #fff; }
    textarea { min-height: 96px; resize: vertical; }
    input:focus, textarea:focus { outline: 3px solid rgba(107, 0, 22, .16); border-color: #6b0016; }
    .field { margin-bottom: 17px; }
    .quantity { width: 110px; }
    button { width: 100%; min-height: 46px; border: 0; border-radius: 5px; padding: 11px 18px; background: #6b0016; color: #fff; font: 700 16px Arial, sans-serif; cursor: pointer; }
    button:hover { background: #510011; }
    button:disabled { cursor: wait; opacity: .65; }
    .notice { margin-top: 18px; padding: 12px 14px; border-left: 4px solid #f3c400; background: #fff9da; line-height: 1.45; }
    .status { min-height: 20px; margin: 12px 0 0; color: #555; font-size: 14px; }
    @media (max-width: 520px) {
      body { padding: 12px; }
      header, section { padding-left: 16px; padding-right: 16px; }
      .product { display: block; }
      .product span { display: block; margin-top: 4px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Special order</p>
      <h1>Configure your item</h1>
    </header>
    <section>
      <div class="product"><strong>${escapeHtml(productCode || "Special product")}</strong><span>Product ${escapeHtml(productId || "not supplied")}</span></div>
      <p>This temporary configurator tests the handoff into WebTrack. Add enough detail to identify the requested item.</p>
      <form id="special-order-form">
        <div class="field">
          <label for="configuration-description">Configuration notes</label>
          <textarea id="configuration-description" maxlength="500" required>${escapeHtml(defaultDescription)}</textarea>
        </div>
        <div class="field quantity">
          <label for="configuration-quantity">Quantity</label>
          <input id="configuration-quantity" type="number" min="1" max="99" step="1" inputmode="numeric" value="${initialQuantity}" required>
        </div>
        <button id="add-configured-item" type="submit">Add configured item to cart</button>
        <p id="form-status" class="status" role="status" aria-live="polite"></p>
      </form>
      <div class="notice"><strong>Temporary test.</strong> Pricing and production details still need to be confirmed before an order is completed.</div>
    </section>
  </main>
  <script>
    (() => {
      const serverContext = ${safeContext};
      const allowedParentOrigin = "https://webtrack.woodsonlumber.com";
      const form = document.getElementById("special-order-form");
      const button = document.getElementById("add-configured-item");
      const status = document.getElementById("form-status");

      try {
        window.parent.postMessage({
          type: "woodson-special-order-ready",
          version: 1,
          productId: serverContext.productId,
          productCode: serverContext.productCode,
          quantity: serverContext.quantity
        }, allowedParentOrigin);
      } catch (_) {
        // Direct viewing remains available for diagnostics.
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const description = document.getElementById("configuration-description").value.trim();
        const quantity = Math.max(1, Math.min(99, parseInt(document.getElementById("configuration-quantity").value, 10) || 1));
        if (!description) {
          status.textContent = "Add configuration notes before continuing.";
          return;
        }
        if (window.self === window.top) {
          status.textContent = "Open this configurator from the WebTrack product page to add the item.";
          return;
        }
        button.disabled = true;
        status.textContent = "Sending this configuration to your cart...";
        window.parent.postMessage({
          type: "woodson-special-order-complete",
          version: 1,
          productId: serverContext.productId,
          productCode: serverContext.productCode,
          sID: serverContext.productId,
          sDescription: description,
          iQty: quantity
        }, allowedParentOrigin);
      });
    })();
  </script>
</body>
</html>`;
}

function setHeaders(req, res) {
  const origin = cleanText(req.headers?.origin, 200);
  if (origin === "https://webtrack.woodsonlumber.com") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors https://webtrack.woodsonlumber.com");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
}

function handler(req, res) {
  setHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    return res.end();
  }
  if (!["GET", "HEAD", "POST"].includes(req.method)) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
    return res.end("Method not allowed");
  }

  const context = requestContext(req);
  if (context.productId !== "Not forwarded yet" || context.productCode !== "Not forwarded yet") {
    console.info("[special-order-configurator]", JSON.stringify(requestTrace(req, context)));
  }
  const html = renderPage(context);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.method === "HEAD") return res.end();
  return res.end(html);
}

module.exports = handler;
module.exports._test = { cleanText, escapeHtml, renderPage, requestContext, requestTrace };
