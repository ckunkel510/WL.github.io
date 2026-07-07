(function () {
  "use strict";

  if (!/ShoppingCart\.aspx/i.test(window.location.pathname || "")) return;
  if (window.WLShippingPromo && window.WLShippingPromo.version === "20260707-bridge-2") return;

  var STORAGE_KEY = "wl_shipping_promo_v1";
  var EVENT_NAME = "wl:shipping-promo-change";
  var PROMO_CODE = "SUMMERCHILL26";
  var DISPLAY_CODE = "SummerChill26";
  var PRODUCT_DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSg6EOqMwc_5UjWU7ycyvF-rgj717p-WjV2Vhydcb7uc2Mf2Awj6GehQp66AHwViq4uX6mXXrtZZR-1/pub?output=csv";
  var PROMO_SESSION_URL = "https://wl-upsrates.vercel.app/api/rate?promoSession=1";
  var PRODUCT_DATA_CACHE = null;

  var ELIGIBLE_PRODUCTS = [
    ["282948", "TB-ORIG-G3-TAN"],
    ["282954", "TB-RANG-GRAY"],
    ["282951", "TB-ORIG-G3-GRAY"],
    ["282949", "TB-ORIG-G3-WHT"],
    ["282952", "TB-ORIG-G3-ORG"],
    ["282955", "TB-RANG-IVR"],
    ["287776", "TB-ORIG-G3-BURNTORANGE"],
    ["282953", "TB-RANG-TAN"],
    ["287775", "TB-ORIG-G3-MAROON"],
    ["290262", "TB-RANG-DELTA"],
    ["283538", "TB-GRAN-G1-TAN"],
    ["308684", "MGDYC84"],
    ["308690", "MGSSC801NB"],
    ["308682", "YHCP30YVC"],
    ["308679", "YHCP30CHBLK"],
    ["308685", "MGDYC85"],
    ["308691", "MGSSC80183"],
    ["308680", "YHCP30GVG"],
    ["308686", "MGDYC8YVC"],
    ["308689", "MGSSC801GE"],
    ["308683", "YHCP30GG"],
    ["308692", "MGSSC801YVC"],
    ["308681", "YHCP30XK7"]
  ];

  var EXCLUDED_PRODUCTS = [
    ["308779", "MYC4805"],
    ["308782", "MYC4803"],
    ["308777", "YHC6522"],
    ["308783", "YDP101"],
    ["308780", "MYC4801"],
    ["308778", "YHC6524"],
    ["308735", "YHC6523"],
    ["308781", "MYC4802"],
    ["308784", "MYC-DRAIN03"]
  ];

  var eligibleIds = {};
  var eligibleCodes = {};
  var excludedIds = {};
  var excludedCodes = {};

  ELIGIBLE_PRODUCTS.forEach(function (item) {
    eligibleIds[item[0]] = true;
    eligibleCodes[normalizeProductCode(item[1])] = true;
  });
  EXCLUDED_PRODUCTS.forEach(function (item) {
    excludedIds[item[0]] = true;
    excludedCodes[normalizeProductCode(item[1])] = true;
  });

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizePromo(value) {
    return text(value).replace(/[\s-]+/g, "").toUpperCase();
  }

  function normalizeProductCode(value) {
    return text(value).replace(/\s+/g, "").toUpperCase();
  }

  function productIdFromRow(row) {
    var href = "";
    Array.prototype.some.call(row.querySelectorAll("a[href*='ProductDetail.aspx']"), function (link) {
      href = link.getAttribute("href") || "";
      return /[?&]pid=\d+/i.test(href);
    });
    var match = href.match(/[?&]pid=(\d+)/i);
    return match ? match[1] : "";
  }

  function productCodeFromRow(row) {
    var codeNode = row.querySelector(".portalGridLink") ||
      row.querySelector(".cart-item-card h6 a") ||
      row.querySelector("h6 a[href*='ProductDetail.aspx']") ||
      row.querySelector("a[href*='ProductDetail.aspx']");
    return normalizeProductCode(codeNode ? codeNode.textContent : "");
  }

  function qtyFromRow(row) {
    var select = row.querySelector("select.wl-qty-select");
    var input = row.querySelector("input[id*='_qty_']:not([id$='_ClientState'])");
    var locked = row.querySelector(".wl-qty-locked");
    return Math.max(1, Number(select?.value || input?.value || locked?.textContent || 1) || 1);
  }

  function cartRows() {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".shopping-cart-details .shopping-cart-item"));
    return rows.filter(function (row) {
      return !!(productIdFromRow(row) || productCodeFromRow(row));
    });
  }

  function cartItems() {
    return cartRows().map(function (row) {
      return {
        productId: productIdFromRow(row),
        productCode: productCodeFromRow(row),
        quantity: qtyFromRow(row)
      };
    }).filter(function (item) {
      return item.productId || item.productCode;
    });
  }

  function isExcluded(item) {
    return (!!item.productId && excludedIds[item.productId]) || (!!item.productCode && excludedCodes[item.productCode]);
  }

  function isEligible(item) {
    if (isExcluded(item)) return false;
    return (!!item.productId && eligibleIds[item.productId]) || (!!item.productCode && eligibleCodes[item.productCode]);
  }

  function cartEligible(items) {
    return (items || cartItems()).some(isEligible);
  }

  function cartSignature(items) {
    return (items || cartItems()).map(function (item) {
      return [item.productId || "", item.productCode || "", item.quantity || 1].join(":");
    }).sort().join("|");
  }

  function moneyNumber(value) {
    var numeric = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function parseCsv(source) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    var textValue = String(source || "");
    for (var i = 0; i < textValue.length; i += 1) {
      var ch = textValue[i];
      var next = textValue[i + 1];
      if (ch === '"' && inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some(function (value) { return value !== ""; })) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
    row.push(cell);
    if (row.some(function (value) { return value !== ""; })) rows.push(row);
    return rows;
  }

  function getProductData() {
    if (PRODUCT_DATA_CACHE) return PRODUCT_DATA_CACHE;
    PRODUCT_DATA_CACHE = fetch(PRODUCT_DATA_URL, { cache: "no-store" })
      .then(function (response) { return response.ok ? response.text() : ""; })
      .then(function (source) {
        var rows = parseCsv(source);
        var headers = rows.shift() || [];
        return rows.map(function (row) {
          var result = {};
          headers.forEach(function (header, index) {
            result[text(header)] = row[index] || "";
          });
          return result;
        });
      })
      .catch(function () { return []; });
    return PRODUCT_DATA_CACHE;
  }

  function buildPackages(items, products) {
    var byCode = {};
    (products || []).forEach(function (product) {
      byCode[normalizeProductCode(product.ProductCode)] = product;
    });
    var totalWeight = 0;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var product = byCode[normalizeProductCode(item.productCode)];
      var weight = moneyNumber(product && product.Weight);
      if (!weight) return [];
      totalWeight += weight * (Number(item.quantity) || 1);
    }
    if (!totalWeight || totalWeight > 150) return [];
    return [{ weight: Number(totalWeight.toFixed(2)) }];
  }

  function checkoutZip() {
    var selectors = [
      "#ctl00_PageBody_DeliveryAddress_Postcode",
      "#ctl00_PageBody_DeliveryAddress_ZipCodeTextBox",
      "#ctl00_PageBody_DeliveryAddress_PostalCode",
      "#ctl00_PageBody_DeliveryAddress_PostcodeTextBox",
      "#gc_del_zip"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var el = document.querySelector(selectors[i]);
      var zip = text(el && el.value).match(/\d{5}/);
      if (zip) return zip[0];
    }
    return "";
  }

  function savedAccountZip() {
    return fetch("/AccountInfo_R.aspx", { credentials: "same-origin", cache: "no-store" })
      .then(function (response) { return response.ok ? response.text() : ""; })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var addressText = text(Array.prototype.map.call(doc.querySelectorAll(".accountInfoAddress li"), function (el) {
          return el.textContent;
        }).join(" "));
        return (addressText.match(/\b\d{5}(?:-\d{4})?\b/) || [])[0].slice(0, 5);
      })
      .catch(function () { return ""; });
  }

  async function promoSessionPayload() {
    var stored = currentPromo();
    if (!stored || stored.eligible !== true) return null;
    var items = stored.cart && stored.cart.length ? stored.cart : cartItems();
    var zip = checkoutZip() || await savedAccountZip();
    if (!zip) return null;
    var products = await getProductData();
    var packages = buildPackages(items, products);
    if (!packages.length) return null;
    return {
      code: stored.code,
      cart: items,
      cartSignature: stored.cartSignature || cartSignature(items),
      shipTo: { postalCode: zip, country: "US", residential: true },
      packages: packages
    };
  }

  async function registerPromoSession() {
    var payload = await promoSessionPayload();
    if (!payload) return null;
    try {
      var response = await fetch(PROMO_SESSION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.ok) throw new Error(result.error || "Promo could not be saved.");
      var stored = currentPromo();
      if (stored) {
        stored.serverClaim = {
          fingerprint: result.fingerprint,
          expiresAt: result.expiresAt,
          storage: result.storage
        };
        writeStored(stored);
      }
      return result;
    } catch (error) {
      console.warn("[WLShippingPromo] Promo session bridge failed.", error);
      return null;
    }
  }

  function schedulePromoSessionRegistration() {
    window.setTimeout(registerPromoSession, 150);
    window.setTimeout(registerPromoSession, 1200);
  }

  function readStored() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeStored(payload) {
    try {
      var value = JSON.stringify(payload);
      sessionStorage.setItem(STORAGE_KEY, value);
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
    notify();
  }

  function clearStored() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    notify();
  }

  function notify() {
    try { document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: readStored() })); } catch (e) {}
  }

  function currentPromo() {
    var stored = readStored();
    if (!stored || normalizePromo(stored.code) !== PROMO_CODE) return null;
    var items = cartItems();
    var signature = cartSignature(items);
    if (stored.cartSignature && stored.cartSignature !== signature) {
      if (!cartEligible(items)) {
        clearStored();
        return null;
      }
      stored.cartSignature = signature;
      stored.cart = items;
      stored.eligible = true;
      writeStored(stored);
    }
    return stored;
  }

  function promoPayload() {
    var stored = currentPromo();
    if (!stored || stored.eligible !== true) return null;
    return {
      code: stored.code,
      eligible: true,
      cart: stored.cart || cartItems(),
      cartSignature: stored.cartSignature || cartSignature()
    };
  }

  function applyCode(value) {
    var code = normalizePromo(value);
    var items = cartItems();
    var eligible = cartEligible(items);
    if (code !== PROMO_CODE) {
      clearStored();
      return { ok: false, message: "Promo code was not recognized." };
    }
    if (!eligible) {
      clearStored();
      return { ok: false, message: "This code is not available for the current cart." };
    }
    writeStored({
      code: DISPLAY_CODE,
      eligible: true,
      cart: items,
      cartSignature: cartSignature(items),
      ts: Date.now()
    });
    schedulePromoSessionRegistration();
    return { ok: true, message: "Code applied to eligible shipping options." };
  }

  function nativePromoInput() {
    return document.getElementById("ctl00_PageBody_PromotionCodeEntry_PromoCodeTextBox") ||
      document.querySelector("input[id*='PromoCode'], input[id*='PromotionCode']");
  }

  function mirrorNativePromo() {
    var stored = currentPromo();
    var input = nativePromoInput();
    if (!input || !stored) return;
    try {
      input.value = stored.code;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {}
  }

  function ensureStyles() {
    if (document.getElementById("wl-ups-promo-css")) return;
    var style = document.createElement("style");
    style.id = "wl-ups-promo-css";
    style.textContent = [
      ".wl-ups-promo{margin-top:12px;padding-top:12px;border-top:1px solid #d9dde2;font-family:Arial,sans-serif;}",
      ".wl-ups-promo label{display:block;margin-bottom:6px;color:#25282c;font-size:13px;font-weight:700;}",
      ".wl-ups-promo-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;}",
      ".wl-ups-promo input{width:100%;min-height:38px;padding:8px 10px;border:1px solid #b8bec5;border-radius:6px;font-size:14px;}",
      ".wl-ups-promo button{min-height:38px;padding:8px 12px;border:1px solid #6b0016;border-radius:6px;background:#6b0016;color:#fff;font-weight:700;cursor:pointer;}",
      ".wl-ups-promo button[data-action='remove']{border-color:#b8bec5;background:#f5f5f5;color:#25282c;}",
      ".wl-ups-promo-msg{min-height:18px;margin-top:6px;color:#60656b;font-size:12px;line-height:1.35;}",
      ".wl-ups-promo-msg.is-error{color:#8a1f11;}",
      ".wl-ups-promo-msg.is-ok{color:#226b35;}",
      "@media (max-width:540px){.wl-ups-promo-row{grid-template-columns:1fr;}.wl-ups-promo button{width:100%;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function promoHost() {
    return document.querySelector(".custom-subtotal-wrapper") ||
      document.querySelector(".custom-subtotal-wrapper .SubtotalWrapper") ||
      document.querySelector(".SubtotalWrapper") ||
      document.querySelector(".shopping-cart-details");
  }

  function renderPromoField() {
    var host = promoHost();
    var existing = document.getElementById("wl-ups-promo");
    if (!host) return;
    if (existing) {
      if (!host.contains(existing)) host.appendChild(existing);
      return;
    }
    ensureStyles();
    var stored = currentPromo();
    var wrap = document.createElement("div");
    wrap.id = "wl-ups-promo";
    wrap.className = "wl-ups-promo";
    wrap.innerHTML = '' +
      '<label for="wl-ups-promo-input">Shipping promo code</label>' +
      '<div class="wl-ups-promo-row">' +
      '  <input id="wl-ups-promo-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
      '  <button type="button" data-action="apply">Apply</button>' +
      '</div>' +
      '<div class="wl-ups-promo-msg" aria-live="polite"></div>';
    var checkout = host.querySelector("#ctl00_PageBody_PlaceOrderButton, [name='ctl00$PageBody$PlaceOrderButton'], .gc-guest-entry");
    if (checkout && checkout.parentNode && host.contains(checkout)) {
      checkout.parentNode.insertBefore(wrap, checkout);
    } else {
      host.appendChild(wrap);
    }

    var input = wrap.querySelector("input");
    var button = wrap.querySelector("button");
    var msg = wrap.querySelector(".wl-ups-promo-msg");

    function setMessage(message, kind) {
      msg.textContent = message || "";
      msg.classList.toggle("is-error", kind === "error");
      msg.classList.toggle("is-ok", kind === "ok");
    }

    function showApplied(payload) {
      input.value = payload ? payload.code : "";
      button.textContent = payload ? "Remove" : "Apply";
      button.dataset.action = payload ? "remove" : "apply";
      setMessage(payload ? "Code applied to eligible shipping options." : "", payload ? "ok" : "");
    }

    showApplied(stored);

    button.addEventListener("click", function () {
      if (button.dataset.action === "remove") {
        clearStored();
        showApplied(null);
        return;
      }
      var result = applyCode(input.value);
      if (result.ok) showApplied(currentPromo());
      else setMessage(result.message, "error");
      mirrorNativePromo();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        button.click();
      }
    });
  }

  function boot() {
    renderPromoField();
    mirrorNativePromo();
    schedulePromoSessionRegistration();
    window.setTimeout(renderPromoField, 500);
    window.setTimeout(renderPromoField, 1200);
    window.setTimeout(renderPromoField, 2500);
    window.setTimeout(mirrorNativePromo, 500);
  }

  window.WLShippingPromo = {
    applyCode: applyCode,
    cartEligible: cartEligible,
    cartItems: cartItems,
    isEligibleProduct: isEligible,
    read: currentPromo,
    registerSession: registerPromoSession,
    storageKey: STORAGE_KEY,
    toRatePayload: promoPayload,
    version: "20260707-bridge-2"
  };

  document.addEventListener("wl:fulfillment-change", schedulePromoSessionRegistration);
  document.addEventListener("change", function (event) {
    if (event.target && /DeliveryAddress|Postcode|Postal|Zip|gc_del_zip/i.test(event.target.id || event.target.name || "")) {
      schedulePromoSessionRegistration();
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  try {
    var manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager && !manager.__wlUpsShippingPromoHooked) {
      manager.__wlUpsShippingPromoHooked = true;
      manager.add_endRequest(boot);
    }
  } catch (e) {}
})();
