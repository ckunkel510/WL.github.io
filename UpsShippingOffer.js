(function () {
  "use strict";

  var BUILD_VERSION = "20260721-margin-offer-1";
  var RATE_URL = "https://wl-upsrates.vercel.app/api/ups-rates";
  var PRODUCT_DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSg6EOqMwc_5UjWU7ycyvF-rgj717p-WjV2Vhydcb7uc2Mf2Awj6GehQp66AHwViq4uX6mXXrtZZR-1/pub?output=csv";
  var STORAGE_KEY = "wl_shipping_offer_v1";
  var CART_DATA_KEY = "wl_shipping_offer_cart_v1";
  var EVENT_NAME = "wl:shipping-offer-change";
  var PRODUCT_DATA_CACHE = null;
  var refreshTimer = null;
  var activeRequest = null;

  if (!/ShoppingCart\.aspx|Checkout|PlaceOrder/i.test(window.location.pathname || "")) return;
  if (window.WLShippingOffer && window.WLShippingOffer.version === BUILD_VERSION) return;

  var STORE_ORIGINS = {
    brenham: { name: "Brenham", city: "Brenham", state: "TX", postalCode: "77833" },
    bryan: { name: "Bryan", city: "Bryan", state: "TX", postalCode: "77803" },
    caldwell: { name: "Caldwell", city: "Caldwell", state: "TX", postalCode: "77836" },
    lexington: { name: "Lexington", city: "Lexington", state: "TX", postalCode: "78947" },
    buffalo: { name: "Buffalo", city: "Buffalo", state: "TX", postalCode: "75831" },
    mexia: { name: "Mexia", city: "Mexia", state: "TX", postalCode: "76667" },
    groesbeck: { name: "Groesbeck", city: "Groesbeck", state: "TX", postalCode: "76642" }
  };

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeCode(value) {
    return text(value).replace(/\s+/g, "").toUpperCase();
  }

  function number(value) {
    var parsed = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseCsv(source) {
    var rows = [];
    var row = [];
    var cell = "";
    var quoted = false;
    var input = String(source || "");
    for (var index = 0; index < input.length; index += 1) {
      var ch = input[index];
      var next = input[index + 1];
      if (ch === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && next === "\n") index += 1;
        row.push(cell);
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
    row.push(cell);
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function productData() {
    if (PRODUCT_DATA_CACHE) return PRODUCT_DATA_CACHE;
    PRODUCT_DATA_CACHE = fetch(PRODUCT_DATA_URL, { cache: "no-store" })
      .then(function (response) { return response.ok ? response.text() : ""; })
      .then(function (source) {
        var rows = parseCsv(source);
        var headers = rows.shift() || [];
        return rows.map(function (values) {
          var record = {};
          headers.forEach(function (header, index) { record[text(header)] = values[index] || ""; });
          return record;
        });
      })
      .catch(function () { return []; });
    return PRODUCT_DATA_CACHE;
  }

  function cartRows() {
    return Array.prototype.slice.call(document.querySelectorAll(".shopping-cart-details .shopping-cart-item, .shopping-cart-item"))
      .filter(function (row) { return productId(row) || productCode(row); });
  }

  function productId(row) {
    var link = Array.prototype.find.call(row.querySelectorAll('a[href*="ProductDetail.aspx"]'), function (candidate) {
      return /[?&]pid=\d+/i.test(candidate.getAttribute("href") || "");
    });
    var match = (link ? link.getAttribute("href") : "").match(/[?&]pid=(\d+)/i);
    return match ? match[1] : "";
  }

  function productCode(row) {
    var link = row.querySelector(".portalGridLink, .cart-item-card h6 a, h6 a[href*='ProductDetail.aspx']") ||
      Array.prototype.find.call(row.querySelectorAll('a[href*="ProductDetail.aspx"]'), function (candidate) {
        return text(candidate.textContent);
      });
    return normalizeCode(link ? link.textContent : "");
  }

  function storedCartData() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(CART_DATA_KEY) || "null");
      return stored && Date.now() - Number(stored.ts || 0) < 4 * 60 * 60 * 1000 ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function rememberCart(items, origin) {
    if (!items.length) return;
    var previous = storedCartData() || {};
    try {
      sessionStorage.setItem(CART_DATA_KEY, JSON.stringify({
        items: items,
        origin: origin || previous.origin || null,
        ts: Date.now()
      }));
    } catch (error) {}
  }

  function cartItems() {
    var items = cartRows().map(function (row) {
      var input = row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])');
      var select = row.querySelector("select.wl-qty-select");
      var locked = row.querySelector(".wl-qty-locked");
      return {
        productId: productId(row),
        productCode: productCode(row),
        quantity: Math.max(1, Number(select && select.value || input && input.value || locked && locked.textContent || 1) || 1)
      };
    });
    if (items.length) return items;
    return storedCartData() && storedCartData().items || [];
  }

  function selectedOrigin() {
    var locationText = text(Array.prototype.filter.call(document.querySelectorAll("a[href]"), function (link) {
      return String(link.getAttribute("href") || "").toLowerCase().indexOf("storelocations") !== -1;
    }).map(function (link) { return link.textContent; }).join(" ")).toLowerCase();
    var key = Object.keys(STORE_ORIGINS).find(function (name) { return locationText.indexOf(name) !== -1; });
    var origin = key ? STORE_ORIGINS[key] : null;
    return origin || (storedCartData() && storedCartData().origin) || null;
  }

  function checkoutZip() {
    var selectors = [
      "#ctl00_PageBody_DeliveryAddress_Postcode",
      "#ctl00_PageBody_DeliveryAddress_ZipCodeTextBox",
      "#ctl00_PageBody_DeliveryAddress_PostalCode",
      "#ctl00_PageBody_DeliveryAddress_PostcodeTextBox",
      "#gc_del_zip"
    ];
    for (var index = 0; index < selectors.length; index += 1) {
      var element = document.querySelector(selectors[index]);
      var match = text(element && element.value).match(/\d{5}/);
      if (match) return match[0];
    }
    return "";
  }

  function savedZip() {
    try {
      var guest = JSON.parse(sessionStorage.getItem("wl_guest_checkout_payload") || "null");
      var guestZip = text(guest && (guest.zip || guest.postalCode || guest.postcode)).match(/\d{5}/);
      if (guestZip) return Promise.resolve(guestZip[0]);
    } catch (error) {}
    return fetch("/AccountInfo_R.aspx", { credentials: "same-origin", cache: "no-store" })
      .then(function (response) { return response.ok ? response.text() : ""; })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var content = text(Array.prototype.map.call(doc.querySelectorAll(".accountInfoAddress li"), function (item) {
          return item.textContent;
        }).join(" "));
        return (content.match(/\b\d{5}(?:-\d{4})?\b/) || [""])[0].slice(0, 5);
      })
      .catch(function () { return ""; });
  }

  function fallbackPackages(items, products) {
    var byId = {};
    var byCode = {};
    (products || []).forEach(function (product) {
      var id = text(product.ProductID || product.ProductId || product.productId || product.id);
      var code = normalizeCode(product.ProductCode || product.productCode || product.code);
      if (id) byId[id] = product;
      if (code) byCode[code] = product;
    });
    var totalWeight = 0;
    for (var index = 0; index < items.length; index += 1) {
      var item = items[index];
      var product = byId[item.productId] || byCode[normalizeCode(item.productCode)];
      var weight = number(product && product.Weight);
      if (!weight) return [];
      totalWeight += weight * item.quantity;
    }
    var packages = [];
    while (totalWeight > 0 && packages.length < 50) {
      var packageWeight = Math.min(50, totalWeight);
      packages.push({ weight: Number(packageWeight.toFixed(2)) });
      totalWeight = Number((totalWeight - packageWeight).toFixed(2));
    }
    return totalWeight > 0 ? [] : packages;
  }

  function writeOffer(result, zip, items) {
    var payload = {
      zip: zip,
      cartSignature: items.map(function (item) {
        return [item.productId, item.productCode, item.quantity].join(":");
      }).sort().join("|"),
      shippingOffer: result && result.shippingOffer || null,
      packagePlan: result && result.packagePlan || null,
      ts: Date.now()
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (error) {}
    try { document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload })); } catch (error) {}
    return payload;
  }

  async function refreshOffer() {
    if (activeRequest) return activeRequest;
    activeRequest = (async function () {
      var items = cartItems();
      var origin = selectedOrigin();
      rememberCart(items, origin);
      var zip = checkoutZip() || await savedZip();
      if (!items.length || !origin || !zip) return null;
      var products = await productData();
      var packages = fallbackPackages(items, products);
      var requestBody = {
        shipFrom: origin,
        shipTo: { postalCode: zip, country: "US", residential: true },
        cart: items
      };
      if (packages.length) requestBody.packages = packages;
      var response = await fetch(RATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || "UPS shipping offer could not be prepared.");
      return writeOffer(result, zip, items);
    })().catch(function (error) {
      console.warn("[WLShippingOffer] Automatic Ground offer could not be prepared.", error);
      return null;
    }).finally(function () { activeRequest = null; });
    return activeRequest;
  }

  function scheduleRefresh(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshOffer, Number(delay) || 350);
  }

  function currentOffer() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      return stored && Date.now() - Number(stored.ts || 0) < 15 * 60 * 1000 ? stored : null;
    } catch (error) {
      return null;
    }
  }

  window.WLShippingOffer = {
    version: BUILD_VERSION,
    refresh: refreshOffer,
    current: currentOffer
  };

  document.addEventListener("input", function (event) {
    if (event.target && /(?:Postcode|PostalCode|ZipCode|gc_del_zip)/i.test(event.target.id || "")) scheduleRefresh(450);
  }, true);
  document.addEventListener("change", function (event) {
    if (event.target && /(?:Postcode|PostalCode|ZipCode|gc_del_zip|wl-qty-select)/i.test(event.target.id || event.target.className || "")) scheduleRefresh(100);
  }, true);

  function boot() {
    scheduleRefresh(150);
    setTimeout(refreshOffer, 1200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  try {
    var manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager && !manager.__wlShippingOfferHooked) {
      manager.__wlShippingOfferHooked = true;
      manager.add_endRequest(function () { scheduleRefresh(150); });
    }
  } catch (error) {}
})();
