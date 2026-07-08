(function () {
  "use strict";

  var ACCEPTED_ORIGINS = {
    meta_shops: true,
    metashops: true,
    meta: true,
    facebook: true,
    fb: true,
    instagram: true,
    ig: true,
    whatsapp: true
  };
  var BUILD_KEY = "wlMetaCartBuildV2";
  var LEGACY_BUILD_KEY = "metaCartBuilt";
  var CART_URL = "/ShoppingCart.aspx";

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function normalizeToken(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function isAcceptedOrigin(params) {
    var origin = normalizeToken(params.get("cart_origin") || params.get("utm_source") || params.get("source"));
    return !!ACCEPTED_ORIGINS[origin];
  }

  function parsePositiveInteger(value, fallback) {
    var parsed = parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, 999);
  }

  function pushProduct(products, id, qty) {
    var cleanId = String(id || "").trim().replace(/[^\d]/g, "");
    if (!cleanId) return;
    var quantity = parsePositiveInteger(qty, 1);
    var existing = products.find(function (item) { return item.productId === cleanId; });
    if (existing) {
      existing.quantity += quantity;
    } else {
      products.push({ productId: cleanId, quantity: quantity });
    }
  }

  function parseJsonProducts(raw, products) {
    try {
      var decoded = decodeURIComponent(raw);
      var parsed = JSON.parse(decoded);
      var items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
      items.forEach(function (item) {
        if (!item) return;
        pushProduct(
          products,
          item.productId || item.product_id || item.pid || item.id || item.retailer_id || item.content_id,
          item.quantity || item.qty || 1
        );
      });
    } catch (error) {}
  }

  function parseProductList(raw, products) {
    if (!raw) return;
    var value = String(raw).trim();
    if (!value) return;

    if (/^\s*[\[{]/.test(value)) {
      parseJsonProducts(value, products);
      if (products.length) return;
    }

    value.split(/[,\n;|]+/).forEach(function (entry) {
      var part = decodeURIComponent(String(entry || "")).trim();
      if (!part) return;
      var match = part.match(/(\d+)\s*(?:[:x*@-]\s*(\d+))?/i);
      if (match) pushProduct(products, match[1], match[2] || 1);
    });
  }

  function getRequestedProducts(params) {
    var products = [];
    ["products", "items", "product_ids", "productIds", "pids", "ids", "content_ids"].forEach(function (key) {
      params.getAll(key).forEach(function (value) { parseProductList(value, products); });
    });

    var singleId = params.get("product_id") || params.get("productId") || params.get("pid") || params.get("id") || params.get("content_id");
    if (singleId) pushProduct(products, singleId, params.get("quantity") || params.get("qty") || 1);

    return products.filter(function (item) { return item.productId && item.quantity > 0; });
  }

  function buildSignature(products) {
    return products
      .map(function (item) { return item.productId + ":" + item.quantity; })
      .sort()
      .join(",");
  }

  function getFormData(doc) {
    var form = doc.querySelector("form");
    if (!form) throw new Error("WebTrack product form was not found.");

    var data = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (element) {
      if (!element.name || element.disabled) return;
      var type = String(element.type || "").toLowerCase();
      if (["button", "submit", "image", "reset", "file"].indexOf(type) !== -1) return;
      if ((type === "checkbox" || type === "radio") && !element.checked) return;
      data.append(element.name, element.value || "");
    });

    return { form: form, data: data };
  }

  function extractPostbackTarget(href) {
    var match = String(href || "").match(/__doPostBack\(['"]([^'"]+)['"]/i);
    return match && match[1] ? match[1] : "";
  }

  function findAddToCartTarget(doc) {
    var blocked = /saved|later|quicklist|wish|favorite/i;
    var selectors = [
      'a[href^="javascript:__doPostBack"][id*="AddProductButton"]',
      'a[href^="javascript:__doPostBack"][id*="AddToCart"]',
      'a[href^="javascript:__doPostBack"][id*="AddCart"]',
      'button[id*="AddProductButton"]',
      'button[id*="AddToCart"]',
      'input[id*="AddProductButton"]',
      'input[id*="AddToCart"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var controls = Array.prototype.slice.call(doc.querySelectorAll(selectors[i]));
      for (var j = 0; j < controls.length; j++) {
        var control = controls[j];
        var combined = [
          control.id || "",
          control.name || "",
          control.textContent || "",
          control.value || "",
          control.getAttribute("href") || ""
        ].join(" ");
        if (blocked.test(combined)) continue;

        return extractPostbackTarget(control.getAttribute("href")) ||
          control.name ||
          String(control.id || "").replace(/_/g, "$");
      }
    }

    return "ctl00$PageBody$productDetail$ctl00$AddProductButton";
  }

  function setQuantity(data, doc, productId, quantity) {
    var value = String(Math.max(1, parseInt(quantity, 10) || 1));
    var selectors = [
      'input[name="ctl00$PageBody$productDetail$ctl00$qty_' + productId + '"]',
      'input[id="ctl00_PageBody_productDetail_ctl00_qty_' + productId + '"]',
      'input[name*="qty_' + productId + '"]',
      'input[id*="qty_' + productId + '"]',
      'input[name*="Quantity"]',
      'input[name*="Qty"]',
      'input[name*="qty"]'
    ];
    var field = null;
    for (var i = 0; i < selectors.length && !field; i++) {
      field = doc.querySelector(selectors[i]);
    }
    if (field && field.name) {
      data.set(field.name, value);
    } else {
      data.set("ctl00$PageBody$productDetail$ctl00$qty_" + productId, value);
    }
  }

  async function fetchDocument(url, options) {
    var response = await fetch(url, Object.assign({ credentials: "include", cache: "no-store" }, options || {}));
    if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
    var html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  async function addProductToCart(product) {
    var pdpUrl = "/ProductDetail.aspx?pid=" + encodeURIComponent(product.productId);
    var doc = await fetchDocument(pdpUrl);
    var formBits = getFormData(doc);
    var data = formBits.data;

    data.set("__EVENTTARGET", findAddToCartTarget(doc));
    data.set("__EVENTARGUMENT", "");
    setQuantity(data, doc, product.productId, product.quantity);

    var action = formBits.form.getAttribute("action") || pdpUrl;
    var postUrl = new URL(action, window.location.origin).toString();
    var response = await fetch(postUrl, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: data.toString()
    });
    if (!response.ok) throw new Error("Add to cart failed for product " + product.productId + ".");
  }

  function readCartState(doc) {
    var html = doc.documentElement ? doc.documentElement.innerHTML || "" : "";
    var text = doc.body ? doc.body.textContent || "" : "";
    var rows = Array.prototype.slice.call(doc.querySelectorAll(".shopping-cart-item, .cart-item-card"));
    var pidMap = {};
    var pidMatch;
    var pidRegex = /pid\s*=\s*(\d+)\b|pid%3D(\d+)\b/ig;
    while ((pidMatch = pidRegex.exec(html))) {
      pidMap[pidMatch[1] || pidMatch[2]] = true;
    }
    return { count: rows.length, html: html, text: text, pids: pidMap };
  }

  async function getCartState(label) {
    var doc = await fetchDocument(CART_URL + "?wlMeta" + label + "=" + Date.now());
    return readCartState(doc);
  }

  async function verifyCart(products, beforeState) {
    var doc = await fetchDocument(CART_URL + "?wlMetaVerify=" + Date.now());
    var afterState = readCartState(doc);

    var allProductsVisible = products.every(function (product) {
      return !!afterState.pids[product.productId] || afterState.text.indexOf(product.productId) !== -1;
    });
    if (allProductsVisible) return true;

    if (!beforeState) return afterState.count > 0;
    var requestedAlreadyPresent = products.every(function (product) {
      return !!beforeState.pids[product.productId] || beforeState.text.indexOf(product.productId) !== -1;
    });
    if (requestedAlreadyPresent && afterState.count >= beforeState.count) return true;

    return afterState.count > beforeState.count;
  }

  function updateMetaCartModal(message, isError) {
    var modal = document.getElementById("metaCartModal");
    if (!modal) return;
    var status = modal.querySelector("[data-meta-cart-status]");
    if (status) {
      status.textContent = message;
      status.style.color = isError ? "#6b0016" : "#333";
    }
  }

  function showMetaCartModal() {
    if (document.getElementById("metaCartModal")) return;
    var modal = document.createElement("div");
    modal.id = "metaCartModal";
    modal.innerHTML = [
      '<div style="background:white;border-radius:8px;padding:2rem;max-width:500px;width:90%;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:Arial,sans-serif;">',
      '  <h2 style="color:#6b0016;margin-bottom:1rem;">Building Your Cart</h2>',
      '  <p data-meta-cart-status style="font-size:1rem;color:#333;">We are adding your selected items into your cart.</p>',
      '  <p style="font-size:.9rem;color:#666;margin-top:1rem;">Please give us just a few moments.</p>',
      '  <div style="margin-top:1.5rem;">',
      '    <div class="loader" style="margin:0 auto;width:36px;height:36px;border:4px solid #eee;border-top:4px solid #6b0016;border-radius:50%;animation:metaCartSpin 1s linear infinite;"></div>',
      '  </div>',
      '</div>'
    ].join("");
    modal.style.position = "fixed";
    modal.style.top = 0;
    modal.style.left = 0;
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.backgroundColor = "rgba(255,255,255,0.92)";
    modal.style.zIndex = "2147483000";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";

    if (!document.getElementById("metaCartStyles")) {
      var style = document.createElement("style");
      style.id = "metaCartStyles";
      style.textContent = "@keyframes metaCartSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}";
      document.head.appendChild(style);
    }
    document.body.appendChild(modal);
  }

  function removeMetaCartModal() {
    var modal = document.getElementById("metaCartModal");
    if (modal) modal.remove();
  }

  async function runMetaCartBuild() {
    var params = new URLSearchParams(window.location.search);
    if (!isAcceptedOrigin(params)) return;

    var products = getRequestedProducts(params);
    if (!products.length) return;

    var signature = buildSignature(products);
    if (sessionStorage.getItem(BUILD_KEY) === signature) {
      window.location.href = CART_URL;
      return;
    }

    showMetaCartModal();
    try {
      sessionStorage.removeItem(LEGACY_BUILD_KEY);
      updateMetaCartModal("Adding " + products.length + " selected item" + (products.length === 1 ? "" : "s") + "...");
      var beforeState = await getCartState("Before");

      for (var i = 0; i < products.length; i++) {
        updateMetaCartModal("Adding item " + (i + 1) + " of " + products.length + "...");
        await addProductToCart(products[i]);
      }

      updateMetaCartModal("Checking your cart...");
      var verified = await verifyCart(products, beforeState);
      if (!verified) throw new Error("WebTrack did not confirm the selected item in the cart.");

      sessionStorage.setItem(BUILD_KEY, signature);
      removeMetaCartModal();
      window.location.href = CART_URL + "?meta_cart=ready";
    } catch (error) {
      console.error("[MetaShops] Cart build failed", error);
      sessionStorage.removeItem(BUILD_KEY);
      sessionStorage.removeItem(LEGACY_BUILD_KEY);
      updateMetaCartModal("We could not build the cart automatically. Opening the cart so you can continue.", true);
      setTimeout(function () {
        window.location.href = CART_URL + "?meta_cart=error";
      }, 2200);
    }
  }

  onReady(function () {
    runMetaCartBuild();
  });
})();
