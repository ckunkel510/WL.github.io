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
  const rows = [
    ["Product ID", context.productId],
    ["Product code", context.productCode],
    ["Quantity", context.quantity],
    ["Request method", context.method],
    ["Recognized fields", context.receivedKeys.join(", ") || "None"],
    ["Other field names", context.unknownKeys.join(", ") || "None"]
  ].map(([label, value]) => `
          <div class="probe-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Woodson Special Order Connection Test</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #171717; background: #f4f5f6; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { width: min(680px, 100%); margin: 0 auto; background: #fff; border: 1px solid #d7d9dc; border-radius: 8px; overflow: hidden; }
    header { padding: 20px 22px; border-bottom: 4px solid #6b0016; }
    h1 { margin: 0; font-size: 22px; line-height: 1.25; }
    .status { display: flex; align-items: center; gap: 9px; margin-top: 10px; font-size: 15px; }
    .status-dot { width: 11px; height: 11px; border-radius: 50%; background: #27833b; flex: 0 0 auto; }
    section { padding: 18px 22px 22px; }
    p { margin: 0 0 16px; line-height: 1.5; }
    dl { margin: 0; border-top: 1px solid #e3e5e7; }
    .probe-row { display: grid; grid-template-columns: minmax(130px, 0.8fr) minmax(0, 1.6fr); gap: 16px; padding: 11px 0; border-bottom: 1px solid #e3e5e7; }
    dt { font-weight: 700; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .notice { margin-top: 18px; padding: 12px 14px; border-left: 4px solid #f3c400; background: #fff9da; line-height: 1.45; }
    @media (max-width: 520px) {
      body { padding: 12px; }
      header, section { padding-left: 16px; padding-right: 16px; }
      .probe-row { grid-template-columns: 1fr; gap: 4px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Special Order connection test</h1>
      <div class="status"><span class="status-dot" aria-hidden="true"></span><span id="frame-status">Endpoint loaded</span></div>
    </header>
    <section>
      <p>This diagnostic page confirms how WebTrack connects a product to an external designer.</p>
      <dl>${rows}
          <div class="probe-row">
            <dt>Embedded by WebTrack</dt>
            <dd id="embedded-value">Checking...</dd>
          </div>
          <div class="probe-row">
            <dt>Referring page</dt>
            <dd id="referrer-value">Checking...</dd>
          </div>
      </dl>
      <div class="notice"><strong>Diagnostic only.</strong> This page does not return a configured product or trigger an add-to-cart action.</div>
    </section>
  </main>
  <script>
    (() => {
      const serverContext = ${safeContext};
      const embedded = window.self !== window.top;
      document.getElementById("embedded-value").textContent = embedded ? "Yes" : "No";
      document.getElementById("referrer-value").textContent = document.referrer || "Not provided";
      document.getElementById("frame-status").textContent = embedded
        ? "Endpoint loaded inside WebTrack"
        : "Endpoint loaded directly";

      try {
        window.parent.postMessage({
          type: "woodson-special-order-probe-ready",
          version: 1,
          productId: serverContext.productId,
          productCode: serverContext.productCode,
          quantity: serverContext.quantity
        }, "https://webtrack.woodsonlumber.com");
      } catch (_) {
        // The page remains useful even when the parent does not listen for messages.
      }
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
    console.info("[special-order-probe]", JSON.stringify(requestTrace(req, context)));
  }
  const html = renderPage(context);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.method === "HEAD") return res.end();
  return res.end(html);
}

module.exports = handler;
module.exports._test = { cleanText, escapeHtml, renderPage, requestContext, requestTrace };
